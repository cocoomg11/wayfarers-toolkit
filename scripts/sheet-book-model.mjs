/**
 * Character sheet replacement, slice 3 (2.1): the Features and Spells pages, the pure part (no Foundry calls; tested in Node).
 * sheet.mjs reads dnd5e's prepared data the way dnd5e's character sheet prepares its Features and Spells tabs (`_prepareFeaturesContext`,
 * `_prepareItemFeature`, `_prepareSpellbook`, `_prepareItemSpell`, `_prepareSpellsContext`) into plain facts; this file builds the
 * HTML and the display rules (search, filter chips, sort). Nothing here computes a stat.
 *
 * Both lists sit inside dnd5e's own `<dnd5e-inventory>` element with its markup hooks (`.item-action[data-action]`: use, prepare,
 * recharge, toggleExpand, edit, delete; `data-name` uses inputs; `[data-context-menu]`; rows `li[data-item-id]`), so dnd5e handles
 * using, preparing, recharging, expanding, editing, deleting and the item context menu. Spell slot pips use the toolkit action
 * `wctPip` with dnd5e's `togglePip` rule (`pipTarget`).
 */
import { esc } from "../vendor/wanderers-core/index.mjs";
import { svg, box, num, PAGE_ICONS, nameMatches } from "./sheet-pages-model.mjs";

const sign = v => { const n = num(v); return n === null ? "–" : n >= 0 ? `+${n}` : `−${Math.abs(n)}`; };

export const BOOK_ICONS = Object.freeze({
  prepared: "M5 4h11l3 3v13H5zM9 12l2 2l4-4",
  always: "M12 3l2.6 5.6l6 .7l-4.5 4.1l1.2 6L12 16.4L6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  slot: "M12 3l7 9l-7 9l-7-9z",
  plus: "M12 5v14M5 12h14"
});

// ---------------------------------------------------------------- shared list rules
/**
 * A row of either list.
 * @typedef {object} BookRow
 * @property {string} id
 * @property {string} [uuid]
 * @property {string} name
 * @property {string} [img]
 * @property {string} [quality]
 * @property {string} [subtitle]
 * @property {string[]} [activations] activation types ("action", "bonus", "reaction", …)
 * @property {string[]} [recovery] recovery periods of its uses ("sr", "lr", …)
 * @property {boolean} [concentration]
 * @property {boolean} [ritual]
 * @property {boolean} [magical]
 * @property {boolean} [prepared] spells: prepared (canPrepare && prepared)
 * @property {string} [school]
 * @property {string} [classId] spells: the spellcasting class identifier
 * @property {number} [sort]
 * @property {number} [level] spells: spell level
 * @property {string} [linkedName] spells: the item it's cast from (priority sort)
 * @property {string} [method]
 * @property {{ value: unknown, max: unknown } | null} [uses]
 * @property {"cooldown" | "charged" | null} [recharge]
 * @property {string} [recoveryLabel] dnd5e's labels.recovery
 * @property {boolean} [canDelete]
 * @property {boolean} [canUse]
 * @property {boolean} [canExpand]
 * @property {string | null} [expanded]
 * @property {boolean} [concentrating] the actor concentrates on it now
 * @property {{ activation?: string, range?: string, target?: string, roll?: string, schoolLabel?: string }} [cols] spells' columns
 * @property {{ state: "unprepared" | "prepared" | "always", label: string } | null} [prep] spells: dnd5e's preparation toggle, null = not applicable
 */

/** Feature chips (dnd5e's Features list controls). */
export const FEATURE_FILTERS = Object.freeze([
  { key: "action", label: "Action" }, { key: "bonus", label: "Bonus" }, { key: "reaction", label: "Reaction" },
  { key: "sr", label: "Short rest" }, { key: "lr", label: "Long rest" }, { key: "concentration", label: "Concentration" }, { key: "mgc", label: "Magical" }
]);
/** Spell chips (dnd5e's Spells list controls; schools and classes are added by the page from dnd5e's config). */
export const SPELL_FILTERS = Object.freeze([
  { key: "action", label: "Action" }, { key: "bonus", label: "Bonus" }, { key: "reaction", label: "Reaction" },
  { key: "concentration", label: "Concentration" }, { key: "ritual", label: "Ritual" }, { key: "prepared", label: "Prepared" }
]);
export const FEATURE_SORTS = Object.freeze({ m: "Manual", a: "A–Z" });
export const SPELL_SORTS = Object.freeze({ a: "A–Z", p: "Priority", m: "Manual" });
const ACTS = new Set(["action", "bonus", "reaction", "lair", "legendary"]);

/**
 * dnd5e's `_filterItems` for a row: chosen activation types (any of them), ritual, concentration, prepared, magical, short / long rest
 * recovery, school and class filters (any chosen school / class). `schools` / `classes` say which keys are schools or classes.
 * @param {BookRow} r @param {Iterable<string>} filters @param {{ schools?: Iterable<string>, classes?: Iterable<string> }} [keys]
 */
export function bookChipsMatch(r, filters, keys = {}) {
  const f = new Set(filters ?? []);
  const acts = [...f].filter(k => ACTS.has(k));
  if (acts.length && !(r.activations ?? []).some(a => acts.includes(a))) return false;
  if (f.has("ritual") && !r.ritual) return false;
  if (f.has("concentration") && !r.concentration) return false;
  if (f.has("prepared") && !r.prepared) return false;
  if (f.has("mgc") && !r.magical) return false;
  for (const p of ["sr", "lr"]) if (f.has(p) && !(r.recovery ?? []).includes(p)) return false;
  const schools = new Set(keys.schools ?? []); const wantSchools = [...f].filter(k => schools.has(k));
  if (wantSchools.length && !wantSchools.includes(String(r.school ?? ""))) return false;
  const classes = new Set(keys.classes ?? []); const wantClasses = [...f].filter(k => classes.has(k));
  if (wantClasses.length && !wantClasses.includes(String(r.classId ?? ""))) return false;
  return true;
}

/**
 * dnd5e's sort modes: "a" name, "m" the items' sort value, "p" priority (spells: linked item's name, level, prepared first, method,
 * name; dnd5e's `sortItemsPriority`).
 * @param {BookRow[]} rows @param {string} mode
 */
export function sortBook(rows, mode = "m") {
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const cmp = mode === "a" ? byName
    : mode === "p" ? (a, b) => String(a.linkedName ?? "").localeCompare(String(b.linkedName ?? "")) || ((num(a.level) ?? 0) - (num(b.level) ?? 0)) || (+!!b.prepared - +!!a.prepared) || String(a.method ?? "").localeCompare(String(b.method ?? "")) || byName(a, b)
      : (a, b) => ((num(a.sort) ?? 0) - (num(b.sort) ?? 0)) || byName(a, b);
  return [...rows].sort(cmp);
}

const chipHTML = (list, on) => list.map(c => `<button type="button" class="wct-cs-chip${on.has(c.key) ? " on" : ""}" data-wct-filter="${esc(c.key)}" aria-pressed="${on.has(c.key)}">${esc(c.label)}</button>`).join("");

/** The search / chips / sort bar (same controls as the Inventory page's). */
function toolbar(o) {
  const on = new Set(o.filters ?? []);
  const sorts = Object.entries(o.sorts); const i = sorts.findIndex(([k]) => k === o.sort); const next = sorts[(i + 1) % sorts.length][0];
  const extra = (o.extraFilters ?? []).length ? `<span class="wct-cs-chipsep" aria-hidden="true"></span>${chipHTML(o.extraFilters, on)}` : "";
  return `<div class="wct-cs-tbar"><label class="wct-cs-srch">${svg(PAGE_ICONS.search)}<span class="wc-sr">${esc(o.label)}</span><input type="search" data-wct-search value="${esc(o.search ?? "")}" placeholder="${esc(o.label)}"></label>${chipHTML(o.chips, on)}${extra}<button type="button" class="wct-cs-chip" data-wct-sort="${esc(next)}" data-tooltip="Sort order">Sort: ${esc(o.sorts[o.sort] ?? sorts[0][1])}</button>${o.group ? (() => { const g = Object.keys(o.group.modes); const nx = g[(g.indexOf(o.group.mode) + 1) % g.length]; return `<button type="button" class="wct-cs-chip" data-wct-group="${esc(nx)}" data-tooltip="Grouping">${esc(o.group.modes[o.group.mode])}</button>`; })() : ""}${o.create ? `<button type="button" class="wct-cs-gbtn sm" data-action="${esc(o.create.action)}">+ ${esc(o.create.label)}</button>` : ""}</div>`;
}

/** The controls every row ends with (dnd5e's inventory element handles them). */
function rowControls(r, o, extra = "") {
  const ic = (action, label, d, cls = "") => `<button type="button" class="wct-cs-ic2 item-action${cls ? ` ${cls}` : ""}" data-action="${action}" aria-label="${esc(label)}" data-tooltip-text="${esc(label)}">${svg(d)}</button>`;
  return [
    extra,
    o.edit ? ic("edit", "Edit", PAGE_ICONS.edit) : "",
    o.edit && r.canDelete ? ic("delete", "Delete", PAGE_ICONS.trash, "del") : "",
    r.canExpand === false ? "" : `<button type="button" class="wct-cs-ic2 item-action always-interactive" data-action="toggleExpand" data-toggle-description aria-label="Show or hide the description" data-tooltip="Show or hide the description"><i class="fa-solid fa-${r.expanded ? "compress" : "expand"}" inert></i></button>`,
    `<button type="button" class="wct-cs-ic2 always-interactive" data-context-menu aria-label="More actions" data-tooltip="More actions">${svg(PAGE_ICONS.more)}</button>`
  ].join("");
}

function usesCell(r, editable) {
  if (r.recharge === "cooldown") return editable ? `<button type="button" class="wct-cs-ic2 item-action" data-action="recharge" aria-label="Roll recharge" data-tooltip="Roll recharge">${svg(PAGE_ICONS.recharge)}</button>` : svg(PAGE_ICONS.recharge);
  if (r.recharge === "charged") return `<span data-tooltip="Charged">${svg(PAGE_ICONS.bolt)}</span>`;
  if (r.uses && num(r.uses.max)) return editable
    ? `<span class="wct-cs-uses"><input type="text" value="${esc(num(r.uses.value) ?? 0)}" placeholder="0" data-dtype="Number" data-name="system.uses.value" inputmode="numeric" pattern="[+=\\-]?\\d*" aria-label="Uses left"><span>/ ${esc(num(r.uses.max))}</span></span>`
    : `<span class="wct-cs-num">${esc(num(r.uses.value) ?? 0)} / ${esc(num(r.uses.max))}</span>`;
  return "";
}

/** A row in dnd5e's inventory markup. `cells` are the middle columns' HTML. */
function bookRow(r, o, cells, extraCtl = "") {
  const click = r.canUse ? "use" : "view";
  return `<li class="item collapsible wct-cs-irow-wrap${r.expanded ? "" : " collapsed"}" data-wct-chips="${o.chips === false ? 0 : 1}" data-uuid="${esc(r.uuid ?? "")}" data-item-id="${esc(r.id)}" data-entry-id="${esc(r.id)}" data-item-name="${esc(r.name)}"${o.shown ? "" : " hidden"}>
    <div class="item-row wct-cs-irow draggable">
      <span class="wct-cs-ico wct-item wc-item-slot" data-quality="${esc(r.quality || "common")}"><img src="${esc(r.img)}" alt="">${r.concentrating ? `<i class="wct-cs-concmark" aria-label="Concentrating" data-tooltip="Concentrating"></i>` : ""}</span>
      <span class="wct-cs-nm item-name item-action" role="button" tabindex="0" data-action="${click}" aria-label="${esc(r.name)}${click === "use" ? ": use" : ""}"><b class="wc-q-text" data-quality="${esc(r.quality || "common")}">${esc(r.name)}${r.concentration ? ` <span class="wct-cs-tag c" data-tooltip="Concentration">C</span>` : ""}${r.ritual ? ` <span class="wct-cs-tag r" data-tooltip="Ritual">R</span>` : ""}</b>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ""}</span>
      ${cells}
      <span class="ctl">${rowControls(r, o, extraCtl)}</span>
    </div>
    <div class="item-description collapsible-content"><div class="wrapper">${r.expanded ?? ""}</div></div>
  </li>`;
}

/**
 * Sections with their visible state: rows sorted, each row's chip and search result, sections hidden when nothing in them shows.
 * @template {{ id: string, label: string, rows: BookRow[], keepEmpty?: boolean }} S
 * @param {S[]} sections @param {{ search?: string, filters?: string[], sort?: string, keys?: any }} o
 */
export function bookView(sections, o = {}) {
  let any = false;
  const out = sections.map(s => {
    const rows = sortBook(s.rows ?? [], o.sort).map(r => {
      const chips = bookChipsMatch(r, o.filters ?? [], o.keys);
      const shown = chips && nameMatches(r.name, o.search);
      if (shown) any = true;
      return { r, chips, shown };
    });
    return { ...s, items: rows, hidden: !s.keepEmpty && !rows.some(x => x.shown) };
  });
  return { sections: out, any };
}

// ---------------------------------------------------------------- Features page
/**
 * @typedef {object} FeaturesFacts
 * @property {Array<{ id: string, name: string, img?: string, levels: unknown, subclass?: { id: string, name: string, img?: string } | null, needsSubclass?: boolean, identifier?: string, hitDie?: string }>} classes
 * @property {Array<{ id: string, label: string, rows: BookRow[] }>} sections dnd5e's feature sections (Active first, then per class, species, background, other)
 * @property {{ level?: unknown, prof?: unknown }} [summary]
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 * @property {string} [search]
 * @property {string[]} [filters]
 * @property {string} [sort]
 * @property {string} [group] "origin" | "activation"
 */

/**
 * dnd5e's feature section for an item: Active when it has activities and isn't a trait, else its origin (the advancement root's class,
 * subclass → its class, species, background), else Other. `rootType` / `rootClass` describe the item it came from.
 * @param {{ active: boolean, rootType?: string, rootClass?: string }} f
 * @returns {{ activation: "active" | "passive", origin: string }}
 */
export function featureGroup(f) {
  const origin = f.rootType === "race" ? "species" : f.rootType === "background" ? "background" : f.rootType === "class" || f.rootType === "subclass" ? (f.rootClass || "other") : "other";
  return { activation: f.active ? "active" : "passive", origin };
}

/** dnd5e's Features grouping modes: by origin (its default) or Active / Passive. */
export const FEATURE_GROUPS = Object.freeze({ origin: "Group: origin", activation: "Group: active / passive" });

/**
 * dnd5e's Features sections. Grouping "origin" (default): one section per class (classes by level, highest first), Species,
 * Background, Other. Grouping "activation": Active (has activities and isn't a trait) and Passive. `rows` carry `group` from
 * featureGroup. Empty sections are dropped.
 * @param {Array<BookRow & { group: { activation: string, origin: string } }>} rows
 * @param {{ classes: Array<{ identifier: string, name: string }>, species?: boolean, background?: boolean, mode?: string }} o
 */
export function featureSections(rows, o) {
  if (o.mode === "activation") {
    const act = { id: "active", label: "Active", rows: /** @type {BookRow[]} */ ([]) };
    const pas = { id: "passive", label: "Passive", rows: /** @type {BookRow[]} */ ([]) };
    for (const r of rows) (r.group.activation === "active" ? act : pas).rows.push(r);
    return [act, pas].filter(s => s.rows.length);
  }
  const list = [
    ...o.classes.map(c => ({ id: `class-${c.identifier}`, origin: c.identifier, label: `${c.name} features`, rows: /** @type {BookRow[]} */ ([]) })),
    ...(o.species ? [{ id: "species", origin: "species", label: "Species features", rows: /** @type {BookRow[]} */ ([]) }] : []),
    ...(o.background ? [{ id: "background", origin: "background", label: "Background features", rows: /** @type {BookRow[]} */ ([]) }] : []),
    { id: "other", origin: "other", label: "Other features", rows: /** @type {BookRow[]} */ ([]) }
  ];
  for (const r of rows) (list.find(s => s.origin === r.group.origin) ?? list[list.length - 1]).rows.push(r);
  return list.filter(s => s.rows.length);
}

/** The Features page body. @param {FeaturesFacts} f */
export function featuresPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const classes = (f.classes ?? []).map(c => `<div class="wct-cs-class" data-item-id="${esc(c.id)}">
      <button type="button" class="wct-cs-ico wct-item wc-item-slot" data-quality="common" data-action="wctShowItem" aria-label="${esc(c.name)}" data-tooltip-text="${esc(c.name)}"><img src="${esc(c.img)}" alt=""></button>
      ${c.subclass ? `<button type="button" class="wct-cs-ico wct-item wc-item-slot" data-quality="common" data-action="wctShowItem" data-item-id="${esc(c.subclass.id)}" aria-label="${esc(c.subclass.name)}" data-tooltip-text="${esc(c.subclass.name)}"><img src="${esc(c.subclass.img)}" alt=""></button>` : ""}
      <span class="wct-cs-nm"><b>${esc(c.name)}</b><small>${esc([c.subclass?.name, c.hitDie ? `hit die ${c.hitDie}` : ""].filter(Boolean).join(" · ")) || "&nbsp;"}${c.needsSubclass && ed ? ` <button type="button" class="wct-cs-chip" data-action="wctFindItem" data-item-type="subclass" data-class-identifier="${esc(c.identifier ?? "")}">+ Add subclass</button>` : ""}</small></span>
      ${edit ? `<label class="wct-cs-lvlsel"><span class="wc-sr">${esc(c.name)} level</span><select class="wct-cs-sel" data-wct-level="${esc(c.id)}">${Array.from({ length: 20 }, (_, i) => i + 1).map(l => `<option value="${l - (num(c.levels) ?? 0)}"${l === num(c.levels) ? " selected" : ""}>${l}</option>`).join("")}</select></label>` : `<span class="c">Level ${esc(num(c.levels) ?? "–")}</span>`}
      ${edit ? `<button type="button" class="wct-cs-ic2 del" data-action="wctDeleteItem" aria-label="Delete ${esc(c.name)}" data-tooltip-text="Delete ${esc(c.name)}">${svg(PAGE_ICONS.trash)}</button>` : ""}
      ${edit && c.subclass ? `<button type="button" class="wct-cs-ic2 del" data-action="wctDeleteItem" data-item-id="${esc(c.subclass.id)}" aria-label="Delete ${esc(c.subclass.name)}" data-tooltip-text="Delete ${esc(c.subclass.name)}">${svg(PAGE_ICONS.trash)}</button>` : ""}
    </div>`).join("");
  const addClass = ed && (!(f.classes ?? []).length || edit) ? `<button type="button" class="wct-cs-chip" data-action="wctFindItem" data-item-type="class">+ Add class</button>` : "";
  const s = f.summary ?? {};
  const classBox = box("Classes", `<div class="wct-cs-classes">${classes || `<p class="wct-cs-dim wct-cs-boxnote">No class yet.</p>`}${addClass ? `<div class="wct-cs-boxpad">${addClass}</div>` : ""}</div>`,
    { right: `Level ${esc(num(s.level) ?? "–")} · Proficiency ${esc(sign(s.prof))}` });
  const view = bookView(f.sections ?? [], { search: f.search, filters: f.filters, sort: f.sort });
  const head = `<span class="cols"><span>Uses</span><span>Recovery</span><span class="w"></span></span>`;
  const list = view.sections.map(sec => `<div class="items-section wct-cs-sec" data-section="${esc(sec.id)}"${sec.hidden ? " hidden" : ""}><div class="wct-cs-sect">${esc(sec.label)}${head}</div><ol class="item-list wct-cs-list">${sec.items.map(x => bookRow(x.r, { editable: ed, edit, shown: x.shown, chips: x.chips }, `<span class="c">${usesCell(x.r, ed)}</span><span class="c">${esc(x.r.recoveryLabel ?? "")}</span>`)).join("")}</ol></div>`).join("");
  const bar = toolbar({ label: "Search features", chips: FEATURE_FILTERS, filters: f.filters, search: f.search, sort: f.sort === "a" ? "a" : "m", sorts: FEATURE_SORTS, create: edit ? { action: "wctCreateFeature", label: "Create feature" } : null,
    group: { mode: f.group === "activation" ? "activation" : "origin", modes: FEATURE_GROUPS } });
  return `${classBox}
    <dnd5e-inventory class="inventory-element wct-cs-inv wct-cs-feats"><section class="wct-cs-box items-list features-list" data-item-list="features">${bar}${list || `<p class="wct-cs-dim wct-cs-boxnote">No features.${ed ? " Drop features here from a compendium." : ""}</p>`}<p class="wct-cs-dim wct-cs-boxnote wct-cs-nomatch"${list && !view.any ? "" : " hidden"}>No features match.</p></section></dnd5e-inventory>`;
}

// ---------------------------------------------------------------- Spells page
/**
 * dnd5e's spell slot pip rule (`togglePip`): clicking pip `n` sets the remaining slots to `n`, or to `n − 1` when it is the current
 * value (click the last lit pip to spend it). Clamped to 0…max.
 * @param {unknown} current @param {unknown} n @param {unknown} [max]
 */
export function pipTarget(current, n, max = Infinity) {
  const cur = Math.max(0, Math.trunc(Number(current) || 0)); const k = Math.max(0, Math.trunc(Number(n) || 0));
  const v = cur === k ? k - 1 : k;
  return Math.max(0, Math.min(Number.isFinite(Number(max)) ? Number(max) : Infinity, v));
}

/**
 * Pips for a slot section, dnd5e's way: max(override ?? max, value) pips, filled up to `value`; pips past the max are temporary.
 * @param {{ value?: unknown, max?: unknown, override?: unknown }} spells
 */
export function slotPips(spells = {}) {
  const max = num(spells.override) ?? num(spells.max) ?? 0; const value = Math.max(0, num(spells.value) ?? 0);
  return Array.from({ length: Math.max(max, value) }, (_, i) => ({ n: i + 1, filled: value >= i + 1, temp: i + 1 > max }));
}

/**
 * @typedef {object} SpellSection
 * @property {string} id the slot key ("spell1", "pact", "spell0", "atwill", "item", …)
 * @property {string} label
 * @property {string} method
 * @property {number | null} level
 * @property {{ value?: unknown, max?: unknown, override?: unknown } | null} [slots] null = no slots (cantrips, at-will, innate, ritual)
 * @property {BookRow[]} rows
 * @property {number} [order]
 */
/**
 * @typedef {object} SpellsFacts
 * @property {Array<{ label: string, ability: string, abilityLabel?: string, mod: unknown, attack: unknown, save: unknown, prepared?: { value?: unknown, max?: unknown }, primary: boolean }>} casting
 * @property {SpellSection[]} sections
 * @property {Array<{ key: string, label: string }>} [schools]
 * @property {Array<{ key: string, label: string }>} [classFilters]
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 * @property {string} [search]
 * @property {string[]} [filters]
 * @property {string} [sort]
 */

/** The Spells page body. @param {SpellsFacts} f */
export function spellsPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const cards = (f.casting ?? []).map(c => `<div class="wct-cs-cast${c.primary ? " primary" : ""}" data-ability="${esc(c.ability)}">
      <div class="wct-cs-casthead"><span class="wct-cs-lab">${esc(c.label)}</span>${ed ? `<button type="button" class="wct-cs-radio" data-action="wctSpellAbility" aria-pressed="${!!c.primary}" aria-label="Use ${esc(c.abilityLabel || c.ability)} as the spellcasting ability" data-tooltip="Set as the spellcasting ability"></button>` : ""}</div>
      <div class="wct-cs-castrow">
        <span class="wct-cs-med"><span class="wct-cs-lab sm">${esc(c.abilityLabel || c.ability)}</span><span class="v">${esc(sign(c.mod))}</span></span>
        <span class="wct-cs-med"><span class="wct-cs-lab sm">Attack</span><span class="v">${esc(sign(c.attack))}</span></span>
        <span class="wct-cs-med"><span class="wct-cs-lab sm">Save DC</span><span class="v">${esc(num(c.save) ?? "–")}</span></span>
        ${c.prepared && (num(c.prepared.value) || num(c.prepared.max)) ? `<span class="wct-cs-med"><span class="wct-cs-lab sm">Prepared</span><span class="v${num(c.prepared.max) && (num(c.prepared.value) ?? 0) > (num(c.prepared.max) ?? 0) ? " neg" : ""}">${esc(num(c.prepared.value) ?? 0)}${num(c.prepared.max) ? ` / ${esc(num(c.prepared.max))}` : ""}</span></span>` : ""}
      </div></div>`).join("");
  const keys = { schools: (f.schools ?? []).map(s => s.key), classes: (f.classFilters ?? []).map(c => c.key) };
  const sections = (f.sections ?? []).map(s => ({ ...s, keepEmpty: !!s.slots }));
  const view = bookView(sections, { search: f.search, filters: f.filters, sort: f.sort, keys });
  const head = `<span class="cols"><span>Time</span><span>Range</span><span>Target</span><span>Roll</span><span class="w"></span></span>`;
  const pips = s => {
    if (!s.slots) return "";
    if (edit) return `<button type="button" class="wct-cs-cfg" data-action="wctConfig" data-config="spellSlots" aria-label="Configure spell slots" data-tooltip="Configure spell slots">${svg(PAGE_ICONS.cog)}</button>`;
    const p = slotPips(s.slots);
    const v = Math.max(0, num(s.slots.value) ?? 0); const m = num(s.slots.override) ?? num(s.slots.max) ?? 0;
    return `<span class="wct-cs-pips wct-cs-slots" data-prop="system.spells.${esc(s.id)}.value" role="group" aria-label="${esc(s.label)}: ${v} of ${m} slots left">${p.map(x => ed
      ? `<button type="button" class="wct-cs-slot-pip${x.filled ? " on" : ""}${x.temp ? " tmp" : ""}${s.method === "pact" ? " pact" : ""}" data-action="wctPip" data-n="${x.n}" aria-pressed="${x.filled}" aria-label="Slot ${x.n}${x.temp ? " (temporary)" : ""}" data-tooltip-text="${x.filled ? "Spend this slot" : "Restore this slot"}"></button>`
      : `<i class="wct-cs-slot-pip${x.filled ? " on" : ""}${x.temp ? " tmp" : ""}${s.method === "pact" ? " pact" : ""}"></i>`).join("")}</span><span class="wct-cs-dim wct-cs-slotcount">${v} / ${m}</span>`;
  };
  const prepBtn = r => {
    if (!r.prep || !ed) return r.prep && r.prep.state !== "unprepared" ? `<span class="wct-cs-ic2 on static" data-tooltip-text="${esc(r.prep.label)}">${svg(r.prep.state === "always" ? BOOK_ICONS.always : BOOK_ICONS.prepared)}</span>` : "";
    const always = r.prep.state === "always";
    return `<button type="button" class="wct-cs-ic2 item-action${r.prep.state !== "unprepared" ? " on active" : ""}" data-action="prepare" aria-label="${esc(r.prep.label)}" data-tooltip-text="${esc(r.prep.label)}" aria-pressed="${r.prep.state !== "unprepared"}"${always ? ' aria-disabled="true"' : ""}>${svg(always ? BOOK_ICONS.always : BOOK_ICONS.prepared)}</button>`;
  };
  const list = view.sections.map(sec => `<div class="items-section wct-cs-sec" data-section="${esc(sec.id)}" data-level="${esc(sec.level ?? "")}" data-method="${esc(sec.method)}"${sec.hidden ? " hidden" : ""}>
      <div class="wct-cs-sect items-header">${esc(sec.label)}${pips(sec)}${head}</div>
      <ol class="item-list wct-cs-list">${sec.items.map(x => bookRow(x.r, { editable: ed, edit, shown: x.shown, chips: x.chips },
        `<span class="c">${esc(x.r.cols?.activation ?? "")}</span><span class="c">${esc(x.r.cols?.range ?? "")}</span><span class="c">${esc(x.r.cols?.target ?? "")}</span><span class="c">${esc(x.r.cols?.roll ?? "")}</span>`, prepBtn(x.r))).join("")}</ol></div>`).join("");
  const bar = toolbar({ label: "Search spells", chips: SPELL_FILTERS, extraFilters: [...(f.classFilters ?? []), ...(f.schools ?? [])], filters: f.filters, search: f.search, sort: ["a", "p", "m"].includes(f.sort ?? "") ? f.sort : "a", sorts: SPELL_SORTS, create: edit ? { action: "wctCreateSpell", label: "Create spell" } : null });
  return `${cards ? `<div class="wct-cs-casts">${cards}</div>` : ""}
    <dnd5e-inventory class="inventory-element wct-cs-inv wct-cs-spells"><section class="wct-cs-box items-list spells-list" data-item-list="spells">${bar}${list || `<p class="wct-cs-dim wct-cs-boxnote">No spells.${ed ? " Drop spells here from a compendium." : ""}</p>`}<p class="wct-cs-dim wct-cs-boxnote wct-cs-nomatch"${list && !view.any ? "" : " hidden"}>No spells match.</p></section></dnd5e-inventory>`;
}
