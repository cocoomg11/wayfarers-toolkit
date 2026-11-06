/**
 * Merchant coin rounding (feature merchantRounding, 2.1; off by default). With it on, the active GM sets Item Piles' *Currency decimal
 * digits* to the smallest coin through Item Piles' own API (`setCurrencyDecimalDigits`), so merchant prices round to a whole smallest
 * coin instead of flooring to 0 (rounding-model.mjs explains why that is the only seam in Item Piles 3.3.4). The value found first is
 * kept in the hidden world setting merchantRoundingPrev and put back when the feature is turned off, the mode is set to Item Piles
 * default, or Remove toolkit data resets the settings. Nothing else is stored; no Item Piles internals are patched.
 */
import * as F from "./features.mjs";
import * as RM from "./rounding-model.mjs";
import { isActiveGM, settled } from "./gm.mjs";

const ID = "wayfarers-toolkit";
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };

/** Registered always (like every feature's settings), so a turned-off feature can still put Item Piles' value back. */
export function registerSettings() {
  game.settings.register(ID, "merchantRoundingMode", { name: "Merchant coin rounding: mode", hint: "Round to the nearest whole coin: Item Piles rounds merchant prices to whole copper (half a coin or more rounds up). Item Piles default: leave Item Piles' rounding alone.", scope: "world", config: false, type: String, default: RM.DEFAULT_MODE, choices: RM.MODES, onChange: () => { sync().catch(e => console.warn(`${ID} | merchant rounding`, e)); } });
  game.settings.register(ID, "merchantRoundingPrev", { scope: "world", config: false, type: String, default: "" });
}

/** Item Piles' API when the module is active, else null. */
function ipApi() { return game.modules.get("item-piles")?.active ? /** @type {any} */ (game).itempiles?.API ?? null : null; }

/** Merchants (world actors and unlinked tokens' actors) with Item Piles' merchant flag. */
function* merchants(IP) {
  const seen = new Set();
  const isM = a => { try { return !!IP.isItemPileMerchant(a); } catch { return false; } };
  for (const a of game.actors) if (isM(a)) { seen.add(a); yield a; }
  for (const s of game.scenes) for (const t of s.tokens) { const a = t.actorLink ? null : t.actor; if (a && !seen.has(a) && isM(a)) { seen.add(a); yield a; } }
}

/** Everything the rules need, read-only. */
export function facts() {
  const IP = ipApi();
  const mod = game.modules.get("item-piles");
  const ipVersion = String(mod?.version ?? "");
  const out = { on: F.on("merchantRounding"), ipActive: !!mod?.active, hasApi: typeof IP?.setCurrencyDecimalDigits === "function", ipVersion, newer: false, mode: String(get("merchantRoundingMode", RM.DEFAULT_MODE)), step: /** @type {number | null} */ (null), why: "", current: /** @type {number | null} */ (null), saved: RM.readSaved(get("merchantRoundingPrev", "")), low: /** @type {string[]} */ ([]), sample: /** @type {number | null} */ (null), currencies: /** @type {any[]} */ ([]) };
  if (!IP) return out;
  try { out.newer = !!ipVersion && foundry.utils.isNewerVersion(ipVersion, RM.CHECKED_IP); } catch { }
  const cur = Number(IP.CURRENCY_DECIMAL_DIGITS); out.current = Number.isFinite(cur) ? cur : null;
  const lists = [IP.CURRENCIES ?? []];
  const mods = [];
  for (const a of merchants(IP)) {
    try { const o = IP.getActorFlagData?.(a)?.overrideCurrencies; if (Array.isArray(o) && o.length) lists.push(o); } catch { }
    try { const m = IP.getMerchantPriceModifiers(a); mods.push({ name: a.name, buy: m?.buyPriceModifier, sell: m?.sellPriceModifier }); } catch { }
  }
  const s = RM.coinStep(lists);
  out.step = s.step; out.why = "why" in s ? s.why : "";
  out.low = RM.underHalf(mods);
  out.currencies = (IP.CURRENCIES ?? []).filter(c => !c.secondary);
  if (out.currencies.length > 1 && out.current !== null) {
    const smallest = Math.min(...out.currencies.map(c => c.exchangeRate));
    out.sample = RM.inSmallest(RM.ipPrice(smallest, 0.5, 1, out.currencies, out.current), out.currencies) ?? 0;
  }
  return out;
}

/** Applies the plan (active GM only). Returns the plan, or null when nothing could be read. */
export async function sync({ force = false } = {}) {
  if (!force && !isActiveGM()) return null;
  const IP = ipApi(); if (typeof IP?.setCurrencyDecimalDigits !== "function") return null;
  const f = facts();
  const p = RM.plan({ on: f.on, mode: f.mode, step: f.step, current: f.current, saved: f.saved });
  if (p.do === "set") {
    if (f.saved === null && p.save !== null) await game.settings.set(ID, "merchantRoundingPrev", String(p.save));
    await IP.setCurrencyDecimalDigits(p.value);
    console.log(`${ID} | merchant coin rounding: Item Piles' currency decimal digits ${f.current} → ${p.value}`);
  } else if (p.do === "restore") {
    await IP.setCurrencyDecimalDigits(p.value);
    await game.settings.set(ID, "merchantRoundingPrev", "");
    console.log(`${ID} | merchant coin rounding: Item Piles' currency decimal digits put back to ${p.value}`);
  } else if (p.do === "forget") await game.settings.set(ID, "merchantRoundingPrev", "");
  return p;
}

/** For cleanup's settings reset (any GM): puts Item Piles' value back if the toolkit changed it, whatever the feature switch says. */
export async function restore() {
  const IP = ipApi(); const saved = RM.readSaved(get("merchantRoundingPrev", ""));
  if (saved === null || typeof IP?.setCurrencyDecimalDigits !== "function") return false;
  const f = facts();
  const p = RM.plan({ on: false, mode: f.mode, step: f.step, current: f.current, saved });
  if (p.do === "restore") await IP.setCurrencyDecimalDigits(p.value);
  return p.do === "restore";
}

/**
 * Called from main.mjs `init` on every client, whatever the switch: one item-piles-ready listener (after Item Piles applies its system
 * defaults and the three-coin sync) so the active GM either applies the rounding or puts Item Piles' value back. With the feature on,
 * a change to Item Piles' currencies re-applies it.
 */
export function init() {
  Hooks.once("item-piles-ready", () => setTimeout(() => { settled().then(() => sync()).catch(e => console.warn(`${ID} | merchant rounding`, e)); }, 2500));
  if (!F.on("merchantRounding")) return;
  Hooks.on("updateSetting", setting => {
    if (setting?.key !== "item-piles.currencies" || !isActiveGM()) return;
    sync().catch(e => console.warn(`${ID} | merchant rounding`, e));
  });
}
