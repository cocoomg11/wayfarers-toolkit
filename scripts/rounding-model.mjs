/**
 * Merchant coin rounding (feature merchantRounding, 2.1): the pure rules, no Foundry calls (tested in Node). rounding.mjs gathers
 * the facts and writes through Item Piles' own API.
 *
 * The problem: Item Piles multiplies an item's price by the merchant's price modifier and rounds the result to its *Currency decimal
 * digits* setting (default 0.00001, five decimals of the primary coin). Then it splits the amount into coins, flooring each coin.
 * With gold as the primary coin and copper worth 0.0001 of it, a 1-copper item at 50% is 0.00005 gold: kept at five decimals, then
 * floored to 0 copper, so it shows "0g 0s 0c" and is free; 3 copper at 50% (1.5 copper) shows 1 copper.
 *
 * The seam: Item Piles 3.3.4 has no hook around its price maths and ships as one bundled file, so nothing inside can be wrapped. Its
 * public API has `setCurrencyDecimalDigits(n)`, and with several coins of different exchange rates that setting is the precision every
 * price, payment and change sum is rounded to. Set to the smallest coin (0.0001 here), a price is rounded to a whole smallest coin
 * before the floor: half a coin or more rounds up (1 copper at 50% → 1c, 3 copper at 50% → 2c), less than half rounds down.
 * True "always up" rounding is not reachable without patching Item Piles' internals.
 */

/** The rounding modes (setting merchantRoundingMode). */
export const MODES = { coin: "Round to the nearest whole coin", itemPiles: "Item Piles default" };
export const DEFAULT_MODE = "coin";
/** The Item Piles version whose maths this was read from (src/helpers/pile-utilities.js getPriceData / getPriceArray). */
export const CHECKED_IP = "3.3.4";
/** Item Piles reads the setting's digits with toString(): past six decimals JavaScript writes 1e-7, which it can't read. */
export const MAX_DIGITS = 6;

/**
 * Decimal places of a number (0.0001 → 4, 0.5 → 1, 10 → 0), up to 10.
 * @param {number} x
 */
export function places(x) {
  const n = Math.abs(Number(x));
  if (!Number.isFinite(n)) return 0;
  for (let k = 0; k <= 10; k++) if (Math.abs(Number(n.toFixed(k)) - n) < 1e-12) return k;
  return 10;
}

/**
 * The precision that makes Item Piles round to the smallest coin, from one or more currency lists (the world's, and merchants' own
 * override lists): `{ step, digits }`, or `{ step: null, why }` when the setting doesn't apply or can't be set:
 * "none" (no coins), "oneCoin" (a single primary coin: Item Piles uses the setting differently there), "sharedRates" (two coins share
 * an exchange rate: Item Piles works the precision out itself), "tooFine" (a coin finer than six decimals).
 * @param {Array<Array<{ exchangeRate?: number, secondary?: boolean }>>} lists
 * @returns {{ step: number, digits: number } | { step: null, why: string }}
 */
export function coinStep(lists) {
  let digits = -1;
  for (const list of lists ?? []) {
    const rates = (list ?? []).filter(c => c && !c.secondary && Number(c.exchangeRate) > 0).map(c => Number(c.exchangeRate));
    if (!rates.length) continue;
    if (rates.length === 1) { if (lists.length === 1) return { step: null, why: "oneCoin" }; continue; }
    if (new Set(rates).size !== rates.length) { if (lists.length === 1) return { step: null, why: "sharedRates" }; continue; }
    for (const r of rates) digits = Math.max(digits, places(r));
  }
  if (digits < 0) return { step: null, why: "none" };
  if (digits > MAX_DIGITS) return { step: null, why: "tooFine" };
  return { step: Number((10 ** -digits).toFixed(digits)), digits };
}

/** The stored "value before the toolkit changed it" (setting merchantRoundingPrev, a string) → number or null. */
export function readSaved(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

const same = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-12;

/**
 * What to do with Item Piles' Currency decimal digits.
 * - on, mode coin, a step: set it (remembering the value found, unless one is remembered already); nothing when it's already right.
 * - otherwise, with a remembered value: put it back when Item Piles still has our value ("restore"); if someone changed it since,
 *   leave theirs and only forget ours ("forget").
 * @param {{ on: boolean, mode: string, step: number | null, current: number | null | undefined, saved: number | null }} f
 * @returns {{ do: "set", value: number, save: number | null } | { do: "restore", value: number } | { do: "forget" } | { do: "none", why: string }}
 */
export function plan({ on, mode, step, current, saved }) {
  if (on && mode === "coin") {
    if (typeof step !== "number") return { do: "none", why: "noStep" };
    if (same(current, step)) return { do: "none", why: "already" };
    return { do: "set", value: step, save: saved ?? (typeof current === "number" ? current : null) };
  }
  if (saved === null || saved === undefined) return { do: "none", why: "nothingSaved" };
  // What we set is the smallest-coin step; if Item Piles holds something else now, the GM (or Item Piles) changed it: keep that.
  if (typeof step === "number" && !same(current, step)) return { do: "forget" };
  if (same(current, saved)) return { do: "forget" };
  return { do: "restore", value: saved };
}

// ---------------------------------------------------------------- Item Piles 3.3.4's maths, copied for tests and the health check
/** Item Piles' Helpers.roundToDecimals. */
export const ipRound = (num, decimals) => Number(Math.round(Number(num + "e" + (decimals ?? 0))) + "e-" + (decimals ?? 0));
/** How Item Piles turns the setting into decimals (getDecimalDifferenceBetweenExchangeRates, unique-rates case). */
export const ipDecimals = setting => String(setting ?? 0.00001).split(".")[1]?.length ?? 0;

/**
 * Item Piles 3.3.4's price for `cost` (in the primary coin) × `modifier` × `quantity`, split into coins, for primary coins with unique
 * exchange rates and the primary coin not the smallest (gold primary). `{ free: true }` (cost 0), `{ none: true }` (the rounded unit
 * price is 0: Item Piles lists no coin price), else `{ coins: [{ rate, n }] }` most valuable first.
 * @param {number} cost @param {number} modifier @param {number} quantity
 * @param {Array<{ exchangeRate: number, primary?: boolean }>} currencies @param {number} setting Currency decimal digits
 */
export function ipPrice(cost, modifier, quantity, currencies, setting) {
  const rates = currencies.map(c => c.exchangeRate);
  const smallest = Math.min(...rates);
  if (!(cost > 0) || cost < smallest || modifier <= 0) return { free: true };
  const d = ipDecimals(setting);
  const base = ipRound(cost * modifier, d);
  if (!base) return { none: true };
  let fraction = ipRound((base * quantity) % 1, d);
  const whole = Math.round(base * quantity - fraction);
  const primary = currencies.find(c => c.primary) ?? currencies[0];
  const out = [];
  for (const c of [...currencies].sort((a, b) => b.exchangeRate - a.exchangeRate)) {
    if (c === primary && whole) { out.push({ rate: c.exchangeRate, n: whole }); continue; }
    const n = Math.floor(ipRound(fraction / c.exchangeRate, d));
    fraction = ipRound(fraction - n * c.exchangeRate, d);
    out.push({ rate: c.exchangeRate, n });
  }
  return { coins: out };
}

/** A price from ipPrice → its value in smallest coins (null for free / no price). */
export function inSmallest(price, currencies) {
  if (!price?.coins) return null;
  const smallest = Math.min(...currencies.map(c => c.exchangeRate));
  return price.coins.reduce((s, c) => s + Math.round(c.n * c.rate / smallest), 0);
}

/**
 * Merchants whose own buy or sell modifier is above 0 and under one half: there an item worth one smallest coin rounds to no price.
 * @param {Array<{ name: string, buy?: number, sell?: number }>} merchants
 */
export function underHalf(merchants) {
  const low = m => typeof m === "number" && m > 0 && m < 0.5;
  return (merchants ?? []).filter(m => low(m.buy) || low(m.sell)).map(m => m.name);
}

/**
 * The health check's lines (plain words; health.mjs escapes names): [{ level, text }].
 * @param {{ on: boolean, ipActive: boolean, hasApi: boolean, ipVersion?: string, newer?: boolean, mode: string, step: number | null,
 *   why?: string, current?: number | null, low?: string[], sample?: number | null }} f
 */
export function healthLines(f) {
  if (!f.on) return [{ level: "off", text: "Merchant coin rounding: off (Item Piles' own rounding: a price under one smallest coin can show as 0)." }];
  if (!f.ipActive) return [{ level: "warn", text: "Merchant coin rounding: on, but Item Piles isn't active." }];
  if (!f.hasApi) return [{ level: "bad", text: `Merchant coin rounding: this Item Piles version${f.ipVersion ? ` (${f.ipVersion})` : ""} has no setCurrencyDecimalDigits, so nothing is changed.` }];
  if (f.mode !== "coin") return [{ level: "off", text: "Merchant coin rounding: on, set to Item Piles default (nothing changed)." }];
  if (typeof f.step !== "number") {
    const why = { oneCoin: "there is only one coin", sharedRates: "two coins share an exchange rate (Item Piles works the precision out itself)", tooFine: "a coin is finer than six decimals of the primary coin", none: "Item Piles has no coins set up" }[f.why ?? ""] ?? "Item Piles' coins can't be read";
    return [{ level: "info", text: `Merchant coin rounding: nothing to do (${why}).` }];
  }
  const out = [];
  if (Math.abs((f.current ?? -1) - f.step) > 1e-12) out.push({ level: "warn", text: `Merchant coin rounding: Item Piles' Currency decimal digits is ${f.current ?? "unset"}, not ${f.step} yet (set by the active GM when the world loads).` });
  else out.push({ level: "ok", text: `Merchant coin rounding: on. Item Piles rounds merchant prices to a whole smallest coin (half a coin or more rounds up)${typeof f.sample === "number" ? `; an item worth 1 smallest coin at half price costs ${f.sample}` : ""}.` });
  if (f.low?.length) out.push({ level: "warn", text: `Merchant coin rounding: ${f.low.length === 1 ? "this merchant buys or sells" : "these merchants buy or sell"} under half price, so an item worth 1 smallest coin has no price there: ${f.low.join(", ")}.` });
  if (f.newer) out.push({ level: "info", text: `Merchant coin rounding: checked against Item Piles ${CHECKED_IP}; this world runs ${f.ipVersion}. If prices look wrong, set the rounding to Item Piles default.` });
  return out;
}
