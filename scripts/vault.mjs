/**
 * The GM-only store (Foundry half; data shape and caps in vault-model.mjs), on wanderers-core's `createStore` (core 0.5.0). One
 * journal entry, "Wanderer's Toolkit (GM only)", with default ownership None and no player owners, holds every GM-only record under
 * flags.wayfarers-toolkit.vault. Before 1.27.0 these lived where every client could read them: world settings (flight network with
 * locked points, gold snapshots, loot history), quest flags and pages (hidden objectives, GM text) and scene notes (hidden GM pins).
 *
 * The entry is found exactly as before: by the marker flag `flags.wayfarers-toolkit.vaultEntry === true`, never by name, so an
 * existing world keeps its entry, name and data. The only move is core's one-time filing: `file()` (the leader, at ready) puts a
 * root-level entry into the shared "Module data" journal folder once and marks it `flags.wayfarers-toolkit.dataFolderFiled`, so a GM
 * who moves it afterwards keeps their choice. A new world's entry is created inside that folder on the first GM write.
 *
 * Only GMs read or write it. Any GM client can write (GM actions run on that GM's client); writes are chained so two in a row don't
 * overwrite each other, and keys that went away are deleted (core's deletions, three levels under the data flag). Every read is
 * synchronous (cached until the entry changes). It is removed only through Remove toolkit data (category vault), with `remove()`,
 * which also deletes the "Module data" folder when nothing else is left in it.
 *
 * Not secrecy: a None-ownership journal is still sent to players' clients (checked on 14.369). See the README (GM-only data). This
 * file is the one place that knows where the store lives.
 */
import { createStore } from "../vendor/wanderers-core/foundry/index.mjs";
import * as M from "./vault-model.mjs";
import { logger } from "./core.mjs";
import { isActiveGM } from "./gm.mjs";

const ID = "wayfarers-toolkit";

/** The core store bound to the toolkit's vault. */
export const Store = createStore(ID, {
  name: M.VAULT_NAME, flagKey: "vault", entryFlag: "vaultEntry", normalize: M.normalizeVault, keysAt: "buckets", keys: M.BUCKETS,
  deleteDepth: 3, about: M.VAULT_ABOUT, log: logger, isWriter: isActiveGM
});

/** The store's journal entry, or null (players: always null; they never look). */
export const entry = () => Store.entry();

/**
 * The normalized vault ({ v, buckets }); empty for players and before it exists.
 * @returns {{ v: number, buckets: Record<string, any> }}
 */
export const read = () => Store.read();
/** A bucket's value (vault-model BUCKETS), or `fallback`. GM only; players get `fallback`. */
export const get = (/** @type {string} */ name, /** @type {any} */ fallback = null) => Store.get(name, fallback);
// Values from get() are the cached copy: read them, never change them in place (change the store with update()).

/**
 * GM: changes the vault with `fn(vault) → vault` (pure), one change at a time. Resolves to the new vault.
 * @param {(v: { v: number, buckets: Record<string, any> }) => any} fn
 */
export const update = fn => Store.update(fn);
/** GM: one bucket's whole value (unknown buckets throw). */
export const set = (/** @type {string} */ name, /** @type {any} */ value) => Store.set(name, value);
/** GM: one key of a keyed bucket (null removes it). */
export const setKey = (/** @type {string} */ name, /** @type {string} */ key, /** @type {any} */ value) => Store.setKey(name, key, value);
export const migrated = (/** @type {string} */ id) => M.migrated(read(), id);
export const markMigrated = (/** @type {string} */ id) => update(v => M.markMigrated(v, id));
/** The leader, at ready: files a root-level entry in "Module data" once. Never throws. */
export const file = () => Store.file();
/** Cleanup: deletes the entry (every copy) and the "Module data" folder when empty. Resolves to the number deleted. */
export const remove = () => Store.remove();

/** For the health check: { exists, playersCanSee: [user names], buckets, name, count, filed, inFolder }. */
export function status() {
  const s = Store.status();
  const j = Store.entry();
  const filed = !!j && j.getFlag?.(ID, "dataFolderFiled") === true;
  const inFolder = !!(j?.folder?.id ?? j?.folder);
  return { exists: s.exists, playersCanSee: s.playersCanSee, buckets: s.keys, name: s.name, count: s.count, filed, inFolder };
}
