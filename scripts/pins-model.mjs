/**
 * Map pins (feature mapPins), the pure part: pin data shape and its normalizer, who may do what, the socket request reader, the Note
 * data a pin becomes, the quest-visibility guard and the cleanup grouping. No Foundry calls here (tested in Node); pins.mjs is the UI,
 * the canvas hooks and the GM relay.
 *
 * A pin is a core Note document on a scene with flags.wayfarers-toolkit.pin = { v, kind, hidden, label, text, icon, ink, quest, by }.
 * kind "party": the players' own pins (every player sees them; players may change them). kind "gm": the GM's pins (players see them
 * unless hidden, never change them). The Note's own `text` is the label shown on the map (blank while a GM pin is hidden).
 */
const ID = "wayfarers-toolkit";

/** Schema version of flags.wayfarers-toolkit.pin. Bump it (and read the old shape in normalize) when the stored shape changes. */
export const PIN_VERSION = 1;
export const LABEL_MAX = 60;
export const TEXT_MAX = 500;
/** Pins on one scene a player can add to (the GM is never stopped). Keeps a runaway macro from filling a scene. */
export const PINS_MAX = 300;
export const KINDS = ["party", "gm"];

/** Bundled pin styles (our own SVGs, white ink tinted to the pin's ink colour). Order is the order shown. */
export const ICONS = {
  pin: "Pin", flag: "Flag", camp: "Camp", cave: "Cave", question: "Question", cross: "Cross", skull: "Skull", star: "Star"
};
export const iconPath = id => `modules/${ID}/styles/pins/${ICONS[id] ? id : "pin"}.svg`;
/** Ink colours: hex for the icon tint. Order is the order shown. */
export const INKS = {
  iron: { label: "Iron-gall black", hex: "#2b2118" },
  sepia: { label: "Sepia", hex: "#6b4423" },
  red: { label: "Red ochre", hex: "#9a2a1f" },
  blue: { label: "Indigo", hex: "#22406b" },
  green: { label: "Verdigris", hex: "#2f6a4f" },
  violet: { label: "Oak-gall violet", hex: "#5a3566" }
};
/** Note iconSize: core requires at least 32. */
export const SIZE = { min: 32, max: 96, def: 40 };

const str = (v, max) => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
const oneLine = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const ID_RE = /^[A-Za-z0-9]{16}$/;
export const isDocId = v => typeof v === "string" && ID_RE.test(v);

/**
 * Pin data in its full current shape, from anything (missing `v` = 0, read the same way as 1).
 * @param {any} [raw]
 */
export function normalize(raw = {}) {
  const p = raw && typeof raw === "object" ? raw : {};
  let kind = KINDS.includes(p.kind) ? p.kind : "party";
  const hidden = !!p.hidden;
  if (hidden) kind = "gm"; // only GM pins can be hidden
  return {
    v: PIN_VERSION,
    kind,
    hidden: kind === "gm" && hidden,
    label: oneLine(p.label, LABEL_MAX),
    text: str(p.text, TEXT_MAX),
    icon: ICONS[p.icon] ? p.icon : "pin",
    ink: INKS[p.ink] ? p.ink : "iron",
    quest: isDocId(p.quest) ? p.quest : "",
    by: typeof p.by === "string" ? p.by.slice(0, 32) : ""
  };
}

/** The pin on a Note document (or its plain data), normalized, or null when it isn't a pin. */
export function pinOf(note) {
  const f = note?.flags?.[ID]?.pin ?? note?._source?.flags?.[ID]?.pin;
  return f && typeof f === "object" ? normalize(f) : null;
}
export const isPin = note => !!pinOf(note);

/** The Note label: blank while a GM pin is hidden, so nothing readable is shown in core lists before it's revealed. */
export const noteLabel = pin => (pin.hidden ? "" : pin.label);

/**
 * Note document data for a pin. `at`: { x, y, level?, size? }.
 * @param {any} pin
 * @param {{ x?: any, y?: any, level?: any, size?: number }} [at]
 */
export function noteData(pin, { x, y, level = null, size = SIZE.def } = {}) {
  const p = normalize(pin);
  const d = {
    x: Math.round(x), y: Math.round(y), text: noteLabel(p), global: true, iconSize: clampSize(size),
    texture: { src: iconPath(p.icon), tint: INKS[p.ink].hex },
    flags: { [ID]: { pin: p } }
  };
  if (typeof level === "string" && level) d.levels = [level];
  return d;
}
/** The update that rewrites a Note for changed pin data (label, look, flag). */
export function noteUpdate(pin) {
  const p = normalize(pin);
  return { text: noteLabel(p), "texture.src": iconPath(p.icon), "texture.tint": INKS[p.ink].hex, [`flags.${ID}.pin`]: p };
}
export const clampSize = n => { const v = Number(n); return Number.isFinite(v) ? Math.min(SIZE.max, Math.max(SIZE.min, Math.round(v))) : SIZE.def; };

// ---------------------------------------------------------------- who may do what
/**
 * Whether `user` ({ id, isGM }) may do `action` to `pin` (normalized; null for "create"). `opts`: { players: players may place and
 * change pins, editAll: players may change party pins someone else placed }.
 * Actions: view, create, edit, move, delete, reveal.
 */
export function can(action, user, pin, { players = true, editAll = true } = {}) {
  if (!user) return false;
  if (user.isGM) return action === "reveal" ? pin?.kind === "gm" : true;
  if (action === "view") return !!pin && (pin.kind === "party" || !pin.hidden);
  if (action === "reveal") return false;
  if (!players) return false;
  if (action === "create") return true;
  if (!pin || pin.kind !== "party") return false;
  if (!["edit", "move", "delete"].includes(action)) return false;
  return editAll || pin.by === user.id;
}

// ---------------------------------------------------------------- the relay (player → active GM)
export const OPS = ["create", "update", "move", "delete"];
/** Pin fields a player's request may set. Kind, hidden and author are decided by the GM's client, never by the request. */
const playerFields = p => { const n = normalize({ ...p, kind: "party", hidden: false }); return { label: n.label, text: n.text, icon: n.icon, ink: n.ink, quest: n.quest }; };
const num = v => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * A player's socket request → { op, sceneId, noteId?, x?, y?, level?, pin? }, or null when it's malformed. Unknown fields are dropped.
 * create: sceneId, x, y, pin (level optional); update: sceneId, noteId, pin; move: sceneId, noteId, x, y; delete: sceneId, noteId.
 */
export function readRequest(msg) {
  if (!msg || typeof msg !== "object" || msg.action !== "mapPin" || !OPS.includes(msg.op) || !isDocId(msg.sceneId)) return null;
  const out = { op: msg.op, sceneId: msg.sceneId };
  if (msg.op !== "create") { if (!isDocId(msg.noteId)) return null; out.noteId = msg.noteId; }
  if (msg.op === "create" || msg.op === "move") {
    const x = num(msg.x), y = num(msg.y); if (x === null || y === null) return null;
    out.x = x; out.y = y;
    if (msg.op === "create" && isDocId(msg.level)) out.level = msg.level;
  }
  if (msg.op === "create" || msg.op === "update") {
    if (!msg.pin || typeof msg.pin !== "object") return null;
    out.pin = playerFields(msg.pin);
    if (!out.pin.label) return null;
  }
  return out;
}

/** Point clamped into a scene's dimensions ({ width, height }); unknown size leaves it as is (rounded). */
export function clampPoint({ x, y }, dims) {
  const w = num(dims?.width), h = num(dims?.height);
  const c = (v, m) => Math.round(m === null ? v : Math.min(m, Math.max(0, v)));
  return { x: c(x, w), y: c(y, h) };
}

/**
 * The GM's decision on a request, given the world's facts: { ok, reason?, pin?, data? }. `facts`: { user: { id, isGM }, sceneOk
 * (the scene exists and the user is viewing it), dims, levelOk(id), count (pins on the scene), note (existing pin's Note data or null),
 * questOk(id) (the user may see that quest), players, editAll, size }. Never trusts the request for kind, hidden or author.
 */
export function decide(req, facts) {
  if (!req) return { ok: false, reason: "that request couldn't be read" };
  const { user, players = true, editAll = true } = facts;
  if (!facts.sceneOk) return { ok: false, reason: "you can only pin the scene you're viewing" };
  const quest = q => (q && facts.questOk?.(q) ? q : "");
  if (req.op === "create") {
    if (!can("create", user, null, { players, editAll })) return { ok: false, reason: "players can't place map pins in this world" };
    if ((facts.count ?? 0) >= PINS_MAX) return { ok: false, reason: `this scene already has ${PINS_MAX} pins` };
    const pin = normalize({ ...req.pin, quest: quest(req.pin.quest), kind: "party", hidden: false, by: user.id });
    const at = clampPoint(req, facts.dims);
    const level = req.level && facts.levelOk?.(req.level) ? req.level : null;
    return { ok: true, pin, data: noteData(pin, { ...at, level, size: facts.size }) };
  }
  const old = facts.note ? pinOf(facts.note) : null;
  if (!old) return { ok: false, reason: "that pin is gone" };
  if (!can(req.op === "update" ? "edit" : req.op, user, old, { players, editAll })) return { ok: false, reason: "you can't change that pin" };
  if (req.op === "update") {
    const pin = normalize({ ...old, ...req.pin, quest: req.pin.quest === old.quest ? old.quest : quest(req.pin.quest), kind: old.kind, hidden: old.hidden, by: old.by });
    return { ok: true, pin, data: noteUpdate(pin) };
  }
  if (req.op === "move") return { ok: true, pin: old, data: clampPoint(req, facts.dims) };
  return { ok: true, pin: old, data: null };
}

// ---------------------------------------------------------------- quests
/**
 * The linked quest as this user may see it: { id, name, status } or null (no link, the quest is gone, or the user can't see it:
 * nothing about a hidden quest is ever returned). `find(id)` → journal or null; `canSee(journal)`; `info(journal)` → { name, status }.
 * @param {any} pin
 * @param {{ find?: (id: string) => any, canSee?: (j: any) => boolean, info?: (j: any) => any }} [fns]
 */
export function questFor(pin, { find, canSee, info } = {}) {
  if (!pin?.quest || !find) return null;
  const j = find(pin.quest); if (!j) return null;
  if (!canSee?.(j)) return null;
  const i = info?.(j) ?? {}; return { id: pin.quest, name: String(i.name ?? ""), status: String(i.status ?? "") };
}
/** Whether a pin is drawn dimmed: its quest (as this user sees it) is finished, and dimming is on. */
export const dimmed = (quest, dimOn = true) => !!(dimOn && quest && ["completed", "failed"].includes(quest.status));
/** Opacity for a pin on this client: hidden GM pins are faint for the GM (players never draw them), finished quests dimmed. */
export function alphaFor({ pin, isGM, dim }) {
  if (pin?.hidden && isGM) return 0.5;
  return dim ? 0.45 : 1;
}
/** Whether this client draws the pin at all. */
export const drawn = (pin, isGM) => !!pin && (isGM || !pin.hidden);

// ---------------------------------------------------------------- cleanup
/** Pins on every scene, grouped: [{ scene, ids }] (scenes with none left out). `scenes`: iterable of { notes: iterable of Notes }. */
export function pinsByScene(scenes) {
  const out = [];
  for (const s of scenes ?? []) {
    const ids = []; for (const n of s?.notes ?? []) if (isPin(n)) ids.push(n.id ?? n._id);
    if (ids.length) out.push({ scene: s, ids });
  }
  return out;
}

// ---------------------------------------------------------------- forms, GM writes, quest choices, hit test
/**
 * The pin dialog's form object → pin input. Kind and hidden are read only for a GM (a player's pins are always party pins, never
 * hidden); `by` is never read from a form.
 * @param {any} [f]
 * @param {{ isGM?: boolean }} [opts]
 */
export function readForm(f = {}, { isGM = false } = {}) {
  /** @type {any} */
  const out = { label: oneLine(f.label, LABEL_MAX), text: str(f.text, TEXT_MAX), icon: ICONS[f.icon] ? f.icon : "pin", ink: INKS[f.ink] ? f.ink : "iron", quest: isDocId(f.quest) ? f.quest : "" };
  if (isGM) { out.kind = KINDS.includes(f.kind) ? f.kind : "party"; out.hidden = out.kind === "gm" && (f.hidden === true || f.hidden === "on" || f.hidden === "true"); }
  else { out.kind = "party"; out.hidden = false; }
  return out;
}

/**
 * A GM's new pin: Note data, or { error }. `at`: { x, y, level?, size?, dims? }. The GM's own user id is the author.
 * @param {any} input
 * @param {any} user
 * @param {any} [at]
 */
export function gmNote(input, user, at = {}) {
  if (!user?.isGM) return { error: "GM only" };
  const pin = normalize({ ...input, by: user.id });
  if (!pin.label) return { error: "a pin needs a label" };
  const p = clampPoint(at, at.dims);
  return { pin, data: noteData(pin, { ...p, level: at.level ?? null, size: at.size }) };
}

/**
 * Quests offered in the pin dialog: only those `canSee` allows (never a hidden or ungiven quest for a player), sorted by name.
 * @param {any[]} [journals]
 * @param {{ canSee?: (j: any) => boolean, name?: (j: any) => any }} [opts]
 */
export function questChoices(journals = [], { canSee = () => false, name = j => j?.name } = {}) {
  return [...journals].filter(j => j && isDocId(j.id) && canSee(j)).map(j => ({ id: j.id, name: String(name(j) ?? "") })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The pin under a canvas point: `pins` [{ id, x, y, size }] → the nearest id within its icon's radius, or null.
 * @param {any[]} [pins]
 * @param {{ x?: any, y?: any }} [at]
 */
export function hitPin(pins = [], { x, y } = {}) {
  /** @type {any} */
  let best = null, bestD = Infinity;
  for (const p of pins) {
    const r = clampSize(p.size) / 2; const d = Math.hypot(p.x - x, p.y - y);
    if (d <= r && d < bestD) { best = p.id; bestD = d; }
  }
  return best;
}

/**
 * Whether this browser should switch on core's map-notes display so pins show: the setting is on, the scene has pins this user
 * draws, notes are off, and the toolkit hasn't switched them on in this browser before (switched off again later = left off).
 */
export const showNotesNow = ({ setting = true, toggle = false, done = false, hasPins = false } = {}) => !!(setting && hasPins && !toggle && !done);

/** A short line about the pins in a world, for the health check: { pins, scenes, hidden }. */
export function tally(scenes) {
  let pins = 0, hidden = 0; const groups = pinsByScene(scenes);
  for (const g of groups) for (const n of g.scene.notes ?? []) { const p = pinOf(n); if (!p) continue; pins++; if (p.hidden) hidden++; }
  return { pins, scenes: groups.length, hidden };
}

/** A GM's edit of a pin: everything from `input` (kind and hidden too), keeping the author. Moving a pin to "party" un-hides it. */
export function gmUpdate(old, input = {}) {
  const o = normalize(old);
  return normalize({ ...o, ...input, by: o.by });
}
/** The reveal / hide update for a GM pin (party pins can't be hidden). */
export function revealUpdate(old, hidden) {
  const o = normalize(old); if (o.kind !== "gm") return null;
  return noteUpdate({ ...o, hidden: !!hidden });
}

// ---------------------------------------------------------------- 1.27: hidden GM pins live in the GM-only store, not in a Note
/**
 * A hidden GM pin is a record in the GM-only store (vault bucket "pins", keyed by its own id) and has no Note on the scene, so a
 * player client never receives it. Revealing it creates the Note; hiding a revealed pin deletes the Note and stores the record.
 * Record: { id, sceneId, x, y, level, size, pin } with `pin` normalized (kind "gm", hidden true).
 */
export const HIDDEN_MAX = 1000;
const ID_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** A 16-character id like Foundry's. `rand` is for tests. */
export function newPinId(rand = Math.random) { let s = ""; for (let i = 0; i < 16; i++) s += ID_CHARS[Math.floor(rand() * ID_CHARS.length) % ID_CHARS.length]; return s; }

/** A hidden-pin record from a pin and where it goes; null when it isn't a hidden GM pin. */
export function hiddenRecord(pin, { id, sceneId, x, y, level = null, size = SIZE.def }) {
  const p = normalize(pin); if (p.kind !== "gm" || !p.hidden || !isDocId(sceneId) || !isDocId(id)) return null;
  const nx = num(x), ny = num(y); if (nx === null || ny === null) return null;
  return { id, sceneId, x: Math.round(nx), y: Math.round(ny), level: isDocId(level) ? level : null, size: clampSize(size), pin: p, at: Date.now() };
}
/** A stored record cleaned up, or null. */
export function readHidden(r) {
  if (!r || typeof r !== "object") return null;
  const out = hiddenRecord({ ...(r.pin ?? {}), kind: "gm", hidden: true }, r);
  return out && { ...out, at: Number(r.at) || 0 };
}
/**
 * Hidden pins on one scene, from the bucket.
 * @returns {any[]}
 */
export const hiddenOn = (bucket, sceneId) => Object.values(bucket ?? {}).map(readHidden).filter(r => r && r.sceneId === sceneId);
/** The Note data a revealed pin gets (the pin no longer hidden). */
export const revealedNote = r => noteData({ ...r.pin, hidden: false }, { x: r.x, y: r.y, level: r.level, size: r.size });
/** The record a revealed pin's Note becomes when the GM hides it again. */
export const toHidden = (note, sceneId) => hiddenRecord({ ...pinOf(note), kind: "gm", hidden: true }, { id: note.id ?? note._id, sceneId, x: note.x, y: note.y, level: Array.isArray(note.levels) ? note.levels[0] ?? null : null, size: note.iconSize });

/**
 * The one-time move: Notes on a scene that hold a hidden GM pin → records to store, and the Note ids to delete. Pure over
 * [{ id, sceneId, note }] plain data.
 */
export function hiddenToMove(notes = []) {
  const records = []; const del = [];
  for (const { sceneId, note } of notes) {
    const p = pinOf(note); if (!p || p.kind !== "gm" || !p.hidden) continue;
    const r = toHidden(note, sceneId); if (!r) continue;
    records.push(r); del.push({ sceneId, id: r.id });
  }
  return { records, del };
}

/**
 * Whether a pin Note is drawn on this client. A pin Note never has a journal entry, and Foundry's own rule for notes looks at the
 * entry (and hides entry-less notes from players), which is why players saw no pins at all in 1.26 (v14). Pins decide by themselves:
 * a pin drawn by its own rule (hidden ones are never Notes since 1.27, so this is everyone), on this client's level when the Note
 * names levels. `levelOk`: the Note is on the level being viewed (true when the scene has no levels).
 *
 * 1.29: `questOk` false hides a pin linked to a quest this player can't see (another party's quest, or one not given yet).
 */
export const pinVisible = ({ pin, isGM, levelOk = true, questOk = true }) => drawn(pin, isGM) && levelOk && (isGM || !pin?.quest || questOk);
