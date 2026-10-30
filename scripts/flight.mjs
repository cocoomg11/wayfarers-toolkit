/**
 * Flight Master checks, without Foundry globals (tested in Node). Amounts are in the smallest coin in use.
 * pts: [{ n: name, sc: scene name, u: unlocked, sm: scene missing }], routes: [{ a, b, f: fare per passenger, h: hours }].
 */

/** Cheapest route from `from` to `to` through the open points: { f, h, path } or null. */
export function route(from, to, open, routes) {
  const ok = new Set(open); const dist = { [from]: { f: 0, h: 0, path: [from] } }; const done = new Set();
  while (true) {
    const cur = Object.keys(dist).filter(k => !done.has(k)).sort((x, y) => dist[x].f - dist[y].f)[0];
    if (!cur) return null; if (cur === to) return dist[cur]; done.add(cur);
    for (const r of routes) {
      const nb = r.a === cur ? r.b : r.b === cur ? r.a : null; if (!nb || !ok.has(nb) || done.has(nb)) continue;
      const nf = dist[cur].f + r.f; if (!dist[nb] || nf < dist[nb].f) dist[nb] = { f: nf, h: dist[cur].h + r.h, path: [...dist[cur].path, nb] };
    }
  }
}

/** Routes naming a flight point that isn't in the Flight Points table: [{ a, b, unknown: [names] }]. */
export function unknownRoutes(pts, routes) {
  const names = new Set(pts.map(p => p.n));
  return routes.map(r => ({ a: r.a, b: r.b, unknown: [r.a, r.b].filter(n => !names.has(n)) })).filter(r => r.unknown.length);
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
 * Every check before a flight, in order: { ok: true, r, q, dest } or { ok: false, error }. `fmt` formats money. `purse` is the party's
 * total (null when there is no party actor, which flies free). Nothing is charged here.
 */
export function check({ pts = [], routes = [], from, to, pax = 1, purse = null, fmt = String }) {
  const open = pts.filter(p => p.u).map(p => p.n);
  const label = `${from} → ${to}`;
  if (!from || !to || from === to) return { ok: false, error: "Pick two different flight points." };
  for (const n of [from, to]) {
    if (!pts.some(p => p.n === n)) return { ok: false, error: `${label}: "${n}" isn't in the Flight Points table.` };
    if (!open.includes(n)) return { ok: false, error: `${label}: "${n}" isn't unlocked.` };
  }
  const r = route(from, to, open, routes);
  if (!r) {
    const bad = unknownRoutes(pts, routes).filter(x => x.a === from || x.b === from || x.a === to || x.b === to);
    if (bad.length) return { ok: false, error: `${label}: the route ${bad[0].a} → ${bad[0].b} names an unknown flight point (${bad[0].unknown.join(", ")}).` };
    return { ok: false, error: `No route between ${from} and ${to} through open flight points.` };
  }
  const dest = pts.find(p => p.n === to);
  if (dest?.sc && dest.sm) return { ok: false, error: `${label}: the destination's scene "${dest.sc}" doesn't exist (deleted or renamed). Nothing was charged.` };
  const q = quote(r.f, pax, purse);
  if (!q.canPay) return { ok: false, error: `The party can't afford this: needs ${fmt(q.total)}, has ${fmt(q.have)} (short ${fmt(q.short)}).`, r, q };
  return { ok: true, r, q, dest };
}

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

/**
 * Problems in the Flight Routes tables, as cell text rows: [{ table, row, column, text }] (rows count from 1 under the header).
 * Points: [name, scene, unlocked]; routes: [from, to, fare, hours].
 */
export function flightRowProblems(pointRows = [], routeRows = []) {
  const out = [];
  const add = (table, row, column, text) => out.push({ table, row, column, text });
  const seen = new Set();
  pointRows.forEach((r, i) => {
    const [n, , u] = r.map(c => String(c ?? "").trim());
    if (r.every(c => !String(c ?? "").trim())) return;
    if (r.length < 3) add("Flight Points", i + 1, r.length < 1 ? "Flight point" : "Unlocked", `has ${r.length} column${r.length === 1 ? "" : "s"}, needs 3`);
    if (!n) add("Flight Points", i + 1, "Flight point", "is empty");
    else if (seen.has(n)) add("Flight Points", i + 1, "Flight point", `"${n}" is listed twice`);
    seen.add(n);
    if (r.length >= 3 && u && !/^(y|yes|n|no)$/i.test(u)) add("Flight Points", i + 1, "Unlocked", `"${u}" isn't yes or no (read as no)`);
  });
  routeRows.forEach((r, i) => {
    const [a, b, f, h] = r.map(c => String(c ?? "").trim());
    if (r.every(c => !String(c ?? "").trim())) return;
    if (r.length < 4) add("Routes", i + 1, ["From", "To", "Fare", "Hours"][Math.min(3, r.length)], `has ${r.length} column${r.length === 1 ? "" : "s"}, needs 4`);
    if (!a) add("Routes", i + 1, "From", "is empty");
    if (r.length >= 2 && !b) add("Routes", i + 1, "To", "is empty");
    if (r.length >= 3 && !fareOk(f)) add("Routes", i + 1, "Fare", `"${f}" isn't a fare (write 2, 2s or 1g 20s)`);
    if (r.length >= 4 && (h === "" || !Number.isFinite(+h) || +h < 0)) add("Routes", i + 1, "Hours", h === "" ? "is empty (read as 0)" : `"${h}" isn't a number of hours`);
  });
  return out;
}
export const rowProblemText = p => `${p.table} row ${p.row}, ${p.column}: ${p.text}`;
