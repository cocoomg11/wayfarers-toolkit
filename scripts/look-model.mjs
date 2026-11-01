/**
 * The toolkit's shared look (1.30), pure (no Foundry calls; tested in Node): chat cards wrapped in wanderers-core's root classes so
 * core's components (buttons, status icons, item slots, coins, quality colours) style them in both themes. Windows add `UI_CLASSES`
 * to their own `classes`.
 */
import { UI_CLASSES, esc } from "../vendor/wanderers-core/index.mjs";

const ROOT = UI_CLASSES.join(" ");

/**
 * Wraps chat card HTML in core's root (`<div class="wc-ui wc-rN wct-chat-card …">`). Content that is already wrapped is returned
 * unchanged, so a card rebuilt from its own content isn't wrapped twice. `cls`: extra classes (the card's own).
 * @param {string} html @param {string} [cls]
 */
export function card(html, cls = "") {
  const s = String(html ?? "");
  if (s.trimStart().startsWith(`<div class="${ROOT} `) || s.trimStart().startsWith(`<div class="${ROOT}"`)) return s;
  return `<div class="${ROOT} wct-chat-card${cls ? ` ${esc(cls)}` : ""}">${s}</div>`;
}

/** Whether a stored card is on the current look (its root carries this core revision). @param {unknown} html */
export const isCurrent = html => String(html ?? "").includes(`class="${ROOT} `);
