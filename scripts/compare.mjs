/**
 * Item comparison tooltips: the pure part (tested in Node). The character pane turns items into plain summaries (pane.mjs), and this
 * file says what the hovered item would be compared with and how the two differ: armour class, damage (dice, average and type),
 * attack and magic bonus, properties, attunement, value and weight. Each row has a tone: "better", "worse", "different" or "same".
 *
 * A summary: { name, kind ("weapon" | "armor" | "shield" | "gear"), ac, damage: [{ formula, types: [labels] }], attack, magic,
 * properties: [labels], attune (true when attunement is required), value (in the smallest coin), weight }. Unknown values are null.
 */
import * as WS from "./weapon-sets.mjs";

/** Average roll of a damage formula such as "1d8 + 2" or "2d6+1d4-1" (null when it can't be read). */
export function averageOf(formula) {
  const s = String(formula ?? "").replace(/\s+/g, ""); if (!s) return null;
  let total = 0; let any = false;
  for (const m of s.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+(?:\.\d+)?)(?!d)/gi)) {
    if (m[3]) { const n = Number(m[2] || 1), f = Number(m[3]); total += (m[1] === "-" ? -1 : 1) * n * (f + 1) / 2; any = true; }
    else if (m[5]) { total += (m[4] === "-" ? -1 : 1) * Number(m[5]); any = true; }
  }
  return any ? total : null;
}
const sumAvg = parts => { const xs = (parts ?? []).map(p => averageOf(p.formula)).filter(n => n != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; };
const fmtDamage = parts => (parts ?? []).filter(p => p.formula).map(p => `${p.formula}${p.types?.length ? ` ${p.types.join("/")}` : ""}`).join(" + ");
const typesOf = parts => [...new Set((parts ?? []).flatMap(p => p.types ?? []))].sort();
const signed = n => (n > 0 ? `+${n}` : `${n}`);

/**
 * Where a hand item would go, for comparing it with what's there: { set, hand } (weapon sets on) per the hands rules. Ranged weapons,
 * wands and rods → the Ranged set's ranged hand; shields and off-hand-only things → the off hand of the active set (Melee when the
 * active set is Ranged and the item can't go there); held things that aren't weapons → the Utility set's off hand; melee weapons → the
 * Melee set's main hand (the active set's, when that's Utility). `d`: weapon-sets describe(); `active`: the set in hand.
 */
export function compareHand(d, active = "melee") {
  if (!d) return null;
  if (d.rangedType || (d.wandRod && !d.offOnly)) return { set: "ranged", hand: "main" };
  if (d.shield || d.offOnly) {
    const set = WS.fitsHand(d, active, "off") ? active : "melee";
    return { set, hand: "off" };
  }
  if (d.held && !d.weapon) return { set: "utility", hand: WS.fitsHand(d, "utility", "off") ? "off" : "main" };
  if (d.weapon) return { set: active === "utility" ? "utility" : "melee", hand: "main" };
  return null;
}

/**
 * A note about hands for putting `d` in a set, or "": a two-handed weapon would empty the off hand or need a shield stowed, and a
 * weapon that loads ammunition needs the shield's hand. `off`: the set's off-hand item (described); `worn`: equipped shields elsewhere.
 */
export function handNote(d, { off = null, worn = [], hand = "main" } = {}) {
  if (!d || hand !== "main") return "";
  const shield = [off, ...worn].find(s => s?.shield && !(s.buckler && !d.two));
  if (d.two && shield) return `Needs both hands: ${shield.name} would have to be stowed.`;
  if (d.two && off) return `Needs both hands: ${off.name} would come out of the off hand.`;
  if (d.ammo && shield && !shield.buckler) return `Needs a free hand to load: ${shield.name} would have to be stowed.`;
  return "";
}

const row = (key, label, a, b, tone) => ({ key, label, a, b, tone });
/** Numbers: higher is better (or lower, with `lower`). Missing on one side counts as 0 when `zero`, else the row is "different". */
function numRow(key, label, x, y, { lower = false, zero = false, fmt = String } = {}) {
  if (zero) { x ??= 0; y ??= 0; }
  if (x == null && y == null) return null;
  if (x == null || y == null) return row(key, label, x == null ? "–" : fmt(x), y == null ? "–" : fmt(y), "different");
  const tone = x === y ? "same" : (lower ? x < y : x > y) ? "better" : "worse";
  return row(key, label, fmt(x), fmt(y), tone);
}

/**
 * The differences between `a` (the hovered item) and `b` (what's in the slot or hand now; null for an empty slot). Returns
 * { rows: [{ key, label, a, b, tone }], empty } with only the rows that apply; `same` rows are kept so the tooltip lines up, but a
 * caller may drop them. `fmtMoney` formats values (smallest coin → text).
 */
export function diffItems(a, b, { fmtMoney = n => `${n}`, fmtWeight = n => `${n}` } = {}) {
  if (!a) return { rows: [], empty: true };
  const rows = [];
  const push = r => { if (r) rows.push(r); };
  const bb = b ?? {};
  if (a.ac != null || bb.ac != null) push(numRow("ac", "Armor Class", a.ac, bb.ac, { zero: !b }));
  const da = a.damage ?? [], db = bb.damage ?? [];
  if (da.length || db.length) {
    const xa = sumAvg(da), xb = sumAvg(db);
    const tone = xa == null || xb == null ? (xa === xb ? "same" : "different") : xa === xb ? "same" : xa > xb ? "better" : "worse";
    const show = (parts, avg) => parts.length ? `${fmtDamage(parts)}${avg != null ? ` (avg ${Math.round(avg * 10) / 10})` : ""}` : "–";
    push(row("damage", "Damage", show(da, xa), show(db, xb), b ? tone : (xa ? "better" : "different")));
    const ta = typesOf(da), tb = typesOf(db);
    if (b && ta.join() !== tb.join() && ta.length && tb.length) push(row("damageType", "Damage type", ta.join(", "), tb.join(", "), "different"));
  }
  if (a.attack || bb.attack) push(numRow("attack", "Attack bonus", a.attack || 0, bb.attack || 0, { fmt: signed }));
  if (a.magic || bb.magic) push(numRow("magic", "Magic bonus", a.magic || 0, bb.magic || 0, { fmt: signed }));
  const pa = new Set(a.properties ?? []), pb = new Set(bb.properties ?? []);
  const added = [...pa].filter(p => !pb.has(p)), lost = [...pb].filter(p => !pa.has(p));
  if (b && (added.length || lost.length)) push(row("properties", "Properties", added.length ? `+ ${added.join(", ")}` : "–", lost.length ? `− ${lost.join(", ")}` : "–", "different"));
  else if (!b && pa.size) push(row("properties", "Properties", [...pa].join(", "), "–", "different"));
  if (!!a.attune !== !!bb.attune) push(row("attune", "Attunement", a.attune ? "Required" : "None", bb.attune ? "Required" : "None", a.attune ? "worse" : "better"));
  push(numRow("value", "Value", a.value, b ? bb.value : null, { fmt: fmtMoney }));
  push(numRow("weight", "Weight", a.weight, b ? bb.weight : null, { lower: true, fmt: fmtWeight }));
  return { rows, empty: false };
}
