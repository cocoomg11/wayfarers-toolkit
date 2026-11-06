/**
 * Character sheet replacement (feature `characterSheet`, off by default), slice 1: the sheet's shell, registered as an ActorSheet
 * for dnd5e `character` actors. Title band, vitals strip, page bookmarks (pages are placeholders for now) and the conditions bar.
 *
 * Rules stay dnd5e's: every number is read from the actor's prepared dnd5e data, and every button calls dnd5e's own methods
 * (shortRest / longRest, rollInitiativeDialog, rollDeathSave) or writes the same field dnd5e's sheet writes (inspiration,
 * exhaustion). The pure half (view model, HTML, key rules) is sheet-model.mjs.
 *
 * Registration: `DocumentSheetConfig.registerSheet(Actor, ID, WctCharacterSheet, { types: ["character"], makeDefault: true })` in
 * `init`, only while the feature is on. `makeDefault` sets the default in CONFIG for this load only (nothing is stored), so
 * turning the feature off (it reloads) unregisters the class and dnd5e's sheet is the default again; actors whose owners picked
 * this sheet by hand fall back to the default. A GM's own choice under Configure Default Sheets still wins over makeDefault.
 */
import * as SM from "./sheet-model.mjs";
import * as SP from "./sheet-pages-model.mjs";
import * as PM from "./pane-model.mjs";
import * as Pane from "./pane.mjs";
import * as WS from "./weapon-sets.mjs";
import { restedTip } from "./pane-model.mjs";
import { BENEFITS } from "./inn-model.mjs";
import { on as featureOn } from "./features.mjs";
import { UI_CLASSES, defineOpenKeybinding, keybindingConfig, esc } from "../vendor/wanderers-core/index.mjs";
const ID = "wayfarers-toolkit";

/** dnd5e's character sheet class, as registered by the system (the GM's fallback). */
function systemSheetClass() {
  const reg = CONFIG.Actor?.sheetClasses?.character ?? {};
  return reg["dnd5e.CharacterActorSheet"]?.cls ?? /** @type {any} */ (globalThis).dnd5e?.applications?.actor?.CharacterActorSheet ?? null;
}

/** An open (or cached) sheet of class `cls` for `actor`, without creating a second one with the same id. */
function existing(cls, actor) {
  if (actor.sheet instanceof cls) return actor.sheet;
  for (const app of foundry.applications.instances?.values?.() ?? []) if (app instanceof cls && app.document === actor) return app;
  return null;
}

/** dnd5e tab ids for our page ids (no dnd5e tab for "character"). */
const SYSTEM_TAB = { details: "details", inventory: "inventory", features: "features", spells: "spells", effects: "effects", biography: "biography", bastion: "bastion", special: "specialTraits" };

/** Opens dnd5e's own sheet for an actor (GM fallback), on the matching tab when there is one. */
export async function openSystemSheet(actor, page = "") {
  const Cls = systemSheetClass();
  if (!Cls) return ui.notifications.warn("The system's character sheet isn't available.");
  const app = existing(Cls, actor) ?? new Cls({ document: actor });
  await app.render({ force: true });
  const tab = SYSTEM_TAB[page];
  if (tab) { try { app.changeTab?.(tab, "primary"); } catch { /* the tab may be hidden for this actor */ } }
  return app;
}

// Foundry's base (a stand-in only when imported in Node tests, through health.mjs).
const ActorSheetV2 = /** @type {any} */ (globalThis).foundry?.applications?.sheets?.ActorSheetV2 ?? class {};
export class WctCharacterSheet extends ActorSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["wct-sheet", "wct-window", ...UI_CLASSES],
    position: { width: 820, height: 760 },
    window: { resizable: true },
    // Fields write the actor themselves (sheet.mjs listeners) or through dnd5e's inventory element; the form never submits on change.
    form: { submitOnChange: false },
    actions: {
      wctSystemSheet: WctCharacterSheet.#systemSheet,
      wctMode: WctCharacterSheet.#mode,
      wctPage: WctCharacterSheet.#page,
      wctInspiration: WctCharacterSheet.#inspiration,
      wctShortRest: WctCharacterSheet.#shortRest,
      wctLongRest: WctCharacterSheet.#longRest,
      wctInitiative: WctCharacterSheet.#initiative,
      wctDeathSave: WctCharacterSheet.#deathSave,
      wctExhaustion: WctCharacterSheet.#exhaustion,
      // slice 2: pages
      wctRoll: WctCharacterSheet.#roll,
      wctConfig: WctCharacterSheet.#config,
      wctUse: WctCharacterSheet.#use,
      wctShowItem: WctCharacterSheet.#showItem,
      wctArtwork: WctCharacterSheet.#artwork,
      wctPortrait: WctCharacterSheet.#portrait,
      wctSlotEquipped: WctCharacterSheet.#slotEquipped,
      wctCurrency: WctCharacterSheet.#currency,
      wctCreateItem: WctCharacterSheet.#createItem
    }
  };

  /** "play" | "edit", per window (not saved). */
  _mode = "play";
  /** The bookmark shown, per window (not saved). */
  _page = "character";
  /** Character page: the Attack box's mode override (per window, like the pane's). */
  _attackMode = /** @type {string | null} */ (null);
  /** Character page: the last weapon-set swap that was blocked (its note stays until it can go). */
  _blocked = /** @type {{ set: string } | null} */ (null);
  _ensuring = false;
  /** Inventory page: search text, filter chips and sort mode (per window, not saved). */
  _inv = { search: "", filters: /** @type {string[]} */ ([]), sort: "m" };

  /** dnd5e's own expand state for inventory rows (dnd5e's inventory element reads app.expandedSections). */
  get expandedSections() { return (this._expanded ??= new Map()); }
  /** dnd5e's inventory element asks the app for its item source and whether a row can expand. */
  get inventorySource() { return this.actor; }
  canExpand(item) { return !["class", "subclass"].includes(item?.type); }
  /** dnd5e's inventory element opens item sheets through the app. */
  _openDocumentSheet(doc, options = {}) { if (doc?.sheet) doc.sheet.render({ force: true, ...options }); }

  /**
   * An unrendered dnd5e character sheet for this actor, used only for dnd5e's own drop handling (_onDropItem / _onDropCreateItems /
   * _onDropItemContainer / _onSortItem / _onDropActiveEffect / _onDropActor), so items dropped here are created, stacked, sorted,
   * put in containers and advanced exactly as on dnd5e's sheet. Never rendered. Null when dnd5e's sheet class isn't found.
   */
  dnd5eHost() {
    if (this._host !== undefined) return this._host;
    const Cls = systemSheetClass();
    try { this._host = Cls ? new Cls({ document: this.actor }) : null; } catch (e) { console.warn(`${ID} | character sheet: dnd5e drop host`, e); this._host = null; }
    return this._host;
  }

  /** GM header control as well as the visible button (the controls menu is where Foundry users look for it too). */
  _getHeaderControls() {
    const controls = super._getHeaderControls?.() ?? [];
    if (game.user.isGM) controls.unshift({ icon: "fa-solid fa-book", label: "Open the system sheet", action: "wctSystemSheet", visible: true });
    return controls;
  }

  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    if (game.user.isGM) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "header-control wct-cs-sysbtn"; btn.dataset.action = "wctSystemSheet";
      btn.dataset.tooltip = "GM only: open this actor in the system's own sheet";
      btn.innerHTML = `<i class="fa-solid fa-book" inert></i> System sheet`;
      const anchor = frame.querySelector(".window-header [data-action=toggleControls]") ?? frame.querySelector(".window-header [data-action=close]");
      anchor ? anchor.before(btn) : frame.querySelector(".window-header")?.append(btn);
    }
    return frame;
  }

  /** Plain facts from the actor's prepared dnd5e data (sheet-model.mjs builds the view from them). */
  facts() {
    const a = this.actor; const sys = a.system ?? {}; const at = sys.attributes ?? {};
    const tryGet = (ns, k, d) => { try { return game.settings.get(ns, k); } catch { return d; } };
    const loc = t => (t ? game.i18n?.localize?.(t) ?? t : "");
    const race = sys.details?.race; const bg = sys.details?.background;
    const hd = at.hd;
    /** @type {string | null} */
    let rested = null;
    if (featureOn("restedInn")) {
      const r = a.getFlag?.(ID, "rested");
      if (r) rested = restedTip({ inn: r.inn, benefit: BENEFITS[tryGet(ID, "innBenefit", "")] ?? "" });
    }
    let bastion = false;
    try { bastion = !!(/** @type {any} */ (globalThis).dnd5e?.settings?.bastionConfiguration ?? tryGet("dnd5e", "bastionConfiguration", null))?.availableForActor?.(a); } catch { bastion = false; }
    // dnd5e's own preparation warnings (what its header warning button lists). Null when this dnd5e doesn't expose them.
    const pw = /** @type {any} */ (a)._preparationWarnings;
    const warnings = Array.isArray(pw) ? pw.map(w => String(w?.message ?? w ?? "")).filter(Boolean) : null;
    const statusName = id => { const s = (CONFIG.statusEffects ?? []).find(x => x.id === id); return loc(s?.name ?? s?.label) || id; };
    const leveling = tryGet("dnd5e", "levelingMode", null);
    return {
      name: a.name, level: sys.details?.level ?? null,
      classes: Object.values(a.classes ?? {}).map(c => ({ name: c.name, levels: c.system?.levels })),
      species: race?.name ?? (typeof race === "string" ? race : ""), background: bg?.name ?? (typeof bg === "string" ? bg : ""),
      showXp: leveling === null ? !tryGet("dnd5e", "disableExperienceTracking", false) : leveling !== "noxp",
      xp: sys.details?.xp, rested, inspiration: !!at.inspiration,
      hp: at.hp, hd: hd ? { value: hd.value, max: hd.max, denom: hd.largestFace ? `d${hd.largestFace}` : hd.denomination ? `d${hd.denomination}` : "" } : undefined,
      ac: at.ac?.value, init: at.init?.total ?? at.init?.mod,
      speed: { walk: at.movement?.speeds?.walk ?? at.movement?.speed ?? at.movement?.walk, units: at.movement?.units },
      prof: at.prof,
      exhaustion: { value: at.exhaustion, max: CONFIG.DND5E?.conditionTypes?.exhaustion?.levels ?? 6 },
      death: at.death, warnings,
      conditions: [...(a.statuses ?? [])].map(id => ({ id, name: statusName(id) })),
      bastion, editable: this.isEditable, isGM: game.user.isGM,
      showRests: game.user.isGM || tryGet("dnd5e", "allowRests", true) !== false,
      limited: !game.user.isGM && a.limited
    };
  }


  // ---------------------------------------------------------------- slice 2: page facts (prepared dnd5e data + the pane's slots)
  /** Localises a dnd5e label key. */
  static loc(t) { return t ? game.i18n?.localize?.(t) ?? t : ""; }

  /** The Character page's facts: the pane's slots and weapon sets (pane.mjs, same flags), the stat boxes and the item strip. */
  async characterFacts() {
    const a = this.actor; const sys = a.system ?? {}; const loc = WctCharacterSheet.loc;
    const sets = Pane.setsOn(); const cur = sets ? Pane.gearSlotted(a) : Pane.slotted(a);
    const relicOn = Pane.relicShown(a);
    if (relicOn) { const r = Pane.slotted(a).relic; if (r) cur.relic = r; }
    const it = i => (i ? { id: i.id, name: i.name, img: i.img, quality: Pane.qualityOf(i) } : null);
    const slot = k => {
      const item = cur[k]; const ghost = !item && k === "offhand" && cur.mainhand && Pane.isTwo(cur.mainhand) ? cur.mainhand : null;
      return { slot: k, label: Pane.SLOTS[k].label, item: it(item), ghost: it(ghost) };
    };
    /** @type {any[] | null} */
    let setFacts = null; /** @type {any[]} */ const notes = [];
    if (sets) {
      const state = Pane.weaponState(a); const items = Pane.describedSetItems(a, state);
      const ctx = { items, equippedShields: Pane.equippedShields(a), hasAmmo: Pane.hasAmmo(a) };
      setFacts = WS.SET_IDS.map(id => {
        const plan = WS.planSwap(state, id, ctx);
        const hands = ["main", "off"].map(hand => {
          const item = a.items.get(state.sets[id][hand]) ?? null; const main = hand === "off" ? a.items.get(state.sets[id].main) : null;
          return { set: id, hand, label: WS.handLabel(id, hand), glyph: hand === "off" ? "offhand" : id === "ranged" ? "ranged" : "mainhand",
            item: it(item), ghost: !item && main && Pane.isTwo(main) ? it(main) : null, worn: !!item && id !== state.active && Pane.isShield(item) && !!item.system.equipped };
        });
        return { id, label: WS.SETS[id].label, active: id === state.active, lock: plan.ok ? null : plan.block.message, hands };
      });
      // Notes, as on the pane: why the last swap was blocked (with Stow shield), then the active set's warnings and info.
      const blocked = this._blocked && this._blocked.set !== state.active ? WS.planSwap(state, this._blocked.set, ctx) : null;
      if (blocked && !blocked.ok && this._blocked) notes.push({ tone: "bad", text: `${WS.SETS[this._blocked.set].label}: ${blocked.block.message}`, stowShield: blocked.block.code === "shield" ? blocked.block.shieldId : "" });
      else this._blocked = null;
      const active = WS.planSwap(state, state.active, ctx);
      if (!active.ok) notes.push({ tone: "bad", text: `${active.block.message} The ${WS.SETS[state.active].label} set isn't equipped.`, stowShield: active.block.code === "shield" ? active.block.shieldId : "" });
      for (const w of active.warnings) notes.push({ tone: "warn", text: w });
      for (const t of active.info) notes.push({ tone: "", text: t });
    }
    const cfg = /** @type {Array<[string, any]>} */ (Object.entries(CONFIG.DND5E?.abilities ?? {}));
    const src = sys._source?.abilities ?? {};
    const attributes = PM.attributes(cfg.map(([k, c]) => [k, { label: loc(c.label), abbreviation: loc(c.abbreviation ?? k) }]), sys.abilities ?? {})
      .map(x => ({ ...x, source: src[x.key]?.value }));
    const at = sys.attributes ?? {}; const hd = at.hd;
    const defence = PM.defence({
      ac: at.ac?.value, hp: at.hp ?? {}, hd: hd ? { value: hd.value, max: hd.max, denom: hd.largestFace ? `d${hd.largestFace}` : hd.denomination ? `d${hd.denomination}` : "" } : null,
      init: at.init?.total ?? at.init?.mod, speed: { walk: at.movement?.speeds?.walk ?? at.movement?.speed ?? at.movement?.walk, units: at.movement?.units },
      saves: attributes.map(x => ({ abbr: x.abbr, value: sys.abilities?.[x.key]?.save, prof: (sys.abilities?.[x.key]?.proficient ?? 0) > 0 }))
    });
    // The Attack box follows the set in hand (pane.mjs attackFacts, pane-model.mjs attackMode / attackRows), with the same dropdown.
    /** @type {any} */
    let attack = null;
    try {
      const af = Pane.attackFacts(a);
      const auto = PM.attackMode({ ...af, override: "" }); const mode = PM.attackMode({ ...af, override: this._attackMode ?? "" });
      const weapon = mode === "spell" ? null : af.weapon(mode);
      const r = PM.attackRows(mode, { weapon, spell: af.spell });
      attack = { title: mode === "spell" ? "Spell" : mode === "ranged" ? "Ranged" : "Melee", ...r, options: PM.attackOptions(this._attackMode ?? "auto", auto), use: weapon?.id ?? null };
    } catch (e) { console.warn(`${ID} | character sheet attack box`, e); }
    const bag = Pane.unslottedItems(a, cur);
    let portrait = { src: a.img, isToken: false, isVideo: false, isRandom: false };
    try { portrait = { ...portrait, ...(await a.getPreferredArtwork?.()) }; } catch { /* dnd5e older than its preferred artwork */ }
    this._portrait = portrait;
    return {
      left: Pane.LEFT.map(slot), right: Pane.RIGHT.map(slot), bottom: sets ? null : Pane.BOTTOM.map(slot), sets: setFacts,
      relic: sets && relicOn ? slot("relic") : null, notes, portrait, name: a.name, attuned: at.attunement ?? null,
      attributes, defence, attack, bag: bag.map(i => ({ ...it(i), equipped: !!i.system.equipped })), loose: bag.filter(i => i.system.equipped).length,
      editable: this.isEditable, edit: this._mode === "edit"
    };
  }

  /** The Details page's facts, the way dnd5e's character sheet prepares its Details tab (prepared data only). */
  detailsFacts() {
    const a = this.actor; const sys = a.system ?? {}; const loc = WctCharacterSheet.loc; const D = CONFIG.DND5E ?? {};
    const src = sys._source ?? {}; const edit = this._mode === "edit" && this.isEditable;
    const dnd5e = /** @type {any} */ (globalThis).dnd5e; const Trait = dnd5e?.documents?.Trait;
    const keyLabel = (key, trait) => { try { return Trait?.keyLabel?.(key, { trait }) ?? key; } catch { return key; } };
    const abbrOf = k => loc(D.abilities?.[k]?.abbreviation ?? k);
    const abilities = Object.entries(sys.abilities ?? {}).map(([k, ab]) => ({
      key: k, label: loc(D.abilities?.[k]?.label ?? k), abbr: abbrOf(k).toUpperCase(), mod: ab.mod, value: ab.value, source: src.abilities?.[k]?.value,
      save: ab.save, saveProf: ab.proficient, saveSource: src.abilities?.[k]?.proficient
    }));
    const concentrating = a.statuses?.has?.(CONFIG.specialStatusEffects?.CONCENTRATING ?? "concentrating");
    const concentration = concentrating || edit ? { save: sys.attributes?.concentration?.save } : null;
    const skillsTools = prop => Object.entries(sys[prop] ?? {})
      .filter(([key]) => key in (D[prop] ?? {}) || (prop === "tools" && key in (D.vehicleTypes ?? {})))
      .map(([key, e]) => ({
        key, label: prop === "skills" ? loc(D.skills?.[key]?.label ?? key) : keyLabel(key, "tool"), ability: e.ability, abbr: abbrOf(e.ability),
        total: e.total, passive: e.passive, prof: e.prof?.multiplier ?? e.value, source: src[prop]?.[key]?.value ?? 0,
        baseAbility: src[prop]?.[key]?.ability || (prop === "skills" ? D.skills?.[key]?.ability : "") || "int"
      })).sort((x, y) => x.label.localeCompare(y.label, game.i18n?.lang));
    // Traits, in dnd5e's order and with its labels (senses; resistances, immunities, condition immunities, vulnerabilities; damage
    // modification; armour, weapons, languages). Play mode folds condition immunities into immunities, as dnd5e does.
    const values = trait => {
      const T = D.traits?.[trait]; const key = T?.actorKeyPath ?? `system.traits.${trait}`;
      const data = foundry.utils.getProperty(a, key); if (!data) return [];
      let v = data.value; v = !v ? [] : v instanceof Set ? [...v] : Array.isArray(v) ? v : [v];
      const out = v.map(k => {
        const bypass = data.bypasses?.size && D.damageTypes?.[k]?.isPhysical ? [...data.bypasses].map(p => loc(D.itemProperties?.[p]?.label ?? p)).join(", ") : "";
        return { label: keyLabel(k, trait), tip: bypass ? `Bypassed by ${bypass}` : undefined };
      });
      for (const c of String(data.custom ?? "").split(";").map(x => x.trim()).filter(Boolean)) out.push({ label: c });
      return out;
    };
    const senses = [];
    const units = sys.attributes?.senses?.units ? loc(D.movementUnits?.[sys.attributes.senses.units]?.abbreviation ?? sys.attributes.senses.units) : "";
    for (const [k, c] of Object.entries(D.senses ?? {})) { const r = sys.attributes?.senses?.ranges?.[k]; if (r) senses.push({ label: loc(c?.label ?? c), value: `${r}${units ? ` ${units}` : ""}` }); }
    for (const s of String(sys.attributes?.senses?.special ?? "").split(";").map(x => x.trim()).filter(Boolean)) senses.push({ label: s });
    const dr = a.hasConditionEffect?.("petrification") ? [{ label: loc("DND5E.DAMAGE.All") }] : values("dr");
    const di = values("di"); const ci = values("ci");
    const dm = [];
    try {
      const amount = sys.traits?.dm?.amount ?? {}; const rollData = a.getRollData?.({ deterministic: true }) ?? {};
      for (const [k, v] of Object.entries(amount)) {
        const total = dnd5e?.utils?.simplifyBonus ? dnd5e.utils.simplifyBonus(v, rollData) : Number(v) || 0;
        if (total) dm.push({ label: `${loc(D.damageTypes?.[k]?.label ?? k)} ${total > 0 ? "+" : "−"}${Math.abs(total)}` });
      }
    } catch { /* no damage modification */ }
    /** @type {Array<{ label: string, value?: unknown, tip?: string }>} */
    const langs = [...(sys.traits?.languages?.labels?.languages ?? [])].map(l => ({ label: String(l) }));
    for (const [k, c] of Object.entries(D.communicationTypes ?? {})) { const d = sys.traits?.languages?.communication?.[k]; if (d?.value) langs.push({ label: loc(c?.label), value: d.value }); }
    const weapons = values("weapon");
    for (const k of sys.traits?.weaponProf?.mastery?.value ?? []) { const l = keyLabel(k, "weapon"); const w = weapons.find(x => x.label === l); if (w) w.tip = "Mastery"; else weapons.push({ label: l, tip: "Mastery" }); }
    const traits = [
      { key: "senses", label: loc("DND5E.Senses"), values: senses, config: "senses" },
      { key: "dr", label: loc("DND5E.Resistances"), values: dr, trait: "dr" },
      { key: "di", label: edit ? loc("DND5E.TRAIT.Damage.Immunity.title") : loc("DND5E.Immunities"), values: edit ? di : [...di, ...ci], trait: "di" },
      ...(edit ? [{ key: "ci", label: loc("DND5E.TRAIT.Condition.Immunity.title"), values: ci, trait: "ci" }] : []),
      { key: "dv", label: loc("DND5E.Vulnerabilities"), values: values("dv"), trait: "dv" },
      { key: "dm", label: loc("DND5E.DamageModification.Label"), values: dm, trait: "dm" },
      { key: "armor", label: loc("DND5E.Armor"), values: values("armor"), trait: "armor" },
      { key: "weapon", label: loc("TYPES.Item.weaponPl"), values: weapons, trait: "weapon" },
      { key: "languages", label: loc("DND5E.Languages"), values: langs, trait: "languages" }
    ];
    const details = sys.details ?? {}; const type = details.type ?? {};
    const species = details.race && typeof details.race === "object" ? details.race : null;
    const background = details.background && typeof details.background === "object" ? details.background : null;
    const sizeKey = sys.traits?.size;
    return {
      abilities, concentration, skills: skillsTools("skills"), tools: skillsTools("tools"), traits,
      creature: type.value ? { title: type.value === "custom" ? String(type.custom ?? "") : loc(D.creatureTypes?.[type.value]?.label ?? type.value), subtitle: type.subtype ?? "", config: !!species } : undefined,
      size: sizeKey ? { key: sizeKey, label: loc(D.actorSizes?.[sizeKey]?.label ?? sizeKey), options: species ? Object.entries(D.actorSizes ?? {}).map(([k, c]) => [k, loc(c?.label ?? k)]) : [] } : undefined,
      origin: [species && { id: species.id, name: species.name, img: species.img, kind: "Species" }, background && { id: background.id, name: background.name, img: background.img, kind: "Background" }].filter(Boolean),
      abilityOptions: Object.entries(D.abilities ?? {}).map(([k, c]) => [k, loc(c?.abbreviation ?? k)]),
      editable: this.isEditable, edit: this._mode === "edit"
    };
  }

  /** The Inventory page's facts: dnd5e's inventory sections, rows, containers, currency and encumbrance (prepared data only). */
  async inventoryFacts() {
    const a = this.actor; const sys = a.system ?? {}; const loc = WctCharacterSheet.loc; const D = CONFIG.DND5E ?? {};
    const models = Object.entries(CONFIG.Item?.dataModels ?? {}).filter(([, m]) => m && "inventorySection" in m);
    const sections = models.filter(([t]) => t !== "container").map(([t, m]) => { const s = m.inventorySection; return { id: s.id, label: loc(s.label), order: s.order, types: [s.groups?.type ?? t] }; });
    const invTypes = new Set(models.map(([t]) => t));
    const visible = i => { const o = i.dependentOrigin; if (a.hiddenItems?.has?.(i.id)) return false; return !(o?.active === false && o.parent !== i); };
    const top = i => !a.items.has(i.system?.container);
    const sets = Pane.setsOn(); const state = sets ? Pane.weaponState(a) : null; const slots = Pane.slotted(a);
    const where = i => {
      const s = Object.entries(slots).find(([, x]) => x === i)?.[0];
      if (s && !(sets && ["mainhand", "offhand", "ranged"].includes(s))) return Pane.SLOTS[s]?.label ?? "";
      const at = state ? WS.locate(state, i.id) : null;
      return at ? `${WS.SETS[at.set].label} set` : s ? Pane.SLOTS[s]?.label ?? "" : "";
    };
    const summary = async item => {
      if (!this.expandedSections.get(`items.${item.id}`)) return null;
      try {
        const ctx = await item.getChatData({ secrets: item.isOwner });
        return await foundry.applications.handlebars.renderTemplate("systems/dnd5e/templates/items/parts/item-summary.hbs", ctx);
      } catch { return null; }
    };
    const rows = [];
    for (const i of a.items) {
      if (!invTypes.has(i.type) || i.type === "container" || !top(i) || !visible(i)) continue;
      const s = i.system ?? {}; const concealed = !game.user.isGM && s.identified === false;
      const props = s.properties instanceof Set ? s.properties : new Set(s.properties ?? []);
      rows.push({
        id: i.id, uuid: i.uuid, name: i.name, img: i.img, quality: Pane.qualityOf(i), type: i.type,
        subtitle: [s.type?.label, i.isActive ? i.labels?.activation : null].filter(Boolean).join(" • "), slot: where(i),
        price: s.price?.value ? { value: s.price.value, label: loc(D.currencies?.[s.price.denomination]?.abbreviation ?? s.price.denomination ?? "") } : null,
        weight: Number.isFinite(Number(s.totalWeight)) ? Math.round(Number(s.totalWeight) * 10) / 10 : null, qty: s.quantity,
        uses: i.hasLimitedUses ? { value: s.uses?.value, max: s.uses?.max } : null,
        recharge: i.hasRecharge ? (i.isOnCooldown ? "cooldown" : "charged") : null,
        equip: "equipped" in s ? !!s.equipped : null,
        attune: s.attunement && !concealed ? !!s.attuned : null, attuneTitle: loc(D.attunementTypes?.[s.attunement] ?? ""),
        canDelete: !!i.canDelete, magical: props.has("mgc"), equipped: s.equipped === true,
        activations: [...(s.activities ?? [])].map(x => x?.activation?.type).filter(Boolean), sort: i.sort, concealed,
        expanded: await summary(i), canUse: a.isOwner && !a.pack
      });
    }
    const containers = [];
    for (const c of a.itemTypes?.container ?? []) {
      if (!top(c) || !visible(c)) continue;
      let pct = null; try { pct = (await c.system.computeCapacity())?.pct ?? null; } catch { pct = null; }
      containers.push({ id: c.id, name: c.name, img: c.img, quality: Pane.qualityOf(c), pct, tip: c.name, equipped: !!c.system?.equipped });
    }
    const enc = sys.attributes?.encumbrance;
    let wUnits = "";
    try { wUnits = loc(D.weightUnits?.[/** @type {any} */ (globalThis).dnd5e?.utils?.defaultUnits?.("weight")]?.abbreviation ?? ""); } catch { wUnits = ""; }
    const api = game.modules.get(ID)?.api;
    let money = null;
    try { if (game.settings.get(ID, "coinSystem") === "threeCoin" && api?.moneyHTML) money = api.moneyHTML(api.totalMoney(a)); } catch { money = null; }
    return {
      rows, sections, containers,
      currency: Object.entries(D.currencies ?? {}).map(([k, c]) => ({ key: k, label: loc(c?.label ?? k), abbr: loc(c?.abbreviation ?? k), value: sys.currency?.[k] ?? 0 })),
      money,
      encumbrance: enc ? { value: enc.value, max: enc.max, pct: enc.pct, low: enc.stops?.encumbered, high: enc.stops?.heavilyEncumbered, units: wUnits } : null,
      carry: { str: sys.abilities?.str?.value, size: loc(D.actorSizes?.[sys.traits?.size]?.abbreviation ?? sys.traits?.size ?? ""), mod: enc?.mod },
      attuned: sys.attributes?.attunement ?? null,
      editable: this.isEditable, edit: this._mode === "edit", search: this._inv.search, filters: this._inv.filters, sort: this._inv.sort
    };
  }

  /** The built page's body HTML, or null (placeholder pages). */
  async pageBody(page) {
    if (page === "character") return SP.characterPageHTML(await this.characterFacts());
    if (page === "details") return SP.detailsPageHTML(/** @type {any} */ (this.detailsFacts()));
    if (page === "inventory") return SP.inventoryPageHTML(await this.inventoryFacts());
    return null;
  }

  async _renderHTML() {
    const view = SM.sheetView(this.facts(), { mode: /** @type {any} */ (this._mode), page: this._page });
    this._page = view.page;
    /** @type {string | null} */
    let body = null;
    if (!view.limited && SM.BUILT_PAGES.includes(view.page)) {
      try { body = await this.pageBody(view.page); } catch (e) {
        console.error(`${ID} | character sheet: ${view.page} page`, e);
        body = `<p class="wct-cs-dim">This page couldn't be drawn (${esc(e?.message ?? e)}). The system sheet below still works.</p>`;
      }
    }
    const div = document.createElement("div");
    div.innerHTML = SM.sheetHTML(view, body);
    return div.firstElementChild;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".wct-cs-page")?.scrollTop ?? 0;
    content.replaceChildren(result);
    const page = content.querySelector(".wct-cs-page"); if (page && scroll) page.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- actions (this = the sheet)
  static #systemSheet(event, target) { if (game.user.isGM || target?.dataset?.page) openSystemSheet(this.actor, target?.dataset?.page ?? ""); }
  static #mode(event, target) { const m = target.dataset.mode === "edit" ? "edit" : "play"; if (m !== this._mode) { this._mode = m; this.render(); } }
  static #page(event, target) { const p = target.dataset.page; if (p && p !== this._page) { this._page = p; this.render(); } }
  static async #inspiration() {
    if (!this.isEditable) return;
    await this.actor.update({ "system.attributes.inspiration": !this.actor.system.attributes.inspiration });
  }
  static async #shortRest(event) { if (this.isEditable) await this.actor.shortRest({ event }); }
  static async #longRest(event) { if (this.isEditable) await this.actor.longRest({ event }); }
  static async #initiative(event) { if (this.isEditable) await this.actor.rollInitiativeDialog({ event }); }
  static async #deathSave(event) { if (this.isEditable) await this.actor.rollDeathSave({ event }); }
  static async #exhaustion(event, target) {
    if (!this.isEditable) return;
    const max = CONFIG.DND5E?.conditionTypes?.exhaustion?.levels ?? 6;
    const level = SM.exhaustionTarget(this.actor.system.attributes.exhaustion, Number(target.dataset.level), max);
    await this.actor.update({ "system.attributes.exhaustion": level });
  }
  // ---------------------------------------------------------------- slice 2 actions: dnd5e's own methods and config apps
  /** Checks, saves, skills, tools and concentration: dnd5e's roll methods, as its sheet's `roll` action calls them. */
  static async #roll(event, target) {
    if (!this.isEditable) return;
    const a = this.actor; const type = target.dataset.type;
    const ability = target.dataset.ability ?? target.closest("[data-ability]")?.dataset.ability;
    const key = target.closest("[data-key]")?.dataset.key;
    if (type === "concentration") return a.rollConcentration({ event, legacy: false });
    if (type === "save") return a.rollSavingThrow({ ability, event });
    if (type === "check") return a.rollAbilityCheck({ ability, event });
    if (type === "skill") return a.rollSkill({ skill: key, event });
    if (type === "tool") return a.rollToolCheck({ tool: key, event });
  }

  /** dnd5e's own configuration apps, chosen exactly as dnd5e's sheet's `showConfiguration` action does. */
  static #config(event, target) {
    if (!this.isEditable) return;
    const A = /** @type {any} */ (globalThis).dnd5e?.applications ?? {}; const C = A.actor ?? {}; const S = A.shared ?? {};
    const config = { document: this.actor };
    const open = (Cls, opts = config) => { if (!Cls) return ui.notifications.warn("That configuration isn't available in this dnd5e version."); return new Cls(opts).render({ force: true }); };
    const trait = target.dataset.trait;
    if (trait) {
      if (["di", "dm", "dr", "dv"].includes(trait)) return open(C.DamagesConfig, { ...config, trait });
      if (trait === "languages") return open(C.LanguagesConfig, { ...config, trait });
      if (trait === "tool") return open(C.ToolsConfig, { ...config, trait });
      if (trait === "weapon") return open(C.WeaponsConfig, { ...config, trait });
      return open(C.TraitsConfig, { ...config, trait, ...(trait === "ci" ? { position: { width: 400 } } : {}) });
    }
    const key = target.closest("[data-key]")?.dataset.key;
    switch (target.dataset.config) {
      case "ability": {
        const ability = target.dataset.ability ?? target.closest("[data-ability]")?.dataset.ability;
        if (ability === "concentration") return open(C.ConcentrationConfig);
        return open(C.AbilityConfig, { ...config, key: ability });
      }
      case "skills": return open(C.SkillsConfig);
      case "skill": return open(C.SkillToolConfig, { ...config, trait: "skills", key });
      case "tool": return open(C.SkillToolConfig, { ...config, trait: "tool", key });
      case "senses": case "movement": return open(S.MovementSensesConfig, { ...config, type: target.dataset.config });
      case "creatureType": {
        const race = this.actor.system.details?.race;
        return open(S.CreatureTypeConfig, race?.id ? { document: race, keyPath: "type" } : config);
      }
    }
  }

  /** The Attack box's Use button: dnd5e's item.use. */
  static async #use(event, target) {
    const item = this.actor.items.get(target.dataset.itemId); if (!item || !this.isEditable) return;
    return item.use({ event }, { options: { sheet: this } });
  }

  /** Opens an item's sheet (species, background, a container): edit for owners, view otherwise, as dnd5e's showDocument. */
  static #showItem(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId); if (!item) return;
    const mode = /** @type {any} */ (globalThis).dnd5e?.applications?.item?.ItemSheet5e?.MODES;
    item.sheet?.render({ force: true, ...(mode ? { mode: this.isEditable && this._mode === "edit" ? mode.EDIT : mode.PLAY } : {}) });
  }

  /** The portrait: Foundry's image popout, as dnd5e's sheet's showArtwork. */
  static #artwork() {
    const p = this._portrait ?? { src: this.actor.img };
    new foundry.applications.apps.ImagePopout({ src: p.src, uuid: this.actor.uuid, window: { title: this.actor.name } }).render({ force: true });
  }

  /** Edit mode: change the portrait (or the token art while "Show token" is on) with Foundry's file picker, as dnd5e's editImage. */
  static async #portrait() {
    if (!this.isEditable) return;
    const a = this.actor; const tok = !!this._portrait?.isToken;
    // A wildcard token image is changed in the prototype token's own config (dnd5e's sheet does the same).
    if (tok && this._portrait?.isRandom) return new foundry.applications.sheets.PrototypeTokenConfig({ prototype: a.prototypeToken }).render({ force: true });
    const path = tok ? (a.isToken ? "token.texture.src" : "prototypeToken.texture.src") : "img";
    const current = foundry.utils.getProperty(a, path);
    const FP = foundry.applications.apps.FilePicker.implementation;
    return new FP({ type: tok ? "imagevideo" : "image", current, callback: async p => {
      if (path.startsWith("token.")) await a.token?.update({ [path.slice(6)]: p });
      else await a.update({ [path]: p });
    } }).browse();
  }

  static async #slotEquipped() { if (this.isEditable) await Pane.slotEquippedItems(this.actor); }

  /** dnd5e's currency manager. */
  static #currency() {
    const CM = /** @type {any} */ (globalThis).dnd5e?.applications?.CurrencyManager;
    if (CM && this.isEditable) new CM({ document: this.actor }).render({ force: true });
  }

  /** Edit mode, Inventory: dnd5e's own item creation dialog with the inventory item types (as its sheet's create button). */
  static #createItem() {
    if (!this.isEditable) return;
    const types = Object.entries(CONFIG.Item?.dataModels ?? {}).filter(([t, m]) => m && "inventorySection" in m && t !== "backpack").map(([t]) => t);
    return Item.implementation.createDialog({}, { types, parent: this.actor }, { sheet: this });
  }

  // ---------------------------------------------------------------- slice 2 listeners
  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element?.querySelector(".wct-cs"); if (!root) return;
    const ed = this.isEditable; const a = this.actor;
    // Changed fields (ability scores, size, skill abilities, coins): one actor update each, dnd5e's delta input rule for numbers.
    root.querySelectorAll("input[data-name], select[data-name]").forEach(el => {
      if (el.closest("dnd5e-inventory")) return; // dnd5e's inventory element handles its own quantity / uses inputs
      el.addEventListener("change", async ev => {
        ev.stopPropagation(); if (!ed) return;
        const t = /** @type {HTMLInputElement} */ (ev.currentTarget); const path = t.dataset.name; if (!path) return;
        if (t.tagName === "SELECT") return a.update({ [path]: t.value });
        const v = SP.parseDelta(t.value, foundry.utils.getProperty(a._source ?? a, path) ?? foundry.utils.getProperty(a, path));
        if (v === null) return;
        t.value = String(v);
        return a.update({ [path]: v });
      });
      el.addEventListener("focus", () => /** @type {HTMLInputElement} */ (el).select?.());
    });
    // Proficiency marks in edit mode: dnd5e's own <proficiency-cycle> element (cycles 0 → 1 → ½ → 2, or 0 → 1 for saves).
    root.querySelectorAll("proficiency-cycle[data-wct-prof]").forEach(el => el.addEventListener("change", ev => {
      ev.stopPropagation(); if (!ed) return;
      const t = /** @type {any} */ (ev.currentTarget); return a.update({ [t.dataset.wctProf]: Number(t.value) });
    }));
    root.querySelector("[data-wct-tokport]")?.addEventListener("change", ev => { ev.stopPropagation(); if (ed) a.update({ "flags.dnd5e.showTokenPortrait": !!(/** @type {HTMLInputElement} */ (ev.currentTarget).checked) }); });
    if (this._page === "character") this._onRenderCharacter(root);
    if (this._page === "inventory") this._onRenderInventory(root);
  }

  /** Character page: the pane's slot and weapon-set handling (pane.mjs), on the same flags. */
  _onRenderCharacter(root) {
    const a = this.actor; const ed = this.isEditable;
    const itemOf = el => a.items.get(el.closest("[data-item-id]")?.dataset.itemId);
    root.querySelectorAll(".wct-cs-doll [data-item-id], .wct-cs-bag [data-item-id]").forEach(el => {
      el.addEventListener("pointerenter", () => Pane.itemTooltip(a, el, itemOf(el)));
      el.addEventListener("pointerleave", () => game.tooltip?.deactivate?.());
    });
    root.querySelector("[data-wct-attack]")?.addEventListener("change", ev => { const v = /** @type {HTMLSelectElement} */ (ev.currentTarget).value; this._attackMode = v === "auto" ? null : v; this.render(); });
    if (!ed) return;
    // An actor from before weapon sets gets its sets stored once, as when its pane first opens (the sheet then re-renders).
    if (Pane.setsOn() && !a.getFlag(ID, "weaponSets") && !this._ensuring) { this._ensuring = true; Pane.ensureSets(a).catch(e => console.warn(`${ID} | weapon sets`, e)).finally(() => { this._ensuring = false; }); }
    for (const el of root.querySelectorAll(".wct-cs-slot.wct-slot, .wct-cs-page [data-drop]")) {
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("over"); });
      el.addEventListener("dragleave", () => el.classList.remove("over"));
      el.addEventListener("drop", async ev => {
        ev.preventDefault(); ev.stopPropagation(); el.classList.remove("over");
        const r = await Pane.dropOnDoll(a, ev, el);
        if (r && "ask" in r) this._showPop(null, Pane.askSlotMenu(a, /** @type {any} */ (r).item, /** @type {string[]} */ (r.ask)));
      });
    }
    root.querySelectorAll(".wct-cs-slot.wct-slot").forEach(el => {
      el.addEventListener("click", ev => { ev.stopPropagation(); const m = Pane.slotMenu(a, el); if (m) this._showPop(el, m); });
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); ev.stopPropagation(); const i = el.classList.contains("filled") ? itemOf(el) : null; if (i) Pane.unslotItem(i); });
    });
    const equip = async (el, item) => { const r = await Pane.autoEquip(a, item); if (r && "ask" in r) this._showPop(el, Pane.askSlotMenu(a, item, /** @type {string[]} */ (r.ask))); };
    root.querySelectorAll(".wct-cs-bag .wct-item").forEach(el => {
      el.addEventListener("click", ev => { ev.stopPropagation(); equip(el, itemOf(el)); });
      el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); equip(el, itemOf(el)); } });
    });
    root.querySelectorAll("[data-wct-activate]").forEach(b => b.addEventListener("click", async ev => {
      ev.stopPropagation(); const set = /** @type {HTMLElement} */ (b).dataset.wctActivate;
      const plan = await Pane.activateSet(a, set);
      this._blocked = plan && !plan.ok ? { set: /** @type {string} */ (set) } : null;
      if (plan && !plan.ok) this.render();
    }));
    root.querySelectorAll("[data-wct-stow]").forEach(b => b.addEventListener("click", async ev => {
      ev.stopPropagation(); /** @type {HTMLButtonElement} */ (b).disabled = true;
      const want = this._blocked?.set;
      await Pane.stowShield(a, /** @type {HTMLElement} */ (b).dataset.wctStow);
      if (want) this._blocked = { set: want };
      this.render();
    }));
    root.addEventListener("click", ev => { if (!(/** @type {HTMLElement} */ (ev.target)).closest(".wct-cs-pop")) this._closePop(); });
  }

  /** The slot / hand picker (the pane's popover), placed by the clicked element. @param {HTMLElement | null} anchor @param {{ html: string, pick: (li: HTMLElement) => any }} m */
  _showPop(anchor, m) {
    const pop = /** @type {HTMLElement | null} */ (this.element?.querySelector(".wct-cs-pop")); if (!pop) return;
    pop.innerHTML = m.html; pop.hidden = false;
    const host = /** @type {HTMLElement} */ (this.element.querySelector(".wct-cs-page"));
    const box = host.getBoundingClientRect(); const r = (anchor ?? /** @type {HTMLElement} */ (this.element.querySelector(".wct-cs-model")) ?? host).getBoundingClientRect();
    const left = Math.min(Math.max(4, r.left - box.left + r.width + 4), box.width - 234);
    pop.style.left = `${left}px`; pop.style.top = `${Math.max(4, r.top - box.top + host.scrollTop)}px`;
    pop.querySelectorAll("li[data-pick-item], li[data-pick-slot]").forEach(li => li.addEventListener("click", ev => { ev.stopPropagation(); this._closePop(); m.pick(/** @type {HTMLElement} */ (li)); }));
  }
  _closePop() { const pop = /** @type {HTMLElement | null} */ (this.element?.querySelector(".wct-cs-pop")); if (pop) pop.hidden = true; }

  /** Inventory page: search (live), chips, sort; the list itself is dnd5e's inventory element. */
  _onRenderInventory(root) {
    const a = this.actor;
    const search = /** @type {HTMLInputElement | null} */ (root.querySelector("[data-wct-search]"));
    const apply = () => {
      const q = search?.value ?? ""; this._inv.search = q; let any = false;
      for (const sec of root.querySelectorAll(".wct-cs-sec")) {
        let shown = 0;
        for (const li of sec.querySelectorAll("li[data-item-id]")) {
          const ok = li.getAttribute("data-wct-chips") !== "0" && SP.nameMatches(li.getAttribute("data-item-name"), q);
          /** @type {HTMLElement} */ (li).hidden = !ok; if (ok) shown++;
        }
        /** @type {HTMLElement} */ (sec).hidden = !shown; if (shown) any = true;
      }
      const none = /** @type {HTMLElement | null} */ (root.querySelector(".wct-cs-nomatch")); if (none) none.hidden = any || !root.querySelector(".wct-cs-sec");
    };
    search?.addEventListener("input", () => apply());
    search?.addEventListener("change", ev => ev.stopPropagation());
    search?.addEventListener("keydown", ev => ev.stopPropagation());
    root.querySelectorAll("[data-wct-filter]").forEach(b => b.addEventListener("click", () => {
      const k = /** @type {HTMLElement} */ (b).dataset.wctFilter ?? ""; const f = new Set(this._inv.filters);
      if (f.has(k)) f.delete(k); else f.add(k);
      this._inv.filters = [...f]; this.render();
    }));
    root.querySelector("[data-wct-sort]")?.addEventListener("click", ev => { this._inv.sort = /** @type {HTMLElement} */ (ev.currentTarget).dataset.wctSort === "a" ? "a" : "m"; this.render(); });
    root.querySelectorAll(".wct-cs-inv li[data-item-id] .wct-cs-ico, .wct-cs-conts [data-item-id] .wct-cs-ico").forEach(el => {
      const item = a.items.get(el.closest("[data-item-id]")?.getAttribute("data-item-id"));
      el.addEventListener("pointerenter", () => Pane.itemTooltip(a, /** @type {HTMLElement} */ (el), item));
      el.addEventListener("pointerleave", () => game.tooltip?.deactivate?.());
    });
    // Containers sit outside dnd5e's inventory element: give them its item context menu, as dnd5e's sheet does for its container strip.
    const inv = /** @type {any} */ (root.querySelector("dnd5e-inventory")); const conts = root.querySelector(".wct-cs-conts");
    const CM = /** @type {any} */ (globalThis).dnd5e?.applications?.ContextMenu5e;
    if (CM && conts && typeof inv?._onOpenContextMenu === "function") {
      try { new CM(conts, "[data-item-id]", [], { onOpen: el => inv._onOpenContextMenu(el), jQuery: false }); } catch (e) { console.warn(`${ID} | container context menu`, e); }
    }
    // Keyboard: Enter or Space on an item name does what a click does (dnd5e's use / view).
    root.querySelectorAll(".wct-cs-inv .wct-cs-nm[data-action]").forEach(el => el.addEventListener("keydown", ev => {
      const k = /** @type {KeyboardEvent} */ (ev).key; if (k !== "Enter" && k !== " ") return;
      ev.preventDefault(); /** @type {HTMLElement} */ (el).click();
    }));
    // Equipping from the Inventory also puts the item in its paper-doll slot (the pane's rules): our handler runs before dnd5e's
    // inventory element, which would only toggle system.equipped (its "inventory" event is cancelable and fires first). Unequipping goes through the pane too (clears the slot).
    root.querySelector(".wct-cs-inv")?.addEventListener("inventory", ev => {
      const e = /** @type {CustomEvent} */ (ev); if (e.detail !== "equip") return;
      const item = a.items.get(/** @type {HTMLElement} */ (e.target).closest("[data-item-id]")?.getAttribute("data-item-id")); if (!item || !this.isEditable) return;
      e.preventDefault();
      if (item.system.equipped) return Pane.unslotItem(item).then(() => item.system.equipped ? item.update({ "system.equipped": false }) : null);
      return equipToSlot(a, item);
    });
  }

  // ---------------------------------------------------------------- drag and drop: dnd5e's own handling
  /** Drag start (core's DragDrop on `.draggable`): the item's drag data, plus the doll slot it came from (finger/trinket swaps). */
  async _onDragStart(event) {
    const el = /** @type {HTMLElement} */ (event.currentTarget);
    game.tooltip?.deactivate?.();
    const item = this.actor.items.get(el.closest("[data-item-id]")?.getAttribute("data-item-id"));
    if (!item) return super._onDragStart?.(event);
    event.dataTransfer?.setData("text/plain", JSON.stringify({ ...item.toDragData(), wctSlot: el.dataset.slot ?? null }));
  }

  /** Drag over: dnd5e's own drop-effect rules (move within the actor, copy from elsewhere, its modifier keys) via the drop host. */
  _onDragOver(event) { try { this.dnd5eHost()?._onDragOver?.(event); } catch { /* no dnd5e drop rules */ } }

  /**
   * Drop anywhere on the sheet that isn't a doll slot: dnd5e's own character-sheet drop handling, run by the drop host (its `_onDrop`:
   * drop behaviour, Foundry's dropActorSheetData hook, then create with advancement, stack consumables, sort, move into and out of
   * containers, spells as scrolls on the Inventory page, effects, actors, folders), against this sheet's markup.
   */
  async _onDrop(event) {
    if (/** @type {HTMLElement} */ (event.target)?.closest?.(".wct-cs-doll [data-slot], .wct-cs-doll [data-set], .wct-cs-page [data-drop]")) return;
    const host = this.dnd5eHost();
    if (!host?._onDrop) return super._onDrop?.(event);
    // dnd5e's handlers read the tab (spells dropped on Inventory become scrolls) and the drop target (a container, a sibling row).
    host.tabGroups = { ...(host.tabGroups ?? {}), primary: this._page === "inventory" ? "inventory" : "details" };
    return host._onDrop(event);
  }
}

/**
 * Equips an item from the Inventory into its paper-doll place with the character pane's rules (pane.mjs autoEquip: relic slot, a
 * free hand of a weapon set, else its best gear slot, replacing what was there as the pane does). An item with no clear slot is
 * equipped without a slot and shows in the Character page's "equipped but not in a slot" note.
 * @param {any} actor @param {any} item
 */
export async function equipToSlot(actor, item) {
  const r = await Pane.autoEquip(actor, item);
  if (!r || "ask" in r) { if (!item.system.equipped) await item.update({ "system.equipped": true }); }
  return r;
}

/** Registers the sheet for dnd5e character actors (feature on; called from init). */
export function register() {
  const DSC = foundry.applications.apps?.DocumentSheetConfig;
  if (!DSC?.registerSheet) return console.warn(`${ID} | character sheet: DocumentSheetConfig not found, sheet not registered`);
  DSC.registerSheet(Actor, ID, WctCharacterSheet, { types: ["character"], makeDefault: true, label: SM.SHEET_LABEL });
}

/**
 * The C key: a player's own character, a GM's selected token's character. Never while typing. Opens the toolkit sheet (the
 * actor's own sheet when that is already the toolkit sheet, so there is never a second window with the same id).
 */
export async function openFromKey() {
  const pick = SM.pickSheetActor({ isGM: game.user.isGM, controlled: (canvas?.ready ? canvas.tokens?.controlled ?? [] : []).map(t => t.actor), character: game.user.character,
    // Players only: the characters they own (for the no-assigned-character fallbacks). GMs pick by token as before.
    owned: game.user.isGM || game.user.character ? [] : (game.actors?.filter(a => a.type === "character" && a.isOwner) ?? []) });
  if (pick.warn !== undefined) return ui.notifications.info(pick.warn);
  // Like core's Toggle Character Sheet: a second press closes the sheet when it is open and in front.
  const open = existing(/** @type {any} */ (WctCharacterSheet), pick.actor);
  if (open?.rendered && !open.minimized && ui.activeWindow === open) return open.close();
  return openSheet(pick.actor);
}

/** Opens (or brings forward) the toolkit sheet for an actor. */
export async function openSheet(actor) {
  if (!actor?.testUserPermission?.(game.user, "LIMITED")) return ui.notifications.warn(`You can't view ${actor?.name ?? "that character"}.`);
  const Cls = /** @type {any} */ (WctCharacterSheet);
  const app = existing(Cls, actor) ?? new Cls({ document: actor });
  if (app.rendered) { app.bringToFront?.(); if (app.minimized) await app.maximize?.(); return app; }
  return app.render({ force: true });
}

/**
 * The sheet's key (action `characterSheet`, default C). Built with core's checked definition, but registered here so the press is
 * only consumed when the sheet actually handles it: while the user types in a field, onDown returns false and the letter reaches the
 * field (core's wrapper would always consume). PRIORITY precedence so it runs before core's own C binding (Toggle Character Sheet),
 * which would otherwise also toggle the user's character sheet. Users rebind it in Configure Controls (stored by action id).
 */
export function registerKey() {
  const def = defineOpenKeybinding({
    action: SM.SHEET_ACTION, name: "Open character sheet",
    hint: "Opens the Wanderer's Toolkit character sheet: your own character, or (GM) the selected token's character. Default: C.",
    editable: SM.SHEET_KEY, precedence: CONST.KEYBINDING_PRECEDENCE.PRIORITY, onDown: () => openFromKey()
  });
  const cfg = keybindingConfig(def, { isGM: () => !!game.user?.isGM, onError: e => console.error(`${ID} | keybinding ${def.action} failed`, e) });
  const run = cfg.onDown;
  cfg.onDown = ctx => (SM.isTyping(ctx?.event?.target) || SM.isTyping(document.activeElement) ? false : run(ctx));
  try { game.keybindings.register(ID, def.action, cfg); } catch (e) { console.warn(`${ID} | key binding ${def.action} not registered`, e); }
}

// ---------------------------------------------------------------- core's Toggle Character Sheet → Alt+C
/** The hidden client setting recording which core action we moved ("" = none). Registered on every client, feature on or off. */
export function registerSettings() {
  game.settings.register(ID, SM.MOVED_SETTING, { name: "Character sheet: core key moved", scope: "client", config: false, type: String, default: "" });
}
const moved = () => { try { return String(game.settings.get(ID, SM.MOVED_SETTING) ?? ""); } catch { return ""; } };

/** Plain facts about every registered keybinding action on this client (for sheet-model.mjs `coreKeyPlan`). */
export function keyFacts() {
  /** @type {SM.ActionFacts[]} */
  const out = [];
  const kb = game.keybindings; if (!kb?.actions) return out;
  for (const [id, a] of kb.actions) {
    const [namespace, ...rest] = String(id).split(".");
    out.push({
      id, namespace: a.namespace ?? namespace, action: a.action ?? rest.join("."), name: (() => { try { return game.i18n?.localize?.(a.name) ?? a.name; } catch { return a.name; } })(),
      editable: a.editable ?? [], uneditable: a.uneditable ?? [], reservedModifiers: a.reservedModifiers ?? [],
      // The user's current keys for the action (ClientKeybindings#get), or its defaults when that fails.
      // (get() also lists the action's uneditable keys; those are left out so this is the editable part only.)
      current: (() => { try { return SM.withoutBindings(kb.get(a.namespace ?? namespace, a.action ?? rest.join(".")) ?? a.editable, a.uneditable); } catch { return a.editable; } })()
    });
  }
  return out;
}

/** The last plan on this client, for the health check. */
let lastPlan = /** @type {any} */ (null);
export const coreKeyStatus = () => ({ plan: lastPlan, moved: moved() });

/**
 * On ready, every client: move core's character-sheet toggle to Alt+C (sheet + keys on), or put it back (off); a 1.33.0 Shift+C
 * move is put back first, then the plan runs again. Never throws.
 * `game.keybindings.set` stores the user's binding for that action (client), exactly as Configure Controls does.
 * @param {boolean} on the sheet feature and Keyboard shortcuts are both on
 */
export async function syncCoreSheetKey(on) {
  try {
    let plan = SM.coreKeyPlan({ on, moved: moved(), actions: keyFacts() });
    if (plan.do === "restore" && plan.again) { await restoreCoreKey(plan.id); plan = SM.coreKeyPlan({ on, moved: moved(), actions: keyFacts() }); }
    lastPlan = plan;
    if (plan.do === "move") {
      const [ns, ...rest] = String(plan.id).split(".");
      await game.keybindings.set(ns, rest.join("."), SM.CORE_SHEET_MOVED.map(b => ({ key: b.key, modifiers: [...b.modifiers] })));
      await game.settings.set(ID, SM.MOVED_SETTING, plan.id);
    } else if (plan.do === "restore") await restoreCoreKey(plan.id);
    else if (plan.do === "forget") await game.settings.set(ID, SM.MOVED_SETTING, "");
  } catch (e) { console.warn(`${ID} | character sheet: core key`, e); }
}

/** Puts core's action back to its default keys and clears the record. Also used by cleanup's settings reset. */
export async function restoreCoreKey(id = moved()) {
  if (!id) return false;
  const a = keyFacts().find(x => x.id === id);
  if (SM.isOurMove(a)) {
    const [ns, ...rest] = id.split(".");
    await game.keybindings.set(ns, rest.join("."), (a?.editable ?? []).map(b => ({ key: b.key, modifiers: [...(b.modifiers ?? [])] })));
  }
  await game.settings.set(ID, SM.MOVED_SETTING, "");
  return true;
}
