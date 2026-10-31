/**
 * Boss phase marks: the pure part (tested in Node). A boss has phase thresholds in percent of its health, for example [66, 33]: it's
 * in phase 1 above 66%, phase 2 below 66%, phase 3 below 33%. The GM is told once each time health drops below a threshold; the mark
 * resets when the boss is healed back to it or above, so a later drop tells the GM again.
 * Stored on the token (flags.wayfarers-toolkit.phases: [66, 33]) or on its world actor for every token; which thresholds have been
 * passed is kept on the token (flags.wayfarers-toolkit.phasesPassed).
 */

/** Thresholds from a list or text ("66, 33", "66% 33%") → whole numbers between 1 and 99, highest first, no repeats. */
export function parsePhases(v) {
  const raw = Array.isArray(v) ? v : String(v ?? "").split(/[\s,;/]+/);
  const out = new Set();
  for (const x of raw) {
    const n = Math.round(Number(String(x).replace(/%$/, "").trim()));
    if (String(x).trim() !== "" && Number.isFinite(n) && n > 0 && n < 100) out.add(n);
  }
  return [...out].sort((a, b) => b - a);
}
/** Thresholds as text for a form field: "66, 33". */
export const phasesText = list => parsePhases(list).join(", ");

/** Health as a percentage (0–100) from hp { value, max, effectiveMax }; null when there's no maximum. */
export function hpPercent(hp = {}) {
  const max = Number(hp.effectiveMax ?? hp.max) || 0; if (max <= 0) return null;
  return Math.max(0, Math.min(100, ((Number(hp.value) || 0) / max) * 100));
}

/** The phase (1 = first) a boss is in at `pct` health. */
export const phaseAt = (pct, thresholds) => 1 + parsePhases(thresholds).filter(t => pct < t).length;

/**
 * What changed at `pct` health: { crossed: [{ threshold, phase }] (newly below, highest first), passed: thresholds now passed (to store),
 * changed }. `passed`: the thresholds already reported. A threshold is passed while health is below it and reset at or above it.
 */
export function checkPhases(pct, thresholds, passed = []) {
  const list = parsePhases(thresholds); const was = new Set(parsePhases(passed));
  if (pct == null || !list.length) return { crossed: [], passed: [...was].filter(t => list.includes(t)), changed: false };
  const now = list.filter(t => pct < t);
  const crossed = now.filter(t => !was.has(t)).map(t => ({ threshold: t, phase: list.indexOf(t) + 2 }));
  const before = [...was].filter(t => list.includes(t)).sort((a, b) => b - a);
  return { crossed, passed: now, changed: JSON.stringify(before) !== JSON.stringify(now) };
}

/** The GM's line: "Name reached phase 2 (below 66%)." */
export const phaseLine = (name, c) => `${name} reached phase ${c.phase} (below ${c.threshold}%).`;
