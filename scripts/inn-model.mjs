/**
 * Rested at the inn (feature restedInn): inn scenes, room costs, paying, and what a long rest after renting a room gives. Pure, no
 * Foundry calls (tested in Node). Amounts are in the smallest coin in use; `coins` is [[key, value]] most valuable first (as
 * api.coins() returns), so the standard five coins and the three-coin economy both work.
 *
 * Scene flag `flags.wayfarers-toolkit.inn`: { on, name, price } (price as typed: "5s", "1g 20s" or a plain number in the fare unit).
 * Actor flag `flags.wayfarers-toolkit.rested`: { scene, inn, at } (scene id, inn name, world time when the room was rented).
 */
const ID = "wayfarers-toolkit";
const str = v => (typeof v === "string" ? v.trim() : "");

/** Default room price per person per night: 5 silver (read the same way in both coin systems). */
export const DEFAULT_PRICE = "5s";
export const BENEFITS = { inspiration: "Heroic Inspiration", hitDie: "Regain one extra Hit Die", tempHp: "Temporary hit points equal to character level" };
export const PAY_FROM = { party: "The party actor's coin", each: "Each character's own coin" };

/** A scene's inn: { on, name, priceText }. Blank price → the default. */
export function innOf(scene, { defaultPrice = DEFAULT_PRICE } = {}) {
  const f = scene?.flags?.[ID]?.inn ?? {};
  return { on: f.on === true, name: str(f.name) || str(scene?.name) || "the inn", priceText: str(f.price) || str(defaultPrice) || DEFAULT_PRICE };
}

/** Whether an inn's price text can be read: `parse` is the money parser (text → amount). { ok, amount }. */
export function readPrice(text, parse) {
  const t = str(text); if (!t) return { ok: false, amount: 0 };
  const amount = Math.round(Number(parse(t)));
  return Number.isFinite(amount) && amount > 0 ? { ok: true, amount } : { ok: false, amount: 0 };
}

/** Price per person × people. */
export const roomCost = (perPerson, people) => Math.max(0, Math.round(perPerson || 0)) * Math.max(0, Math.floor(people || 0));

/** Total of a currency object in the smallest coin. */
export const total = (currency, coins) => coins.reduce((t, [k, v]) => t + (currency?.[k] || 0) * v, 0);

/**
 * Pays `amount` from `currency`: the smallest coins first, then one larger coin broken with change (never electrum as change), the same
 * way Flight Master pays fares. Returns the new currency, or null when there isn't enough. The input isn't changed.
 */
export function spend(currency, amount, coins) {
  const c = { ...(currency ?? {}) }; let need = Math.max(0, Math.round(amount || 0));
  if (total(c, coins) < need) return null;
  const asc = [...coins].reverse();
  for (const [k, v] of asc) { const take = Math.min(c[k] || 0, Math.floor(need / v)); c[k] = (c[k] || 0) - take; need -= take * v; }
  if (need > 0) {
    for (const [k, v] of asc) {
      if ((c[k] || 0) > 0 && v >= need) {
        c[k] -= 1; let change = v - need; need = 0;
        for (const [k2, v2] of coins) { if (v2 >= v || k2 === "ep") continue; const n = Math.floor(change / v2); c[k2] = (c[k2] || 0) + n; change -= n * v2; }
        break;
      }
    }
  }
  return need > 0 ? null : c;
}

/**
 * The payment for a night: { ok, total, payers: [{ id, currency }], short: [name], error }.
 * `from`: party | each. `chosen`: [{ id, name, currency }]. `party`: { id, name, currency } | null. Nothing is paid unless all of it can be.
 * @param {{ from?: string, price: number, chosen?: any[], party?: any, coins: any, fmt?: (n: number) => string }} opts
 */
export function payPlan({ from = "party", price, chosen = [], party = null, coins, fmt = n => String(n) }) {
  const n = chosen.length; const sum = roomCost(price, n);
  if (!n) return { ok: false, total: 0, payers: [], short: [], error: "No characters chosen." };
  if (!(price > 0)) return { ok: false, total: 0, payers: [], short: [], error: "The inn has no room price." };
  if (from === "each") {
    const payers = []; const short = [];
    for (const a of chosen) { const c = spend(a.currency, price, coins); if (c) payers.push({ id: a.id, currency: c }); else short.push(a.name); }
    if (short.length) return { ok: false, total: sum, payers: [], short, error: `Not enough coin for a room (${fmt(price)} each): ${short.join(", ")}.` };
    return { ok: true, total: sum, payers, short: [], error: null };
  }
  if (!party) return { ok: false, total: sum, payers: [], short: [], error: "No party actor to pay from (Run setup creates it, or pay from each character's own coin)." };
  const c = spend(party.currency, sum, coins);
  if (!c) return { ok: false, total: sum, payers: [], short: [party.name], error: `${party.name} has ${fmt(total(party.currency, coins))}; rooms cost ${fmt(sum)}.` };
  return { ok: true, total: sum, payers: [{ id: party.id, currency: c }], short: [], error: null };
}

/** The Rested flag for a character renting a room. */
export const restedFlag = ({ sceneId, inn, at }) => ({ scene: sceneId ?? null, inn: str(inn) || "the inn", at: Number(at) || 0 });

/**
 * What a long rest does with Rested: "grant" (give the benefit, then clear), "lose" (clear, no benefit) or "none" (not rested).
 * `onInn`: the character rests on an Inn scene; `lastsAnywhere`: the world setting "Rested lasts until the next long rest anywhere".
 */
export function restOutcome({ rested, onInn, lastsAnywhere = true }) {
  if (!rested) return "none";
  return onInn || lastsAnywhere ? "grant" : "lose";
}

/**
 * The benefit as updates: { actor: {path: value}, items: [{ _id, path: value }], text, granted }.
 * facts: { inspiration (bool), temp (current temp HP), level (character level), classes: [{ id, name, denomination ("d10"), spent }] }.
 */
export function benefitPlan(benefit, facts = {}) {
  if (benefit === "hitDie") {
    const die = n => Number(String(n ?? "").replace(/\D/g, "")) || 0;
    const pick = [...(facts.classes ?? [])].filter(c => (c.spent || 0) > 0).sort((a, b) => die(b.denomination) - die(a.denomination))[0];
    if (!pick) return { actor: {}, items: [], text: "no spent Hit Dice left to regain", granted: false };
    return { actor: {}, items: [{ _id: pick.id, "system.hd.spent": pick.spent - 1 }], text: `regains one extra Hit Die (${pick.denomination}${pick.name ? `, ${pick.name}` : ""})`, granted: true };
  }
  if (benefit === "tempHp") {
    const lvl = Math.max(0, Math.floor(facts.level || 0)); const cur = Math.max(0, Math.floor(facts.temp || 0));
    if (!lvl) return { actor: {}, items: [], text: "no character level, so no temporary hit points", granted: false };
    if (cur >= lvl) return { actor: {}, items: [], text: `already has ${cur} temporary hit points (they don't stack)`, granted: false };
    return { actor: { "system.attributes.hp.temp": lvl }, items: [], text: `gains ${lvl} temporary hit points`, granted: true };
  }
  if (facts.inspiration) return { actor: {}, items: [], text: "already has Heroic Inspiration", granted: false };
  return { actor: { "system.attributes.inspiration": true }, items: [], text: "gains Heroic Inspiration", granted: true };
}

/** A player's room request (core request data): { sceneId } or null. The sender is Foundry's, never a field. */
export function readRoomRequest(msg) {
  if (!msg || msg.action !== "roomRequest" || typeof msg.sceneId !== "string" || !msg.sceneId) return null;
  return { sceneId: msg.sceneId };
}
/** A player's long-rest report over the socket: { actorId, sceneId } or null. */
export function readRestReport(msg) {
  if (!msg || msg.action !== "restedRest" || typeof msg.actorId !== "string" || !msg.actorId) return null;
  return { actorId: msg.actorId, sceneId: typeof msg.sceneId === "string" ? msg.sceneId : null };
}

// ---------------------------------------------------------------- 1.27: inns are records on a scene, rentals are GM-side
/**
 * Inns are records in the scene flag `flags.wayfarers-toolkit.inns` = { v: INNS_VERSION, list: [inn] } (several per scene, capped at
 * INNS_MAX). An inn: { id, name, price ("5s", per person per night), innkeeper: { actor (UUID), token (token id) } | null,
 * region (v14 Region id) | null }. The old one-per-scene flag `inn` = { on, name, price } becomes one record (one-time GM move; the
 * old flag is kept).
 *
 * Rentals are GM-side records (GM-only store, bucket "rentals", keyed by actor id): { innId, inn, sceneId, at, by }. Rested on a
 * character is only shown by its flag; the long-rest benefit is granted only when a GM-side rental for that character exists, so a
 * player who writes the Rested flag on their own character gets nothing.
 */
export const INNS_VERSION = 1;
export const INNS_MAX = 20;
export const RENTALS_MAX = 200;
const ID_RE = /^[A-Za-z0-9]{16}$/;
const isId = v => typeof v === "string" && ID_RE.test(v);
const shortId = v => (typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null);
const UUID_RE = /^[A-Za-z0-9_.-]{3,300}$/;

/** One inn record cleaned up (id kept or given), or null without an id. */
export function cleanInn(raw, idFn) {
  if (!raw || typeof raw !== "object") return null;
  const id = shortId(raw.id) ?? (idFn ? idFn() : null); if (!id) return null;
  const k = raw.innkeeper && typeof raw.innkeeper === "object" ? raw.innkeeper : null;
  const actor = k && typeof k.actor === "string" && UUID_RE.test(k.actor) && k.actor.includes(".") ? k.actor : null;
  const token = k && isId(k.token) ? k.token : null;
  return { id, name: str(raw.name).slice(0, 80), price: str(raw.price).slice(0, 40), innkeeper: actor || token ? { actor, token } : null, region: isId(raw.region) ? raw.region : null };
}

/** The scene's inns ({ v, list }) from its flags, cleaned and capped. A missing or unreadable flag: no inns. */
export function innsOf(flags) {
  const f = flags?.[ID]?.inns;
  const list = Array.isArray(f?.list) ? f.list : [];
  const seen = new Set(); const out = [];
  for (const r of list) { const c = cleanInn(r); if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c); } if (out.length >= INNS_MAX) break; }
  return { v: INNS_VERSION, list: out };
}

/** The record an old `inn` flag ({ on, name, price }) becomes, or null when the scene wasn't an inn. */
export function innFromLegacy(flags, sceneName = "", id = "inn1") {
  const f = flags?.[ID]?.inn;
  if (!f || f.on !== true) return null;
  return cleanInn({ id, name: str(f.name) || str(sceneName), price: str(f.price) }, null);
}

/** Whether the scene still needs the one-time move: an old inn flag that's on, and no inns list yet. */
export const needsInnMove = flags => !!innFromLegacy(flags) && !Array.isArray(flags?.[ID]?.inns?.list);

/** A new list with `inn` added or replaced (by id); refuses past the cap. { ok, inns, error }. */
export function upsertInn(inns, inn) {
  const cur = innsOf({ [ID]: { inns } }).list; const c = cleanInn(inn); if (!c) return { ok: false, inns: { v: INNS_VERSION, list: cur }, error: "That inn has no id." };
  const i = cur.findIndex(x => x.id === c.id);
  if (i < 0 && cur.length >= INNS_MAX) return { ok: false, inns: { v: INNS_VERSION, list: cur }, error: `A scene can have up to ${INNS_MAX} inns.` };
  const list = i < 0 ? [...cur, c] : cur.map(x => (x.id === c.id ? c : x));
  return { ok: true, inns: { v: INNS_VERSION, list }, error: null };
}
export const removeInn = (inns, id) => ({ v: INNS_VERSION, list: innsOf({ [ID]: { inns } }).list.filter(x => x.id !== id) });

/** An inn as shown and charged: { ...record, displayName, priceText } (blank name: the scene's; blank price: the default). */
export function innView(inn, { sceneName = "", defaultPrice = DEFAULT_PRICE } = {}) {
  return { ...inn, displayName: str(inn?.name) || str(sceneName) || "the inn", priceText: str(inn?.price) || str(defaultPrice) || DEFAULT_PRICE };
}

/** The inn whose innkeeper is this token (id) on the scene, or null. */
export const innOfToken = (inns, tokenId) => innsOf({ [ID]: { inns } }).list.find(x => x.innkeeper?.token === tokenId) ?? null;

/** A rental record for one character. */
export const rentalFor = ({ innId, inn, sceneId, at, by }) => ({ innId: shortId(innId), inn: str(inn) || "the inn", sceneId: isId(sceneId) ? sceneId : null, at: Number(at) || 0, by: isId(by) ? by : null });

/** The rentals bucket with these characters' rentals set (newest kept within the cap). */
export function addRentals(bucket, actorIds, rental) {
  const out = { ...(bucket && typeof bucket === "object" ? bucket : {}) };
  for (const a of actorIds) if (isId(a)) out[a] = { ...rentalFor(rental), at: Number(rental.at) || 0, t: Date.now() };
  const entries = Object.entries(out);
  if (entries.length <= RENTALS_MAX) return out;
  return Object.fromEntries(entries.sort((a, b) => (b[1].t ?? 0) - (a[1].t ?? 0)).slice(0, RENTALS_MAX));
}

/**
 * What a long rest does, checked against the GM-side rental (not the character's flag): "grant", "lose" or "none".
 * `rental` is the stored record for this character (or null). `onInn`: rested on a scene with an inn (an inn's Region, when it has
 * one and the token position is known: `inRegion`).
 */
export function restOutcomeChecked({ rental, onInn, lastsAnywhere = true }) {
  if (!rental) return "none";
  return onInn || lastsAnywhere ? "grant" : "lose";
}
