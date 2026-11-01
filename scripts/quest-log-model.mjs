/**
 * Quest log 1.29 rules, pure (no Foundry calls; tested in Node): the party a quest belongs to, its numeric level and difficulty
 * against that party, objective counters, chosen rewards, the per-party quest cap, who may see a quest, journal ownership, the
 * collapsed zone record and reward item quality.
 *
 * Quest record version 2 (QUEST_VERSION) adds `party` (group actor id; "" = none: GM-only until assigned), `level` as a number
 * (`levelText` keeps text that isn't a number), objective `target` / `progress`, and rewards `choice` / `pick`. Version 0/1 records
 * are read by `normalizeQuest`; the one-time move `quests2` (migrate.mjs) rewrites them and assigns the party actor.
 */

export const QUEST_VERSION = 2;
export const LEVEL_MAX = 30;
export const TARGET_MAX = 9999;
export const CAP_DEFAULT = 25;
export const CAP_MAX = 200;
export const ZONES_MAX = 200;

const int = (n, lo, hi) => { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
const str = v => String(v ?? "").trim();

// ---------------------------------------------------------------- level and difficulty
/**
 * A quest level from what was stored or typed. A number, "4", "Lv 4", "Lvl. 4" or "Level 4" alone gives the number and no text.
 * Since 1.30 "Lv N" / "Lvl N" / "Level N" is also found inside longer text ("Act 4 · Lv 8" → 8): the number is used for the
 * difficulty colour and the whole text is kept for display. A range after the word ("Lv 3-5", "Level 3 to 5") or two different
 * levels in one text give no number (text only), as does text without the word ("Heroic", "3-5", "Act 4").
 * @returns {{ level: number | null, text: string }}
 */
export function parseLevel(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? { level: int(raw, 0, LEVEL_MAX), text: "" } : { level: null, text: "" };
  const s = str(raw); if (!s) return { level: null, text: "" };
  const m = s.match(/^(?:(?:lv|lvl|level)\.?\s*)?(\d{1,3})$/i);
  if (m) return { level: int(m[1], 0, LEVEL_MAX), text: "" };
  const found = [...s.matchAll(/\b(?:lv|lvl|level)\.?\s*(\d{1,3})(?!\d)(\s*(?:-|–|—|to\b)\s*\d)?/gi)];
  if (!found.length || found.some(f => f[2])) return { level: null, text: s };
  const nums = new Set(found.map(f => int(f[1], 0, LEVEL_MAX)));
  return nums.size === 1 ? { level: [...nums][0], text: s } : { level: null, text: s };
}

/** The text a GM edits for a quest's level: the kept text when there is one, else the number. */
export const levelInput = q => (q?.levelText ? String(q.levelText) : typeof q?.level === "number" ? String(q.level) : "");

/** The party's level: the average of its characters' levels, rounded; null with no characters. @param {number[]} levels */
export function partyLevel(levels = []) {
  const ok = (levels ?? []).map(Number).filter(n => Number.isFinite(n) && n > 0);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
}

/** Difficulty bands by quest level minus party level (one place for the thresholds). `max`: the highest difference in the band. */
export const DIFFICULTY = Object.freeze([
  Object.freeze({ id: "trivial", label: "Trivial", colour: "grey", max: -5 }),
  Object.freeze({ id: "easy", label: "Easy", colour: "green", max: -2 }),
  Object.freeze({ id: "even", label: "Even", colour: "yellow", max: 1 }),
  Object.freeze({ id: "hard", label: "Hard", colour: "orange", max: 3 }),
  Object.freeze({ id: "deadly", label: "Deadly", colour: "red", max: Infinity })
]);
/** The band for a quest against a party, or null when either level is unknown. */
export function difficulty(questLevel, pLevel) {
  if (typeof questLevel !== "number" || typeof pLevel !== "number" || !Number.isFinite(questLevel) || !Number.isFinite(pLevel)) return null;
  const d = Math.round(questLevel - pLevel);
  return DIFFICULTY.find(b => d <= b.max) ?? null;
}
/** "[4]" for a numeric level, the kept text otherwise, "" for none. */
export const levelLabel = q => (typeof q?.level === "number" ? `[${q.level}]` : q?.levelText ? `[${q.levelText}]` : "");

// ---------------------------------------------------------------- objectives
/** One objective, cleaned. `target` 0 = no counter; with a counter, done follows progress ≥ target. */
export function normalizeObjective(o, id) {
  const target = int(o?.target ?? 0, 0, TARGET_MAX);
  const progress = target ? int(o?.progress ?? 0, 0, target) : 0;
  return { id: String(o?.id || id), text: str(o?.text), done: target ? progress >= target : !!o?.done, hidden: !!o?.hidden, optional: !!o?.optional, target, progress };
}
/** The objective after GM +/− (`delta`), ticking itself when the target is reached and unticking below it. */
export function stepProgress(o, delta) {
  if (!o?.target) return { ...o };
  const progress = int((o.progress ?? 0) + Number(delta || 0), 0, o.target);
  return { ...o, progress, done: progress >= o.target };
}
/** The objective ticked or unticked by hand: a counter fills up when ticked and drops just below its target when unticked. */
export function tickObjective(o, done) {
  if (!o?.target) return { ...o, done: !!done };
  if (done) return { ...o, done: true, progress: o.target };
  return { ...o, done: false, progress: Math.min(o.progress ?? 0, o.target - 1) };
}
/** "n/m" for a counter, "" without one. */
export const counterText = o => (o?.target ? `${o.progress ?? 0}/${o.target}` : "");
/** Every required objective done (and at least one objective). */
export const allDone = q => (q?.objectives?.length ?? 0) > 0 && q.objectives.filter(o => !o.optional).every(o => o.done);
/** The "(Ready)" tag: an active quest with all required objectives done. */
export const isReady = q => q?.status === "active" && allDone(q);

// ---------------------------------------------------------------- rewards
/** Reward item quality from dnd5e rarity: border colour of its slot. Mundane (no rarity) grey. */
export const QUALITY = Object.freeze({ "": "mundane", common: "common", uncommon: "uncommon", rare: "rare", veryRare: "veryrare", legendary: "legendary", artifact: "legendary" });
export const quality = rarity => QUALITY[str(rarity)] ?? "mundane";

/**
 * A reward item record { uuid, name, img, rarity }. `lookup(uuid)` fills missing fields from the item (or null).
 * @param {any} i @param {(uuid: string) => any} [lookup]
 */
export function normalizeItem(i, lookup = () => null) {
  if (typeof i === "string") i = { uuid: i };
  if (!i?.uuid) return null;
  const src = (!i.name || !i.img || i.rarity === undefined) ? lookup(String(i.uuid)) : null;
  return { uuid: String(i.uuid), name: String(i.name ?? src?.name ?? "Item"), img: String(i.img ?? src?.img ?? "icons/svg/item-bag.svg"), rarity: str(i.rarity ?? src?.system?.rarity ?? "") };
}
/** What paying gives: the fixed items plus the picked one; `missingPick` when there's a choice and nobody picked. */
export function rewardPlan(q) {
  const r = q?.rewards ?? {}; const choice = r.choice ?? [];
  const picked = choice.find(i => i.uuid === r.pick) ?? null;
  return { items: [...(r.items ?? []), ...(picked ? [picked] : [])], picked, missingPick: choice.length > 0 && !picked };
}
/**
 * Whether a pick may be stored: the uuid is one of the choices ("" clears, GM only), rewards aren't paid, the quest is active or
 * completed, and the picker is a GM or a member's owner who sees the quest. @returns {{ ok: boolean, reason?: string }}
 */
export function decidePick(q, uuid, { isGM = false, member = false } = {}) {
  const choice = q?.rewards?.choice ?? [];
  if (!choice.length) return { ok: false, reason: "This quest has no rewards to choose from." };
  if (q.paid) return { ok: false, reason: "The rewards were already paid." };
  if (!["active", "completed"].includes(q.status)) return { ok: false, reason: "The quest isn't given." };
  if (!isGM && !member) return { ok: false, reason: "Only someone in the quest's party can choose." };
  if (!uuid) return isGM ? { ok: true } : { ok: false, reason: "Choose one of the rewards." };
  return choice.some(i => i.uuid === uuid) ? { ok: true } : { ok: false, reason: "That isn't one of the rewards." };
}

// ---------------------------------------------------------------- the record
/**
 * @typedef {{ id?: () => string, lookup?: (uuid: string) => any, statuses?: string[], now?: number }} NormalizeOpts
 */
/**
 * A quest in its current shape from any version. Accepts shortcuts (objectives as strings, giver as a name, items as uuids).
 * `opts.id()` makes objective ids, `opts.lookup(uuid)` fills item names/pictures, `opts.statuses` the known statuses.
 * @param {any} [raw] @param {NormalizeOpts} [opts]
 */
export function normalizeQuest(raw = {}, { id = () => Math.random().toString(36).slice(2, 10), lookup = () => null, statuses = ["available", "active", "completed", "failed"], now = Date.now() } = {}) {
  const q = raw ?? {};
  const giver = typeof q.giver === "string" ? { name: q.giver } : (q.giver ?? {});
  const r = q.rewards ?? {};
  // Version 2 keeps level and text apart; a null level whose text names one ("Act 4 · Lv 8") reads it at once (1.30), and the next
  // save writes the number back. No migration needed.
  const lv = Number(q.v) >= 2 && (typeof q.level === "number" || q.level === null)
    ? { level: typeof q.level === "number" ? int(q.level, 0, LEVEL_MAX) : parseLevel(q.levelText).level, text: str(q.levelText) }
    : parseLevel(q.level);
  /** @param {any} list @returns {Array<{ uuid: string, name: string, img: string, rarity: string }>} */
  const items = list => /** @type {any[]} */ ((Array.isArray(list) ? list : []).map(i => normalizeItem(i, lookup)).filter(Boolean));
  const choice = items(r.choice);
  const pick = choice.some(i => i.uuid === r.pick) ? String(r.pick) : "";
  return {
    v: QUEST_VERSION,
    status: statuses.includes(q.status) ? q.status : "available",
    hidden: !!q.hidden,
    party: str(q.party),
    zone: str(q.zone),
    level: lv.level, levelText: lv.text,
    giver: { name: str(giver.name), uuid: str(giver.uuid) },
    summary: str(q.summary),
    description: String(q.description ?? ""),
    objectives: (Array.isArray(q.objectives) ? q.objectives : []).map(o => (typeof o === "string" ? { text: o } : o)).filter(o => str(o?.text)).map(o => normalizeObjective(o, id())),
    rewards: { coin: str(r.coin), items: items(r.items), choice, pick, other: str(r.other) },
    paid: !!q.paid,
    sort: Number(q.sort) || now
  };
}
/** A stored journal flag from before 1.29 (no party field yet): players see it by the old rule until the move rewrites it. */
export const isLegacy = flag => !!flag && !(Number(flag.v) >= 2);

// ---------------------------------------------------------------- visibility and ownership
/** Whether players are shown the quest at all (given, not hidden). */
export const shown = q => !!q && !q.hidden && q.status !== "available";
/**
 * Whether a player sees a quest: shown, journal readable, and (since 1.29) they own a member of its party. A quest with no party
 * is GM-only. `legacy`: a record from before the move (old rule: shown and readable).
 */
export function visibleTo({ quest, legacy = false, readable = true, member = false, isGM = false }) {
  if (isGM) return true;
  if (!shown(quest) || !readable) return false;
  if (legacy) return true;
  return !!quest.party && !!member;
}
/**
 * Journal ownership for a quest: players who own a member of its party observe it while it's shown; everyone else none.
 * `users`: [{ id, isGM, member }]. Legacy records keep the old default-based rule.
 */
export function questOwnership({ quest, users = [], legacy = false, OBSERVER = 2, NONE = 0 }) {
  if (legacy) return { default: shown(quest) ? OBSERVER : NONE };
  const out = { default: NONE };
  for (const u of users) if (!u.isGM) out[u.id] = shown(quest) && quest.party && u.member ? OBSERVER : NONE;
  return out;
}
/** Whether a journal's ownership already has every level in `want` (missing keys count as none; GM entries aren't compared). */
export function sameOwnership(have = {}, want = {}, NONE = 0) {
  return Object.keys(want).every(k => (have?.[k] ?? NONE) === want[k]);
}

// ---------------------------------------------------------------- parties and the cap
/**
 * The parties: the ids in the Parties setting that are group actors; none listed → the party actor.
 * @param {any} setting @param {string} fallbackId @param {(id: string) => boolean} [isGroup]
 */
export function partyIds(setting, fallbackId, isGroup = () => true) {
  const ids = [...new Set((Array.isArray(setting) ? setting : []).map(String).filter(Boolean))].filter(isGroup);
  if (ids.length) return ids;
  return fallbackId && isGroup(fallbackId) ? [String(fallbackId)] : [];
}
/** The cap setting, cleaned (1 – CAP_MAX). */
export const readCap = v => (Number.isFinite(Number(v)) && Number(v) >= 1 ? int(v, 1, CAP_MAX) : CAP_DEFAULT);
/** Active quests per party: { [partyId]: n }. @param {Array<{ party: string, status: string }>} quests */
export function activeByParty(quests = []) {
  const out = {};
  for (const q of quests) if (q?.status === "active" && q.party) out[q.party] = (out[q.party] ?? 0) + 1;
  return out;
}
/** Whether giving one more active quest to the party goes past the cap (warn only; never blocks). */
export const overCap = (activeNow, cap) => Number(activeNow) + 1 > readCap(cap);
/** "Quest Log (n / cap)" for one party; "Quest Log (n)" when several parties are shown together. */
export const capHeader = (n, cap, together = false) => (together ? `Quest Log (${n})` : `Quest Log (${n} / ${readCap(cap)})`);

// ---------------------------------------------------------------- collapsed zones (client)
/** The client's collapsed zones { v: 1, zones: { name: true } }, capped. */
export function readCollapsed(raw) {
  const z = raw && typeof raw === "object" && raw.zones && typeof raw.zones === "object" ? raw.zones : {};
  const zones = {};
  for (const k of Object.keys(z).slice(0, ZONES_MAX)) if (z[k] === true && k.length <= 200) zones[k] = true;
  return { v: 1, zones };
}
/** The record with one zone flipped. */
export function toggleZone(raw, zone) {
  const r = readCollapsed(raw); const k = String(zone ?? "");
  if (r.zones[k]) delete r.zones[k];
  else { const keys = Object.keys(r.zones); if (keys.length >= ZONES_MAX) delete r.zones[keys[0]]; r.zones[k] = true; }
  return r;
}
