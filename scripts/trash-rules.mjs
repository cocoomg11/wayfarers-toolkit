/**
 * Vendor Trash rules: what may drop from what, and how much it is worth by challenge rating.
 * Pure logic with no Foundry calls, so it can be tested outside Foundry. Every name here is an ordinary English word;
 * game-specific creature and item names belong in each world's "Vendor Trash Rules" page, never in this file.
 */

// ---------------------------------------------------------------- material tags
/** Keywords in an item's name that give it a material tag. An item can carry several tags. */
export const TAGS = {
  fur: ["fur", "furry", "pelt", "hide", "leather", "mane", "wool", "hair", "whisker", "paw", "hoof", "hooves", "snout"],
  tooth: ["tooth", "teeth", "tusk", "horn", "fang", "claw", "antler"],
  flesh: ["meat", "flesh", "flank", "haunch", "steak", "chunk", "tail", "gut", "intestine", "heart", "liver", "tongue", "eye", "ear", "gland", "blood", "sinew", "tendon", "brain", "kidney", "lung"],
  insect: ["chitin", "chitinous", "carapace", "mandible", "stinger", "ichor", "silk", "web", "webbing", "spinneret", "thorax", "antenna", "larva", "cocoon"],
  venom: ["venom", "venomous", "poison", "toxin"],
  egg: ["egg", "yolk"],
  scale: ["scale", "scaly"],
  avian: ["feather", "plume", "quill", "talon", "beak"],
  wing: ["wing", "membrane"],
  aquatic: ["fin", "gill", "flipper", "blubber", "pearl"],
  shell: ["shell"],
  undead: ["bone", "skull", "dust", "grave", "ectoplasm", "rotting", "rotted", "decaying", "shroud", "tomb", "jawbone", "femur", "rib", "soul", "marrow", "spectral", "ghostly"],
  elemental: ["elemental", "stone", "rock", "pebble", "ash", "ember", "cinder", "essence", "shard", "crystal", "mote", "slag", "magma", "molten", "coal", "sand", "frost", "frozen", "static", "charged", "glowing", "spark"],
  plant: ["root", "petal", "spore", "bark", "leaf", "leaves", "vine", "seed", "thorn", "sap", "moss", "husk", "bloom", "blossom", "fungus", "fungal", "mushroom", "kelp", "seaweed", "twig", "branch", "pollen"],
  ooze: ["slime", "goo", "ooze", "gelatin", "residue", "sludge", "jelly"],
  trinket: ["watch", "bauble", "pipe", "coin", "diary", "page", "locket", "trinket", "candle", "sack", "pouch", "dice", "flask", "bottle", "letter", "pendant", "ring", "necklace", "figurine", "idol", "key", "token", "charm", "cup", "mug", "comb", "mirror", "spoon", "cloth", "rag", "bandana", "mask", "badge", "insignia", "map", "note", "button", "buckle", "thread", "wax", "tobacco"]
};
/** Tags with a meaning of their own: `misc` (loot whose name matched no keyword), `gear` (weapons and armour) and `coin` (rules only: the creature carries coin). */
export const PSEUDO_TAGS = ["misc", "gear", "coin"];
export const ALL_TAGS = [...Object.keys(TAGS), ...PSEUDO_TAGS];

/** Lower-cases a word and drops possessives and plural endings: "Wolves'" → "wolve", "Fangs" → "fang", "Leaves" stays matched by its own keyword. */
export function normWord(w) {
  w = String(w ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
export const words = s => (String(s ?? "").match(/[A-Za-z']+/g) ?? []).map(normWord).filter(Boolean);
const KEYWORD_TAG = new Map(); for (const [t, list] of Object.entries(TAGS)) for (const k of list) KEYWORD_TAG.set(normWord(k), t);
KEYWORD_TAG.set("leave", "plant"); KEYWORD_TAG.set("hoove", "fur"); KEYWORD_TAG.set("teeth", "tooth");

/** Material tags for an item from its name and document type. Weapons and armour are `gear`; anything else whose name matches no keyword is `misc`. */
export const isGearType = type => type === "weapon" || type === "equipment";
export function tagsFor(name, type = "loot") {
  if (isGearType(type)) return ["gear"];
  const tags = new Set(); for (const w of words(name)) { const t = KEYWORD_TAG.get(w); if (t) tags.add(t); }
  // A made object ("Leather Pouch", "Silk Cloth") is a trinket; its material words don't make it a body part.
  if (tags.has("trinket")) return ["trinket"];
  return tags.size ? [...tags] : ["misc"];
}

// ---------------------------------------------------------------- creatures
/**
 * Creature words: matched against a creature's name and subtype. `tags` are the materials such a creature may drop, `core` (default
 * all of `tags`) the ones an item needs at least one of. `family: true` also makes the word a family word: an item whose name contains
 * it only drops from creatures matching the same group ("bear" items only from bears).
 */
const W = (id, list, tags, { kind = "beast", core = null, family = true } = {}) => ({ id, re: new RegExp(`\\b(${list})\\b`, "i"), tags, core: core ?? tags, kind, family });
const BEAST = ["fur", "tooth", "flesh", "insect", "venom", "egg", "scale", "avian", "wing", "aquatic", "shell"];
export const CREATURE_WORDS = [
  // Ordinary people. Listed first so "Wolf Rider Bandit" counts as a person. Role words are not family words.
  W("person", "bandit|brigand|thug|thief|cutthroat|guard|soldier|mage|priest|cultist|pirate|smuggler|poacher|footpad|rogue|knight|captain|deputy|acolyte|adept|warlock|witch|wizard|sorcerer|necromancer|miner|worker|peasant|villager|noble|merchant|sailor", [], { kind: "humanoid", family: false }),
  W("gnoll", "gnolls?", [], { kind: "humanoid" }),
  W("kobold", "kobolds?", [], { kind: "humanoid" }),
  W("goblin", "goblins?|hobgoblins?", [], { kind: "humanoid" }),
  W("orc", "orcs?", [], { kind: "humanoid" }),
  W("ogre", "ogres?", [], { kind: "humanoid" }),
  W("troll", "trolls?", [], { kind: "humanoid" }),
  W("dragon", "dragon\\w*|drake\\w*|whelp\\w*|wyrms?", ["scale", "tooth", "wing", "elemental", "flesh", "egg"], { kind: "dragon" }),
  W("canine", "wol(f|ves)|worgs?|dogs?|hounds?|jackals?|coyotes?|fox(es)?|hyenas?", ["fur", "tooth", "flesh"]),
  W("bear", "\\w*bears?", ["fur", "tooth", "flesh"]),
  W("boar", "boars?|pigs?|hogs?|warthogs?|swine", ["fur", "tooth", "flesh"]),
  W("feline", "cats?|lions?|lioness(es)?|panthers?|tigers?|lynx(es)?|leopards?|jaguars?|cougars?|pumas?|prowlers?|sabertooths?", ["fur", "tooth", "flesh"]),
  W("hoofed", "stags?|deer|elks?|moose|goats?|rams?|ox|oxen|bulls?|cows?|horses?|mares?|stallions?|ponies|pony|yaks?|bison|buffalo(es)?|antelopes?|gazelles?|zebras?", ["fur", "tooth", "flesh"]),
  W("rodent", "rats?|mouse|mice|rabbits?|hares?|squirrels?|badgers?|weasels?|moles?|porcupines?", ["fur", "tooth", "flesh"]),
  W("ape", "apes?|gorillas?|monkeys?|baboons?|yetis?", ["fur", "tooth", "flesh"]),
  W("spider", "spiders?|tarantulas?", ["insect", "venom", "egg", "flesh"], { core: ["insect", "venom", "egg"] }),
  W("scorpion", "scorp\\w*", ["insect", "venom", "flesh"], { core: ["insect", "venom"] }),
  W("insect", "beetles?|wasps?|hornets?|bees?|ants?|mantis(es)?|centipedes?|locusts?|moths?|larvae?|grubs?|worms?|roach(es)?", ["insect", "venom", "egg", "wing", "flesh"], { core: ["insect", "venom", "egg", "wing"] }),
  W("crab", "crabs?|lobsters?", ["shell", "aquatic", "flesh"]),
  W("turtle", "turtles?|tortoises?", ["shell", "scale", "flesh", "egg"]),
  W("croc", "croc\\w*|gators?|alligators?|caimans?", ["scale", "tooth", "flesh", "egg"]),
  W("lizard", "lizards?|basilisks?|iguanas?|salamanders?|geckos?", ["scale", "tooth", "flesh", "egg"]),
  W("snake", "snakes?|serpents?|pythons?|vipers?|cobras?|adders?|asps?", ["scale", "tooth", "venom", "flesh", "egg"]),
  W("raptor", "raptors?", ["scale", "tooth", "avian", "flesh", "egg"]),
  W("bat", "bats?", ["fur", "wing", "tooth", "flesh"]),
  W("bird", "owl\\w*|hawks?|eagles?|falcons?|vultures?|buzzards?|condors?|crows?|ravens?|birds?|harpy|harpies|rocs?|gulls?|herons?|storks?|chickens?|roosters?|parrots?", ["avian", "wing", "flesh", "egg"]),
  W("wyvern", "wyverns?", ["scale", "wing", "tooth", "venom", "flesh"]),
  W("fish", "sharks?|fish|eels?|piranhas?|barracudas?|threshers?", ["aquatic", "scale", "tooth", "flesh"]),
  W("sea mammal", "whales?|walrus(es)?|otters?", ["aquatic", "fur", "tooth", "flesh"]),
  W("undead", "skeletons?|skeletal|zombies?|ghouls?|ghosts?|spirits?|wraiths?|lich(es)?|banshees?|mumm(y|ies)|wights?|shades?|undead|risen|revenants?|spect(er|re)s?|phantoms?", ["undead", "flesh", "tooth"], { kind: "undead", core: ["undead"], family: false }),
  W("elemental", "elementals?|golems?|constructs?|gargoyles?|automatons?", ["elemental"], { kind: "elemental", family: false }),
  W("plant", "treants?|lashers?|shamblers?|blooms?|fungus|fungi|fungal|mushrooms?|vines?|briars?|saplings?", ["plant"], { kind: "plant", family: false }),
  W("ooze", "oozes?|slimes?|jell(y|ies)|puddings?", ["ooze"], { kind: "ooze", family: false })
];
// An "owlbear" matches both the bear and the bird group, so it may drop either's parts.

/** Profiles for the dnd5e creature types. A beast or monstrosity named after a creature word uses that word's tags instead. */
export const TYPE_PROFILES = {
  beast: { kind: "beast", tags: BEAST },
  monstrosity: { kind: "beast", tags: BEAST },
  dragon: { kind: "dragon", tags: ["scale", "tooth", "wing", "elemental", "flesh", "egg"], deny: ["fur", "insect", "venom", "avian", "plant", "ooze", "undead"], hard: true },
  humanoid: { kind: "humanoid", tags: ["trinket", "misc"], deny: [...BEAST, "undead", "elemental", "plant", "ooze"] },
  giant: { kind: "humanoid", tags: ["trinket", "misc"], deny: [...BEAST, "undead", "elemental", "plant", "ooze"] },
  undead: { kind: "undead", tags: ["undead", "flesh", "tooth"], core: ["undead"] },
  elemental: { kind: "elemental", tags: ["elemental"] },
  construct: { kind: "elemental", tags: ["elemental"] },
  plant: { kind: "plant", tags: ["plant"] },
  fey: { kind: "plant", tags: ["plant"] },
  ooze: { kind: "ooze", tags: ["ooze"] },
  aberration: { kind: "other", tags: ["ooze", "tooth", "insect", "flesh", "misc"], core: ["ooze", "tooth", "insect", "flesh"] },
  fiend: { kind: "other", tags: ["elemental", "tooth", "scale", "wing", "flesh", "misc"], core: ["elemental", "tooth", "scale", "wing", "flesh"] },
  celestial: { kind: "other", tags: ["avian", "wing", "elemental", "misc"], core: ["avian", "wing", "elemental"] }
};
/** dnd5e types a humanoid creature word never overrides. */
export const HARD_TYPES = ["dragon", "undead", "elemental", "construct", "ooze", "plant"];
const KIND_PROFILES = { humanoid: TYPE_PROFILES.humanoid, dragon: TYPE_PROFILES.dragon, undead: TYPE_PROFILES.undead, elemental: TYPE_PROFILES.elemental, plant: TYPE_PROFILES.plant, ooze: TYPE_PROFILES.ooze };

/** How each kind of creature rolls: [chance, slot]. `item` is a flavour-matching loot item, `gear` a worn weapon or armour piece. */
export const KIND_SLOTS = {
  beast: [[0.7, "item"], [0.15, "item"]],
  dragon: [[1, "item"], [0.3, "item"]],
  humanoid: [[0.5, "item"], [0.35, "gear"]],
  undead: [[0.6, "item"], [0.2, "gear"]],
  elemental: [[0.6, "item"]],
  plant: [[0.6, "item"]],
  ooze: [[0.6, "item"]],
  other: [[0.5, "item"]]
};
/** Chance a creature of each kind carries coin. */
export const KIND_COIN = { humanoid: 0.75, undead: 0.25 };

/**
 * A creature's loot profile from { name, type, subtype }, with the world's rules applied:
 * { kind, tags, core, deny, groups, familyWords, allowItems, denyItems, gear, coin, prefer }.
 */
export function profileFor({ name = "", type = "", subtype = "" } = {}, rules = []) {
  type = String(type || "").toLowerCase().trim(); const text = `${name} ${subtype}`;
  const hits = CREATURE_WORDS.filter(g => g.re.test(text));
  const person = hits.find(g => g.kind === "humanoid");
  const race = hits.find(g => g.kind === "humanoid" && g.family); // gnoll, kobold, goblin, orc, ogre, troll
  const beasts = hits.filter(g => g.kind !== "humanoid");
  let base; let groups = [];
  // A humanoid race word (or a person word with no animal word beside it) makes the creature humanoid whatever its dnd5e type,
  // except for types where that's clearly wrong (a gnoll lich is still undead).
  if (person && !HARD_TYPES.includes(type) && (!type || race || !beasts.length)) { base = KIND_PROFILES.humanoid; groups = hits.filter(g => g.kind === "humanoid"); }
  else if (TYPE_PROFILES[type] && !["beast", "monstrosity"].includes(type)) base = TYPE_PROFILES[type];
  else {
    if (beasts.length) {
      groups = beasts; const k = beasts[0].kind;
      base = { kind: k, tags: [...new Set(beasts.flatMap(g => g.tags))], core: [...new Set(beasts.flatMap(g => g.core))], deny: KIND_PROFILES[k]?.deny, hard: KIND_PROFILES[k]?.hard };
    } else if (TYPE_PROFILES[type]) base = TYPE_PROFILES[type];
    else if (!type) base = KIND_PROFILES.humanoid;
    else { base = { kind: "other", tags: ["fur", "tooth", "flesh", "undead", "elemental", "plant", "misc"], core: ["fur", "tooth", "flesh", "undead", "elemental", "plant", "misc"] }; }
  }
  if (!groups.length) groups = hits.filter(g => g.kind === base.kind);
  const p = {
    kind: base.kind, tags: new Set(base.tags), core: new Set(base.core ?? base.tags), deny: new Set(base.deny ?? []), hardDeny: new Set(base.hard ? base.deny : []),
    groups: groups.map(g => g.id), familyWords: new Set(), allowItems: [], denyItems: [], gear: base.kind === "humanoid" || base.kind === "undead",
    coin: KIND_COIN[base.kind] ?? 0, prefer: base.kind === "humanoid" ? "trinket" : null, rules: []
  };
  const hay = `${name} ${type} ${subtype}`.toLowerCase();
  for (const r of rules) {
    if (r.match !== "*" && !hay.includes(r.match)) continue;
    p.rules.push(r.match);
    for (const t of r.allowTags) {
      if (t === "gear") p.gear = true; else if (t === "coin") p.coin = Math.max(p.coin, 0.75);
      else { p.tags.add(t); p.core.add(t); p.deny.delete(t); } // hard limits (dragons) stay
    }
    p.allowItems.push(...r.allowItems); p.denyItems.push(...r.denyItems);
    for (const w of r.familyWords) p.familyWords.add(w);
  }
  return p;
}

// ---------------------------------------------------------------- family words
/** Leading words of creature names that say nothing about the family ("Young", "Mangy", colours, places). */
export const FAMILY_STOP = new Set(["the", "a", "an", "young", "old", "elder", "ancient", "adult", "juvenile", "baby", "mature", "mangy", "rabid", "dire", "giant", "large", "small", "huge", "tiny", "great", "greater", "lesser", "big", "little", "wild", "feral", "frenzied", "starving", "diseased", "plagued", "corrupted", "sickly", "fierce", "vicious", "savage", "hungry", "angry", "enraged", "black", "white", "grey", "gray", "red", "blue", "green", "yellow", "brown", "dark", "pale", "golden", "silver", "cave", "forest", "mountain", "river", "swamp", "marsh", "desert", "hill", "snow", "plains", "night", "dread", "lost", "dead", "living", "wandering", "rogue", "chief", "leader", "master", "lord", "lady", "captain", "sir",
  // adjectives that also start item names ("Thick ...", "Broken ...")
  "thick", "thin", "heavy", "light", "rough", "sharp", "long", "short", "soft", "hard", "fine", "coarse", "shiny", "smooth", "dull", "sturdy", "flimsy", "cheap", "simple", "plain", "crude", "rusty", "rusted", "frayed", "faded", "moldy", "musty", "stained", "broken", "cracked", "chipped", "bent", "torn", "tattered", "worn", "ruined", "damaged", "stringy", "tough", "tender", "scrap", "bloody", "slimy", "sticky", "murky", "warm", "cold", "hot", "wet", "dry", "bright", "deep", "high", "low", "first", "second", "third", "elite", "veteran", "novice", "apprentice", "journeyman",
  // metals and woods, common in item names
  "iron", "bronze", "copper", "steel", "tin", "lead", "brass", "wooden", "oak", "pine"].map(normWord));

/**
 * World family words: the first word of each creature name (skipping words like "Young" or "Mangy"), minus material keywords and
 * words a family creature group already covers (those groups are family words of their own).
 * `extra` adds words from the world rules. Returns a Set of normalised words.
 */
export function familyWordsFrom(names = [], extra = []) {
  const out = new Set();
  for (const n of names) {
    const raw = String(n ?? "").split(/[\s,]+/).filter(Boolean).find(r => !FAMILY_STOP.has(normWord(r)));
    const w = normWord(raw); if (!w || w.length < 3 || KEYWORD_TAG.has(w) || CREATURE_WORDS.some(g => g.family && g.re.test(raw))) continue;
    out.add(w);
  }
  for (const w of extra) { const n = normWord(w); if (n) out.add(n); }
  return out;
}

/** Family words in an item name: creature groups with family: true, plus world family words. */
export const familyGroupsOf = name => CREATURE_WORDS.filter(g => g.family && g.re.test(name)).map(g => g.id);
export function itemFamilies(item, worldFams = new Set()) {
  const fams = (item.groups ?? familyGroupsOf(item.name)).map(group => ({ group }));
  for (const w of item.words ?? words(item.name)) if (worldFams.has(w)) fams.push({ word: w });
  return fams;
}
/** Whether a creature belongs to one of an item's families. */
function inFamily(fams, prof, creatureWords) {
  return fams.some(f => f.group ? prof.groups.includes(f.group) : (creatureWords.has(f.word) || prof.familyWords.has(f.word)));
}

/** Adds `tags` and `words` to a pool entry ({ name, type, ... }). */
export function classifyItem(entry) {
  entry.tags = tagsFor(entry.name, entry.type);
  entry.words = words(entry.name);
  entry.groups = familyGroupsOf(entry.name);
  return entry;
}

const has = (list, name) => { const n = name.toLowerCase(); return list.some(s => n.includes(s)); };
/**
 * How well an item suits a creature in a slot: 0 never, 1 fits its materials, 2 named for it (an Allow items entry, a family word
 * it shares, or a fitting item sharing a word with its name). Allow items entries win over family words. Family items only ever drop from their family, and drop from it even past its usual materials (a humanoid
 * race can drop parts named after it); denied items and hard-denied materials never.
 */
export function suitability(item, prof, slot, ctx = {}) {
  const isGear = isGearType(item.type);
  if ((slot === "gear") !== isGear) return 0;
  if (prof.denyItems.length && has(prof.denyItems, item.name)) return 0;
  const tags = item.tags ?? tagsFor(item.name, item.type);
  // Hard limits (a dragon never drops fur or insect parts) hold even for items named after the creature.
  if (!isGear && tags.some(t => prof.hardDeny.has(t))) return 0;
  if (prof.allowItems.length && has(prof.allowItems, item.name)) return 2;
  const fams = itemFamilies(item, ctx.worldFams);
  if (fams.length) return inFamily(fams, prof, ctx.creatureWords ?? new Set()) ? 2 : 0;
  // A fitting item that shares a word with the creature's name is preferred ("Ember" parts from an ember creature).
  const named = () => (item.words ?? words(item.name)).some(w => w.length > 3 && ctx.creatureWords?.has(w));
  if (isGear) return named() ? 2 : 1;
  if (tags.some(t => prof.deny.has(t))) return 0;
  if (!tags.every(t => prof.tags.has(t))) return 0;
  return tags.some(t => prof.core.has(t)) ? (named() ? 2 : 1) : 0;
}
/** Normalised words of a creature's name and subtype, minus words that say nothing about it. */
export const creatureWordsOf = (name, subtype = "") => new Set(words(`${name} ${subtype}`).filter(w => !FAMILY_STOP.has(w)));

// ---------------------------------------------------------------- CR → value
/**
 * CR bands: tune loot value here.
 *   cr     lowest CR in the band (a band runs up to the next band's cr)
 *   ilvl   item-level range for drops (gear and loot both; items with an "Item Level" in their description)
 *   value  vendor-price range in copper of the three-coin economy, used for items with no item level
 *   coin   coin range in copper (10000c = 1g in the three-coin economy); like item vendor prices, it's paid in copper in either economy
 *   drops  [min, max] passes over the creature's drop table (each pass rolls every slot's chance once)
 * Aimed at trash being roughly 10–15% of a party's income (party of four, ~40 kills per two levels, trash a few CR below the
 * party's level: levels 1–2 meet CR 0–1/2, 5–6 meet CR 2–3, 9–10 CR 5–7, 13–14 CR 9–12, 17–18 CR 15+) on a wealth curve of
 * about 1g per character by level 2, 3g by 4, 15g by 6, 30g by 8, 75g by 10, 200g by 12, 400g by 14, 600g by 16 and 1,200g by 18.
 * Coin carries most of the value; grey items sell for little. Dungeon scenes still multiply the coin and add rolls on top.
 */
export const CR_BANDS = [
  { cr: 0, label: "CR 0–1/4", ilvl: [1, 6], value: [1, 30], coin: [60, 320], drops: [1, 1] },
  { cr: 0.5, label: "CR 1/2–1", ilvl: [3, 10], value: [5, 100], coin: [150, 600], drops: [1, 1] },
  { cr: 2, label: "CR 2–4", ilvl: [7, 16], value: [20, 400], coin: [1000, 4000], drops: [1, 1] },
  { cr: 5, label: "CR 5–8", ilvl: [15, 28], value: [100, 1500], coin: [5000, 16000], drops: [1, 2] },
  { cr: 9, label: "CR 9–12", ilvl: [28, 42], value: [400, 4000], coin: [20000, 56000], drops: [1, 2] },
  { cr: 13, label: "CR 13–16", ilvl: [41, 55], value: [1000, 8000], coin: [30000, 70000], drops: [2, 2] },
  { cr: 17, label: "CR 17+", ilvl: [54, 63], value: [2000, 20000], coin: [60000, 170000], drops: [2, 3] }
];
/** Widening when a band has too few matching items: each step lowers the bottom by DOWN levels and raises the top by UP. */
export const WIDEN = { steps: 6, down: 6, up: 3, minPool: 3 };

export function bandFor(cr) {
  cr = Number(cr); if (!Number.isFinite(cr) || cr < 0) cr = 0;
  return [...CR_BANDS].reverse().find(b => cr >= b.cr) ?? CR_BANDS[0];
}
function inBand(item, band, w) {
  if (item.ilvl > 0) return item.ilvl >= band.ilvl[0] - w * WIDEN.down && item.ilvl <= band.ilvl[1] + w * WIDEN.up;
  if (item.copper != null) return item.copper >= band.value[0] / 2 ** (2 * w) && item.copper <= band.value[1] * 2 ** w;
  return true;
}

/**
 * Items a creature can drop in one slot at its band: { strong, normal, widen }. Only flavour-matching items are considered; the band is
 * widened step by step until at least WIDEN.minPool fit (never past WIDEN.steps). Family items are looked for at the widest band.
 */
export function candidates(items, prof, slot, band, ctx = {}) {
  const fit = []; for (const i of items) { const s = suitability(i, prof, slot, ctx); if (s) fit.push([i, s]); }
  let w = 0; let normal = [];
  for (; w <= WIDEN.steps; w++) { normal = fit.filter(([i]) => inBand(i, band, w)).map(([i]) => i); if (normal.length >= WIDEN.minPool) break; }
  w = Math.min(w, WIDEN.steps);
  const strong = fit.filter(([i, s]) => s === 2 && inBand(i, band, WIDEN.steps)).map(([i]) => i);
  return { strong, normal, widen: w, fit: fit.length };
}

/** Picks one item for a slot: family-named items first (75%), the creature's preferred tag next (60%), else any fitting item. */
export function pickFor(items, prof, slot, band, ctx = {}, rng = Math.random) {
  const { strong, normal } = candidates(items, prof, slot, band, ctx);
  const rand = a => a[Math.floor(rng() * a.length)];
  if (strong.length && (rng() < 0.75 || !normal.length)) return rand(strong);
  if (!normal.length) return null;
  if (prof.prefer && slot === "item") { const pref = normal.filter(i => i.tags?.includes(prof.prefer)); if (pref.length && rng() < 0.6) return rand(pref); }
  return rand(normal);
}

/** Coin for one creature in copper of the three-coin economy (0 when it carries none). */
export function coinRoll(prof, band, rng = Math.random) {
  if (!prof.coin || rng() >= prof.coin) return 0;
  const [lo, hi] = band.coin; return Math.round(lo + rng() * (hi - lo));
}

/** The slots one creature rolls: its kind's table, a gear slot if a rule allows gear, repeated for the band's number of passes. */
export function slotsFor(prof, band, extraPasses = 0, rng = Math.random) {
  const [a, b] = band.drops; const passes = a + Math.floor(rng() * (b - a + 1)) + extraPasses;
  const table = [...(KIND_SLOTS[prof.kind] ?? KIND_SLOTS.other)];
  if (prof.gear && !table.some(([, s]) => s === "gear")) table.push([0.2, "gear"]);
  return Array.from({ length: passes }, () => table).flat();
}

// ---------------------------------------------------------------- world rules
/**
 * Rows from the world's rules table, each [creature match, allow tags, allow items, deny items, family words] as cell text.
 * Lists are separated by commas or semicolons. Returns { rules, errors }; a bad row is skipped and described in `errors`.
 */
export function parseRules(rows = []) {
  const rules = []; const errors = [];
  const list = s => String(s ?? "").split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
  rows.forEach((cells, n) => {
    if (!Array.isArray(cells)) { errors.push(`row ${n + 1}: not a table row`); return; }
    const [match, tags, allow, deny, fams] = cells.map(c => String(c ?? "").trim());
    if (!match && !tags && !allow && !deny && !fams) return;
    if (!match) { errors.push(`row ${n + 1}: no creature to match`); return; }
    const allowTags = list(tags).map(t => t.toLowerCase());
    const bad = allowTags.filter(t => !ALL_TAGS.includes(t));
    if (bad.length) { errors.push(`row ${n + 1} (${match}): unknown tag${bad.length > 1 ? "s" : ""} ${bad.join(", ")}`); return; }
    rules.push({ match: match.toLowerCase(), allowTags, allowItems: list(allow).map(s => s.toLowerCase()), denyItems: list(deny).map(s => s.toLowerCase()), familyWords: list(fams).map(normWord).filter(Boolean) });
  });
  return { rules, errors };
}
