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
import { restedTip } from "./pane-model.mjs";
import { BENEFITS } from "./inn-model.mjs";
import { on as featureOn } from "./features.mjs";
import { UI_CLASSES, defineOpenKeybinding, keybindingConfig } from "../vendor/wanderers-core/index.mjs";
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
    actions: {
      wctSystemSheet: WctCharacterSheet.#systemSheet,
      wctMode: WctCharacterSheet.#mode,
      wctPage: WctCharacterSheet.#page,
      wctInspiration: WctCharacterSheet.#inspiration,
      wctShortRest: WctCharacterSheet.#shortRest,
      wctLongRest: WctCharacterSheet.#longRest,
      wctInitiative: WctCharacterSheet.#initiative,
      wctDeathSave: WctCharacterSheet.#deathSave,
      wctExhaustion: WctCharacterSheet.#exhaustion
    }
  };

  /** "play" | "edit", per window (not saved). */
  _mode = "play";
  /** The bookmark shown, per window (not saved). */
  _page = "character";

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

  async _renderHTML() {
    const view = SM.sheetView(this.facts(), { mode: /** @type {any} */ (this._mode), page: this._page });
    this._page = view.page;
    const div = document.createElement("div");
    div.innerHTML = SM.sheetHTML(view);
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
