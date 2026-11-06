/**
 * Character sheet replacement, slice 4 (2.2): the Effects, Biography, Bastion and Special traits pages and the level-up control, the
 * pure part (no Foundry calls; tested in Node). sheet.mjs reads the actor the way dnd5e 6.0.6's character sheet prepares these tabs
 * (`_prepareEffectsContext` + `EffectsElement.prepareCategories`, `_prepareBiographyContext`, `_prepareBastionContext` +
 * `_prepareItemFacility`, `_prepareSpecialTraitsContext`) into plain facts; this file builds the HTML.
 *
 * Effects sit inside dnd5e's own `<dnd5e-effects>` element with its markup hooks (`li[data-effect-id]` with `data-parent-id` for item
 * effects, `.item-action[data-action]` toggle / edit / delete / toggleExpand, `[data-context-menu]`, conditions with
 * `data-action="toggleCondition"` + `data-condition-id`, `.effect-source a[data-uuid]`), so dnd5e toggles, edits, deletes, duplicates
 * and expands effects and toggles conditions itself. Text editors are Foundry's `<prose-mirror>` element, as dnd5e's sheet uses.
 */
import { esc } from "../vendor/wanderers-core/index.mjs";
import { svg, box, num, PAGE_ICONS } from "./sheet-pages-model.mjs";

export const EXTRA_ICONS = Object.freeze({
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2",
  on: "M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7M17 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  off: "M7 7h10a5 5 0 0 1 0 10H7A5 5 0 0 1 7 7M7 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  up: "M12 19V5M6 11l6-6l6 6",
  quill: "M20 4C10 4 6 10 5 20M5 20l4-1M9 12h6"
});

// ---------------------------------------------------------------- Effects
/**
 * dnd5e's effect categories, in its order (EffectsElement.prepareCategories). `hideEmpty` ones only show with something in them.
 */
export const EFFECT_CATEGORIES = Object.freeze([
  { id: "enchantment", label: "Enchantments", hideEmpty: true },
  { id: "temporary", label: "Temporary effects" },
  { id: "enchantmentActive", label: "Active enchantments", hideEmpty: true },
  { id: "passive", label: "Passive effects" },
  { id: "enchantmentInactive", label: "Inactive enchantments", hideEmpty: true },
  { id: "inactive", label: "Inactive effects" },
  { id: "suppressed", label: "Unavailable effects", hideEmpty: true, note: "These effects come from items that aren't equipped or attuned, or are otherwise switched off." }
]);

/**
 * Which category an effect goes in, exactly as dnd5e's `prepareCategories` decides (concealed effects and non-concentration
 * conditions are left out: null).
 * @param {{ concealed?: boolean, condition?: boolean, concentrating?: boolean, appliedEnchantment?: boolean, enchantment?: boolean, expired?: boolean, suppressed?: boolean, disabled?: boolean, temporary?: boolean }} e
 */
export function effectCategory(e) {
  if (e.concealed) return null;
  if (e.condition && !e.concentrating) return null;
  if (e.appliedEnchantment) return e.disabled || e.expired ? "enchantmentInactive" : "enchantmentActive";
  if (e.enchantment) return "enchantment";
  if (e.expired) return "inactive";
  if (e.suppressed) return "suppressed";
  if (e.disabled) return "inactive";
  if (e.temporary) return "temporary";
  return "passive";
}

/**
 * @typedef {object} EffectRow
 * @property {string} id
 * @property {string} [uuid]
 * @property {string | null} [parentId] the item it lives on (dnd5e's data-parent-id), null for actor effects
 * @property {string} name
 * @property {string} [img]
 * @property {string} cat category id (effectCategory)
 * @property {boolean} [disabled]
 * @property {boolean} [toggleable] false for a concentration effect (dnd5e: break it from the menu instead)
 * @property {{ name: string, uuid?: string, item?: boolean } | null} [source]
 * @property {string[]} [duration] dnd5e's duration parts (most / least significant)
 * @property {string} [durationIcon]
 * @property {boolean} [showDuration]
 * @property {string | null} [expanded] dnd5e's effect-summary HTML when expanded
 * @property {Array<{ name: string, value: string }>} [changes]
 */
/**
 * @typedef {object} EffectsFacts
 * @property {EffectRow[]} effects
 * @property {Array<{ id: string, name: string, img?: string, active: boolean, level?: number | null, reference?: string }>} conditions
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 * @property {string} [search]
 */

/** Effects grouped into dnd5e's categories, in order, with hidden empty ones dropped. @param {EffectRow[]} rows */
export function effectSections(rows) {
  return EFFECT_CATEGORIES.map(c => ({ ...c, rows: rows.filter(r => r.cat === c.id) })).filter(c => c.rows.length || !c.hideEmpty);
}

const effectRow = (r, o) => {
  const ic = (action, label, inner, cls = "") => `<button type="button" class="wct-cs-ic2 item-action effect-control${cls ? ` ${cls}` : ""}" data-action="${action}" aria-label="${esc(label)}" data-tooltip="${esc(label)}">${inner}</button>`;
  const ctl = [
    o.edit ? ic("edit", "Edit effect", svg(PAGE_ICONS.edit)) + ic("delete", "Delete effect", svg(PAGE_ICONS.trash), "del")
      : o.editable && r.toggleable !== false ? ic("toggle", r.disabled ? "Enable effect" : "Disable effect", svg(r.disabled ? EXTRA_ICONS.off : EXTRA_ICONS.on), r.disabled ? "" : "on active") : "",
    `<button type="button" class="wct-cs-ic2 item-action effect-control always-interactive" data-action="toggleExpand" data-toggle-description aria-label="Show or hide the description" data-tooltip="Show or hide the description"><i class="fa-solid fa-${r.expanded ? "compress" : "expand"}" inert></i></button>`,
    `<button type="button" class="wct-cs-ic2 effect-control always-interactive" data-context-menu aria-label="More actions" data-tooltip="More actions">${svg(PAGE_ICONS.more)}</button>`
  ].join("");
  const dur = r.showDuration && (r.duration ?? []).length ? `<span class="wct-cs-dur" data-tooltip="Duration">${svg(EXTRA_ICONS.clock)}${esc(r.duration?.[0] ?? "")}${r.duration?.[1] ? ` <small>${esc(r.duration[1])}</small>` : ""}</span>` : "";
  const src = r.source ? `<span class="effect-source">${r.source.uuid ? `<a data-uuid="${esc(r.source.uuid)}">${esc(r.source.name)}</a>` : esc(r.source.name)}</span>` : "";
  const changes = (r.changes ?? []).length ? `<ol class="wct-cs-changes">${(r.changes ?? []).map(c => `<li><span>${esc(c.name)}</span><b>${esc(c.value)}</b></li>`).join("")}</ol>` : "";
  return `<li class="item effect collapsible wct-cs-irow-wrap${r.expanded ? "" : " collapsed"}${r.disabled ? " off" : ""}" data-uuid="${esc(r.uuid ?? "")}" data-effect-id="${esc(r.id)}" data-entry-id="${esc(r.id)}" data-item-name="${esc(r.name)}"${r.parentId ? ` data-parent-id="${esc(r.parentId)}"` : ""}${o.shown ? "" : " hidden"}>
    <div class="item-row wct-cs-irow draggable">
      <span class="wct-cs-ico wc-item-slot" data-quality="common"><img src="${esc(r.img)}" alt=""></span>
      <span class="wct-cs-nm effect-name"><b>${esc(r.name)}</b>${dur ? `<small>${dur}</small>` : ""}</span>
      <span class="c w">${src}</span>
      <span class="ctl">${ctl}</span>
    </div>
    <div class="item-description collapsible-content"><div class="wrapper">${changes}${r.expanded ?? ""}</div></div>
  </li>`;
};

/** The Effects page body. @param {EffectsFacts} f */
export function effectsPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const q = String(f.search ?? "").trim().toLowerCase();
  const match = r => !q || String(r.name).toLowerCase().includes(q);
  const conds = (f.conditions ?? []).map(c => {
    const lvl = num(c.level);
    const inner = `<img src="${esc(c.img)}" alt=""><span>${esc(c.name)}</span>${lvl !== null ? `<b class="wct-cs-clvl">${lvl}</b>` : ""}`;
    return ed
      ? `<button type="button" class="wct-cs-cnd${c.active ? " on" : ""}" data-action="toggleCondition" data-condition-id="${esc(c.id)}" aria-pressed="${!!c.active}" data-tooltip="${lvl !== null ? "Click to raise, right-click to lower" : c.active ? "Click to remove" : "Click to add"}">${inner}</button>`
      : `<span class="wct-cs-cnd${c.active ? " on" : ""}">${inner}</span>`;
  }).join("");
  const secs = effectSections(f.effects ?? []);
  let any = false;
  const list = secs.map(s => {
    const rows = s.rows.map(r => { const shown = match(r); if (shown) any = true; return effectRow(r, { editable: ed, edit, shown }); }).join("");
    const hidden = q && !s.rows.some(match);
    return `<div class="items-section wct-cs-sec" data-effect-type="${esc(s.id)}"${hidden ? " hidden" : ""}><div class="wct-cs-sect">${esc(s.label)}<span class="cols"><span class="w">Source</span><span class="w"></span></span></div>${s.note ? `<p class="wct-cs-dim wct-cs-boxnote">${esc(s.note)}</p>` : ""}<ol class="item-list wct-cs-list">${rows || `<li class="wct-cs-empty wct-cs-dim">None</li>`}</ol></div>`;
  }).join("");
  const bar = `<div class="wct-cs-tbar"><label class="wct-cs-srch">${svg(PAGE_ICONS.search)}<span class="wc-sr">Search effects</span><input type="search" data-wct-search value="${esc(f.search ?? "")}" placeholder="Search effects"></label>${edit ? `<button type="button" class="wct-cs-gbtn sm" data-action="wctCreateEffect">+ Create effect</button>` : ""}</div>`;
  return `<dnd5e-effects class="effects-element wct-cs-effects">
    ${box("Conditions", `<div class="wct-cs-cnds">${conds || `<p class="wct-cs-dim">None</p>`}</div>`, { right: ed ? "click to toggle" : "" })}
    <section class="wct-cs-box items-list effects-list" data-item-list="effects">${bar}${list}<p class="wct-cs-dim wct-cs-boxnote wct-cs-nomatch"${q && !any ? "" : " hidden"}>No effects match.</p></section>
  </dnd5e-effects>`;
}

// ---------------------------------------------------------------- Biography
/** dnd5e's characteristics, in its order (`_prepareBiographyContext`). */
export const CHARACTERISTICS = Object.freeze(["alignment", "eyes", "height", "faith", "hair", "weight", "gender", "skin", "age"]);
/** dnd5e's text boxes: ideals, bonds, flaws (left), personality traits and appearance (right). */
export const TEXTBOXES = Object.freeze([
  { key: "ideal", label: "Ideals" }, { key: "bond", label: "Bonds" }, { key: "flaw", label: "Flaws" },
  { key: "trait", label: "Personality traits" }, { key: "appearance", label: "Appearance" }
]);

/**
 * dnd5e's plain-text display of a text box (its `textFormat` helper: paragraphs on blank lines, line breaks kept), escaped.
 * @param {unknown} text
 */
export function textFormat(text) {
  const t = String(text ?? "").trim(); if (!t) return "";
  return t.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/**
 * @typedef {object} BiographyFacts
 * @property {Array<{ key: string, label: string, value: unknown, source: unknown }>} characteristics
 * @property {Record<string, unknown>} text ideal / bond / flaw / trait / appearance
 * @property {{ enriched: string, source: string }} biography enriched HTML (play) and the source (editor)
 * @property {string} uuid the actor's uuid (prose-mirror document-uuid)
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 */

/** The Biography page body. @param {BiographyFacts} f */
export function biographyPageHTML(f) {
  const edit = !!f.edit && !!f.editable;
  const chars = (f.characteristics ?? []).map(c => `<li><span class="wct-cs-dim">${esc(c.label)}</span>${edit ? `<input type="text" class="wct-cs-tin" data-name="system.details.${esc(c.key)}" value="${esc(c.source ?? "")}" aria-label="${esc(c.label)}">` : `<b>${esc(c.value ?? "") || "–"}</b>`}</li>`).join("");
  const boxes = TEXTBOXES.map(t => box(t.label, edit
    ? `<textarea class="wct-cs-ta" data-name="system.details.${t.key}" aria-label="${esc(t.label)}">${esc(f.text?.[t.key] ?? "")}</textarea>`
    : `<div class="wct-cs-text">${textFormat(f.text?.[t.key]) || `<p class="wct-cs-dim">–</p>`}</div>`, { cls: `wct-cs-tbox wct-cs-tb-${t.key}` })).join("");
  const bio = edit
    ? `<prose-mirror name="system.details.biography.value" value="${esc(f.biography?.source ?? "")}" document-uuid="${esc(f.uuid)}" data-wct-prose="system.details.biography.value"></prose-mirror>`
    : `<div class="wct-cs-bio editor-content">${f.biography?.enriched || `<p class="wct-cs-dim">No biography yet.</p>`}</div>`;
  return `${box("Characteristics", `<ul class="wct-cs-chars">${chars}</ul>`)}
    <div class="wct-cs-tboxes">${boxes}</div>
    ${box("Biography", bio, { cls: "wct-cs-biobox" })}`;
}

// ---------------------------------------------------------------- Bastion
/**
 * dnd5e's facility count for a type at a character level (`CONFIG.DND5E.facilities.advancement[type]`: { level: count }): the count
 * of the highest listed level at or below the character's level, else 0.
 * @param {Record<string, unknown>} table @param {unknown} level
 */
export function facilitiesAt(table = {}, level = 0) {
  const lv = num(level) ?? 0;
  const hit = Object.entries(table ?? {}).map(([k, v]) => [Number(k), num(v) ?? 0]).filter(([k]) => Number.isFinite(k) && k <= lv).sort((a, b) => b[0] - a[0])[0];
  return hit ? hit[1] : 0;
}

/**
 * dnd5e's facility slots: chosen facilities of a type, value (special: the non-free ones; basic: all), max from the table, and empty
 * "available" slots; basic always offers at least one (dnd5e's "build" slot).
 * @param {"basic" | "special"} type @param {Array<{ free?: boolean }>} chosen @param {number} max
 */
export function facilitySlots(type, chosen, max) {
  const value = chosen.filter(c => type === "basic" || !c.free).length;
  const free = Math.max(0, max - value);
  const available = Array.from({ length: free }, () => ({ build: false }));
  if (type === "basic" && !available.length) available.push({ build: true });
  return { value, max, available };
}

/**
 * @typedef {{ index?: number, uuid?: string, name?: string, img?: string, empty?: boolean, pending?: boolean }} Occupant
 * @typedef {object} FacilityFact
 * @property {string} id
 * @property {string} name
 * @property {string} [img]
 * @property {string} [subtitle] (dnd5e's: size or Unbuilt, stock)
 * @property {boolean} [built]
 * @property {boolean} [disabled] damaged
 * @property {boolean} [special]
 * @property {boolean} [free]
 * @property {{ value?: unknown, max?: unknown, pct?: unknown } | null} [progress] shown while an order runs
 * @property {string} [order] the running order's label
 * @property {{ uuid: string, name: string, img?: string } | null} [craft]
 * @property {Occupant[]} [hirelings]
 * @property {Occupant[]} [defenders]
 * @property {Occupant[]} [creatures]
 */
/**
 * @typedef {object} BastionFacts
 * @property {string} name
 * @property {string} [nameSource]
 * @property {Array<{ uuid: string, name: string, img?: string, facility: string, index: number }>} defenders
 * @property {{ chosen: FacilityFact[], value: number, max: number, available: Array<{ build: boolean }> }} basic
 * @property {{ chosen: FacilityFact[], value: number, max: number, available: Array<{ build: boolean }> }} special
 * @property {{ enriched: string, source: string }} description
 * @property {string} uuid
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 */

const occupants = (list, prop, kind, ed) => list?.length ? `<div class="wct-cs-occ facility-occupants ${kind}" data-prop="${prop}">${list.map(o => `<span class="wct-cs-oslot occupant-slot${o.empty ? " empty" : ""}${o.pending ? " pending" : ""}" data-index="${esc(o.index ?? "")}"${o.uuid ? ` data-uuid="${esc(o.uuid)}"` : ""}${o.pending ? ' data-tooltip="Trade pending"' : o.name ? ` data-tooltip="${esc(o.name)}"` : ""}>${o.uuid && !o.pending ? `<button type="button" class="wct-cs-oimg" data-action="wctShowUuid" aria-label="${esc(o.name ?? "")}"><img src="${esc(o.img)}" alt=""></button>` : ""}${ed && (o.uuid || o.pending) ? `<button type="button" class="wct-cs-odel" data-action="wctDeleteOccupant" aria-label="Remove">×</button>` : ""}</span>`).join("")}</div>` : "";

const facilityCard = (c, ed) => `<li class="wct-cs-fac${c.built === false ? " building" : ""}${c.disabled ? " damaged" : ""}" data-item-id="${esc(c.id)}" data-facility-id="${esc(c.id)}">
    <div class="wct-cs-fachead">
      <span class="wct-cs-ico wc-item-slot" data-quality="common"><img src="${esc(c.img)}" alt=""></span>
      ${ed && !c.disabled ? `<button type="button" class="wct-cs-nm wct-cs-facname" data-action="wctUseFacility" data-tooltip="Give an order"><b>${esc(c.name)}</b><small>${c.subtitle ?? ""}</small></button>` : `<span class="wct-cs-nm wct-cs-facname"><b>${esc(c.name)}</b><small>${c.subtitle ?? ""}</small></span>`}
      ${c.craft ? `<button type="button" class="wct-cs-ico wc-item-slot" data-quality="common" data-action="wctShowUuid" data-uuid="${esc(c.craft.uuid)}" aria-label="${esc(c.craft.name)}" data-tooltip="Crafting: ${esc(c.craft.name)}"><img src="${esc(c.craft.img)}" alt=""></button>` : ""}
      ${c.order ? `<span class="wct-cs-chip static" data-tooltip="Current order">${esc(c.order)}</span>` : ""}
      <button type="button" class="wct-cs-ic2" data-action="wctShowItem" aria-label="Open ${esc(c.name)}" data-tooltip="Open">${svg(PAGE_ICONS.more)}</button>
    </div>
    ${c.progress && num(c.progress.max) ? `<div class="wct-cs-rbar sm" role="meter" aria-label="Order progress" aria-valuemin="0" aria-valuemax="${esc(num(c.progress.max))}" aria-valuenow="${esc(num(c.progress.value) ?? 0)}"><i class="hd" style="width:${Math.max(0, Math.min(100, num(c.progress.pct) ?? 0))}%"></i><span>${esc(num(c.progress.value) ?? 0)} / ${esc(num(c.progress.max))}</span></div>` : ""}
    ${occupants(c.hirelings, "system.hirelings", "hirelings", ed)}${occupants(c.defenders, "system.defenders", "defenders", ed)}${occupants(c.creatures, "system.trade.creatures", "creatures", ed)}
  </li>`;

/** The Bastion page body. @param {BastionFacts} f */
export function bastionPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const name = edit ? `<input type="text" class="wct-cs-tin wct-cs-bname" data-name="system.bastion.name" value="${esc(f.nameSource ?? f.name ?? "")}" aria-label="Bastion name" placeholder="Bastion name">` : `<h3 class="wct-cs-ttl wct-cs-bname">${esc(f.name || "Bastion")}</h3>`;
  const roster = (f.defenders ?? []).length ? `<ul class="wct-cs-roster">${f.defenders.map(d => `<li class="defender" data-facility-id="${esc(d.facility)}" data-prop="system.defenders" data-index="${esc(d.index)}" data-uuid="${esc(d.uuid)}"><button type="button" class="wct-cs-oimg" data-action="wctShowUuid" aria-label="${esc(d.name)}" data-tooltip="${esc(d.name)}"><img src="${esc(d.img)}" alt=""></button>${ed ? `<button type="button" class="wct-cs-odel" data-action="wctDeleteOccupant" aria-label="Remove ${esc(d.name)}">×</button>` : ""}</li>`).join("")}</ul>` : `<p class="wct-cs-dim wct-cs-boxnote">No defenders.</p>`;
  const group = (type, g) => `<ul class="wct-cs-facs">${g.chosen.map(c => facilityCard(c, ed)).join("")}${ed ? g.available.map(a => `<li><button type="button" class="wct-cs-fac empty" data-action="wctFindItem" data-item-type="facility" data-facility-type="${type}">${a.build ? "+ Build a basic facility" : `+ Free ${type} facility`}</button></li>`).join("") : ""}</ul>`;
  const desc = edit
    ? `<prose-mirror name="system.bastion.description" value="${esc(f.description?.source ?? "")}" document-uuid="${esc(f.uuid)}" data-wct-prose="system.bastion.description"></prose-mirror>`
    : `<div class="wct-cs-bio editor-content">${f.description?.enriched || `<p class="wct-cs-dim">No description.</p>`}</div>`;
  return `<div class="wct-cs-bastion">${name}
    ${box("Defenders", roster)}
    ${box("Basic facilities", group("basic", f.basic))}
    ${box("Special facilities", group("special", f.special), { right: `${esc(f.special.value)} / ${esc(f.special.max)}` })}
    ${box("Description", desc, { cls: "wct-cs-biobox" })}</div>`;
}

// ---------------------------------------------------------------- Special traits
/**
 * @typedef {object} SpecialFacts
 * @property {Array<{ value: string, label: string }>} classes
 * @property {string} originalClass
 * @property {string} [classHint] dnd5e's hint for the original class (DND5E.ClassMakeOriginalHint)
 * @property {Array<{ label: string, fields: Array<{ name: string, label: string, hint?: string, type: "boolean" | "number" | "string", value: unknown }> }>} sections
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 */

/** The Special traits page body (dnd5e's fields, disabled in Play mode as on its sheet). @param {SpecialFacts} f */
export function specialPageHTML(f) {
  const on = !!f.edit && !!f.editable; const dis = on ? "" : " disabled";
  const field = x => {
    const id = `wct-st-${String(x.name).replace(/[^\w-]/g, "-")}`;
    const input = x.type === "boolean"
      ? `<input type="checkbox" id="${id}" data-name="${esc(x.name)}" data-wct-check${x.value ? " checked" : ""}${dis}>`
      : `<input type="text" class="wct-cs-tin" id="${id}" data-name="${esc(x.name)}" value="${esc(x.value ?? "")}"${x.type === "number" ? ' inputmode="numeric"' : ""}${dis}>`;
    return `<div class="wct-cs-field${x.type === "boolean" ? " check" : ""}"><label for="${id}">${esc(x.label)}</label>${input}${x.hint ? `<p class="wct-cs-dim wct-cs-hint">${esc(x.hint)}</p>` : ""}</div>`;
  };
  const cls = `<div class="wct-cs-field"><label for="wct-st-oc">Original class</label><select id="wct-st-oc" class="wct-cs-sel" data-name="system.details.originalClass"${dis}>${(f.classes ?? []).map(c => `<option value="${esc(c.value)}"${c.value === f.originalClass ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select>${f.classHint ? `<p class="wct-cs-dim wct-cs-hint">${esc(f.classHint)}</p>` : ""}</div>`;
  return `${on ? "" : `<p class="wct-cs-dim wct-cs-boxnote">Switch to Edit to change these.</p>`}${box("Class", cls)}${(f.sections ?? []).map(s => box(s.label, `<div class="wct-cs-fields">${s.fields.map(field).join("")}</div>`)).join("")}`;
}

// ---------------------------------------------------------------- level up
/**
 * Level-up choices (the title band's Level up, edit mode): each class one level higher, unless the character is at dnd5e's
 * maximum level. `{ classes: [{ id, name, next }], atMax }`.
 * @param {Array<{ id: string, name: string, levels: unknown }>} classes @param {unknown} level @param {unknown} [maxLevel]
 */
export function levelUpChoices(classes = [], level = 0, maxLevel = 20) {
  const atMax = (num(level) ?? 0) >= (num(maxLevel) ?? 20);
  return { atMax, classes: atMax ? [] : classes.map(c => ({ id: c.id, name: c.name, next: (num(c.levels) ?? 0) + 1 })) };
}
