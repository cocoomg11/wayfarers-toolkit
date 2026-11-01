/**
 * Remembered window placement (wanderers-core 0.5.0 `RememberedWindow`, 1.30.0): the toolkit's main windows open where this user
 * left them, at the same size, minimized if they were. Stored in one hidden client setting, `wayfarers-toolkit.windowPlacement`
 * (core's, `{ v: 1, windows: { key: { left, top, width, height, minimized } } }`), so each user and browser has its own.
 *
 * The keys are stable: renaming one forgets that window's placement. The quest tracker keeps its own placement code (trackerPos).
 */
import { RememberedWindow, resetPlacement } from "../vendor/wanderers-core/foundry/index.mjs";

const ID = "wayfarers-toolkit";

/** Window → placement key. Never rename a key (users' saved placements are stored under it). */
export const WINDOW_KEYS = Object.freeze({
  panel: "panel", questLog: "questLog", pane: "pane", flightMap: "flightMap", flightEditor: "flightEditor",
  coinLog: "coinLog", lootHistory: "lootHistory", partyGold: "partyGold", health: "health"
});
/** The client setting core keeps the placements in (cleanup resets it with the module's other settings). */
export const PLACEMENT_SETTING = "windowPlacement";

/**
 * `Base` with remembered placement under `WINDOW_KEYS[name]`.
 * @template {new (...args: any[]) => any} T
 * @param {T} Base @param {keyof typeof WINDOW_KEYS} name @param {{ size?: boolean }} [opts]
 * @returns {T}
 */
export const remembered = (Base, name, opts = {}) => RememberedWindow(Base, { moduleId: ID, key: WINDOW_KEYS[name], ...opts });

/** Forgets every remembered window placement of this user (open windows stay until closed and opened again). */
export const resetWindows = () => resetPlacement(ID);
