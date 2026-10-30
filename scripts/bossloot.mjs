/**
 * Boss loot: a roll table of hand-picked drops linked to a creature. When it dies, the active GM's client draws from the table
 * (without replacement, weighted by each result's weight) and puts the items on the body, which becomes a lootable Item Piles pile
 * (the same pile Vendor Trash uses, so both can be on one body). Without Item Piles the GM gets a card with a Give to Party button.
 *
 * Data:
 *   Actor flag  flags.wayfarers-toolkit.bossLoot = { table: "<RollTable UUID>", draws: 1, coinCp: 0, note: "" }
 *               (on the world actor, or on an unlinked token's own actor)
 *   Item flag   flags.wayfarers-toolkit.bossLoot = { table, source }   on each dropped item (Reset loot removes these)
 *   Token flag  flags.wayfarers-toolkit.bossLootDrawn = { id, at, items: [names], coinCp }   set once per death (Reset loot clears it)
 *
 * The world table is never changed: results are drawn here in memory, so "drawn" marks on the table are neither read nor written.
 * The draw helpers need no Foundry globals (they are tested in Node). Turned off with the "Boss loot" feature, nothing here is registered.
 * Its death hooks are registered after Vendor Trash's and share its per-token queue, so trash is put on a body before boss loot joins it.
 */
import * as Trash from "./trash.mjs";
import { on as featureOn } from "./features.mjs";
import { isActiveGM } from "./gm.mjs";
import { log, byWhom } from "./log.mjs";
import * as Summary from "./summary.mjs";
const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tokenDoc = t => t?.document ?? t;
const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id);
const S = (k, d) => { try { return game.settings.get(ID, k) ?? d; } catch { return d; } };

// ---------------------------------------------------------------- pure helpers (tested in Node)
/** The flag in its normal form, or null when no table is set. */
export function normalize(flag) {
  if (!flag || typeof flag !== "object" || !String(flag.table ?? "").trim()) return null;
  const draws = Math.max(1, Math.floor(Number(flag.draws) || 1));
  const coinCp = Math.max(0, Math.floor(Number(flag.coinCp) || 0));
  const out = { table: String(flag.table).trim(), draws };
  if (coinCp) out.coinCp = coinCp;
  if (String(flag.note ?? "").trim()) out.note = String(flag.note).trim();
  return out;
}

/** The Item UUID a table result points at, or null for a text result (or a result pointing at something that isn't an Item). */
export function resultUuid(r) {
  if (!r) return null;
  const type = String(r.type ?? "");
  if (type === "text" || type === "0") return null;
  if (r.documentUuid) return /(^|\.)Item\.[^.]+$/.test(r.documentUuid) ? r.documentUuid : null;
  const coll = r.documentCollection; const id = r.documentId; if (!coll || !id) return null;
  if (type === "pack" || type === "2" || String(coll).includes(".")) return `Compendium.${coll}.Item.${id}`;
  return coll === "Item" ? `Item.${id}` : null;
}

/**
 * Whether a boss's body falls back to vendor trash, and why: null (draw as normal), "table" (the linked table is missing),
 * "empty" (the table has no result that can drop) or "items" (the draw produced no item because the items it points at are missing).
 * Pure: `tableFound`, `usable` (results with weight > 0), `items` (resolved drops) and `missing` (results whose item wasn't found).
 */
export function fallbackReason({ tableFound, usable = 1, items = 0, missing = 0 } = {}) {
  if (!tableFound) return "table";
  if (!usable) return "empty";
  if (!items && missing) return "items";
  return null;
}
export const FALLBACK_TEXT = { table: "its boss loot table is missing", empty: "its boss loot table has no results that can drop", items: "the items its boss loot table points at are missing" };

/** A display label for a result: its name or text. */
export const resultLabel = r => String(r?.name || r?.text || r?.description || "").replace(/<[^>]*>/g, "").trim() || "(blank)";

/**
 * Draws up to `n` results from `results` without replacement, each pick weighted by the result's weight (weight 0 never drops).
 * Every result is drawn from, whatever its "drawn" mark on the table says. `rand` returns [0, 1).
 */
export function drawWeighted(results, n, rand = Math.random) {
  const pool = [...results].filter(r => (Number(r.weight ?? 1) || 0) > 0);
  const out = [];
  for (let k = 0; k < n && pool.length; k++) {
    const total = pool.reduce((t, r) => t + Number(r.weight ?? 1), 0);
    let x = rand() * total; let i = 0;
    for (; i < pool.length - 1; i++) { x -= Number(pool[i].weight ?? 1); if (x < 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Each result's chance to be the single pick of one draw: [{ result, weight, pct }]. */
export function odds(results) {
  const total = results.reduce((t, r) => t + Math.max(0, Number(r.weight ?? 1) || 0), 0);
  return results.map(r => { const w = Math.max(0, Number(r.weight ?? 1) || 0); return { result: r, weight: w, pct: total ? (100 * w) / total : 0 }; });
}

// ---------------------------------------------------------------- party size (pure)
/** Party size as a whole number from 1 to 8 (default 4). */
export const clampParty = n => Math.min(8, Math.max(1, Math.floor(Number(n) || 4)));
/** Boss coin for the party size: coinCp × partySize / 4, rounded to the copper. The stored flag is never changed. */
export const scaledCoin = (coinCp, partySize = 4) => Math.max(0, Math.round((Number(coinCp) || 0) * clampParty(partySize) / 4));
/**
 * Draws for the party size: a boss with 3 or more draws gets one more when the party is bigger than 4 and `extra` is on,
 * never more than the table's usable results (`usable`, when known). Fewer draws than set are never taken away.
 */
export function scaledDraws(draws, partySize = 4, { extra = true, usable = Infinity } = {}) {
  const d = Math.max(1, Math.floor(Number(draws) || 1));
  if (!extra || d < 3 || clampParty(partySize) <= 4) return d;
  return Math.max(d, Math.min(d + 1, Number.isFinite(usable) ? usable : d + 1));
}
/** World party-size settings, read safely. */
export function partyRules() {
  return { size: clampParty(S("partySize", 4)), extra: !!S("bossLootExtraDraw", true) };
}

/**
 * Bulk linking: the actor name a world table is named for ("<name> · Loot", "<name> - Loot" or "Loot: <name>"), or null.
 * Matching is exact on the name (trimmed); a plain hyphen and the en/em dash all count.
 */
export function tableOwnerName(tableName) {
  const n = String(tableName ?? "").trim();
  let m = n.match(/^(.+?)\s+(?:·|-|–|—)\s+Loot$/); if (m) return m[1].trim();
  m = n.match(/^Loot:\s*(.+)$/); if (m) return m[1].trim();
  return null;
}
/**
 * Defaults for a bulk link: the table's flag (flags.wayfarers-toolkit.bossLootDefaults = { draws, coinCp, note }), else "draws: 2" and
 * "coin: 1500" (copper) written in the table's description, else draws 1 and no coin.
 */
export function linkDefaults(flagDefaults, description = "") {
  let d = flagDefaults && typeof flagDefaults === "object" ? flagDefaults : null;
  if (!d) {
    const txt = String(description ?? "").replace(/<[^>]*>/g, " ");
    d = { draws: txt.match(/\bdraws?\s*[:=]\s*(\d+)/i)?.[1], coinCp: txt.match(/\bcoin(?:cp)?\s*[:=]\s*(\d+)/i)?.[1] };
  }
  return { draws: Math.max(1, Math.floor(Number(d.draws) || 1)), coinCp: Math.max(0, Math.floor(Number(d.coinCp) || 0)), note: String(d.note ?? "").trim() };
}

// ---------------------------------------------------------------- reading and writing the link
/** The actor a target refers to: a token's actor (synthetic for unlinked tokens) or the actor itself. */
const actorOf = t => { const d = tokenDoc(t); return d?.actor ?? (d instanceof Actor ? d : null); };

/** The boss loot set for an actor or token, in normal form, or null. */
export function get(target) { return normalize(actorOf(target)?.getFlag?.(ID, "bossLoot")); }

/**
 * Links a roll table (GM only). `target` is an actor or token: a linked token writes to its world actor, an unlinked token to its own
 * actor (only that token) unless `{ world: true }`. An empty table removes the link.
 */
export async function set(target, data = {}, { world = false } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const d = tokenDoc(target); let actor = actorOf(target);
  if (world && d?.actor && !d.actorLink) actor = game.actors.get(d.actorId) ?? actor;
  if (!actor) return ui.notifications.warn("Boss loot: no actor.");
  let table = data.table; if (table?.uuid) table = table.uuid;
  const flag = normalize({ ...data, table });
  if (!flag) { if (actor.getFlag(ID, "bossLoot") !== undefined) await actor.unsetFlag(ID, "bossLoot"); return null; }
  const t = await fromUuid(flag.table);
  if (!(t instanceof RollTable)) return ui.notifications.warn(`Boss loot: ${flag.table} is not a roll table.`);
  // Every field is written, so values cleared in the dialog don't linger from an earlier save.
  await actor.setFlag(ID, "bossLoot", { table: flag.table, draws: flag.draws, coinCp: flag.coinCp ?? 0, note: flag.note ?? "" });
  return flag;
}

async function tableOf(flag) { const t = flag ? await fromUuid(flag.table) : null; return t instanceof RollTable ? t : null; }

// ---------------------------------------------------------------- drawing
const drawnFlag = doc => { const f = doc?.getFlag?.(ID, "bossLootDrawn"); return f && (!f.id || f.id === doc.id) ? f : null; };
const lootable = doc => doc?.actor && !["character", "group"].includes(doc.actor.type);

/** Draws a creature's boss loot: { table, flag, items: [{ uuid, name, img, data }], nothing: [labels] }. Nothing is written. */
export async function draw(target) {
  const flag = get(target); const table = await tableOf(flag);
  if (!table) return null;
  const pr = partyRules();
  const usableN = [...table.results].filter(r => (Number(r.weight ?? 1) || 0) > 0).length;
  const draws = scaledDraws(flag.draws, pr.size, { extra: pr.extra, usable: usableN });
  const picks = drawWeighted([...table.results], draws);
  log(`Boss loot: ${tokenDoc(target)?.name ?? "?"} draws ${draws} (set ${flag.draws}, party ${pr.size}) from ${table.name}:`, picks.map(resultLabel));
  const items = []; const nothing = []; const missing = [];
  for (const r of picks) {
    const uuid = resultUuid(r); const src = uuid ? await fromUuid(uuid).catch(() => null) : null;
    if (!(src instanceof Item)) { if (uuid || r.documentId) missing.push(resultLabel(r)); nothing.push(resultLabel(r)); continue; }
    const o = src.toObject(); delete o._id; delete o.folder; delete o.sort; delete o.ownership;
    o.flags = foundry.utils.mergeObject(o.flags ?? {}, { [ID]: { bossLoot: { table: table.uuid, source: uuid } } });
    items.push({ uuid, name: src.name, img: src.img, data: o });
  }
  return { table, flag, draws, items, nothing, missing, usable: usableN };
}

/**
 * Checks a boss loot link without drawing (for the health check): { flag, table, results, usable, resolved, unresolved: [labels],
 * draws, tooManyDraws, fallback } where `fallback` is fallbackReason() for a draw where every item result is missing.
 */
export async function inspect(target) {
  const flag = get(target); if (!flag) return null;
  const table = await tableOf(flag).catch(() => null);
  if (!table) return { flag, table: null, results: 0, usable: 0, resolved: 0, unresolved: [], draws: flag.draws, tooManyDraws: false, fallback: "table" };
  const results = [...table.results]; const usableList = results.filter(r => (Number(r.weight ?? 1) || 0) > 0);
  let resolved = 0; const unresolved = [];
  for (const r of usableList) {
    const uuid = resultUuid(r); if (!uuid && !r.documentId) continue;
    const src = uuid ? await fromUuid(uuid).catch(() => null) : null;
    if (src instanceof Item) resolved++; else unresolved.push(resultLabel(r));
  }
  const fallback = fallbackReason({ tableFound: true, usable: usableList.length, items: resolved, missing: unresolved.length });
  const pr = partyRules();
  const draws = scaledDraws(flag.draws, pr.size, { extra: pr.extra, usable: usableList.length });
  return { flag, table, results: results.length, usable: usableList.length, resolved, unresolved, draws: flag.draws, scaledDraws: draws, coinCp: flag.coinCp ?? 0, scaledCoinCp: scaledCoin(flag.coinCp ?? 0, pr.size), partySize: pr.size, tooManyDraws: flag.draws > usableList.length, fallback };
}

/**
 * Drops a token's boss loot once: draws, creates the items on the token's actor and makes the body a pile (or, without Item Piles,
 * posts a Give to Party card). Sets the token's `bossLootDrawn` flag and posts the GM card. Returns what dropped, or null.
 */
async function dropOne(doc, api, { auto = false } = {}) {
  if (!lootable(doc) || !get(doc)) return null;
  if (drawnFlag(doc)) { if (!auto) ui.notifications.info(`Boss loot: ${doc.name} has already dropped its loot (Reset loot to draw again).`); return null; }
  if (Trash.isNoLoot(doc)) { if (!auto) ui.notifications.info(`Boss loot: ${doc.name} is marked No loot.`); return null; }
  const d = await draw(doc).catch(() => null);
  const why = fallbackReason({ tableFound: !!d, usable: d?.usable ?? 0, items: d?.items.length ?? 0, missing: d?.missing.length ?? 0 });
  if (why) return fallback(doc, api, why, d, { auto });
  const piles = Trash.usePiles(); const IP = piles ? Trash.itemPiles() : null;
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1; const coinCp = scaledCoin(d.flag.coinCp || 0, partyRules().size); const coin = coinCp * cpVal;
  log(`Boss loot: ${doc.name} drops`, d.items.map(i => i.name), `${coinCp}c (flag ${d.flag.coinCp || 0}c), run by ${byWhom()}`);
  await doc.setFlag(ID, "bossLootDrawn", { id: doc.id, at: Date.now(), items: d.items.map(i => i.name), coinCp });
  let created = [];
  if (IP) {
    if (d.items.length) created = await doc.actor.createEmbeddedDocuments("Item", d.items.map(i => i.data));
    if (coin) await api.addMoney(doc.actor, coin, { consolidate: true });
    if (created.length || coin) await Trash.pileUp(doc, IP);
  }
  await card(doc, d, api, { created, coin, piles: !!IP, auto });
  return { token: doc.name, table: d.table.name, items: d.items.map(i => i.name), nothing: d.nothing, coin };
}

/** Boss loot can't drop: marks the token as drawn (so it doesn't retry on every hit), drops vendor trash instead and tells the GM why. */
async function fallback(doc, api, why, d, { auto }) {
  log(`Boss loot: ${doc.name} falls back to vendor trash (${why})`);
  await doc.setFlag(ID, "bossLootDrawn", { id: doc.id, at: Date.now(), items: [], coinCp: 0, fallback: why });
  let what;
  if (auto && !S("trashAutoLoot", true) && featureOn("vendorTrash")) what = "no vendor trash either (bodies aren't made lootable automatically; run Vendor Trash yourself)";
  else { try { what = await Trash.fallbackDrop(doc, api); } catch (e) { console.warn(`${ID} | Boss loot fallback for ${doc.name}`, e); what = `vendor trash failed too (${e.message})`; } }
  const table = d?.table ? esc(d.table.name) : esc(get(doc)?.table ?? "");
  const extra = why === "items" && d?.missing?.length ? ` (${d.missing.map(esc).join(", ")})` : "";
  await ChatMessage.create({ whisper: gmIds(), speaker: { alias: "Boss loot" }, content: `<h3>Boss loot: ${esc(doc.name)}</h3><p>No boss loot dropped: ${FALLBACK_TEXT[why]}${extra}. ${what[0].toUpperCase()}${what.slice(1)}.</p><p class="hint">Table: ${table || "none"}. Fix the link (gem button), then Reset loot to draw again.</p>` });
  return { token: doc.name, table: d?.table?.name ?? null, items: [], nothing: d?.nothing ?? [], coin: 0, fallback: why, then: what };
}

/** The GM card: "<name> dropped:" with item links, a Start loot roll button per item (piles and Loot rolls on) or Give to Party. */
async function card(doc, d, api, { created, coin, piles, auto = false }) {
  const rolls = piles && featureOn("lootRolls");
  const rows = piles
    ? created.map(i => `<li>@UUID[${i.uuid}]{${esc(i.name)}}${rolls ? ` <button type="button" class="wct-bossloot-roll" data-wct-bossloot-roll="${esc(i.uuid)}" style="width:auto;line-height:1.4;padding:0 0.4em;margin-left:0.3em;"><i class="fa-solid fa-dice"></i> Start loot roll</button>` : ""}</li>`)
    : d.items.map(i => `<li>@UUID[${i.uuid}]{${esc(i.name)}}</li>`);
  if (coin) rows.push(`<li><em>${api.fmtMoney(coin)}</em></li>`);
  const empty = !rows.length;
  const content = `<h3>${esc(doc.name)} dropped:</h3>${empty ? `<p class="hint">Nothing${d.nothing.length ? ` (${d.nothing.map(esc).join(", ")})` : ""}.</p>` : `<ul>${rows.join("")}</ul>`}
${d.flag.note ? `<p class="hint">${esc(d.flag.note)}</p>` : ""}<p class="hint">From ${esc(d.table.name)} · ${d.draws ?? d.flag.draws} draw${(d.draws ?? d.flag.draws) === 1 ? "" : "s"}${piles && !empty ? " · the body is ready to loot" : ""}.</p>
${!piles && !empty ? `<button type="button" data-wct-action="give-bossloot"><i class="fas fa-sack"></i> Give to Party</button>` : ""}`;
  const flag = { token: doc.uuid, piles, given: false, drops: piles ? [] : d.items.map(i => i.uuid), coin: piles ? 0 : coin };
  const single = { content, whisper: gmIds(), speaker: { alias: "Boss loot" }, flags: { [ID]: { bossLootCard: flag } } };
  if (auto) {
    // One line per creature in a batched summary; the Start loot roll buttons stay on it.
    const line = `<li><strong>${esc(doc.name)}</strong>: ${empty ? `<span class="hint">nothing</span>` : `<ul>${rows.join("")}</ul>`}</li>`;
    return Summary.queue({ kind: "boss", body: doc.uuid, rows: [line], coin, flag, single }, a => api.fmtMoney(a));
  }
  return ChatMessage.create(single);
}

/** GM: manual drop for the given (or selected) tokens. Tokens that already dropped are skipped (Reset loot first). */
export async function drop(api, tokens = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  tokens ??= canvas.tokens?.controlled?.length ? canvas.tokens.controlled : [...game.user.targets];
  const docs = tokens.map(tokenDoc).filter(d => d?.actor);
  if (!docs.length) return ui.notifications.warn("Boss loot: select (or target) a token first.");
  const out = [];
  for (const doc of docs) {
    if (!get(doc)) { ui.notifications.info(`Boss loot: no table linked to ${doc.name}.`); continue; }
    const r = await Trash.serial(doc.uuid, () => dropOne(doc, api)); if (r) out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- death
const busy = new Set();
const isDead = doc => { const hp = doc?.actor?.system?.attributes?.hp; return !!hp && (hp.max ?? 1) > 0 && (hp.value ?? 1) <= 0; };
/** Active GM only: a token with boss loot that is down (0 HP or marked defeated) drops it, once per death. Linked and unlinked. */
export async function onDeath(doc, api, { defeated = false } = {}) {
  if (!doc || !isActiveGM() || !S("bossLootAuto", true) || !lootable(doc) || !get(doc) || drawnFlag(doc)) return;
  if (!defeated && !isDead(doc)) return;
  if (Trash.isNoLoot(doc)) return log(`Boss loot: ${doc.name} drops nothing (No loot is set)`);
  if (busy.has(doc.uuid)) return; busy.add(doc.uuid);
  return Trash.serial(doc.uuid, async () => {
    try { await dropOne(doc, api, { auto: true }); }
    catch (e) { console.warn(`${ID} | Boss loot: couldn't drop loot for ${doc.name}`, e); ui.notifications.warn(`Boss loot: couldn't drop loot for ${doc.name} (${e.message}).`); }
    finally { busy.delete(doc.uuid); }
  });
}

/** Tokens standing for an actor: its own token (unlinked) or the linked tokens on the viewed and active scenes. */
function tokensFor(actor) {
  if (!actor) return [];
  if (actor.isToken) return actor.token ? [actor.token] : [];
  const scenes = new Set([canvas?.scene, game.scenes?.active].filter(Boolean));
  return [...scenes].flatMap(s => s.tokens.filter(t => t.actorLink && t.actorId === actor.id));
}

// ---------------------------------------------------------------- preview
/** GM: whispers a card per selected (or given) token or actor: table, draws, every result with its weight and its chance per draw. */
export async function preview(api, targets = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (targets && !Array.isArray(targets)) targets = [targets];
  targets ??= canvas.tokens?.controlled?.length ? canvas.tokens.controlled : [...game.user.targets];
  if (!targets.length) return ui.notifications.warn("Boss loot: select (or target) a token to preview.");
  const cpVal = Object.fromEntries(api.coins()).cp ?? 1; const out = [];
  for (const t of targets) {
    const name = tokenDoc(t)?.name ?? actorOf(t)?.name ?? "?"; const flag = get(t); const table = await tableOf(flag);
    let body;
    if (!flag) body = `<p class="hint">No boss loot table linked.</p>`;
    else if (!table) body = `<p><strong>Table not found:</strong> ${esc(flag.table)}</p>`;
    else {
      const rows = odds([...table.results]).sort((a, b) => b.weight - a.weight).map(({ result, weight, pct }) => {
        const uuid = resultUuid(result);
        const label = uuid ? `@UUID[${uuid}]{${esc(resultLabel(result))}}` : `<span class="hint">${esc(resultLabel(result))} (nothing)</span>`;
        return `<tr><td>${label}</td><td style="text-align:right">${weight}</td><td style="text-align:right">${pct.toFixed(pct && pct < 1 ? 2 : 1)}%</td></tr>`;
      });
      const doc = tokenDoc(t); const drawn = doc?.getFlag ? drawnFlag(doc) : null;
      const pr = partyRules(); const usableN = [...table.results].filter(r => (Number(r.weight ?? 1) || 0) > 0).length;
      const dn = scaledDraws(flag.draws, pr.size, { extra: pr.extra, usable: usableN }); const cc = scaledCoin(flag.coinCp ?? 0, pr.size);
      const forParty = ` for a party of ${pr.size}`;
      body = `<p><strong>Table:</strong> @UUID[${table.uuid}]{${esc(table.name)}}<br><strong>Draws:</strong> ${dn}${dn !== flag.draws ? ` (set ${flag.draws}; +1${forParty})` : ""} (without replacement)${flag.coinCp ? `<br><strong>Coin:</strong> ${api.fmtMoney(cc * cpVal)}${cc !== flag.coinCp ? ` (set ${api.fmtMoney(flag.coinCp * cpVal)}; scaled${forParty})` : ""}` : ""}${flag.note ? `<br><strong>Note:</strong> ${esc(flag.note)}` : ""}</p>
<table><thead><tr><th>Result</th><th>Weight</th><th>Per draw</th></tr></thead><tbody>${rows.join("")}</tbody></table>
<p class="hint">${drawn ? `Already dropped: ${(drawn.items ?? []).map(esc).join(", ") || "nothing"}.` : "Not dropped yet."}</p>`;
    }
    out.push(await ChatMessage.create({ whisper: gmIds(), speaker: { alias: "Boss loot" }, content: `<h3>Boss loot: ${esc(name)}</h3>${body}` }));
  }
  return out;
}

// ---------------------------------------------------------------- bulk linking
/**
 * GM: links world NPC actors without a boss loot flag to a world roll table named for them ("<Actor name> · Loot", "<Actor name> - Loot"
 * or "Loot: <Actor name>"). Draws 1 and no coin, unless the table carries flags.wayfarers-toolkit.bossLootDefaults { draws, coinCp, note }.
 * `folder` (a Folder, its id or name) limits it to actors in that folder. Existing links are kept unless `overwrite`.
 * Returns { linked: [{ actor, table }], skipped: [{ actor, why }] } and reports in a notification and a GM whisper.
 */
export async function autoLink(api, { folder = null, overwrite = false, quiet = false } = {}) {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return null; }
  const byOwner = new Map();
  for (const t of game.tables) { const n = tableOwnerName(t.name); if (n && !byOwner.has(n)) byOwner.set(n, t); }
  let fid = null;
  if (folder) { const f = folder?.id ? folder : game.folders.get(folder) ?? game.folders.find(x => x.type === "Actor" && x.name === folder); fid = f?.id ?? "__none__"; }
  const linked = []; const skipped = [];
  for (const a of game.actors) {
    if (a.type !== "npc" || (fid && a.folder?.id !== fid)) continue;
    const t = byOwner.get(a.name.trim());
    if (!t) continue;
    if (a.getFlag(ID, "bossLoot") && !overwrite) { skipped.push({ actor: a.name, why: "already linked" }); continue; }
    const d = linkDefaults(t.getFlag?.(ID, "bossLootDefaults"), t.description);
    try { await a.setFlag(ID, "bossLoot", { table: t.uuid, draws: d.draws, coinCp: d.coinCp, note: d.note }); linked.push({ actor: a.name, table: t.name }); }
    catch (e) { skipped.push({ actor: a.name, why: e.message }); }
  }
  log("Boss loot: auto-link", { linked, skipped });
  if (!quiet) {
    ui.notifications.info(`Boss loot: linked ${linked.length} creature${linked.length === 1 ? "" : "s"}${skipped.length ? `, skipped ${skipped.length}` : ""}.`);
    await ChatMessage.create({ whisper: gmIds(), speaker: { alias: "Boss loot" }, content: `<h3>Boss loot: link tables by name</h3>${linked.length ? `<p><strong>Linked:</strong></p><ul>${linked.map(l => `<li>${esc(l.actor)} → ${esc(l.table)}</li>`).join("")}</ul>` : "<p>Nothing new to link.</p>"}${skipped.length ? `<p><strong>Skipped:</strong></p><ul>${skipped.map(x => `<li>${esc(x.actor)} (${esc(x.why)})</li>`).join("")}</ul>` : ""}<p class="hint">Tables named "&lt;creature&gt; · Loot", "&lt;creature&gt; - Loot" or "Loot: &lt;creature&gt;" are linked to the world NPC actor with that exact name.</p>` });
  }
  return { linked, skipped };
}

// ---------------------------------------------------------------- dialog
/** GM: the "Boss loot…" dialog for a token: table (world tables, or drop any table / paste its UUID), draws, coin and note. */
export async function openDialog(api, target) {
  if (!game.user.isGM) return;
  const doc = tokenDoc(target); const actor = actorOf(target); if (!actor) return;
  const worldActor = doc?.actorLink === false ? game.actors.get(doc.actorId) : null;
  const cur = get(target) ?? {};
  const tables = [...game.tables].sort((a, b) => a.name.localeCompare(b.name));
  const known = tables.some(t => t.uuid === cur.table);
  const content = `<p class="hint">Results that point at items drop those items; text results drop nothing. A result's weight is its relative chance. Drag a roll table (from the sidebar or a compendium) onto the box below to use it.</p>
<div class="form-group"><label>Roll table</label><select name="pick"><option value="">(none: remove boss loot)</option>${tables.map(t => api.opt(t.uuid, t.name, t.uuid === cur.table)).join("")}${cur.table && !known ? api.opt(cur.table, "(linked table)", true) : ""}</select></div>
<div class="form-group"><label>Table UUID</label><input type="text" name="table" value="${esc(cur.table ?? "")}" placeholder="Drop a roll table here" class="wct-bossloot-drop"></div>
<div class="form-group"><label>Draws</label><input type="number" name="draws" min="1" step="1" value="${cur.draws ?? 1}"></div>
<div class="form-group"><label>Coin (copper)</label><input type="number" name="coinCp" min="0" step="1" value="${cur.coinCp ?? 0}"></div>
<div class="form-group"><label>Note</label><input type="text" name="note" value="${esc(cur.note ?? "")}"></div>
${worldActor ? `<div class="form-group"><label>Every token of ${esc(worldActor.name)}</label><input type="checkbox" name="world" ${worldActor.getFlag(ID, "bossLoot") ? "checked" : ""}><p class="hint">Save on the world actor, so new tokens get it too. Unticked: only this token.</p></div>` : ""}`;
  const f = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Boss loot: ${doc?.name ?? actor.name}` }, content, position: { width: 480 },
    ok: { label: "Save", icon: "fa-solid fa-floppy-disk", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object },
    render: (ev, dialog) => {
      const root = dialog?.element ?? ev?.target?.element; if (!root) return;
      const input = root.querySelector('input[name="table"]'); const pick = root.querySelector('select[name="pick"]');
      pick?.addEventListener("change", () => { input.value = pick.value; });
      input?.addEventListener("dragover", e => e.preventDefault());
      input?.addEventListener("drop", e => {
        e.preventDefault();
        let data; try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
        if (data?.type !== "RollTable" || !data.uuid) return ui.notifications.warn("Boss loot: drop a roll table.");
        input.value = data.uuid; if (pick) pick.value = [...pick.options].some(o => o.value === data.uuid) ? data.uuid : "";
      });
    },
    rejectClose: false
  });
  if (!f) return;
  const flag = await set(target, { table: f.table, draws: f.draws, coinCp: f.coinCp, note: f.note }, { world: !!f.world });
  // Saved on the world actor: drop this token's own copy, which would otherwise override it.
  if (worldActor && f.world && doc.delta?._source?.flags?.[ID]?.bossLoot) await doc.actor.unsetFlag(ID, "bossLoot");
  ui.notifications.info(flag ? `Boss loot: ${doc?.name ?? actor.name} drops ${flag.draws} from its table.` : `Boss loot: removed from ${doc?.name ?? actor.name}.`);
  return flag;
}

/** Token HUD (GM): a gem button that opens the Boss loot dialog; lit when the token has a table linked. */
function addHudButton(hud, html, api) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; const doc = hud.object?.document ?? hud.document;
  const col = root?.querySelector(".col.right") ?? root?.querySelector(".col.left"); if (!col || !lootable(doc)) return;
  col.querySelector(".wct-bossloot")?.remove();
  const btn = document.createElement("button"); const f = get(doc);
  btn.type = "button"; btn.className = `control-icon wct-bossloot${f ? " active" : ""}`;
  btn.dataset.tooltip = f ? `Boss loot… (${f.draws} draw${f.draws === 1 ? "" : "s"}${drawnFlag(doc) ? ", dropped" : ""})` : "Boss loot…";
  btn.setAttribute("aria-label", "Boss loot");
  btn.innerHTML = '<i class="fa-solid fa-gem"></i>';
  btn.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); await openDialog(api, doc); hud.render?.(); });
  col.append(btn);
}

/** Gives a no-Item-Piles card's drops and coin to the party actor. */
async function give(message, api) {
  const data = message.getFlag(ID, "bossLootCard"); if (!data || data.given || data.piles) return ui.notifications.info("Already given.");
  const party = api.partyActor(); if (!party) return ui.notifications.warn(`No group actor named ${api.PARTY}.`);
  const docs = [];
  for (const uuid of data.drops ?? []) {
    const src = await fromUuid(uuid).catch(() => null); if (!(src instanceof Item)) continue;
    const o = src.toObject(); delete o._id; delete o.folder; delete o.sort; delete o.ownership; docs.push(o);
  }
  if (docs.length) await party.createEmbeddedDocuments("Item", docs);
  if (data.coin) await api.addMoney(party, data.coin, { consolidate: true });
  await message.setFlag(ID, "bossLootCard", { ...data, given: true });
  ui.notifications.info(`Boss loot: gave ${docs.length} item${docs.length === 1 ? "" : "s"}${data.coin ? ` and ${api.fmtMoney(data.coin)}` : ""} to ${party.name}.`);
}

function onRenderCard(message, html, api) {
  const data = message.flags?.[ID]?.bossLootCard; if (!data) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; if (!root) return;
  const btn = root.querySelector("[data-wct-action=give-bossloot]");
  if (btn) {
    if (!game.user.isGM) btn.remove();
    else if (data.given) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> Given to party'; }
    else btn.addEventListener("click", async ev => { ev.preventDefault(); btn.disabled = true; try { await give(message, api); } catch (e) { btn.disabled = false; ui.notifications.error(`Boss loot: ${e.message}`); } });
  }
  root.querySelectorAll("[data-wct-bossloot-roll]").forEach(b => {
    if (!game.user.isGM || !api.lootRoll) return b.remove();
    b.addEventListener("click", async ev => {
      ev.preventDefault(); const item = await fromUuid(b.dataset.wctBosslootRoll).catch(() => null);
      if (!item) return ui.notifications.warn("Boss loot: that item is no longer on the body.");
      api.lootRoll.start(item);
    });
  });
}

/** Called from the module's init hook when the feature is on: its setting and hooks. */
export function init(api, { vendorTrash = true } = {}) {
  game.settings.register(ID, "bossLootAuto", {
    name: "Boss loot: drop automatically on death", hint: "When a creature with a boss loot table drops to 0 HP or is marked defeated, its loot is drawn once and put on the body (an Item Piles pile, or a Give to Party card without Item Piles). Off: use api.bossLoot.drop(tokens).",
    scope: "world", config: false, type: Boolean, default: true
  });
  game.settings.register(ID, "bossLootExtraDraw", {
    name: "Boss loot: extra drop for parties above 4", hint: "With Party size above 4, a boss with 3 or more draws draws one more (never more than its table's usable results). Boss coin always scales with Party size.",
    scope: "world", config: false, type: Boolean, default: true
  });
  const hpChanged = c => foundry.utils.hasProperty(c ?? {}, "system.attributes.hp");
  const each = (actor, opts) => { for (const t of tokensFor(actor)) onDeath(t, api, opts); };
  Hooks.on("updateActor", (actor, changes) => { if (hpChanged(changes)) each(actor); });
  Hooks.on("updateToken", (doc, changes) => { if (hpChanged(changes.delta)) onDeath(doc, api); });
  Hooks.on("updateCombatant", (c, changes) => { if (changes.defeated === true) onDeath(c.token, api, { defeated: true }); });
  Hooks.on("createActiveEffect", effect => {
    const actor = effect.parent; const dead = CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
    if (actor instanceof Actor && effect.statuses?.has?.(dead)) each(actor, { defeated: true });
  });
  Hooks.on("renderTokenHUD", (hud, html) => addHudButton(hud, html, api));
  // Vendor Trash adds the No loot button; with it off, Boss loot adds it.
  if (!vendorTrash) Hooks.on("renderTokenHUD", (hud, html) => Trash.addNoLootButton(hud, html, api));
  Hooks.on("renderChatMessageHTML", (message, html) => onRenderCard(message, html, api));
  // Vendor Trash adds the Reset loot button; with it off, Boss loot adds that button itself.
  if (!vendorTrash) Hooks.on("renderTokenHUD", (hud, html) => Trash.addHudButton(hud, html, api, { allowReroll: false }));
}
