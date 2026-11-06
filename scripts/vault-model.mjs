/**
 * The GM-only store's data, pure (no Foundry calls; tested in Node). The store (vault.mjs) is one journal entry that only GMs own,
 * with every GM-only record under flags.wayfarers-toolkit.vault: { v, buckets: { name: value } }. Players never need anything in
 * it, so nothing a player client reads (world settings, quest flags and pages, scene notes) holds GM-only data any more.
 *
 * Buckets (each read through its own normalizer, each capped):
 *   flightNetwork  the full flight network (locked points too); the world setting keeps the players' view
 *   goldSnapshots  { v: 1, list } party gold snapshots (was the world setting goldSnapshots)
 *   lootHistory    { v: 1, entries } loot roll history (was the world setting lootHistoryData)
 *   quests         { [journalId]: GM-only quest data } (full quest with hidden objectives and GM notes)
 *   pins           { [pinId]: { sceneId, x, y, level, size, pin } } hidden GM pins (no Note exists until revealed)
 *   rentals        { [actorId]: { innId, inn, sceneId, at } } rooms the GM rented (Rested is checked against these)
 *   coinLog        { v: 1, entries } coin movements the toolkit made, newest first (≤ 200; coinlog-model.mjs) (1.28.0)
 *   renown         { v: 1, factions, scores, applied } hidden factions, characters' renown with them, and the Item Piles price
 *                  entries the toolkit set (renown-model.mjs normalizeHidden; capped there) (2.2.0)
 *   migrations     { [id]: ISO date } one-time moves done
 */
import { versioned, capList, storeDeletions, deletionKeys } from "../vendor/wanderers-core/index.mjs";

export const VAULT_VERSION = 1;
export const VAULT_NAME = "Wanderer's Toolkit (GM only)";
/** The store entry's About page (plain text; core escapes it). */
export const VAULT_ABOUT = "Wanderer's Toolkit keeps GM-only records here (the full flight network, hidden map pins, quest GM notes, room rentals, gold snapshots, loot history, the coin log, hidden renown factions). Don't share this entry with players. Deleting it loses those records.";
export const BUCKETS = ["flightNetwork", "goldSnapshots", "lootHistory", "quests", "pins", "rentals", "coinLog", "renown", "migrations"];
/** Caps: records per keyed bucket. History and snapshot caps stay in their own models (history-model, gold-model). */
export const CAPS = { quests: 2000, pins: 1000, rentals: 200, migrations: 50 };

const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
/** A keyed bucket capped to `max` entries, keeping the newest by `at` when it has one (else insertion order). */
export function capKeyed(map, max) {
  const entries = Object.entries(obj(map)).filter(([k, v]) => typeof k === "string" && k && v && typeof v === "object");
  if (entries.length <= max) return Object.fromEntries(entries);
  const sorted = entries.every(([, v]) => Number.isFinite(v.at)) ? [...entries].sort((a, b) => b[1].at - a[1].at) : entries.slice().reverse();
  return Object.fromEntries(capList(sorted, max));
}

/** The one normalizer for the stored vault. */
export const normalizeVault = versioned({
  version: VAULT_VERSION,
  empty: () => ({ buckets: {} }),
  clean: v => {
    const b = obj(v.buckets); const out = {};
    for (const k of BUCKETS) if (k in b) out[k] = CAPS[k] ? capKeyed(b[k], CAPS[k]) : b[k];
    return { v: VAULT_VERSION, buckets: out };
  }
});

/** A bucket's value, or `fallback`. */
export const bucket = (/** @type {unknown} */ vault, /** @type {string} */ name, /** @type {any} */ fallback = null) => { const b = normalizeVault(vault).buckets; return name in b ? b[name] : fallback; };

/** A new vault with `name` set to `value` (the bucket's cap applied). Unknown names throw (a programming mistake). */
export function withBucket(vault, name, value) {
  if (!BUCKETS.includes(name)) throw new Error(`vault: unknown bucket ${name}`);
  const v = normalizeVault(vault);
  return normalizeVault({ ...v, buckets: { ...v.buckets, [name]: value } });
}

/** A keyed bucket with `key` set (value) or removed (null). */
export function withKey(vault, name, key, value) {
  const cur = { ...obj(bucket(vault, name, {})) };
  if (value === null || value === undefined) delete cur[key]; else cur[key] = value;
  return withBucket(vault, name, cur);
}

/** Whether a one-time migration has run. */
export const migrated = (vault, id) => !!obj(bucket(vault, "migrations", {}))[id];
export const markMigrated = (vault, id, at = new Date().toISOString()) => withKey(vault, "migrations", id, { at: Date.parse(at) || 0, iso: at });

/**
 * The "-=" deletion keys for an update that turns `prev` into `next` under `base` (Foundry merges object updates, so removed keys would
 * otherwise stay). Core's store (vault.mjs) writes these itself (v14's deletion operator when present); this is the same walk, kept
 * for tests and readers: three levels under `base` (v/buckets, the buckets, each bucket's keys), every bucket.
 */
export function deletions(prev, next, base) {
  return deletionKeys(storeDeletions(normalizeVault(prev), normalizeVault(next), base, 3), undefined);
}
