/**
 * Debug logging: `log(...)` writes to the browser console only when the world setting "Debug logging" is on, so it costs nothing
 * (and prints nothing) when off. Used for the toolkit's automatic decisions: why a body got no loot, which GM ran an automatic step,
 * the items and CR bands chosen, how a loot roll was settled.
 */
const ID = "wayfarers-toolkit";

export function debugOn() {
  try { return !!game.settings.get(ID, "debugLog"); } catch { return false; }
}

/** Logs to the console with the module prefix when Debug logging is on. */
export function log(...args) {
  if (!debugOn()) return;
  console.log(`${ID} [debug] |`, ...args);
}

/** The name of the user this client runs as, for "automatic step run by …" lines. */
export const byWhom = () => { try { return `${game.user?.name ?? "?"}${game.user?.isGM ? " (GM)" : ""}`; } catch { return "?"; } };
