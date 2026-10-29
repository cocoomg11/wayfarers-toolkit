/**
 * Vendor Trash: drops grey "vendor trash" from defeated creatures, in the style of classic MMOs.
 * Beasts drop body parts, humanoids drop worn gear, trinkets and a little coin, undead drop bones and so on.
 * The items come from a compendium (the optional wow-classic-items module by default, if installed); this file holds only rules.
 */
const ID = "wayfarers-toolkit";
const WOW = "wow-classic-items";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Name keywords that sort junk into kinds. A creature also prefers junk that shares a word with its own name.
const KINDS = {
  beast: /\b(fang|fangs|claw|claws|tooth|teeth|tusk|tusks|hide|pelt|fur|furry|hair|feather|feathers|talon|talons|beak|wing|webbing|tail|paw|paws|scale|scales|horn|hoof|ear|eye|gland|venom|ichor|shell|carapace|chitin|mane|whisker|snout|flank|haunch|spinneret|stinger|egg|silk|trophy|antler|antlers|quill|quills|flipper|fin|blubber)\b/i,
  undead: /\b(bone|bones|skull|dust|ectoplasm|rotting|rotted|decaying|grave|ghostly|shroud|tomb|jawbone|femur|rib|soul)\b/i,
  elemental: /\b(elemental|stone|rock|ash|ashes|ember|cinder|crystal|essence|pitch|slag|sand|coal|magma|molten|glowing|charged|frost|frozen|static|mote)\b/i,
  plant: /\b(root|roots|lasher|vine|leaf|leaves|bark|seed|seeds|thorn|thorns|petal|petals|sap|moss|spore|spores|husk|bloom|lotus|blossom|seaweed|kelp|mushroom|fungus)\b/i,
  trinket: /\b(watch|bauble|pipe|coin|coins|diary|page|locket|trinket|candle|sack|pouch|dice|flask|bottle|letter|pendant|ring|necklace|figurine|idol|key|token|charm|cup|mug|comb|mirror|spoon|broken|chipped|cracked|ruined|bent|torn|tattered|worn|damaged)\b/i
};
// Words in a creature's name that mark it as a beast when its sheet has no creature type.
const BEAST_NAMES = /\b(wolf|wolves|worg|boar|bear|spider|tarantula|raptor|crocolisk|croc|vulture|buzzard|cat|panther|lion|prowler|stalker|stag|deer|owl|bat|scorpid|scorpion|basilisk|kodo|hyena|crab|turtle|snake|serpent|python|gorilla|ape|hawk|eagle|rat|boar|stag|mare|horse|ox|yeti|condor|wyvern|hydra|thresher|shark|lizard|gator)\b/i;
const UNDEAD_NAMES = /\b(skeleton|zombie|ghoul|ghost|spirit|wraith|lich|banshee|abomination|mummy|wight|shade|undead|risen|forsaken|scourge)\b/i;
const ELEMENTAL_NAMES = /\b(elemental|golem|construct|harvester|watcher|shredder|gargoyle|imp|fire|flame|earth|stone|water|air|storm|magma|living)\b/i;
const WHELP_NAMES = /\b(whelp|drake|dragon|dragonkin|wyrm)\b/i;

/** Creature kind from the dnd5e creature type, falling back to the name. */
export function creatureKind(actor) {
  const t = String(actor?.system?.details?.type?.value ?? "").toLowerCase();
  const n = actor?.name ?? "";
  if (["beast", "monstrosity"].includes(t)) return "beast";
  if (t === "dragon") return "dragon";
  if (["humanoid", "giant"].includes(t)) return "humanoid";
  if (t === "undead") return "undead";
  if (["elemental", "construct"].includes(t)) return "elemental";
  if (["plant", "fey"].includes(t)) return "plant";
  if (t) return "other";
  if (WHELP_NAMES.test(n)) return "dragon";
  if (UNDEAD_NAMES.test(n)) return "undead";
  if (BEAST_NAMES.test(n)) return "beast";
  if (ELEMENTAL_NAMES.test(n) && !/\b(bandit|guard|deputy|mage|priest)\b/i.test(n)) return "elemental";
  return "humanoid";
}

/** MMO-style level for a challenge rating: CR 1 ≈ level 4, CR 5 ≈ level 17, CR 10 ≈ level 34, CR 18 ≈ level 60. */
export const wowLevel = cr => Math.max(1, Math.min(63, Math.round((+cr || 0) * 3.3) + 1));

/** Copper a humanoid carries, roughly like classic-MMO mob drops: level 10 ≈ 25c, 20 ≈ 85c, 40 ≈ 3s, 60 ≈ 6s (±50%). */
export const coinFor = cr => Math.round(Math.pow(wowLevel(cr), 1.8) * 0.4 * (0.5 + Math.random()));

const rand = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;

/** The trash pool: every grey item in the configured compendiums, indexed once per session on first use (a promise, so calls made
 * while the index is loading share one scan). */
let POOL = null;
export function packIds() {
  const set = String(game.settings.get(ID, "trashPacks") || "").split(/[,\s]+/).filter(Boolean);
  if (set.length) return set;
  return game.packs.get(`${WOW}.items`) ? [`${WOW}.items`] : [];
}
export function pool() {
  POOL ??= buildPool().catch(e => { POOL = null; throw e; });
  return POOL;
}
async function buildPool() {
  const items = [];
  for (const pid of packIds()) {
    const pack = game.packs.get(pid); if (!pack || pack.documentName !== "Item") continue;
    const idx = await pack.getIndex({ fields: ["system.description.value", "system.price", "system.rarity", `flags.${WOW}.vendorPrice`] });
    for (const e of idx) {
      const desc = e.system?.description?.value ?? "";
      const wowGrey = /color:#9d9d9d;font-size:1\.08em/.test(desc);
      const generic = !pack.collection.startsWith(`${WOW}.`) && e.type === "loot" && !e.system?.rarity;
      if (!wowGrey && !generic) continue;
      const vp = e.flags?.[WOW]?.vendorPrice?.totalCopper;
      const ilvl = +((desc.match(/Item Level (\d+)/) || [])[1] || 0);
      const junk = e.type === "loot";
      const kind = junk ? (Object.keys(KINDS).find(k => KINDS[k].test(e.name)) ?? "misc") : "gear";
      items.push({ uuid: e.uuid, name: e.name, img: e.img, type: e.type, ilvl, kind, copper: vp ?? null, price: e.system?.price ?? null });
    }
  }
  return items;
}
export function resetPool() { POOL = null; }

/** Picks one piece of junk of the given kinds, preferring items that share a word with the creature's name. */
function pickJunk(items, kinds, creatureName) {
  const cands = items.filter(i => kinds.includes(i.kind));
  if (!cands.length) return null;
  const words = (creatureName.match(/[A-Za-z']{3,}/g) ?? []).map(w => w.toLowerCase().replace(/s$/, "")).filter(w => !["young", "elder", "old", "large", "small", "giant", "greater", "lesser", "the", "and", "chief", "leader"].includes(w));
  const named = cands.filter(i => words.some(w => i.name.toLowerCase().includes(w)));
  return named.length && chance(0.75) ? rand(named) : rand(cands);
}
function pickGear(items, cr) {
  const lv = wowLevel(cr);
  let cands = items.filter(i => i.kind === "gear" && i.ilvl >= lv - 4 && i.ilvl <= lv + 4);
  if (!cands.length) cands = items.filter(i => i.kind === "gear" && Math.abs(i.ilvl - lv) <= 10);
  return cands.length ? rand(cands) : null;
}

/** Rolls the drop for one creature: { items: [poolEntry], copper }. */
export async function rollDrop(actor) {
  const items = await pool(); const kind = creatureKind(actor); const cr = actor?.system?.details?.cr ?? 0; const name = actor?.name ?? "";
  const out = []; let copper = 0;
  const add = x => { if (x) out.push(x); };
  switch (kind) {
    case "beast":
      if (chance(0.7)) add(pickJunk(items, ["beast"], name));
      if (chance(0.15)) add(pickJunk(items, ["beast"], name));
      break;
    case "dragon":
      add(pickJunk(items, ["beast"], name.match(/dragon|drake|whelp/i) ? "Dragon Scale" : name));
      if (chance(0.3)) add(pickJunk(items, ["beast", "elemental"], name));
      break;
    case "humanoid":
      if (chance(0.75)) copper = coinFor(cr);
      if (chance(0.5)) add(pickJunk(items, chance(0.7) ? ["trinket"] : ["trinket", "misc"], name));
      if (chance(0.35)) add(pickGear(items, cr));
      break;
    case "undead":
      if (chance(0.6)) add(pickJunk(items, ["undead"], name));
      if (chance(0.2)) add(pickGear(items, cr));
      if (chance(0.25)) copper = coinFor(cr);
      break;
    case "elemental":
      if (chance(0.6)) add(pickJunk(items, ["elemental"], name));
      break;
    case "plant":
      if (chance(0.6)) add(pickJunk(items, ["plant"], name));
      break;
    default:
      if (chance(0.5)) add(pickJunk(items, ["beast", "undead", "elemental", "plant", "misc"], name));
  }
  return { items: out, copper, kind };
}

/** Value of a pool entry in the smallest coin: its vendor sell price if it has one, else the item's own price. */
export function valueOf(entry, api) {
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  if (entry.copper != null) return entry.copper * cpVal;
  const p = entry.price; if (!p?.value) return 0;
  return api.parseMoney(`${p.value} ${p.denomination || "gp"}`);
}

/** Item Piles' API when it's active and set up for the game system (it needs a system integration, such as Item Piles: D&D 5e, to know item quantities and coins). */
export function itemPiles() {
  if (!game.modules.get("item-piles")?.active) return null;
  const IP = game.itempiles?.API;
  return IP?.turnTokensIntoItemPiles && IP.ITEM_QUANTITY_ATTRIBUTE ? IP : null;
}
/** True when Vendor Trash should put loot on the creatures as Item Piles. */
export function usePiles() {
  try { return !!game.settings.get(ID, "trashItemPiles") && !!itemPiles(); } catch { return !!itemPiles(); }
}

/** Item data for one trash drop: copied from the compendium, priced at its vendor value in copper, flagged for Sell Vendor Trash. */
async function trashItemData(uuid, value, cpVal) {
  const src = await fromUuid(uuid); if (!src) return null;
  const o = src.toObject(); delete o._id;
  o.system.quantity = 1;
  o.system.price = { value: Math.max(0, Math.round(value / cpVal)), denomination: "cp" };
  o.flags = foundry.utils.mergeObject(o.flags ?? {}, { [ID]: { trash: true, source: uuid } });
  return o;
}

const tokenDoc = t => t?.document ?? t;
/** Flags tokens as looted: one update per scene instead of one per token. */
async function markLooted(docs) {
  const byScene = new Map();
  for (const d of docs) { if (!d.parent) continue; if (!byScene.has(d.parent)) byScene.set(d.parent, []); byScene.get(d.parent).push({ _id: d.id, [`flags.${ID}.looted`]: true }); }
  for (const [scene, updates] of byScene) await scene.updateEmbeddedDocuments("Token", updates);
}
const lootable = doc => doc?.actor && !["character", "group"].includes(doc.actor.type);

/** Selected tokens → loot. With Item Piles, each creature becomes a lootable pile; otherwise the GM gets a card with a Give to Party button. */
export async function vendorTrash(api, tokens = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (!packIds().length) return ui.notifications.warn("Vendor Trash: no item compendium set. Install the wow-classic-items module or set Vendor trash compendiums in the module settings.");
  tokens ??= canvas.tokens.controlled.length ? canvas.tokens.controlled : [...game.user.targets];
  if (!tokens.length) return ui.notifications.warn("Vendor Trash: select (or target) the defeated creatures first.");
  if (!(await pool()).length) return ui.notifications.warn("Vendor Trash: no grey items found in the configured compendiums.");
  let wantPiles = true; try { wantPiles = game.settings.get(ID, "trashItemPiles"); } catch { }
  if (wantPiles && game.modules.get("item-piles")?.active && !itemPiles()) ui.notifications.warn("Vendor Trash: Item Piles isn't set up for this game system yet (for dnd5e, install and enable Item Piles: D&D 5e). Using the Give to Party card instead.");
  return usePiles() ? lootPiles(tokens.map(tokenDoc), api) : lootCard(tokens.map(tokenDoc), api);
}

/** The original flow: a GM loot card with a Give to Party button. */
async function lootCard(docs, api) {
  const rows = []; const drops = []; let total = 0; let coinTotal = 0; const skipped = [];
  const todo = docs.filter(lootable).filter(doc => !(doc.getFlag(ID, "looted") && skipped.push(doc.name)));
  await markLooted(todo);
  for (const doc of todo) {
    const d = await rollDrop(doc.actor);
    const parts = d.items.map(i => { const v = valueOf(i, api); total += v; drops.push({ uuid: i.uuid, value: v }); return `@UUID[${i.uuid}]{${esc(i.name)}} <span class="wct-val">(${api.fmtMoney(v)})</span>`; });
    if (d.copper) { const v = d.copper * (Object.fromEntries(api.coins()).cp ?? 1); coinTotal += v; parts.push(`<em>${api.fmtMoney(v)}</em>`); }
    rows.push(`<li><strong>${esc(doc.name)}</strong>: ${parts.length ? parts.join(", ") : "<span class=\"hint\">nothing</span>"}</li>`);
  }
  if (!rows.length) return ui.notifications.info(`Vendor Trash: ${skipped.length ? `already looted (${skipped.join(", ")})` : "no creatures selected"}.`);
  const content = `<h3>Vendor Trash</h3><ul>${rows.join("")}</ul>${skipped.length ? `<p class="hint">Already looted: ${skipped.map(esc).join(", ")}.</p>` : ""}<p>Coin ${api.fmtMoney(coinTotal)} · trash worth ${api.fmtMoney(total)} at a vendor.</p>${drops.length || coinTotal ? `<button type="button" data-wct-action="give-trash"><i class="fas fa-sack"></i> Give to Party</button>` : ""}`;
  return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Vendor Trash" }, flags: { [ID]: { trash: { drops, coin: coinTotal, given: false } } } });
}

/**
 * Item Piles flow: the drop goes onto each creature's own actor (for an unlinked token that's the token's synthetic actor, so the
 * world actor is untouched) and the token becomes a lootable pile that keeps its image. The creature's own gear and features stay
 * hidden from the pile, so players only see the trash and coin. Creatures that dropped nothing are left alone.
 */
async function lootPiles(docs, api) {
  const IP = itemPiles(); const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  const rows = []; const skipped = []; const empty = []; let total = 0; let coinTotal = 0; let piles = 0;
  const todo = docs.filter(lootable).filter(doc => !((doc.getFlag(ID, "looted") || IP.isValidItemPile(doc)) && skipped.push(doc.name)));
  await markLooted(todo);
  for (const doc of todo) {
    const actor = doc.actor;
    const d = await rollDrop(actor);
    const own = actor.items.map(i => i.id);
    const create = []; const parts = [];
    for (const i of d.items) {
      const v = valueOf(i, api);
      const same = create.find(o => o.flags[ID].source === i.uuid);
      if (same) same.system.quantity += 1;
      else { const o = await trashItemData(i.uuid, v, cpVal); if (!o) continue; create.push(o); }
      total += v; parts.push(`@UUID[${i.uuid}]{${esc(i.name)}} <span class="wct-val">(${api.fmtMoney(v)})</span>`);
    }
    if (!create.length && !d.copper) { empty.push(doc.name); continue; }
    if (create.length) await actor.createEmbeddedDocuments("Item", create);
    if (d.copper) {
      await api.addMoney(actor, d.copper * cpVal, { consolidate: true });
      const v = d.copper * cpVal; coinTotal += v; parts.push(`<em>${api.fmtMoney(v)}</em>`);
    }
    const filters = [...(IP.ITEM_FILTERS ?? [])]; if (own.length) filters.push({ path: "_id", filters: own });
    await IP.turnTokensIntoItemPiles(doc, { pileSettings: { type: "pile", overrideItemFilters: filters } });
    piles++;
    rows.push(`<li><strong>${esc(doc.name)}</strong>: ${parts.join(", ")}</li>`);
  }
  if (!rows.length && !empty.length) return ui.notifications.info(`Vendor Trash: ${skipped.length ? `already looted (${skipped.join(", ")})` : "no creatures selected"}.`);
  const content = `<h3>Vendor Trash</h3>${rows.length ? `<ul>${rows.join("")}</ul>` : ""}${empty.length ? `<p class="hint">Nothing on: ${empty.map(esc).join(", ")}.</p>` : ""}${skipped.length ? `<p class="hint">Already looted: ${skipped.map(esc).join(", ")}.</p>` : ""}<p>${piles} ${piles === 1 ? "body is" : "bodies are"} ready to loot. Coin ${api.fmtMoney(coinTotal)} · trash worth ${api.fmtMoney(total)} at a vendor.</p>`;
  return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Vendor Trash" }, flags: { [ID]: { trash: { piles: true, coin: coinTotal, value: total } } } });
}

/** Gives a loot card's items and coin to the party actor. Trash items are priced at their vendor value and flagged for Sell Trash. */
export async function giveTrash(message, api) {
  const data = message.getFlag(ID, "trash"); if (!data || data.given || !data.drops) return ui.notifications.info("Already given.");
  const party = api.partyActor(); if (!party) return ui.notifications.warn(`No group actor named ${api.PARTY}.`);
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  // Repeats of one item stack: existing stacks go up in one update, new items are created in one go.
  const counts = new Map(); for (const d of data.drops) { const e = counts.get(d.uuid); if (e) e.n++; else counts.set(d.uuid, { d, n: 1 }); }
  const updates = []; const docs = [];
  for (const { d, n } of counts.values()) {
    const existing = party.items.find(i => i.getFlag(ID, "trash") && i.getFlag(ID, "source") === d.uuid);
    if (existing) { updates.push({ _id: existing.id, "system.quantity": (existing.system.quantity || 1) + n }); continue; }
    const o = await trashItemData(d.uuid, d.value, cpVal); if (o) { o.system.quantity = n; docs.push(o); }
  }
  if (updates.length) await party.updateEmbeddedDocuments("Item", updates);
  if (docs.length) await party.createEmbeddedDocuments("Item", docs);
  if (data.coin) await api.addMoney(party, Math.round(data.coin / cpVal) * cpVal, { consolidate: true });
  await message.setFlag(ID, "trash", { ...data, given: true });
  ui.notifications.info(`Vendor Trash: gave ${data.drops.length} item${data.drops.length === 1 ? "" : "s"}${data.coin ? ` and ${api.fmtMoney(data.coin)}` : ""} to ${party.name}.`);
}

/** Actors holding vendor trash: the party actor and any player characters. */
export function trashHolders(api) {
  const party = api.partyActor();
  return [party, ...game.actors.filter(a => a.type === "character")].filter(a => a?.items?.some(i => i.getFlag(ID, "trash")));
}

/** Sells every trash item one actor holds at its vendor price; the coin goes to that actor. The GM picks whose trash when several hold some. */
export async function sellTrash(api, actor = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  const trashOf = a => a.items.filter(i => i.getFlag(ID, "trash"));
  const worth = a => trashOf(a).reduce((t, i) => t + Math.round((i.system.price?.value || 0) * (i.system.quantity || 1)) * cpVal, 0);
  const party = api.partyActor();
  if (!actor) {
    const holders = trashHolders(api);
    if (!holders.length) return ui.notifications.info(`Nobody has vendor trash to sell${party ? "" : ` (and there's no group actor named ${api.PARTY})`}.`);
    actor = holders[0];
    if (holders.length > 1) {
      const sel = canvas.tokens?.controlled?.map(t => t.actor).find(a => holders.includes(a));
      const def = sel ?? (holders.includes(party) ? party : holders[0]);
      const opts = holders.map(a => api.opt(a.id, `${a.name}: ${trashOf(a).length} item${trashOf(a).length === 1 ? "" : "s"}, ${api.fmtMoney(worth(a))}`, a === def)).join("");
      const f = await api.form("Sell Vendor Trash", `<div class="form-group"><label>Whose trash</label><select name="actor">${opts}</select></div><p class="hint">The coin goes to the same actor.</p>`, "Next");
      if (!f) return;
      actor = game.actors.get(f.actor); if (!actor) return;
    }
  }
  const trash = trashOf(actor);
  if (!trash.length) return ui.notifications.info(`${actor.name} has no vendor trash to sell.`);
  const each = trash.map(i => ({ i, v: Math.round((i.system.price?.value || 0) * (i.system.quantity || 1)) * cpVal }));
  const total = each.reduce((a, x) => a + x.v, 0);
  const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Sell Vendor Trash" }, content: `<p><strong>${esc(actor.name)}</strong></p><ul>${each.map(x => `<li>${esc(x.i.name)}${x.i.system.quantity > 1 ? ` ×${x.i.system.quantity}` : ""}: ${api.fmtMoney(x.v)}</li>`).join("")}</ul><p>Sell all for <strong>${api.fmtMoney(total)}</strong>?</p>`, rejectClose: false });
  if (!ok) return;
  await actor.deleteEmbeddedDocuments("Item", trash.map(i => i.id));
  await api.addMoney(actor, Math.round(total / cpVal) * cpVal, { consolidate: true });
  await api.say(`<p>${actor === party ? "The party sells its" : `${esc(actor.name)} sells their`} vendor trash for ${api.fmtMoney(total)}.</p>`, "Vendor");
  return total;
}
