/**
 * Character sheet replacement (feature `characterSheet`), the pure part (no Foundry calls; tested in Node): which actor the C key
 * opens, the typing guard, the exhaustion pip rule, the view model built from plain facts (sheet.mjs reads the actor's prepared
 * dnd5e data into those facts), and the sheet's HTML (title band, vitals strip, page bookmarks, placeholder pages, conditions bar).
 * Nothing here computes a stat: every number comes from dnd5e's prepared data; buttons carry data-action names that sheet.mjs
 * maps to dnd5e's own methods.
 */
import { esc } from "../vendor/wanderers-core/index.mjs";

/** The sheet's registration label (Sheet configuration) and Foundry sheet class name (never rename: worlds store it). */
export const SHEET_LABEL = "Wanderer's Toolkit sheet";
export const SHEET_CLASS = "WctCharacterSheet";
/**
 * The sheet's own key action (`characterSheet`, new; the `characterPane` action keeps opening the pane, so keys users bound to it
 * still do what they did). Default C, no modifier. Foundry core's "Toggle Character Sheet" also uses C (it opens the user's
 * assigned character's default sheet, which is this sheet while the feature is on), so this action is registered at PRIORITY
 * precedence to run first; a user can rebind either in Configure Controls.
 */
export const SHEET_ACTION = "characterSheet";
export const SHEET_KEY = /** @type {Array<{ key: string, modifiers: Array<"Alt" | "Control" | "Shift"> }>} */ ([{ key: "KeyC", modifiers: [] }]);

// ---------------------------------------------------------------- pages
/**
 * Bookmarks in order. Icons are small original stroke drawings on a 24 × 24 grid. `bastion` shows only when dnd5e offers one,
 * `reputation` (2.2) only while the Renown feature is on.
 */
export const PAGES = Object.freeze([
  { id: "character", label: "Character", hint: "slots, weapon sets, quick stats", icon: "M8 3l4 2l4-2l5 4l-3 3l-2-1v12H8V9l-2 1l-3-3z" },
  { id: "details", label: "Details", hint: "abilities, saves, skills, tools, traits", icon: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" },
  { id: "inventory", label: "Inventory", hint: "every item, coin and weight", icon: "M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2" },
  { id: "features", label: "Features", hint: "class, species, background and other features", icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "spells", label: "Spells", hint: "slots, preparation, casting", icon: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 8h6M9 12h6" },
  { id: "effects", label: "Effects", hint: "conditions and active effects", icon: "M13 2L4 14h7l-1 8l9-12h-7z" },
  { id: "biography", label: "Biography", hint: "characteristics and story", icon: "M20 4C10 4 6 10 5 20M5 20l4-1M9 12h6" },
  { id: "reputation", label: "Reputation", hint: "renown per faction · this character only", icon: "M5 21V4M5 4h12l-2.5 4L17 12H5" },
  { id: "bastion", label: "Bastion", hint: "facilities and orders", icon: "M4 21V8l3-2v3l3-2v3l2-2l2 2V7l3 2V6l3 2v13zM10 21v-5h4v5" },
  { id: "special", label: "Special traits", hint: "flags and original class", icon: "M12 3l2.6 5.6l6 .7l-4.5 4.1l1.2 6L12 16.4L6.7 19.4l1.2-6L3.4 9.3l6-.7z" }
]);
export const PAGE_IDS = PAGES.map(p => p.id);

/** The pages shown: all but Bastion unless the actor has one, and Reputation only with Renown on. @param {{ bastion?: boolean, renown?: boolean }} f */
export const visiblePages = (f = {}) => PAGES.filter(p => (p.id !== "bastion" || f.bastion) && (p.id !== "reputation" || f.renown));

/** The page to show: the asked one when it's visible, else Character. @param {string | null | undefined} page @param {{ bastion?: boolean, renown?: boolean }} f */
export function pickPage(page, f = {}) {
  return visiblePages(f).some(p => p.id === page) ? /** @type {string} */ (page) : "character";
}

// ---------------------------------------------------------------- key
/**
 * Which actor the C key opens. A player: the assigned character; else the only character they own (`owned`, OWNER of type
 * character); else, owning several, the selected token's character when it is one of theirs. A GM: the first selected token's
 * actor, which must be a player character. `{ actor }` or `{ warn }` (a short notification).
 * @template {{ type?: string, name?: string }} A
 * @param {{ isGM?: boolean, controlled?: Array<A | null | undefined>, character?: A | null, owned?: A[] }} f
 * @returns {{ actor: A, warn?: undefined } | { actor?: undefined, warn: string }}
 */
export function pickSheetActor(f = {}) {
  if (f.isGM) {
    const a = (f.controlled ?? []).find(Boolean);
    if (!a) return { warn: "Select a character's token to open its sheet." };
    if (a.type !== "character") return { warn: `${a.name ?? "That token"} isn't a player character.` };
    return { actor: a };
  }
  // Players (1.33.2): the assigned character; else the only character they own; else, owning several, the selected token's
  // character if it is one of theirs; else a notice.
  if (f.character) return { actor: f.character };
  const owned = (f.owned ?? []).filter(Boolean);
  if (owned.length === 1) return { actor: owned[0] };
  if (owned.length > 1) {
    const sel = (f.controlled ?? []).find(a => a && owned.includes(a));
    if (sel) return { actor: sel };
    return { warn: "You own several characters: select one's token or assign one in User Configuration." };
  }
  return { warn: "You have no character assigned (User Configuration)." };
}

/**
 * True when a key press happens while the user types (an input, a text area, a select or editable text): a plain-letter
 * shortcut must not fire then. Takes the event target or document.activeElement (duck-typed so it runs in Node).
 * @param {any} el
 */
export function isTyping(el) {
  if (!el || typeof el !== "object") return false;
  if (el.isContentEditable) return true;
  const tag = String(el.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"].includes(String(el.type ?? "text").toLowerCase());
  return false;
}

// ---------------------------------------------------------------- exhaustion
/** The level after clicking pip `n` (1-based): the clicked level, or one less when it is the current level (click again to lower). */
export function exhaustionTarget(current, n, max = 6) {
  const cur = Math.max(0, Math.trunc(Number(current) || 0)); const k = Math.max(0, Math.min(max, Math.trunc(Number(n) || 0)));
  return k === cur ? k - 1 < 0 ? 0 : k - 1 : k;
}

// ---------------------------------------------------------------- view model
const num = v => (v !== null && v !== "" && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
const signed = v => { const n = num(v); return n === null ? "–" : n >= 0 ? `+${n}` : `−${Math.abs(n)}`; };
const pct = (a, b) => (b > 0 ? Math.round(Math.max(0, Math.min(1, a / b)) * 1000) / 10 : 0);
const group = n => (Number.isFinite(n) ? Math.trunc(n).toLocaleString("en-US") : "");

/**
 * Plain facts read from the actor (sheet.mjs `facts()`), all optional.
 * @typedef {object} SheetFacts
 * @property {string} [name]
 * @property {number | null} [level]
 * @property {Array<{ name: string, levels?: number }>} [classes]
 * @property {string} [species]
 * @property {string} [background]
 * @property {boolean} [showXp]
 * @property {{ value?: unknown, min?: unknown, max?: unknown, pct?: unknown }} [xp]
 * @property {string | null} [rested] the Rested badge's tooltip, or null
 * @property {boolean} [inspiration]
 * @property {{ value?: unknown, max?: unknown, effectiveMax?: unknown, temp?: unknown }} [hp]
 * @property {{ value?: unknown, max?: unknown, denom?: string }} [hd]
 * @property {unknown} [ac]
 * @property {unknown} [init]
 * @property {{ walk?: unknown, units?: string }} [speed]
 * @property {unknown} [prof]
 * @property {{ value?: unknown, max?: unknown }} [exhaustion]
 * @property {{ success?: unknown, failure?: unknown }} [death]
 * @property {string[] | null} [warnings] dnd5e's preparation warnings (messages), or null when dnd5e exposes none
 * @property {Array<{ id: string, name: string, img?: string }>} [conditions]
 * @property {boolean} [bastion]
 * @property {boolean} [renown] the Renown feature is on (Reputation page)
 * @property {boolean} [editable] the user may change the actor
 * @property {boolean} [isGM]
 * @property {boolean} [showRests]
 * @property {boolean} [limited]
 */

/**
 * The sheet's view model. @param {SheetFacts} f @param {{ mode?: "play" | "edit", page?: string }} [o]
 */
export function sheetView(f = {}, o = {}) {
  const classes = f.classes ?? [];
  const classText = classes.map(c => (classes.length > 1 && num(c.levels) ? `${c.name} ${num(c.levels)}` : c.name)).filter(Boolean).join(" / ");
  const sub = [classes.length === 1 && num(classes[0].levels) ? `${classes[0].name} ${num(classes[0].levels)}` : classText, f.species, f.background]
    .map(s => String(s ?? "").trim()).filter(Boolean).join(" · ");
  const level = num(f.level);
  // XP: dnd5e prepares value, min (this level) and max (next level; Infinity at the cap) and pct.
  const xv = num(f.xp?.value) ?? 0; const xmax = Number(f.xp?.max); const xmin = num(f.xp?.min) ?? 0;
  const capped = !Number.isFinite(xmax);
  const xpPct = num(f.xp?.pct) ?? (capped ? 100 : pct(xv - xmin, xmax - xmin));
  const xp = f.showXp === false ? null : { pct: xpPct, text: capped ? group(xv) : `${group(xv)} / ${group(xmax)}` };
  // HP: the bar's full width is max + temp (temporary HP is its own segment), as on the character pane.
  const max = num(f.hp?.effectiveMax) ?? num(f.hp?.max);
  const value = Math.max(0, num(f.hp?.value) ?? 0); const temp = Math.max(0, num(f.hp?.temp) ?? 0);
  const hp = max && max > 0 ? { value, max, temp, hpPct: pct(Math.min(value, max), max + temp), tempPct: pct(temp, max + temp), text: `HP ${value} / ${max}${temp ? ` · +${temp}` : ""}` } : null;
  const hdMax = num(f.hd?.max); const hdVal = num(f.hd?.value) ?? hdMax ?? 0;
  const hd = hdMax ? { pct: pct(hdVal, hdMax), text: `Hit dice ${hdVal} / ${hdMax}${f.hd?.denom ? ` ${f.hd.denom}` : ""}` } : null;
  const walk = num(f.speed?.walk);
  const exMax = Math.max(0, Math.trunc(num(f.exhaustion?.max) ?? 6)); const exVal = Math.max(0, Math.min(exMax, Math.trunc(num(f.exhaustion?.value) ?? 0)));
  const ds = Math.max(0, Math.min(3, num(f.death?.success) ?? 0)); const df = Math.max(0, Math.min(3, num(f.death?.failure) ?? 0));
  const mode = o.mode === "edit" && f.editable ? "edit" : "play";
  const page = pickPage(o.page, f);
  return {
    name: String(f.name ?? ""), level, sub, xp, rested: f.rested || null, inspiration: !!f.inspiration,
    hp, hd, ac: num(f.ac) ?? "–", init: signed(f.init), initTone: (num(f.init) ?? 0) > 0 ? "pos" : (num(f.init) ?? 0) < 0 ? "neg" : "",
    speed: walk === null ? "–" : String(walk), speedUnits: f.speed?.units || "ft", prof: signed(f.prof),
    exhaustion: { value: exVal, max: exMax, pips: Array.from({ length: exMax }, (_, i) => i < exVal) },
    death: { success: ds, failure: df },
    // Warnings: edit mode only; null = dnd5e exposes none (badge hidden).
    warnings: mode === "edit" && Array.isArray(f.warnings) && f.warnings.length ? f.warnings.map(String) : null,
    conditions: (f.conditions ?? []).filter(c => c && c.id && c.id !== "exhaustion"),
    pages: visiblePages(f), page, mode, editable: !!f.editable, isGM: !!f.isGM, showRests: !!f.showRests && !!f.editable, limited: !!f.limited
  };
}

// ---------------------------------------------------------------- HTML
const svg = (d, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
export const ICONS = Object.freeze({
  star: "M12 3l2.6 5.6l6 .7l-4.5 4.1l1.2 6L12 16.4L6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  short: "M4 18h16M6 18V9h12v9M9 9V6h6v3",
  long: "M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10",
  warn: "M12 3l10 18H2zM12 10v5M12 18v.01",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4"
});

/** @param {ReturnType<typeof sheetView>} v */
export function bandHTML(v) {
  const btn = (action, label, icon, on = false, extra = "") => `<button type="button" class="wct-cs-ibtn${on ? " on" : ""}" data-action="${action}" aria-label="${esc(label)}" data-tooltip="${esc(label)}"${extra}>${svg(icon)}</button>`;
  const warnTip = v.warnings ? v.warnings.map(esc).join("<br>") : "";
  return `<div class="wct-cs-band">
    ${v.level !== null ? v.mode === "edit" && v.editable ? `<button type="button" class="wct-cs-lvl wct-cs-lvlup" data-action="wctLevelUp" data-tooltip="Level ${v.level}: level up" aria-label="Level ${v.level}: level up">${v.level}<i aria-hidden="true">+</i></button>` : `<span class="wct-cs-lvl" data-tooltip="Level ${v.level}" aria-label="Level ${v.level}">${v.level}</span>` : ""}
    <div class="wct-cs-name"><h2 class="wct-cs-ttl">${esc(v.name)}</h2>${v.sub ? `<p class="wct-cs-sub">${esc(v.sub)}</p>` : ""}</div>
    ${v.xp ? `<div class="wct-cs-xp"><div class="wct-cs-xp-row"><span>XP</span><span class="wct-cs-num">${esc(v.xp.text)}</span></div><div class="wct-cs-xpbar" role="meter" aria-label="Experience" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v.xp.pct}"><i style="width:${v.xp.pct}%"></i></div></div>` : ""}
    ${v.rested ? `<span class="wct-cs-rest" data-tooltip="${esc(v.rested)}">Rested<span class="wc-sr">: ${esc(v.rested)}</span></span>` : ""}
    ${v.warnings ? `<span class="wct-cs-warn" role="status" data-tooltip="${esc(warnTip)}">${svg(ICONS.warn)}${v.warnings.length} warning${v.warnings.length === 1 ? "" : "s"}</span>` : ""}
    ${v.editable ? btn("wctInspiration", "Heroic inspiration", ICONS.star, v.inspiration, ` aria-pressed="${v.inspiration}"`) : v.inspiration ? `<span class="wct-cs-ibtn on static" data-tooltip="Heroic inspiration" aria-label="Heroic inspiration">${svg(ICONS.star)}</span>` : ""}
    ${v.showRests ? btn("wctShortRest", "Short rest", ICONS.short) + btn("wctLongRest", "Long rest", ICONS.long) : ""}
    ${v.editable ? `<div class="wct-cs-modesw" role="group" aria-label="Sheet mode"><button type="button" class="${v.mode === "play" ? "on" : ""}" data-action="wctMode" data-mode="play" aria-pressed="${v.mode === "play"}">Play</button><button type="button" class="${v.mode === "edit" ? "on" : ""}" data-action="wctMode" data-mode="edit" aria-pressed="${v.mode === "edit"}">Edit</button></div>` : ""}
  </div>`;
}

/** @param {ReturnType<typeof sheetView>} v */
export function vitalsHTML(v) {
  const pip = (cls, attrs = "") => `<i class="wct-cs-pip ${cls}"${attrs}></i>`;
  const ex = v.exhaustion.pips.map((on, i) => v.editable
    ? `<button type="button" class="wct-cs-pip${on ? " ex" : ""}" data-action="wctExhaustion" data-level="${i + 1}" aria-label="Exhaustion level ${i + 1}" aria-pressed="${on}"></button>`
    : pip(on ? "ex" : "")).join("");
  const deathPips = [0, 1, 2].map(i => pip(i < v.death.success ? "ok" : "")).join("") + `<span class="wct-cs-gap"></span>` + [0, 1, 2].map(i => pip(i < v.death.failure ? "bad" : "")).join("");
  const death = v.editable
    ? `<button type="button" class="wct-cs-pips wct-cs-death" data-action="wctDeathSave" data-tooltip="Roll a death saving throw" aria-label="Death saves: ${v.death.success} successes, ${v.death.failure} failures. Roll a death saving throw">${deathPips}</button>`
    : `<span class="wct-cs-pips" aria-label="Death saves: ${v.death.success} successes, ${v.death.failure} failures">${deathPips}</span>`;
  const med = (label, value, cls = "") => `<span class="wct-cs-lab">${label}</span><span class="v ${cls}">${esc(value)}</span>`;
  return `<div class="wct-cs-vitals">
    <div class="wct-cs-shield" data-tooltip="Armor Class" aria-label="Armor Class ${esc(v.ac)}">${esc(v.ac)}</div>
    <div class="wct-cs-bars">
      ${v.hp ? `<div class="wct-cs-rbar" role="meter" aria-label="Hit points" aria-valuemin="0" aria-valuemax="${v.hp.max}" aria-valuenow="${v.hp.value}"><i class="hp" style="width:${v.hp.hpPct}%"></i>${v.hp.tempPct ? `<i class="tmp" style="width:${v.hp.tempPct}%"></i>` : ""}<span>${esc(v.hp.text)}</span></div>` : `<div class="wct-cs-rbar"><span>HP –</span></div>`}
      ${v.hd ? `<div class="wct-cs-rbar sm"><i class="hd" style="width:${v.hd.pct}%"></i><span>${esc(v.hd.text)}</span></div>` : ""}
    </div>
    ${v.editable ? `<button type="button" class="wct-cs-med" data-action="wctInitiative" data-tooltip="Roll initiative">${med("Init", v.init, v.initTone)}</button>` : `<div class="wct-cs-med">${med("Init", v.init, v.initTone)}</div>`}
    <div class="wct-cs-med" data-tooltip="Speed (${esc(v.speedUnits)})">${med("Speed", v.speed)}</div>
    <div class="wct-cs-med" data-tooltip="Proficiency bonus">${med("Prof", v.prof)}</div>
    <div class="wct-cs-stack"><span class="wct-cs-lab sm">Exhaustion</span><span class="wct-cs-pips" role="group" aria-label="Exhaustion ${v.exhaustion.value} of ${v.exhaustion.max}">${ex}</span></div>
    <div class="wct-cs-stack"><span class="wct-cs-lab sm">Death saves</span>${death}</div>
  </div>`;
}

/** @param {ReturnType<typeof sheetView>} v */
export function tabsHTML(v) {
  return `<nav class="wct-cs-btabs" aria-label="Sheet pages" role="tablist">${v.pages.map(p => `<button type="button" role="tab" class="wct-cs-btab${p.id === v.page ? " on" : ""}" data-action="wctPage" data-page="${p.id}" aria-selected="${p.id === v.page}" aria-label="${esc(p.label)}" data-tooltip="${esc(p.label)}" data-tooltip-direction="RIGHT">${svg(p.icon)}</button>`).join("")}</nav>`;
}

/**
 * dnd5e 6.0.6's app contract: the members its documents, dialogs and elements use on a sheet passed as `sheet` / found as the app
 * (Item / ActiveEffect / activity deleteDialog → `_confirmDialog`; createDialog, ActivityChoiceDialog, ActivityUsageDialog,
 * AdvancementConfirmationDialog, deleteDialog's AdvancementManager → `_renderChild`; activity context menu → `item.sheet._renderChild`;
 * group sheet drops → `actor.sheet._onDropCreateItems`; the toggleSheetMode key → `changeMode` / `isEditable`; the inventory and
 * effects elements → `inventorySource`, `expandedSections`, `canExpand`, `_openDocumentSheet`, `_concentration`, `render`).
 * Found by searching dnd5e's source for `sheet._`, `sheet?.`, `this.app.`, `this.#app.` and `app.` calls. sheet.mjs implements each
 * (test).
 */
export const APP_CONTRACT = Object.freeze(["_renderChild", "_confirmDialog", "changeMode", "isEditMode", "_onDropCreateItems", "_onDropStackConsumables", "_onDropSingleItem",
  "inventorySource", "expandedSections", "canExpand", "_openDocumentSheet", "_concentration"]);

/** The pages built so far (slice 2: Character, Details, Inventory); the others are placeholders. */
export const BUILT_PAGES = Object.freeze(["character", "details", "inventory", "features", "spells", "effects", "biography", "reputation", "bastion", "special"]);

/**
 * The page body. A built page shows `body` (sheet-pages-model.mjs, built by sheet.mjs from the actor) with a small "Open in system
 * sheet" link at the foot; the Character page has no title row (the doll is its heading). Other pages are placeholders with that link.
 * @param {ReturnType<typeof sheetView>} v @param {string | null} [body]
 */
export function pageHTML(v, body = null) {
  const p = PAGES.find(x => x.id === v.page) ?? PAGES[0];
  const head = `<div class="wct-cs-page-head"><h3 class="wct-cs-ttl">${esc(p.label)}</h3><span class="wct-cs-dim">${esc(p.hint)}</span></div>`;
  if (body !== null && BUILT_PAGES.includes(p.id)) return `<main class="wct-cs-page" data-page="${p.id}" role="tabpanel" aria-label="${esc(p.label)}">
    ${p.id === "character" ? "" : head}${body}
    <p class="wct-cs-syslink"><button type="button" class="wct-cs-linkbtn" data-action="wctSystemSheet" data-page="${p.id}">Open in system sheet</button></p>
  </main>`;
  return `<main class="wct-cs-page" data-page="${p.id}" role="tabpanel" aria-label="${esc(p.label)}">
    ${head}
    <div class="wct-cs-placeholder"><p>This page is coming in a later slice of the toolkit sheet.</p>
      <p><button type="button" class="wct-cs-gbtn" data-action="wctSystemSheet" data-page="${p.id}">Open in system sheet</button></p></div>
  </main>`;
}

/** @param {ReturnType<typeof sheetView>} v */
export function footerHTML(v) {
  const list = v.conditions.length
    ? v.conditions.map(c => `<span class="wct-cs-cond${c.id === "concentrating" ? " conc" : ""}" data-status="${esc(c.id)}">${esc(c.name)}</span>`).join("")
    : `<span class="wct-cs-dim">None</span>`;
  return `<footer class="wct-cs-foot"><span class="wct-cs-lab">Conditions</span><span class="wct-cs-conds">${list}</span></footer>`;
}

/** The whole sheet body. @param {ReturnType<typeof sheetView>} v @param {string | null} [body] the page body (built pages) */
export function sheetHTML(v, body = null) {
  if (v.limited) return `<div class="wct-cs wct-cs-limited">${bandHTML({ ...v, xp: null, rested: null, warnings: null, editable: false, showRests: false, inspiration: false })}<main class="wct-cs-page"><p class="wct-cs-dim">You can only see this character's name and picture.</p></main></div>`;
  return `<div class="wct-cs${v.mode === "edit" ? " editing" : ""}">
    ${bandHTML(v)}
    ${vitalsHTML(v)}
    ${v.mode === "edit" ? `<div class="wct-cs-editnote">${svg(ICONS.edit)}Edit mode: change ability scores, proficiencies, traits, portrait and items here. Switch back to Play for the plain sheet.</div>` : ""}
    <div class="wct-cs-body">${tabsHTML(v)}${pageHTML(v, body)}</div>
    ${footerHTML(v)}
  </div>`;
}

// ---------------------------------------------------------------- core's Toggle Character Sheet → Alt+C
/**
 * While the sheet and its C key are on, Foundry core's own character-sheet toggle (also plain C; `core.characterSheet` in v14,
 * seen live) moves to Alt+C on each client, once, and only when the user never rebound it and nothing else fires on Alt+C.
 * 1.33.0 moved it to Shift+C, but v14's own `core.focusChat` defaults to Shift+C, so that never happened on a stock client; a
 * leftover Shift+C move (record set, key still exactly Shift+C) is put back to the defaults first. Core's action id isn't assumed: it is found among the
 * registered actions. The client setting `coreSheetKeyMoved` holds the moved action's id ("" = not moved by us).
 * Facts are plain data built from `game.keybindings.actions` / `.bindings` (sheet.mjs `keyFacts()`).
 * @typedef {{ key: string, modifiers?: string[] }} Binding
 * @typedef {{ id: string, namespace: string, action: string, name?: string, editable?: Binding[], uneditable?: Binding[], reservedModifiers?: string[], current?: Binding[] }} ActionFacts
 */
export const MOVED_SETTING = "coreSheetKeyMoved";
export const CORE_SHEET_PLAIN = Object.freeze([{ key: "KeyC", modifiers: [] }]);
/** Where core's toggle goes (one constant: change the target here). */
export const CORE_SHEET_MOVED = Object.freeze([{ key: "KeyC", modifiers: ["Alt"] }]);
/** The 1.33.0 target, only recognised to undo it. */
export const CORE_SHEET_LEGACY = Object.freeze([{ key: "KeyC", modifiers: ["Shift"] }]);
/** "Alt+C" for messages. @param {readonly Binding[]} b */
export const keyLabel = b => b.map(x => [...(x.modifiers ?? []), String(x.key).replace(/^Key/, "")].join("+")).join(", ");
export const MOVED_LABEL = keyLabel(CORE_SHEET_MOVED);

const norm = (/** @type {readonly Binding[] | undefined} */ list) => (list ?? []).map(b => [...new Set(b?.modifiers ?? [])].sort().concat(String(b?.key ?? "")).join("+")).sort();
/** True when two binding lists are the same keys (modifier order ignored). */
export const sameBindings = (/** @type {readonly Binding[] | undefined} */ a, /** @type {readonly Binding[] | undefined} */ b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/** `list` without the bindings in `drop` (same keys). @param {readonly Binding[] | undefined} list @param {readonly Binding[] | undefined} drop */
export function withoutBindings(list, drop) {
  const gone = new Set(norm(drop));
  return (list ?? []).filter(b => !gone.has(norm([b])[0]));
}

/**
 * Core's character-sheet toggle: namespace "core", id or name mentioning both "character" and "sheet", default bindings exactly
 * plain C. Exactly one match, else null (none or ambiguous: leave everything alone).
 * @param {ActionFacts[]} actions
 */
export function findCoreSheetAction(actions = []) {
  const hits = actions.filter(a => a?.namespace === "core" && /character/i.test(`${a.action} ${a.name ?? ""}`) && /sheet/i.test(`${a.action} ${a.name ?? ""}`) && sameBindings(a.editable, CORE_SHEET_PLAIN));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Actions (other than `except`) that pressing `target` (default the move target, Alt+C) would fire: a binding on the same key
 * whose modifiers are all held in `target`, where every held modifier it doesn't list is one of the action's reserved modifiers
 * (Foundry still fires an action with its reserved modifiers held: core Target is T with Shift reserved).
 * @param {ActionFacts[]} actions @param {string} [except] action id to skip @param {readonly Binding[]} [target]
 * @returns {string[]} the clashing actions' ids
 */
export function keyClashes(actions = [], except = "", target = CORE_SHEET_MOVED) {
  const out = [];
  const t = target[0]; const held = t.modifiers ?? [];
  for (const a of actions) {
    if (!a || a.id === except) continue;
    const reserved = a.reservedModifiers ?? [];
    const hit = [...(a.current ?? a.editable ?? []), ...(a.uneditable ?? [])].some(b => {
      if (b?.key !== t.key) return false;
      const mods = b.modifiers ?? [];
      if (mods.some(m => !held.includes(m))) return false;
      return held.every(m => mods.includes(m) || reserved.includes(m));
    });
    if (hit) out.push(a.id);
  }
  return out;
}

/** True when the action's current keys are exactly one of our moves (Alt+C, or 1.33.0's Shift+C). @param {ActionFacts | undefined} a */
export const isOurMove = a => !!a && (sameBindings(a.current, CORE_SHEET_MOVED) || sameBindings(a.current, CORE_SHEET_LEGACY));

/**
 * What to do on `ready`. `on` = the sheet and its key are both on; `moved` = the setting's value.
 * Results: { do: "move", id } | { do: "restore", id, again? } (put core's defaults back and clear the setting; `again`: then plan
 * once more, used to undo 1.33.0's Shift+C before moving to Alt+C) | { do: "forget" } (clear the setting only: the user changed the
 * binding since) | { do: "none", why } with why "notFound" | "rebound" | "clash" | "moved" | "off".
 * @param {{ on: boolean, moved?: string, actions: ActionFacts[] }} f
 */
export function coreKeyPlan(f) {
  const moved = String(f.moved ?? "");
  const recorded = moved ? (f.actions ?? []).find(x => x?.id === moved) : undefined;
  if (!f.on) {
    if (!moved) return { do: "none", why: "off" };
    if (isOurMove(recorded)) return { do: "restore", id: moved };
    return { do: "forget" };
  }
  if (moved) {
    if (recorded && sameBindings(recorded.current, CORE_SHEET_LEGACY)) return { do: "restore", id: moved, again: true };
    return { do: "none", why: "moved" };
  }
  const core = findCoreSheetAction(f.actions);
  if (!core) return { do: "none", why: "notFound" };
  if (!sameBindings(core.current ?? core.editable, core.editable)) return { do: "none", why: "rebound", id: core.id };
  const clashes = keyClashes(f.actions, core.id);
  if (clashes.length) return { do: "none", why: "clash", id: core.id, clashes };
  return { do: "move", id: core.id };
}
