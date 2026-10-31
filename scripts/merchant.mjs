/**
 * Sell all junk (part of Vendor Trash; switch: "Sell all junk button"). When a player (or the GM) has an Item Piles merchant open for
 * a character, the merchant window gets a "Sell all junk" button in its header. It sells every grey item the character carries
 * (junk-rules.mjs says what counts and what's kept back: equipped items, favourites, items in a weapon set) through Item Piles'
 * own tradeItems, so the merchant's prices, modifiers and the coins Item Piles uses apply, after a confirm listing each item and the
 * total. Item Piles carries the trade out on a GM's client, so a GM has to be connected.
 */
import * as J from "./junk-rules.mjs";
import * as WS from "./weapon-sets.mjs";
import { wowInfo } from "./pane.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
export const enabled = () => !!get("junkSellButton", true);

function itemPiles() {
  if (!game.modules.get("item-piles")?.active) return null;
  const IP = game.itempiles?.API;
  return IP?.tradeItems && IP?.getPricesForItem ? IP : null;
}
const actorOf = x => x instanceof Actor ? x : x?.actor ?? null;

/** The character's junk, described and split into what sells and what's kept, with Item Piles' price for each. */
export function plan(seller, merchant) {
  const IP = itemPiles(); if (!IP || !seller) return { sell: [], kept: [] };
  const sets = new Set(WS.assignedIds(WS.normalize(seller.getFlag?.(ID, "weaponSets") ?? null)));
  const favs = seller.system?.favorites ?? [];
  const described = [];
  for (const i of seller.items) {
    if (!J.PHYSICAL.has(i.type) || i.system?.container) continue;
    const d = { id: i.id, name: i.name, img: i.img, type: i.type, trash: !!i.getFlag(ID, "trash"), color: wowInfo(i).color, rarity: i.system?.rarity ?? "",
      equipped: !!i.system?.equipped, favourite: J.isFavourite(favs, i.id), inSet: sets.has(i.id), quantity: Number(IP.getItemQuantity?.(i) ?? i.system?.quantity ?? 1), price: null };
    if (!J.isJunk(d)) continue;
    try {
      const p = IP.getPricesForItem(i, { seller, buyer: merchant, quantity: d.quantity })?.[0];
      d.price = p && !p.free ? Number(p.totalCost) || 0 : 0; d.priceString = p?.priceString ?? "";
    } catch (e) { d.price = 0; d.priceString = ""; console.warn(`${ID} | Sell all junk: no price for ${i.name}`, e); }
    described.push(d);
  }
  return J.selectJunk(described);
}

/** The total in the smallest coin (for fmtMoney), from Item Piles' primary-currency totals. */
function smallestTotal(IP, total) {
  const rates = (IP.CURRENCIES ?? []).map(c => Number(c.exchangeRate)).filter(n => n > 0);
  return rates.length ? J.toSmallest(total, Math.min(...rates)) : Math.round(total);
}

/** Sells `seller`'s junk to `merchant` (actors or tokens) after a confirm. Returns the number of items sold. */
export async function sellJunk(sellerRef, merchantRef) {
  const IP = itemPiles(); if (!IP) return ui.notifications.warn("Sell all junk needs Item Piles.");
  const seller = actorOf(sellerRef); const merchant = actorOf(merchantRef);
  if (!seller?.isOwner) return ui.notifications.warn("Sell all junk: open the merchant with a character you own.");
  if (!merchant || !IP.isItemPileMerchant(merchant.token ?? merchant)) return ui.notifications.warn("Sell all junk: that isn't a merchant.");
  if (!game.users.some(u => u.isGM && u.active)) return ui.notifications.warn("Sell all junk: a GM needs to be connected.");
  const { sell, kept } = plan(seller, merchant);
  const api = game.modules.get(ID)?.api; const money = n => api?.fmtMoney ? api.fmtMoney(n) : `${n}`;
  if (!sell.length) {
    return ui.notifications.info(`${seller.name} has no junk to sell${kept.length ? ` (kept: ${kept.map(k => `${k.name}, ${k.reasonText}`).join("; ")})` : ""}.`);
  }
  const total = sell.reduce((t, d) => t + d.price, 0);
  const line = d => `<li><img src="${esc(d.img)}" alt="" width="20" height="20" style="vertical-align:middle;border:none"> ${esc(d.name)}${d.quantity > 1 ? ` ×${d.quantity}` : ""}: ${esc(d.priceString || money(smallestTotal(IP, d.price)))}</li>`;
  const ok = await foundry.applications.api.DialogV2.confirm({
    classes: ["wct-window"], window: { title: `Sell all junk to ${merchant.name}` }, rejectClose: false,
    content: `<p><strong>${esc(seller.name)}</strong> sells:</p><ul class="wct-junk-list">${sell.map(line).join("")}</ul>
      <p>Total: <strong>${esc(money(smallestTotal(IP, total)))}</strong> (the merchant's prices).</p>
      ${kept.length ? `<p class="hint">Kept: ${kept.map(k => `${esc(k.name)} (${esc(k.reasonText)})`).join(", ")}.</p>` : ""}`
  });
  if (!ok) return 0;
  const items = sell.map(d => ({ item: d.id, quantity: d.quantity, paymentIndex: 0 }));
  try {
    await IP.tradeItems(seller, merchant, items);
    ui.notifications.info(`${seller.name} sold ${sell.length} junk item${sell.length === 1 ? "" : "s"} to ${merchant.name}.`);
    return sell.length;
  } catch (e) {
    // One item Item Piles won't take (the merchant can't pay for it, say) stops the whole batch: sell what it will, one by one.
    console.warn(`${ID} | Sell all junk: batch trade failed, trying item by item`, e);
    let n = 0; const failed = [];
    for (const it of items) {
      const d = sell.find(x => x.id === it.item);
      try { if (seller.items.get(it.item)) { await IP.tradeItems(seller, merchant, [it]); n++; } } catch (err) { failed.push(d?.name ?? it.item); }
    }
    if (failed.length) ui.notifications.warn(`Sell all junk: ${merchant.name} wouldn't buy ${failed.join(", ")}.`);
    if (n) ui.notifications.info(`${seller.name} sold ${n} junk item${n === 1 ? "" : "s"} to ${merchant.name}.`);
    return n;
  }
}

/** Adds the header button to an open Item Piles merchant window, once its element exists. */
function attach(app, tries = 0) {
  if (!enabled() || !app) return;
  const merchant = app.merchant ?? null; const buyer = app.recipient ?? null;
  if (!merchant || !buyer?.isOwner) return;
  const IP = itemPiles(); if (!IP) return;
  try { if (IP.getActorFlagData?.(merchant)?.purchaseOnly) return; } catch { /* older Item Piles */ }
  const el = app.element?.[0] ?? app.element;
  const header = el?.querySelector?.(".window-header");
  if (!header) { if (tries < 40) setTimeout(() => attach(app, tries + 1), 100); return; }
  if (header.querySelector(".wct-sell-junk")) return;
  const a = document.createElement("a");
  a.className = "header-button control wct-sell-junk"; a.dataset.tooltip = "Sell every grey item this character carries (asks first)";
  a.innerHTML = '<i class="fa-solid fa-sack-dollar"></i> Sell all junk';
  a.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); sellJunk(app.recipient ?? buyer, app.merchant ?? merchant); });
  const close = header.querySelector(".close, [data-action=close]");
  close ? close.before(a) : header.append(a);
}

/** Called from the module's init hook when Vendor Trash is on. */
export function init() {
  Hooks.on("item-piles-openInterface", (app, source) => { if (app?.merchant || app?.constructor?.name === "MerchantApp") attach(app); });
  Hooks.on("renderMerchantApp", app => attach(app));
}

export const api = { sellJunk, plan };
