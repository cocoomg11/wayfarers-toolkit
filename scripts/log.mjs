/**
 * Debug logging: `log(...)` writes to the browser console only when the world setting "Debug logging" is on (wanderers-core
 * createLogger, setting key debugLog), so it costs nothing when off. Used for the toolkit's automatic decisions: why a body got no
 * loot, which GM ran an automatic step, the items and CR bands chosen, how a loot roll was settled.
 */
import { logger } from "./core.mjs";

export const debugOn = () => logger.debugOn();
/** Logs to the console with the module prefix when Debug logging is on. */
export const log = (...args) => logger.log(...args);

/** The name of the user this client runs as, for "automatic step run by …" lines. */
export const byWhom = () => { try { return `${game.user?.name ?? "?"}${game.user?.isGM ? " (GM)" : ""}`; } catch { return "?"; } };
