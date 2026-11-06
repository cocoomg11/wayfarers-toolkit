/**
 * Renown (feature `renown`): the windows. The Reputation page's wiring (shared by the toolkit character sheet's Reputation bookmark
 * and the standalone Reputation window that dnd5e's own sheet opens from its header), the GM's Award renown window and the
 * Factions and renown setup window. Data and writes: renown.mjs; HTML of the page and card: renown-view-model.mjs.
 */
import * as R from "./renown-model.mjs";
import * as RV from "./renown-view-model.mjs";
import * as Renown from "./renown.mjs";
import { UI_CLASSES, esc } from "../vendor/wanderers-core/index.mjs";

const ID = "wayfarers-toolkit";
const AppV2 = /** @type {any} */ (globalThis).foundry?.applications?.api?.ApplicationV2 ?? class { };

// ---------------------------------------------------------------- the page (sheet bookmark and standalone window)
/**
 * The page's HTML for an actor on this client. `state`: the window's page state; `edit`: GM edit mode (score fields).
 * @param {any} actor @param {any} state @param {{ edit?: boolean }} [o]
 */
export function pageBody(actor, state, { edit = false } = {}) {
  const facts = {
    factions: Renown.factions(), config: Renown.config(), entries: Renown.entriesFor(actor), tracked: Renown.actorData(actor).tracked,
    isGM: !!game.user?.isGM, canTrack: !!actor.isOwner, edit, name: actor.name
  };
  return RV.pageHTML(RV.pageModel(facts, state));
}

/**
 * Wires the page's controls. `host` keeps the page state (`host._rn`) and is re-rendered after a change; `actor` is the character.
 * @param {HTMLElement} root @param {any} actor @param {any} host
 */
export function wire(root, actor, host) {
  const st = (host._rn ??= RV.pageState());
  const redraw = () => host.render();
  const search = /** @type {HTMLInputElement | null} */ (root.querySelector("[data-wct-rn-search]"));
  if (search) {
    if (host._rnFocus) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); host._rnFocus = false; }
    let t = /** @type {any} */ (null);
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { st.search = search.value; host._rnFocus = true; redraw(); }, 250); });
    // Keys stay in the field (Foundry's shortcuts), and Enter never submits the sheet's form.
    search.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Enter") ev.preventDefault(); });
  }
  root.querySelectorAll("[data-wct-rn-score]").forEach(el => el.addEventListener("keydown", ev => {
    ev.stopPropagation(); if (/** @type {KeyboardEvent} */ (ev).key === "Enter") { ev.preventDefault(); /** @type {HTMLInputElement} */ (ev.currentTarget).blur(); }
  }));
  root.querySelectorAll("[data-wct-rn-score]").forEach(el => el.addEventListener("change", async ev => {
    ev.stopPropagation(); const t = /** @type {HTMLInputElement} */ (ev.currentTarget);
    const n = Number(String(t.value).replace(/−/g, "-")); if (!Number.isFinite(n)) return redraw();
    await Renown.setScore(actor, t.dataset.wctRnScore, n);
  }));
  root.querySelectorAll("[data-wct-rn]").forEach(el => el.addEventListener("click", async ev => {
    ev.preventDefault(); ev.stopPropagation();
    const b = /** @type {HTMLElement} */ (ev.currentTarget); const fid = b.dataset.faction ?? "";
    switch (b.dataset.wctRn) {
      case "filter": st.filter = b.dataset.value ?? "all"; return redraw();
      case "inactive": st.inactive = !st.inactive; return redraw();
      case "sort": st.sort = st.sort === "name" ? "renown" : "name"; return redraw();
      case "group": { const g = b.dataset.group ?? ""; st.closed = st.closed.includes(g) ? st.closed.filter((/** @type {string} */ x) => x !== g) : [...st.closed, g]; return redraw(); }
      case "track": await Renown.track(actor, fid); return redraw();
      case "award": return openAward({ actors: [actor], faction: fid || undefined });
      case "setup": return openSetup(fid || undefined);
      case "unribbon": return Renown.removeSource(actor, fid, b.dataset.ribbon);
      case "ribbon": {
        const f = Renown.faction(fid); if (!f) return;
        const r = await foundry.applications.api.DialogV2.prompt({
          classes: ["wct-dialog", ...UI_CLASSES], window: { title: `Other source · ${f.name}`, icon: "fa-solid fa-ribbon" }, position: { width: 420 },
          content: `<p>A label shown on ${esc(actor.name)}'s row, counted into the total (for example <em>Bastion in their land +1</em>). Nothing is automated.</p>
            <div class="form-group"><label>Label</label><input type="text" name="text" maxlength="${R.NAME_MAX}" required autofocus></div>
            <div class="form-group"><label>Amount</label><input type="text" name="amount" value="+1" inputmode="numeric"></div>`,
          ok: { label: "Add", callback: (_ev, button) => ({ text: button.form.elements.text.value, amount: button.form.elements.amount.value }) },
          rejectClose: false
        });
        if (r?.text) await Renown.addSource(actor, fid, r.text, r.amount);
        return;
      }
    }
  }));
}

/** The standalone Reputation window (dnd5e's own sheet's header control, api.renown.open(actor)). */
export class RenownWindow extends AppV2 {
  static DEFAULT_OPTIONS = {
    classes: ["wct-sheet", "wct-window", "wct-renown-window", ...UI_CLASSES],
    window: { title: "Reputation", icon: "fa-solid fa-flag", resizable: true }, position: { width: 760, height: 640 }
  };
  /** @param {any} actor @param {any} [options] */
  constructor(actor, options = {}) { super({ id: `wct-renown-${actor.id}`, ...options }); this.actor = actor; }
  get title() { return `Reputation · ${this.actor.name}`; }
  async _renderHTML() {
    const div = document.createElement("div");
    div.className = "wct-cs wct-rn-solo";
    div.innerHTML = `<main class="wct-cs-page"><div class="wct-cs-page-head"><h3 class="wct-cs-ttl">Reputation</h3><span class="wct-cs-dim">renown per faction · this character only</span></div>${pageBody(this.actor, this._rn, { edit: !!game.user?.isGM })}</main>`;
    return div;
  }
  _replaceHTML(result, content) {
    const top = content.querySelector(".wct-cs-page")?.scrollTop ?? 0;
    content.replaceChildren(result);
    const p = content.querySelector(".wct-cs-page"); if (p) p.scrollTop = top;
  }
  _onRender() { const root = this.element?.querySelector(".wct-rn-solo"); if (root) wire(root, this.actor, this); }
}
/** Opens (or brings forward) the Reputation window for a character this user can see. */
export function openWindow(ref) {
  const a = Renown.actorOf(ref) ?? game.user?.character;
  if (!a) return ui.notifications.info("Renown: choose a character.");
  if (!a.testUserPermission?.(game.user, "LIMITED") || (!game.user.isGM && a.limited)) return ui.notifications.warn(`You can't view ${a.name}'s reputation.`);
  const id = `wct-renown-${a.id}`;
  const open = foundry.applications.instances?.get?.(id);
  if (open) { open.bringToFront?.(); return open; }
  return new RenownWindow(a).render({ force: true });
}

/** Every open window showing renown redraws (sheets on their Reputation page, Reputation windows, the setup window). */
export function refreshOpen() {
  for (const app of foundry.applications.instances?.values?.() ?? []) {
    const a = /** @type {any} */ (app);
    if (a instanceof RenownWindow || a instanceof SetupWindow || (a._page === "reputation" && a.options?.classes?.includes("wct-sheet"))) a.render();
  }
}

/** dnd5e's own character sheet: a "Reputation" header control (not on the toolkit sheet, which has the page). */
export function addHeaderControl(app, controls) {
  const actor = app?.document ?? app?.actor;
  if (!(actor instanceof Actor) || actor.type !== "character" || !Array.isArray(controls)) return;
  if (app.options?.classes?.includes?.("wct-sheet")) return;
  if (app.options?.actions && !app.options.actions.wctReputation) app.options.actions.wctReputation = function () { const a = this.document ?? this.actor; if (a) openWindow(a); };
  controls.push({ icon: "fa-solid fa-flag", label: "Reputation", action: "wctReputation", visible: true });
}

// ---------------------------------------------------------------- Award renown (GM)
/** The party's characters: the party actor's members when it is set, else every character a player owns. */
function partyCharacters() {
  let name = ""; try { name = game.settings.get(ID, "partyActor"); } catch { name = ""; }
  const party = name ? game.actors.find(a => a.type === "group" && a.name === name) : null;
  const members = (party?.system?.members ?? []).map(m => m?.actor ?? m).filter(a => a instanceof Actor && a.type === "character");
  return members.length ? members : game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
}

export class AwardWindow extends AppV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-renown-award`, tag: "form", form: { closeOnSubmit: false },
    classes: ["wct-window", "wct-renown-award", ...UI_CLASSES],
    window: { title: "Award renown", icon: "fa-solid fa-flag", resizable: true }, position: { width: 520, height: "auto" }
  };
  /** @param {{ actors?: any[], faction?: string }} [o] */
  constructor({ actors = [], faction = undefined } = {}, options = {}) {
    super(options);
    this.picked = new Set(actors.map(a => a?.id).filter(Boolean));
    this.whole = !this.picked.size; this.factionId = faction ?? Renown.factions()[0]?.id ?? "";
  }
  /** The amount the form says ("+2", "-2d6"), or "". */
  amountOf(f) {
    const loss = f.elements.loss?.value ?? "";
    if (loss === "custom") { const c = R.cleanFormula(String(f.elements.custom?.value ?? "").replace(/^[-−+]\s*/, "")); return c ? `-${c}` : ""; }
    if (loss) return `-${loss}`;
    return String(f.elements.gain?.value ?? "");
  }
  chosen(f) {
    const pcs = this.pcs ?? [];
    if (f.elements.to?.value === "whole") return pcs;
    return pcs.filter(a => f.querySelector(`input[name="pc"][value="${a.id}"]`)?.checked);
  }
  async _renderHTML() {
    const div = document.createElement("div");
    if (!game.user?.isGM) { div.textContent = "GM only."; return div; }
    const c = Renown.config(); const facs = Renown.factions();
    const extra = [...this.picked].map(id => game.actors.get(id)).filter(a => a && !partyCharacters().includes(a));
    this.pcs = [...partyCharacters(), ...extra];
    if (!facs.length) { div.innerHTML = `<p>No factions yet. Set them up in <em>Factions and renown</em> first.</p><p><button type="button" class="wc-btn" data-act="setup">Factions and renown…</button></p>`; return div; }
    div.className = "wct-rn-award";
    div.innerHTML = `
      <div class="form-group"><label>To</label><div class="form-fields wct-rn-seg">
        <label><input type="radio" name="to" value="whole" ${this.whole ? "checked" : ""}> Whole party</label>
        <label><input type="radio" name="to" value="pick" ${this.whole ? "" : "checked"}> Pick characters</label></div></div>
      <div class="wct-rn-pcs">${this.pcs.map(a => `<label class="wct-rn-pc"><input type="checkbox" name="pc" value="${a.id}" ${this.whole || this.picked.has(a.id) ? "checked" : ""}> ${esc(a.name)}</label>`).join("") || `<span class="hint">No player characters found.</span>`}</div>
      <div class="form-group"><label>Faction</label><div class="form-fields"><select name="faction">${facs.map(f => `<option value="${f.id}" ${f.id === this.factionId ? "selected" : ""}>${esc(f.name)}${f.hidden ? " (hidden from players)" : ""}</option>`).join("")}</select></div></div>
      <div class="form-group"><label>Gain</label><div class="form-fields"><input type="text" name="gain" value="+${c.gains[0] ?? 1}" inputmode="numeric" aria-label="Gain">${c.gains.map(g => `<button type="button" class="wc-btn wc-btn-sm" data-gain="${g}">+${g}</button>`).join("")}</div></div>
      <div class="form-group"><label>Or a loss</label><div class="form-fields"><select name="loss"><option value="">None</option>${c.losses.map(l => `<option value="${esc(l)}">−${esc(l)}</option>`).join("")}<option value="custom">Custom formula…</option></select><input type="text" name="custom" placeholder="e.g. 1d4+1" hidden aria-label="Custom loss formula"></div></div>
      <div class="form-group"><label>Reason</label><div class="form-fields"><input type="text" name="reason" maxlength="200" placeholder="Shown in the chat card"></div></div>
      <p class="hint" data-hint></p>
      <footer class="form-footer"><button type="button" data-act="cancel"><i class="fa-solid fa-xmark"></i> Cancel</button><button type="submit"><i class="fa-solid fa-check"></i> Award</button></footer>`;
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  _onRender() {
    const f = /** @type {any} */ (this.element);
    f.querySelector("[data-act=setup]")?.addEventListener("click", () => { openSetup(); this.close(); });
    f.querySelector("[data-act=cancel]")?.addEventListener("click", () => this.close());
    if (!f.elements?.faction) return;
    const hint = () => {
      const fac = Renown.faction(f.elements.faction.value); const c = Renown.config();
      const rows = fac ? this.chosen(f).map(a => ({ name: a.name, entry: Renown.entryFor(a, fac), tiers: R.tiersOf(fac, c) })) : [];
      f.querySelector("[data-hint]").textContent = RV.awardHint(rows, R.parseAmount(this.amountOf(f)));
      f.elements.custom.hidden = f.elements.loss.value !== "custom";
    };
    f.querySelectorAll("[data-gain]").forEach(b => b.addEventListener("click", () => { f.elements.gain.value = `+${b.dataset.gain}`; f.elements.loss.value = ""; hint(); }));
    f.querySelectorAll("input[name=pc]").forEach(b => b.addEventListener("change", () => { f.elements.to.value = "pick"; hint(); }));
    f.querySelectorAll("input[name=to]").forEach(b => b.addEventListener("change", () => { if (f.elements.to.value === "whole") f.querySelectorAll("input[name=pc]").forEach(c => { c.checked = true; }); hint(); }));
    for (const n of ["faction", "gain", "loss", "custom"]) f.elements[n].addEventListener(n === "gain" || n === "custom" ? "input" : "change", hint);
    f.addEventListener("keydown", ev => ev.stopPropagation());
    hint();
    f.onsubmit = async ev => {
      ev.preventDefault();
      const actors = this.chosen(f); const amount = this.amountOf(f);
      if (!actors.length) return ui.notifications.warn("Award renown: pick at least one character.");
      if (!R.parseAmount(amount)) return ui.notifications.warn("Award renown: choose a gain or a loss.");
      const done = await Renown.award(actors, f.elements.faction.value, amount, { reason: f.elements.reason.value });
      if (done) this.close();
    };
  }
}
/** GM: opens the award window, optionally for given characters and a faction. */
export function openAward(opts = {}) {
  if (!game.user?.isGM) return ui.notifications.warn("Wanderer's Toolkit: GM only.");
  foundry.applications.instances?.get?.(`${ID}-renown-award`)?.close?.();
  return new AwardWindow(opts).render({ force: true });
}

// ---------------------------------------------------------------- Factions and renown (GM setup)
const SHARED = "_shared";
const NEW = "_new";

/** The Item Piles merchants of this world (world actors): [{ id, name }]. */
function merchants() {
  const IP = Renown.itemPiles(); if (!IP) return [];
  return game.actors.filter(a => { try { return !!IP.isItemPileMerchant(a); } catch { return false; } }).map(a => ({ id: a.id, name: a.name }));
}

/** One tier row of the editor. */
function tierRow(t, i) {
  return `<tr data-tier>
    <td><input type="color" name="color" value="${esc(t.color)}" aria-label="Colour"></td>
    <td><input type="text" name="name" value="${esc(t.name)}" maxlength="40" aria-label="Tier name" placeholder="Tier ${i + 1}"></td>
    <td><input type="number" name="from" value="${t.from}" min="1" max="${R.SCORE_MAX}" class="n" aria-label="Starts at"></td>
    <td><input type="number" name="discount" value="${t.discount}" min="0" max="${R.DISCOUNT_MAX}" class="n" aria-label="Merchant discount %"></td>
    <td><input type="text" name="rarity" value="${esc(t.rarity)}" aria-label="Unlocked rarity" placeholder="e.g. up to uncommon"></td>
    <td><input type="text" name="perk" value="${esc(t.perk)}" aria-label="Perk"></td>
    <td><input type="text" name="title" value="${esc(t.title)}" aria-label="Title"></td>
    <td><button type="button" class="wc-btn wc-btn-sm wc-btn-icon" data-act="rm-tier" aria-label="Remove tier"><i class="fa-solid fa-xmark"></i></button></td>
  </tr>`;
}
function tiersTable(tiers, disabled = false) {
  return `<table class="wct-rn-ttbl"${disabled ? " data-disabled" : ""}><thead><tr><th>Colour</th><th>Tier</th><th>From</th><th>Discount %</th><th>Unlocks (rarity)</th><th>Perk</th><th>Title</th><th></th></tr></thead>
    <tbody>${tiers.map(tierRow).join("")}</tbody></table>
    ${disabled ? "" : `<p><button type="button" class="wc-btn wc-btn-sm" data-act="add-tier"><i class="fa-solid fa-plus"></i> Add tier</button> <span class="hint">At most ${R.TIERS_MAX}. Below the first tier there is no tier; renown never goes below 0.</span></p>`}`;
}
/** Tier rows read back from a table. */
function readTiers(root) {
  return [...root.querySelectorAll("tr[data-tier]")].map(tr => {
    const v = n => /** @type {HTMLInputElement} */ (tr.querySelector(`[name=${n}]`))?.value ?? "";
    return { color: v("color"), name: v("name"), from: Number(v("from")), discount: Number(v("discount")), rarity: v("rarity"), perk: v("perk"), title: v("title") };
  });
}

export class SetupWindow extends AppV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-renown-setup`, classes: ["wct-window", "wct-renown-setup", ...UI_CLASSES],
    window: { title: "Factions and renown", icon: "fa-solid fa-flag", resizable: true }, position: { width: 980, height: 720 }
  };
  sel = /** @type {string} */ (SHARED);
  q = "";
  async _renderHTML() {
    const div = document.createElement("div");
    if (!game.user?.isGM) { div.textContent = "GM only."; return div; }
    const facs = Renown.factions(); const counts = Renown.characterCounts();
    if (this.sel !== SHARED && this.sel !== NEW && !facs.some(f => f.id === this.sel)) this.sel = SHARED;
    const q = this.q.toLowerCase();
    /** @type {Map<string, any[]>} */
    const groups = new Map();
    for (const f of facs.filter(f => !q || f.name.toLowerCase().includes(q))) { const g = f.inactive ? RV.INACTIVE_GROUP : R.groupOf(f); if (!groups.has(g)) groups.set(g, []); groups.get(g)?.push(f); }
    const nav = (id, label, sub = "", extra = "") => `<button type="button" class="wc-nav${this.sel === id ? " is-active" : ""}" data-sel="${esc(id)}" aria-current="${this.sel === id}"><span class="wct-rn-navl"><span>${esc(label)}${extra}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</span></button>`;
    div.className = "wc-shell wct-rn-shell";
    div.innerHTML = `<nav class="wc-side wct-rn-side" aria-label="Factions">
        <label class="wct-rn-find"><span class="wc-sr">Search factions</span><input type="search" data-find value="${esc(this.q)}" placeholder="Search factions"></label>
        ${nav(SHARED, "Tiers and presets", "shared by every faction")}
        ${[...groups].map(([g, list]) => `<p class="wct-rn-shd">${esc(g)}</p>${list.map(f => nav(f.id, f.name, `${f.parent ? "subfaction" : "faction"} · ${counts[f.id] ?? 0} ${counts[f.id] === 1 ? "character" : "characters"}`, f.hidden ? ` <i class="fa-solid fa-eye-slash" data-tooltip="Hidden from players"></i>` : "")).join("")}`).join("")}
        <p><button type="button" class="wc-btn wc-btn-sm wc-btn-primary" data-sel="${NEW}"><i class="fa-solid fa-plus"></i> New faction</button></p>
      </nav>
      <main class="wc-main wct-rn-main">${this.sel === SHARED ? this.sharedHTML() : this.factionHTML(this.sel === NEW ? null : R.factionById(facs, this.sel), counts)}</main>`;
    return div;
  }
  sharedHTML() {
    const c = Renown.config();
    return `<form class="wct-rn-form" data-form="shared" autocomplete="off">
      <h2>Tiers and presets</h2>
      <p class="hint">The tier set every faction uses unless it has its own. <em>From</em> is the renown where a tier starts; the discount applies at the faction's merchants (through Item Piles, when it's active). Rarity, perk and title are shown to players as you write them.</p>
      ${tiersTable(c.tiers)}
      <h3>Award presets</h3>
      <div class="form-group"><label>Gains</label><div class="form-fields"><input type="text" name="gains" value="${esc(c.gains.join(", "))}"></div><p class="hint">Whole numbers, separated by commas (buttons in the award window).</p></div>
      <div class="form-group"><label>Losses</label><div class="form-fields"><input type="text" name="losses" value="${esc(c.losses.join(", "))}"></div><p class="hint">Dice formulas, separated by commas; each is rolled per character and subtracted.</p></div>
      <footer class="form-footer"><button type="submit" class="wc-btn wc-btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save tiers and presets</button></footer>
    </form>`;
  }
  factionHTML(f, counts) {
    const fac = f ?? { ...R.normalizeFaction({ name: "" }, { makeId: () => "" }), id: "", name: "", hidden: false };
    const c = Renown.config(); const facs = Renown.factions(); const own = !!fac.tiers;
    const parents = [...new Set(facs.map(x => x.parent).filter(Boolean))]; const groupsList = [...new Set(facs.map(x => x.group).filter(Boolean))];
    const ms = merchants(); const IP = !!Renown.itemPiles();
    const linked = R.merchantFactions(facs);
    const sources = f ? Renown.sourcesOf(f.id) : [];
    const sw = (name, on, label) => `<label class="wct-rn-sw"><input type="checkbox" name="${name}" ${on ? "checked" : ""}> ${label}</label>`;
    return `<form class="wct-rn-form" data-form="faction" data-id="${esc(fac.id)}" autocomplete="off">
      <div class="wct-rn-phead"><h2>${esc(f ? f.name : "New faction")}</h2><span class="wc-badge">tracked per character</span>${f ? `<span class="wc-badge">${counts[f.id] ?? 0} ${counts[f.id] === 1 ? "character" : "characters"}</span>` : ""}<span class="wc-grow"></span>${f ? `<button type="button" class="wc-btn wc-btn-sm wc-btn-danger" data-act="delete"><i class="fa-solid fa-trash"></i> Delete</button>` : ""}</div>
      <div class="wct-rn-grid">
        <div class="form-group"><label>Name</label><div class="form-fields"><input type="text" name="name" value="${esc(fac.name)}" maxlength="${R.NAME_MAX}" required></div></div>
        <div class="form-group"><label>Short note</label><div class="form-fields"><input type="text" name="note" value="${esc(fac.note)}" placeholder="Shown under the name on the sheet"></div></div>
        <div class="form-group"><label>Parent side</label><div class="form-fields"><input type="text" name="parent" value="${esc(fac.parent)}" list="wct-rn-parents" placeholder="None (a neutral faction)"></div><p class="hint">Subfactions are grouped under it. The side keeps no score of its own.</p></div>
        <div class="form-group"><label>Group</label><div class="form-fields"><input type="text" name="group" value="${esc(fac.group)}" list="wct-rn-groups" placeholder="Factions"></div><p class="hint">For factions without a parent side (e.g. Neutral factions).</p></div>
      </div>
      <datalist id="wct-rn-parents">${parents.map(p => `<option value="${esc(p)}">`).join("")}</datalist><datalist id="wct-rn-groups">${groupsList.map(p => `<option value="${esc(p)}">`).join("")}</datalist>
      <div class="wct-rn-sws">
        ${sw("hidden", fac.hidden, "Hidden from players <span class=\"hint\">(kept in the GM-only records with every character's renown until you switch it off)</span>")}
        ${sw("inactive", fac.inactive, "Inactive <span class=\"hint\">(folded away on the sheet unless Show inactive is on)</span>")}
        ${sw("startBonus", fac.startBonus, `Starting faction bonus <span class="hint">(new tiers here would raise the parent side's starting faction ${R.START_BONUS.map(n => `+${n}`).join(" / ")}; recorded only, not applied automatically)</span>`)}
      </div>
      <h3>Tiers</h3>
      <div class="wct-rn-seg"><label><input type="radio" name="tierset" value="shared" ${own ? "" : "checked"}> Shared tier set</label><label><input type="radio" name="tierset" value="own" ${own ? "checked" : ""}> Custom for this faction</label></div>
      <div data-tiers>${tiersTable(own ? fac.tiers : c.tiers, !own)}</div>
      <h3>Merchants</h3>
      ${IP ? ms.length ? `<p class="hint">Item Piles merchants that belong to this faction: each character's tier discount is set as their own buy price there (Item Piles' per-character price). A merchant belongs to one faction.</p><div class="wct-rn-ms">${ms.map(m => `<label class="wct-rn-pc"><input type="checkbox" name="merchant" value="${m.id}" ${fac.merchants.includes(m.id) ? "checked" : ""}> ${esc(m.name)}${linked[m.id] && linked[m.id] !== fac.id ? ` <span class="hint">(now ${esc(R.factionById(facs, linked[m.id])?.name ?? "another faction")})</span>` : ""}</label>`).join("")}</div>` : `<p class="hint">No Item Piles merchants in this world yet.</p>` : `<p class="hint">Item Piles isn't active: discounts are shown on the sheet only.</p>${fac.merchants.length ? `<p class="hint">${fac.merchants.length} merchant link(s) kept.</p>` : ""}`}
      <h3>Other sources</h3>
      ${sources.length ? `<ul class="wct-rn-srcs">${sources.map(s => `<li><span class="wc-badge">${esc(s.text)} ${esc(R.signed(s.amount))}</span> ${esc(s.actor)}</li>`).join("")}</ul>` : `<p class="hint">None yet.</p>`}
      <p class="hint">Added per character from the Reputation page (+ on a row): a label with an amount, counted into that character's total. No automation.</p>
      <footer class="form-footer"><button type="submit" class="wc-btn wc-btn-primary"><i class="fa-solid fa-floppy-disk"></i> ${f ? "Save faction" : "Create faction"}</button></footer>
    </form>`;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
  _onRender() {
    const root = this.element; if (!root) return;
    root.querySelectorAll("[data-sel]").forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); this.sel = b.dataset.sel; this.render(); }));
    const find = root.querySelector("[data-find]");
    if (find) {
      if (this._focusFind) { find.focus(); find.setSelectionRange(find.value.length, find.value.length); this._focusFind = false; }
      find.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Enter") ev.preventDefault(); });
      let t = /** @type {any} */ (null); find.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { this.q = find.value; this._focusFind = true; this.render(); }, 250); });
    }
    const form = root.querySelector("form.wct-rn-form"); if (!form) return;
    form.addEventListener("keydown", ev => ev.stopPropagation());
    form.addEventListener("click", ev => {
      const b = ev.target.closest("[data-act]"); if (!b) return;
      ev.preventDefault();
      if (b.dataset.act === "add-tier") {
        const body = form.querySelector("table.wct-rn-ttbl:not([data-disabled]) tbody"); if (!body) return;
        if (body.children.length >= R.TIERS_MAX) return ui.notifications.warn(`At most ${R.TIERS_MAX} tiers.`);
        const last = readTiers(form).at(-1);
        body.insertAdjacentHTML("beforeend", tierRow(R.normalizeTier({ from: (last?.from ?? 0) + 10 }, body.children.length), body.children.length));
      }
      if (b.dataset.act === "rm-tier" && !b.closest("[data-disabled]")) b.closest("tr")?.remove();
      if (b.dataset.act === "delete") this.deleteFaction(form.dataset.id);
    });
    form.querySelectorAll("input[name=tierset]").forEach(r => r.addEventListener("change", () => {
      const own = form.elements.tierset.value === "own";
      const cur = readTiers(form);
      form.querySelector("[data-tiers]").innerHTML = tiersTable(own ? R.normalizeTiers(cur) : Renown.config().tiers, !own);
    }));
    form.querySelectorAll("table[data-disabled] input, table[data-disabled] button").forEach(el => { el.disabled = true; });
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      if (form.dataset.form === "shared") {
        await Renown.saveShared({ tiers: R.normalizeTiers(readTiers(form)), gains: R.normalizeGains(form.elements.gains.value), losses: R.normalizeLosses(form.elements.losses.value) });
        return ui.notifications.info("Renown: tiers and presets saved.");
      }
      const name = form.elements.name.value.trim(); if (!name) return ui.notifications.warn("Give the faction a name.");
      const own = form.elements.tierset.value === "own";
      const data = {
        id: form.dataset.id || undefined, name, note: form.elements.note.value, parent: form.elements.parent.value, group: form.elements.group.value,
        hidden: form.elements.hidden.checked, inactive: form.elements.inactive.checked, startBonus: form.elements.startBonus.checked,
        tiers: own ? R.normalizeTiers(readTiers(form)) : null,
        merchants: Renown.itemPiles() ? [...form.querySelectorAll("input[name=merchant]:checked")].map(i => i.value) : (R.factionById(Renown.factions(), form.dataset.id)?.merchants ?? [])
      };
      const id = await Renown.saveFaction(data);
      if (id) { this.sel = id; ui.notifications.info(`Renown: ${name} saved.`); this.render(); }
    });
  }
  async deleteFaction(id) {
    const f = R.factionById(Renown.factions(), id); if (!f) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["wct-dialog", ...UI_CLASSES], window: { title: "Delete faction" }, content: `<p>Delete <strong>${esc(f.name)}</strong> and every character's renown with it? This can't be undone. Discounts it gave at merchants go back to normal.</p>`, rejectClose: false });
    if (!ok) return;
    await Renown.deleteFaction(id); this.sel = SHARED; this.render();
  }
}
/** GM: opens the setup window (optionally on a faction). */
export function openSetup(factionId) {
  if (!game.user?.isGM) return ui.notifications.warn("Wanderer's Toolkit: GM only.");
  /** @type {any} */
  const open = foundry.applications.instances?.get?.(`${ID}-renown-setup`) ?? new SetupWindow();
  if (factionId) open.sel = factionId;
  return open.render({ force: true });
}

/** init (feature on): header control on dnd5e's sheets, redraws when a character's renown flag changes, the refresher. */
export function init() {
  Renown.setRefresher(() => refreshOpen());
  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => addHeaderControl(app, controls));
  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes, `flags.${ID}`)) return;
    const rn = changes.flags?.[ID]; if (!rn || !Object.keys(rn).some(k => k.includes("renown"))) return;
    foundry.applications.instances?.get?.(`wct-renown-${actor.id}`)?.render?.();
  });
}
