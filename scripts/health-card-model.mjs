/**
 * The health chat card (api.health()), pure (no Foundry calls; tested in Node). Since 1.30 the card is one summary line (counts of
 * ok / warning / problem lines) with an "Open in Wanderer's Satchel" button when that hub module is active; without it the full card
 * as before. Both are wrapped in wanderers-core's root classes and use its status icons (an icon plus a screen-reader word, never
 * colour alone). api.healthReport() is unchanged.
 */
import { UI_CLASSES, esc, icon, tone } from "../vendor/wanderers-core/index.mjs";

/** Line levels that are counted, in order. */
export const LEVELS = Object.freeze(["ok", "warn", "bad"]);
const WORD = { ok: "fine", warn: "warning", bad: "problem" };
const WORDS = { ok: "fine", warn: "warnings", bad: "problems" };
const LABEL = { ok: "Fine", warn: "Warnings", bad: "Problems" };

/** { ok, warn, bad } line counts of a report ([{ title, lines: [{ level }] }]). Never throws. @param {any} sections */
export function counts(sections) {
  const c = { ok: 0, warn: 0, bad: 0 };
  for (const s of Array.isArray(sections) ? sections : []) for (const l of Array.isArray(s?.lines) ? s.lines : []) if (l && l.level in c) c[l.level]++;
  return c;
}

/** The overall tone of a report: bad when any problem, warn when any warning, else ok. @param {{ ok: number, warn: number, bad: number }} c */
export const overall = c => (c.bad ? "bad" : c.warn ? "warn" : "ok");

/** "12 fine, 1 warning, 0 problems". @param {{ ok: number, warn: number, bad: number }} c */
export const countText = c => LEVELS.map(k => `${c[k]} ${c[k] === 1 ? WORD[k] : WORDS[k]}`).join(", ");

/** The counts as core status icons with numbers (aria-friendly). @param {{ ok: number, warn: number, bad: number }} c */
const countIcons = c => LEVELS.map(k => `<span class="wct-hc-count wc-${k}">${icon(k, { word: false })}<span class="wc-sr">${LABEL[k]}:</span> ${c[k]}</span>`).join(" ");

/**
 * The short card: title, one line of counts and, with the Satchel active, its button. `setup`: Run setup is offered (macros missing).
 * @param {{ version?: string, counts: { ok: number, warn: number, bad: number }, satchel?: boolean, setup?: boolean }} o
 */
export function shortCard(o) {
  const c = o.counts; const t = overall(c);
  const head = t === "ok" ? "Everything looks good" : t === "warn" ? "Some things need a look" : "Problems found";
  return `<div class="${UI_CLASSES.join(" ")} wct-card wct-health wct-health-short">`
    + `<h3>Wanderer's Toolkit ${esc(o.version ?? "")}: health check</h3>`
    + `<p class="wc-status wc-${t}">${icon(t)}<span class="wc-grow">${esc(head)}: ${esc(countText(c))}.</span></p>`
    + `<p class="wct-hc-counts">${countIcons(c)}</p>`
    + `<p class="wct-hc-actions">${o.satchel ? `<button type="button" class="wc-btn wc-btn-sm" data-wct-action="open-satchel"><i class="fa-solid fa-briefcase" aria-hidden="true"></i> Open in Wanderer's Satchel</button>` : ""}`
    + `${o.setup ? `<button type="button" class="wc-btn wc-btn-sm" data-wct-action="run-setup"><i class="fa-solid fa-hammer" aria-hidden="true"></i> Run setup</button>` : ""}</p></div>`;
}

/**
 * The full card (no Satchel, and the toolkit's own health window): every section with its lines. Line text is the check's own
 * HTML (built by the toolkit, escaped there), kept as markup so its buttons work.
 * @param {{ version?: string, sections: any[], setup?: boolean }} o
 */
export function fullCard(o) {
  const c = counts(o.sections);
  const line = (/** @type {any} */ l) => `<li class="wc-status wc-${tone(l.level)}">${icon(tone(l.level))}<span class="wc-grow">${l.text}</span></li>`;
  const body = (o.sections ?? []).map((/** @type {any} */ s) => `<h4>${esc(s.title)}</h4><ul class="wc-lines">${(s.lines ?? []).map(line).join("")}</ul>`).join("");
  return `<div class="${UI_CLASSES.join(" ")} wct-card wct-health"><h3>Wanderer's Toolkit ${esc(o.version ?? "")}: health check</h3>`
    + `<p class="wct-hc-counts">${countIcons(c)}</p>${body}`
    + `${o.setup ? `<p><button type="button" class="wc-btn wc-btn-sm" data-wct-action="run-setup"><i class="fa-solid fa-hammer" aria-hidden="true"></i> Run setup</button></p>` : ""}</div>`;
}
