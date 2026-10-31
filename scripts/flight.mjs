/**
 * Flight Master's network, checks, money text and the importer for the old journal tables, without Foundry globals (tested in Node).
 * Amounts are in the smallest coin in use. Also the Hex Travel encounter-zone parser.
 */

// ---------------------------------------------------------------- the flight network (the flightNetwork world setting)
/**
 * { version: 1, points: [{ id, name, sceneUuid | null, unlocked, note }], routes: [{ id, from, to, fareCp, hours, twoWay, free }] }.
 * `from` / `to` are point ids; fareCp is the fare per passenger in the smallest coin in use; `free` makes a route cost nothing.
 */
export const VERSION = 1;
export const emptyNetwork = () => ({ version: VERSION, points: [], routes: [] });

let idSeq = 0;
/** A short id; Foundry's randomID when it's there (in the browser), a counter in Node. */
export const newId = () => globalThis.foundry?.utils?.randomID?.(12) ?? `id${Date.now().toString(36)}${(++idSeq).toString(36)}`;
const str = v => (v == null ? "" : String(v)).trim();
const nameKey = n => str(n).toLowerCase();

/**
 * Reads whatever is stored (or passed to setNetwork) into a clean network. Never throws: missing or wrong-typed fields get defaults,
 * points and routes without an id (or with a repeated one) get a new id, and a route may name its points by name instead of id.
 */
export function normalizeNetwork(raw, idFn = newId) {
  const src = raw && typeof raw === "object" ? raw : {};
  const net = emptyNetwork(); const ids = new Set();
  const uid = id => { id = str(id); if (!id || ids.has(id)) { do id = idFn(); while (ids.has(id)); } ids.add(id); return id; };
  for (const p of Array.isArray(src.points) ? src.points : []) {
    if (!p || typeof p !== "object") continue;
    const scene = str(p.sceneUuid);
    net.points.push({ id: uid(p.id), name: str(p.name), sceneUuid: scene || null, unlocked: p.unlocked === true || /^(y|yes|true)$/i.test(str(p.unlocked)), note: str(p.note) });
  }
  const byId = new Set(net.points.map(p => p.id));
  const byName = new Map(); for (const p of net.points) if (p.name && !byName.has(nameKey(p.name))) byName.set(nameKey(p.name), p.id);
  const ref = v => { v = str(v); return byId.has(v) ? v : byName.get(nameKey(v)) ?? v; };
  for (const r of Array.isArray(src.routes) ? src.routes : []) {
    if (!r || typeof r !== "object") continue;
    const fare = Math.round(+r.fareCp); const hours = +r.hours;
    net.routes.push({ id: uid(r.id), from: ref(r.from), to: ref(r.to), fareCp: Number.isFinite(fare) && fare > 0 ? fare : 0, hours: Number.isFinite(hours) && hours > 0 ? hours : 0, twoWay: r.twoWay !== false, free: r.free === true });
  }
  return net;
}

/** A point by id, or by name (case and surrounding spaces ignored). */
export function findPoint(net, key) {
  const k = str(key); if (!k) return null;
  return net.points.find(p => p.id === k) ?? net.points.find(p => nameKey(p.name) === nameKey(k)) ?? null;
}
const pname = (net, id) => net.points.find(p => p.id === id)?.name || id;

/**
 * Problems that stop a save (level "error") or are worth a look ("warn"): [{ level, where: "point" | "route", index, field, message }].
 * Errors: an empty or repeated point name, a route to or from an unknown point, a route from a point to itself.
 */
export function validateNetwork(net) {
  const out = []; const add = (level, where, index, field, message) => out.push({ level, where, index, field, message });
  const seen = new Map();
  net.points.forEach((p, i) => {
    if (!p.name) return add("error", "point", i, "name", "needs a name");
    const k = nameKey(p.name);
    if (seen.has(k)) add("error", "point", i, "name", `"${p.name}" is already flight point ${seen.get(k) + 1}`); else seen.set(k, i);
  });
  const ids = new Set(net.points.map(p => p.id)); const pairs = new Map();
  net.routes.forEach((r, i) => {
    let bad = false;
    for (const f of ["from", "to"]) if (!ids.has(r[f])) { bad = true; add("error", "route", i, f, r[f] ? `"${r[f]}" isn't a flight point` : `pick a flight point to fly ${f}`); }
    if (bad) return;
    if (r.from === r.to) return add("error", "route", i, "to", "a route can't go to the point it starts from");
    const key = r.twoWay ? [r.from, r.to].sort().join("|") : `${r.from}>${r.to}`;
    if (pairs.has(key)) add("warn", "route", i, "to", `same flight as route ${pairs.get(key) + 1} (the cheaper one is used)`); else pairs.set(key, i);
  });
  return out;
}
export const problemText = p => `${p.where === "point" ? "Flight point" : "Route"} ${p.index + 1}: ${p.message}`;

/** Legs that leave `id`: [{ to, f, h }] (one-way routes only from their start; free routes cost 0). */
function legs(net, id) {
  const out = [];
  for (const r of net.routes) {
    const f = r.free ? 0 : r.fareCp;
    if (r.from === id) out.push({ to: r.to, f, h: r.hours });
    else if (r.to === id && r.twoWay) out.push({ to: r.from, f, h: r.hours });
  }
  return out;
}

/** Cheapest route between two point ids through unlocked points: { f, h, path: [ids] } or null. */
export function route(net, from, to) {
  const open = new Set(net.points.filter(p => p.unlocked).map(p => p.id));
  const dist = { [from]: { f: 0, h: 0, path: [from] } }; const done = new Set();
  while (true) {
    const cur = Object.keys(dist).filter(k => !done.has(k)).sort((x, y) => dist[x].f - dist[y].f || dist[x].h - dist[y].h)[0];
    if (!cur) return null; if (cur === to) return dist[cur]; done.add(cur);
    for (const l of legs(net, cur)) {
      if (!open.has(l.to) || done.has(l.to)) continue;
      const nf = dist[cur].f + l.f; if (!dist[l.to] || nf < dist[l.to].f) dist[l.to] = { f: nf, h: dist[cur].h + l.h, path: [...dist[cur].path, l.to] };
    }
  }
}

/** Fare maths: total for the passengers, whether the purse covers it and by how much it falls short. `purse` null = no party actor. */
export function quote(farePer, pax, purse = null) {
  const total = Math.max(0, Math.round(farePer)) * Math.max(1, Math.floor(pax || 1));
  if (purse == null) return { total, canPay: true, short: 0, charge: false };
  const have = Math.max(0, Math.round(purse));
  return { total, canPay: have >= total, short: Math.max(0, total - have), have, charge: true };
}

/** Passengers as a whole number from 1 to 20. */
export const clampPax = pax => Math.min(20, Math.max(1, Math.floor(+pax || 1)));

/**
 * What happens to the scene on arrival: { sceneUuid, change, reason } with reason "ok" (open it), "none" (the point has no scene) or
 * "missing" (its scene was deleted). Without a scene the flight still happens; only the scene stays where it is.
 */
export function landing(dest, sceneExists = () => true) {
  if (!dest?.sceneUuid) return { sceneUuid: null, change: false, reason: "none" };
  if (!sceneExists(dest.sceneUuid)) return { sceneUuid: dest.sceneUuid, change: false, reason: "missing" };
  return { sceneUuid: dest.sceneUuid, change: true, reason: "ok" };
}

/**
 * Every check before a flight, in order: { ok: true, r, q, dest, land, free } or { ok: false, error }. `from` / `to` are point ids or names.
 * `purse` is the party's total (null when there's no party actor, which flies free). `free`: a GM's free flight (no fare, no purse check).
 * Nothing is charged here.
 */
export function check({ net, from, to, pax = 1, purse = null, fmt = String, free = false, sceneExists }) {
  const a = findPoint(net, from), b = findPoint(net, to);
  if (!from || !to) return { ok: false, error: "Pick two different flight points." };
  if (!a || !b) return { ok: false, error: `"${!a ? from : to}" isn't a flight point.` };
  if (a.id === b.id) return { ok: false, error: "Pick two different flight points." };
  const label = `${a.name} → ${b.name}`;
  for (const p of [a, b]) if (!p.unlocked) return { ok: false, error: `${label}: ${p.name} isn't unlocked.` };
  const r = route(net, a.id, b.id);
  if (!r) {
    const ids = new Set(net.points.map(p => p.id));
    const bad = net.routes.find(x => (x.from === a.id || x.to === a.id || x.from === b.id || x.to === b.id) && (!ids.has(x.from) || !ids.has(x.to)));
    if (bad) return { ok: false, error: `${label}: a route names a flight point that no longer exists (${[bad.from, bad.to].filter(id => !ids.has(id)).join(", ")}).` };
    return { ok: false, error: `No route from ${a.name} to ${b.name} through unlocked flight points.` };
  }
  r.names = r.path.map(id => pname(net, id));
  const q = free ? { ...quote(0, pax, null), charge: false } : quote(r.f, pax, purse);
  if (!q.canPay) return { ok: false, error: `The party can't afford this: needs ${fmt(q.total)}, has ${fmt(q.have)} (short ${fmt(q.short)}).`, r, q };
  return { ok: true, r, q, dest: b, from: a, land: landing(b, sceneExists), free: !!free };
}

/**
 * What a flight does, on the GM's client, before anything changes: check() plus { charge, changeScene, tellNoScene }. `byPlayer`: the
 * booking came from a player, so `free` is ignored (only a route marked Free costs a player nothing). `charge` is what comes out of the
 * purse (0 for a free flight or with no party actor); `changeScene` is whether to open the destination scene (`wantScene` and the
 * point has an existing scene); `tellNoScene` is whether to whisper the GM that the scene stayed put because the point has none.
 */
export function decide({ byPlayer = false, free = false, wantScene = true, ...args }) {
  free = !byPlayer && !!free;
  const c = check({ ...args, free });
  if (!c.ok) return { ...c, charge: 0, changeScene: false, tellNoScene: false };
  return { ...c, charge: !free && c.q.charge ? c.q.total : 0, changeScene: !!wantScene && c.land.change, tellNoScene: c.land.reason !== "ok" };
}

/** A booking a player sent over the socket, cleaned: a player can't ask for a free flight or skip the scene change. */
export const socketBooking = msg => ({ from: str(msg?.from), to: str(msg?.to), pax: clampPax(msg?.pax), free: false, scene: true });

/** Health-check facts about a network: points without a scene, routes into locked points, references to unknown points. */
export function networkFacts(net, sceneExists = () => true) {
  const ids = new Set(net.points.map(p => p.id)); const locked = new Set(net.points.filter(p => !p.unlocked).map(p => p.id));
  return {
    noScene: net.points.filter(p => !p.sceneUuid).map(p => p.name),
    missingScene: net.points.filter(p => p.sceneUuid && !sceneExists(p.sceneUuid)).map(p => p.name),
    toLocked: net.routes.filter(r => ids.has(r.from) && ids.has(r.to) && (locked.has(r.to) || (r.twoWay && locked.has(r.from)))).map(r => `${pname(net, r.from)} ${r.twoWay ? "↔" : "→"} ${pname(net, r.to)}`),
    unknown: net.routes.filter(r => !ids.has(r.from) || !ids.has(r.to)).map(r => `${pname(net, r.from)} → ${pname(net, r.to)}`)
  };
}

// ---------------------------------------------------------------- money text (pure; main.mjs passes the dnd5e coins)
/**
 * "1g 20s", "2 gp", "75c" or a plain number (read in `unit`) → amount in the smallest coin. `val`: { coinKey: value in smallest coin };
 * `keyOf` maps a written coin ("g", "gold", "gp") to a key. Same rules as every earlier version's fare reader.
 */
export function parseCoins(text, val, unit, keyOf) {
  const s = String(text ?? "").trim(); if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(+s * (val[unit] ?? val.gp ?? 1));
  let total = 0, hit = false;
  for (const [, n, u] of s.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/gi)) { const k = keyOf(u); if (k && val[k]) { total += +n * val[k]; hit = true; } }
  return Math.round(hit ? total : (parseFloat(s) || 0) * (val[unit] ?? 1));
}
/** Amount in the smallest coin → "1g 20s 5c" (tight) or "1 gp 2 sp". `coins`: [[key, value]] most valuable first; electrum never used. */
export function formatCoins(amount, coins, abbr, tight = false) {
  amount = Math.max(0, Math.round(+amount || 0)); const parts = [];
  for (const [k, v] of coins) { if (k === "ep") continue; const n = Math.floor(amount / v); if (n) { parts.push(`${n}${tight ? "" : " "}${abbr[k] ?? k}`); amount -= n * v; } }
  return parts.join(" ") || `0${tight ? "" : " "}${abbr[coins.at(-1)[0]] ?? coins.at(-1)[0]}`;
}

// ---------------------------------------------------------------- the pre-1.16 Flight Routes journal page (import only)
/**
 * The old tables → a network, plus a report of what needs a look: { network, report: [text], counts }. pointRows: [name, scene name,
 * unlocked]; routeRows: [from, to, fare, hours]. Scenes match by exact name (`scenes`: [{ name, uuid }]); a missing or ambiguous name
 * imports as "No scene". Fares go through `parse` (the old reader's parseMoney). Old routes flew both ways, so every route is two-way.
 */
export function importLegacy({ pointRows = [], routeRows = [], scenes = [], parse = s => Math.round(+s || 0), idFn = newId } = {}) {
  const report = []; const points = []; const byName = new Map();
  const sceneByName = new Map(); for (const s of scenes) sceneByName.set(s.name, [...(sceneByName.get(s.name) ?? []), s.uuid]);
  pointRows.forEach((row, i) => {
    const [n, sc, u] = row.map(c => str(c));
    if (row.every(c => !str(c))) return;
    if (!n) return report.push(`Flight Points row ${i + 1}: no name, skipped.`);
    if (byName.has(n)) return report.push(`Flight Points row ${i + 1}: "${n}" is listed twice; the first row was kept.`);
    let sceneUuid = null;
    if (sc) {
      const hit = sceneByName.get(sc) ?? [];
      if (hit.length === 1) sceneUuid = hit[0];
      else report.push(hit.length ? `${n}: ${hit.length} scenes are named "${sc}", so it has no scene; pick one in the editor.` : `${n}: no scene named "${sc}", so it has no scene; pick one in the editor.`);
    }
    const p = { id: idFn(), name: n, sceneUuid, unlocked: /^y/i.test(u || ""), note: "" };
    points.push(p); byName.set(n, p.id);
  });
  const routes = [];
  routeRows.forEach((row, i) => {
    const [a, b, f, h] = row.map(c => str(c));
    if (row.every(c => !str(c))) return;
    const miss = [a, b].filter(x => !byName.has(x));
    if (miss.length) return report.push(`Routes row ${i + 1} (${a || "?"} → ${b || "?"}): ${miss.map(x => x ? `"${x}" isn't in the Flight Points table` : "a point is empty").join(", ")}; skipped.`);
    if (a === b) return report.push(`Routes row ${i + 1}: ${a} → ${a} goes nowhere; skipped.`);
    if (f && !fareOk(f)) report.push(`Routes row ${i + 1}: fare "${f}" read as ${parse(f)} (as before); check it in the editor.`);
    routes.push({ id: idFn(), from: byName.get(a), to: byName.get(b), fareCp: Math.max(0, parse(f)), hours: Math.max(0, +h || 0), twoWay: true, free: false });
  });
  return { network: normalizeNetwork({ version: VERSION, points, routes }, idFn), report, counts: { points: points.length, routes: routes.length, noScene: points.filter(p => !p.sceneUuid).length } };
}

/** Whether the old page's tables hold anything worth importing. */
export const legacyHasRows = (pointRows = []) => pointRows.some(r => r.some(c => str(c)));

// ---------------------------------------------------------------- settings and table checks (pure)
/**
 * Parses the Encounter zones setting: { zones, error } where `error` names the JSON problem and where it is ("line 1, column 13")
 * or says the value isn't an object of zone → table name.
 */
export function parseZones(text) {
  const src = String(text ?? "").trim(); if (!src) return { zones: {}, error: null };
  try {
    const z = JSON.parse(src);
    if (!z || typeof z !== "object" || Array.isArray(z)) return { zones: {}, error: "it must be a JSON object like {\"Forest\": \"Encounters · Forest\"}" };
    const bad = Object.entries(z).filter(([, v]) => typeof v !== "string").map(([k]) => k);
    if (bad.length) return { zones: Object.fromEntries(Object.entries(z).filter(([, v]) => typeof v === "string")), error: `the value for ${bad.map(k => `"${k}"`).join(", ")} must be a table name in quotes` };
    return { zones: z, error: null };
  } catch (e) {
    const msg = String(e?.message ?? e);
    let pos = msg.match(/position (\d+)/)?.[1]; pos = pos == null ? null : +pos;
    let where = "";
    const lc = msg.match(/line (\d+) column (\d+)/);
    if (lc) where = `line ${lc[1]}, column ${lc[2]}`;
    else if (pos != null) { const before = src.slice(0, pos).split("\n"); where = `line ${before.length}, column ${before.at(-1).length + 1}`; }
    return { zones: {}, error: `invalid JSON${where ? ` at ${where}` : ""} (${msg.replace(/^JSON\.parse: /, "").replace(/\s*\(line \d+ column \d+\)/, "").replace(/\s+/g, " ").slice(0, 160)})` };
  }
}

/** Zones whose roll table doesn't exist: [{ zone, table }]. `tableNames` is a Set or array of world table names. */
export function unknownZoneTables(zones = {}, tableNames = []) {
  const have = new Set(tableNames);
  return Object.entries(zones).filter(([, t]) => !have.has(t)).map(([zone, table]) => ({ zone, table }));
}

/** A fare cell: "2", "1.5", "2s", "1g 20s", "75 c" (coin letters or words), or blank (free). */
export const fareOk = s => { s = String(s ?? "").trim(); return !s || /^\d+(\.\d+)?$/.test(s) || /^(\s*\d+(\.\d+)?\s*[a-z]+\.?\s*)+$/i.test(s); };

