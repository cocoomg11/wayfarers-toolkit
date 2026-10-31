/**
 * Party gold tracker (feature "partyGold"): pure maths, tested in Node. The window is in gold.mjs.
 *
 * Wealth is the coin of the player characters and the party group actor (coins in containers count), plus, optionally, the value
 * of their mundane gear (items with no rarity that aren't magical). It's compared with a wealth curve: gold per character for each
 * act (or tier), times the party size. Amounts are in the smallest coin in use (`coinVals`: { gp: 100, sp: 10, cp: 1 } in standard
 * coins, { gp: 10000, sp: 100, cp: 1 } with three coins).
 */

/** Default curve, gold per character for Act/Tier 1 to 9. Editable in the control panel; nothing campaign-specific. */
export const DEFAULT_CURVE = [1, 3, 15, 30, 75, 200, 400, 600, 1200];
export const curveText = (c = DEFAULT_CURVE) => c.join(", ");

/**
 * The curve setting → { curve, error }. Numbers separated by commas, semicolons, spaces or new lines; an optional "g" or "gp" after
 * each is allowed. Blank → the default curve. On an unreadable entry: curve null and an error naming it.
 */
export function parseCurve(text) {
  const src = String(text ?? "").trim();
  if (!src) return { curve: [...DEFAULT_CURVE], error: null };
  const parts = src.split(/[,;\s]+/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^(\d+(?:\.\d+)?)(?:g|gp)?$/i);
    if (!m) return { curve: null, error: `"${p}" isn't an amount of gold` };
    out.push(+m[1]);
  }
  if (out.length > 20) return { curve: null, error: "at most 20 acts" };
  return { curve: out, error: null };
}

/** Standard 5e coins in gold, for prices in a coin the world doesn't use (platinum with three coins). */
export const STANDARD_GP = { pp: 10, gp: 1, ep: 0.5, sp: 0.1, cp: 0.01 };

/** Coins on an actor or container (`currency` object) → smallest coin. Coins not in use are ignored. */
export function coinBase(currency, coinVals) {
  let t = 0;
  for (const [k, v] of Object.entries(coinVals ?? {})) t += Math.max(0, +currency?.[k] || 0) * v;
  return Math.round(t);
}

/** An item price { value, denomination } → smallest coin. */
export function priceBase(price, coinVals) {
  const value = Math.max(0, +price?.value || 0); if (!value) return 0;
  const d = String(price?.denomination || "gp").toLowerCase();
  const per = coinVals?.[d] ?? (STANDARD_GP[d] ?? 1) * (coinVals?.gp ?? 100);
  return Math.round(value * per);
}

export const PHYSICAL = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);
/** Mundane: a physical item with no rarity that isn't magical. `item`: { type, rarity, magical }. */
export const isMundane = item => PHYSICAL.has(item?.type) && !String(item?.rarity ?? "").trim() && !item?.magical;

/** Value of the mundane items in a list: Σ quantity × price. `items`: [{ type, rarity, magical, quantity, price }]. */
export function gearBase(items, coinVals) {
  let t = 0;
  for (const i of items ?? []) if (isMundane(i)) t += Math.max(0, Math.floor(+(i.quantity ?? 1) || 0)) * priceBase(i.price, coinVals);
  return Math.round(t);
}

/**
 * Status of wealth against a target: green (75% to 150% of it), amber (50% to 75%, or 150% to 200%) or red (further off).
 * A target of 0 is green only while there's no wealth either.
 */
export const BANDS = { greenLow: 0.75, greenHigh: 1.5, amberLow: 0.5, amberHigh: 2 };
export function status(wealth, target) {
  if (!(target > 0)) return wealth > 0 ? "red" : "green";
  const r = wealth / target;
  if (r >= BANDS.greenLow && r <= BANDS.greenHigh) return "green";
  if (r >= BANDS.amberLow && r <= BANDS.amberHigh) return "amber";
  return "red";
}
/** "on track", "below" or "above" for a status line. */
export const direction = (wealth, target) => status(wealth, target) === "green" ? "on track" : wealth < target ? "below" : "above";

/**
 * One row per act: { act, perChar (gold), target (smallest coin), ratio, status, direction, current }.
 * `size`: party size; `gpVal`: one gold in the smallest coin; `current`: the act the party is in (1-based).
 */
export function actRows({ curve = DEFAULT_CURVE, size = 4, wealth = 0, gpVal = 100, current = 1 } = {}) {
  const n = Math.max(1, Math.floor(+size || 1));
  return curve.map((g, i) => {
    const target = Math.round(g * gpVal * n);
    return { act: i + 1, perChar: g, target, ratio: target > 0 ? wealth / target : null, status: status(wealth, target), direction: direction(wealth, target), current: i + 1 === current };
  });
}

/** The act setting clamped to the curve: 1 … curve length. */
export const clampAct = (act, curve = DEFAULT_CURVE) => Math.min(Math.max(1, curve.length), Math.max(1, Math.floor(+act || 1)));

/** Adds a snapshot (newest first, at most `max`); bad stored lists are ignored. */
export function addSnapshot(list, snap, max = 50) {
  const clean = (Array.isArray(list) ? list : []).filter(s => s && typeof s === "object");
  return [snap, ...clean].slice(0, max);
}
