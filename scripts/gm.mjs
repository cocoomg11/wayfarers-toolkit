/**
 * One GM does the automatic work. A world can have several GM users logged in at once; every hook that writes documents on its own
 * (pre-rolled loot, bodies made lootable, boss loot draws, loot roll results, flights booked by players, warnings about the world's
 * setup) runs only on the active GM's client, so nothing happens twice. Buttons and macros a GM clicks still run on that GM's client.
 * The pure helper takes plain objects and is tested in Node.
 */

/** The active GM: Foundry's own pick when it is an active GM, else the active GM with the lowest user id, else null. */
export function pickActiveGM(users = [], declared = null) {
  if (declared && declared.isGM && declared.active) return declared;
  return [...users].filter(u => u?.isGM && u.active).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
}

/** The active GM user of this world, or null when no GM is connected. */
export function activeGM() {
  try { return pickActiveGM(game.users?.contents ?? [...(game.users ?? [])], game.users?.activeGM ?? null); } catch { return null; }
}

/** True on the active GM's client only. */
export function isActiveGM() {
  const gm = activeGM(); return !!gm && gm.id === game.user?.id;
}

/** GMs connected right now. */
export function onlineGMs() {
  try { return game.users.filter(u => u.isGM && u.active); } catch { return []; }
}
