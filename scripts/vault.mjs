/**
 * The GM-only store (Foundry half; data shape and caps in vault-model.mjs). One journal entry, "Wayfarer's Toolkit (GM only)", with
 * default ownership None and no player owners, holds every GM-only record under flags.wayfarers-toolkit.vault. Before 1.27.0 these
 * lived where every client could read them: world settings (flight network with locked points, gold snapshots, loot history), quest
 * flags and pages (hidden objectives, GM text) and scene notes (hidden GM pins).
 *
 * Only GMs read or write it. The leader creates it on first use; any GM client can write (GM actions run on that GM's client).
 * Every read is synchronous (the entry is a local document on GM clients). Writes are chained so two in a row don't overwrite each
 * other. It is never deleted by the module except through Remove toolkit data (category journals).
 *
 * Whether Foundry withholds a None-ownership journal entry from player clients is Foundry's behaviour, not ours: see the README
 * (GM-only data) and the live checklist. This file is the one place to change if the store has to move (for example to a
 * GM-only compendium pack).
 */
import * as M from "./vault-model.mjs";

const ID = "wayfarers-toolkit";

/** The store's journal entry, or null (players: always null; they never look). */
export function entry() {
  if (!game.user?.isGM) return null;
  try { return game.journal?.find(j => j.getFlag?.(ID, "vaultEntry") === true) ?? null; } catch { return null; }
}

/** The normalized vault ({ v, buckets }); empty for players and before it exists. */
export function read() {
  const j = entry(); const raw = j ? j.getFlag(ID, "vault") : null;
  // Normalizing clones the whole store; quest and pin drawing read it often, so keep the result until the stored object changes.
  if (raw !== cache.raw) cache = { raw, value: M.normalizeVault(raw) };
  return cache.value;
}
let cache = { raw: undefined, value: null };
/** A bucket's value (vault-model BUCKETS), or `fallback`. GM only; players get `fallback`. */
export const get = (name, fallback = null) => { const b = read().buckets; return name in b ? b[name] : fallback; };
// Values from get() are the cached copy: read them, never change them in place (change the store with update()).

let creating = null;
async function ensure() {
  const j = entry(); if (j) return j;
  if (!game.user?.isGM) throw new Error("GM only");
  creating ??= JournalEntry.create({
    name: M.VAULT_NAME, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    flags: { [ID]: { vaultEntry: true, vault: M.normalizeVault(null) } },
    pages: [{ name: "About", type: "text", text: { format: 1, content: "<p>Wayfarer's Toolkit keeps GM-only records here (the full flight network, hidden map pins, quest GM notes, room rentals, gold snapshots, loot history). Don't share this entry with players. Deleting it loses those records.</p>" } }]
  }).finally(() => { creating = null; });
  return creating;
}

let chain = Promise.resolve();
/** GM: changes the vault with `fn(vault) → vault` (pure), one change at a time. Resolves to the new vault. */
export function update(fn) {
  if (!game.user?.isGM) return Promise.reject(new Error("Only a GM can change the toolkit's GM-only records."));
  const run = chain.then(async () => {
    const j = await ensure();
    const next = M.normalizeVault(fn(M.normalizeVault(j.getFlag(ID, "vault"))));
    const prev = M.normalizeVault(j.getFlag(ID, "vault"));
    // A merge update, plus a "-=" deletion for every key that went away (so a removed pin or quest is really gone).
    await j.update({ [`flags.${ID}.vault`]: next, ...M.deletions(prev, next, `flags.${ID}.vault`) });
    return next;
  });
  chain = run.catch(e => console.warn(`${ID} | GM-only records`, e));
  return run;
}
export const set = (name, value) => update(v => M.withBucket(v, name, value));
export const setKey = (name, key, value) => update(v => M.withKey(v, name, key, value));
export const migrated = id => M.migrated(read(), id);
export const markMigrated = id => update(v => M.markMigrated(v, id));

/** For the health check: { exists, playersCanSee: [user names], size }. */
export function status() {
  const j = entry(); if (!j) return { exists: false, playersCanSee: [], buckets: [] };
  const see = game.users.filter(u => !u.isGM && j.testUserPermission(u, "LIMITED")).map(u => u.name);
  return { exists: true, playersCanSee: see, buckets: Object.keys(read().buckets) };
}
