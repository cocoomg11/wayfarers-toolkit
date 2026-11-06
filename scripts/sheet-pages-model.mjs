/**
 * Character sheet replacement (feature `characterSheet`), slice 2: the Character, Details and Inventory pages, the pure part (no
 * Foundry calls; tested in Node). sheet.mjs reads the actor's prepared dnd5e data and the character pane's slot and weapon-set state
 * (pane.mjs: the same item flags `slot` and actor flag `weaponSets`) into plain facts; this file turns them into HTML and decides
 * the small display rules (proficiency marks, inventory search / filter / sort, section grouping). Nothing here computes a stat.
 *
 * Buttons carry `data-action` names that sheet.mjs maps to dnd5e's own methods (rollAbilityCheck, rollSavingThrow, rollSkill,
 * rollToolCheck, rollConcentration, item.use, dnd5e's config apps). The Inventory list sits inside dnd5e's own `<dnd5e-inventory>`
 * element and uses its markup conventions (`.item-action[data-action]`, `data-name` inputs, `[data-context-menu]`, rows with
 * `data-item-id`), so dnd5e's inventory element handles use, view, edit, delete, equip, attune, quantity, uses, expand and the item
 * context menu itself.
 */
import { esc } from "../vendor/wanderers-core/index.mjs";
import * as PM from "./pane-model.mjs";

const num = v => (v !== null && v !== "" && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
const sign = PM.sign;
const tone = v => { const n = num(v); return n === null || n === 0 ? "" : n > 0 ? "pos" : "neg"; };
const svg = (d, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
const attr = (k, v) => (v === undefined || v === null || v === "" ? "" : ` ${k}="${esc(v)}"`);

export const PAGE_ICONS = Object.freeze({
  cog: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4",
  equip: "M12 3l8 3v6c0 5-4 8-8 9c-4-1-8-4-8-9V6z",
  attune: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
  more: "M12 5v.01M12 12v.01M12 19v.01",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  recharge: "M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a5 5 0 1 0 1 6",
  bolt: "M13 2L4 14h7l-1 8l9-12h-7z",
  coins: "M12 4c4 0 7 1.3 7 3s-3 3-7 3s-7-1.3-7-3s3-3 7-3M5 7v5c0 1.7 3 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3 3 7 3s7-1.3 7-3v-5",
  conc: "M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3"
});

// ---------------------------------------------------------------- shared bits
/** A box with a gold title and an optional right-hand part. */
const box = (title, body, { right = "", cls = "" } = {}) => `<section class="wct-cs-box${cls ? ` ${cls}` : ""}"><h4>${esc(title)}${right ? `<span class="r">${right}</span>` : ""}</h4>${body}</section>`;
const cfgBtn = (label, data) => `<button type="button" class="wct-cs-cfg" data-action="wctConfig"${Object.entries(data).map(([k, v]) => attr(`data-${k}`, v)).join("")} aria-label="${esc(label)}" data-tooltip="${esc(label)}">${svg(PAGE_ICONS.cog)}</button>`;

/** dnd5e proficiency multipliers → the mark's class: 0 none, 0.5 half, 1 proficient, 2 expertise. @param {unknown} v */
export function profClass(v) {
  const n = num(v) ?? 0;
  return n >= 2 ? "e" : n >= 1 ? "f" : n > 0 ? "h" : "";
}
export const PROF_LABELS = Object.freeze({ "": "Not proficient", h: "Half proficiency", f: "Proficient", e: "Expertise" });

/**
 * dnd5e's delta input rule (utils parseDelta): "+2" / "-3" change the current value, "=5" sets it, a plain number sets it; anything
 * that isn't a number keeps the current value. Returns null for an empty field (no change).
 * @param {unknown} raw @param {unknown} current
 */
export function parseDelta(raw, current) {
  const t = String(raw ?? "").trim(); if (!t) return null;
  const cur = Number(current) || 0;
  let v = Number(t);
  if (t[0] === "+" || t[0] === "-") v = cur + parseFloat(t);
  else if (t[0] === "=") v = Number(t.slice(1));
  return Number.isFinite(v) ? v : cur;
}

// ---------------------------------------------------------------- Character page
/**
 * @typedef {{ id: string, name: string, img?: string, quality?: string }} ItemFact
 * @typedef {{ slot: string, label: string, item?: ItemFact | null, ghost?: ItemFact | null }} SlotFact
 * @typedef {{ set: string, hand: string, label: string, glyph: string, item?: ItemFact | null, ghost?: ItemFact | null, worn?: boolean }} HandFact
 * @typedef {{ id: string, label: string, active: boolean, lock?: string | null, hands: HandFact[] }} SetFact
 * @typedef {object} CharacterFacts
 * @property {SlotFact[]} left
 * @property {SlotFact[]} right
 * @property {SlotFact[] | null} [bottom] the old Main Hand / Off Hand / Ranged row (weapon sets off)
 * @property {SetFact[] | null} [sets] weapon sets (on)
 * @property {SlotFact | null} [relic]
 * @property {Array<{ tone: string, text: string, stowShield?: string }>} [notes]
 * @property {{ src?: string, isToken?: boolean, isVideo?: boolean }} [portrait]
 * @property {string} [name]
 * @property {{ value?: unknown, max?: unknown } | null} [attuned]
 * @property {Array<{ key: string, label: string, abbr: string, value: number | null, mod: number, source?: unknown }>} [attributes]
 * @property {ReturnType<typeof PM.defence>} [defence]
 * @property {{ title?: string, name?: string, quality?: string, empty?: string, rows?: Array<{ label: string, value: string }>, options?: string, use?: string | null } | null} [attack]
 * @property {Array<ItemFact & { equipped?: boolean }>} [bag]
 * @property {number} [loose]
 * @property {boolean} [editable] the user owns the actor (slots, drag and drop, rolls)
 * @property {boolean} [edit] edit mode
 */

const slotCell = (/** @type {SlotFact} */ s, extra = "") => {
  if (s.item) return `<div class="wct-cs-slot wct-slot wc-item-slot filled draggable" data-quality="${esc(s.item.quality || "common")}" data-slot="${esc(s.slot)}" data-item-id="${esc(s.item.id)}" aria-label="${esc(s.label)}: ${esc(s.item.name)}"${extra}><img src="${esc(s.item.img)}" alt=""></div>`;
  if (s.ghost) return `<div class="wct-cs-slot wct-slot wc-item-slot ghost" data-quality="${esc(s.ghost.quality || "common")}" data-slot="${esc(s.slot)}" data-item-id="${esc(s.ghost.id)}" aria-label="${esc(s.label)}: blocked by ${esc(s.ghost.name)}"${extra}><img src="${esc(s.ghost.img)}" alt=""></div>`;
  return `<div class="wct-cs-slot wct-slot wc-item-slot wc-empty empty" data-slot="${esc(s.slot)}" aria-label="${esc(s.label)} (empty)" data-tooltip="${esc(s.label)}"${extra}>${PM.glyph(s.slot)}</div>`;
};
const handCell = (/** @type {HandFact} */ h, setLabel) => {
  const data = ` data-set="${esc(h.set)}" data-hand="${esc(h.hand)}"`;
  if (h.item) return `<div class="wct-cs-slot wct-slot wct-hand wc-item-slot filled draggable${h.worn ? " worn" : ""}" data-quality="${esc(h.item.quality || "common")}"${data} data-item-id="${esc(h.item.id)}" aria-label="${esc(setLabel)} ${esc(h.label)}: ${esc(h.item.name)}"><img src="${esc(h.item.img)}" alt=""></div>`;
  if (h.ghost) return `<div class="wct-cs-slot wct-slot wct-hand wc-item-slot ghost" data-quality="${esc(h.ghost.quality || "common")}"${data} data-item-id="${esc(h.ghost.id)}" aria-label="${esc(h.label)}: blocked by ${esc(h.ghost.name)}"><img src="${esc(h.ghost.img)}" alt=""></div>`;
  return `<div class="wct-cs-slot wct-slot wct-hand wc-item-slot wc-empty empty"${data} aria-label="${esc(setLabel)} ${esc(h.label)} (empty)" data-tooltip="${esc(setLabel)}: ${esc(h.label)}">${PM.glyph(h.glyph)}</div>`;
};

/** "Attuned 2 / 3" with the over-limit tone. @param {{ value?: unknown, max?: unknown } | null | undefined} a */
export function attunedText(a) {
  const v = num(a?.value); const m = num(a?.max);
  if (v === null || m === null) return null;
  return { text: `${v} / ${m}`, over: v > m };
}

/** The Character page body. @param {CharacterFacts} f */
export function characterPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const att = attunedText(f.attuned);
  const p = f.portrait ?? {};
  const media = p.isVideo
    ? `<video src="${esc(p.src)}" autoplay muted loop playsinline disablepictureinpicture></video>`
    : `<img src="${esc(p.src)}" alt="${esc(f.name ?? "")}">`;
  const portrait = `<div class="wct-cs-model wct-portrait${p.isToken ? " token" : ""}" data-drop="auto"${ed ? ' data-tooltip="Drop an item here to equip it"' : ""}>
    <button type="button" class="wct-cs-art" data-action="wctArtwork" aria-label="View the ${p.isToken ? "token" : "portrait"} art">${media}</button>
    ${att ? `<span class="wct-cs-attuned${att.over ? " over" : ""}">Attuned <b>${esc(att.text)}</b></span>` : ""}
    ${edit ? `<button type="button" class="wct-cs-gbtn sm wct-cs-portbtn" data-action="wctPortrait">Change ${p.isToken ? "token art" : "portrait"}</button>
      <label class="wct-cs-tokport"><input type="checkbox" data-wct-tokport${p.isToken ? " checked" : ""}> Show token instead of portrait</label>` : ""}
  </div>`;
  const left = `<div class="wct-cs-col wct-col left">${(f.left ?? []).map(s => slotCell(s)).join("")}</div>`;
  const right = `<div class="wct-cs-col wct-col right">${(f.right ?? []).map(s => slotCell(s)).join("")}</div>`;
  let weapons = "";
  if (f.sets) {
    weapons = f.sets.map(s => `<div class="wct-cs-wset wct-set ${s.active ? "on active" : "off stowed"}" data-set="${esc(s.id)}">
      ${ed ? `<button type="button" class="wct-cs-wtab" data-wct-activate="${esc(s.id)}" aria-pressed="${s.active}" data-tooltip="${s.active ? `${esc(s.label)} set (in hand)` : `Swap to the ${esc(s.label)} set`}">${esc(s.label)}${s.lock ? ` <span class="wct-cs-lock" data-tooltip="${esc(s.lock)}" aria-label="Locked: ${esc(s.lock)}">${svg(PAGE_ICONS.lock)}</span>` : ""}</button>` : `<span class="wct-cs-wtab static">${esc(s.label)}</span>`}
      <div class="wct-cs-hands">${s.hands.map(h => handCell(h, s.label)).join("")}</div><span class="wct-cs-wstate">${s.active ? "In hand" : "Stowed"}</span></div>`).join("");
    if (f.relic) weapons += `<div class="wct-cs-wset wct-set wct-relic"><span class="wct-cs-wtab static">Relic</span><div class="wct-cs-hands">${slotCell(f.relic)}</div><span class="wct-cs-wstate">Worn</span></div>`;
  } else if (f.bottom) weapons = f.bottom.map(s => slotCell(s)).join("");
  const notes = (f.notes ?? []).length ? `<ul class="wct-cs-setnotes">${(f.notes ?? []).map(n => `<li class="${esc(n.tone)}">${esc(n.text)}${n.stowShield && ed ? ` <button type="button" class="wct-cs-chip" data-wct-stow="${esc(n.stowShield)}">Stow shield</button>` : ""}</li>`).join("")}</ul>` : "";

  // Attributes: name | score | (mod) in three aligned columns; click rolls dnd5e's ability check; edit mode: score inputs.
  const attrs = (f.attributes ?? []).map(a => {
    const score = edit
      ? `<input type="text" class="wct-cs-ein" data-name="system.abilities.${esc(a.key)}.value" value="${esc(a.source ?? a.value ?? "")}" placeholder="10" inputmode="numeric" aria-label="${esc(a.label)} score">`
      : `<b>${a.value ?? "–"}</b>`;
    const name = ed ? `<button type="button" class="wct-cs-roll" data-action="wctRoll" data-type="check" data-ability="${esc(a.key)}" data-tooltip="Roll a ${esc(a.label)} check">${esc(a.label)}</button>` : `<span>${esc(a.label)}</span>`;
    return `<li class="wct-cs-attr" data-ability="${esc(a.key)}">${name}${score}<span class="wct-cs-num ${tone(a.mod)}">(${sign(a.mod)})</span></li>`;
  }).join("");
  const d = f.defence;
  const def = d ? `<ul class="wct-cs-kv"><li><span>Armor Class</span><b>${esc(d.ac)}</b></li><li><span>Hit points</span><b>${esc(d.hp)}</b></li><li><span>Hit dice</span><b>${esc(d.hd)}</b></li><li><span>Initiative</span><b>${esc(d.init)}</b></li><li><span>Speed</span><b>${esc(d.speed)}</b></li>
    <li class="wct-cs-saves"><span>Saves</span><b>${d.saves.map(s => `<span class="${s.prof ? "prof" : ""}"${s.prof ? ' data-tooltip="Proficient"' : ""}>${esc(s.abbr)} ${esc(s.value)}</span>`).join(" ")}</b></li></ul>` : "";
  const a = f.attack;
  const atk = a ? box(a.title || "Attack", `${a.name ? `<p class="wct-cs-atkname wc-q-text" data-quality="${esc(a.quality || "common")}">${esc(a.name)}</p>` : ""}${a.empty ? `<p class="wct-cs-dim wct-cs-boxnote">${esc(a.empty)}</p>` : ""}<ul class="wct-cs-kv">${(a.rows ?? []).map(r => `<li><span>${esc(r.label)}</span><b>${esc(r.value)}</b></li>`).join("")}${a.use && ed ? `<li><span>Attack</span><b><button type="button" class="wct-cs-gbtn sm" data-action="wctUse" data-item-id="${esc(a.use)}">Use</button></b></li>` : ""}</ul>`,
    { right: a.options ? `<label class="wc-sr" for="wct-cs-atk">Attack shown</label><select id="wct-cs-atk" class="wct-cs-sel" data-wct-attack>${a.options}</select>` : "", cls: "wct-cs-attack" }) : "";
  const bag = f.bag ?? [];
  const loose = Math.max(0, Math.trunc(num(f.loose) ?? 0));
  const bagBox = box("Equippable items", `<div class="wct-cs-bag" data-drop="bag">${bag.length ? bag.map(i => `<div class="wct-cs-slot wct-item wc-item-slot draggable${i.equipped ? " equipped" : ""}" data-quality="${esc(i.quality || "common")}" data-item-id="${esc(i.id)}" role="button" tabindex="0" aria-label="${esc(i.name)}${i.equipped ? " (equipped, not in a slot)" : ""}"><img src="${esc(i.img)}" alt=""></div>`).join("") : `<p class="wct-cs-dim">Nothing else to equip.${ed ? " Drop items here from a compendium or the sidebar to add them." : ""}</p>`}</div>`,
    { right: loose ? `${loose} equipped but not in a slot${ed ? ` <button type="button" class="wct-cs-chip" data-action="wctSlotEquipped">Slot equipped items</button>` : ""}` : ed ? "drag onto a slot, click to equip, right-click a slot to remove" : "", cls: "wct-cs-bagbox" });
  return `<div class="wct-cs-doll">
      <div class="wct-cs-dollgrid">${left}${portrait}${right}</div>
      <div class="wct-cs-weapons${f.sets ? " sets" : ""}">${weapons}</div>${notes}
    </div>
    <div class="wct-cs-boxes">
      ${box("Attributes", `<ul class="wct-cs-kv wct-cs-attrs">${attrs}</ul>`, { right: ed ? "click to roll" : "" })}
      ${box("Defence", def)}
      ${atk}
    </div>
    ${bagBox}
    <div class="wct-cs-pop" hidden></div>`;
}

// ---------------------------------------------------------------- Details page
/**
 * @typedef {{ key: string, label: string, abbr: string, mod: unknown, value: unknown, source?: unknown, save?: unknown, saveProf?: unknown, saveSource?: unknown }} AbilityFact
 * @typedef {{ key: string, label: string, ability: string, abbr: string, total: unknown, passive?: unknown, prof?: unknown, source?: unknown, baseAbility?: string }} SkillFact
 * @typedef {{ key: string, label: string, values: Array<{ label: string, tip?: string, value?: unknown }>, trait?: string, config?: string }} TraitFact
 * @typedef {object} DetailsFacts
 * @property {AbilityFact[]} abilities
 * @property {{ save: unknown } | null} [concentration] shown while concentrating or in edit mode (like dnd5e)
 * @property {SkillFact[]} skills
 * @property {SkillFact[]} tools
 * @property {TraitFact[]} traits
 * @property {{ title: string, subtitle?: string, config?: boolean }} [creature]
 * @property {{ key?: string, label: string, options?: Array<[string, string]> }} [size]
 * @property {Array<{ id: string, name: string, img?: string, kind: string }>} [origin] species and background items
 * @property {Array<[string, string]>} [abilityOptions] [key, abbreviation] for a skill's ability in edit mode
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 */

/** The Details page body. @param {DetailsFacts} f */
export function detailsPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const meds = (f.abilities ?? []).map(a => {
    const sp = profClass(a.saveProf);
    const save = `<span class="wct-cs-sv${sp ? " p" : ""}">save ${esc(sign(PM.saveValue(a.save)))}</span>`;
    const saveBtn = ed ? `<button type="button" class="wct-cs-svbtn" data-action="wctRoll" data-type="save" data-ability="${esc(a.key)}" data-tooltip="Roll a ${esc(a.label)} saving throw" aria-label="Roll a ${esc(a.label)} saving throw">${save}</button>` : save;
    const head = `<span class="wct-cs-lab">${esc(a.abbr)}</span><span class="v ${tone(a.mod)}">${esc(sign(a.mod))}</span>`;
    const main = ed && !edit
      ? `<button type="button" class="wct-cs-abtn" data-action="wctRoll" data-type="check" data-ability="${esc(a.key)}" data-tooltip="Roll a ${esc(a.label)} check" aria-label="Roll a ${esc(a.label)} check">${head}<span class="m">${a.value ?? "–"}</span></button>`
      : `<div class="wct-cs-abtn static">${head}${edit ? `<input type="text" class="wct-cs-ein" data-name="system.abilities.${esc(a.key)}.value" value="${esc(a.source ?? a.value ?? "")}" placeholder="10" inputmode="numeric" aria-label="${esc(a.label)} score">` : `<span class="m">${a.value ?? "–"}</span>`}</div>`;
    const tools = edit ? `<div class="wct-cs-medtools"><proficiency-cycle type="ability" data-wct-prof="system.abilities.${esc(a.key)}.proficient" value="${esc(num(a.saveSource) ?? 0)}" aria-label="${esc(a.label)} saving throw proficiency" data-tooltip="${esc(a.label)} saving throw proficiency"></proficiency-cycle>${cfgBtn(`Configure ${a.label}`, { config: "ability", ability: a.key })}</div>` : "";
    return `<div class="wct-cs-med ab" data-ability="${esc(a.key)}">${saveBtn}${main}${tools}</div>`;
  }).join("");
  const conc = f.concentration ? `<div class="wct-cs-conc" data-ability="concentration">${ed ? `<button type="button" class="wct-cs-chip" data-action="wctRoll" data-type="concentration" data-tooltip="Roll a concentration saving throw">${svg(PAGE_ICONS.conc)} Concentration ${esc(sign(f.concentration.save))}</button>` : `<span class="wct-cs-chip static">${svg(PAGE_ICONS.conc)} Concentration ${esc(sign(f.concentration.save))}</span>`}${edit ? cfgBtn("Configure concentration", { config: "ability", ability: "concentration" }) : ""}</div>` : "";

  const abilityOpts = f.abilityOptions ?? [];
  const row = (/** @type {SkillFact} */ s, type) => {
    const pc = profClass(edit ? s.source : s.prof);
    const mark = edit
      ? `<proficiency-cycle type="${type}" data-wct-prof="system.${type === "skill" ? "skills" : "tools"}.${esc(s.key)}.value" value="${esc(num(s.source) ?? 0)}" aria-label="${esc(PROF_LABELS[pc])}" data-tooltip="${esc(PROF_LABELS[pc])}"></proficiency-cycle>`
      : `<i class="wct-cs-pm ${pc}" data-tooltip="${esc(PROF_LABELS[pc])}" aria-label="${esc(PROF_LABELS[pc])}"></i>`;
    const abil = edit && abilityOpts.length
      ? `<select class="wct-cs-sel sm" data-name="system.${type === "skill" ? "skills" : "tools"}.${esc(s.key)}.ability" aria-label="${esc(s.label)} ability">${abilityOpts.map(([k, l]) => `<option value="${esc(k)}"${k === (s.baseAbility ?? s.ability) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`
      : `<span class="wct-cs-dim wct-cs-ab">${esc(s.abbr)}</span>`;
    const name = ed ? `<button type="button" class="wct-cs-roll" data-action="wctRoll" data-type="${type}" data-tooltip="Roll ${esc(s.label)}">${esc(s.label)}</button>` : `<span class="wct-cs-nm">${esc(s.label)}</span>`;
    const end = edit ? cfgBtn(`Configure ${s.label}`, { config: type }) : type === "skill" ? `<span class="wct-cs-dim wct-cs-num wct-cs-pass" data-tooltip="Passive">${esc(num(s.passive) ?? "")}</span>` : "";
    return `<li class="wct-cs-skill" data-key="${esc(s.key)}">${mark}${abil}${name}<b class="wct-cs-num ${tone(s.total)}">${esc(sign(s.total))}</b>${end}</li>`;
  };
  const skills = box("Skills", `<ul class="wct-cs-kv wct-cs-skills">${(f.skills ?? []).map(s => row(s, "skill")).join("")}</ul>`, { right: edit ? cfgBtn("Configure skills", { config: "skills" }) : "passive" });
  const tools = (f.tools ?? []).length || edit ? box("Tools", (f.tools ?? []).length ? `<ul class="wct-cs-kv wct-cs-skills">${(f.tools ?? []).map(s => row(s, "tool")).join("")}</ul>` : `<p class="wct-cs-dim wct-cs-boxnote">None</p>`, { right: edit ? cfgBtn("Configure tool proficiencies", { trait: "tool" }) : "" }) : "";

  const c = f.creature; const sz = f.size;
  const pills = [
    ...(f.origin ?? []).map(o => `<button type="button" class="wct-cs-pill" data-action="wctShowItem" data-item-id="${esc(o.id)}" data-tooltip="${esc(o.kind)}">${o.img ? `<img src="${esc(o.img)}" alt="">` : ""}${esc(o.name)}</button>`),
    c ? `<span class="wct-cs-pill">${esc(c.title)}${c.subtitle ? ` <small>(${esc(c.subtitle)})</small>` : ""}${edit && c.config ? cfgBtn("Configure creature type", { config: "creatureType" }) : ""}</span>` : "",
    sz ? edit && sz.options?.length ? `<label class="wct-cs-pill"><span class="wc-sr">Size</span><select class="wct-cs-sel sm" data-name="system.traits.size">${sz.options.map(([k, l]) => `<option value="${esc(k)}"${k === sz.key ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : `<span class="wct-cs-pill">${esc(sz.label)}</span>` : ""
  ].filter(Boolean).join("");
  const traitRows = (f.traits ?? []).filter(t => t.values.length || edit).map(t => `<li class="wct-cs-trait" data-trait-key="${esc(t.key)}"><span>${esc(t.label)}${edit && (t.trait || t.config) ? cfgBtn(`Configure ${t.label}`, t.trait ? { trait: t.trait } : { config: t.config }) : ""}</span><b>${t.values.length ? t.values.map(v => `<span class="wct-cs-tv"${attr("data-tooltip", v.tip)}>${esc(v.label)}${v.value !== undefined && v.value !== null && v.value !== "" ? ` ${esc(v.value)}` : ""}</span>`).join(", ") : `<span class="wct-cs-dim">None</span>`}</b></li>`).join("");
  return `<div class="wct-cs-meds">${meds}</div>${conc}
    <div class="wct-cs-cols">
      <div class="wct-cs-stack2">${skills}${tools}</div>
      <div class="wct-cs-stack2">
        ${pills ? box("Origin", `<div class="wct-cs-pills">${pills}</div>`) : ""}
        ${box("Traits", traitRows ? `<ul class="wct-cs-kv wct-cs-traits">${traitRows}</ul>` : `<p class="wct-cs-dim wct-cs-boxnote">None</p>`)}
      </div>
    </div>`;
}

// ---------------------------------------------------------------- Inventory page
/** dnd5e's inventory filter chips (ItemListControlsElement.CONFIG.inventory): activation types and two properties. */
export const INV_FILTERS = Object.freeze([
  { key: "action", label: "Action" }, { key: "bonus", label: "Bonus" }, { key: "reaction", label: "Reaction" },
  { key: "equipped", label: "Equipped" }, { key: "mgc", label: "Magical" }
]);
export const INV_SORTS = Object.freeze({ m: "Manual", a: "A–Z" });
const ACTIVATION_FILTERS = new Set(["action", "bonus", "reaction"]);

/**
 * @typedef {object} InvRow
 * @property {string} id
 * @property {string} [uuid]
 * @property {string} name
 * @property {string} [img]
 * @property {string} [quality]
 * @property {string} type item type (the section)
 * @property {string} [subtitle]
 * @property {string} [slot] where it sits on the paper doll ("Head", "Melee set")
 * @property {{ value: unknown, denom?: string, label?: string } | null} [price]
 * @property {unknown} [weight] total weight (dnd5e's system.totalWeight), already rounded
 * @property {unknown} [qty]
 * @property {{ value: unknown, max: unknown } | null} [uses]
 * @property {"cooldown" | "charged" | null} [recharge]
 * @property {boolean | null} [equip] null = can't be equipped
 * @property {boolean | null} [attune] null = no attunement
 * @property {string} [attuneTitle]
 * @property {boolean} [canDelete]
 * @property {boolean} [magical]
 * @property {boolean} [equipped]
 * @property {string[]} [activations] activation types of its activities
 * @property {number} [sort]
 * @property {boolean} [concealed] unidentified, seen by a player: price hidden (dnd5e)
 * @property {string | null} [expanded] the summary HTML when expanded (dnd5e's item-summary template)
 * @property {boolean} [canUse]
 */

/**
 * Whether a row passes the search text and the filter chips, by dnd5e's rules (_filterItems): any chosen activation type must be
 * among the item's activities' activation types; Equipped and Magical must hold. Search matches the name, case-insensitive.
 * @param {InvRow} r @param {{ search?: string, filters?: Iterable<string> }} o
 */
export function rowMatches(r, o = {}) {
  if (!nameMatches(r.name, o.search)) return false;
  return chipsMatch(r, o.filters);
}
/** The search half of rowMatches (also run live in the sheet as the user types). @param {unknown} name @param {unknown} search */
export const nameMatches = (name, search) => { const q = String(search ?? "").trim().toLowerCase(); return !q || String(name ?? "").toLowerCase().includes(q); };
/** The filter-chip half of rowMatches. @param {InvRow} r @param {Iterable<string> | undefined} filters */
export function chipsMatch(r, filters) {
  const f = new Set(filters ?? []);
  const acts = [...f].filter(k => ACTIVATION_FILTERS.has(k));
  if (acts.length && !(r.activations ?? []).some(a => acts.includes(a))) return false;
  if (f.has("equipped") && r.equipped !== true) return false;
  if (f.has("mgc") && !r.magical) return false;
  return true;
}

/** Rows in dnd5e's sort modes: "m" manual (the items' sort value, then name), "a" alphabetical. @param {InvRow[]} rows @param {string} mode */
export function sortRows(rows, mode = "m") {
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  return [...rows].sort(mode === "a" ? byName : (a, b) => ((num(a.sort) ?? 0) - (num(b.sort) ?? 0)) || byName(a, b));
}

/**
 * Rows grouped into dnd5e's inventory sections (each item type's `inventorySection`: Weapons, Equipment, Consumables, Tools, Loot…),
 * in their order; rows of a type without a section go to the last ("Other items", dnd5e's "contents"). Empty sections are dropped.
 * @param {InvRow[]} rows @param {Array<{ id: string, label: string, order?: number, types: string[] }>} sections
 */
export function groupRows(rows, sections) {
  const list = [...sections].sort((a, b) => (num(a.order) ?? 0) - (num(b.order) ?? 0)).map(s => ({ ...s, rows: /** @type {InvRow[]} */ ([]) }));
  const other = { id: "contents", label: "Other items", order: 1e9, types: [], rows: /** @type {InvRow[]} */ ([]) };
  for (const r of rows) (list.find(s => s.types.includes(r.type)) ?? other).rows.push(r);
  return [...list, other].filter(s => s.rows.length);
}

/** Price text: "50 gp" (dnd5e's denomination abbreviation passed in), "—" when concealed. @param {InvRow} r */
export function priceText(r) {
  if (r.concealed) return "—";
  const v = num(r.price?.value); if (!v) return "";
  return `${v.toLocaleString("en-US")}${r.price?.label ? ` ${r.price.label}` : ""}`;
}

/**
 * @typedef {object} InventoryFacts
 * @property {InvRow[]} rows top-level inventory items (not inside a container; containers are in `containers`)
 * @property {Array<{ id: string, label: string, order?: number, types: string[] }>} sections
 * @property {Array<{ id: string, name: string, img?: string, quality?: string, pct?: unknown, tip?: string, equipped?: boolean }>} [containers]
 * @property {Array<{ key: string, label: string, abbr: string, value: unknown }>} [currency]
 * @property {string | null} [money] the toolkit's coin formatting of the purse (three-coin economy on), or null
 * @property {{ value: unknown, max: unknown, pct: unknown, low?: unknown, high?: unknown, units?: string } | null} [encumbrance]
 * @property {{ str?: unknown, size?: string, mod?: unknown }} [carry]
 * @property {{ value?: unknown, max?: unknown } | null} [attuned]
 * @property {boolean} [editable]
 * @property {boolean} [edit]
 * @property {string} [search]
 * @property {string[]} [filters]
 * @property {string} [sort]
 */

/** One inventory row, in dnd5e's inventory markup (so its inventory element handles the controls). @param {InvRow} r @param {{ editable: boolean, edit: boolean, shown: boolean, chips?: boolean }} o */
export function invRowHTML(r, o) {
  const ic = (action, label, d, cls = "", extra = "") => `<button type="button" class="wct-cs-ic2 item-action${cls ? ` ${cls}` : ""}" data-action="${action}" aria-label="${esc(label)}" data-tooltip="${esc(label)}"${extra}>${svg(d)}</button>`;
  const qty = num(r.qty);
  const qtyCell = o.editable
    ? `<span class="wct-cs-qty"><a class="adjustment-button" data-action="decrease" data-property="system.quantity" aria-label="Fewer">${svg(PAGE_ICONS.minus)}</a><input type="text" value="${esc(qty ?? 0)}" placeholder="0" data-dtype="Number" data-name="system.quantity" inputmode="numeric" pattern="^[+=\\-]?\\d*" min="0" aria-label="Quantity"><a class="adjustment-button" data-action="increase" data-property="system.quantity" aria-label="More">${svg(PAGE_ICONS.plus)}</a></span>`
    : `<span class="wct-cs-num">${esc(qty ?? "")}</span>`;
  let uses = "";
  if (r.recharge === "cooldown") uses = o.editable ? ic("recharge", "Roll recharge", PAGE_ICONS.recharge) : svg(PAGE_ICONS.recharge);
  else if (r.recharge === "charged") uses = `<span data-tooltip="Charged">${svg(PAGE_ICONS.bolt)}</span>`;
  else if (r.uses && num(r.uses.max)) uses = o.editable
    ? `<span class="wct-cs-uses"><input type="text" value="${esc(num(r.uses.value) ?? 0)}" placeholder="0" data-dtype="Number" data-name="system.uses.value" inputmode="numeric" pattern="[+=\\-]?\\d*" aria-label="Uses left"><span>/ ${esc(num(r.uses.max))}</span></span>`
    : `<span class="wct-cs-num">${esc(num(r.uses.value) ?? 0)} / ${esc(num(r.uses.max))}</span>`;
  const ctl = [
    o.editable && r.equip !== null && r.equip !== undefined ? ic("equip", r.equip ? "Equipped (click to unequip)" : "Not equipped (click to equip into its slot)", PAGE_ICONS.equip, r.equip ? "on active" : "", ` aria-pressed="${!!r.equip}"`) : "",
    o.editable && r.attune !== null && r.attune !== undefined ? ic("attune", r.attune ? "Attuned" : r.attuneTitle || "Not attuned", PAGE_ICONS.attune, r.attune ? "on active" : "", ` aria-pressed="${!!r.attune}"`) : "",
    o.edit ? ic("edit", "Edit item", PAGE_ICONS.edit) : "",
    o.edit && r.canDelete ? ic("delete", "Delete item", PAGE_ICONS.trash, "del") : "",
    `<button type="button" class="wct-cs-ic2 item-action always-interactive" data-action="toggleExpand" data-toggle-description aria-label="Show or hide the description" data-tooltip="Show or hide the description"><i class="fa-solid fa-${r.expanded ? "compress" : "expand"}" inert></i></button>`,
    `<button type="button" class="wct-cs-ic2 always-interactive" data-context-menu aria-label="More actions" data-tooltip="More actions">${svg(PAGE_ICONS.more)}</button>`
  ].join("");
  const click = r.canUse ? "use" : "view";
  return `<li class="item collapsible wct-cs-irow-wrap${r.expanded ? "" : " collapsed"}" data-wct-chips="${o.chips === false ? 0 : 1}" data-uuid="${esc(r.uuid ?? "")}" data-item-id="${esc(r.id)}" data-entry-id="${esc(r.id)}" data-item-name="${esc(r.name)}"${o.shown ? "" : " hidden"}>
    <div class="item-row wct-cs-irow draggable">
      <span class="wct-cs-ico wct-item wc-item-slot" data-quality="${esc(r.quality || "common")}"><img src="${esc(r.img)}" alt=""></span>
      <span class="wct-cs-nm item-name item-action" role="button" tabindex="0" data-action="${click}" aria-label="${esc(r.name)}${click === "use" ? ": use" : ""}"><b class="wc-q-text" data-quality="${esc(r.quality || "common")}">${esc(r.name)}</b>${r.subtitle ? `<small>${esc(r.subtitle)}</small>` : ""}</span>
      <span class="c">${esc(r.slot ?? "")}</span><span class="c">${esc(priceText(r))}</span><span class="c">${num(r.weight) ? esc(num(r.weight)) : ""}</span><span class="c q">${qtyCell}</span><span class="c">${uses}</span>
      <span class="ctl">${ctl}</span>
    </div>
    <div class="item-description collapsible-content"><div class="wrapper">${r.expanded ?? ""}</div></div>
  </li>`;
}

/** The Inventory page body. @param {InventoryFacts} f */
export function inventoryPageHTML(f) {
  const ed = !!f.editable; const edit = !!f.edit && ed;
  const filters = new Set(f.filters ?? []); const sort = f.sort === "a" ? "a" : "m";
  const e = f.encumbrance;
  const pct = Math.max(0, Math.min(100, num(e?.pct) ?? 0));
  const enc = e ? box("Encumbrance", `<div class="wct-cs-boxpad"><div class="wct-cs-rbar" role="meter" aria-label="Carried weight" aria-valuemin="0" aria-valuemax="${esc(num(e.max) ?? 0)}" aria-valuenow="${esc(num(e.value) ?? 0)}"><i class="enc${pct >= (num(e.high) ?? 101) ? " heavy" : pct >= (num(e.low) ?? 101) ? " burd" : ""}" style="width:${pct}%"></i>${num(e.low) ? `<b class="tick" style="left:${num(e.low)}%"></b>` : ""}${num(e.high) ? `<b class="tick" style="left:${num(e.high)}%"></b>` : ""}<span>${esc(num(e.value) ?? 0)} / ${Number.isFinite(Number(e.max)) ? esc(num(e.max)) : "∞"}${e.units ? ` ${esc(e.units)}` : ""}</span></div></div>`,
    { right: f.carry ? `Str ${esc(num(f.carry.str) ?? "–")} · ${esc(f.carry.size ?? "")} ×${esc(num(f.carry.mod) ?? 1)}` : "", cls: "wct-cs-enc" }) : "";
  const coins = (f.currency ?? []).map(c => `<label class="wct-cs-coin" data-coin="${esc(c.key)}"><i class="wct-cs-cdot ${esc(c.key)}" aria-hidden="true"></i><span class="wc-sr">${esc(c.label)}</span>${ed ? `<input type="text" class="wct-cs-ein" data-name="system.currency.${esc(c.key)}" value="${esc(num(c.value) ?? 0)}" inputmode="numeric" pattern="^[+=\\-]?\\d*" aria-label="${esc(c.label)}">` : `<b>${esc(num(c.value) ?? 0)}</b>`}<small>${esc(c.abbr)}</small></label>`).join("");
  const coin = box("Coin", `<div class="wct-cs-coins">${coins}</div>${f.money ? `<div class="wct-cs-money">${f.money}</div>` : ""}`,
    { right: ed ? `<button type="button" class="wct-cs-chip" data-action="wctCurrency">${svg(PAGE_ICONS.coins)} Manage coin</button>` : "", cls: "wct-cs-coinbox" });
  const att = attunedText(f.attuned);
  const conts = (f.containers ?? []).length ? box("Containers", `<ul class="wct-cs-conts">${(f.containers ?? []).map(c => `<li class="container wct-cs-cont draggable" data-item-id="${esc(c.id)}"><button type="button" class="wct-cs-ico wct-item wc-item-slot" data-quality="${esc(c.quality || "common")}" data-action="wctShowItem" aria-label="${esc(c.name)}" data-tooltip="${esc(c.tip || c.name)}"><img src="${esc(c.img)}" alt="">${num(c.pct) !== null ? `<i class="cap" style="width:${Math.max(0, Math.min(100, num(c.pct) ?? 0))}%"></i>` : ""}${c.equipped ? `<i class="eq" aria-label="Equipped"></i>` : ""}</button></li>`).join("")}</ul>`, { right: ed ? "drop items on one" : "", cls: "wct-cs-contbox" }) : "";
  const rows = sortRows(f.rows ?? [], sort);
  const sections = groupRows(rows, f.sections ?? []);
  const shown = r => rowMatches(r, { search: f.search, filters });
  const any = rows.some(shown);
  const head = `<span class="cols"><span>Slot</span><span>Price</span><span>Weight</span><span>Qty</span><span>Uses</span><span class="w"></span></span>`;
  const list = sections.map(s => `<div class="items-section wct-cs-sec" data-section="${esc(s.id)}"${s.rows.some(shown) ? "" : " hidden"}><div class="wct-cs-sect">${esc(s.label)}${head}</div><ol class="item-list wct-cs-list">${s.rows.map(r => invRowHTML(r, { editable: ed, edit, shown: shown(r), chips: chipsMatch(r, filters) })).join("")}</ol></div>`).join("");
  const chips = INV_FILTERS.map(c => `<button type="button" class="wct-cs-chip${filters.has(c.key) ? " on" : ""}" data-wct-filter="${c.key}" aria-pressed="${filters.has(c.key)}">${esc(c.label)}</button>`).join("");
  const tbar = `<div class="wct-cs-tbar"><label class="wct-cs-srch">${svg(PAGE_ICONS.search)}<span class="wc-sr">Search inventory</span><input type="search" data-wct-search value="${esc(f.search ?? "")}" placeholder="Search inventory"></label>${chips}<button type="button" class="wct-cs-chip" data-wct-sort="${sort === "a" ? "m" : "a"}" data-tooltip="Sort order">Sort: ${esc(INV_SORTS[sort])}</button>${edit ? `<button type="button" class="wct-cs-gbtn sm" data-action="wctCreateItem">+ Create item</button>` : ""}</div>`;
  return `<div class="wct-cs-invtop">${enc}${coin}${conts}</div>
    ${att ? `<p class="wct-cs-dim wct-cs-attline">Attuned <b class="${att.over ? "neg" : ""}">${esc(att.text)}</b></p>` : ""}
    <dnd5e-inventory class="inventory-element wct-cs-inv"><section class="wct-cs-box items-list inventory-list" data-item-list="inventory">${tbar}${list || `<p class="wct-cs-dim wct-cs-boxnote">No items.${ed ? " Drop items here from a compendium or the sidebar." : ""}</p>`}<p class="wct-cs-dim wct-cs-boxnote wct-cs-nomatch"${list && !any ? "" : " hidden"}>No items match.</p></section></dnd5e-inventory>`;
}
