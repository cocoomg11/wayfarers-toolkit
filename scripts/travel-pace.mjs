/**
 * Travel pace for Hex Travel (feature "travelPace", needs Hex Travel): fast, normal or slow (careful), after the travel pace rules
 * of SRD 5.2, described in the module's own words. The GM sets the party's pace; players may ask for one. Pure (tested in Node).
 *
 * Per hour and per day are the SRD's figures. The per-hour speed Hex Travel uses still comes from the Slow / Normal / Fast pace
 * settings (miles per hour), so a world that changed them keeps its numbers; days scale with them.
 */
export const PACE_IDS = ["fast", "normal", "slow"];

/** dis = disadvantage, adv = advantage, null = no change. */
export const PACES = {
  fast: { label: "Fast", perHour: 4, perDay: 30, checks: { perception: "dis", survival: "dis", stealth: "dis" } },
  normal: { label: "Normal", perHour: 3, perDay: 24, checks: { perception: null, survival: null, stealth: "dis" } },
  slow: { label: "Slow (careful)", perHour: 2, perDay: 18, checks: { perception: "adv", survival: "adv", stealth: null } }
};
const SKILL = { perception: "Perception", survival: "Survival", stealth: "Stealth" };

/** Any stored or typed pace → fast | normal | slow ("careful" and "cautious" are slow). Unknown → normal. */
export function normPace(p) {
  const s = String(p ?? "").trim().toLowerCase();
  if (s === "careful" || s === "cautious") return "slow";
  return PACE_IDS.includes(s) ? s : "normal";
}

/** The pace's effect on checks while travelling, as one plain sentence. */
export function effectText(pace) {
  const c = PACES[normPace(pace)].checks;
  const list = mode => Object.keys(SKILL).filter(k => c[k] === mode).map(k => SKILL[k]);
  const join = a => a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
  const parts = [];
  const dis = list("dis"), adv = list("adv");
  if (adv.length) parts.push(`advantage on ${join(adv)} checks`);
  if (dis.length) parts.push(`disadvantage on ${join(dis)} checks`);
  const s = parts.join("; ");
  return s ? `${s[0].toUpperCase()}${s.slice(1)}.` : "No change to checks.";
}

/** Short label for a select: "Fast · 4 mph · disadvantage on …". `mph` overrides the SRD figure (the world's pace setting). */
export function optionLabel(pace, mph) {
  const p = PACES[normPace(pace)];
  return `${p.label} · ${mph ?? p.perHour} mph · ${effectText(pace).replace(/\.$/, "").replace(/^./, c => c.toLowerCase())}`;
}

/**
 * Hours for a hex trip: road hexes at the pace's speed, off-road hexes `offroadMult` times as long, mounted × `mountMult` speed.
 * 1 hex = 1 mile. Returns 0 for no hexes, Infinity for a speed of 0 or less.
 */
export function tripHours({ road = 0, off = 0, mph = 3, offroadMult = 2, mountMult = 1, mounted = false } = {}) {
  const miles = Math.max(0, +road || 0) + Math.max(0, +off || 0) * Math.max(0, +offroadMult || 0);
  if (!miles) return 0;
  const speed = (+mph || 0) * (mounted ? (+mountMult || 1) : 1);
  return speed > 0 ? miles / speed : Infinity;
}

/**
 * Travel days for the same trip: miles (off-road counted × offroadMult) over the pace's miles per day, scaled when the world's
 * miles-per-hour setting differs from the SRD figure (and by the mounted multiplier).
 */
export function tripDays({ road = 0, off = 0, pace = "normal", mph, offroadMult = 2, mountMult = 1, mounted = false } = {}) {
  const p = PACES[normPace(pace)];
  const miles = Math.max(0, +road || 0) + Math.max(0, +off || 0) * Math.max(0, +offroadMult || 0);
  if (!miles) return 0;
  const perDay = p.perDay * ((mph ?? p.perHour) / p.perHour) * (mounted ? (+mountMult || 1) : 1);
  return perDay > 0 ? miles / perDay : Infinity;
}

/** Whether a pace request from this user is accepted: players only when requests are on; a GM sets the pace directly. */
export const canRequest = ({ isGM = false, requestsOn = true } = {}) => !isGM && !!requestsOn;

/** A pace request from the socket, cleaned up: { pace, userId } or null. */
export function readRequest(msg) {
  if (!msg || msg.action !== "paceRequest") return null;
  const raw = String(msg.pace ?? "").trim().toLowerCase();
  if (!PACE_IDS.includes(raw) && raw !== "careful" && raw !== "cautious") return null;
  return { pace: normPace(raw), userId: typeof msg.userId === "string" ? msg.userId : null };
}
