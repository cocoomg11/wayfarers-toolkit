import { test } from "node:test";
import assert from "node:assert/strict";
import * as J from "../scripts/junk-rules.mjs";

// Item Piles prices come back in the primary currency (gold) as floats; copper is 0.01 of... here 1/100 with a gold/silver/copper economy.
const RATE = 0.01;

test("sell all junk: the total is the sum of each item's whole-coin price", () => {
  // Three items worth 0.004 each (0.4 copper): each rounds to 0, but the old total rounded the float sum (0.012 -> 1 copper).
  const prices = [0.004, 0.004, 0.004];
  const lines = prices.map(p => J.toSmallest(p, RATE));
  assert.deepEqual(lines, [0, 0, 0]);
  assert.equal(J.totalSmallest(prices, RATE), 0, "shown total equals the sum of the lines");
  // Items worth 0.006 (0.6 copper) each round up: lines 1+1+1 = 3, while the float sum 0.018 would give 2.
  assert.equal(J.totalSmallest([0.006, 0.006, 0.006], RATE), 3);
});

test("sell all junk: total is an integer and matches the lines for mixed prices", () => {
  const prices = [0.0149, 0.0251, 1.2349, 0.005, 0.0051];
  const sum = prices.map(p => J.toSmallest(p, RATE)).reduce((a, b) => a + b, 0);
  const t = J.totalSmallest(prices, RATE);
  assert.ok(Number.isInteger(t));
  assert.equal(t, sum);
  assert.equal(J.totalSmallest([], RATE), 0);
  assert.equal(J.totalSmallest([1, 2], 0), 0, "no usable rate: nothing");
});

test("sell all junk: smallest rate comes from the currencies", () => {
  assert.equal(J.smallestRate([{ exchangeRate: 1 }, { exchangeRate: 0.1 }, { exchangeRate: 0.01 }]), 0.01);
  assert.equal(J.smallestRate([]), 0);
  assert.equal(J.smallestRate(undefined), 0);
});

// ---------------------------------------------------------------- one acting client per GM user (gm-model.mjs)
import * as G from "../scripts/gm-model.mjs";
import { readFileSync } from "node:fs";

const sess = (id, since, seen = 0, userId = "gm") => ({ id, userId, since, seen });

test("gm sessions: a lone client leads at once, with nobody heard", () => {
  const self = sess("aaaa", 100);
  assert.equal(G.leaderOf([], { gmUserId: "gm", self }), "aaaa");
  assert.ok(G.isLeader([], { gmUserId: "gm", self }));
  assert.equal(G.leaderOf([], { gmUserId: "gm", cutoff: 1e12, self }), "aaaa", "own session never times out");
});

test("gm sessions: the earliest-started session of the active GM user leads, ties by id", () => {
  const a = sess("bbbb", 100), b = sess("aaaa", 200);
  assert.equal(G.leaderOf([b], { gmUserId: "gm", self: a }), "bbbb");
  assert.equal(G.leaderOf([a], { gmUserId: "gm", self: b }), "bbbb", "both clients agree");
  assert.ok(G.isLeader([b], { gmUserId: "gm", self: a }));
  assert.ok(!G.isLeader([a], { gmUserId: "gm", self: b }));
  const c = sess("cccc", 100), d = sess("dddd", 100);
  assert.equal(G.leaderOf([d], { gmUserId: "gm", self: c }), "cccc");
  assert.equal(G.leaderOf([c], { gmUserId: "gm", self: d }), "cccc");
});

test("gm sessions: sessions of other users don't count; a client of another user never leads", () => {
  const other = sess("aaaa", 1, 0, "gm2"), self = sess("zzzz", 999);
  assert.equal(G.leaderOf([other], { gmUserId: "gm", self }), "zzzz");
  assert.ok(!G.isLeader([], { gmUserId: "gm", self: sess("yyyy", 1, 0, "gm2") }));
  assert.equal(G.leaderOf([], { gmUserId: null, self }), null);
});

test("gm sessions: a silent leader drops out after the cut-off, so the next one takes over", () => {
  const old = sess("aaaa", 100, 5000), self = sess("bbbb", 200);
  assert.equal(G.leaderOf([old], { gmUserId: "gm", cutoff: G.aliveCutoff(5500), self }), "aaaa", "seen after the previous ping: alive");
  assert.equal(G.leaderOf([old], { gmUserId: "gm", cutoff: G.aliveCutoff(9000), self }), "bbbb", "silent since before the previous ping: gone");
  assert.equal(G.aliveCutoff(null), -Infinity, "before the second ping nobody times out");
  assert.deepEqual(G.prune([old, sess("cccc", 1, 9000)], 8000).map(s => s.id), ["cccc"]);
});

test("gm sessions: socket messages are read strictly and applied to the table", () => {
  assert.equal(G.readSessionMessage({ action: "gmSession", op: "ping", sid: "x" }), null, "id too short");
  assert.equal(G.readSessionMessage({ action: "gmSession", op: "nope", sid: "abcd1234" }), null);
  assert.equal(G.readSessionMessage({ action: "flight", op: "ping", sid: "abcd1234" }), null);
  const m = G.readSessionMessage({ action: "gmSession", op: "ping", sid: "abcd1234", since: "50" });
  assert.deepEqual(m, { op: "ping", sid: "abcd1234", since: 50 });
  let t = G.applySessionMessage([], m, "gm", 1000);
  assert.deepEqual(t, [{ id: "abcd1234", userId: "gm", since: 50, seen: 1000 }]);
  t = G.applySessionMessage(t, { ...m, op: "here" }, "gm", 2000);
  assert.equal(t.length, 1); assert.equal(t[0].seen, 2000, "refreshed, not duplicated");
  t = G.applySessionMessage(t, { ...m, op: "bye" }, "gm", 3000);
  assert.deepEqual(t, [], "a closed tab leaves at once");
  assert.deepEqual(G.applySessionMessage([], m, null, 1), [], "no sender: ignored");
});

test("gm sessions: new ids are random-looking and valid for the reader", () => {
  const a = G.newId(), b = G.newId();
  assert.notEqual(a, b); assert.match(a, /^[A-Za-z0-9]{16}$/);
  assert.ok(G.readSessionMessage({ action: "gmSession", op: "here", sid: a }));
  assert.equal(G.newId(() => 0, 4), "aaaa");
  assert.equal(G.newId(() => 0.99999, 4), "9999");
});

test("request ids: a repeated id is ignored, ids without one pass, the cache is bounded", () => {
  const c = G.seenCache(3);
  assert.ok(c.firstTime("r1")); assert.ok(!c.firstTime("r1"));
  assert.ok(c.firstTime(undefined)); assert.ok(c.firstTime(undefined), "old clients send no id");
  c.firstTime("r2"); c.firstTime("r3"); c.firstTime("r4");
  assert.equal(c.size, 3); assert.ok(!c.has("r1"), "oldest dropped");
  assert.ok(!c.firstTime("r4"));
  assert.equal(G.SEEN_MAX, 200);
  assert.equal(G.requestId({ rid: "abcd1234" }), "abcd1234");
  assert.equal(G.requestId({ rid: "<b>" }), null);
  assert.equal(G.requestId(null), null);
});

test("request ids: a card stamped with the id counts as already posted", () => {
  const msgs = [{ flags: { "wayfarers-toolkit": { roomRequest: { rid: "abcd1234" } } } }, { flags: {} }];
  assert.ok(G.cardExists(msgs, "wayfarers-toolkit", "roomRequest", "abcd1234"));
  assert.ok(!G.cardExists(msgs, "wayfarers-toolkit", "roomRequest", "zzzz9999"));
  assert.ok(!G.cardExists(msgs, "wayfarers-toolkit", "paceRequest", "abcd1234"));
  assert.ok(!G.cardExists(msgs, "wayfarers-toolkit", "roomRequest", null), "no id: never a duplicate");
});

test("gm sessions: socket requests carry request ids and handlers check them", () => {
  const inn = readFileSync(new URL("../scripts/inn.mjs", import.meta.url), "utf8");
  const main = readFileSync(new URL("../scripts/main.mjs", import.meta.url), "utf8");
  const loot = readFileSync(new URL("../scripts/loot.mjs", import.meta.url), "utf8");
  for (const a of ["roomRequest", "restedRest"]) assert.match(inn, new RegExp(`action: "${a}"[^}]*rid`));
  for (const a of ["paceRequest", "flight"]) assert.match(main, new RegExp(`action: "${a}"[^}]*rid`));
  for (const a of ["lootChoice", "lootClose", "lootAssign"]) assert.match(loot, new RegExp(`action: "${a}"[^}]*rid`));
  for (const src of [inn, main, loot]) assert.match(src, /firstTime\(msg\)/);
});
