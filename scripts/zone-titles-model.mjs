/**
 * Zone title cards (feature zoneTitles): which title a scene shows and when a card is shown. Pure, no Foundry calls (tested in Node).
 * Per-scene config lives in `flags.wayfarers-toolkit.zoneTitle`: { show: bool, title, subtitle, sound }. A scene never saved with the
 * fieldset has no `show`, so it follows the world setting "Every scene gets a title card".
 */
const ID = "wayfarers-toolkit";
const str = v => (typeof v === "string" ? v.trim() : "");

export const TRIGGERS = { activate: "When a scene is activated", view: "Every time a scene is viewed" };
export const AUDIENCES = { players: "Players only", everyone: "Everyone (GMs too)" };
export const STYLES = { classic: "Classic (gold serif, ornament)", plain: "Plain (white, no ornament)" };

/**
 * A scene's title card: { enabled, title, subtitle, sound }. `scene`: { name, flags }. `all`: the world default for scenes with no
 * per-scene choice; `defaultSound`: the world sound used when the scene names none. A card with no title is never enabled.
 */
export function titleConfig(scene, { all = true, defaultSound = "" } = {}) {
  const f = scene?.flags?.[ID]?.zoneTitle ?? {};
  const enabled = typeof f.show === "boolean" ? f.show : !!all;
  const title = str(f.title) || str(scene?.name);
  return { enabled: enabled && !!title, title, subtitle: str(f.subtitle), sound: str(f.sound) || str(defaultSound) };
}

/**
 * Whether this client shows a card. `reason`: "load" (the first canvas draw after the world loads), "activate" (the scene was just
 * activated) or "view" (any other draw, e.g. a player moved to another scene). `trigger`: activate | view (world setting);
 * `audience`: players | everyone; `onLoad`: show for the scene already active at load.
 */
export function shouldShow({ reason, trigger = "activate", audience = "players", isGM = false, onLoad = false } = {}) {
  if (audience === "players" && isGM) return false;
  if (reason === "load") return !!onLoad;
  if (reason === "activate") return true;
  if (reason === "view") return trigger === "view";
  return false;
}

/** Fade in, hold and fade out in milliseconds. Reduced motion: no fades (instant show and hide), same hold. */
export function timeline(seconds, reducedMotion = false) {
  const hold = Math.round(Math.min(15, Math.max(1, Number(seconds) || 4)) * 1000);
  return reducedMotion ? { fadeIn: 0, hold, fadeOut: 0 } : { fadeIn: 900, hold, fadeOut: 1200 };
}
