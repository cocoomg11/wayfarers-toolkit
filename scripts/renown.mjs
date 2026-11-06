/**
 * Renown (feature `renown`): per-character renown with GM-defined factions. The data layer: reading the world setting (shared tiers,
 * presets, factions players may see), the GM-only store (hidden factions, renown with them, the Item Piles entries the toolkit set)
 * and each character's actor flag; GM writes (award, score, other sources, factions, tiers); the award chat card; the
 * `wayfarers-toolkit.renownChanged` hook; and the Item Piles merchant discount. Pure rules: renown-model.mjs; HTML:
 * renown-view-model.mjs; windows: renown-apps.mjs.
 *
 * Writes: every change is a GM click (award dialog, sheet page, faction setup, quest rewards paid by a GM) and runs on that GM's
 * client, like the quest log's writes; players only ever change which faction their own character tracks (their own actor flag).
 * Nothing here writes on its own except the discount re-check, which runs only on the leader (isActiveGM) at ready.
 */
import * as R from "./renown-model.mjs";
import * as RV from "./renown-view-model.mjs";
import * as Vault from "./vault.mjs";
import { bucket, withBucket } from "./vault-model.mjs";
import { on as featureOn } from "./features.mjs";
import { isActiveGM, settled } from "./gm.mjs";
import { card } from "./look-model.mjs";
import { deletionKeys } from "../vendor/wanderers-core/index.mjs";

const ID = "wayfarers-toolkit";
export const SETTING = "renownConfig";
const FLAG = "renown";
const PATH = `flags.${ID}.${FLAG}`;

/** Hooks for other modules (feature moduleHooks), set by init(). */
let HOOKS = false;
/** Called after anything changes, so open sheets and windows redraw (set by renown-apps.mjs). */
/** @type {() => void} */
let onChanged = () => { };
export const setRefresher = (/** @type {() => void} */ fn) => { onChanged = fn; };
/**
 * Rebuilds the public copy (journal flag and page) of every quest whose rewards name a faction, so a faction hidden, shown, renamed
 * or deleted never leaves its name (or misses its reward) in what players read. Set by quests.mjs (quest log on); resolves to the
 * number of quests re-saved.
 * @type {(factionId: string) => Promise<number>}
 */
let resaveQuests = async () => 0;
export const setQuestResaver = (/** @type {(factionId: string) => Promise<number>} */ fn) => { resaveQuests = fn; };
/** Calls the quest re-save, never throwing (a quest that fails to save is logged; the faction change stands). */
async function refreshQuests(fid) {
  try { return await resaveQuests(fid); } catch (e) { console.warn(`${ID} | renown: quests naming ${fid}`, e); return 0; }
}

// ---------------------------------------------------------------- reading
/** The world setting, cleaned. */
export function config() { try { return R.normalizeConfig(game.settings.get(ID, SETTING)); } catch { return R.normalizeConfig(null); } }
/** The GM-only bucket (players: always empty). */
export const hidden = () => R.normalizeHidden(game.user?.isGM ? Vault.get("renown", null) : null);
/** The factions this user may see: GMs every faction (hidden ones marked), players the visible ones. */
export const factions = () => (game.user?.isGM ? R.allFactions(config(), hidden()) : config().factions.map(f => ({ ...f, hidden: false })));
/** Whether a faction id is one players may see (quest rewards' public view). */
export const isShown = (/** @type {string} */ id) => config().factions.some(f => f.id === id);
/** A faction by id or name (exact, then ignoring case). */
export function faction(ref) {
  if (!ref) return null;
  const id = typeof ref === "object" ? ref.id : String(ref); const list = factions();
  return list.find(f => f.id === id) ?? list.find(f => f.name === id) ?? list.find(f => f.name.toLowerCase() === id.toLowerCase()) ?? null;
}
/** An actor from an Actor, a token, an id, a UUID or a name. */
export function actorOf(ref) {
  if (!ref) return null;
  if (ref instanceof Actor) return ref;
  if (ref.actor instanceof Actor) return ref.actor;
  const s = String(ref);
  try { return game.actors.get(s) ?? (s.includes(".") ? foundry.utils.fromUuidSync(s) : null) ?? game.actors.getName(s) ?? null; } catch { return null; }
}
/** The actor flag, cleaned. */
export const actorData = (/** @type {any} */ a) => R.normalizeActor(a?.getFlag?.(ID, FLAG));
/**
 * A character's entry with a faction ({ score, ribbons }) from where it is kept. Pass `h` (one hidden() read) when calling in a loop.
 * @param {any} a @param {any} f @param {any} [h]
 */
export const entryFor = (a, f, h = undefined) => R.readEntry({ actorId: a.id, actorData: actorData(a), hidden: f?.hidden ? (h ?? hidden()) : null, faction: f });
/**
 * GM: changes the GM-only bucket with `fn(current) → next` (both read as maps) and stores it as arrays (R.storeHidden), so removed
 * entries and records really go (a Foundry update merges objects but replaces arrays).
 * @param {(h: ReturnType<typeof R.normalizeHidden>) => any} fn
 */
export const writeHidden = fn => Vault.update(v => withBucket(v, "renown", R.storeHidden(fn(R.normalizeHidden(bucket(v, "renown", null))))));
/** Every faction this user sees → this character's entry. */
export function entriesFor(a) {
  const h = hidden(); const d = actorData(a); const out = {};
  for (const f of factions()) out[f.id] = R.readEntry({ actorId: a.id, actorData: d, hidden: h, faction: f });
  return out;
}
/** api.renown.get(actor): this character's renown with every faction this user sees (no hidden factions for players). */
export function get(ref) {
  const a = actorOf(ref); if (!a) return null;
  const c = config(); const e = entriesFor(a); const tracked = actorData(a).tracked;
  return factions().map(f => {
    const s = R.standing(e[f.id], R.tiersOf(f, c));
    return { factionId: f.id, name: f.name, hidden: !!f.hidden, score: e[f.id].score, total: s.total, tier: s.tier?.name ?? null, tierIndex: s.index, next: s.next ? { name: s.next.name, from: s.next.from } : null, discount: s.discount, ribbons: e[f.id].ribbons.map(r => ({ ...r })), tracked: tracked === f.id };
  });
}

// ---------------------------------------------------------------- writing (GM)
const gmOnly = () => { if (game.user?.isGM) return true; ui.notifications.warn("Renown: only the GM can change renown."); return false; };

/** Writes one character's entry with one faction where it belongs. */
async function setEntry(a, f, entry) {
  if (f.hidden) {
    await writeHidden(h => R.withHiddenEntry(h, a.id, f.id, entry));
    return;
  }
  const prev = actorData(a); const next = R.withEntry(prev, f.id, entry);
  await a.update({ [PATH]: next, ...deletionKeys(R.removedPaths(prev, next, PATH), /** @type {any} */ (globalThis)._del) });
}

/** Fires renownChanged (feature moduleHooks) after a change: ids and numbers only. */
function emit(a, f, before, after, delta) {
  if (!HOOKS) return;
  const tiers = R.tiersOf(f, config());
  const p = R.hookPayload({ actorId: a.id, factionId: f.id, before, after, delta, tierBefore: R.tierIndex(before, tiers), tierAfter: R.tierIndex(after, tiers) });
  if (!p) return;
  try { Hooks.callAll(R.RENOWN_HOOK, p); } catch (e) { console.warn(`${ID} | ${R.RENOWN_HOOK} listener`, e); }
}

/** Changes one entry with `fn(entry) → entry`, then fires the hook and redraws. Returns { before, after } totals. */
async function change(a, f, fn) {
  const e = entryFor(a, f); const before = R.totalOf(e);
  const next = R.normalizeEntry(fn(e));
  await setEntry(a, f, next);
  const after = R.totalOf(next);
  if (after !== before || next.score !== e.score) emit(a, f, before, after, next.score - e.score);
  return { before, after, score: next.score, prevScore: e.score };
}

/** Who reads a card about these characters: the GMs, plus their owners unless the faction is hidden. */
function cardReaders(actors, f) {
  return game.users.filter(u => u.isGM || (!f.hidden && actors.some(a => { try { return a.testUserPermission(u, "OWNER"); } catch { return false; } }))).map(u => u.id);
}

/**
 * Awards (or takes) renown: `actors` one or several characters, `amount` a number, "+2", "−3" or a dice formula ("−2d6": a loss
 * rolled per character). Each character changes on their own score, never below 0. Posts the chat card (GMs and the characters'
 * owners; GMs only for a hidden faction) unless `card: false`. Returns [{ actorId, delta, before, after }] or null.
 * @param {any} actorsRef @param {any} factionRef @param {any} amount @param {{ reason?: string, card?: boolean }} [opts]
 */
export async function award(actorsRef, factionRef, amount, { reason = "", card: post = true } = {}) {
  if (!gmOnly()) return null;
  const f = faction(factionRef); if (!f) { ui.notifications.warn(`Renown: no faction "${factionRef?.name ?? factionRef}".`); return null; }
  const amt = R.parseAmount(amount); if (!amt) { ui.notifications.warn(`Renown: "${amount}" isn't an amount (e.g. +2, −1 or −2d6).`); return null; }
  const actors = (Array.isArray(actorsRef) ? actorsRef : [actorsRef]).map(actorOf).filter(Boolean);
  if (!actors.length) { ui.notifications.warn("Renown: no character to award."); return null; }
  const tiers = R.tiersOf(f, config()); const rows = []; const out = [];
  for (const a of actors) {
    /** @type {{ formula: string, total: number } | null} */
    let roll = null; let delta;
    if (amt.kind === "flat") delta = amt.value;
    else { const r = await new Roll(amt.formula).evaluate(); roll = { formula: amt.formula, total: r.total }; delta = amt.sign * Math.max(0, Math.round(r.total)); }
    const res = await change(a, f, e => ({ ...e, score: R.applyDelta(e.score, delta) }));
    const ti = R.tierIndex(res.after, tiers); const t = ti >= 0 ? tiers[ti] : null;
    // The card shows what was applied (a loss stops at 0), with the roll as rolled.
    rows.push({ name: a.name, delta: res.score - res.prevScore, roll, before: res.before, after: res.after, tierBefore: R.tierIndex(res.before, tiers), tierAfter: ti, tierName: t?.name ?? R.NO_TIER.name, tierColor: t?.color ?? R.NO_TIER.color, tierText: R.tierText(t, { on: discountsOn() }) });
    out.push({ actorId: a.id, delta: res.score - res.prevScore, before: res.before, after: res.after });
  }
  if (post) {
    await ChatMessage.create({
      content: card(RV.cardHTML({ faction: f.name, reason: String(reason ?? "").slice(0, 200), rows }), "wct-renown"),
      speaker: { alias: "Renown" }, whisper: cardReaders(actors, f), flags: { [ID]: { renownCard: { v: 1 } } }
    });
  }
  // 2.2.1: an award updates merchant prices at once (other changes still batch with scheduleSync).
  await syncNow(); onChanged();
  return out;
}

/** GM: sets a character's score with a faction (no card). */
export async function setScore(actorRef, factionRef, score) {
  if (!gmOnly()) return null;
  const a = actorOf(actorRef); const f = faction(factionRef); if (!a || !f) return null;
  const res = await change(a, f, e => ({ ...e, score: R.applyDelta(0, Number(score) || 0) }));
  scheduleSync(); onChanged();
  return res;
}
/** GM: adds an "other source" (a label with an amount, counted into the total) to a character's row. */
export async function addSource(actorRef, factionRef, text, amount = 0) {
  if (!gmOnly()) return null;
  const a = actorOf(actorRef); const f = faction(factionRef); if (!a || !f) return null;
  // 2.2.1: a label must be text (an object used to be stored as "[object Object]") and an amount a whole number.
  const check = R.sourceInput(text, amount);
  if (!check.ok) { ui.notifications.warn(`Renown: ${check.reason}`); return null; }
  const rib = R.normalizeRibbon({ text: check.text, amount: check.amount }, { now: Date.now() }); if (!rib) return null;
  const cur = entryFor(a, f);
  if (cur.ribbons.length >= R.RIBBONS_MAX) { ui.notifications.warn(`Renown: at most ${R.RIBBONS_MAX} other sources per faction.`); return null; }
  const res = await change(a, f, e => ({ ...e, ribbons: [...e.ribbons, rib] }));
  scheduleSync(); onChanged();
  return { ...res, id: rib.id };
}
/** GM: removes an other source by id. */
export async function removeSource(actorRef, factionRef, ribbonId) {
  if (!gmOnly()) return null;
  const a = actorOf(actorRef); const f = faction(factionRef); if (!a || !f) return null;
  const res = await change(a, f, e => ({ ...e, ribbons: e.ribbons.filter(r => r.id !== ribbonId) }));
  scheduleSync(); onChanged();
  return res;
}
/** The character's owner or a GM: pins a faction at the top of the page ("" or the tracked one again: unpins). */
export async function track(actorRef, factionRef) {
  const a = actorOf(actorRef); if (!a) return null;
  if (!a.isOwner) { ui.notifications.warn("Renown: only the character's owner can choose what it tracks."); return null; }
  const f = factionRef ? faction(factionRef) : null;
  if (f?.hidden) { ui.notifications.warn("Renown: a hidden faction can't be tracked (players would see it). Show it to players first."); return null; }
  const d = actorData(a); const id = f && d.tracked !== f.id ? f.id : "";
  await a.update({ [`${PATH}.tracked`]: id, [`${PATH}.v`]: R.RENOWN_VERSION });
  return id;
}

// ---------------------------------------------------------------- factions and tiers (GM)
/** Actors that carry a renown flag, as [{ id, data }]. */
const flagged = () => game.actors.filter(a => a.getFlag(ID, FLAG)).map(a => ({ id: a.id, data: actorData(a) }));
/** Writes actor flags in full (deleting faction keys that went away). */
async function writeActors(list) {
  for (const { id, data } of list) {
    const a = game.actors.get(id); if (!a) continue;
    const prev = actorData(a);
    await a.update({ [PATH]: data, ...deletionKeys(R.removedPaths(prev, data, PATH), /** @type {any} */ (globalThis)._del) });
  }
}

/**
 * GM: creates or updates a faction from the setup window. `data.hidden` decides where it is kept; switching it moves the faction
 * and every character's renown with it (actor flags ↔ GM-only store). A merchant belongs to one faction: ticking it here unticks
 * it elsewhere. Returns the faction id.
 * @param {any} data
 */
export async function saveFaction(data) {
  if (!gmOnly()) return null;
  const f = R.normalizeFaction(data); const wantHidden = !!data?.hidden;
  let c = config(); let h = hidden();
  const wasHidden = h.factions.some(x => x.id === f.id); const wasVisible = c.factions.some(x => x.id === f.id);
  const before = R.factionById(R.allFactions(c, h), f.id);
  if ((wasHidden && !wantHidden) || (wasVisible && wantHidden)) {
    const m = R.moveFaction({ config: c, hidden: h, actors: flagged(), factionId: f.id, hide: wantHidden });
    // Write the destination first, so a character's renown is never only in the place that is about to be cleared.
    const store = () => writeHidden(cur => ({ ...m.hidden, applied: cur.applied }));
    if (wantHidden) { await store(); await writeActors(m.actors); } else { await writeActors(m.actors); await store(); }
    c = m.config; h = m.hidden;
  }
  const strip = (/** @type {any[]} */ list) => list.map(x => (x.id === f.id ? x : { ...x, merchants: x.merchants.filter((/** @type {string} */ id) => !f.merchants.includes(id)) }));
  const put = (/** @type {any[]} */ list) => (list.some(x => x.id === f.id) ? list.map(x => (x.id === f.id ? f : x)) : [...list, f]);
  const vis = strip(wantHidden ? c.factions : put(c.factions)); const hid = strip(wantHidden ? put(h.factions) : h.factions);
  if (vis.length + hid.length > R.FACTIONS_MAX) { ui.notifications.warn(`Renown: at most ${R.FACTIONS_MAX} factions.`); return null; }
  await game.settings.set(ID, SETTING, R.normalizeConfig({ ...c, factions: vis }));
  await writeHidden(cur => ({ ...cur, factions: hid }));
  // Players' copy of quests naming it: rebuilt when its visibility or name changed (old pages would show or miss it).
  if (before && (before.hidden !== wantHidden || before.name !== f.name)) await refreshQuests(f.id);
  scheduleSync(); onChanged();
  return f.id;
}
/** GM: deletes a faction and every character's renown with it. */
export async function deleteFaction(id) {
  if (!gmOnly()) return false;
  const c = config();
  await writeActors(flagged().filter(a => a.data.scores[id] || a.data.ribbons[id] || a.data.tracked === id).map(a => ({ id: a.id, data: R.withoutFaction(a.data, id) })));
  await writeHidden(h => {
    const scores = Object.fromEntries(Object.entries(h.scores).map(([k, m]) => [k, Object.fromEntries(Object.entries(m).filter(([fid]) => fid !== id))]));
    return { ...h, scores, factions: h.factions.filter(f => f.id !== id) };
  });
  if (c.factions.some(f => f.id === id)) await game.settings.set(ID, SETTING, R.normalizeConfig({ ...c, factions: c.factions.filter(f => f.id !== id) }));
  await refreshQuests(id);
  scheduleSync(); onChanged();
  return true;
}
/** GM: the shared tier set, the award presets and the starting-faction bonus steps. @param {{ tiers?: any, gains?: any, losses?: any, startBonus?: any }} [o] */
export async function saveShared({ tiers, gains, losses, startBonus } = {}) {
  if (!gmOnly()) return null;
  const c = config();
  await game.settings.set(ID, SETTING, R.normalizeConfig({ ...c, tiers: tiers ?? c.tiers, gains: gains ?? c.gains, losses: losses ?? c.losses, startBonus: startBonus ?? c.startBonus }));
  scheduleSync(); onChanged();
  return config();
}
/** How many characters have renown (score or other sources) with each faction: { factionId: n }. GM. */
export function characterCounts() {
  const out = {}; const h = hidden();
  for (const a of game.actors) {
    const d = actorData(a);
    for (const k of new Set([...Object.keys(d.scores), ...Object.keys(d.ribbons)])) out[k] = (out[k] ?? 0) + 1;
  }
  for (const m of Object.values(h.scores)) for (const k of Object.keys(m)) out[k] = (out[k] ?? 0) + 1;
  return out;
}
/** Every other source on every character for a faction: [{ actor, text, amount }] (the setup window lists them). GM. */
export function sourcesOf(fid) {
  const f = faction(fid); if (!f) return [];
  const h = hidden();
  return game.actors.filter(a => a.type === "character").flatMap(a => entryFor(a, f, h).ribbons.map(r => ({ actor: a.name, text: r.text, amount: r.amount })));
}

// ---------------------------------------------------------------- Item Piles merchant discount
/** Whether merchant discounts are applied through Item Piles (features renown and renownDiscounts both on). */
export const discountsOn = () => R.discountsOn(featureOn);
/** Item Piles' API when it is active and offers per-actor merchant prices, else null. */
export function itemPiles() {
  if (!game.modules.get("item-piles")?.active) return null;
  const IP = game.itempiles?.API;
  return IP?.updateMerchantPriceModifiers && IP?.isItemPileMerchant ? IP : null;
}
/**
 * The discount plan for every linked merchant (and merchants the toolkit changed before that are no longer linked), without writing:
 * [{ merchantId, merchant, faction, plan, problem }]. `problem`: "missing" (no such actor), "notMerchant", "noItemPiles". GM.
 */
export function discountPlans() {
  const facs = factions(); const links = R.merchantFactions(facs); const h = hidden(); const c = config(); const IP = itemPiles();
  const pcs = game.actors.filter(a => a.type === "character");
  const ids = [...new Set([...Object.keys(links), ...Object.keys(h.applied)])];
  return ids.map(mid => {
    const m = game.actors.get(mid) ?? null; const f = links[mid] ? R.factionById(facs, links[mid]) : null;
    if (!IP) return { merchantId: mid, merchant: m, faction: f, plan: null, problem: "noItemPiles" };
    if (!m) return { merchantId: mid, merchant: null, faction: f, plan: null, problem: "missing" };
    let isMerchant = false; try { isMerchant = !!IP.isItemPileMerchant(m); } catch { isMerchant = false; }
    if (!isMerchant) return { merchantId: mid, merchant: m, faction: f, plan: null, problem: "notMerchant" };
    /** @type {Record<string, number>} */
    const wants = {};
    if (f) {
      const tiers = R.tiersOf(f, c);
      for (const pc of pcs) { const d = R.standing(entryFor(pc, f, h), tiers).discount; if (d) wants[pc.uuid] = d; }
    }
    const entries = foundry.utils.getProperty(m, "flags.item-piles.data.actorPriceModifiers") ?? [];
    return { merchantId: mid, merchant: m, faction: f, plan: R.merchantPlan({ entries: Array.isArray(entries) ? entries : [], applied: h.applied[mid] ?? {}, wants }), problem: null };
  });
}
let lastSync = /** @type {null | { at: number, written: number, skipped: string[], error?: string }} */ (null);
/** The last sync on this client (health check). */
export const syncStatus = () => lastSync;
/**
 * GM: makes linked merchants' per-character buy prices match renown discounts through Item Piles' own API
 * (`updateMerchantPriceModifiers`), changing only entries the toolkit set itself, and records what it set in the GM-only store.
 */
export async function syncMerchants() {
  if (!game.user?.isGM || !discountsOn() || !itemPiles()) return null;
  const IP = itemPiles(); const plans = discountPlans(); const applied = { ...hidden().applied };
  let written = 0; const skipped = [];
  try {
    for (const p of plans) {
      if (p.problem === "missing") { delete applied[p.merchantId]; continue; }
      if (!p.plan || !p.merchant) continue;
      if (p.plan.writes.length) { await IP.updateMerchantPriceModifiers(p.merchant, p.plan.writes.map(w => ({ ...w }))); written += p.plan.writes.length; }
      if (Object.keys(p.plan.applied).length) applied[p.merchantId] = p.plan.applied; else delete applied[p.merchantId];
      for (const uuid of p.plan.skipped) skipped.push(`${p.merchant.name}: ${(() => { try { return foundry.utils.fromUuidSync(uuid)?.name ?? uuid; } catch { return uuid; } })()}`);
    }
    if (JSON.stringify(applied) !== JSON.stringify(hidden().applied)) await writeHidden(cur => ({ ...cur, applied }));
    lastSync = { at: Date.now(), written, skipped };
  } catch (e) {
    console.warn(`${ID} | renown: merchant discounts`, e);
    lastSync = { at: Date.now(), written, skipped, error: String(/** @type {any} */ (e)?.message ?? e) };
  }
  return lastSync;
}
let syncTimer = /** @type {any} */ (null);
/** A sync a moment later (several changes in a row write once). GM clients only. */
/** GM: the merchant discount update now, instead of a moment later (a pending scheduled one is dropped). Never throws. */
export async function syncNow() {
  if (!game.user?.isGM || !discountsOn()) return null;
  clearTimeout(syncTimer);
  try { return await syncMerchants(); } catch (e) { console.warn(`${ID} | renown sync`, e); return null; }
}
export function scheduleSync() {
  if (!game.user?.isGM || !discountsOn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncMerchants().catch(e => console.warn(`${ID} | renown sync`, e)); }, 800);
}
/**
 * Remove toolkit data: puts every Item Piles price entry the toolkit set back to neutral (buy 1, sell kept). Returns how many.
 * Runs whether the feature is on or not.
 */
export async function resetDiscounts() {
  const IP = game.modules.get("item-piles")?.active ? game.itempiles?.API : null;
  const h = hidden(); let n = 0;
  for (const [mid, map] of Object.entries(h.applied)) {
    const m = game.actors.get(mid); if (!m || !IP?.updateMerchantPriceModifiers) continue;
    const entries = foundry.utils.getProperty(m, "flags.item-piles.data.actorPriceModifiers") ?? [];
    const plan = R.merchantPlan({ entries: Array.isArray(entries) ? entries : [], applied: map, wants: {} });
    try { if (plan.writes.length) { await IP.updateMerchantPriceModifiers(m, plan.writes); n += plan.writes.length; } } catch (e) { console.warn(`${ID} | renown: reset discounts on ${m.name}`, e); }
  }
  if (Object.keys(h.applied).length && Vault.entry()) await writeHidden(cur => ({ ...cur, applied: {} }));
  return n;
}
/** How many Item Piles price entries the toolkit set (cleanup counts them). GM. */
export const discountCount = () => Object.values(hidden().applied).reduce((n, m) => n + Object.keys(m).length, 0);

// ---------------------------------------------------------------- setup
/** The world setting; registered whether the feature is on or not (cleanup and the panel see it). */
export function registerSettings() {
  game.settings.register(ID, SETTING, { name: "Renown: factions, tiers and presets", hint: "Edited in Factions and renown (control panel › Character).", scope: "world", config: false, type: Object, default: {}, onChange: () => onChanged() });
}
/**
 * init, whatever the feature setting: with Renown or its Merchant discounts switch turned off, the leader puts back the Item Piles
 * prices it recorded once Item Piles is ready (R.offReset), so a turned-off feature leaves no discount behind.
 */
export function initAlways() {
  if (discountsOn()) return;
  Hooks.once("ready", () => {
    const run = () => settled().then(async () => {
      if (!isActiveGM() || !R.offReset({ on: discountsOn(), count: discountCount(), itemPiles: !!game.itempiles?.API?.updateMerchantPriceModifiers })) return;
      const n = await resetDiscounts();
      if (n) ui.notifications.info(`Wanderer's Toolkit: Renown merchant discounts are off, so the ${n} Item Piles merchant price${n === 1 ? "" : "s"} it set ${n === 1 ? "is" : "are"} back to normal.`);
    }).catch(e => console.warn(`${ID} | renown off: prices`, e));
    if (game.itempiles?.API) run(); else Hooks.once("item-piles-ready", () => setTimeout(run, 2500));
  });
}
/** init (feature on): the hook switch. */
export function init({ hooks = false } = {}) { HOOKS = !!hooks; }
/** ready (feature on): the leader re-checks merchant discounts once Item Piles is ready (its data may have changed meanwhile). */
export function ready() {
  if (!discountsOn()) return; // initAlways puts back what a turned-off discount set
  const run = () => settled().then(() => { if (isActiveGM()) scheduleSync(); }).catch(() => { });
  if (game.itempiles?.API) run(); else Hooks.once("item-piles-ready", () => setTimeout(run, 2500));
}
