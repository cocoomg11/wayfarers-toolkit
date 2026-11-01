/**
 * Map pins (feature mapPins): the party's own marks on any scene, kept as core Note documents with flags.wayfarers-toolkit.pin.
 * The Map pin tool (token controls) arms one click on the map: an empty spot opens the new-pin dialog, a pin opens its card.
 * Double-clicking a pin opens its card too. Players never write Notes themselves: every player change goes over the module socket to
 * the acting GM client (gm.mjs), which checks it (pins-model.mjs `decide`) and writes it. No GM online: nothing happens, and the
 * player is told. GMs write directly. Pure rules, data shape and checks: pins-model.mjs.
 */
import * as M from "./pins-model.mjs";
import * as F from "./features.mjs";
import * as Quests from "./quests.mjs";
import { activeGM, handle, request, notify } from "./gm.mjs";
import { log } from "./log.mjs";
import * as Vault from "./vault.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
const opts = () => ({ players: get("pinsPlayers", true), editAll: get("pinsEditAll", true) });
const me = () => ({ id: game.user.id, isGM: game.user.isGM });
/** Set on the Note class the toolkit installs, so the health check can tell whether another module replaced it later. */
export const MARK = Symbol.for(`${ID}.pinNote`);

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  s("pinsPlayers", "Map pins: players can place pins", "Players get the Map pin tool and can add, change, move and delete the party's pins (through the GM's client).", Boolean, true);
  s("pinsEditAll", "Map pins: players can change any party pin", "Off: a player can only change, move or delete party pins they placed themselves.", Boolean, true);
  s("pinsDimDone", "Map pins: dim pins of finished quests", "A pin linked to a completed or failed quest is drawn faded.", Boolean, true, { onChange: () => refreshAll() });
  s("pinsSize", "Map pins: size", "How big new pins are on the map, in pixels.", Number, M.SIZE.def, { range: { min: M.SIZE.min, max: M.SIZE.max, step: 4 } });
  s("pinsPaper", "Map pins: paper backing", "A small parchment disc behind each pin so the ink reads on dark maps. Reloads Foundry.", Boolean, true, { requiresReload: true });
  s("pinsShowNotes", "Map pins: show map notes when a scene has pins", "Turns on Foundry's map notes display once in each browser the first time it shows a scene with pins (anyone can turn it off again in the Journal Notes controls).", Boolean, true);
  // This browser: whether the toolkit already turned map notes on once (so turning them off again sticks).
  game.settings.register(ID, "pinsNotesShown", { scope: "client", config: false, type: Boolean, default: false });
}

// ---------------------------------------------------------------- reading
const sceneOf = s => (typeof s === "string" ? game.scenes.get(s) : s) ?? canvas?.scene ?? null;
/** A Note document from a placeable, a document, or an id on the scene (default: the one being viewed). */
function noteOf(ref, scene) {
  if (!ref) return null;
  if (ref.document?.documentName === "Note") return ref.document;
  if (ref.documentName === "Note") return ref;
  if (ref.hidden && ref.id) return null;
  return sceneOf(scene)?.notes?.get(String(ref.id ?? ref)) ?? null;
}
/** GM: hidden GM pins (no Note; GM-only store). Players: none. */
const hiddenBucket = () => (game.user?.isGM ? Vault.get("pins", {}) ?? {} : {});
/** GM: a hidden pin's record by id (or { hidden, id } from list()), or null. */
function hiddenOf(ref) {
  if (!game.user?.isGM || !ref) return null;
  const id = typeof ref === "string" ? ref : ref.hidden ? ref.id : null; if (!id) return null;
  return M.readHidden(hiddenBucket()[id]);
}
/** Quest lookups for the model's guard (nothing when the quest log is off). */
const questTools = (user = game.user) => ({
  find: id => (F.on("questLog") ? Quests.find(id) : null),
  canSee: j => { try { return Quests.canSee(j, user); } catch { return false; } },
  info: j => ({ name: j.name, status: Quests.data(j).status })
});
/** The linked quest as this user may see it, or null (never anything about a quest the user can't see). */
export const questFor = (pin, user = game.user) => M.questFor(pin, questTools(user));
/** Pins on a scene this user may see: [{ id, note, pin }]; for a GM also hidden pins: [{ id, note: null, hidden: true, record, pin }]. */
export function list(scene) {
  const s = sceneOf(scene); if (!s) return [];
  const out = []; for (const n of s.notes) { const pin = M.pinOf(n); if (pin && M.drawn(pin, game.user.isGM)) out.push({ id: n.id, note: n, pin }); }
  if (game.user?.isGM) for (const r of M.hiddenOn(hiddenBucket(), s.id)) out.push({ id: r.id, note: null, hidden: true, record: r, pin: r.pin });
  return out;
}

// ---------------------------------------------------------------- writing (GM directly, players through the acting GM)
function tell(text, ok = false) { if (text) ui.notifications[ok ? "info" : "warn"](`Map pins: ${text}.`); }

/** Sends a player's change to the acting GM. Nothing happens when no GM is online. */
function relay(op, body) {
  if (!activeGM()) { ui.notifications.warn("Map pins: no GM is online, so the pin wasn't saved. Try again once your GM has joined."); return false; }
  if (!request("mapPin", { op, ...body })) { ui.notifications.warn("Map pins: the change couldn't be sent."); return false; }
  return true;
}

/** GM: writes a checked change. `op`: create | update | move | delete | reveal. */
async function gmWrite(op, scene, note, data) {
  if (op === "create") return (await scene.createEmbeddedDocuments("Note", [data]))[0];
  if (op === "delete") return note.delete();
  return note.update(data);
}

/**
 * Create a pin at { x, y } on a scene from dialog input. GM: written at once. Player: sent to the GM.
 * @param {any} input
 * @param {{ scene?: any, x?: number, y?: number, level?: any }} [at]
 */
export async function create(input, { scene, x, y, level } = {}) {
  const s = sceneOf(scene); if (!s) return tell("no scene");
  level ??= canvas?.scene?.id === s.id ? canvas?.level?.id ?? null : null;
  if (game.user.isGM) {
    const made = /** @type {any} */ (M.gmNote)(input, me(), { x, y, level: s.levels?.has?.(level) ? level : null, size: get("pinsSize", M.SIZE.def), dims: s.dimensions });
    if (made.error) return tell(made.error);
    // A hidden GM pin is only a record in the GM-only store; its Note is made when it's revealed.
    if (made.pin.hidden) return storeHidden(M.hiddenRecord(made.pin, { id: M.newPinId(), sceneId: s.id, x: made.data.x, y: made.data.y, level: made.data.levels?.[0] ?? null, size: made.data.iconSize }));
    return gmWrite("create", s, null, made.data);
  }
  if (!M.can("create", me(), null, opts())) return tell("players can't place map pins in this world");
  const pin = M.readForm(input); if (!pin.label) return tell("a pin needs a label");
  return relay("create", { sceneId: s.id, x, y, level: level ?? undefined, pin });
}

/** GM: saves a hidden pin's record (null: refused). */
async function storeHidden(r) {
  if (!r) return tell("that pin couldn't be stored");
  if (Object.keys(hiddenBucket()).length >= M.HIDDEN_MAX && !hiddenBucket()[r.id]) return tell(`there are already ${M.HIDDEN_MAX} hidden pins`);
  await Vault.setKey("pins", r.id, r); redrawGhosts();
  return r;
}

/** Change a pin's label, text, look or quest link (GM: kind and hidden too). */
export async function update(ref, input, scene) {
  const h = hiddenOf(ref);
  if (h) {
    const pin = M.gmUpdate(h.pin, input); if (!pin.label) return tell("a pin needs a label");
    if (!pin.hidden) { await storeHidden({ ...h, pin: { ...pin, hidden: true, kind: "gm" } }); return reveal(h.id, false); }
    return storeHidden({ ...h, pin });
  }
  const note = noteOf(ref, scene); const old = M.pinOf(note); if (!old) return tell("that pin is gone");
  if (game.user.isGM) {
    const pin = M.gmUpdate(old, input);
    if (!pin.label) return tell("a pin needs a label");
    if (pin.hidden) { await gmWrite("update", note.parent, note, M.noteUpdate({ ...pin, hidden: false })); return reveal(note, true); }
    return gmWrite("update", note.parent, note, M.noteUpdate(pin));
  }
  if (!M.can("edit", me(), old, opts())) return tell("you can't change that pin");
  return relay("update", { sceneId: note.parent.id, noteId: note.id, pin: { ...old, ...M.readForm(input) } });
}

/** @param {any} ref @param {{ x?: number, y?: number }} [to] @param {any} [scene] */
export async function move(ref, { x, y } = {}, scene) {
  const h = hiddenOf(ref);
  if (h) { const s = game.scenes.get(h.sceneId); const p = M.clampPoint({ x, y }, s?.dimensions); return storeHidden({ ...h, ...p }); }
  const note = noteOf(ref, scene); const old = M.pinOf(note); if (!old) return tell("that pin is gone");
  if (game.user.isGM) return gmWrite("move", note.parent, note, M.clampPoint({ x, y }, note.parent.dimensions));
  if (!M.can("move", me(), old, opts())) return tell("you can't move that pin");
  return relay("move", { sceneId: note.parent.id, noteId: note.id, x, y });
}

export async function remove(ref, scene) {
  const h = hiddenOf(ref);
  if (h) { await Vault.setKey("pins", h.id, null); redrawGhosts(); return true; }
  const note = noteOf(ref, scene); const old = M.pinOf(note); if (!old) return tell("that pin is gone");
  if (game.user.isGM) return gmWrite("delete", note.parent, note);
  if (!M.can("delete", me(), old, opts())) return tell("you can't delete that pin");
  return relay("delete", { sceneId: note.parent.id, noteId: note.id });
}

/**
 * GM: show a GM pin to players (hidden false) or hide it again. Revealing makes the Note (with the record's id) and drops the record;
 * hiding stores the record and deletes the Note, so players' clients hold nothing of a hidden pin.
 */
export async function reveal(ref, hidden = false, scene) {
  if (!game.user.isGM) return tell("GM only");
  const h = hiddenOf(ref);
  if (h) {
    if (hidden) return h;
    const s = game.scenes.get(h.sceneId); if (!s) return tell("that pin's scene is gone");
    const data = { ...M.revealedNote(h), _id: h.id };
    const [made] = await s.createEmbeddedDocuments("Note", [data], { keepId: true });
    await Vault.setKey("pins", h.id, null); redrawGhosts();
    return made;
  }
  const note = noteOf(ref, scene); const old = M.pinOf(note); if (!old) return tell("that pin is gone");
  if (old.kind !== "gm") return tell("only GM pins can be hidden");
  if (!hidden) return old.hidden ? note.update(M.revealUpdate(old, false)) : note;
  const r = M.toHidden(note, note.parent.id); if (!r) return tell("that pin couldn't be hidden");
  await storeHidden(r);
  await note.delete();
  return r;
}

/** Leader: a player's request, schema-checked by core. The user is Foundry's sender, never a field of the message. */
async function onRequest(data, sender) {
  if (!sender) return;
  const req = M.readRequest({ action: "mapPin", ...data });
  const scene = req ? game.scenes.get(req.sceneId) : null;
  const note = req?.noteId ? scene?.notes?.get(req.noteId) ?? null : null;
  const facts = {
    user: { id: sender.id, isGM: sender.isGM }, ...opts(),
    sceneOk: !!scene && (sender.viewedScene === scene.id || sender.isGM),
    dims: scene?.dimensions, levelOk: id => !!scene?.levels?.has?.(id),
    count: scene ? scene.notes.filter(n => M.isPin(n)).length : 0,
    note: note ? { flags: note.flags } : null,
    questOk: id => { const t = questTools(sender); const j = t.find(id); return !!j && t.canSee(j); },
    size: get("pinsSize", M.SIZE.def)
  };
  const d = M.decide(/** @type {any} */ (req), facts);
  log(`map pin ${req?.op ?? "?"} from ${sender.name}: ${d.ok ? "ok" : d.reason}`);
  if (!d.ok) return refuse(sender.id, d.reason);
  try { await gmWrite(/** @type {any} */ (req).op, scene, note, d.data); }
  catch (e) { console.warn(`${ID} | map pin`, e); refuse(sender.id, "the GM's client couldn't save it"); }
}
/** Tells the sender their change was refused (a notice hook from the leader; clients accept it only from the leader's GM session). */
function refuse(userId, reason) { notify(userId, `Map pins: ${String(reason ?? "the GM's client said no").slice(0, 120)}.`, "warn"); }

// ---------------------------------------------------------------- dialogs
const inkCss = id => M.INKS[id]?.hex ?? M.INKS.iron.hex;
function iconSwatch(id, ink) { return `<span class="wct-pin-glyph" style="--wct-pin-src:url('${esc(foundry.utils.getRoute?.(M.iconPath(id)) ?? `/${M.iconPath(id)}`)}');--wct-pin-ink:${esc(inkCss(ink))}"></span>`; }

/**
 * The new-pin / edit dialog. Returns the form input or null.
 * @param {{ pin?: any, title?: string }} [opts]
 */
async function pinForm({ pin = null, title = "New map pin" } = {}) {
  const gm = game.user.isGM; const p = M.normalize(pin ?? { ink: "iron", icon: "pin", kind: gm ? "gm" : "party" });
  const quests = F.on("questLog") ? M.questChoices(Quests.all(), { canSee: j => { try { return Quests.canSee(j); } catch { return false; } } }) : [];
  // A link to a quest this user can't see is kept as it is and not shown at all (not even that one exists): no quest field then.
  const keepHidden = p.quest && !quests.some(q => q.id === p.quest);
  const icons = Object.entries(M.ICONS).map(([id, label]) => `<label class="wct-pin-choice" data-tooltip="${esc(label)}"><input type="radio" name="icon" value="${id}" ${id === p.icon ? "checked" : ""}>${iconSwatch(id, p.ink)}<span class="sr-only">${esc(label)}</span></label>`).join("");
  const inks = Object.entries(M.INKS).map(([id, i]) => `<label class="wct-pin-ink" data-tooltip="${esc(i.label)}"><input type="radio" name="ink" value="${id}" ${id === p.ink ? "checked" : ""}><span style="background:${esc(i.hex)}"></span><span class="sr-only">${esc(i.label)}</span></label>`).join("");
  const content = `<div class="wct-pin-form">
    <div class="form-group"><label>Label</label><div class="form-fields"><input type="text" name="label" maxlength="${M.LABEL_MAX}" value="${esc(p.label)}" placeholder="Old mill" required autofocus></div></div>
    <div class="form-group stacked"><label>Note</label><textarea name="text" rows="4" maxlength="${M.TEXT_MAX}" placeholder="What the party knows about this place">${esc(p.text)}</textarea></div>
    <div class="form-group"><label>Mark</label><div class="form-fields wct-pin-choices">${icons}</div></div>
    <div class="form-group"><label>Ink</label><div class="form-fields wct-pin-inks">${inks}</div></div>
    ${keepHidden ? `<input type="hidden" name="quest" value="${esc(p.quest)}">` : quests.length ? `<div class="form-group"><label>Quest</label><div class="form-fields"><select name="quest"><option value="">None</option>${quests.map(q => `<option value="${esc(q.id)}" ${q.id === p.quest ? "selected" : ""}>${esc(q.name)}</option>`).join("")}</select></div></div>` : ""}
    ${gm ? `<div class="form-group"><label>Whose pin</label><div class="form-fields"><select name="kind"><option value="party" ${p.kind === "party" ? "selected" : ""}>The party's (players can change it)</option><option value="gm" ${p.kind === "gm" ? "selected" : ""}>The GM's (only GMs change it)</option></select></div></div>
    <div class="form-group"><label>Hidden from players</label><div class="form-fields"><input type="checkbox" name="hidden" ${p.hidden ? "checked" : ""}></div><p class="hint">GM pins only. Players don't see it until you reveal it.</p></div>` : ""}
  </div>`;
  const f = await foundry.applications.api.DialogV2.prompt({
    classes: ["wct-window", "wct-pin-dialog"], window: { title, icon: "fa-solid fa-map-pin" }, content, position: { width: 440 }, rejectClose: false,
    ok: { label: "Save", icon: "fa-solid fa-feather", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object },
    render: (ev, dlg) => {
      const root = dlg?.element ?? ev?.target?.element; if (!root?.querySelector) return;
      // The marks take the chosen ink, so the GM sees what the pin will look like.
      root.addEventListener("change", e => { if (e.target?.name === "ink") root.querySelectorAll(".wct-pin-glyph").forEach(g => g.style.setProperty("--wct-pin-ink", inkCss(e.target.value))); });
    }
  });
  if (!f) return null;
  const out = M.readForm(f, { isGM: gm });
  if (!out.label) { tell("a pin needs a label"); return null; }
  return out;
}

/** A pin's card: label, note, linked quest (if this user may see it) and the buttons this user may use. */
export async function open(ref, scene) {
  const h = hiddenOf(ref);
  const note = h ? null : noteOf(ref, scene); const pin = h ? h.pin : M.pinOf(note);
  if (!pin || !M.can("view", me(), pin)) return null;
  const target = h ? h.id : note;
  const q = questFor(pin);
  const by = pin.by ? game.users.get(pin.by)?.name : "";
  const o = opts(); const u = me();
  const may = a => M.can(a, u, pin, o);
  const body = esc(pin.text).replace(/\n/g, "<br>");
  const content = `<div class="wct-pin-card">
    <div class="wct-pin-card-head">${iconSwatch(pin.icon, pin.ink)}<h3>${esc(pin.label)}</h3></div>
    ${body ? `<p class="wct-pin-text">${body}</p>` : ""}
    ${q ? `<p class="wct-pin-quest"><i class="fa-solid fa-scroll"></i> ${esc(q.name)}${["completed", "failed"].includes(q.status) ? ` <em>(${esc(q.status)})</em>` : ""}</p>` : ""}
    <p class="wct-pin-meta">${pin.kind === "gm" ? "The GM's mark" : "The party's mark"}${by ? ` · placed by ${esc(by)}` : ""}${pin.hidden ? ' · <strong>hidden from players</strong>' : ""}</p>
  </div>`;
  const buttons = [
    q && { action: "quest", label: "Open quest", icon: "fa-solid fa-scroll" },
    may("edit") && { action: "edit", label: "Edit", icon: "fa-solid fa-pen" },
    may("move") && { action: "move", label: "Move", icon: "fa-solid fa-arrows-up-down-left-right" },
    may("reveal") && { action: pin.hidden ? "show" : "hide", label: pin.hidden ? "Reveal" : "Hide", icon: pin.hidden ? "fa-solid fa-eye" : "fa-solid fa-eye-slash" },
    may("delete") && { action: "delete", label: "Delete", icon: "fa-solid fa-trash" },
    { action: "close", label: "Close", icon: "fa-solid fa-xmark", default: true }
  ].filter(Boolean);
  const act = await foundry.applications.api.DialogV2.wait({ classes: ["wct-window", "wct-pin-dialog"], window: { title: "Map pin", icon: "fa-solid fa-map-pin" }, content, buttons, position: { width: 380 }, rejectClose: false });
  // Everything below re-checks through the write functions (and the GM's client re-checks a player's request again).
  if (act === "quest" && q) return Quests.open(q.id);
  if (act === "edit") { const input = await pinForm({ pin, title: "Edit map pin" }); return input ? update(target, input) : null; }
  if (act === "move") return arm({ moving: target });
  if (act === "show") return reveal(target, false);
  if (act === "hide") return reveal(target, true);
  if (act === "delete") {
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["wct-window"], window: { title: "Delete map pin" }, content: `<p>Delete the pin <strong>${esc(pin.label)}</strong>?</p>`, rejectClose: false });
    return ok ? remove(target) : null;
  }
  return null;
}

// ---------------------------------------------------------------- placing: one click on the map
/** @type {any} */
let ARMED = null;
/** Arms one left click on the map: an empty spot → new pin (or the moved pin goes there), a pin → its card. Esc cancels. */
export function arm({ moving = null } = {}) {
  if (!canvas?.ready || !canvas.scene) return tell("open a scene first");
  if (!moving && !game.user.isGM && !get("pinsPlayers", true)) return tell("players can't place map pins in this world");
  disarm();
  const view = canvas.app?.view ?? document.getElementById("board"); if (!view) return;
  /** @type {{ x: number, y: number } | null} */
  let down = null;
  const onDown = ev => { if (ev.button === 0) down = { x: ev.clientX, y: ev.clientY }; };
  const onUp = ev => {
    if (ev.button !== 0 || !down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y); down = null;
    if (moved > 6) return; // a drag, not a click
    const at = canvas.canvasCoordinatesFromClient({ x: ev.clientX, y: ev.clientY });
    disarm();
    if (moving) return move(moving, at).catch(e => console.warn(`${ID} | map pin`, e));
    const shown = list();
    const hit = M.hitPin(shown.map(p => (p.note ? { id: p.id, x: p.note.x, y: p.note.y, size: p.note.iconSize } : { id: p.id, x: p.record.x, y: p.record.y, size: p.record.size })), at);
    if (hit) { const e = shown.find(p => p.id === hit); return open(e?.hidden ? e.id : hit).catch(e2 => console.warn(`${ID} | map pin`, e2)); }
    pinForm().then(input => (input ? create(input, { scene: canvas.scene, x: at.x, y: at.y }) : null)).catch(e => console.warn(`${ID} | map pin`, e));
  };
  const onKey = ev => { if (ev.key === "Escape") { disarm(); ui.notifications.info("Map pins: cancelled."); } };
  view.addEventListener("pointerdown", onDown, true); view.addEventListener("pointerup", onUp, true); document.addEventListener("keydown", onKey);
  view.classList.add("wct-pin-armed");
  ARMED = () => { view.removeEventListener("pointerdown", onDown, true); view.removeEventListener("pointerup", onUp, true); document.removeEventListener("keydown", onKey); view.classList.remove("wct-pin-armed"); };
  ui.notifications.info(moving ? "Map pins: click where the pin goes (Esc cancels)." : "Map pins: click the map to place a pin, or a pin to open it (Esc cancels).");
  return true;
}
function disarm() { if (ARMED) { const f = ARMED; ARMED = null; f(); } }

// ---------------------------------------------------------------- the Note class: hidden pins, the card on double-click, dimming, paper
function pinNoteClass(Base) {
  return class WctPinNote extends Base {
    static [MARK] = true;
    // v14's Note#isVisible looks at the note's journal entry and hides entry-less notes from players, so players saw no pins in
    // 1.26. A pin has no entry: its own rule decides (hidden pins are never Notes since 1.27), plus the level check core does.
    get isVisible() {
      const pin = M.pinOf(this.document);
      if (!pin) return super.isVisible;
      const lv = this.document.levels; const cur = canvas?.level?.id ?? null;
      const named = lv ? (lv.size ?? lv.length ?? 0) > 0 : false;
      const levelOk = !cur || !named || (typeof lv.has === "function" ? lv.has(cur) : lv.includes(cur));
      return M.pinVisible({ pin, isGM: game.user.isGM, levelOk });
    }
    // Core lets only notes with a journal entry be viewed (double-clicked); a pin has none, so the pin's own rule decides.
    _canView(user) {
      const pin = M.pinOf(this.document);
      if (pin) return M.can("view", { id: user.id, isGM: user.isGM }, pin);
      return super._canView(user);
    }
    _onClickLeft2(event) {
      if (M.pinOf(this.document)) { open(this.document).catch(e => console.warn(`${ID} | map pin`, e)); return; }
      return super._onClickLeft2(event);
    }
    _getTargetAlpha() {
      const a = super._getTargetAlpha(); const pin = M.pinOf(this.document); if (!pin) return a;
      return a * M.alphaFor({ pin, isGM: game.user.isGM, dim: M.dimmed(questFor(pin), get("pinsDimDone", true)) });
    }
    _drawControlIcon() {
      const icon = super._drawControlIcon();
      if (!M.pinOf(this.document)) return icon;
      try {
        // Ink on the map: no dark square behind the mark; an optional parchment disc so it reads on dark maps.
        if (icon.bg) icon.bg.visible = false;
        if (get("pinsPaper", true) && /** @type {any} */ (globalThis).PIXI?.Graphics) {
          const s = this.document.iconSize; const g = new PIXI.Graphics();
          g.lineStyle(1.5, 0x5b4630, 0.7).beginFill(0xf1e6c8, 0.88).drawCircle(s / 2, s / 2, s * 0.58).endFill();
          icon.addChildAt(g, 0);
        }
      } catch (e) { log(`map pin look: ${e.message}`); }
      return icon;
    }
  };
}

// ---------------------------------------------------------------- hidden GM pins on the GM's canvas (no Note: a GM-only overlay)
/** @type {any} */
let GHOSTS = null;
/** GM: draws this scene's hidden pins as faded marks on the notes layer (clicking one with the Map pin tool opens it). */
export function redrawGhosts() {
  try {
    GHOSTS?.destroy?.({ children: true }); GHOSTS = null;
    if (!game.user?.isGM || !canvas?.ready || !canvas.scene || !(/** @type {any} */ (globalThis).PIXI)) return;
    const recs = M.hiddenOn(hiddenBucket(), canvas.scene.id); if (!recs.length) return;
    GHOSTS = new PIXI.Container(); GHOSTS.eventMode = "none";
    for (const r of recs) {
      const sprite = PIXI.Sprite.from(M.iconPath(r.pin.icon)); sprite.anchor.set(0.5); sprite.width = sprite.height = r.size;
      sprite.tint = Number.parseInt(String(M.INKS[r.pin.ink]?.hex ?? "#333333").slice(1), 16); sprite.alpha = 0.45; sprite.position.set(r.x, r.y);
      const ring = new PIXI.Graphics(); ring.lineStyle(2, 0xb02a2a, 0.8).drawCircle(r.x, r.y, r.size * 0.62);
      GHOSTS.addChild(ring, sprite);
    }
    (canvas.notes ?? canvas.interface)?.addChild?.(GHOSTS);
  } catch (e) { log(`map pins: hidden pin marks not drawn (${e.message})`); }
}

/** Redraws pin opacity (a quest's status changed, or the dimming setting). */
export function refreshAll(questId = null) {
  for (const n of canvas?.notes?.placeables ?? []) {
    const pin = M.pinOf(n.document); if (!pin || (questId && pin.quest !== questId)) continue;
    n.renderFlags?.set?.({ refreshState: true });
  }
}

/** Map notes are off in this browser and the scene has pins: turn them on once (setting pinsShowNotes). */
async function showNotes() {
  if (!canvas?.scene) return;
  const key = canvas.notes?.constructor?.TOGGLE_SETTING ?? "notesDisplayToggle";
  let toggle = true; try { toggle = game.settings.get("core", key); } catch { return; }
  if (!M.showNotesNow({ setting: get("pinsShowNotes", true), toggle, done: get("pinsNotesShown", false), hasPins: list().length > 0 })) return;
  try { await game.settings.set("core", key, true); await game.settings.set(ID, "pinsNotesShown", true); log("map pins: map notes display turned on in this browser"); }
  catch (e) { log(`map pins: couldn't turn map notes on (${e.message})`); }
}

/** Health check facts. */
export function status() {
  const cls = CONFIG.Note?.objectClass; const t = M.tally(game.scenes ?? []);
  const stored = Object.keys(hiddenBucket()).length;
  return { ...t, hidden: t.hidden + stored, hiddenAsNotes: t.hidden, classOk: !!cls?.[MARK], players: get("pinsPlayers", true) };
}

export function init() {
  // Our Note class wraps whatever class is set now (dnd5e's own after its init), so its look for journal-page notes is kept.
  if (CONFIG.Note?.objectClass && !CONFIG.Note.objectClass[MARK]) CONFIG.Note.objectClass = pinNoteClass(CONFIG.Note.objectClass);
  Hooks.on("getSceneControlButtons", controls => {
    const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
    if (!game.user.isGM && !get("pinsPlayers", true)) return;
    tokens.tools.wctPin = { name: "wctPin", title: "Map pin", icon: "fa-solid fa-map-pin", order: 101, button: true, visible: true, onChange: () => arm() };
  });
  Hooks.on("canvasReady", () => { disarm(); showNotes(); redrawGhosts(); });
  // A quest's status (or who can see it) changed: redraw the pins linked to it. Bails unless the quest flag changed.
  Hooks.on("updateJournalEntry", (j, changes) => {
    if (!foundry.utils.hasProperty(changes ?? {}, `flags.${ID}.quest`) && !("ownership" in (changes ?? {}))) return;
    if (!canvas?.notes?.placeables?.length) return;
    refreshAll(j.id);
  });
}
export function ready() {
  handle("mapPin", (data, sender) => onRequest(data, sender));
}

export const api = {
  /** Arms one click on the map (new pin, or open the pin clicked). */
  place: () => arm(),
  /** create({ label, text, icon, ink, quest, kind, hidden }, { scene, x, y }) */
  create: (input, at) => create(input, at),
  update: (note, input, scene) => update(note, input, scene),
  move: (note, at, scene) => move(note, at, scene),
  remove: (note, scene) => remove(note, scene),
  reveal: (note, hidden = false, scene) => reveal(note, hidden, scene),
  open: (note, scene) => open(note, scene),
  /** Pins on a scene this user can see: [{ id, note, pin }]. */
  list: scene => list(scene),
  /** The pin data on a Note (normalized), or (GM) a hidden pin's by id; null otherwise. */
  read: note => hiddenOf(note)?.pin ?? M.pinOf(noteOf(note)),
  icons: M.ICONS, inks: M.INKS
};
