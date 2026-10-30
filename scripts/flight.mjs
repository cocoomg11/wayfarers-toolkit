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
