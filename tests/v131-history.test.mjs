import "./_globals.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "../scripts/history-model.mjs";

const at = (d, h) => new Date(2026, 9, d, h, 0).getTime(); // local time
const E = (id, t) => ({ id, at: t, item: { name: id }, choices: [], winner: null, outcome: "passed" });

test("Red Book sessions are read defensively and sorted newest first", () => {
  const s = H.normalizeSessions([
    { id: "a", name: "Session 1", n: 1, startedAt: at(10, 19), endedAt: at(11, 1), open: false },
    { id: "b", name: "", n: 2, startedAt: at(17, 19), endedAt: 0, open: true },
    { id: "c", startedAt: 0 }, { name: "no id", startedAt: at(1, 1) }, null, "x",
    { id: "d", startedAt: at(20, 19), endedAt: at(19, 1) } // end before start: treated as open
  ]);
  assert.deepEqual(s.map(x => x.key), ["s:d", "s:b", "s:a"]);
  assert.equal(s.find(x => x.key === "s:b").label, "Session 2");
  assert.equal(s.find(x => x.key === "s:b").end, 0);
  assert.equal(s.find(x => x.key === "s:d").end, 0);
  assert.match(s.find(x => x.key === "s:d").label, /^Session of 2026-10-20$/);
  assert.deepEqual(H.normalizeSessions(undefined), []);
  assert.deepEqual(H.normalizeSessions({ list: [] }), []);
});

test("entries bucket into the session they fall in; outside every session (or without the Red Book) by date", () => {
  const sessions = H.normalizeSessions([{ id: "a", name: "One", startedAt: at(10, 19), endedAt: at(11, 1) }, { id: "b", name: "Two", startedAt: at(17, 19), open: true }]);
  const entries = [E("late", at(11, 0)), E("mid", at(10, 20)), E("between", at(14, 12)), E("open", at(18, 3)), E("bad", NaN)];
  assert.equal(H.groupKey(entries[0], sessions), "s:a", "past midnight stays in its session");
  assert.equal(H.groupKey(entries[2], sessions), "d:2026-10-14");
  assert.equal(H.groupKey(entries[3], sessions), "s:b", "an open session runs until now");
  assert.equal(H.groupKey(entries[4], sessions), "");
  const g = H.sessionGroups(entries, sessions);
  assert.deepEqual(g.map(x => [x.key, x.count, x.session]), [["s:b", 1, true], ["d:2026-10-14", 1, false], ["s:a", 2, true]]);
  assert.equal(g[0].label, "Two (2026-10-17)");
  assert.deepEqual(H.inGroup(entries, "s:a", sessions).map(e => e.id), ["late", "mid"]);
  assert.equal(H.inGroup(entries, "", sessions).length, 5);
  // Fallback: no sessions, every group is a date.
  const d = H.sessionGroups(entries, []);
  assert.ok(d.every(x => !x.session && x.key.startsWith("d:")));
  assert.deepEqual(d.find(x => x.key === "d:2026-10-10").count, 1);
});

test("history window: Red Book is optional, read only through its API, and recommended (not required)", () => {
  const src = readFileSync(new URL("../scripts/history.mjs", import.meta.url), "utf8");
  assert.match(src, /game\.modules\.get\("red-book"\)\?\.active/);
  assert.match(src, /api\?\.session/);
  assert.doesNotMatch(src, /getFlag\("red-book"|flags\[?"?red-book/);
  const m = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.ok(m.relationships.recommends.some(r => r.id === "red-book"));
  assert.ok(!(m.relationships.requires ?? []).some(r => r.id === "red-book"));
  assert.match(src, /data-act="by-group"/);
});
