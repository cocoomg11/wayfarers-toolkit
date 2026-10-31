/**
 * Weapon sets for the character pane: the pure rules, with no Foundry calls (tested in Node). The pane (pane.mjs) reads the actor and
 * its items, turns each item into a plain description with describe(), and asks these functions what fits where, whether a set can be
 * made active, what a swap equips and unequips, and what the chat line says.
 *
 * Three sets, exactly one active: Melee (main + off hand), Ranged (the ranged weapon + off hand) and Utility (main + off hand, for a
 * weapon with a torch, a lantern, an instrument or a held focus). Only the active set's items are equipped on the dnd5e sheet.
 * Stored on the actor as flags.wayfarers-toolkit.weaponSets = { v: 1, active, sets: { melee: { main, off }, ranged: {...}, utility: {...} } }
 * (item ids or null).
 *
 * Shields are worn, not held for a swap: an equipped shield stays on when the sets change, so a set that would need the shield's hand
 * (a two-handed weapon, a second off-hand item, a weapon that fires ammunition and needs a free hand to load) is blocked until the
 * shield is taken off as a separate step. A buckler is strapped to the arm and leaves the hand free; it's only blocked with two-handed
 * weapons.
 */
export const ID = "wayfarers-toolkit";

export const SETS = {
  melee: { label: "Melee", icon: "fa-sword" },
  ranged: { label: "Ranged", icon: "fa-bow-arrow" },
  utility: { label: "Utility", icon: "fa-toolbox" }
};
export const SET_IDS = Object.keys(SETS);
export const HANDS = { main: "Main hand", off: "Off hand" };
/** The ranged set's main hand is shown as the Ranged slot. */
export const handLabel = (set, hand) => set === "ranged" && hand === "main" ? "Ranged" : HANDS[hand];

/** The single-slot names the pane used before weapon sets, for each set hand: the item flag that mirrors where an active item sits. */
export const LEGACY_SLOT = { melee: { main: "mainhand", off: "offhand" }, ranged: { main: "ranged", off: "offhand" }, utility: { main: "mainhand", off: "offhand" } };

// ---------------------------------------------------------------- reading an item
const FOCUS_RE = /\b(holy symbol|arcane focus|druidic focus|spellcasting focus|emblem|reliquary|sprig of mistletoe|yew wand|wooden staff)\b/i;
const RELIC_RE = /\b(libram|idol|totem|relic|sigil)s?\b/i;
const HELD_RE = /\b(torch|lantern|lamp|candle|lute|flute|drum|horn|lyre|harp|bagpipes|viol|shawm|dulcimer|pan pipes|instrument|holy symbol|orb|crystal|rod|staff|wand|tome|book|libram|idol|totem|sigil|reliquary|emblem)\b/i;
const ARMOR = new Set(["light", "medium", "heavy", "natural"]);
const toSet = p => p instanceof Set ? p : new Set(Array.isArray(p) ? p : Object.keys(p ?? {}).filter(k => p[k] === true || p[k] === 1));
const flag = (item, key) => item?.flags?.[ID]?.[key];

/** True when an item counts as a buckler: its flag when set (true or false), else "buckler" in its name. Shields only. */
export function isBuckler(item) {
  if (item?.type !== "equipment" || item.system?.type?.value !== "shield") return false;
  const f = flag(item, "buckler"); if (typeof f === "boolean") return f;
  return /buckler/i.test(item.name ?? "");
}
/** True for a spellcasting focus: the Spellcasting Focus property, or a focus-like name. */
export function isFocus(item) {
  return toSet(item?.system?.properties).has("foc") || FOCUS_RE.test(item?.name ?? "");
}
/** True for an item that may go in the relic slot: a spellcasting focus, or a relic (its flag when set, else a relic-like name). */
export function isRelicItem(item) {
  if (!item || !("equipped" in (item.system ?? {}))) return false;
  if (item.type === "weapon" || (item.type === "equipment" && (ARMOR.has(item.system?.type?.value) || item.system?.type?.value === "shield"))) return false;
  const f = flag(item, "relic"); if (typeof f === "boolean") return f;
  return isFocus(item) || RELIC_RE.test(item.name ?? "");
}

/**
 * A plain description of an item for the hands rules. `tip` is the MMO tooltip slot line when the item has one ("two-hand",
 * "off hand", …), `two` overrides two-handedness.
 */
export function describe(item, { tip = null, two = null, versatileFormula = "" } = {}) {
  if (!item) return null;
  const sys = item.system ?? {}; const t = sys.type?.value ?? ""; const p = toSet(sys.properties);
  const weapon = item.type === "weapon";
  const shield = item.type === "equipment" && t === "shield";
  const w = tip ? String(tip).toLowerCase() : null;
  const rangedType = (weapon && ["simpleR", "martialR"].includes(t)) || ["ranged", "thrown", "wands"].includes(w);
  const wandRod = item.type === "equipment" && ["wand", "rod"].includes(t);
  const versatile = weapon && p.has("ver");
  return {
    id: item.id ?? item._id ?? null, name: item.name ?? "", equipped: !!sys.equipped, equippable: "equipped" in sys,
    weapon, shield, buckler: isBuckler(item), rangedType, wandRod,
    thrown: weapon && p.has("thr"),
    two: two ?? (w === "two-hand" || (weapon && p.has("two"))),
    versatile, versatileFormula: versatile ? String(versatileFormula ?? "") : "",
    ammo: weapon && p.has("amm"),
    held: isFocus(item) || item.type === "tool" || wandRod || w === "held in off-hand" || (!weapon && !shield && !ARMOR.has(t) && HELD_RE.test(item.name ?? "")),
    mainOnly: w === "main hand" || w === "two-hand",
    offOnly: w === "off hand" || w === "held in off-hand",
    armor: item.type === "equipment" && ARMOR.has(t)
  };
}

/** Whether a described item may go in a set's hand (ignoring what's in the other hand). */
export function fitsHand(d, set, hand) {
  if (!d?.equippable || d.armor || !SETS[set]) return false;
  if (!(d.weapon || d.shield || d.held || d.wandRod || d.offOnly || d.rangedType)) return false;
  if (hand === "main") {
    if (d.offOnly || d.shield) return false;
    if (set === "melee") return d.weapon && !d.rangedType;
    if (set === "ranged") return d.rangedType || d.thrown || d.wandRod;
    return d.weapon || d.held || d.wandRod;
  }
  if (hand === "off") {
    if (d.two || d.mainOnly) return false;
    return d.shield || d.weapon || d.held || d.wandRod || d.offOnly;
  }
  return false;
}

// ---------------------------------------------------------------- stored state
export const emptyState = () => ({ v: 1, active: "melee", sets: { melee: { main: null, off: null }, ranged: { main: null, off: null }, utility: { main: null, off: null } } });

/**
 * Builds the first weapon-set state from the pane's older single slots ({ mainhand, offhand, ranged }: item ids of equipped items in
 * those slots): main and off hand become the Melee set, the ranged slot the Ranged set, and Melee is active.
 */
export function migrate(legacy = {}) {
  const s = emptyState();
  s.sets.melee.main = legacy.mainhand ?? null;
  s.sets.melee.off = legacy.offhand ?? null;
  s.sets.ranged.main = legacy.ranged ?? null;
  return normalize(s);
}

/**
 * A clean copy of a stored state: unknown sets and hands dropped, ids of items no longer on the actor dropped (`have`: a Set of item
 * ids, or null to skip that), an item kept only in its first place (sets in order, main before off), and a valid active set.
 */
export function normalize(raw, have = null) {
  const s = emptyState(); if (!raw || typeof raw !== "object") return s;
  const seen = new Set();
  for (const set of SET_IDS) for (const hand of ["main", "off"]) {
    const id = raw.sets?.[set]?.[hand];
    if (typeof id !== "string" || !id || seen.has(id) || (have && !have.has(id))) continue;
    seen.add(id); s.sets[set][hand] = id;
  }
  s.active = SETS[raw.active] ? raw.active : "melee";
  return s;
}

/** Where an item id sits: { set, hand } or null. */
export function locate(state, id) {
  for (const set of SET_IDS) for (const hand of ["main", "off"]) if (id && state.sets[set][hand] === id) return { set, hand };
  return null;
}
/** Every item id in the sets. */
export const assignedIds = state => SET_IDS.flatMap(set => [state.sets[set].main, state.sets[set].off]).filter(Boolean);

// ---------------------------------------------------------------- the hands rule
/**
 * Checks a set with what it would be used with. `main` / `off`: the set's described items (or null); `worn`: equipped shields that
 * aren't in this set (they stay on through a swap); `hasAmmo`: whether the actor carries ammunition.
 * Returns { ok, block: { code, message, shieldId } | null, warnings: [text], info: [text] }. Codes: "shield" (an equipped shield is in
 * the way; taking it off fixes it), "shieldInSet" (this set pairs a two-handed weapon with its own shield), "hands" (both hands needed).
 */
export function checkHands(set, { main = null, off = null, worn = [], hasAmmo = true } = {}) {
  const warnings = []; const info = [];
  const result = block => ({ ok: !block, block, warnings, info });
  const wornRegular = worn.filter(s => s && !s.buckler);
  const wornAny = worn.filter(Boolean);
  if (main?.two) {
    if (off?.shield) return result({ code: "shieldInSet", message: `${main.name} needs both hands, and this set's off hand holds ${off.name}. Take the shield out of this set first.`, shieldId: off.id });
    if (off) return result({ code: "hands", message: `${main.name} needs both hands, so the off hand must be empty (it holds ${off.name}).`, shieldId: null });
    if (wornAny.length) return result({ code: "shield", message: `${main.name} needs both hands, and ${wornAny[0].name} is on the other arm. Stow the shield first.`, shieldId: wornAny[0].id });
  }
  if (wornRegular.length && off && off.id !== wornRegular[0].id) {
    return result({ code: "shield", message: `${wornRegular[0].name} is on the off hand, so it can't also hold ${off.name}. Stow the shield first.`, shieldId: wornRegular[0].id });
  }
  const shieldHand = wornRegular[0] ?? (off?.shield && !off.buckler ? off : null);
  // A ranged weapon that fires ammunition needs a hand free to load: a shield (not a buckler) takes it. Thrown weapons and wands don't.
  if (main?.ammo && shieldHand) {
    return result({ code: shieldHand === off ? "shieldInSet" : "shield", message: `${main.name} needs a free hand to load, and ${shieldHand.name} is on that arm. ${shieldHand === off ? "Take the shield out of this set" : "Stow the shield"} first (a buckler leaves the hand free).`, shieldId: shieldHand.id });
  }
  if (set === "ranged" && main?.ammo && !hasAmmo) warnings.push(`${main.name} uses ammunition, and none is carried.`);
  if (main?.versatile && !off && !wornAny.length) info.push(`${main.name} is held in both hands${main.versatileFormula ? `: ${main.versatileFormula} damage` : " (versatile damage)"}.`);
  return result(null);
}

/**
 * What making `target` the active set does. `items`: id → described item for every item in the sets; `equippedShields`: described
 * shields equipped on the actor right now (in a set or not). Returns { ok, block, warnings, info, equip: [ids], unequip: [ids],
 * donShield: true when the swap puts a shield on }. Equipped shields outside the target set stay equipped (they're worn).
 */
export function planSwap(state, target, { items = {}, equippedShields = [], hasAmmo = true } = {}) {
  const get = id => (id ? items[id] ?? null : null);
  const set = state.sets[target] ?? { main: null, off: null };
  const main = get(set.main); const off = get(set.off);
  const inTarget = new Set([set.main, set.off].filter(Boolean));
  const worn = equippedShields.filter(s => s && !inTarget.has(s.id));
  const check = checkHands(target, { main, off, worn, hasAmmo });
  const equip = [main, off].filter(d => d && !d.equipped).map(d => d.id);
  const unequip = [];
  for (const other of SET_IDS) if (other !== target) for (const hand of ["main", "off"]) {
    const d = get(state.sets[other][hand]);
    if (d && d.equipped && !d.shield && !inTarget.has(d.id)) unequip.push(d.id);
  }
  return { ...check, equip, unequip, donShield: !!(off?.shield && !off.equipped) };
}

// ---------------------------------------------------------------- swap cost
export const SWAP_COSTS = {
  free: "Free",
  attack: "Part of an attack",
  object: "Object interaction",
  bonus: "Bonus action",
  action: "Action"
};
/** The cost in chat wording: "part of an attack", "an object interaction", "a bonus action", "an action", "free". */
export function swapCostText(cost) {
  return { free: "free", attack: "part of an attack", object: "an object interaction", bonus: "a bonus action", action: "an action" }[cost] ?? "part of an attack";
}
/** The public chat line for a swap in combat. */
export function swapLine(name, set, cost, { donShield = false } = {}) {
  const extra = donShield ? "; putting on a shield takes the Utilize action" : "";
  return `${name} swaps to ${SETS[set]?.label ?? set} (${swapCostText(cost)}${extra}).`;
}
/** The public chat line for taking off a shield in combat. */
export const stowShieldLine = (name, shield) => `${name} takes off ${shield} (taking off a shield takes the Utilize action).`;

// ---------------------------------------------------------------- relic slot
/** Default classes with a relic slot (dnd5e class identifiers). */
export const RELIC_DEFAULT = "paladin, druid, cleric";
/** The stored setting ("paladin, druid") → identifiers, lower case. */
export const relicClassList = s => [...new Set(String(s ?? "").toLowerCase().split(/[,\s]+/).filter(Boolean))];
/** Identifiers → the stored setting. */
export const relicClassValue = ids => [...new Set((ids ?? []).map(i => String(i).toLowerCase()).filter(Boolean))].join(", ");
/** Whether a character with these class identifiers gets the relic slot. */
export const hasRelicSlot = (classIds, setting) => { const want = new Set(relicClassList(setting)); return [...(classIds ?? [])].some(c => want.has(String(c).toLowerCase())); };
/** The core classes, for the picker when the world has no class items of its own. */
export const CORE_CLASSES = ["artificer", "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
