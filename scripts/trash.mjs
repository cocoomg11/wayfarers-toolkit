/**
 * Vendor Trash: drops grey "vendor trash" from defeated creatures, in the style of classic MMOs.
 * Beasts drop body parts, humanoids drop worn gear, trinkets and a little coin, undead drop bones and so on.
 * The items come from a compendium (the optional wow-classic-items module by default, if installed); this file holds only rules.
 */
const ID = "wayfarers-toolkit";
const WOW = "wow-classic-items";
import * as R from "./trash-rules.mjs";
import { on as featureOn } from "./features.mjs";
/** The flavour rules and CR bands (trash-rules.mjs), for macros and tuning. */
export const rules = R;
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// What may drop from what, the CR bands and the world rules format live in trash-rules.mjs.

/** Creature kind (beast, dragon, humanoid, undead, elemental, plant, ooze, other) from the dnd5e creature type, falling back to the name. */
export function creatureKind(actor) { return R.profileFor(creatureInfo(actor)).kind; }
const creatureInfo = actor => ({ name: actor?.name ?? "", type: actor?.system?.details?.type?.value ?? "", subtype: actor?.system?.details?.type?.subtype ?? "" });

/** MMO-style level for a challenge rating: CR 1 ≈ level 4, CR 5 ≈ level 17, CR 10 ≈ level 34, CR 18 ≈ level 60. */
export const wowLevel = cr => Math.max(1, Math.min(63, Math.round((+cr || 0) * 3.3) + 1));
/** Coin (in copper) a creature of this CR carries when it carries any: a random amount in its CR band. */
export const coinFor = cr => { const [lo, hi] = R.bandFor(cr).coin; return Math.round(lo + Math.random() * (hi - lo)); };

const chance = p => Math.random() < p;

/** The trash pool: every grey item in the configured compendiums, indexed once per session on first use (a promise, so calls made
 * while the index is loading share one scan). Each entry carries its material tags (trash-rules.mjs). */
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
      items.push(R.classifyItem({ uuid: e.uuid, name: e.name, img: e.img, type: e.type, ilvl, copper: vp ?? null, price: e.system?.price ?? null }));
    }
  }
  console.log(`${ID} | Vendor Trash pool: ${items.length} items from ${packIds().join(", ") || "no compendium"}`);
  return items;
}
export function resetPool() { POOL = null; }

// ---------------------------------------------------------------- world rules and family words
export const RULES_PAGE = "Vendor Trash Rules";
/** The rules page's starting content, created by Run setup in the tracker journal. */
export const RULES_PAGE_HTML = `<h2>Vendor Trash Rules</h2><p>Extra drop rules for this world. Each row applies to every creature whose name, type or subtype contains <em>Creature match</em> (not case-sensitive; <strong>*</strong> matches every creature). Separate list entries with commas.</p><ul><li><strong>Allow tags</strong>: materials the creature may also drop: ${R.ALL_TAGS.join(", ")}. <em>gear</em> lets it drop worn weapons and armour, <em>coin</em> makes it carry coin.</li><li><strong>Allow items</strong>: parts of item names it always may drop (and prefers).</li><li><strong>Deny items</strong>: parts of item names it never drops.</li><li><strong>Family words</strong>: words that tie items to this creature: an item with that word in its name only drops from creatures with a row (or name) carrying it.</li></ul><p>Rows with an unknown tag or no creature are skipped and the GM is warned. Delete the example rows if you don't want them.</p><table><thead><tr><th>Creature match</th><th>Allow tags</th><th>Allow items</th><th>Deny items</th><th>Family words</th></tr></thead><tbody><tr><td>ember</td><td>elemental</td><td></td><td></td><td></td></tr><tr><td>swamp</td><td>plant</td><td></td><td></td><td></td></tr></tbody></table>`;

let RULES = null; let FAMS = null;
/** Forgets the parsed rules page (re-read on the next roll). */
export function resetRules() { RULES = null; FAMS = null; }
/** Forgets the world's family words (creature names changed). */
export function resetFamilies() { FAMS = null; }
function rulesPage() {
  let name; try { name = game.settings.get(ID, "trackerJournal"); } catch { return null; }
  return game.journal.getName(name)?.pages.getName(RULES_PAGE) ?? null;
}
/** The world's rules, parsed from the rules page's first table. Bad rows are skipped with a GM warning. */
export function worldRules() {
  if (RULES) return RULES;
  const page = rulesPage(); let rows = [];
  if (page) {
    try {
      const t = new DOMParser().parseFromString(page.text?.content || "", "text/html").querySelector("table");
      rows = t ? [...t.querySelectorAll("tr")].filter(tr => !tr.querySelector("th")).map(tr => [...tr.children].map(td => td.textContent.trim()))
        .filter(r => !/^creature match$/i.test(r[0] ?? "")) : [];
    } catch (e) { console.warn(`${ID} | couldn't read ${RULES_PAGE}`, e); }
  }
  const { rules, errors } = R.parseRules(rows);
  if (errors.length) {
    console.warn(`${ID} | ${RULES_PAGE}: skipped ${errors.join("; ")}`);
    if (game.user?.isGM) ui.notifications.warn(`Vendor Trash: skipped ${errors.length} row${errors.length === 1 ? "" : "s"} of ${RULES_PAGE} (${errors.join("; ")}).`);
  }
  return RULES = rules;
}
/** Family words: the first word of every NPC name in the world plus the rules page's Family words. */
export function worldFamilies() {
  FAMS ??= R.familyWordsFrom(game.actors.filter(a => a.type === "npc").map(a => a.name), worldRules().flatMap(r => r.familyWords));
  return FAMS;
}
/** Loot profile, CR band and matching context for one creature. */
function context(actor) {
  const info = creatureInfo(actor); const cr = actor?.system?.details?.cr ?? 0;
  return { prof: R.profileFor(info, worldRules()), band: R.bandFor(cr), cr, ctx: { worldFams: worldFamilies(), creatureWords: R.creatureWordsOf(info.name, info.subtype) } };
}

// ---------------------------------------------------------------- dungeons
/** True when the token stands on a scene marked as a dungeon (scene flag `flags.wayfarers-toolkit.dungeon`). */
export const isDungeon = doc => !!(doc?.parent?.getFlag?.(ID, "dungeon"));
/** Dungeon rules from the world settings: coin multiplier, extra item-drop chance (0–1) and whether item drops roll twice. */
export function dungeonRules() {
  const get = (k, d) => { try { const v = game.settings.get(ID, k); return v ?? d; } catch { return d; } };
  const mult = +get("dungeonCoinMult", 2); const bonus = +get("dungeonDropBonus", 25);
  return { coinMult: Number.isFinite(mult) && mult >= 0 ? mult : 2, dropBonus: Math.max(0, Math.min(100, Number.isFinite(bonus) ? bonus : 25)) / 100, extraRoll: !!get("dungeonExtraRoll", true) };
}
/** Scene configuration (ApplicationV2): adds the Dungeon checkbox to the Basics tab. Foundry saves it with the rest of the form. */
export function addDungeonField(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0]; const scene = app?.document; if (!root || !scene) return;
  if (root.querySelector(`input[name="flags.${ID}.dungeon"]`)) return;
  const tab = root.querySelector('.tab[data-tab="basics"]') ?? root.querySelector('.tab[data-tab="ambience"]'); if (!tab) return;
  const group = document.createElement("div"); group.className = "form-group";
  group.innerHTML = `<label for="${app.id}-wct-dungeon">Dungeon</label><div class="form-fields"><input type="checkbox" id="${app.id}-wct-dungeon" name="flags.${ID}.dungeon" ${scene.getFlag(ID, "dungeon") ? "checked" : ""}></div><p class="hint">Vendor Trash: creatures defeated on this scene drop more coin and items (see the Dungeon settings of Wayfarer's Toolkit).</p>`;
  tab.append(group);
}

/**
 * Rolls the drop for one creature: { items: [poolEntry], copper, kind, band, dungeon }. The creature's CR band sets how many times its
 * drop table is rolled, the item level of what drops and its coin; its profile (trash-rules.mjs) decides which items fit. With `dungeon`,
 * coin is multiplied, every item-drop chance gets the dungeon bonus (capped at 100%) and, if set, the drop table is rolled twice as often.
 */
export async function rollDrop(actor, { dungeon = false } = {}) {
  const items = await pool(); const { prof, band, ctx } = context(actor);
  const rules = dungeon ? dungeonRules() : null;
  const ic = rules ? p => chance(Math.min(1, p + rules.dropBonus)) : chance;
  let slots = R.slotsFor(prof, band); if (rules?.extraRoll) slots = [...slots, ...slots];
  const out = [];
  for (const [p, slot] of slots) { if (!ic(p)) continue; const it = R.pickFor(items, prof, slot, band, ctx); if (it) out.push(it); }
  let copper = R.coinRoll(prof, band);
  if (rules && copper) copper = Math.round(copper * rules.coinMult);
  return { items: out, copper, kind: prof.kind, band: band.label, dungeon: !!rules };
}

/** What a creature could drop, for checking a world's flavour rules: profile, band and a sample of up to `n` items per slot. */
export async function preview(target, n = 20) {
  const doc = tokenDoc(target); const actor = doc?.actor ?? target; if (!actor) return null;
  const items = await pool(); const { prof, band, ctx } = context(actor);
  const sample = list => [...list].sort(() => Math.random() - 0.5).slice(0, n).map(i => `${i.name}${i.ilvl ? ` (ilvl ${i.ilvl})` : ""}`);
  const it = R.candidates(items, prof, "item", band, ctx); const gear = R.candidates(items, prof, "gear", band, ctx);
  const out = {
    creature: actor.name, kind: prof.kind, tags: [...prof.tags], deny: [...prof.deny], groups: prof.groups, rules: prof.rules, band: band.label,
    pool: items.length, items: { named: sample(it.strong), fitting: sample(it.normal), count: it.normal.length, widened: it.widen },
    gear: prof.gear ? { fitting: sample(gear.normal), count: gear.normal.length, widened: gear.widen } : null,
    coin: prof.coin ? `${Math.round(prof.coin * 100)}% chance of ${band.coin[0]}–${band.coin[1]} copper` : "none"
  };
  console.log(`${ID} | Vendor Trash preview for ${actor.name}: ${it.normal.length} fitting items (${it.strong.length} named for it) out of ${items.length} in the pool`, out);
  return out;
}

/**
 * GM: whispers one compact preview card per selected (or given) token: kind, CR band, materials allowed and denied, matched rules,
 * pool size and band widening, the token's current pre-rolled drop and coin (or "looted"), a sample of possible drops and the coin odds.
 */
export async function showPreview(api, tokens = null, n = 12) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  tokens ??= canvas.tokens?.controlled?.length ? canvas.tokens.controlled : [...game.user.targets];
  const docs = tokens.map(tokenDoc).filter(d => d?.actor);
  if (!docs.length) return ui.notifications.warn("Vendor Trash: select (or target) a token to preview.");
  if (!packIds().length) return ui.notifications.warn("Vendor Trash: no item compendium set. Install the wow-classic-items module or set Vendor trash compendiums in the module settings.");
  const items = await pool(); const cpVal = Object.fromEntries(api.coins()).cp ?? 1; const money = c => api.fmtMoney(c * cpVal);
  const list = (arr, empty = "none") => arr.length ? arr.map(esc).join(", ") : `<span class="hint">${empty}</span>`;
  const fold = (label, rows) => rows.length ? `<details><summary>${label}</summary><ul style="margin:0.2em 0;padding-left:1.2em;">${rows.join("")}</ul></details>` : `<p class="hint">${label}</p>`;
  const sampleRows = arr => [...arr].sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => (a.ilvl || 0) - (b.ilvl || 0))
    .map(i => `<li>${esc(i.name)} <span class="hint">(${[i.ilvl ? `ilvl ${i.ilvl}` : "", api.fmtMoney(valueOf(i, api))].filter(Boolean).join(", ")})</span></li>`);
  const out = [];
  for (const doc of docs) {
    const actor = doc.actor; const { prof, band, cr, ctx } = context(actor); const dungeon = isDungeon(doc); const dr = dungeon ? dungeonRules() : null;
    const it = R.candidates(items, prof, "item", band, ctx); const gear = prof.gear ? R.candidates(items, prof, "gear", band, ctx) : null;
    const widen = c => c.widen ? `widened ${c.widen} step${c.widen === 1 ? "" : "s"}` : "no widening";
    // The token's current drop.
    let current;
    if (doc.getFlag(ID, "looted") || isPile(doc)) current = "<em>looted</em>";
    else {
      const f = rolled(doc); const held = trashItems(actor);
      if (!f && !held.length) current = `<span class="hint">${doc.actorLink ? "linked token: rolled when looted" : "not rolled yet"}</span>`;
      else {
        const parts = held.map(i => `${esc(i.name)}${i.system.quantity > 1 ? ` ×${i.system.quantity}` : ""} <span class="hint">(${api.fmtMoney((i.getFlag(ID, "value") ?? 0) * (i.system.quantity || 1))})</span>`);
        if (f?.copper) parts.push(`<em>${money(f.copper)}</em>`);
        current = parts.length ? parts.join(", ") : `<span class="hint">nothing</span>`;
      }
    }
    const coinMult = dr && dr.coinMult !== 1 ? ` ×${dr.coinMult} (dungeon)` : "";
    const coin = prof.coin ? `${Math.round(prof.coin * 100)}% chance of ${money(band.coin[0])}–${money(band.coin[1])}${coinMult}` : "none";
    out.push(await ChatMessage.create({
      whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Vendor Trash" },
      content: `<h3>Preview: ${esc(doc.name)}${dungeon ? DUNGEON_TAG : ""}</h3>
<p><strong>${esc(prof.kind)}</strong> · CR ${esc(cr)} (${esc(band.label)}, ilvl ${band.ilvl[0]}–${band.ilvl[1]})</p>
<p><strong>Allowed:</strong> ${list([...prof.tags])}<br><strong>Denied:</strong> ${list([...prof.deny])}${prof.gear ? "<br>Drops worn gear" : ""}</p>
<p><strong>Rules matched:</strong> ${list(prof.rules.map(r => r === "*" ? "* (all)" : r))}</p>
<p><strong>Pool:</strong> ${items.length} items · ${it.normal.length} fit (${it.strong.length} named for it), ${widen(it)}${gear ? ` · gear ${gear.normal.length}, ${widen(gear)}` : ""}</p>
<p><strong>Current drop:</strong> ${current}</p>
${fold(`Possible drops (${Math.min(n, it.normal.length)} of ${it.normal.length})`, sampleRows(it.normal))}
${it.strong.length ? fold(`Named for it (${Math.min(n, it.strong.length)} of ${it.strong.length})`, sampleRows(it.strong)) : ""}
${gear ? fold(`Gear (${Math.min(n, gear.normal.length)} of ${gear.normal.length})`, sampleRows(gear.normal)) : ""}
<p><strong>Coin:</strong> ${coin}</p>`
    }));
  }
  return out;
}

const DUNGEON_TAG = `<span class="wct-dungeon-tag" style="font-size:0.75em;font-weight:normal;padding:0 0.4em;margin-left:0.3em;border:1px solid currentColor;border-radius:3px;vertical-align:middle;" title="Dungeon scene: more coin and items">Dungeon</span>`;

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

// ---------------------------------------------------------------- pre-rolled loot
/**
 * Pre-rolled drops: when an NPC token is placed, its drop is rolled straight away and put on the token's own actor (items flagged as
 * trash) with the coin kept in the token flag `flags.wayfarers-toolkit.trashRolled` ({ id, copper, band, dungeon }). Players can't open
 * an NPC's inventory, so nothing shows until the body becomes lootable. `id` is the token the roll was made for: a copied or pasted
 * token carries its source's flag and items, sees a different id, and rolls fresh.
 */
const S = (k, d) => { try { return game.settings.get(ID, k) ?? d; } catch { return d; } };
export const isPile = doc => !!(itemPiles()?.isValidItemPile?.(doc) || doc?.flags?.["item-piles"]?.data?.enabled || doc?.actor?.flags?.["item-piles"]?.data?.enabled);
/** An unlinked NPC token that can carry pre-rolled loot. */
export const autoTarget = doc => !!doc?.actor && doc.actor.type === "npc" && !doc.actorLink && !doc.getFlag(ID, "looted") && !isPile(doc);
const rolled = doc => { const f = doc?.getFlag?.(ID, "trashRolled"); return f && f.id === doc.id ? f : null; };
const trashItems = actor => actor?.items?.filter(i => i.getFlag(ID, "trash")) ?? [];
/** Items Boss loot put on a body (item flag `bossLoot`). */
const bossItems = actor => actor?.items?.filter(i => i.getFlag(ID, "bossLoot")) ?? [];
/** Loot items a pile shows: vendor trash and boss loot. Everything else the creature carries stays hidden. */
const isLootItem = i => !!(i.getFlag(ID, "trash") || i.getFlag(ID, "bossLoot"));

/** Runs async work for one key (a token UUID) one job at a time, so Vendor Trash and Boss loot don't build the same pile at once. */
const chains = new Map();
export function serial(key, fn) {
  const next = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
  const tail = next.catch(() => {}); chains.set(key, tail);
  tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return next;
}

/**
 * Makes a token a lootable Item Piles pile that shows only loot items (trash and boss loot) and coin, or, when it already is one,
 * refreshes its item filters so loot added since shows too. Shared by Vendor Trash and Boss loot.
 */
export async function pileUp(doc, IP = itemPiles()) {
  const actor = doc.actor;
  const own = actor.items.filter(i => !isLootItem(i)).map(i => i.id);
  const filters = [...(IP.ITEM_FILTERS ?? [])]; if (own.length) filters.push({ path: "_id", filters: own });
  if (isPile(doc)) {
    if (IP.updateItemPile) await IP.updateItemPile(doc, { overrideItemFilters: filters });
    return false;
  }
  await IP.turnTokensIntoItemPiles(doc, { pileSettings: { type: "pile", overrideItemFilters: filters } });
  return true;
}

/** Rolls a token's drop and stores it on the token's actor, replacing any earlier pre-rolled drop. Returns the stored drop. */
async function storeDrop(doc, api) {
  const actor = doc.actor; const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  const old = trashItems(actor).map(i => i.id); if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
  const d = await rollDrop(actor, { dungeon: isDungeon(doc) });
  const create = [];
  for (const i of d.items) {
    const v = valueOf(i, api); const same = create.find(o => o.flags[ID].source === i.uuid);
    if (same) { same.system.quantity += 1; continue; }
    const o = await trashItemData(i.uuid, v, cpVal); if (!o) continue; o.flags[ID].value = v; create.push(o);
  }
  if (create.length) await actor.createEmbeddedDocuments("Item", create);
  const flag = { id: doc.id, copper: d.copper, band: d.band, dungeon: d.dungeon };
  await doc.setFlag(ID, "trashRolled", flag);
  return flag;
}
/** The drop on a token as { items: [{ uuid, name, value, qty, id }], copper, dungeon }, rolling and storing it first if it has none yet. */
async function dropOf(doc, api, { store = true } = {}) {
  let f = rolled(doc);
  if (!f) {
    if (!store) { const d = await rollDrop(doc.actor, { dungeon: isDungeon(doc) }); return { items: d.items.map(i => ({ uuid: i.uuid, name: i.name, value: valueOf(i, api), qty: 1 })), copper: d.copper, dungeon: d.dungeon }; }
    f = await storeDrop(doc, api);
  }
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  const items = trashItems(doc.actor).map(i => ({ id: i.id, uuid: i.getFlag(ID, "source"), name: i.name, value: i.getFlag(ID, "value") ?? Math.round(i.system.price?.value || 0) * cpVal, qty: i.system.quantity || 1 }));
  return { items, copper: f.copper || 0, dungeon: !!f.dungeon };
}

/** createToken (active GM only): pre-rolls the drop for a newly placed unlinked NPC token. */
export async function onCreateToken(doc, api) {
  if (!game.users.activeGM?.isSelf || !S("trashAutoRoll", true) || !autoTarget(doc) || rolled(doc)) return;
  if (!packIds().length) return;
  try { if (!(await pool()).length) return; await storeDrop(doc, api); }
  catch (e) { console.warn(`${ID} | Vendor Trash: couldn't pre-roll loot for ${doc.name}`, e); }
}

/** GM: rolls the drop of the given (or selected) tokens again. Already looted bodies and linked tokens are skipped. */
export async function reroll(api, tokens = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  tokens ??= canvas.tokens.controlled.length ? canvas.tokens.controlled : [...game.user.targets];
  const docs = tokens.map(tokenDoc); const done = []; const skipped = [];
  if (!packIds().length || !(await pool()).length) return ui.notifications.warn("Vendor Trash: no grey items found in the configured compendiums.");
  for (const doc of docs) {
    if (!autoTarget(doc)) { if (doc?.name) skipped.push(doc.name); continue; }
    await storeDrop(doc, api); done.push(doc);
  }
  if (done.length) ui.notifications.info(`Vendor Trash: rerolled ${done.map(d => d.name).join(", ")}.`);
  if (skipped.length) ui.notifications.info(`Vendor Trash: not rerolled (looted, linked or not an NPC): ${skipped.join(", ")}.`);
  return done.map(d => ({ token: d.name, items: trashItems(d.actor).map(i => `${i.name}${i.system.quantity > 1 ? ` ×${i.system.quantity}` : ""}`), copper: rolled(d)?.copper ?? 0 }));
}

// ---------------------------------------------------------------- resetting loot
/** A token whose loot can be reset: a looted body or pile, or a linked NPC carrying trash. */
export const resettable = doc => !!doc?.actor && lootable(doc) && (!!doc.getFlag(ID, "looted") || !!doc.getFlag(ID, "bossLootDrawn") || isPile(doc) || bossItems(doc.actor).length > 0 || (doc.actorLink && doc.actor.type === "npc" && trashItems(doc.actor).length > 0));

/**
 * GM: puts the given (or selected) tokens back to unlooted. Item Piles piles are reverted (for a linked token the actor's own pile
 * setting is cleared too), items flagged as trash or boss loot are deleted from the token's actor (the world actor for linked tokens),
 * and the `looted`, `trashRolled` and `bossLootDrawn` flags are removed (so Boss loot draws again on the next death). With clearCoin the actor's coin is set to zero. Other items are never touched.
 * Unlinked tokens get a fresh pre-rolled drop when pre-rolling is on; linked tokens stay unrolled.
 */
export async function reset(api, tokens = null, { clearCoin = false } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  tokens ??= canvas.tokens.controlled.length ? canvas.tokens.controlled : [...game.user.targets];
  const docs = tokens.map(tokenDoc).filter(d => d?.actor);
  if (!docs.length) return ui.notifications.warn("Reset loot: select (or target) the tokens to reset first.");
  const IP = itemPiles(); const canRoll = featureOn("vendorTrash") && S("trashAutoRoll", true) && packIds().length && (await pool()).length;
  const out = [];
  for (const doc of docs) {
    const r = { token: doc.name, pile: false, items: 0, boss: 0, coin: false, rerolled: false };
    if (IP && isPile(doc)) {
      try { await IP.revertTokensFromItemPiles([doc]); r.pile = true; } catch (e) { console.warn(`${ID} | Vendor Trash: couldn't revert pile ${doc.name}`, e); }
    }
    const actor = doc.actor; // read after reverting: an unlinked token's synthetic actor may have been rebuilt
    if (doc.actorLink) {
      // Clear the actor-level (and prototype token) pile setting so future tokens of this actor aren't piles.
      const upd = {};
      if (actor.flags?.["item-piles"]?.data?.enabled) upd["flags.item-piles.data.enabled"] = false;
      if (actor.prototypeToken?.flags?.["item-piles"]?.data?.enabled) upd["prototypeToken.flags.item-piles.data.enabled"] = false;
      if (Object.keys(upd).length) { await actor.update(upd); r.pile = true; }
    }
    const ids = trashItems(actor).map(i => i.id);
    const bossIds = bossItems(actor).map(i => i.id).filter(id => !ids.includes(id));
    if (ids.length || bossIds.length) { await actor.deleteEmbeddedDocuments("Item", [...ids, ...bossIds]); r.items = ids.length; r.boss = bossIds.length; }
    if (doc.getFlag(ID, "looted") !== undefined) await doc.unsetFlag(ID, "looted");
    if (doc.getFlag(ID, "bossLootDrawn") !== undefined) await doc.unsetFlag(ID, "bossLootDrawn");
    if (doc.getFlag(ID, "trashRolled") !== undefined) await doc.unsetFlag(ID, "trashRolled");
    if (clearCoin && actor.system?.currency) {
      await actor.update(Object.fromEntries(Object.keys(actor.system.currency).map(k => [`system.currency.${k}`, 0]))); r.coin = true;
    }
    if (canRoll && autoTarget(doc)) {
      try { await storeDrop(doc, api); r.rerolled = true; } catch (e) { console.warn(`${ID} | Vendor Trash: couldn't pre-roll loot for ${doc.name}`, e); }
    }
    out.push(r);
  }
  const say = r => [r.pile && "pile reverted", r.items && `${r.items} trash item${r.items === 1 ? "" : "s"} removed`, r.boss && `${r.boss} boss loot item${r.boss === 1 ? "" : "s"} removed`, r.coin && "coin cleared", r.rerolled && "rerolled"].filter(Boolean).join(", ") || "flags cleared";
  ui.notifications.info(`Reset loot: ${out.map(r => `${r.token} (${say(r)})`).join("; ")}.`);
  return out;
}

/** Asks the GM to confirm a reset, with an "Also clear coin" checkbox. */
export async function confirmReset(api, docs) {
  const names = docs.map(d => esc(d.name)).join(", ");
  const clearCoin = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Reset loot" },
    content: `<p>Reset the loot on <strong>${names}</strong>? Vendor trash and boss loot items are removed and the token can be looted again; other items stay.</p><div class="form-group"><label><input type="checkbox" name="clearCoin"> Also clear coin</label></div>`,
    ok: { label: "Reset", icon: "fa-solid fa-rotate-left", callback: (ev, button) => !!button.form.elements.clearCoin?.checked },
    rejectClose: false
  });
  if (clearCoin === null || clearCoin === undefined) return null;
  return reset(api, docs, { clearCoin });
}

// ---------------------------------------------------------------- automatic looting on death
const busy = new Set();
const isDead = doc => { const hp = doc?.actor?.system?.attributes?.hp; return !!hp && (hp.max ?? 1) > 0 && (hp.value ?? 1) <= 0; };
/** Active GM only: when an unlinked NPC token is down (0 HP or marked defeated), its body becomes lootable with its pre-rolled drop. */
export async function onDeath(doc, api, { defeated = false } = {}) {
  if (!doc || !game.users.activeGM?.isSelf || !S("trashAutoLoot", true) || !autoTarget(doc)) return;
  if (!defeated && !isDead(doc)) return;
  if (busy.has(doc.uuid)) return; busy.add(doc.uuid);
  return serial(doc.uuid, async () => {
    try {
      if (!packIds().length || !(await pool()).length) return;
      await (usePiles() ? lootPiles([doc], api, { auto: true }) : lootCard([doc], api, { auto: true }));
    } catch (e) { console.warn(`${ID} | Vendor Trash: couldn't make ${doc.name} lootable`, e); }
    finally { busy.delete(doc.uuid); }
  });
}

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

const itemRow = (i, api) => `@UUID[${i.uuid}]{${esc(i.name)}}${i.qty > 1 ? ` ×${i.qty}` : ""} <span class="wct-val">(${api.fmtMoney(i.value * i.qty)})</span>`;

/** The original flow: a GM loot card with a Give to Party button. A pre-rolled drop is taken off the creature and put on the card. */
async function lootCard(docs, api, { auto = false } = {}) {
  const rows = []; const drops = []; let total = 0; let coinTotal = 0; const skipped = []; let dungeon = false;
  const todo = docs.filter(lootable).filter(doc => !(doc.getFlag(ID, "looted") && skipped.push(doc.name)));
  if (auto && !todo.length) return;
  await markLooted(todo);
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  for (const doc of todo) {
    // Linked tokens are rolled on the spot and nothing is written to their world actor.
    const d = await dropOf(doc, api, { store: !doc.actorLink }); if (d.dungeon) dungeon = true;
    const parts = d.items.map(i => { total += i.value * i.qty; for (let n = 0; n < i.qty; n++) drops.push({ uuid: i.uuid, value: i.value }); return itemRow(i, api); });
    const ids = d.items.map(i => i.id).filter(Boolean); if (ids.length) await doc.actor.deleteEmbeddedDocuments("Item", ids);
    if (d.copper) { const v = d.copper * cpVal; coinTotal += v; parts.push(`<em>${api.fmtMoney(v)}</em>`); }
    rows.push(`<li><strong>${esc(doc.name)}</strong>: ${parts.length ? parts.join(", ") : "<span class=\"hint\">nothing</span>"}</li>`);
  }
  if (!rows.length) return ui.notifications.info(`Vendor Trash: ${skipped.length ? `already looted (${skipped.join(", ")})` : "no creatures selected"}.`);
  const content = `<h3>Vendor Trash${dungeon ? DUNGEON_TAG : ""}</h3><ul>${rows.join("")}</ul>${skipped.length ? `<p class="hint">Already looted: ${skipped.map(esc).join(", ")}.</p>` : ""}<p>Coin ${api.fmtMoney(coinTotal)} · trash worth ${api.fmtMoney(total)} at a vendor.</p>${drops.length || coinTotal ? `<button type="button" data-wct-action="give-trash"><i class="fas fa-sack"></i> Give to Party</button>` : ""}`;
  return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Vendor Trash" }, flags: { [ID]: { trash: { drops, coin: coinTotal, given: false, dungeon } } } });
}

/**
 * Item Piles flow: the drop goes onto each creature's own actor (for an unlinked token that's the token's synthetic actor, so the
 * world actor is untouched) and the token becomes a lootable pile that keeps its image. The creature's own gear and features stay
 * hidden from the pile, so players only see the trash, any boss loot and coin. Creatures that dropped nothing are left alone. A drop pre-rolled when
 * the token was placed is used as it is.
 */
async function lootPiles(docs, api, { auto = false } = {}) {
  const IP = itemPiles(); const cpVal = Object.fromEntries(api.coins()).cp ?? 1;
  const rows = []; const skipped = []; const empty = []; let total = 0; let coinTotal = 0; let piles = 0; let dungeon = false;
  const todo = docs.filter(lootable).filter(doc => !((doc.getFlag(ID, "looted") || IP.isValidItemPile(doc)) && skipped.push(doc.name)));
  if (auto && !todo.length) return;
  await markLooted(todo);
  for (const doc of todo) {
    const actor = doc.actor;
    // Unlinked tokens use (or store) their pre-rolled drop; a linked token's drop is rolled now and added to its actor, as before.
    const d = await dropOf(doc, api, { store: !doc.actorLink }); if (d.dungeon) dungeon = true;
    const fresh = [];
    for (const i of d.items.filter(i => !i.id)) { const o = await trashItemData(i.uuid, i.value, cpVal); if (o) { o.system.quantity = i.qty; fresh.push(o); } }
    if (fresh.length) await actor.createEmbeddedDocuments("Item", fresh);
    const parts = d.items.map(i => { total += i.value * i.qty; return itemRow(i, api); });
    if (!d.items.length && !d.copper) { empty.push(doc.name); continue; }
    if (d.copper) {
      await api.addMoney(actor, d.copper * cpVal, { consolidate: true });
      const v = d.copper * cpVal; coinTotal += v; parts.push(`<em>${api.fmtMoney(v)}</em>`);
    }
    await pileUp(doc, IP);
    piles++;
    rows.push(`<li><strong>${esc(doc.name)}</strong>: ${parts.join(", ")}</li>`);
  }
  if (auto && !rows.length) return;
  if (!rows.length && !empty.length) return ui.notifications.info(`Vendor Trash: ${skipped.length ? `already looted (${skipped.join(", ")})` : "no creatures selected"}.`);
  const content = `<h3>Vendor Trash${dungeon ? DUNGEON_TAG : ""}</h3>${rows.length ? `<ul>${rows.join("")}</ul>` : ""}${empty.length ? `<p class="hint">Nothing on: ${empty.map(esc).join(", ")}.</p>` : ""}${skipped.length ? `<p class="hint">Already looted: ${skipped.map(esc).join(", ")}.</p>` : ""}<p>${piles} ${piles === 1 ? "body is" : "bodies are"} ready to loot. Coin ${api.fmtMoney(coinTotal)} · trash worth ${api.fmtMoney(total)} at a vendor.</p>`;
  return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Vendor Trash" }, flags: { [ID]: { trash: { piles: true, coin: coinTotal, value: total, dungeon } } } });
}

/** Token HUD (GM): a dice button that rerolls an unlooted NPC's pre-rolled trash, and a reset button on looted bodies, piles, bodies that dropped boss loot and linked NPCs carrying trash. With `reroll: false` (Vendor Trash off, Boss loot on) only the reset button. */
export function addHudButton(hud, html, api, { reroll = true } = {}) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; const doc = hud.object?.document ?? hud.document;
  const col = root?.querySelector(".col.left") ?? root?.querySelector(".col.right"); if (!col) return;
  col.querySelector(".wct-trash-reroll")?.remove(); col.querySelector(".wct-trash-reset")?.remove();
  if (resettable(doc)) {
    const rb = document.createElement("button");
    rb.type = "button"; rb.className = "control-icon wct-trash-reset";
    rb.dataset.tooltip = "Reset loot"; rb.setAttribute("aria-label", "Reset loot");
    rb.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
    rb.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); await confirmReset(api, [doc]); hud.render?.(); });
    col.append(rb);
  }
  if (!reroll || !autoTarget(doc)) return;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "control-icon wct-trash-reroll";
  const f = rolled(doc);
  btn.dataset.tooltip = f ? `Reroll trash (now: ${trashItems(doc.actor).map(i => i.name).join(", ") || "no items"}${f.copper ? `, ${api.fmtMoney(f.copper * (Object.fromEntries(api.coins()).cp ?? 1))}` : ""})` : "Roll trash";
  btn.setAttribute("aria-label", "Reroll vendor trash");
  btn.innerHTML = '<i class="fa-solid fa-dice"></i>';
  btn.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); await reroll(api, [doc]); hud.render?.(); });
  col.append(btn);
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
