/**
 * Open shop for players (feature merchantShop, 1.31.0; GM only). The GM opens an Item Piles merchant on players' screens, each with
 * their own character as the buyer and seller, so Item Piles' normal buying and selling (prices, coins, the merchant's settings)
 * applies. Triggers: an "Open for players" button in the merchant window's header (GM view), a token HUD button on merchant tokens,
 * and `api.shop.open(merchant, { users })` / `api.shop.close(merchant)`.
 *
 * Item Piles does the remote part itself: `game.itempiles.API.renderItemPileInterface(target, { userIds, inspectingTarget })` sends
 * the open to those users' clients over Item Piles' own socket (3.3.4: src/API/api.js, `ItemPileSocket.executeForUsers(RENDER_INTERFACE,
 * …)`), and `unrenderItemPileInterface(target, { userIds })` closes it there. It takes one inspecting target per call, so each player
 * gets their own call (shop-model.mjs `openCalls`). The toolkit sends no socket message of its own and stores nothing: who the shop
 * was opened for is remembered on this GM client only, for Close for everyone.
 *
 * The pushed window is an ordinary Item Piles merchant window on the player's client, so the Sell all junk button (merchant.mjs) and
 * the item comparison tooltips (pane.mjs) attach to it as they do when the player opens the merchant themselves.
 */
import * as S from "./shop-model.mjs";
import { esc, UI_CLASSES } from "../vendor/wanderers-core/index.mjs";
import { card } from "./look-model.mjs";

const ID = "wayfarers-toolkit";
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
/** merchant UUID → user ids it was last opened for (this GM client only; nothing stored). */
const OPENED = new Map();

/** Item Piles' API when it is active and has the interface calls, else null. */
function itemPiles() {
  if (!game.modules.get("item-piles")?.active) return null;
  const IP = game.itempiles?.API;
  return IP?.renderItemPileInterface && IP?.unrenderItemPileInterface && IP?.isItemPileMerchant ? IP : null;
}

/**
 * The merchant as Item Piles wants it: a token document for a token (unlinked merchants keep their own stock), else the actor.
 * Accepts a Token, TokenDocument, Actor or UUID string.
 * @param {any} ref
 */
function merchantDoc(ref) {
  let d = ref;
  if (typeof d === "string") { try { d = foundry.utils.fromUuidSync(d); } catch { d = null; } }
  if (!d) return null;
  if (d.document) d = d.document; // a placeable Token
  if (d instanceof Actor && d.isToken && d.token) d = d.token; // a synthetic actor: use its token
  return d;
}

/** The user's character as Item Piles picks it (assigned, else the first character they own), or null. @param {any} u */
function characterOf(u) {
  if (u.character) return u.character;
  try { return game.actors.find(a => a.type === "character" && a.testUserPermission(u, "OWNER")) ?? null; } catch { return null; }
}

/** The facts shop-model.mjs reads, one per user. */
function userFacts() {
  const scene = canvas?.scene ?? null;
  const onScene = a => !!a && !!scene && scene.tokens.some(t => t.actorId === a.id);
  return game.users.map(u => {
    const c = u.isGM ? null : characterOf(u);
    let owned = false; try { owned = !!c?.testUserPermission(u, "OWNER"); } catch { owned = false; }
    return { id: u.id, name: u.name, isGM: !!u.isGM, active: !!u.active, character: c ? { uuid: c.uuid, name: c.name, owned } : null, onScene: onScene(c) };
  });
}

/** The pick dialog. Resolves to { ids, onlyOnScene } or null (cancelled). */
async function chooseDialog(merchant) {
  const { ok, skipped } = S.eligible(userFacts());
  if (!ok.length) {
    ui.notifications.warn(`Open for players: no connected player has a character they own${skipped.length ? ` (${S.skippedText(skipped)})` : ""}.`);
    return null;
  }
  const rows = ok.map(r => `<label class="wct-shop-row"><input type="checkbox" name="u.${esc(r.id)}" checked> <strong>${esc(r.name)}</strong> · ${esc(r.character)}${r.onScene ? "" : ' <span class="hint">(no token on this scene)</span>'}</label>`).join("");
  const content = `<p>Open <strong>${esc(merchant.name)}</strong> on these players' screens, each with their own character:</p>
    <div class="wct-shop-users">${rows}</div>
    <label class="wct-shop-row"><input type="checkbox" name="onlyOnScene"> Only players whose tokens are on this scene</label>
    ${skipped.length ? `<p class="hint">Left out: ${esc(S.skippedText(skipped))}.</p>` : ""}`;
  const f = await foundry.applications.api.DialogV2.prompt({
    classes: ["wct-window", "wct-dialog", ...UI_CLASSES], window: { title: `Open shop: ${merchant.name}` }, content, position: { width: 420 }, rejectClose: false,
    ok: { label: "Open for players", icon: "fa-solid fa-store", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object }
  });
  if (!f) return null;
  const ids = ok.filter(r => f[`u.${r.id}`]).map(r => r.id);
  return { ids, onlyOnScene: !!f.onlyOnScene };
}

/**
 * Opens the merchant's Item Piles window for players. `users` undefined: asks with the pick dialog; null: every connected player
 * with a character; else a user, id, name or a list of them. Returns the ids it was opened for (empty when nothing opened).
 * @param {any} ref merchant (Token, TokenDocument, Actor or UUID)
 * @param {{ users?: any, onlyOnScene?: boolean }} [opts]
 */
export async function open(ref, opts = {}) {
  if (!game.user.isGM) { ui.notifications.warn("Open for players: GM only."); return []; }
  const IP = itemPiles(); if (!IP) { ui.notifications.warn("Open for players needs Item Piles."); return []; }
  const merchant = merchantDoc(ref);
  let isMerchant = false; try { isMerchant = !!merchant && IP.isItemPileMerchant(merchant); } catch { isMerchant = false; }
  if (!isMerchant) { ui.notifications.warn("Open for players: that isn't an Item Piles merchant."); return []; }
  let requested; let onlyOnScene = !!opts.onlyOnScene;
  if (opts.users === undefined) {
    const c = await chooseDialog(merchant); if (!c) return [];
    requested = c.ids; onlyOnScene = c.onlyOnScene;
    if (!requested.length) { ui.notifications.info("Open for players: nobody was ticked."); return []; }
  } else requested = S.requestedIds(opts.users, game.users.map(u => ({ id: u.id, name: u.name })));
  const pick = S.pick(userFacts(), { requested, onlyOnScene });
  if (pick.skipped.length) ui.notifications.warn(`Open for players: not opened for ${S.skippedText(pick.skipped)}.`);
  const calls = S.openCalls(merchant.uuid, pick.users);
  const done = []; const failed = [];
  for (const c of calls) {
    const who = pick.users.find(r => r.id === c.userIds[0]);
    try { await IP.renderItemPileInterface(merchant, c); done.push(c.userIds[0]); }
    catch (e) { console.warn(`${ID} | Open for players: ${who?.name}`, e); failed.push(who?.name ?? c.userIds[0]); }
  }
  if (failed.length) ui.notifications.warn(`Open for players: Item Piles couldn't open ${merchant.name} for ${failed.join(", ")}.`);
  if (!done.length) { if (!pick.skipped.length && !failed.length) ui.notifications.warn("Open for players: no player to open it for."); return []; }
  OPENED.set(merchant.uuid, done);
  const names = pick.users.filter(r => done.includes(r.id)).map(r => r.name);
  ui.notifications.info(`${merchant.name} is open for ${names.join(", ")}.`);
  if (get("shopChatLine", false)) {
    try { await ChatMessage.create({ content: card(`<p><i class="fa-solid fa-store"></i> The shop is open: <strong>${esc(merchant.name)}</strong>.</p>`), whisper: [game.user.id, ...done], speaker: { alias: merchant.name } }); }
    catch (e) { console.warn(`${ID} | Open for players: chat line`, e); }
  }
  return done;
}

/**
 * Closes the merchant's window on the players it was opened for from this client (else every connected player). Never on a GM's
 * client. Returns the ids it asked Item Piles to close it for.
 * @param {any} ref
 */
export async function close(ref) {
  if (!game.user.isGM) { ui.notifications.warn("Close for everyone: GM only."); return []; }
  const IP = itemPiles(); if (!IP) { ui.notifications.warn("Close for everyone needs Item Piles."); return []; }
  const merchant = merchantDoc(ref); if (!merchant?.uuid) { ui.notifications.warn("Close for everyone: no merchant given."); return []; }
  const ids = S.closeTargets(OPENED.get(merchant.uuid), userFacts());
  OPENED.delete(merchant.uuid);
  if (!ids.length) { ui.notifications.info(`${merchant.name}: no connected player to close it for.`); return []; }
  try { await IP.unrenderItemPileInterface(merchant, { userIds: ids }); }
  catch (e) { console.warn(`${ID} | Close for everyone`, e); ui.notifications.warn(`Close for everyone: Item Piles couldn't close ${merchant.name} (${e.message}).`); return []; }
  ui.notifications.info(`${merchant.name} closed for the players.`);
  return ids;
}

/** Who the shop was last opened for from this client (ids), for the API and the header buttons. @param {any} ref */
export const openedFor = ref => [...(OPENED.get(merchantDoc(ref)?.uuid) ?? [])];

// ---------------------------------------------------------------- merchant window header (GM view) and token HUD
/** The merchant window's own document (token when it has one) for the header buttons. @param {any} app */
const appMerchant = app => { const m = app?.merchant; return m ? (m.token ?? m) : null; };

/** Adds Open for players / Close for everyone to a GM's Item Piles merchant window, once its element exists. */
function attach(app, tries = 0) {
  if (!game.user.isGM || !app?.merchant || !itemPiles()) return;
  const el = app.element?.[0] ?? app.element;
  const header = el?.querySelector?.(".window-header");
  if (!header) { if (tries < 40) setTimeout(() => attach(app, tries + 1), 100); return; }
  if (header.querySelector(".wct-shop-open")) return;
  const button = (cls, icon, text, tip, fn) => {
    const a = document.createElement("a");
    a.className = `header-button control ${cls}`; a.dataset.tooltipText = tip; a.innerHTML = `<i class="${icon}"></i> ${text}`;
    a.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); fn().catch(e => ui.notifications.error(`${text}: ${e.message}`)); });
    return a;
  };
  const o = button("wct-shop-open", "fa-solid fa-store", "Open for players", "Open this merchant on players' screens, each with their own character", () => open(appMerchant(app)));
  const c = button("wct-shop-close", "fa-solid fa-store-slash", "Close for everyone", "Close this merchant on the players' screens", () => close(appMerchant(app)));
  const x = header.querySelector(".close, [data-action=close]");
  if (x) { x.before(o); x.before(c); } else header.append(o, c);
}

/** Token HUD button on merchant tokens (GM): click opens for players, right-click closes for everyone. */
function addHudButton(hud, html) {
  if (!game.user.isGM) return;
  const IP = itemPiles(); if (!IP) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; const doc = hud.object?.document ?? hud.document;
  const col = root?.querySelector(".col.right") ?? root?.querySelector(".col.left"); if (!col || !doc) return;
  col.querySelector(".wct-shop-hud")?.remove();
  let merchant = false; try { merchant = !!IP.isItemPileMerchant(doc); } catch { merchant = false; }
  if (!merchant) return;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "control-icon wct-shop-hud";
  btn.dataset.tooltip = "Open for players. Right-click: close for everyone"; btn.setAttribute("aria-label", "Open shop for players");
  btn.innerHTML = '<i class="fa-solid fa-store"></i>';
  btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); open(doc).catch(e => ui.notifications.error(`Open for players: ${e.message}`)); });
  btn.addEventListener("contextmenu", ev => { ev.preventDefault(); ev.stopPropagation(); close(doc).catch(e => ui.notifications.error(`Close for everyone: ${e.message}`)); });
  col.append(btn);
}

/** Called from the module's init hook when merchantShop is on. */
export function init() {
  Hooks.on("item-piles-openInterface", app => { if (app?.merchant) attach(app); });
  Hooks.on("renderMerchantApp", app => attach(app));
  Hooks.on("renderTokenHUD", addHudButton);
}

export const api = { open, close, openedFor };
