/**
 * Character pane: a classic-MMO-style equipment frame (paper doll) for dnd5e actors.
 * Slot an item and it's equipped on the sheet; take it out and it's unequipped. The slot lives in flags.wayfarers-toolkit.slot.
 * Items that carry an MMO-style item tooltip in their description (like those in the optional wow-classic-items module) are placed by their "Slot" line.
 */
import * as WS from "./weapon-sets.mjs";
import * as C from "./compare.mjs";
import { on as featureOn } from "./features.mjs";
export { WS as weaponSetRules };
const ID = "wayfarers-toolkit";
const WOW = "wow-classic-items";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------- slots
/** Classic-MMO paper-doll slots (no Ammo slot). Two finger and two trinket slots share a group. */
export const SLOTS = {
  head: { label: "Head", icon: "fa-helmet-battle" },
  neck: { label: "Neck", icon: "fa-gem" },
  shoulder: { label: "Shoulder", icon: "fa-shield-halved" },
  back: { label: "Back", icon: "fa-scarf" },
  chest: { label: "Chest", icon: "fa-vest" },
  shirt: { label: "Shirt", icon: "fa-shirt" },
  tabard: { label: "Tabard", icon: "fa-flag-swallowtail" },
  wrist: { label: "Wrist", icon: "fa-watch" },
  hands: { label: "Hands", icon: "fa-hand-back-fist" },
  waist: { label: "Waist", icon: "fa-grip-lines" },
  legs: { label: "Legs", icon: "fa-pants" },
  feet: { label: "Feet", icon: "fa-boot" },
  finger1: { label: "Finger", icon: "fa-ring" },
  finger2: { label: "Finger", icon: "fa-ring" },
  trinket1: { label: "Trinket", icon: "fa-hourglass" },
  trinket2: { label: "Trinket", icon: "fa-hourglass" },
  mainhand: { label: "Main Hand", icon: "fa-sword" },
  offhand: { label: "Off Hand", icon: "fa-shield" },
  ranged: { label: "Ranged", icon: "fa-bow-arrow" },
  // Weapon sets only: a worn slot (no hand) for a spellcasting focus or a relic, shown for the classes set in "Classes with a relic slot".
  relic: { label: "Relic", icon: "fa-sun" }
};
const LEFT = ["head", "neck", "shoulder", "back", "chest", "shirt", "tabard", "wrist"];
const RIGHT = ["hands", "waist", "legs", "feet", "finger1", "finger2", "trinket1", "trinket2"];
const BOTTOM = ["mainhand", "offhand", "ranged"];
const WEAPON_SLOTS = new Set(BOTTOM);
const GEAR_SLOTS = Object.keys(SLOTS).filter(s => !WEAPON_SLOTS.has(s) && s !== "relic");
const group = s => s.replace(/\d$/, "");
/** Slot groups → concrete slots, in order: ["finger"] → ["finger1", "finger2"]. */
const expand = groups => [...new Set(groups.flatMap(g => Object.keys(SLOTS).filter(s => group(s) === g || s === g)))];

/** The "Slot" line of an MMO-style tooltip (or a wow-classic-items compendium folder name) → slot groups. */
const WOW_SLOTS = {
  "head": ["head"], "neck": ["neck"], "shoulder": ["shoulder"], "back": ["back"], "chest": ["chest"], "robe": ["chest"],
  "shirt": ["shirt"], "tabard": ["tabard"], "wrist": ["wrist"], "hands": ["hands"], "waist": ["waist"], "legs": ["legs"],
  "feet": ["feet"], "finger": ["finger"], "trinket": ["trinket"],
  "main hand": ["mainhand"], "one-hand": ["mainhand", "offhand"], "two-hand": ["mainhand"],
  "off hand": ["offhand"], "held in off-hand": ["offhand"],
  "ranged": ["ranged"], "thrown": ["ranged"], "relic": ["ranged"], "wands": ["ranged"]
};
const WOW_LINE = new RegExp(`^(${Object.keys(WOW_SLOTS).join("|")})$`, "i");

/** Name words that suggest where an item without a tooltip slot is worn. Only used to pick a default slot. */
const NAME_HINTS = [
  ["finger", /\b(ring|signet|band of)\b/i],
  ["head", /\b(helm|helmet|hat|hood|cap|circlet|crown|coif|mask|headband|cowl|diadem|tiara|goggles|headdress)\b/i],
  ["neck", /\b(amulet|necklace|pendant|periapt|medallion|choker|torc|locket|scarab)\b/i],
  ["shoulder", /\b(pauldrons?|shoulders?|spaulders?|shoulderpads?|epaulets?|mantle)\b/i],
  ["back", /\b(cloak|cape|shawl|wings)\b/i],
  ["shirt", /\bshirt\b/i],
  ["tabard", /\btabard\b/i],
  ["wrist", /\b(bracers?|bracelets?|wristguards?|wristbands?|bindings|armbands?|vambraces?)\b/i],
  ["hands", /\b(gloves?|gauntlets?|handwraps|mitts|grips)\b/i],
  ["waist", /\b(belt|girdle|sash|cord|cinch|waistband)\b/i],
  ["legs", /\b(leggings|pants|trousers|greaves|legplates|legguards|kilt|breeches)\b/i],
  ["feet", /\b(boots|slippers|shoes|sandals|treads|footwraps|sabatons|stompers)\b/i],
  ["chest", /\b(robe|vest|tunic|breastplate|chestguard|chestpiece|jerkin|hauberk|cuirass|armor|armour|raiment|harness)\b/i],
  ["trinket", /\b(trinket|figurine|idol|charm|talisman|stone|orb|totem|token|horn|bead|feather)\b/i]
];

/** Item quality colours (grey, white, green, blue, purple, orange). dnd5e rarities map onto them. */
const QUALITY = { poor: "#9d9d9d", common: "#ffffff", uncommon: "#1eff00", rare: "#0070dd", veryRare: "#a335ee", legendary: "#ff8000", artifact: "#e6cc80" };

// ---------------------------------------------------------------- reading items
const tipCache = new Map();
/** Reads an MMO-style tooltip from an item's description: { slot, color }. Empty when there's none. */
function readTooltip(desc) {
  desc = String(desc ?? ""); if (!desc.includes("font-size:1.08em")) return {};
  if (tipCache.has(desc)) return tipCache.get(desc);
  const out = {};
  try {
    const doc = new DOMParser().parseFromString(desc, "text/html");
    const name = [...doc.querySelectorAll("div")].find(d => /font-size:\s*1\.08em/.test(d.getAttribute("style") || ""));
    if (name) {
      out.color = (name.getAttribute("style").match(/color:\s*(#[0-9a-f]{3,6})/i) || [])[1]?.toLowerCase();
      for (const line of [...name.parentElement.children].slice(1, 8)) {
        const t = (line.querySelector("span")?.textContent ?? line.textContent).trim();
        if (WOW_LINE.test(t)) { out.slot = t.toLowerCase(); break; }
      }
    }
  } catch (e) { /* not a tooltip */ }
  if (tipCache.size > 2000) tipCache.clear();
  tipCache.set(desc, out);
  return out;
}

/** Tooltip slot of an item copied from the wow-classic-items compendium, read from the folder it came from. */
function wowFolderSlot(item) {
  const src = item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? "";
  const m = String(src).match(/^Compendium\.([^.]+\.[^.]+)\.Item\.([^.]+)$/); if (!m || !m[1].startsWith(`${WOW}.`)) return null;
  const pack = game.packs.get(m[1]); const e = pack?.index.get(m[2]); const f = e?.folder ? pack.folders.get(e.folder?.id ?? e.folder) : null;
  if (!f) return null;
  const n = f.name.toLowerCase();
  if (n === "clothing") return /tabard/i.test(item.name) ? "tabard" : "shirt";
  return WOW_SLOTS[n] ? n : null;
}

/** Tooltip slot ("head", "two-hand", …) and quality colour of an item, if its data has them. */
export function wowInfo(item) {
  const tip = readTooltip(item.system?.description?.value);
  return { slot: tip.slot ?? wowFolderSlot(item), color: tip.color ?? null };
}

/** Border colour for an item: the tooltip's quality colour, else its dnd5e rarity. */
export function qualityColor(item) {
  return wowInfo(item).color ?? QUALITY[item.system?.rarity] ?? QUALITY.common;
}

const hint = item => NAME_HINTS.find(([, re]) => re.test(item.name))?.[0] ?? null;
const props = item => { const p = item.system?.properties; return p instanceof Set ? p : new Set(p ?? []); };
const ARMOR = ["light", "medium", "heavy", "natural"];
const isBodyArmor = item => item.type === "equipment" && ARMOR.includes(item.system?.type?.value);
const isShield = item => item.type === "equipment" && item.system?.type?.value === "shield";

/**
 * Where an item can go. { slots: concrete slots in order of preference, strict: false when the user may pick any gear slot,
 * two: true for a two-handed weapon in the main hand, ask: true when there's no clear default }.
 * Returns null for items that can't be equipped.
 */
export function fits(item) {
  if (!item || !("equipped" in (item.system ?? {}))) return null;
  const w = wowInfo(item).slot;
  if (w) return { slots: expand(WOW_SLOTS[w]), strict: true, two: w === "two-hand", wow: w };
  const t = item.system.type?.value ?? "";
  if (item.type === "weapon") {
    const p = props(item);
    if (["simpleR", "martialR"].includes(t)) return { slots: ["ranged"], strict: true, two: false };
    if (p.has("two")) return { slots: ["mainhand"], strict: true, two: true };
    return { slots: p.has("thr") ? ["mainhand", "offhand", "ranged"] : ["mainhand", "offhand"], strict: true, two: false };
  }
  if (item.type !== "equipment") return null;
  if (t === "shield") return { slots: ["offhand"], strict: true, two: false };
  if (ARMOR.includes(t)) return { slots: ["chest"], strict: true, two: false };
  if (t === "ring") return { slots: expand(["finger"]), strict: true, two: false };
  if (["wand", "rod"].includes(t)) return { slots: ["ranged", "offhand"], strict: true, two: false };
  const h = hint(item);
  if (t === "clothing") return { slots: expand([...(h ? [h] : []), "chest", "shirt", "tabard"]), prefer: h ? expand([h]) : ["chest", "shirt", "tabard"], strict: false, two: false };
  if (t === "trinket") return { slots: expand(["trinket", ...GEAR_SLOTS]), prefer: expand(["trinket"]), strict: false, two: false };
  return { slots: expand([...(h ? [h] : []), ...GEAR_SLOTS]), prefer: h ? expand([h]) : null, strict: false, two: false, ask: !h };
}
/** True when the item may go in this slot. */
export const canSlot = (item, slot) => {
  if (slot === "relic") return WS.isRelicItem(item) || (wowInfo(item).slot === "relic" && item?.flags?.[ID]?.relic !== false && !!item?.system && "equipped" in item.system);
  const f = fits(item); return !!f && (f.slots.includes(slot) || (!f.strict && GEAR_SLOTS.includes(slot)));
};

/** The actor's slotted items: { slot: item }. An item counts only while it's equipped; the first item claiming a slot wins. */
export function slotted(actor) {
  const out = {}; const relic = relicShown(actor);
  for (const i of actor.items) {
    const s = i.getFlag(ID, "slot");
    if (s === "relic" && !relic) continue;
    if (s && SLOTS[s] && i.system?.equipped && !out[s] && canSlot(i, s)) out[s] = i;
  }
  return out;
}
/** The gear slots only (weapon sets on: the weapon slots are shown by set instead). */
const gearSlotted = actor => Object.fromEntries(Object.entries(slotted(actor)).filter(([k]) => !WEAPON_SLOTS.has(k)));
const isTwo = (item, slot = "mainhand") => slot === "mainhand" && !!fits(item)?.two;

// ---------------------------------------------------------------- slotting
const flagPath = `flags.${ID}.slot`;

/** Armour that counts for AC: anything equipped except armour-typed pieces in a slot other than Chest (a helm, boots...). */
const isSuit = (item, slot = item.getFlag(ID, "slot")) => isBodyArmor(item) && (!slot || slot === "chest");

/** Warnings (never blocks): attunement over the limit, a second suit of armour, a second shield. */
function warnings(actor, item, replaced, slot) {
  const out = [];
  const att = actor.system.attributes?.attunement;
  if (item.system.attunement === "required" && !item.system.attuned && att && att.value >= att.max)
    out.push(`${item.name} needs attunement, and ${actor.name} is already attuned to ${att.value} of ${att.max} items.`);
  const others = actor.items.filter(i => i !== item && i !== replaced && i.system?.equipped);
  if (isSuit(item, slot)) {
    const a = others.filter(i => isSuit(i));
    if (a.length) out.push(`${actor.name} is also wearing ${a.map(i => i.name).join(", ")}. dnd5e counts only one piece of armour for AC.`);
  }
  if (isShield(item)) {
    const s = others.filter(isShield);
    if (s.length) out.push(`${actor.name} already has a shield equipped (${s.map(i => i.name).join(", ")}).`);
  }
  return out;
}

/** Puts an owned item in a slot and equips it. Whatever was in the slot comes out (and is unequipped). */
export async function slotItem(actor, item, slot) {
  if (!actor?.isOwner) return ui.notifications.warn("You don't own this character.");
  if (item?.parent !== actor) return ui.notifications.warn("That item isn't on this character.");
  if (!SLOTS[slot]) return;
  if (setsOn() && WEAPON_SLOTS.has(slot)) {
    // With weapon sets, the old weapon slots mean the active set's hands (Ranged: the Ranged set's main hand).
    const active = weaponState(actor).active;
    const set = slot === "ranged" ? "ranged" : slot === "mainhand" && active === "ranged" ? "melee" : active;
    return assignWeapon(actor, item, set, slot === "offhand" ? "off" : "main");
  }
  if (!canSlot(item, slot)) return ui.notifications.warn(`${item.name} doesn't go in the ${SLOTS[slot].label} slot.`);
  if (slot === "relic" && setsOn()) {
    // The relic slot is never part of a weapon set: a focus held in a set's hand moves out of it.
    const st = weaponState(actor); const at = WS.locate(st, item.id);
    if (at) { st.sets[at.set][at.hand] = null; await actor.update({ [SETS_FLAG]: st }); }
  }
  const cur = slotted(actor);
  if (slot === "offhand" && cur.mainhand && cur.mainhand !== item && isTwo(cur.mainhand)) return ui.notifications.warn(`${cur.mainhand.name} is two-handed: the off hand is taken.`);
  const replaced = cur[slot] && cur[slot] !== item ? cur[slot] : null;
  const updates = [];
  if (replaced) updates.push({ _id: replaced.id, "system.equipped": false, [flagPath]: null });
  if (slot === "mainhand" && isTwo(item) && cur.offhand && cur.offhand !== item) {
    updates.push({ _id: cur.offhand.id, "system.equipped": false, [flagPath]: null });
    ui.notifications.info(`${item.name} is two-handed, so ${cur.offhand.name} comes out of the off hand.`);
  }
  for (const w of warnings(actor, item, replaced, slot)) ui.notifications.warn(w);
  updates.push({ _id: item.id, "system.equipped": true, [flagPath]: slot });
  await actor.updateEmbeddedDocuments("Item", updates);
  return slot;
}

/** Takes an item out of its slot and unequips it. */
export async function unslotItem(item) {
  if (!item?.isOwner) return;
  if (setsOn() && item.parent && WS.locate(weaponState(item.parent), item.id)) return unassignWeapon(item);
  await item.update({ "system.equipped": false, [flagPath]: null });
}

/** The best slot for an item: a free one it fits, else the first it fits (replacing what's there). Null when the user should choose.
 * `cur` is the slot map to plan against (defaults to the actor's current slots). */
export function autoSlot(actor, item, cur = slotted(actor)) {
  if (relicShown(actor) && canSlot(item, "relic") && (!cur.relic || cur.relic === item)) return "relic";
  const f = fits(item); if (!f || f.ask) return null;
  const blocked = s => s === "offhand" && cur.mainhand && cur.mainhand !== item && isTwo(cur.mainhand);
  const ok = (f.prefer ?? f.slots).filter(s => !blocked(s));
  const mine = Object.keys(cur).find(s => cur[s] === item && f.slots.includes(s)); if (mine) return mine;
  return ok.find(s => !cur[s]) ?? ok[0] ?? null;
}

/** Items that could be slotted but aren't. */
function unslottedItems(actor, cur) {
  const used = new Set(Object.values(cur));
  const sets = setsOn(); const relic = relicShown(actor);
  if (sets) for (const id of WS.assignedIds(weaponState(actor))) { const i = actor.items.get(id); if (i) used.add(i); }
  const listed = i => fits(i) || (sets && handItem(describeItem(i))) || (relic && canSlot(i, "relic"));
  return actor.items.filter(i => !used.has(i) && !i.system.container && listed(i)).sort((a, b) => (b.system.equipped - a.system.equipped) || a.name.localeCompare(b.name));
}

/** Copies an item dropped from a compendium, the sidebar or another actor onto this actor, the way the dnd5e sheet does. */
async function adopt(actor, item, event) {
  if (item.parent === actor) return item;
  if (!actor.isOwner) return null;
  const sheet = actor.sheet;
  try {
    if (typeof sheet?._onDropCreateItems === "function") {
      const created = await sheet._onDropCreateItems(event, [item], "copy");
      const doc = Array.isArray(created) ? created.find(d => d?.documentName === "Item") : null;
      if (doc) return doc;
    }
  } catch (e) { console.warn(`${ID} | dnd5e drop failed, copying the item directly`, e); }
  const o = item.toObject(); delete o._id; delete o.folder; delete o.sort;
  if (item.pack) foundry.utils.setProperty(o, "_stats.compendiumSource", item.uuid);
  o.system.equipped = false; foundry.utils.setProperty(o, flagPath, null);
  const [doc] = await actor.createEmbeddedDocuments("Item", [o]);
  return doc ?? null;
}

// ---------------------------------------------------------------- weapon sets
// The rules are in weapon-sets.mjs (tested in Node). Here: reading the actor, writing the sheet's equipped flags, and the chat line.
const SETS_FLAG = `flags.${ID}.weaponSets`;
const setting = (key, fallback) => { try { return game.settings.get(ID, key); } catch { return fallback; } };
/** Weapon sets are on (the "Weapon sets" setting under the character pane). Off: the pane's old Main Hand / Off Hand / Ranged slots. */
export const setsOn = () => !!setting("weaponSets", true);
/** dnd5e class identifiers of an actor. */
const classIds = actor => Object.entries(actor.classes ?? {}).map(([k, c]) => c?.system?.identifier ?? k);
/** Whether the pane shows the relic slot for this actor (weapon sets on and one of its classes is in "Classes with a relic slot"). */
export const relicShown = actor => setsOn() && WS.hasRelicSlot(classIds(actor), setting("relicClasses", WS.RELIC_DEFAULT));

/** Two-handed damage dnd5e would roll for a versatile weapon, for display ("1d10"), or "". */
function versatileFormula(item) {
  try {
    const d = item.system?.damage; const v = d?.versatile;
    if (v?.formula) return String(v.formula);
    if (v?.number && v?.denomination) return `${v.number}d${v.denomination}`;
    const b = d?.base; const steps = [4, 6, 8, 10, 12];
    if (b?.number && b?.denomination) { const i = steps.indexOf(Number(b.denomination)); return `${b.number}d${i >= 0 && i < steps.length - 1 ? steps[i + 1] : b.denomination}`; }
  } catch { /* unknown data shape */ }
  return "";
}
/** An item described for the hands rules. */
export const describeItem = item => item ? WS.describe(item, { tip: wowInfo(item).slot, two: isTwo(item) || null, versatileFormula: versatileFormula(item) }) : null;
/** True when an item can go in any hand of any set. */
const handItem = d => !!d && WS.SET_IDS.some(set => WS.fitsHand(d, set, "main") || WS.fitsHand(d, set, "off"));
/**
 * Whether clicking an item (or Slot equipped items) should put it in a hand rather than a gear slot: weapons, shields, wands, rods,
 * tools, spellcasting foci, light sources, and held things with no gear slot. A trinket or wondrous item that only sounds held (an orb,
 * a horn) keeps its gear slot; it can still be dropped on a hand.
 */
function prefersHand(item) {
  const d = describeItem(item); if (!handItem(d)) return false;
  const f = fits(item);
  return !f || !!f.ask || f.slots.some(s => WEAPON_SLOTS.has(s)) || item.type === "tool" || WS.isFocus(item) || /\b(torch|lantern|lamp|candle)\b/i.test(item.name);
}
const hasAmmo = actor => actor.items.some(i => i.type === "consumable" && i.system?.type?.value === "ammo" && (i.system?.quantity ?? 1) > 0);
const equippedShields = actor => actor.items.filter(i => isShield(i) && i.system?.equipped).map(describeItem);
const describedSetItems = (actor, state) => Object.fromEntries(WS.assignedIds(state).map(id => [id, describeItem(actor.items.get(id))]).filter(([, d]) => d));

/** The actor's weapon sets. Without the flag yet (an actor from before weapon sets), worked out from its old weapon slots. */
export function weaponState(actor) {
  const have = new Set(actor.items.map(i => i.id));
  const raw = actor.getFlag(ID, "weaponSets");
  if (raw) return WS.normalize(raw, have);
  const cur = slotted(actor);
  return WS.normalize(WS.migrate({ mainhand: cur.mainhand?.id, offhand: cur.offhand?.id, ranged: cur.ranged?.id }), have);
}

/**
 * Writes a weapon-set state: the actor flag, and each set item's equipped flag (the active set's items equipped when its hands check
 * passes, every other set item unequipped; equipped shields are worn and stay on). Item slot flags mirror the active set into the old
 * Main Hand / Off Hand / Ranged slots, so turning weapon sets off later shows the active set. `extra`: more item updates.
 */
async function writeSets(actor, state, { extra = [], equipActive = true } = {}) {
  const items = describedSetItems(actor, state);
  const plan = WS.planSwap(state, state.active, { items, equippedShields: equippedShields(actor), hasAmmo: hasAmmo(actor) });
  const updates = new Map(extra.map(u => [u._id, { ...u }]));
  const up = (id, data) => updates.set(id, { ...(updates.get(id) ?? { _id: id }), ...data });
  for (const set of WS.SET_IDS) for (const hand of ["main", "off"]) {
    const id = state.sets[set][hand]; if (!id) continue;
    const active = set === state.active;
    up(id, { [flagPath]: active ? WS.LEGACY_SLOT[set][hand] : null });
  }
  if (equipActive && plan.ok) for (const id of plan.equip) up(id, { "system.equipped": true });
  // A set that can't be used as it stands (a two-handed weapon with a shield still on) isn't held: its weapons come off until it can be.
  if (!plan.ok) for (const hand of ["main", "off"]) { const id = state.sets[state.active][hand]; const it = id && actor.items.get(id); if (it && !isShield(it) && it.system.equipped) up(id, { "system.equipped": false }); }
  for (const id of plan.unequip) up(id, { "system.equipped": false, [flagPath]: null });
  await actor.update({ [SETS_FLAG]: state });
  const list = [...updates.values()].filter(u => actor.items.has(u._id));
  if (list.length) await actor.updateEmbeddedDocuments("Item", list, { wctSets: true });
  return plan;
}

/** First open with weapon sets on: stores the sets worked out from the old slots and equips only the active set. Owner only. */
export async function ensureSets(actor) {
  if (!setsOn() || !actor?.isOwner || actor.getFlag(ID, "weaponSets")) return;
  await writeSets(actor, weaponState(actor));
}

/** Whether the actor is a combatant in a combat that has started. */
const inCombat = actor => (game.combats ?? []).some(c => c.started && c.combatants.some(cb => cb.actor === actor || (cb.actorId === actor.id && !actor.isToken)));
async function postLine(actor, text) {
  try { await ChatMessage.create({ content: `<p class="wct-swap">${esc(text)}</p>`, speaker: ChatMessage.getSpeaker({ actor }) }); } catch (e) { console.warn(`${ID} | weapon swap chat line`, e); }
}

/** Puts an owned item in a set's hand (main or off). Whatever was there comes out; a two-handed weapon empties the off hand. */
export async function assignWeapon(actor, item, set, hand) {
  if (!actor?.isOwner) return ui.notifications.warn("You don't own this character.");
  if (item?.parent !== actor) return ui.notifications.warn("That item isn't on this character.");
  if (!WS.SETS[set] || !WS.HANDS[hand]) return;
  const d = describeItem(item); const where = `${WS.SETS[set].label} set, ${WS.handLabel(set, hand).toLowerCase()}`;
  if (!WS.fitsHand(d, set, hand)) return ui.notifications.warn(`${item.name} doesn't go in the ${where}.`);
  const state = weaponState(actor); const s = state.sets[set];
  const mainD = describeItem(actor.items.get(s.main));
  if (hand === "off" && mainD?.two && s.main !== item.id) return ui.notifications.warn(`${mainD.name} is two-handed: the off hand of the ${WS.SETS[set].label} set is taken.`);
  const extra = [];
  const out = id => { if (id && id !== item.id) extra.push({ _id: id, "system.equipped": false, [flagPath]: null }); };
  const from = WS.locate(state, item.id); if (from) state.sets[from.set][from.hand] = null;
  out(s[hand]); s[hand] = item.id;
  if (hand === "main" && d.two && s.off && s.off !== item.id) { ui.notifications.info(`${item.name} is two-handed, so ${actor.items.get(s.off)?.name ?? "the off-hand item"} comes out of the off hand.`); out(s.off); s.off = null; }
  if (set !== state.active) extra.push({ _id: item.id, "system.equipped": false });
  for (const w of warnings(actor, item, null, null)) if (set === state.active) ui.notifications.warn(w);
  const plan = await writeSets(actor, state, { extra });
  if (set === state.active && !plan.ok) ui.notifications.warn(`${plan.block.message} Until then the ${WS.SETS[set].label} set isn't equipped.`);
  return { set, hand };
}

/** Takes an item out of its weapon set and unequips it. */
export async function unassignWeapon(item) {
  const actor = item?.parent; if (!actor?.isOwner) return;
  const state = weaponState(actor); const at = WS.locate(state, item.id); if (!at) return unslotItem(item);
  state.sets[at.set][at.hand] = null;
  await writeSets(actor, state, { extra: [{ _id: item.id, "system.equipped": false, [flagPath]: null }] });
}

/**
 * Makes a set the active one: equips its items and unequips the other sets' (worn shields stay on). Blocked, with the reason, when the
 * hands don't allow it (a two-handed weapon with a shield on). In combat, posts a public line with the GM's swap cost.
 * Returns the plan ({ ok, block, warnings, info }).
 */
export async function activateSet(actor, set) {
  if (!actor?.isOwner || !WS.SETS[set]) return null;
  const state = weaponState(actor);
  const plan = WS.planSwap(state, set, { items: describedSetItems(actor, state), equippedShields: equippedShields(actor), hasAmmo: hasAmmo(actor) });
  if (!plan.ok) { ui.notifications.warn(plan.block.message); return plan; }
  if (set === state.active && !plan.equip.length) return plan;
  const was = state.active; state.active = set;
  for (const w of plan.warnings) ui.notifications.warn(w);
  await writeSets(actor, state);
  if (was !== set && inCombat(actor)) await postLine(actor, WS.swapLine(actor.name, set, setting("weaponSwapCost", "attack"), { donShield: plan.donShield }));
  return plan;
}

/** Takes off (unequips) a shield, a separate step from swapping. It stays in its set. In combat, posts a public line. */
export async function stowShield(actor, shieldId) {
  const sh = actor?.items.get(shieldId); if (!actor?.isOwner || !sh || !isShield(sh)) return;
  await actor.updateEmbeddedDocuments("Item", [{ _id: sh.id, "system.equipped": false }], { wctSets: true });
  if (inCombat(actor)) await postLine(actor, WS.stowShieldLine(actor.name, sh.name));
  // The active set may have been waiting on that hand: equip it now.
  const state = weaponState(actor);
  if (WS.locate(state, sh.id)?.set !== state.active) await writeSets(actor, state);
}

/** The best hand for an item with weapon sets on: a free hand it fits in the active set, else in any set, else null. */
function autoHand(actor, item) {
  const d = describeItem(item); if (!handItem(d)) return null;
  const state = weaponState(actor); const at = WS.locate(state, item.id); if (at) return at;
  const order = [state.active, ...WS.SET_IDS.filter(x => x !== state.active)];
  // Held things (a torch, a lantern, an instrument) prefer the Utility set; ranged weapons the Ranged set.
  if (d.held && !d.weapon) order.sort((a, b) => (b === "utility") - (a === "utility"));
  if (d.rangedType) order.sort((a, b) => (b === "ranged") - (a === "ranged"));
  const twoBlocked = (set, hand) => hand === "off" && describeItem(actor.items.get(state.sets[set].main))?.two;
  const hands = d.shield || d.offOnly || (d.held && !d.weapon) ? ["off"] : ["main", "off"];
  for (const set of order) for (const hand of hands) if (WS.fitsHand(d, set, hand) && !state.sets[set][hand] && !twoBlocked(set, hand)) return { set, hand };
  for (const set of order) for (const hand of hands) if (WS.fitsHand(d, set, hand) && !twoBlocked(set, hand)) return { set, hand };
  return null;
}

// ---------------------------------------------------------------- item comparison
/** Item comparison tooltips are on (the "Item comparison tooltips" setting under the character pane). */
export const compareOn = () => !!setting("itemCompare", true);
const labelOf = (cfg, k) => { const c = cfg?.[k]; return game.i18n?.localize?.(c?.label ?? c ?? k) ?? k; };
const smallestOf = (value, denom) => {
  const api = game.modules.get(ID)?.api; const rate = api?.coins ? Object.fromEntries(api.coins())[denom || "gp"] : null;
  return rate ? Math.round((Number(value) || 0) * rate) : null;
};
/** A plain summary of an item for compare.mjs. */
export function summarize(item) {
  if (!item) return null;
  const sys = item.system ?? {}; const t = sys.type?.value ?? "";
  const kind = item.type === "weapon" ? "weapon" : isShield(item) ? "shield" : isBodyArmor(item) ? "armor" : "gear";
  const damage = [];
  if (item.type === "weapon") {
    const b = sys.damage?.base;
    let f = ""; try { f = b?.formula ?? ""; } catch { f = ""; }
    if (!f && b?.number && b?.denomination) f = `${b.number}d${b.denomination}${b.bonus ? ` + ${b.bonus}` : ""}`;
    const types = [...(b?.types ?? [])].map(k => labelOf(CONFIG.DND5E?.damageTypes, k));
    if (f) damage.push({ formula: f, types });
  }
  const ac = kind === "armor" || kind === "shield" ? (Number(sys.armor?.value) || 0) + (Number(sys.armor?.magicalBonus) || 0) : null;
  const magic = Number(sys.magicalBonus ?? sys.armor?.magicalBonus) || 0;
  const attack = item.type === "weapon" ? (Number(String(sys.attack?.bonus ?? "").replace(/\s+/g, "")) || 0) : 0;
  const propList = [...props(item)].filter(k => k !== "mgc").map(k => labelOf(CONFIG.DND5E?.itemProperties, k)).sort();
  const w = sys.weight; const weight = typeof w === "object" ? Number(w?.value) : Number(w);
  return {
    name: item.name, kind, ac, damage, attack, magic: kind === "armor" || kind === "shield" ? 0 : magic, properties: propList,
    attune: sys.attunement === "required", value: smallestOf(sys.price?.value, sys.price?.denomination),
    weight: Number.isFinite(weight) ? weight : null, weightUnits: typeof w === "object" ? (w?.units ?? "lb") : "lb", type: t
  };
}

/**
 * What a hovered item (on `actor`, or from a pile or merchant) would be compared with: { current (Item or null), where (label),
 * note } or null when there's nothing to compare (it can't be equipped, or it's what's already there).
 */
export function comparisonTarget(actor, item) {
  if (!actor || !item || !("equipped" in (item.system ?? {}))) return null;
  if (setsOn() && prefersHand(item)) {
    const d = describeItem(item); const state = weaponState(actor);
    const at = WS.locate(state, item.id);
    if (at && item.parent === actor) return null;
    const h = C.compareHand(d, state.active); if (!h || !WS.fitsHand(d, h.set, h.hand)) return null;
    const cur = actor.items.get(state.sets[h.set][h.hand]) ?? null;
    if (cur === item) return null;
    const offId = state.sets[h.set].off; const off = offId && offId !== item.id ? describeItem(actor.items.get(offId)) : null;
    const inSet = new Set([state.sets[h.set].main, state.sets[h.set].off]);
    const worn = equippedShields(actor).filter(x => x && !inSet.has(x.id));
    return { current: cur, where: `${WS.SETS[h.set].label} set, ${WS.handLabel(h.set, h.hand).toLowerCase()}`, note: C.handNote(d, { off, worn, hand: h.hand }) };
  }
  if (item.parent === actor && item.system.equipped && item.getFlag(ID, "slot")) return null;
  const cur = slotted(actor); const f = fits(item); if (!f) return null;
  const slot = (relicShown(actor) && canSlot(item, "relic")) ? "relic" : (f.prefer ?? f.slots).find(s => cur[s]) ?? autoSlot(actor, item, cur) ?? f.slots[0];
  if (!slot || cur[slot] === item) return null;
  const note = slot === "mainhand" && isTwo(item) && cur.offhand ? `Needs both hands: ${cur.offhand.name} would come out of the off hand.` : "";
  return { current: cur[slot] ?? null, where: SLOTS[slot]?.label ?? slot, note };
}

const TONE = { better: "better", worse: "worse", different: "diff", same: "same" };
/** The comparison block for a tooltip (HTML), or "". */
export function comparisonHTML(actor, item) {
  if (!compareOn()) return "";
  let t; try { t = comparisonTarget(actor, item); } catch (e) { console.warn(`${ID} | item comparison`, e); return ""; }
  if (!t) return "";
  const api = game.modules.get(ID)?.api;
  const a = summarize(item); const b = summarize(t.current);
  const units = a?.weightUnits ?? "lb";
  const { rows } = C.diffItems(a, b, { fmtMoney: n => api?.fmtMoney ? api.fmtMoney(n) : `${n}`, fmtWeight: n => `${Math.round(n * 100) / 100} ${units}` });
  const shown = rows.filter(r => r.tone !== "same");
  const head = t.current ? `Compared with <span style="color:${qualityColor(t.current)}">${esc(t.current.name)}</span> <small>(${esc(t.where)})</small>` : `${esc(t.where)} is empty`;
  const body = shown.length ? `<table>${shown.map(r => `<tr class="${TONE[r.tone]}"><th>${esc(r.label)}</th><td>${esc(r.a)}</td><td class="was">${esc(r.b)}</td></tr>`).join("")}</table>` : `<p class="same">No differences.</p>`;
  return `<div class="wct-compare"><p class="head">${head}</p>${body}${t.note ? `<p class="note"><i class="fa-solid fa-hand"></i> ${esc(t.note)}</p>` : ""}</div>`;
}

/** Tooltip for an item row in an Item Piles pile or merchant: the item compared with what the user's character has on. */
async function pileRowTip(element, item) {
  if (!compareOn() || !(element instanceof HTMLElement) || !(item instanceof Item)) return;
  const actor = game.user.character ?? canvas?.tokens?.controlled?.[0]?.actor;
  if (!actor || !actor.isOwner || item.parent === actor) return;
  const cmp = comparisonHTML(actor, item); if (!cmp || !game.tooltip?.activate) return;
  const tip = document.createElement("div"); tip.className = "wct-tip-body";
  tip.innerHTML = `<h4 style="color:${qualityColor(item)}">${esc(item.name)}</h4><p class="type">For ${esc(actor.name)}</p>${cmp}`;
  game.tooltip.activate(element, { html: tip, cssClass: "wct-tip", direction: "RIGHT" });
}

// ---------------------------------------------------------------- the pane
const TextEditorImpl = () => foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
const OPEN = new Map();

// Window size. The paper doll needs MIN_W x MIN_H; slots grow from 42px up to 72px as the window gets bigger.
const MIN_W = 460, MIN_H = 690, DEF_W = 470, DEF_H = 720;
const SLOT_MIN = 42, SLOT_MAX = 72;
const SIZE_KEY = "paneWindow";

/** The size and position this client last left the pane at, if it still fits on screen and isn't below the minimum. */
function savedPosition() {
  let p = null;
  try { p = game.settings.get(ID, SIZE_KEY); } catch { return null; }
  if (!p || ![p.left, p.top, p.width, p.height].every(Number.isFinite)) return null;
  if (p.width < MIN_W || p.height < MIN_H) return null;
  if (p.left < 0 || p.top < 0 || p.left + p.width > window.innerWidth || p.top + p.height > window.innerHeight) return null;
  return { left: p.left, top: p.top, width: p.width, height: p.height };
}
function defaultPosition() {
  return { width: DEF_W, height: Math.max(MIN_H, Math.min(DEF_H, window.innerHeight - 40)) };
}

export class CharacterPane extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["wct-pane", "wct-window"],
    window: { title: "Character", icon: "fa-solid fa-shirt", resizable: true },
    position: { width: DEF_W, height: DEF_H }
  };

  constructor(actor, options = {}) {
    super({ id: `wct-pane-${actor.uuid.replace(/\./g, "-")}`, position: savedPosition() ?? defaultPosition(), ...options });
    this.actor = actor;
    this._hooks = [];
    const mine = d => d?.parent === actor || d === actor || (d?.parent?.parent === actor);
    const rerender = d => { if (mine(d)) this._queueRender(); };
    for (const h of ["createItem", "updateItem", "deleteItem", "updateActor", "createActiveEffect", "deleteActiveEffect", "updateActiveEffect"]) this._hooks.push([h, Hooks.on(h, rerender)]);
  }

  get title() { return `${this.actor.name} · Character`; }

  _queueRender() { clearTimeout(this._t); this._t = setTimeout(() => { if (this.rendered) this.render(); }, 50); }

  async close(options) {
    clearTimeout(this._t);
    for (const [h, id] of this._hooks) Hooks.off(h, id);
    this._hooks = [];
    OPEN.delete(this.actor.uuid);
    game.tooltip?.deactivate?.();
    return super.close(options);
  }

  slotHTML(slot, cur) {
    const item = cur[slot];
    const ghost = !item && slot === "offhand" && cur.mainhand && isTwo(cur.mainhand) ? cur.mainhand : null;
    const s = SLOTS[slot];
    if (item) return `<div class="wct-slot filled" data-slot="${slot}" data-item-id="${item.id}" draggable="true" style="--q:${qualityColor(item)}" aria-label="${esc(s.label)}: ${esc(item.name)}"><img src="${esc(item.img)}" alt=""></div>`;
    if (ghost) return `<div class="wct-slot ghost" data-slot="${slot}" data-item-id="${ghost.id}" style="--q:${qualityColor(ghost)}" aria-label="${esc(s.label)}: blocked by ${esc(ghost.name)}"><img src="${esc(ghost.img)}" alt=""></div>`;
    return `<div class="wct-slot empty" data-slot="${slot}" aria-label="${esc(s.label)} (empty)" data-tooltip="${esc(s.label)}"><i class="fa-solid ${s.icon}"></i><span>${esc(s.label)}</span></div>`;
  }

  /** One hand of a weapon set. */
  handHTML(state, set, hand) {
    const a = this.actor; const id = state.sets[set][hand]; const item = id ? a.items.get(id) : null;
    const label = WS.handLabel(set, hand); const icon = hand === "off" ? "fa-shield" : set === "ranged" ? "fa-bow-arrow" : "fa-sword";
    const data = `data-set="${set}" data-hand="${hand}"`;
    const main = hand === "off" ? a.items.get(state.sets[set].main) : null;
    const worn = item && set !== state.active && isShield(item) && item.system.equipped;
    if (item) return `<div class="wct-slot wct-hand filled${worn ? " worn" : ""}" ${data} data-item-id="${item.id}" draggable="true" style="--q:${qualityColor(item)}" aria-label="${esc(WS.SETS[set].label)} ${esc(label)}: ${esc(item.name)}"><img src="${esc(item.img)}" alt=""></div>`;
    if (main && isTwo(main)) return `<div class="wct-slot wct-hand ghost" ${data} data-item-id="${main.id}" style="--q:${qualityColor(main)}" aria-label="${esc(label)}: blocked by ${esc(main.name)}"><img src="${esc(main.img)}" alt=""></div>`;
    return `<div class="wct-slot wct-hand empty" ${data} aria-label="${esc(WS.SETS[set].label)} ${esc(label)} (empty)" data-tooltip="${esc(WS.SETS[set].label)}: ${esc(label)}"><i class="fa-solid ${icon}"></i><span>${esc(hand === "off" ? "Off" : set === "ranged" ? "Ranged" : "Main")}</span></div>`;
  }

  /** The weapon sets row: three sets (the active one lit, the others dimmed and marked Stowed), the relic slot, and a note line. */
  setsHTML(cur) {
    const a = this.actor; const state = weaponState(a); const items = describedSetItems(a, state);
    const shields = equippedShields(a); const ammo = hasAmmo(a);
    const groups = WS.SET_IDS.map(set => {
      const on = set === state.active;
      const plan = WS.planSwap(state, set, { items, equippedShields: shields, hasAmmo: ammo });
      const lock = !plan.ok ? ` <i class="fa-solid fa-lock" data-tooltip="${esc(plan.block.message)}"></i>` : "";
      return `<div class="wct-set ${on ? "active" : "stowed"}" data-set="${set}">
        <button type="button" class="wct-set-tab" data-activate="${set}" aria-pressed="${on}" data-tooltip="${on ? `${esc(WS.SETS[set].label)} set (in hand)` : `Swap to the ${esc(WS.SETS[set].label)} set`}"><i class="fa-solid ${WS.SETS[set].icon}"></i> ${esc(WS.SETS[set].label)}${lock}</button>
        <div class="wct-set-hands">${this.handHTML(state, set, "main")}${this.handHTML(state, set, "off")}</div><span class="wct-stowed">${on ? "In hand" : "Stowed"}</span></div>`;
    }).join("");
    const relic = relicShown(a) ? `<div class="wct-set wct-relic"><span class="wct-set-tab static"><i class="fa-solid fa-sun"></i> Relic</span><div class="wct-set-hands">${this.slotHTML("relic", cur)}</div><span class="wct-stowed">Worn</span></div>` : "";
    // Notes: why the last swap was blocked (with Stow shield), then the active set's warnings and info.
    const activePlan = WS.planSwap(state, state.active, { items, equippedShields: shields, hasAmmo: ammo });
    const notes = [];
    const blocked = this._blocked && this._blocked.set !== state.active ? WS.planSwap(state, this._blocked.set, { items, equippedShields: shields, hasAmmo: ammo }) : null;
    if (blocked && !blocked.ok) notes.push(`<li class="bad"><i class="fa-solid fa-lock"></i> ${esc(WS.SETS[this._blocked.set].label)}: ${esc(blocked.block.message)}${blocked.block.code === "shield" && blocked.block.shieldId ? ` <button type="button" data-stow-shield="${esc(blocked.block.shieldId)}">Stow shield</button>` : ""}</li>`);
    else this._blocked = null;
    if (!activePlan.ok) notes.push(`<li class="bad"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(activePlan.block.message)} The ${esc(WS.SETS[state.active].label)} set isn't equipped.${activePlan.block.code === "shield" && activePlan.block.shieldId ? ` <button type="button" data-stow-shield="${esc(activePlan.block.shieldId)}">Stow shield</button>` : ""}</li>`);
    for (const w of activePlan.warnings) notes.push(`<li class="warn"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(w)}</li>`);
    for (const t of activePlan.info) notes.push(`<li><i class="fa-solid fa-hand"></i> ${esc(t)}</li>`);
    return `<div class="wct-row bottom wct-sets">${groups}${relic}</div>${notes.length ? `<ul class="wct-set-notes">${notes.join("")}</ul>` : ""}`;
  }

  async _renderHTML() {
    const a = this.actor; const sys = a.system; const sets = setsOn(); const cur = sets ? gearSlotted(a) : slotted(a);
    if (relicShown(a)) { const r = slotted(a).relic; if (r) cur.relic = r; }
    const ab = sys.abilities ?? {};
    const sign = n => (n >= 0 ? `+${n}` : `${n}`);
    const abil = Object.entries(CONFIG.DND5E.abilities).filter(([k]) => ab[k]).map(([k, c]) => `<li><span class="lbl">${esc(c.label)}</span><span class="val">${ab[k].value ?? "–"} <small>(${sign(ab[k].mod ?? 0)})</small></span></li>`).join("");
    const hp = sys.attributes?.hp ?? {}; const ac = sys.attributes?.ac?.value; const att = sys.attributes?.attunement;
    const classes = Object.values(a.classes ?? {}).map(c => `${c.name}${Object.keys(a.classes).length > 1 ? ` ${c.system.levels}` : ""}`).join(" / ");
    const race = sys.details?.race?.name ?? (typeof sys.details?.race === "string" ? sys.details.race : "");
    const level = sys.details?.level ?? (sys.details?.cr != null ? `CR ${sys.details.cr}` : "");
    const sub = [level ? (typeof level === "number" ? `Level ${level}` : level) : "", race, classes].filter(Boolean).join(" ");
    const bag = unslottedItems(a, cur);
    const loose = bag.filter(i => i.system.equipped).length;
    const div = document.createElement("div");
    div.className = `wct-frame${sets ? " wct-with-sets" : ""}`;
    div.innerHTML = `
      <header class="wct-head"><h2>${esc(a.name)}${featureOn("restedInn") && a.getFlag?.(ID, "rested") ? ` <span class="wct-rested" data-tooltip="Rested at ${esc(a.getFlag(ID, "rested").inn ?? "the inn")}: the next long rest gives a bonus" aria-label="Rested">zzz</span>` : ""}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</header>
      <div class="wct-doll">
        <div class="wct-col left">${LEFT.map(s => this.slotHTML(s, cur)).join("")}</div>
        <div class="wct-centre">
          <div class="wct-portrait" data-drop="auto"><img src="${esc(a.img)}" alt="${esc(a.name)}"></div>
          <div class="wct-stats">
            <ul class="wct-abil">${abil}</ul>
            <ul class="wct-def">
              <li><span class="lbl">Armor</span><span class="val">${ac ?? "–"}</span></li>
              <li><span class="lbl">Health</span><span class="val">${hp.value ?? "–"}${hp.max ? ` / ${hp.max}` : ""}${hp.temp ? ` <small>+${hp.temp}</small>` : ""}</span></li>
              ${att ? `<li class="${att.value > att.max ? "over" : ""}"><span class="lbl">Attuned</span><span class="val">${att.value} / ${att.max}</span></li>` : ""}
            </ul>
          </div>
        </div>
        <div class="wct-col right">${RIGHT.map(s => this.slotHTML(s, cur)).join("")}</div>
        ${sets ? this.setsHTML(cur) : `<div class="wct-row bottom">${BOTTOM.map(s => this.slotHTML(s, cur)).join("")}</div>`}
      </div>
      <section class="wct-bag" data-drop="bag">
        <h3>Equippable items <small>drag onto a slot, click to equip, right-click a slot to remove</small></h3>
        ${loose ? `<p class="wct-note">${loose} equipped item${loose === 1 ? " isn't" : "s aren't"} in a slot. <button type="button" data-action="slotEquipped">Slot equipped items</button></p>` : ""}
        <div class="wct-bag-grid">${bag.length ? bag.map(i => `<div class="wct-item${i.system.equipped ? " equipped" : ""}" data-item-id="${i.id}" draggable="true" style="--q:${qualityColor(i)}" aria-label="${esc(i.name)}"><img src="${esc(i.img)}" alt=""></div>`).join("") : `<p class="wct-empty">Nothing else to equip. Drop items here from a compendium or the sidebar to add them.</p>`}</div>
      </section>
      <div class="wct-pop" hidden></div>`;
    return div;
  }

  _replaceHTML(result, content) {
    // Re-renders (slotting an item, an HP change) keep the item list where it was scrolled to.
    const scroll = content.querySelector(".wct-bag-grid")?.scrollTop ?? 0;
    content.replaceChildren(result);
    const grid = content.querySelector(".wct-bag-grid"); if (grid && scroll) grid.scrollTop = scroll;
  }

  /** Never smaller than the paper doll needs. */
  _updatePosition(position) {
    if (this.minimized) return super._updatePosition(position);
    if (Number.isFinite(position.width)) position.width = Math.max(MIN_W, position.width);
    if (Number.isFinite(position.height)) position.height = Math.max(MIN_H, position.height);
    return super._updatePosition(position);
  }

  _onPosition(position) {
    super._onPosition?.(position);
    this._fit();
    // Remember this client's size and position (not while minimised).
    if (this.minimized) return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      const { left, top, width, height } = this.position;
      if (this.minimized || ![left, top, width, height].every(Number.isFinite)) return;
      try { game.settings.set(ID, SIZE_KEY, { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }); } catch { /* not registered */ }
    }, 300);
  }

  /** Sizes the slots (and with them the portrait) to the window: as big as the width and height both allow. */
  _fit() {
    const el = this.element; const frame = el?.querySelector(".wct-frame"); if (!frame || this.minimized) return;
    const head = frame.querySelector(".wct-head")?.offsetHeight ?? 50;
    const note = frame.querySelector(".wct-bag h3")?.offsetHeight ?? 30;
    const cs = getComputedStyle(frame);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 4;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 4;
    // Width: the centre column keeps at least 300px beside two slot columns (slot + 4px) and the 12px gaps.
    const byW = (frame.clientWidth + 4 - padX - 24 - 300) / 2 - 4;
    // Height: 8 slots + 7 gaps in a column, the weapon row below (slot + 10px), and room for the item list (title + a row of items).
    const free = frame.clientHeight + 4 - padY - head - 8 - (note + 10 + 2 * SLOT_MIN + 5 + 14);
    // Weapon sets: the set tabs above the hands, and the note line under them.
    const extra = frame.classList.contains("wct-with-sets") ? 36 + (frame.querySelector(".wct-set-notes")?.offsetHeight ?? 0) : 0;
    const byH = (free - extra - 7 * 5 - 10 - 6) / 9;
    // Weapon sets: six hands (seven with the relic slot) side by side across the frame, with the set borders and gaps.
    const hands = frame.querySelectorAll(".wct-sets .wct-slot").length;
    const bySets = hands ? (frame.clientWidth - padX - 16 * (hands / 2 + 1) - 8) / hands : SLOT_MAX;
    const size = Math.round(Math.max(SLOT_MIN, Math.min(SLOT_MAX, byW, byH, bySets)));
    el.style.setProperty("--wct-slot", `${size}px`);
  }

  _onRender(context, options) {
    const root = this.element.querySelector(".wct-frame"); if (!root) return;
    this._fit();
    const editable = this.actor.isOwner;
    const itemOf = el => this.actor.items.get(el.closest("[data-item-id]")?.dataset.itemId);

    // Tooltips
    root.querySelectorAll("[data-item-id]").forEach(el => {
      el.addEventListener("pointerenter", () => this._tooltip(el, itemOf(el)));
      el.addEventListener("pointerleave", () => game.tooltip?.deactivate?.());
    });
    if (!editable) return;

    // Drag out
    root.querySelectorAll("[draggable=true]").forEach(el => el.addEventListener("dragstart", ev => {
      const item = itemOf(el); if (!item) return;
      game.tooltip?.deactivate?.();
      ev.dataTransfer.setData("text/plain", JSON.stringify({ ...item.toDragData(), wctSlot: el.dataset.slot ?? null }));
      ev.dataTransfer.effectAllowed = "copyMove";
    }));

    // Drop targets
    const targets = [...root.querySelectorAll(".wct-slot, [data-drop]")];
    for (const el of targets) {
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("over"); });
      el.addEventListener("dragleave", () => el.classList.remove("over"));
      el.addEventListener("drop", ev => { ev.preventDefault(); ev.stopPropagation(); el.classList.remove("over"); this._onDrop(ev, el); });
    }

    // Clicks
    root.querySelectorAll(".wct-slot").forEach(el => {
      el.addEventListener("click", ev => { ev.stopPropagation(); this._slotMenu(el); });
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); const i = el.classList.contains("filled") ? itemOf(el) : null; if (i) unslotItem(i); });
    });
    root.querySelectorAll(".wct-item").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); this._equipFromBag(el, itemOf(el)); }));
    root.querySelector("[data-action=slotEquipped]")?.addEventListener("click", () => this.slotEquipped());
    root.querySelectorAll("[data-activate]").forEach(b => b.addEventListener("click", async ev => {
      ev.stopPropagation(); const set = b.dataset.activate;
      const plan = await activateSet(this.actor, set);
      this._blocked = plan && !plan.ok ? { set } : null;
      if (plan && !plan.ok) this.render();
    }));
    root.querySelectorAll("[data-stow-shield]").forEach(b => b.addEventListener("click", async ev => {
      ev.stopPropagation(); b.disabled = true;
      const want = this._blocked?.set;
      await stowShield(this.actor, b.dataset.stowShield);
      // The swap stays a deliberate second click; the note goes once nothing blocks it.
      if (want) this._blocked = { set: want };
      this.render();
    }));
    root.addEventListener("click", ev => { if (!ev.target.closest(".wct-pop")) this._closePop(); });
  }

  async _onDrop(ev, el) {
    let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
    if (data?.type !== "Item") return;
    const src = await Item.implementation.fromDropData(data).catch(() => null); if (!src) return;
    const slot = el.dataset.slot; const zone = el.dataset.drop;
    if (zone === "bag") {
      if (src.parent === this.actor) { if ((src.getFlag(ID, "slot") && src.system.equipped) || (setsOn() && WS.locate(weaponState(this.actor), src.id))) await unslotItem(src); return; }
      await adopt(this.actor, src, ev); return;
    }
    if (el.dataset.set) {
      const { set, hand } = el.dataset;
      if (!WS.fitsHand(describeItem(src), set, hand)) return ui.notifications.warn(`${src.name} doesn't go in the ${WS.SETS[set].label} set's ${WS.handLabel(set, hand).toLowerCase()}.`);
      const item = await adopt(this.actor, src, ev); if (!item) return;
      return assignWeapon(this.actor, item, set, hand);
    }
    if (slot && !canSlot(src, slot)) return ui.notifications.warn(`${src.name} doesn't go in the ${SLOTS[slot].label} slot.`);
    if (!fits(src)) return ui.notifications.warn(`${src.name} can't be equipped.`);
    const item = await adopt(this.actor, src, ev); if (!item) return;
    if (slot) {
      // Dragging between the two finger or trinket slots swaps them.
      const from = data.wctSlot; const cur = slotted(this.actor);
      if (from && from !== slot && cur[from] === item && cur[slot] && canSlot(cur[slot], from) && group(from) === group(slot)) {
        await this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, [flagPath]: slot }, { _id: cur[slot].id, [flagPath]: from }]);
        return;
      }
      return slotItem(this.actor, item, slot);
    }
    return this._equipFromBag(null, item);
  }

  async _equipFromBag(el, item) {
    if (!item) return;
    if (setsOn()) {
      if (relicShown(this.actor) && canSlot(item, "relic") && !slotted(this.actor).relic) return slotItem(this.actor, item, "relic");
      if (prefersHand(item)) {
        const h = autoHand(this.actor, item); if (h) return assignWeapon(this.actor, item, h.set, h.hand);
        if (!fits(item)) return;
      }
    }
    const s = autoSlot(this.actor, item);
    if (s) return slotItem(this.actor, item, s);
    const f = fits(item); if (!f) return;
    const cur = slotted(this.actor);
    this._showPop(el ?? this.element.querySelector(".wct-portrait"), `<h4>Where does ${esc(item.name)} go?</h4><ul>${f.slots.map(sl => `<li data-pick-slot="${sl}"><i class="fa-solid ${SLOTS[sl].icon}"></i> ${esc(SLOTS[sl].label)}${cur[sl] ? ` <small>(replaces ${esc(cur[sl].name)})</small>` : ""}</li>`).join("")}</ul>`,
      li => slotItem(this.actor, item, li.dataset.pickSlot));
  }

  _handMenu(el) {
    const { set, hand } = el.dataset; const state = weaponState(this.actor);
    const title = `${WS.SETS[set].label}: ${WS.handLabel(set, hand)}`;
    if (el.classList.contains("ghost")) return ui.notifications.info(`${this.actor.items.get(state.sets[set].main)?.name ?? "The main-hand weapon"} is two-handed: the off hand is taken.`);
    const inSlot = el.classList.contains("filled") ? this.actor.items.get(state.sets[set][hand]) : null;
    const choices = this.actor.items.filter(i => i !== inSlot && !i.system.container && WS.fitsHand(describeItem(i), set, hand)).sort((a, b) => a.name.localeCompare(b.name));
    const where = i => { const at = WS.locate(state, i.id); return at ? ` <small>(${esc(WS.SETS[at.set].label)})</small>` : ""; };
    const rows = choices.map(i => `<li data-pick-item="${i.id}" style="--q:${qualityColor(i)}"><img src="${esc(i.img)}" alt=""> <span>${esc(i.name)}</span>${where(i)}</li>`).join("");
    this._showPop(el, `<h4>${esc(title)}</h4>${inSlot ? `<p class="cur" style="--q:${qualityColor(inSlot)}"><img src="${esc(inSlot.img)}" alt=""> <span>${esc(inSlot.name)}</span></p>` : ""}<ul>${inSlot ? `<li data-pick-item="" class="remove"><i class="fa-solid fa-xmark"></i> Take out of the set</li>` : ""}${rows || (inSlot ? "" : `<li class="none">Nothing on ${esc(this.actor.name)} fits here.</li>`)}</ul>`,
      li => { const id = li.dataset.pickItem; if (id === undefined) return; if (!id) return inSlot && unassignWeapon(inSlot); const it = this.actor.items.get(id); if (it) assignWeapon(this.actor, it, set, hand); });
  }

  _slotMenu(el) {
    if (el.dataset.set) return this._handMenu(el);
    const slot = el.dataset.slot; const cur = slotted(this.actor); const inSlot = el.classList.contains("filled") ? cur[slot] : null;
    if (el.classList.contains("ghost")) return ui.notifications.info(`${cur.mainhand.name} is two-handed: the off hand is taken.`);
    const first = new Map(); const firstIs = i => { if (!first.has(i)) first.set(i, slot === "relic" || fits(i)?.slots[0] === slot); return first.get(i); };
    const choices = this.actor.items.filter(i => i !== inSlot && canSlot(i, slot) && !i.system.container).sort((a, b) => firstIs(b) - firstIs(a) || a.name.localeCompare(b.name));
    const where = i => { const s = Object.entries(cur).find(([, x]) => x === i)?.[0]; return s ? ` <small>(${esc(SLOTS[s].label)})</small>` : ""; };
    const rows = choices.map(i => `<li data-pick-item="${i.id}" style="--q:${qualityColor(i)}"><img src="${esc(i.img)}" alt=""> <span>${esc(i.name)}</span>${where(i)}</li>`).join("");
    this._showPop(el, `<h4>${esc(SLOTS[slot].label)}</h4>${inSlot ? `<p class="cur" style="--q:${qualityColor(inSlot)}"><img src="${esc(inSlot.img)}" alt=""> <span>${esc(inSlot.name)}</span></p>` : ""}<ul>${inSlot ? `<li data-pick-item="" class="remove"><i class="fa-solid fa-xmark"></i> Take off</li>` : ""}${rows || (inSlot ? "" : `<li class="none">Nothing on ${esc(this.actor.name)} fits here.</li>`)}</ul>`,
      li => { const id = li.dataset.pickItem; if (id === undefined) return; if (!id) return inSlot && unslotItem(inSlot); const it = this.actor.items.get(id); if (it) slotItem(this.actor, it, slot); });
  }

  _showPop(anchor, html, onPick) {
    const pop = this.element.querySelector(".wct-pop"); if (!pop) return;
    pop.innerHTML = html; pop.hidden = false;
    const box = this.element.querySelector(".wct-frame").getBoundingClientRect(); const r = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(4, r.left - box.left + r.width + 4), box.width - 234);
    pop.style.left = `${left}px`; pop.style.top = `${Math.max(4, Math.min(r.top - box.top, box.height - pop.offsetHeight - 4))}px`;
    pop.querySelectorAll("li[data-pick-item], li[data-pick-slot]").forEach(li => li.addEventListener("click", ev => { ev.stopPropagation(); this._closePop(); onPick(li); }));
  }
  _closePop() { const pop = this.element?.querySelector(".wct-pop"); if (pop) pop.hidden = true; }

  async _tooltip(el, item) {
    if (!item || !game.tooltip?.activate) return;
    this._tipFor = el;
    const desc = item.system.description?.value ?? "";
    const wowTip = desc.includes("font-size:1.08em");
    let body = "";
    try { body = await TextEditorImpl().enrichHTML(desc, { relativeTo: item, secrets: item.isOwner }); } catch { body = ""; }
    if (this._tipFor !== el || !el.matches(":hover")) return;
    const f = fits(item); const slot = item.getFlag(ID, "slot");
    const typeLine = [item.system.type?.label, f?.wow ? `Slot: ${f.wow}` : "", item.system.attunement === "required" ? (item.system.attuned ? "Attuned" : "Requires attunement") : ""].filter(Boolean).join(" · ");
    const tip = document.createElement("div");
    tip.className = "wct-tip-body";
    tip.innerHTML = wowTip ? `<div class="desc wow">${body}</div>` : `<h4 style="color:${qualityColor(item)}">${esc(item.name)}</h4>${typeLine ? `<p class="type">${esc(typeLine)}</p>` : ""}${body ? `<div class="desc">${body}</div>` : ""}`;
    if (wowTip && typeLine && item.system.attunement) tip.insertAdjacentHTML("beforeend", `<p class="type">${esc(typeLine)}</p>`);
    if (el.classList.contains("ghost")) tip.insertAdjacentHTML("afterbegin", `<p class="type">Two-handed: fills the off hand.</p>`);
    else if (el.classList.contains("worn")) tip.insertAdjacentHTML("beforeend", `<p class="type">Still worn on the arm (shields stay on through a swap). Take it off from the pane's note, or unequip it on the sheet.</p>`);
    else if (el.dataset.set && el.closest(".wct-set.stowed")) tip.insertAdjacentHTML("beforeend", `<p class="type">Stowed: not equipped until you swap to the ${esc(WS.SETS[el.dataset.set].label)} set.</p>`);
    else if (el.classList.contains("wct-item") && item.system.equipped && !slot) tip.insertAdjacentHTML("beforeend", `<p class="type">Equipped, not in a slot.</p>`);
    if (el.classList.contains("wct-item")) { const cmp = comparisonHTML(this.actor, item); if (cmp) tip.insertAdjacentHTML("beforeend", cmp); }
    game.tooltip.activate(el, { html: tip, cssClass: "wct-tip", direction: el.closest(".wct-col.right") ? "LEFT" : "RIGHT" });
  }

  /** Puts every equipped item that isn't in a slot into its best free slot. Items with no clear slot are left alone. */
  async slotEquipped() {
    // Plans every slot against a local copy of the slot map, then writes them all in one update.
    const left = []; const cur = setsOn() ? gearSlotted(this.actor) : slotted(this.actor); const updates = [];
    if (relicShown(this.actor)) { const r = slotted(this.actor).relic; if (r) cur.relic = r; }
    for (const i of unslottedItems(this.actor, cur).filter(i => i.system.equipped)) {
      if (setsOn() && prefersHand(i) && !(relicShown(this.actor) && canSlot(i, "relic") && !cur.relic)) {
        // Weapons and held items go into a free hand of a set, one at a time (each write re-reads the sets).
        const h = autoHand(this.actor, i); const st = weaponState(this.actor);
        if (h && !st.sets[h.set][h.hand]) await assignWeapon(this.actor, i, h.set, h.hand); else left.push(i.name);
        continue;
      }
      const s = autoSlot(this.actor, i, cur);
      if (!s || cur[s]) { left.push(i.name); continue; }
      if (s === "offhand" && cur.mainhand && isTwo(cur.mainhand)) { left.push(i.name); continue; }
      cur[s] = i; updates.push({ _id: i.id, [flagPath]: s });
    }
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);
    if (left.length) ui.notifications.info(`No free slot found for: ${left.join(", ")}. Click a slot to choose.`);
  }
}

/** Re-renders every open pane on this client (a weapon-set setting changed). */
export function refreshOpen() { for (const app of OPEN.values()) if (app.rendered) app.render(); }

/** Opens (or brings forward) the character pane for an actor: the given one, else the selected token's, else the user's character. */
export function characterPane(actor = null) {
  if (!game.settings.get(ID, "characterPane")) return ui.notifications.warn("The character pane is turned off in Wayfarer's Toolkit's settings.");
  if (typeof actor === "string") actor = fromUuidSync(actor) ?? game.actors.get(actor) ?? game.actors.getName(actor);
  actor ??= canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Character pane: select a token or pass an actor.");
  if (!actor.isOwner) return ui.notifications.warn(`You don't own ${actor.name}.`);
  if (!actor.items || !actor.system?.attributes) return ui.notifications.warn(`${actor.name} has no equipment.`);
  let app = OPEN.get(actor.uuid);
  if (!app) { app = new CharacterPane(actor); OPEN.set(actor.uuid, app); }
  // An actor from before weapon sets gets its sets stored the first time its pane opens (Melee active), then the pane renders.
  ensureSets(actor).catch(e => console.warn(`${ID} | weapon sets`, e)).finally(() => app.render({ force: true }));
  return app;
}

/**
 * Armour-typed pieces worn in a slot other than Chest (MMO-style helms, shoulders, boots and so on are often typed as light, medium or
 * heavy armour with no AC) don't replace the body armour in dnd5e's AC calculation. Only the AC calculation is affected.
 */
export function patchArmorClass() {
  const AF = globalThis.dnd5e?.dataModels?.actor?.AttributesFields;
  if (!AF?.prepareArmorClass || AF.prepareArmorClass._wct) return;
  const orig = AF.prepareArmorClass;
  // Runs on every actor data preparation, so it stays cheap: no settings read (it's only installed when the pane is on, and that
  // setting reloads Foundry) and a straight call through when nothing needs hiding.
  const patched = function (...args) {
    const eq = this.parent?.itemTypes?.equipment;
    let hidden = null;
    if (eq?.length) { try { hidden = eq.filter(i => i.system.equipped && isBodyArmor(i) && !isSuit(i)); } catch (e) { hidden = null; } }
    if (!hidden?.length) return orig.apply(this, args);
    for (const i of hidden) i.system.equipped = false;
    try { return orig.apply(this, args); }
    finally { for (const i of hidden) i.system.equipped = true; }
  };
  patched._wct = true;
  AF.prepareArmorClass = patched;
}

/** GM: Buckler (shields) and Relic (focus-like items) checkboxes in an item sheet's header. Ticked state shows the auto-detected value. */
function addItemFlagBoxes(app, element) {
  const item = app?.document; const root = element instanceof HTMLElement ? element : (app?.element ?? element?.[0]);
  if (!game.user.isGM || !root || !(item instanceof Item) || !setsOn()) return;
  root.querySelectorAll(".wct-itemflag").forEach(e => e.remove());
  const host = root.querySelector(".sheet-header") ?? root.querySelector(".window-content"); if (!host) return;
  const boxes = [];
  if (isShield(item)) boxes.push(["buckler", WS.isBuckler(item), "Character pane: a buckler is strapped to the arm, so the hand stays free for a one-handed weapon or a ranged weapon. Still not usable with two-handed weapons."]);
  const relicCandidate = item.type === "equipment" && "equipped" in (item.system ?? {}) && !isShield(item) && !isBodyArmor(item);
  if (relicCandidate) boxes.push(["relic", WS.isRelicItem(item), "Character pane: this item can go in the relic slot (a worn slot for the classes set in the control panel)."]);
  for (const [key, on, tip] of boxes) {
    const wrap = document.createElement("label");
    wrap.className = `wct-itemflag wct-${key}`; wrap.style.cssText = "display:flex;align-items:center;gap:0.3em;font-size:var(--font-size-12,12px);flex:0 0 auto;";
    wrap.dataset.tooltip = tip;
    wrap.innerHTML = `<input type="checkbox" ${on ? "checked" : ""}> ${key === "buckler" ? "Buckler" : "Relic"}`;
    const box = wrap.querySelector("input");
    box.addEventListener("change", async ev => { ev.stopPropagation(); await item.setFlag(ID, key, box.checked); });
    box.addEventListener("input", ev => ev.stopPropagation());
    if (host.classList.contains("window-content")) host.prepend(wrap); else host.append(wrap);
  }
}

/** Header button on dnd5e character and NPC sheets, and slot bookkeeping. */
export function registerHooks() {
  // This client's pane size and position (only registered while the pane is turned on).
  game.settings.register(ID, SIZE_KEY, { scope: "client", config: false, type: Object, default: {} });
  // An item equipped or unequipped outside the pane (the dnd5e sheet, a macro) that disagrees with its weapon set leaves the set,
  // so the sets never claim something the sheet says otherwise. Runs on the client that made the change.
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (options?.wctSets || userId !== game.user.id || !setsOn() || !foundry.utils.hasProperty(changes, "system.equipped")) return;
    const actor = item.parent; if (!(actor instanceof Actor) || !actor.getFlag(ID, "weaponSets")) return;
    const st = weaponState(actor); const at = WS.locate(st, item.id); if (!at) return;
    const shouldBe = at.set === st.active; const is = !!item.system.equipped;
    if (is === shouldBe || (isShield(item) && !is) || (isShield(item) && is && !shouldBe)) return;
    st.sets[at.set][at.hand] = null;
    actor.update({ [SETS_FLAG]: st }).catch(() => { });
  });
  // Item comparison on Item Piles pile and merchant rows (the user's character's gear).
  for (const k of ["PileItem", "MerchantItem", "VaultGridItem"]) {
    Hooks.on(`item-piles-mouseHover${k}`, (el, item) => { pileRowTip(el, item); });
    Hooks.on(`item-piles-mouseLeave${k}`, () => game.tooltip?.deactivate?.());
  }
  // Buckler and Relic checkboxes on item sheets (GM), like Vendor Trash's Lootable checkbox.
  Hooks.on("renderDocumentSheetV2", (app, element) => { if (app.document instanceof Item) addItemFlagBoxes(app, element); });
  // Unequipping an item anywhere (the dnd5e sheet, a macro) takes it out of its slot too.
  Hooks.on("preUpdateItem", (item, changes) => {
    if (foundry.utils.getProperty(changes, "system.equipped") === false && item.getFlag(ID, "slot") && !foundry.utils.hasProperty(changes, flagPath))
      foundry.utils.setProperty(changes, flagPath, null);
  });
  const add = (app, controls) => {
    const actor = app.document ?? app.actor;
    if (!actor || !["character", "npc"].includes(actor.type) || !actor.isOwner) return;
    if (controls.some(c => c.action === "wctCharacterPane")) return;
    controls.unshift({ icon: "fa-solid fa-shirt", label: "Character Pane", action: "wctCharacterPane", visible: true, onClick: () => characterPane(actor) });
  };
  Hooks.on("getHeaderControlsBaseActorSheet", add);
  // A visible button in the window header as well as the controls menu.
  Hooks.on("renderBaseActorSheet", (app, element) => {
    const actor = app.document ?? app.actor; const html = app.element ?? element;
    const header = html?.querySelector?.(".window-header"); if (!header) return;
    if (!actor || !["character", "npc"].includes(actor.type) || !actor.isOwner) return header.querySelector(".wct-pane-btn")?.remove();
    if (header.querySelector(".wct-pane-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "header-control icon fa-solid fa-shirt wct-pane-btn";
    btn.dataset.tooltip = "Character Pane"; btn.setAttribute("aria-label", "Character Pane");
    btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); characterPane(actor); });
    btn.addEventListener("pointerdown", ev => ev.stopPropagation());
    const anchor = header.querySelector("[data-action=toggleControls]") ?? header.querySelector("[data-action=close]");
    anchor ? anchor.before(btn) : header.append(btn);
  });
}
