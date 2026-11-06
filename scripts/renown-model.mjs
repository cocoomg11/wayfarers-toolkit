/**
 * Renown (feature `renown`), the pure rules (no Foundry calls; tested in Node): faction and tier records, each character's renown,
 * tiers and progress, award amounts and dice formulas, the hidden-faction split, quest renown rewards, the hook payload and the
 * Item Piles discount plan. Mechanics are generic and configurable: the GM defines the factions and tiers in their own world.
 *
 * Where things live (renown.mjs reads and writes them):
 *   world setting `renownConfig`      { v, tiers, gains, losses, factions } — shared tiers, award presets, factions players may see
 *   GM-only store bucket `renown`     { v, factions, scores, applied } — hidden factions, characters' renown with them, and the
 *                                     Item Piles price entries the toolkit set (so it only ever changes its own)
 *   actor flag `renown`               { v, scores, ribbons, tracked } — a character's renown with visible factions (players read it)
 *
 * Renown is kept per character, per faction (no party score). A character's total with a faction is its score plus its "other
 * sources" (ribbons the GM adds by hand, e.g. "Bastion +1"), never below 0. Tiers are thresholds on the total. Nothing here moves
 * renown between factions (no opposed pairs) or raises a parent side (the starting-faction bonus is stored as data only).
 */

export const RENOWN_VERSION = 1;
export const FACTIONS_MAX = 100;
export const TIERS_MAX = 8;
export const RIBBONS_MAX = 12;
export const MERCHANTS_MAX = 50;
export const PRESETS_MAX = 6;
export const SCORES_MAX = 200;
export const APPLIED_MAX = 500;
export const NAME_MAX = 80;
export const TEXT_MAX = 200;
export const SCORE_MAX = 9999;
export const AMOUNT_MAX = 999;
export const DISCOUNT_MAX = 100;
/** The hook fired after a character's renown changes (GM client that made the change; ids and numbers only). */
export const RENOWN_HOOK = "wayfarers-toolkit.renownChanged";

/** Generic default tiers (the GM renames them and fills in perks): thresholds 3 / 10 / 25 / 50, discount 0 / 10 / 15 / 25 %. */
export const DEFAULT_TIERS = Object.freeze([
  Object.freeze({ name: "Known", from: 3, discount: 0, rarity: "", perk: "", title: "", color: "#7ad65a" }),
  Object.freeze({ name: "Trusted", from: 10, discount: 10, rarity: "", perk: "", title: "", color: "#3fd18a" }),
  Object.freeze({ name: "Esteemed", from: 25, discount: 15, rarity: "", perk: "", title: "", color: "#4fd2c8" }),
  Object.freeze({ name: "Celebrated", from: 50, discount: 25, rarity: "", perk: "", title: "", color: "#7cc8ff" })
]);
/** Below the first tier. */
export const NO_TIER = Object.freeze({ name: "No tier", color: "#e8d35a" });
/** Award presets: gains (whole numbers) and losses (dice formulas, subtracted). */
export const DEFAULT_GAINS = Object.freeze([1, 2, 3]);
export const DEFAULT_LOSSES = Object.freeze(["1d8", "2d6", "2d12"]);
/** The starting-faction bonus a subfaction's new tiers may give (data only; nothing applies it yet). */
export const START_BONUS = Object.freeze([1, 2, 3, 5]);

// ---------------------------------------------------------------- small helpers
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const str = (v, max = TEXT_MAX) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const int = (v, lo, hi, d = lo) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const ID_RE = /^[A-Za-z0-9]{1,24}$/;
/** Whether a string can be a faction, ribbon or document id. */
export const isId = v => typeof v === "string" && ID_RE.test(v);
const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** A short id (factions, ribbons). `rand` is injectable for tests. */
export const newId = (rand = Math.random) => Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36)]).join("");
/** "+2", "−3", "0". */
export const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

// ---------------------------------------------------------------- tiers
/** One tier, cleaned. `i`: its place (fills a missing name and colour). */
export function normalizeTier(t, i = 0) {
  const o = obj(t); const d = DEFAULT_TIERS[i] ?? DEFAULT_TIERS[DEFAULT_TIERS.length - 1];
  return {
    name: str(o.name, 40) || `Tier ${i + 1}`,
    from: int(o.from, 1, SCORE_MAX, d.from),
    discount: int(o.discount, 0, DISCOUNT_MAX, 0),
    rarity: str(o.rarity), perk: str(o.perk), title: str(o.title, NAME_MAX),
    color: COLOR_RE.test(String(o.color ?? "")) ? String(o.color).toLowerCase() : d.color
  };
}
/**
 * A tier list, cleaned: each tier normalized, sorted by where it starts, one tier per threshold (the first wins), at most TIERS_MAX.
 * An empty or unreadable list gives the defaults (a faction always has at least one tier).
 */
export function normalizeTiers(list) {
  const rows = (Array.isArray(list) ? list : []).filter(t => t && typeof t === "object").map((t, i) => normalizeTier(t, i));
  rows.sort((a, b) => a.from - b.from);
  const seen = new Set(); const out = [];
  for (const t of rows) { if (seen.has(t.from)) continue; seen.add(t.from); out.push(t); if (out.length >= TIERS_MAX) break; }
  return out.length ? out : DEFAULT_TIERS.map(t => ({ ...t }));
}
/** Index of the tier a total reaches (−1: below the first). */
export function tierIndex(total, tiers) {
  let i = -1; (tiers ?? []).forEach((t, k) => { if (total >= t.from) i = k; }); return i;
}
/** The tier a total reaches, or null. */
export const tierAt = (total, tiers) => { const i = tierIndex(total, tiers); return i >= 0 ? tiers[i] : null; };

// ---------------------------------------------------------------- presets
/** Gain presets: whole numbers 1–AMOUNT_MAX, unique, at most PRESETS_MAX; none readable → the defaults. Accepts "1, 2, 3". */
export function normalizeGains(v) {
  const raw = typeof v === "string" ? v.split(/[,\s]+/) : Array.isArray(v) ? v : [];
  const out = [...new Set(raw.map(x => int(String(x).replace(/^\+/, ""), 0, AMOUNT_MAX, 0)).filter(n => n > 0))].slice(0, PRESETS_MAX);
  return out.length ? out : [...DEFAULT_GAINS];
}
/** Loss presets: dice formulas (no sign), unique, at most PRESETS_MAX; none readable → the defaults. Accepts "1d8, 2d6". */
export function normalizeLosses(v) {
  const raw = typeof v === "string" ? v.split(/[,;]+/) : Array.isArray(v) ? v : [];
  const out = [...new Set(raw.map(x => cleanFormula(String(x).replace(/^[-−+]\s*/, ""))).filter(Boolean))].slice(0, PRESETS_MAX);
  return out.length ? out : [...DEFAULT_LOSSES];
}

// ---------------------------------------------------------------- amounts and formulas
const DICE_RE = /^\d{0,3}d\d{1,3}$/i;
const TERM_RE = /^(\d{0,3}d\d{1,3}|\d{1,4})$/i;
/**
 * A dice formula reduced to plain terms ("2d6", "1d8+1", "d4 + 2" → "1d4+2"), or "" when it isn't one: only dice and whole numbers
 * joined by + and −, at least one die, at most 6 terms. Nothing else (no functions, flavour or variables) reaches Foundry's Roll.
 */
export function cleanFormula(text) {
  const s = String(text ?? "").replace(/−/g, "-").replace(/\s+/g, "").toLowerCase();
  if (!s || s.length > 40) return "";
  const parts = s.split(/(?=[+-])/);
  if (parts.length > 6) return "";
  let dice = false; const out = [];
  for (const [i, p] of parts.entries()) {
    const m = p.match(/^([+-]?)(.+)$/); if (!m) return "";
    const sign = m[1] || (i ? "+" : ""); const term = m[2];
    if (!TERM_RE.test(term)) return "";
    if (DICE_RE.test(term)) { dice = true; out.push(sign + (term.startsWith("d") ? `1${term}` : term)); } else out.push(sign + String(Number(term)));
  }
  if (out[0]?.startsWith("+")) out[0] = out[0].slice(1);
  return dice ? out.join("") : "";
}
/**
 * What an award amount means: a number or "+2" / "-3" / "−3" → { kind: "flat", value }; a dice formula → { kind: "dice", formula,
 * sign } where a leading minus makes it a loss (sign −1). null when it is neither (or zero).
 * @returns {{ kind: "flat", value: number } | { kind: "dice", formula: string, sign: 1 | -1 } | null}
 */
export function parseAmount(v) {
  if (typeof v === "number") { const n = int(v, -AMOUNT_MAX, AMOUNT_MAX, 0); return n ? { kind: "flat", value: n } : null; }
  const s = String(v ?? "").replace(/−/g, "-").trim();
  if (!s) return null;
  if (/^[+-]?\s*\d{1,4}$/.test(s)) { const n = int(s.replace(/\s+/g, ""), -AMOUNT_MAX, AMOUNT_MAX, 0); return n ? { kind: "flat", value: n } : null; }
  const neg = /^-/.test(s);
  const formula = cleanFormula(s.replace(/^[+-]\s*/, ""));
  return formula ? { kind: "dice", formula, sign: neg ? -1 : 1 } : null;
}
/** A score after a change: never below 0, never above SCORE_MAX. */
export const applyDelta = (score, delta) => int(Number(score || 0) + Number(delta || 0), 0, SCORE_MAX, 0);

// ---------------------------------------------------------------- factions
/**
 * One faction, cleaned. `id` is kept when valid (else `makeId()`). `tiers` null = the shared tier set. `merchants`: world actor ids of
 * Item Piles merchants who belong to it. `hidden` is not part of the record: where it is stored says that (the world setting for
 * factions players may see, the GM-only store for hidden ones).
 * @param {any} f @param {{ makeId?: () => string }} [o]
 */
export function normalizeFaction(f, { makeId = () => newId() } = {}) {
  const o = obj(f);
  return {
    id: isId(o.id) ? o.id : makeId(),
    name: str(o.name, NAME_MAX) || "New faction",
    note: str(o.note), group: str(o.group, NAME_MAX), parent: str(o.parent, NAME_MAX),
    inactive: !!o.inactive, startBonus: !!o.startBonus,
    tiers: Array.isArray(o.tiers) && o.tiers.length ? normalizeTiers(o.tiers) : null,
    merchants: [...new Set((Array.isArray(o.merchants) ? o.merchants : []).filter(isId))].slice(0, MERCHANTS_MAX)
  };
}
/** A faction list: cleaned, unique ids, at most `max`. */
export function normalizeFactions(list, max = FACTIONS_MAX) {
  const seen = new Set(); const out = [];
  for (const f of Array.isArray(list) ? list : []) {
    if (!f || typeof f !== "object") continue;
    const n = normalizeFaction(f); if (seen.has(n.id)) continue;
    seen.add(n.id); out.push(n); if (out.length >= max) break;
  }
  return out;
}
/** The world setting: { v, tiers, gains, losses, factions } (factions players may see). */
export function normalizeConfig(raw) {
  const o = obj(raw);
  return { v: RENOWN_VERSION, tiers: normalizeTiers(o.tiers), gains: normalizeGains(o.gains), losses: normalizeLosses(o.losses), factions: normalizeFactions(o.factions) };
}
/** The tiers a faction uses: its own set, else the shared one. */
export const tiersOf = (faction, config) => (faction?.tiers?.length ? faction.tiers : config?.tiers?.length ? config.tiers : normalizeTiers(null));
/** The sheet's group label: subfactions under their parent side, others under their group (or "Factions"). */
export const groupOf = f => (f?.parent ? `${f.parent} · subfactions` : f?.group || "Factions");
/** Each merchant's faction ({ merchantId: factionId }); a merchant listed by two factions belongs to the first. */
export function merchantFactions(factions) {
  const out = {};
  for (const f of factions ?? []) for (const m of f.merchants ?? []) if (!(m in out)) out[m] = f.id;
  return out;
}

// ---------------------------------------------------------------- a character's renown
/** One ribbon (an "other source" the GM added by hand): { id, text, amount, at }. */
export function normalizeRibbon(r, { makeId = () => newId(), now = 0 } = {}) {
  const o = obj(r);
  const text = str(o.text, NAME_MAX); if (!text) return null;
  return { id: isId(o.id) ? o.id : makeId(), text, amount: int(o.amount, -AMOUNT_MAX, AMOUNT_MAX, 0), at: Number.isFinite(Number(o.at)) && Number(o.at) > 0 ? Number(o.at) : now };
}
const ribbonList = list => (Array.isArray(list) ? list : []).map(r => normalizeRibbon(r)).filter(Boolean).slice(0, RIBBONS_MAX);
/** One faction's entry for one character: { score, ribbons }. */
export const normalizeEntry = e => ({ score: int(obj(e).score, 0, SCORE_MAX, 0), ribbons: ribbonList(obj(e).ribbons) });
/**
 * The actor flag: { v, scores: { factionId: score }, ribbons: { factionId: [ribbon] }, tracked } (factions players may see).
 * Ids that aren't ids are dropped; at most SCORES_MAX factions.
 */
export function normalizeActor(raw) {
  const o = obj(raw); const scores = {}; const ribbons = {};
  for (const [k, v] of Object.entries(obj(o.scores)).slice(0, SCORES_MAX)) if (isId(k)) { const n = int(v, 0, SCORE_MAX, 0); if (n) scores[k] = n; }
  for (const [k, v] of Object.entries(obj(o.ribbons)).slice(0, SCORES_MAX)) if (isId(k)) { const l = ribbonList(v); if (l.length) ribbons[k] = l; }
  return { v: RENOWN_VERSION, scores, ribbons, tracked: isId(o.tracked) ? o.tracked : "" };
}
/** A character's entry with one faction from the actor flag. */
export const entryOf = (actorData, factionId) => ({ score: actorData?.scores?.[factionId] ?? 0, ribbons: actorData?.ribbons?.[factionId] ?? [] });
/** The actor flag with one faction's entry set (an empty entry is removed). */
export function withEntry(actorData, factionId, entry) {
  const a = normalizeActor(actorData); const e = normalizeEntry(entry);
  const scores = { ...a.scores }; const ribbons = { ...a.ribbons };
  if (e.score) scores[factionId] = e.score; else delete scores[factionId];
  if (e.ribbons.length) ribbons[factionId] = e.ribbons; else delete ribbons[factionId];
  return normalizeActor({ ...a, scores, ribbons });
}
/** The actor flag without one faction (its score, ribbons and tracked mark). */
export function withoutFaction(actorData, factionId) {
  const a = withEntry(actorData, factionId, { score: 0, ribbons: [] });
  return a.tracked === factionId ? { ...a, tracked: "" } : a;
}
/** Total renown: score plus every ribbon's amount, never below 0. */
export const totalOf = e => Math.max(0, Number(e?.score ?? 0) + (e?.ribbons ?? []).reduce((n, r) => n + (Number(r.amount) || 0), 0));

/**
 * The GM-only store bucket: { v, factions (hidden ones), scores: { actorId: { factionId: entry } }, applied: { merchantId: { actorUuid:
 * buyModifier } } }. Capped (factions, SCORES_MAX actors, APPLIED_MAX price entries in all).
 */
export function normalizeHidden(raw) {
  const o = obj(raw); const scores = {}; const applied = {};
  for (const [actor, map] of Object.entries(obj(o.scores)).slice(0, SCORES_MAX)) {
    if (!isId(actor)) continue; const m = {};
    for (const [fid, e] of Object.entries(obj(map))) if (isId(fid)) { const n = normalizeEntry(e); if (n.score || n.ribbons.length) m[fid] = n; }
    if (Object.keys(m).length) scores[actor] = m;
  }
  let count = 0;
  for (const [merchant, map] of Object.entries(obj(o.applied))) {
    if (!isId(merchant)) continue; const m = {};
    for (const [uuid, buy] of Object.entries(obj(map))) {
      if (count >= APPLIED_MAX) break;
      const b = Number(buy); if (typeof uuid === "string" && uuid.length <= 200 && Number.isFinite(b) && b >= 0 && b <= 1) { m[uuid] = b; count++; }
    }
    if (Object.keys(m).length) applied[merchant] = m;
  }
  return { v: RENOWN_VERSION, factions: normalizeFactions(o.factions), scores, applied };
}

// ---------------------------------------------------------------- hidden factions: merged view and moves
/** Every faction for a GM: visible ones, then hidden ones marked `hidden: true`. A hidden id that is also visible is dropped. */
export function allFactions(config, hidden) {
  const vis = (config?.factions ?? []).map(f => ({ ...f, hidden: false }));
  const ids = new Set(vis.map(f => f.id));
  return [...vis, ...(hidden?.factions ?? []).filter(f => !ids.has(f.id)).map(f => ({ ...f, hidden: true }))];
}
/** A faction by id from a merged list. */
export const factionById = (list, id) => (list ?? []).find(f => f.id === id) ?? null;
/**
 * A character's entry with one faction, from where it is kept: the actor flag for visible factions, the GM-only store for hidden ones.
 * @param {{ actorId: string, actorData: any, hidden: any, faction: { id: string, hidden?: boolean } }} f
 */
export function readEntry({ actorId, actorData, hidden, faction }) {
  if (faction?.hidden) return normalizeEntry(hidden?.scores?.[actorId]?.[faction.id]);
  return normalizeEntry(entryOf(normalizeActor(actorData), faction?.id));
}
/** The GM-only bucket with one hidden entry set (an empty entry is removed). */
export function withHiddenEntry(hidden, actorId, factionId, entry) {
  const h = normalizeHidden(hidden); const e = normalizeEntry(entry);
  const m = { ...(h.scores[actorId] ?? {}) };
  if (e.score || e.ribbons.length) m[factionId] = e; else delete m[factionId];
  const scores = { ...h.scores }; if (Object.keys(m).length) scores[actorId] = m; else delete scores[actorId];
  return normalizeHidden({ ...h, scores });
}
/**
 * What hiding or showing a faction moves. Hiding: the definition goes from the world setting to the GM-only store, and each
 * character's entry from its actor flag to the store (the actor flags lose it). Showing: the reverse. `actors`: [{ id, data }] with
 * each actor's flag. Returns { config, hidden, actors: [{ id, data }] } (only actors whose flag changes).
 * @param {{ config: any, hidden: any, actors: Array<{ id: string, data: any }>, factionId: string, hide: boolean }} f
 */
export function moveFaction({ config, hidden, actors, factionId, hide }) {
  const c = normalizeConfig(config); let h = normalizeHidden(hidden);
  const from = hide ? c.factions : h.factions;
  const f = from.find(x => x.id === factionId);
  if (!f) return { config: c, hidden: h, actors: [] };
  const changed = [];
  if (hide) {
    for (const a of actors ?? []) {
      const data = normalizeActor(a.data); const e = entryOf(data, factionId);
      if (!e.score && !e.ribbons.length && data.tracked !== factionId) continue;
      h = withHiddenEntry(h, a.id, factionId, e);
      changed.push({ id: a.id, data: withoutFaction(data, factionId) });
    }
    return { config: { ...c, factions: c.factions.filter(x => x.id !== factionId) }, hidden: normalizeHidden({ ...h, factions: [...h.factions, f] }), actors: changed };
  }
  for (const [actorId, map] of Object.entries(h.scores)) {
    const e = map[factionId]; if (!e) continue;
    const a = (actors ?? []).find(x => x.id === actorId);
    changed.push({ id: actorId, data: withEntry(a?.data, factionId, e) });
    h = withHiddenEntry(h, actorId, factionId, { score: 0, ribbons: [] });
  }
  return { config: normalizeConfig({ ...c, factions: [...c.factions, f] }), hidden: normalizeHidden({ ...h, factions: h.factions.filter(x => x.id !== factionId) }), actors: changed };
}

// ---------------------------------------------------------------- progress and the sheet row
/**
 * A character's standing with a faction: total, tier (index, record), the next tier, the bar's fill and text ("12 / 25 to Esteemed",
 * "60 · top tier"), and the merchant discount (the reached tier's).
 */
export function standing(entry, tiers) {
  const total = totalOf(entry); const i = tierIndex(total, tiers);
  const tier = i >= 0 ? tiers[i] : null; const next = tiers[i + 1] ?? null;
  const start = tier ? tier.from : 0;
  const pct = next ? Math.max(0, Math.min(100, Math.round((total - start) / Math.max(1, next.from - start) * 100))) : 100;
  return {
    total, index: i, tier, next, pct,
    name: tier?.name ?? NO_TIER.name, color: tier?.color ?? NO_TIER.color,
    bar: next ? `${total} / ${next.from} to ${next.name}` : `${total} · top tier`,
    discount: tier?.discount ?? 0
  };
}
/** "10% off" / "10% off, up to Rare" / "no discount". */
export const discountText = t => (t?.discount ? `${t.discount}% off${t.rarity ? `, ${t.rarity}` : ""}` : "no discount");
/** What a tier gives, as one line: perk, title, discount (empty parts left out). */
export const tierText = t => (t ? [t.perk, t.title && `title: ${t.title}`, t.discount ? discountText(t) : ""].filter(Boolean).join(" · ") : "");

// ---------------------------------------------------------------- quest rewards
/** Renown rewards on a quest: [{ faction, amount }], amount a whole number ±1…AMOUNT_MAX, at most 10, one per faction. */
export function normalizeQuestRenown(list) {
  const out = []; const seen = new Set();
  for (const r of Array.isArray(list) ? list : []) {
    const o = obj(r); if (!isId(o.faction) || seen.has(o.faction)) continue;
    const amount = int(String(o.amount ?? "").replace(/−/g, "-"), -AMOUNT_MAX, AMOUNT_MAX, 0); if (!amount) continue;
    seen.add(o.faction); out.push({ faction: o.faction, amount }); if (out.length >= 10) break;
  }
  return out;
}
/** The rewards players may read: those of factions they may see (`shown(id)`). */
export const publicRenown = (/** @type {any} */ list, /** @type {(id: string) => boolean} */ shown = () => true) => normalizeQuestRenown(list).filter(r => shown(r.faction));
/** "Renown: Faction +2" lines; unknown factions (deleted, or hidden from this user) are left out. */
export function renownRewardLines(list, factions) {
  return normalizeQuestRenown(list).map(r => { const f = factionById(factions, r.faction); return f ? `Renown: ${f.name} ${signed(r.amount)}` : ""; }).filter(Boolean);
}

// ---------------------------------------------------------------- hook payload
/** The renownChanged payload: ids and numbers only. null when something is missing. */
export function hookPayload({ actorId, factionId, before, after, delta, tierBefore, tierAfter }) {
  if (!isId(actorId) || !isId(factionId)) return null;
  const n = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  return { actorId, factionId, before: n(before), after: n(after), delta: n(delta), tierBefore: n(tierBefore), tierAfter: n(tierAfter) };
}

// ---------------------------------------------------------------- Item Piles discount plan
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
/** Item Piles' buy-price modifier for a discount (10 → 0.9), or null for none. */
export const buyModifier = discount => (discount > 0 ? Math.round((1 - Math.min(DISCOUNT_MAX, discount) / 100) * 100) / 100 : null);
/** An Item Piles per-actor entry that changes nothing (buy 1, sell 1, not an override): free for the toolkit to use. */
const neutral = e => !!e && near(e.buyPriceModifier ?? 1, 1) && near(e.sellPriceModifier ?? 1, 1) && !e.override;
/**
 * The writes that make one merchant's per-actor buy prices match renown discounts, changing only entries the toolkit set itself.
 * `entries`: the merchant's Item Piles actorPriceModifiers; `applied`: { actorUuid: buy } the toolkit set before; `wants`:
 * { actorUuid: discount % } for the characters to consider. An entry the GM made (or changed since) is left alone (`skipped` when a
 * discount was due). Ending a discount writes a neutral entry (buy 1, sell kept) rather than removing it (Item Piles' API can't).
 * Every write keeps or sets sell 1 so selling prices never change.
 * @returns {{ writes: Array<{ actorUuid: string, buyPriceModifier: number, sellPriceModifier: number, override: false }>, applied: Record<string, number>, skipped: string[] }}
 */
export function merchantPlan({ entries = [], applied = {}, wants = {} }) {
  const writes = []; const skipped = []; const next = {};
  const uuids = [...new Set([...Object.keys(wants ?? {}), ...Object.keys(applied ?? {})])];
  for (const uuid of uuids) {
    const want = buyModifier(Number(wants?.[uuid] ?? 0));
    const entry = (entries ?? []).find(e => e?.actorUuid === uuid) ?? null;
    const had = uuid in (applied ?? {});
    const ours = had && entry && !entry.override && near(entry.buyPriceModifier, applied[uuid]);
    if (entry && !ours && !neutral(entry)) { if (want !== null) skipped.push(uuid); continue; }
    if (want === null) {
      if (ours && !near(entry.buyPriceModifier, 1)) writes.push({ actorUuid: uuid, buyPriceModifier: 1, sellPriceModifier: Number(entry.sellPriceModifier ?? 1), override: false });
      continue;
    }
    next[uuid] = want;
    if (entry && near(entry.buyPriceModifier, want)) continue;
    writes.push({ actorUuid: uuid, buyPriceModifier: want, sellPriceModifier: Number(entry?.sellPriceModifier ?? 1), override: false });
  }
  return { writes, applied: next, skipped };
}
