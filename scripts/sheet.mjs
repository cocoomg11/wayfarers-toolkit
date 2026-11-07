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
import * as BM from "./sheet-book-model.mjs";
import * as SX from "./sheet-extra-model.mjs";
import * as PM from "./pane-model.mjs";
import * as Pane from "./pane.mjs";
import * as WS from "./weapon-sets.mjs";
import { restedTip } from "./pane-model.mjs";
import { BENEFITS } from "./inn-model.mjs";
import { on as featureOn } from "./features.mjs";
import * as RenownUI from "./renown-apps.mjs";
import { UI_CLASSES, defineOpenKeybinding, keybindingConfig, esc, createPageHost, renderGuest, activateGuest } from "../vendor/wanderers-core/index.mjs";
const ID = "wayfarers-toolkit";

// ---------------------------------------------------------------- 2.3: other modules' pages (core guest pages)
/**
 * The sheet's page registry (core `createPageHost`; one per load, owned here: other modules reach it only through `api.sheet`).
 * Built-ins are SM.PAGES with their orders (their own visibility stays in sheet-model.mjs `visiblePages`). A change re-renders
 * the open sheets (once per tick, so several registrations at ready redraw once).
 */
export const PAGE_HOST = createPageHost({
  hostId: ID,
  builtIn: SM.PAGES.map(p => ({ id: p.id, order: p.order, label: p.label, hint: p.hint })),
  onChange: () => rerenderOpenSheets(),
  warn: (...a) => console.warn(`${ID} | character sheet:`, ...a)
});
let rerenderQueued = false;
/** Re-renders every open toolkit sheet (next tick; one redraw for a burst of changes). */
function rerenderOpenSheets() {
  if (rerenderQueued) return;
  rerenderQueued = true;
  setTimeout(() => {
    rerenderQueued = false;
    for (const app of /** @type {any} */ (globalThis).foundry?.applications?.instances?.values?.() ?? []) {
      if (app instanceof WctCharacterSheet && /** @type {any} */ (app).rendered) /** @type {any} */ (app).render();
    }
  }, 0);
}
/** Page summaries for `api.sheet.pages()`: every page (ours and guests), in bookmark order, without functions. */
const pageList = () => PAGE_HOST.pages().map(p => (p.guest ? SM.guestSummary(/** @type {any} */ (p)) : { id: p.id, label: String(p.label ?? ""), hint: String(p.hint ?? ""), order: p.order, guest: false }));
/** `api.sheet` (feature on): register / unregister another module's page, list the pages. One frozen object. */
export const PAGE_API = Object.freeze({
  /** @param {unknown} def */
  registerPage: def => PAGE_HOST.register(def),
  /** @param {string} id */
  unregisterPage: id => PAGE_HOST.unregister(id),
  pages: pageList
});
/** How long a guest page's render may take before the sheet shows the error line. */
export const GUEST_RENDER_MS = 5000;

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
      wctCreateItem: WctCharacterSheet.#createItem,
      // slice 3: Features and Spells
      wctFindItem: WctCharacterSheet.#findItem,
      wctDeleteItem: WctCharacterSheet.#deleteItem,
      wctSpellAbility: WctCharacterSheet.#spellAbility,
      wctPip: WctCharacterSheet.#pip,
      wctCreateFeature: WctCharacterSheet.#createFeature,
      wctCreateSpell: WctCharacterSheet.#createSpell,
      // slice 4
      wctLevelUp: WctCharacterSheet.#levelUp,
      wctShowUuid: WctCharacterSheet.#showUuid,
      wctUseFacility: WctCharacterSheet.#useFacility,
      wctDeleteOccupant: WctCharacterSheet.#deleteOccupant,
      wctCreateEffect: WctCharacterSheet.#createEffect
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
  /** Features and Spells pages: the same per-window list state (dnd5e's defaults: manual / by origin, and A–Z for spells). */
  _feat = { search: "", filters: /** @type {string[]} */ ([]), sort: "m", group: "origin" };
  _spell = { search: "", filters: /** @type {string[]} */ ([]), sort: "a" };
  /** Effects page: search text (per window). */
  _fx = { search: "" };
  /** Reputation page (2.2): search, filter, sort and folded groups (per window, not saved; renown-view-model.mjs pageState). */
  _rn = /** @type {any} */ (undefined);

  /** dnd5e's own expand state for inventory rows (dnd5e's inventory element reads app.expandedSections). */
  get expandedSections() { return (this._expanded ??= new Map()); }
  /** dnd5e's inventory element asks the app for its item source and whether a row can expand. */
  get inventorySource() { return this.actor; }
  canExpand(item) { return !["class", "subclass"].includes(item?.type); }
  /** dnd5e's inventory element opens item sheets through the app. */
  _openDocumentSheet(doc, options = {}) { if (doc?.sheet) this._renderChild(doc.sheet, options); }

  // ---------------------------------------------------------------- dnd5e's app contract (2.0.1)
  // Methods dnd5e 6.0.6 calls on "the sheet" from its documents, dialogs and elements (APP_CONTRACT in sheet-model.mjs lists them).
  // Each does what dnd5e's ApplicationV2Mixin / PrimarySheetMixin / BaseActorSheet does, or hands the work to the dnd5e drop host.

  /** Renders an app in this sheet's workspace (dnd5e: dialogs, advancement, activity choice, item sheets). */
  _renderChild(app, options = {}) {
    const parent = /** @type {any} */ (this).parent;
    if (parent?.renderChild) return parent.renderChild(app, options);
    if (typeof super.renderChild === "function") return super.renderChild(app, options);
    return app?.render?.({ force: true, ...options });
  }

  /** A yes / no confirm as a child of this sheet (dnd5e's `_confirmDialog`: item, effect and activity deletes). Resolves true / false / null. */
  _confirmDialog(config = {}) {
    /** @type {(v: any) => void} */
    let resolve = () => { };
    const promise = new Promise(r => { resolve = r; });
    const { yes = {}, no = {}, ...rest } = /** @type {any} */ (config);
    const loc = WctCharacterSheet.loc;
    const app = new foundry.applications.api.DialogV2({
      ...rest,
      classes: [...(rest.classes ?? []), "wct-dialog", ...UI_CLASSES],
      buttons: [
        foundry.utils.mergeObject({ action: "yes", icon: "fa-solid fa-check", label: loc("COMMON.Yes"), default: true }, yes),
        foundry.utils.mergeObject({ action: "no", icon: "fa-solid fa-xmark", label: loc("COMMON.No") }, no)
      ],
      submit: result => resolve(result)
    });
    app.addEventListener("close", () => resolve(null), { once: true });
    this._renderChild(app);
    return promise;
  }

  /** dnd5e's "Toggle sheet mode" key (Shift+E) and its sheet API: play ↔ edit. @param {"play" | "edit" | number} [mode] */
  async changeMode(mode) {
    const want = mode === "edit" || mode === 2 ? "edit" : mode === "play" || mode === 1 ? "play" : this._mode === "edit" ? "play" : "edit";
    if (want === "edit" && !this.isEditable) return;
    if (want === this._mode) return;
    // Leaving Edit: save text still open in a ProseMirror editor first (dnd5e's sheet submits its form on a mode change).
    if (this._mode === "edit") await this.saveEditors();
    this._mode = want; this.render();
  }

  /** Writes every open or changed `<prose-mirror data-wct-prose>` on this sheet to its path (one actor update). */
  async saveEditors() {
    /** @type {Record<string, unknown>} */
    const data = {};
    for (const el of /** @type {any[]} */ ([...(this.element?.querySelectorAll?.("prose-mirror[data-wct-prose]") ?? [])])) {
      const path = el.dataset.wctProse; const value = el.value;
      if (path && typeof value === "string" && value !== String(foundry.utils.getProperty(this.actor._source ?? {}, path) ?? "")) data[path] = value;
    }
    if (Object.keys(data).length && this.isEditable) await this.actor.update(data);
  }
  /** dnd5e reads `isEditMode` on its sheets. */
  get isEditMode() { return this._mode === "edit" && !!this.isEditable; }

  /** Group sheets and macros drop items onto `actor.sheet._onDropCreateItems`: dnd5e's creation via the drop host. */
  _onDropCreateItems(event, items, behavior) { return this.dnd5eHost()?._onDropCreateItems?.(event, items, behavior); }
  _onDropStackConsumables(event, itemData, options) { return this.dnd5eHost()?._onDropStackConsumables?.(event, itemData, options) ?? null; }
  _onDropSingleItem(event, itemData, options) { return this.dnd5eHost()?._onDropSingleItem?.(event, itemData, options) ?? itemData; }

  /** dnd5e's effects element asks the app for the actor's concentration data. */
  get _concentration() { return this.actor?.concentration ?? { items: new Set(), effects: new Set() }; }

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
      bastion, renown: featureOn("renown"), editable: this.isEditable, isGM: game.user.isGM,
      // 2.3: other modules' pages whose visible(actor) allows this actor (core hides one whose visible throws).
      guests: PAGE_HOST.guests(a).map(g => SM.guestSummary(g)),
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

  // ---------------------------------------------------------------- slice 3: Features and Spells facts (dnd5e's own preparation)
  /** dnd5e's expanded summary for a row (item-summary.hbs), or null when collapsed. */
  async summaryOf(item) {
    if (!this.expandedSections.get(`items.${item.id}`)) return null;
    try {
      const ctx = await item.getChatData({ secrets: item.isOwner });
      return await foundry.applications.handlebars.renderTemplate("systems/dnd5e/templates/items/parts/item-summary.hbs", ctx);
    } catch { return null; }
  }

  /** Whether dnd5e shows an item on the sheet (hidden items, inactive dependent origins). */
  isShown(i) {
    const a = this.actor; const o = i.dependentOrigin;
    if (a.hiddenItems?.has?.(i.id)) return false;
    return !(o?.active === false && o.parent !== i);
  }

  /** The common row facts for features and spells. */
  async bookRow(i) {
    const a = this.actor; const s = i.system ?? {};
    const props = s.properties instanceof Set ? s.properties : new Set(s.properties ?? []);
    const conc = a.concentration?.items;
    return {
      id: i.id, uuid: i.uuid, name: i.name, img: i.img, quality: Pane.qualityOf(i),
      activations: [...(s.activities ?? [])].map(x => x?.activation?.type).concat(i.type === "spell" ? [s.activation?.type] : []).filter(Boolean),
      recovery: [...(s.uses?.recovery ?? [])].map(r => r?.period).filter(Boolean),
      concentration: props.has("concentration"), ritual: props.has("ritual"), magical: props.has("mgc"),
      uses: i.hasLimitedUses ? { value: s.uses?.value, max: s.uses?.max } : null,
      recharge: i.hasRecharge ? (i.isOnCooldown ? "cooldown" : "charged") : null,
      recoveryLabel: i.labels?.recovery ?? "", canDelete: !!i.canDelete, canUse: a.isOwner && !a.pack,
      canExpand: this.canExpand(i), expanded: await this.summaryOf(i), sort: i.sort,
      concentrating: !!conc?.has?.(i)
    };
  }

  /** The Features page's facts, as dnd5e's `_prepareFeaturesContext` / `_prepareItemFeature` prepare them. */
  async featuresFacts() {
    const a = this.actor;
    const classes = Object.values(a.classes ?? {}).sort((x, y) => (y.system?.levels ?? 0) - (x.system?.levels ?? 0));
    const classFacts = classes.map(c => {
      const sub = c.subclass ?? null;
      const adv = c.advancement?.byType?.Subclass?.[0];
      return { id: c.id, name: c.name, img: c.img, levels: c.system?.levels, identifier: c.identifier ?? c.system?.identifier,
        subclass: sub ? { id: sub.id, name: sub.name, img: sub.img } : null, needsSubclass: !sub && !!adv && adv.level <= (c.system?.levels ?? 0),
        hitDie: c.system?.hd?.denomination ?? "" };
    });
    const skip = new Set(["class", "subclass", "race", "background", "facility", "spell"]);
    const invTypes = new Set(Object.entries(CONFIG.Item?.dataModels ?? {}).filter(([, m]) => m && "inventorySection" in m).map(([t]) => t));
    const rows = [];
    for (const i of a.items) {
      if (skip.has(i.type) || invTypes.has(i.type) || !this.isShown(i)) continue;
      const s = i.system ?? {}; const props = s.properties instanceof Set ? s.properties : new Set(s.properties ?? []);
      const [originId] = String(i.getFlag?.("dnd5e", "advancementRoot") ?? i.getFlag?.("dnd5e", "advancementOrigin") ?? "").split(".");
      const root = originId ? a.items.get(originId) : null;
      const group = BM.featureGroup({ active: !props.has("trait") && !!s.activities?.size, rootType: root?.type, rootClass: root?.type === "class" ? root.identifier : root?.class?.identifier });
      rows.push({ ...(await this.bookRow(i)), group, subtitle: [s.type?.label, i.isActive ? i.labels?.activation : null].filter(Boolean).join(" • ") });
    }
    const sp = a.system?.details?.race; const bg = a.system?.details?.background;
    const sections = BM.featureSections(rows, {
      classes: classFacts.map(c => ({ identifier: c.identifier, name: c.name })), species: !!sp && typeof sp === "object", background: !!bg && typeof bg === "object", mode: this._feat.group
    });
    return { classes: classFacts, sections, summary: { level: a.system?.details?.level, prof: a.system?.attributes?.prof },
      editable: this.isEditable, edit: this._mode === "edit", search: this._feat.search, filters: this._feat.filters, sort: this._feat.sort, group: this._feat.group };
  }

  /** The Spells page's facts, as dnd5e's `_prepareSpellbook`, `_prepareItemSpell` and `_prepareSpellsContext` prepare them. */
  async spellsFacts() {
    const a = this.actor; const loc = WctCharacterSheet.loc; const D = CONFIG.DND5E ?? {};
    const methods = D.spellcasting ?? {};
    /** @type {Record<string, any>} */
    const book = {};
    const register = (key, level, config) => {
      if (key in book) return;
      const lvl = config?.slots ? level : 1;
      let label; try { label = config?.getLabel?.({ level: lvl }) ?? loc("DND5E.CAST.SECTIONS.Spellbook"); } catch { label = String(key); }
      const order = lvl === 0 ? 0 : (config?.order ?? 1000);
      const usesSlots = !!config?.slots && lvl !== 0;
      const slots = usesSlots ? foundry.utils.getProperty(a.system?.spells ?? {}, key) ?? null : null;
      book[key] = { id: key, label, method: config?.key ?? key, level: config?.slots ? lvl : null, order: order + (lvl ?? 0) / 100, slots: slots ? { value: slots.value, max: slots.max, override: slots.override } : null, rows: [] };
    };
    for (const sc of Object.values(methods)) {
      let levels = []; try { levels = sc.getAvailableLevels?.(a) ?? []; } catch { levels = []; }
      if (!levels.length) continue;
      if (sc.cantrips) register("spell0", 0, methods.spell);
      for (const l of levels) register(sc.getSpellSlotKey(l), l, sc);
    }
    const SingleLevel = /** @type {any} */ (globalThis).dnd5e?.dataModels?.spellcasting?.SingleLevelSpellcasting;
    const spells = a.items.filter(i => i.type === "spell" && this.isShown(i)).sort((x, y) => (x.system.level ?? 0) - (y.system.level ?? 0));
    const abbr = { action: "DND5E.ActionAbbr", bonus: "DND5E.BonusActionAbbr", reaction: "DND5E.ReactionAbbr", minute: "DND5E.TimeMinuteAbbr", hour: "DND5E.TimeHourAbbr", day: "DND5E.TimeDayAbbr" };
    const states = D.spellPreparationStates ?? {};
    for (const i of spells) {
      const s = i.system; let method = s.method; if (!(method in methods)) method = "innate";
      const sc = methods[method];
      const level = SingleLevel && sc instanceof SingleLevel && s.level !== 0 ? null : (s.level || 0);
      let key; try { key = sc?.getSpellSlotKey?.(level) ?? method; } catch { key = method; }
      const linked = s.linkedActivity?.item;
      if (i.getFlag?.("dnd5e", "cachedFor")) { key = "item"; if (!s.linkedActivity?.displayInSpellbook) continue; register(key); }
      else register(key, level, sc);
      // Columns, as dnd5e's _prepareItemSpell / columns.
      const cost = s.activation?.value ?? ""; const ab = abbr[s.activation?.type];
      const units = s.range?.units;
      const range = units && units !== "none" ? (units in (D.movementUnits ?? {}) && Number.isFinite(Number(s.range.value)) ? `${s.range.value} ${loc(D.movementUnits[units].abbreviation)}` : (i.labels?.range ?? "")) : "";
      const toHit = parseInt(i.labels?.modifier); const save = s.activities?.getByType?.("save")?.[0]?.save;
      const saveAb = save?.ability?.size === 1 ? loc(D.abilities?.[save.ability.first()]?.abbreviation ?? "") : save?.ability?.size ? loc("DND5E.AbbreviationDC") : "";
      const roll = i.hasAttack && Number.isFinite(toHit) ? (toHit >= 0 ? `+${toHit}` : `−${Math.abs(toHit)}`) : saveAb ? `${saveAb} ${save?.dc?.value ?? ""}`.trim() : "";
      const prepares = methods[s.method]?.prepares && !linked;
      const always = s.prepared === states.always?.value;
      const prep = prepares ? { state: always ? "always" : s.prepared ? "prepared" : "unprepared", label: loc(states[always ? "always" : s.prepared ? "prepared" : "unprepared"]?.label ?? "") } : null;
      let source = linked?.name;
      if (!source && s.sourceItem) source = a.identifiedItems?.get?.(s.sourceItem)?.first?.()?.name;
      if (!source) { const [id] = String(i.getFlag?.("dnd5e", "advancementOrigin") ?? "").split("."); source = id ? a.items.get(id)?.name : undefined; }
      book[key].rows.push({
        ...(await this.bookRow(i)), level: s.level, method: s.method, school: s.school, classId: s.classIdentifier, linkedName: linked?.name ?? "",
        prepared: !!(s.canPrepare && s.prepared), prep,
        subtitle: [source, i.labels?.components?.vsm].filter(Boolean).join(" • "),
        cols: { activation: ab ? `${cost}${loc(ab)}` : (i.labels?.activation ?? ""), range, target: i.labels?.target ?? "", roll }
      });
    }
    const casting = Object.values(a.spellcastingClasses ?? {}).sort((x, y) => (y.system?.levels ?? 0) - (x.system?.levels ?? 0)).map(c => {
      const sc = c.spellcasting ?? {}; const own = c.system?.spellcasting?.progression === sc.progression;
      const name = own ? c.name : c.subclass?.name ?? c.name;
      return { label: (() => { try { return game.i18n.format("DND5E.SpellcastingClass", { class: name }); } catch { return `${name} spellcasting`; } })(),
        ability: sc.ability, abilityLabel: loc(D.abilities?.[sc.ability]?.abbreviation ?? sc.ability ?? ""), mod: a.system?.abilities?.[sc.ability]?.mod ?? 0,
        attack: sc.attack, save: sc.save, prepared: sc.preparation, primary: a.system?.attributes?.spellcasting === sc.ability,
        filter: { key: own ? c.identifier : c.subclass?.identifier, label: name } };
    });
    return {
      casting, sections: Object.values(book).sort((x, y) => x.order - y.order),
      schools: Object.entries(D.spellSchools ?? {}).map(([k, v]) => ({ key: k, label: loc(v?.label ?? k) })),
      classFilters: casting.map(c => c.filter).filter(x => x.key),
      editable: this.isEditable, edit: this._mode === "edit", search: this._spell.search, filters: this._spell.filters, sort: this._spell.sort
    };
  }

  // ---------------------------------------------------------------- slice 4: Effects, Biography, Bastion, Special traits facts
  /** Enriched HTML the way dnd5e's sheet enriches its text (secrets for owners, relative to the actor, its roll data). */
  async enrich(html) {
    const TE = foundry.applications.ux?.TextEditor?.implementation ?? /** @type {any} */ (globalThis).TextEditor;
    try { return await TE.enrichHTML(html ?? "", { secrets: this.actor.isOwner, relativeTo: this.actor, rollData: this.actor.getRollData?.() }); } catch { return ""; }
  }

  /** The Effects page's facts, as dnd5e's `_prepareEffectsContext` and `EffectsElement.prepareCategories` prepare them. */
  async effectsFacts() {
    const a = this.actor; const D = CONFIG.DND5E ?? {}; const loc = WctCharacterSheet.loc;
    const staticID = id => (id.length >= 16 ? id.substring(0, 16) : id.padEnd(16, "0"));
    const conditionIds = new Set();
    const conditions = Object.entries(D.conditionTypes ?? {}).filter(([, c]) => !c?.pseudo).map(([k, c]) => {
      const id = staticID(`dnd5e${k}`); conditionIds.add(id);
      const existing = a.effects?.get?.(id);
      const levels = Number.isFinite(c?.levels);
      return { id: k, name: loc(c?.name ?? k), img: existing?.img ?? c?.img, active: existing ? !existing.disabled : false,
        level: levels ? (a.system?.conditions?.[k] ?? 0) : null, reference: c?.reference };
    });
    const conc = a.concentration?.effects ?? new Set();
    const concentrating = CONFIG.specialStatusEffects?.CONCENTRATING ?? "concentrating";
    const rows = [];
    for (const e of a.allApplicableEffects?.() ?? []) {
      const cat = SX.effectCategory({ concealed: e.isConcealed, condition: e.type === "condition", concentrating: e.statuses?.has?.(concentrating),
        appliedEnchantment: e.isAppliedEnchantment, enchantment: e.type === "enchantment", expired: e.duration?.expired, suppressed: e.isSuppressed, disabled: e.disabled, temporary: e.isTemporary });
      if (!cat) continue;
      if (conditionIds.has(e.id) && !e.duration?.remaining) continue;
      /** @type {any} */
      let ctx = {}; try { ctx = await e.getSheetContext(); } catch { ctx = {}; }
      let src = ctx.source;
      if (src instanceof ActiveEffect) { const t = src.target; src = (t instanceof Item && t.parent && t.parent !== a) ? t.parent : t; }
      const expanded = this.expandedSections.get(`effects.${e.id}`) === true;
      let summary = null;
      if (expanded) { try { summary = await foundry.applications.handlebars.renderTemplate("systems/dnd5e/templates/effects/parts/effect-summary.hbs", await e.getPreviewContext({ secrets: e.isOwner })); } catch { summary = null; } }
      rows.push({
        id: e.id, uuid: e.uuid, parentId: e.target === e.parent ? null : e.parent?.id ?? null, name: e.name, img: e.img, cat, disabled: !!e.disabled, toggleable: !conc.has?.(e),
        source: src ? { name: src.name, uuid: src.uuid, item: src instanceof Item } : null,
        duration: ctx.durationParts ?? [], durationIcon: ctx.durationIcon, showDuration: !!ctx.showDuration, expanded: summary,
        changes: (ctx.changes ?? []).map(c => ({ name: String(c.name ?? c.key ?? ""), value: String(c.value ?? "") }))
      });
    }
    return { effects: rows, conditions, editable: this.isEditable, edit: this._mode === "edit", search: this._fx.search };
  }

  /** The Biography page's facts (dnd5e's `_prepareBiographyContext` and its text boxes). */
  async biographyFacts() {
    const a = this.actor; const loc = WctCharacterSheet.loc; const det = a.system?.details ?? {}; const src = a._source?.system?.details ?? {};
    const fields = a.system?.schema?.fields?.details?.fields ?? {};
    return {
      characteristics: SX.CHARACTERISTICS.map(k => ({ key: k, label: loc(fields[k]?.label ?? k) || k, value: det[k] ?? "", source: src[k] ?? "" })),
      text: Object.fromEntries(SX.TEXTBOXES.map(t => [t.key, det[t.key] ?? ""])),
      biography: { enriched: await this.enrich(det.biography?.value), source: src.biography?.value ?? "" },
      uuid: a.uuid, editable: this.isEditable, edit: this._mode === "edit"
    };
  }

  /** The Bastion page's facts (dnd5e's `_prepareBastionContext` and `_prepareItemFacility`). */
  async bastionFacts() {
    const a = this.actor; const D = CONFIG.DND5E ?? {}; const loc = WctCharacterSheet.loc;
    const occ = async occupants => Promise.all(Array.from({ length: Number(occupants?.max) || 0 }, async (_, index) => {
      const uuid = occupants?.value?.[index]; if (!uuid) return { empty: true, index };
      const act = await fromUuid(uuid).catch(() => null); return { index, uuid, name: act?.name ?? "", img: act?.img ?? "" };
    }));
    const defenders = []; const basic = []; const special = [];
    for (const f of a.itemTypes?.facility ?? []) {
      const s = f.system ?? {};
      const sub = [s.building?.built ? loc(D.facilities?.sizes?.[s.size]?.label ?? s.size ?? "") : loc("DND5E.FACILITY.Build.Unbuilt")];
      if (s.trade?.stock?.max) sub.push(`${s.trade.stock.value ?? 0} / ${s.trade.stock.max}`);
      const craft = s.craft?.item ? await fromUuid(s.craft.item).catch(() => null) : null;
      const pending = await Promise.all((s.trade?.pending?.creatures ?? []).map(async (uuid, index) => { const act = await fromUuid(uuid).catch(() => null); return { index, uuid, name: act?.name, img: act?.img, pending: true }; }));
      const fact = {
        id: f.id, name: f.name, img: f.img, subtitle: sub.map(String).join(" • "), built: !!s.building?.built, disabled: !!s.disabled,
        special: s.type?.value === "special", free: !!s.free, progress: s.progress?.max ? { value: s.progress.value, max: s.progress.max, pct: s.progress.pct } : null,
        order: s.progress?.order ? loc(D.facilities?.orders?.[s.progress.order]?.label ?? s.progress.order) : "",
        craft: craft ? { uuid: craft.uuid, name: craft.name, img: craft.img } : null,
        hirelings: await occ(s.hirelings), defenders: await occ(s.defenders), creatures: [...pending, ...(await occ(s.trade?.creatures))]
      };
      for (const d of fact.defenders) if (d.uuid) defenders.push({ uuid: d.uuid, name: d.name, img: d.img, facility: f.id, index: d.index });
      (fact.special ? special : basic).push(fact);
    }
    const lvl = a.system?.details?.level ?? 0; const adv = D.facilities?.advancement ?? {};
    return {
      name: a.system?.bastion?.name ?? "", nameSource: a._source?.system?.bastion?.name ?? "", defenders,
      basic: { chosen: basic, ...SX.facilitySlots("basic", basic, SX.facilitiesAt(adv.basic, lvl)) },
      special: { chosen: special, ...SX.facilitySlots("special", special, SX.facilitiesAt(adv.special, lvl)) },
      description: { enriched: await this.enrich(a.system?.bastion?.description), source: a._source?.system?.bastion?.description ?? "" },
      uuid: a.uuid, editable: this.isEditable, edit: this._mode === "edit"
    };
  }

  /** The Special traits page's facts (dnd5e's `_prepareSpecialTraitsContext`: original class, character flags, global bonuses). */
  specialFacts() {
    const a = this.actor; const D = CONFIG.DND5E ?? {}; const loc = WctCharacterSheet.loc;
    const edit = this._mode === "edit" && this.isEditable; const source = edit ? a._source : a;
    const flags = source?.flags?.dnd5e ?? {};
    /** @type {Record<string, any[]>} */
    const sections = {};
    for (const [key, c] of Object.entries(D.characterFlags ?? {})) {
      const value = foundry.utils.getProperty(flags, key);
      if (c?.deprecated && !value) continue;
      const type = c?.type === Boolean ? "boolean" : c?.type === Number ? "number" : "string";
      (sections[loc(c?.section ?? "")] ??= []).push({ name: `flags.dnd5e.${key}`, label: loc(c?.name ?? key), hint: loc(c?.hint ?? ""), type, value });
    }
    const globals = [];
    const add = (field, checkName = false) => {
      if (!field) return;
      if (field.fields && !(field instanceof foundry.data.fields.StringField)) return Object.values(field.fields).forEach(f => add(f, checkName));
      if (checkName && field.name !== "bonus") return;
      globals.push({ name: field.fieldPath, label: loc(field.label ?? field.name) || field.fieldPath, hint: loc(field.hint ?? ""), type: "string", value: foundry.utils.getProperty(source, field.fieldPath) ?? "" });
    };
    add(a.system?.schema?.fields?.bonuses); add(a.system?.schema?.fields?.rolls, true);
    if (globals.length) sections[loc("DND5E.BONUSES.FIELDS.bonuses.label") || "Global bonuses"] = globals;
    return {
      classes: Object.values(a.classes ?? {}).map(c => ({ value: c.id, label: c.name })).sort((x, y) => x.label.localeCompare(y.label, game.i18n?.lang)),
      originalClass: a.system?.details?.originalClass ?? "", classHint: loc("DND5E.ClassMakeOriginalHint"),
      sections: Object.entries(sections).map(([label, fields]) => ({ label, fields })), editable: this.isEditable, edit: this._mode === "edit"
    };
  }

  /** The built page's body HTML, or null (placeholder pages). */
  async pageBody(page) {
    if (page === "character") return SP.characterPageHTML(await this.characterFacts());
    if (page === "details") return SP.detailsPageHTML(/** @type {any} */ (this.detailsFacts()));
    if (page === "inventory") return SP.inventoryPageHTML(await this.inventoryFacts());
    if (page === "features") return BM.featuresPageHTML(await this.featuresFacts());
    if (page === "spells") return BM.spellsPageHTML(/** @type {any} */ (await this.spellsFacts()));
    if (page === "effects") return SX.effectsPageHTML(await this.effectsFacts());
    if (page === "biography") return SX.biographyPageHTML(await this.biographyFacts());
    if (page === "bastion") return SX.bastionPageHTML(/** @type {any} */ (await this.bastionFacts()));
    if (page === "special") return SX.specialPageHTML(/** @type {any} */ (this.specialFacts()));
    // 2.2: Renown (renown-apps.mjs builds it from the world setting, the actor flag and, for GMs, the GM-only store).
    if (page === "reputation") return RenownUI.pageBody(this.actor, this._rn, { edit: this._mode === "edit" && game.user.isGM });
    return null;
  }

  /** The context a guest page's render / activate gets (2.3; docs/scripting.md › Sheet pages). No way to write toolkit data. */
  guestContext() {
    return { actor: this.actor, mode: this._mode === "edit" && this.isEditable ? "edit" : "play", editable: !!this.isEditable, root: this.element ?? null };
  }

  /** A guest page's body through core's renderGuest (try/catch, time limit): `{ html, element }`, the error line on failure. */
  async guestBody(page) {
    const def = PAGE_HOST.get(page);
    if (!def?.guest) return { html: SM.guestErrorHTML(page, "the page is no longer registered"), element: null };
    const r = await renderGuest(/** @type {any} */ (def), this.guestContext(), { timeoutMs: GUEST_RENDER_MS });
    if ("error" in r) { console.warn(`${ID} | character sheet: page ${def.id}`, r.error); return { html: SM.guestErrorHTML(String(def.label), r.error), element: null }; }
    if ("element" in r) return { html: "", element: r.element };
    return { html: r.html, element: null };
  }

  async _renderHTML() {
    const view = SM.sheetView(this.facts(), { mode: /** @type {any} */ (this._mode), page: this._page });
    this._page = view.page;
    /** @type {string | null} */
    let body = null;
    /** @type {any} */
    let guestEl = null;
    if (!view.limited && SM.isGuestPage(view.page)) ({ html: body, element: guestEl } = await this.guestBody(view.page));
    else if (!view.limited && SM.BUILT_PAGES.includes(view.page)) {
      try { body = await this.pageBody(view.page); } catch (e) {
        console.error(`${ID} | character sheet: ${view.page} page`, e);
        body = `<p class="wct-cs-dim">This page couldn't be drawn (${esc(e?.message ?? e)}). The system sheet below still works.</p>`;
      }
    }
    const div = document.createElement("div");
    div.innerHTML = SM.sheetHTML(view, body);
    if (guestEl) div.querySelector(".wct-cs-guest")?.append(guestEl);
    return div.firstElementChild;
  }

  _replaceHTML(result, content) {
    const scroll = content.querySelector(".wct-cs-page")?.scrollTop ?? 0;
    content.replaceChildren(result);
    const page = content.querySelector(".wct-cs-page"); if (page && scroll) page.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- actions (this = the sheet)
  static #systemSheet(event, target) { if (game.user.isGM || target?.dataset?.page) openSystemSheet(this.actor, target?.dataset?.page ?? ""); }
  static #mode(event, target) { return this.changeMode(target.dataset.mode === "edit" ? "edit" : "play"); }
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
      case "spellSlots": return open(C.SpellSlotsConfig);
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

  // ---------------------------------------------------------------- slice 3 actions
  /** Add class / subclass: dnd5e's compendium browser, filtered as its sheet's `findItem` filters it; the pick goes through dnd5e's drop. */
  static async #findItem(event, target) {
    if (!this.isEditable) return;
    const CB = /** @type {any} */ (globalThis).dnd5e?.applications?.CompendiumBrowser; if (!CB?.selectOne) return ui.notifications.warn("dnd5e's compendium browser isn't available.");
    const { classIdentifier, facilityType, itemType: type } = target.dataset;
    /** @type {any} */
    const filters = { locked: { types: new Set([type]) } };
    if (classIdentifier) filters.locked.additional = { class: { [classIdentifier]: 1 } };
    if (type === "class") {
      filters.initial = { additional: { properties: { sidekick: -1 } } };
      filters.locked.arbitrary = [{ o: "NOT", v: { k: "system.identifier", o: "in", v: new Set(Object.keys(this.actor.classes ?? {})) } }];
    }
    if (type === "facility") {
      const other = facilityType === "basic" ? "special" : "basic";
      filters.locked.additional = { type: { [facilityType]: 1, [other]: -1 }, level: { max: this.actor.system.details.level } };
    }
    const result = await CB.selectOne({ filters });
    if (!result) return;
    const host = this.dnd5eHost(); if (!host) return;
    // The drop helper's tab is set for this pick (classes / subclasses → Features, facilities → Bastion), never left from the last drop.
    host.tabGroups = { ...(host.tabGroups ?? {}), primary: type === "facility" ? "bastion" : "features" };
    await host._onDropCreateItems(event, [game.items.fromCompendium(await fromUuid(result), { keepId: true })]);
  }

  /** Deletes a class or subclass with dnd5e's own dialog (its advancement question included). */
  static async #deleteItem(event, target) {
    if (!this.isEditable) return;
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    return item?.deleteDialog({ sheet: this });
  }

  /** The spellcasting card's radio: dnd5e's `setSpellcastingAbility` (writes system.attributes.spellcasting). */
  static async #spellAbility(event, target) {
    if (!this.isEditable) return;
    const ability = target.closest("[data-ability]")?.dataset.ability;
    if (ability) await this.actor.update({ "system.attributes.spellcasting": ability });
  }

  /** A spell slot pip: dnd5e's `togglePip` rule on `system.spells.<key>.value`. */
  static async #pip(event, target) {
    if (!this.isEditable) return;
    const prop = target.closest("[data-prop]")?.dataset.prop; if (!prop) return;
    const v = BM.pipTarget(foundry.utils.getProperty(this.actor, prop), target.dataset.n);
    await this.actor.update({ [prop]: v });
  }

  /** Edit mode, Features: dnd5e's create dialog with its Features tab types. */
  static #createFeature() {
    if (!this.isEditable) return;
    const types = ["feat", "race", "background", "class", "subclass"].filter(t => !CONFIG.Item?.dataModels?.[t]?.metadata?.singleton || !this.actor.itemTypes?.[t]?.length);
    return Item.implementation.createDialog({}, { types, parent: this.actor }, { sheet: this });
  }

  /** Edit mode, Spells: a new spell, as dnd5e's Spells tab create button. */
  static #createSpell() {
    if (!this.isEditable) return;
    return Item.implementation.create({ type: "spell", name: game.i18n.format("DOCUMENT.New", { type: game.i18n.localize(CONFIG.Item.typeLabels.spell) }) }, { parent: this.actor, renderSheet: true });
  }

  /**
   * Features and Spells lists: live search, chips, sort and grouping (per window), item tooltips, keyboard on names, class level
   * selects (dnd5e's level change with its advancement manager).
   * @param {HTMLElement} root @param {"_feat" | "_spell"} stateKey
   */
  _onRenderBook(root, stateKey) {
    const a = this.actor; const st = this[stateKey];
    const search = /** @type {HTMLInputElement | null} */ (root.querySelector("[data-wct-search]"));
    search?.addEventListener("input", () => {
      st.search = search.value; let any = false;
      for (const sec of root.querySelectorAll(".wct-cs-sec")) {
        let shown = 0;
        for (const li of sec.querySelectorAll("li[data-item-id]")) {
          const ok = li.getAttribute("data-wct-chips") !== "0" && SP.nameMatches(li.getAttribute("data-item-name"), search.value);
          /** @type {HTMLElement} */ (li).hidden = !ok; if (ok) shown++;
        }
        if (!sec.querySelector(".wct-cs-slots, [data-config=spellSlots]")) /** @type {HTMLElement} */ (sec).hidden = !shown;
        if (shown) any = true;
      }
      const none = /** @type {HTMLElement | null} */ (root.querySelector(".wct-cs-nomatch")); if (none) none.hidden = any || !root.querySelector(".wct-cs-sec");
    });
    search?.addEventListener("change", ev => ev.stopPropagation());
    search?.addEventListener("keydown", ev => ev.stopPropagation());
    root.querySelectorAll("[data-wct-filter]").forEach(b => b.addEventListener("click", () => {
      const k = /** @type {HTMLElement} */ (b).dataset.wctFilter ?? ""; const f = new Set(st.filters);
      if (f.has(k)) f.delete(k); else f.add(k);
      st.filters = [...f]; this.render();
    }));
    root.querySelector("[data-wct-sort]")?.addEventListener("click", ev => { st.sort = /** @type {HTMLElement} */ (ev.currentTarget).dataset.wctSort ?? st.sort; this.render(); });
    root.querySelector("[data-wct-group]")?.addEventListener("click", ev => { if ("group" in st) st.group = /** @type {HTMLElement} */ (ev.currentTarget).dataset.wctGroup ?? "origin"; this.render(); });
    root.querySelectorAll(".wct-cs-inv li[data-item-id] .wct-cs-ico, .wct-cs-class .wct-cs-ico").forEach(el => {
      const item = a.items.get(el.closest("[data-item-id]")?.getAttribute("data-item-id"));
      el.addEventListener("pointerenter", () => Pane.itemTooltip(a, /** @type {HTMLElement} */ (el), item));
      el.addEventListener("pointerleave", () => game.tooltip?.deactivate?.());
    });
    root.querySelectorAll(".wct-cs-inv .wct-cs-nm[data-action]").forEach(el => el.addEventListener("keydown", ev => {
      const k = /** @type {KeyboardEvent} */ (ev).key; if (k !== "Enter" && k !== " ") return;
      ev.preventDefault(); /** @type {HTMLElement} */ (el).click();
    }));
    // Class level: dnd5e's own level change (advancement manager when advancements apply, its level-down confirmation).
    root.querySelectorAll("select[data-wct-level]").forEach(sel => sel.addEventListener("change", async ev => {
      ev.stopPropagation(); if (!this.isEditable) return;
      const el = /** @type {HTMLSelectElement} */ (ev.currentTarget);
      return this.changeLevel(a.items.get(el.dataset.wctLevel), Number(el.value));
    }));
  }

  /**
   * A class's level change, exactly as dnd5e's sheet does it (`#changeLevel`): its AdvancementManager (as a child of this sheet) when
   * advancements apply, its level-down confirmation, else a plain `system.levels` update. Used by the Features page's level selects
   * and the title band's Level up.
   * @param {any} cls @param {number} delta
   */
  async changeLevel(cls, delta) {
    const a = this.actor;
    if (!this.isEditable || !delta || !cls) return;
    const A = /** @type {any} */ (globalThis).dnd5e?.applications?.advancement ?? {};
    if (!game.settings.get("dnd5e", "disableAdvancements") && A.AdvancementManager) {
      const manager = A.AdvancementManager.forLevelChange(a, cls.id, delta);
      if (manager.steps.length) {
        if (delta > 0) return this._renderChild(manager);
        // dnd5e: removing advancements runs the manager; declining them still lowers the level; closing the dialog cancels.
        try { if (await A.AdvancementConfirmationDialog?.forLevelDown(cls, { sheet: this })) return this._renderChild(manager); } catch { return this.render(); }
      }
    }
    return cls.update({ "system.levels": cls.system.levels + delta });
  }

  // ---------------------------------------------------------------- slice 4 actions
  /**
   * Title band level medallion (edit mode): level up. One class: dnd5e's level change for it (advancement manager). Several: a
   * small chooser (each class one level up, or a new class through dnd5e's compendium browser). At dnd5e's maximum level: a notice.
   */
  static async #levelUp(event, target) {
    if (!this.isEditable) return;
    const a = this.actor;
    const classes = Object.values(a.classes ?? {}).sort((x, y) => (y.system?.levels ?? 0) - (x.system?.levels ?? 0));
    const pick = SX.levelUpChoices(classes.map(c => ({ id: c.id, name: c.name, levels: c.system?.levels })), a.system?.details?.level, CONFIG.DND5E?.maxLevel ?? 20);
    if (pick.atMax) return ui.notifications.info(`${a.name} is at the highest level.`);
    if (pick.classes.length === 1) return this.changeLevel(a.items.get(pick.classes[0].id), 1);
    const buttons = [...pick.classes.map(c => ({ action: c.id, label: `${c.name} ${c.next}`, icon: "fa-solid fa-arrow-up" })), { action: "wctNewClass", label: "Add a class", icon: "fa-solid fa-plus" }];
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: "Level up", icon: "fa-solid fa-arrow-up" }, classes: ["wct-dialog", ...UI_CLASSES],
      content: `<p>Which class gains a level?</p>`, buttons, rejectClose: false
    });
    if (!choice) return;
    if (choice === "wctNewClass") return WctCharacterSheet.#findItem.call(this, event, /** @type {any} */ ({ dataset: { itemType: "class" } }));
    return this.changeLevel(a.items.get(choice), 1);
  }

  /** Opens a document by uuid (bastion occupants, crafted items), as dnd5e's showDocument. */
  static async #showUuid(event, target) {
    const uuid = target.closest("[data-uuid]")?.dataset.uuid; if (!uuid) return;
    const doc = await fromUuid(uuid).catch(() => null);
    if (!doc?.testUserPermission?.(game.user, "LIMITED")) return ui.notifications.warn("You can't view that.");
    return this._renderChild(doc.sheet);
  }

  /** A facility's name: dnd5e's `useFacility` (its order activities). */
  static #useFacility(event, target) {
    if (!this.isEditable) return;
    const f = this.actor.items.get(target.closest("[data-facility-id]")?.dataset.facilityId);
    return f?.use({ legacy: false, chooseActivity: true, event });
  }

  /** Removes a bastion occupant, or cancels a pending trade with dnd5e's own question (its `deleteOccupant`). */
  static async #deleteOccupant(event, target) {
    if (!this.isEditable) return;
    const f = this.actor.items.get(target.closest("[data-facility-id]")?.dataset.facilityId);
    const prop = target.closest("[data-prop]")?.dataset.prop; const index = target.closest("[data-index]")?.dataset.index;
    if (!f || !prop || index === undefined || index === "") return;
    if (target.closest(".occupant-slot.pending")) {
      const ok = await foundry.applications.api.DialogV2.confirm({ content: `<p><strong>${WctCharacterSheet.loc("COMMON.AreYouSure")}</strong> ${WctCharacterSheet.loc("DND5E.Bastion.Trade.Invalid")}</p>`,
        window: { icon: "fa-solid fa-coins", title: "DND5E.Bastion.Trade.Cancel" }, position: { width: 400 }, classes: ["wct-dialog", ...UI_CLASSES] }, { rejectClose: false });
      if (ok) await f.update({ system: { progress: { max: null, order: "", value: null }, trade: { pending: { creatures: [], operation: null } } } });
      return;
    }
    const { value } = foundry.utils.getProperty(f, prop) ?? { value: [] };
    return f.update({ [`${prop}.value`]: value.filter((_, i) => i !== Number(index)) });
  }

  /** Edit mode, Effects: a new effect on the actor, as dnd5e's sheet's create button on its Effects tab. */
  static #createEffect() {
    if (!this.isEditable) return;
    return ActiveEffect.implementation.create({ name: WctCharacterSheet.loc("DND5E.EFFECT.New"), img: "icons/svg/aura.svg" }, { parent: this.actor, renderSheet: true });
  }

  // ---------------------------------------------------------------- slice 2 listeners
  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element?.querySelector(".wct-cs"); if (!root) return;
    const ed = this.isEditable; const a = this.actor;
    // Changed fields (ability scores, size, skill abilities, coins): one actor update each, dnd5e's delta input rule for numbers.
    root.querySelectorAll("input[data-name], select[data-name]").forEach(el => {
      if (el.closest("dnd5e-inventory")) return; // dnd5e's inventory element handles its own quantity / uses inputs
      if (el.closest(".wct-cs-guest")) return; // 2.3: another module's page wires its own fields
      if (el.matches("[data-wct-check]")) return; // checkboxes: _onRenderText
      el.addEventListener("change", async ev => {
        ev.stopPropagation(); if (!ed) return;
        const t = /** @type {HTMLInputElement} */ (ev.currentTarget); const path = t.dataset.name; if (!path) return;
        if (t.tagName === "SELECT") return a.update({ [path]: t.value });
        // Text fields (characteristics, bastion name, special-trait text and bonus formulas) are saved as typed; numbers take dnd5e's deltas.
        if (t.classList.contains("wct-cs-tin") && t.inputMode !== "numeric") return a.update({ [path]: t.value });
        // An emptied dnd5e flag (crit threshold, …) is unset, as dnd5e's sheet deletes empty flags on submit.
        if (SX.isClearedFlag(path, t.value)) { t.value = ""; return a.update({ [SX.unsetPath(path)]: null }); }
        const v = SP.parseDelta(t.value, foundry.utils.getProperty(a._source ?? a, path) ?? foundry.utils.getProperty(a, path));
        if (v === null) return;
        t.value = String(v);
        return a.update({ [path]: v });
      });
      el.addEventListener("focus", () => /** @type {HTMLInputElement} */ (el).select?.());
    });
    // Proficiency marks in edit mode: dnd5e's own <proficiency-cycle> element (cycles 0 → 1 → ½ → 2, or 0 → 1 for saves).
    root.querySelectorAll("proficiency-cycle[data-wct-prof]").forEach(el => !el.closest(".wct-cs-guest") && el.addEventListener("change", ev => {
      ev.stopPropagation(); if (!ed) return;
      const t = /** @type {any} */ (ev.currentTarget); return a.update({ [t.dataset.wctProf]: Number(t.value) });
    }));
    root.querySelector("[data-wct-tokport]")?.addEventListener("change", ev => { ev.stopPropagation(); if (ed) a.update({ "flags.dnd5e.showTokenPortrait": !!(/** @type {HTMLInputElement} */ (ev.currentTarget).checked) }); });
    if (this._page === "character") this._onRenderCharacter(root);
    if (this._page === "inventory") this._onRenderInventory(root);
    if (this._page === "features") this._onRenderBook(root, "_feat");
    if (this._page === "spells") this._onRenderBook(root, "_spell");
    if (this._page === "effects") this._onRenderEffects(root);
    if (["biography", "bastion", "special"].includes(this._page)) this._onRenderText(root);
    if (this._page === "reputation") RenownUI.wire(root, a, this);
    if (SM.isGuestPage(this._page)) this._onRenderGuest(root);
  }

  /** 2.3: a guest page's activate(ctx) after its body is in the sheet (`element` = its container; errors are logged only). */
  async _onRenderGuest(root) {
    const def = PAGE_HOST.get(this._page); if (!def?.guest) return;
    const element = root.querySelector(".wct-cs-guest"); if (!element) return;
    if (element.querySelector(".wct-cs-guest-error")) return; // its render failed: nothing to wire
    // The sheet is a form that never submits: Enter in a guest's text field must not submit it (the guest's own key listeners still run).
    element.addEventListener("keydown", ev => { const t = /** @type {any} */ (ev.target); if (ev.key === "Enter" && t?.tagName === "INPUT") ev.preventDefault(); });
    const r = await activateGuest(/** @type {any} */ (def), { ...this.guestContext(), element, refresh: () => this.render() });
    if ("error" in r) console.warn(`${ID} | character sheet: page ${def.id} activate`, r.error);
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
        const ask = PM.askOf(r); if (ask) this._showPop(null, Pane.askSlotMenu(a, /** @type {any} */ (r).item, ask));
      });
    }
    root.querySelectorAll(".wct-cs-slot.wct-slot").forEach(el => {
      el.addEventListener("click", ev => { ev.stopPropagation(); const m = Pane.slotMenu(a, el); if (m) this._showPop(el, m); });
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); ev.stopPropagation(); const i = el.classList.contains("filled") ? itemOf(el) : null; if (i) Pane.unslotItem(i); });
    });
    const equip = async (el, item) => { const r = await Pane.autoEquip(a, item); const ask = PM.askOf(r); if (ask) this._showPop(el, Pane.askSlotMenu(a, item, ask)); };
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

  /** Effects page: live search. Everything else is dnd5e's effects element (toggle, edit, delete, expand, conditions, context menu). */
  _onRenderEffects(root) {
    const search = /** @type {HTMLInputElement | null} */ (root.querySelector("[data-wct-search]"));
    search?.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase(); this._fx.search = search.value; let any = false;
      for (const sec of root.querySelectorAll(".wct-cs-sec")) {
        let shown = 0;
        for (const li of sec.querySelectorAll("li[data-effect-id]")) { const ok = !q || String(li.getAttribute("data-item-name")).toLowerCase().includes(q); /** @type {HTMLElement} */ (li).hidden = !ok; if (ok) shown++; }
        /** @type {HTMLElement} */ (sec).hidden = !!q && !shown; if (shown) any = true;
      }
      const none = /** @type {HTMLElement | null} */ (root.querySelector(".wct-cs-nomatch")); if (none) none.hidden = !q || any;
    });
    search?.addEventListener("change", ev => ev.stopPropagation());
    search?.addEventListener("keydown", ev => ev.stopPropagation());
  }

  /**
   * Biography, Bastion and Special traits: checkboxes and text areas write their `data-name` path; Foundry's prose-mirror editors
   * save their `name` path on save (as on dnd5e's sheet, through a document update rather than the form).
   */
  _onRenderText(root) {
    const a = this.actor;
    root.querySelectorAll("textarea[data-name], input[data-wct-check]").forEach(el => el.addEventListener("change", ev => {
      ev.stopPropagation(); if (!this.isEditable) return;
      const t = /** @type {HTMLInputElement} */ (ev.currentTarget); const path = t.dataset.name; if (!path) return;
      return a.update({ [path]: t.type === "checkbox" ? t.checked : t.value });
    }));
    root.querySelectorAll("prose-mirror[data-wct-prose]").forEach(el => el.addEventListener("save", ev => {
      ev.stopPropagation(); if (!this.isEditable) return;
      const t = /** @type {any} */ (ev.currentTarget);
      return a.update({ [t.dataset.wctProse]: t.value });
    }));
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
    host.tabGroups = { ...(host.tabGroups ?? {}), primary: ["inventory", "features", "spells", "effects", "bastion"].includes(this._page) ? this._page : "details" };
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
  if (!r || PM.askOf(r)) { if (!item.system.equipped) await item.update({ "system.equipped": true }); }
  return r;
}

/**
 * 2.3.1: the toolkit sheet has no favourites bar, so dnd5e's Favorite / Remove Favorite context menu entries are dropped there
 * (items, effects, activities). dnd5e's own sheet keeps them. The item and effect hooks don't say which sheet the menu is on, so
 * one capture listener on the document notes whether the latest contextmenu event (a right-click, or dnd5e's ⋮ button, which
 * dispatches one) started inside a toolkit sheet; the hooks run while dnd5e opens that same menu. Called from init while
 * `characterSheet` is on (once).
 */
let favouriteHooks = false;
let menuOnSheet = false;
export function registerFavouriteFilter() {
  if (favouriteHooks) return; favouriteHooks = true;
  document.addEventListener("contextmenu", ev => { menuOnSheet = SM.onToolkitSheet(ev.target); }, { capture: true });
  const labels = () => SM.FAVOURITE_LABELS.map(k => { try { return game.i18n.localize(k); } catch { return k; } });
  const drop = (/** @type {unknown} */ items, /** @type {boolean} */ here) => { if (here) SM.dropFavourites(items, labels()); };
  Hooks.on("dnd5e.getItemContextOptions", (_item, items) => drop(items, menuOnSheet));
  Hooks.on("dnd5e.getActiveEffectContextOptions", (_effect, items) => drop(items, menuOnSheet));
  Hooks.on("dnd5e.getItemActivityContext", (_activity, target, items) => drop(items, SM.onToolkitSheet(target) || menuOnSheet));
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
