import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
globalThis.foundry.utils.randomID ??= () => Math.random().toString(36).slice(2, 10);
const Cleanup = await import("../scripts/cleanup.mjs");
const G = await import("../scripts/gold-model.mjs");
const H = await import("../scripts/history-model.mjs");
const Q = await import("../scripts/quests.mjs");

test("setting caps: gold snapshots and loot history stay bounded", () => {
  assert.equal(G.SNAPSHOTS_MAX, 50);
  let snaps = [];
  for (let i = 0; i < G.SNAPSHOTS_MAX + 20; i++) snaps = G.addSnapshot(snaps, { at: i });
  assert.equal(snaps.length, G.SNAPSHOTS_MAX);
  assert.equal(snaps[0].at, G.SNAPSHOTS_MAX + 19, "newest first");
  let hist = [];
  for (let i = 0; i < H.HISTORY_MAX + 5; i++) hist = H.addEntry(hist, { id: `e${i}`, at: i });
  assert.equal(hist.length, H.HISTORY_MAX);
});

test("cleanup: the Rested status effect and the tracker journal's trip counter are found", () => {
  assert.equal(Cleanup.restedEffect({ statuses: new Set(["wct-rested"]) }), true);
  assert.equal(Cleanup.restedEffect({ statuses: ["wct-rested"] }), true);
  assert.equal(Cleanup.restedEffect({ statuses: new Set(["dead"]) }), false);
  assert.equal(Cleanup.restedEffect(null), false);
  const j = { name: "Campaign Trackers", flags: { world: { trackers: { trips: 3 } } } };
  assert.equal(Cleanup.trackerFlag(j, "Campaign Trackers"), true);
  assert.equal(Cleanup.trackerFlag(j, "Other"), false, "only the configured tracker journal");
  assert.equal(Cleanup.trackerFlag({ name: "Campaign Trackers", flags: {} }, "Campaign Trackers"), false);
  assert.ok(Cleanup.CATEGORIES.some(([k]) => k === "messages"));
});

test("quest flag: schema version, old shapes read", () => {
  const q = Q.normalize({ giver: "Old Miller", objectives: ["Find the mill"] });
  assert.equal(q.v, Q.QUEST_VERSION);
  assert.equal(q.giver.name, "Old Miller");
  assert.equal(q.objectives[0].text, "Find the mill");
  assert.equal(Q.normalize(q).v, Q.QUEST_VERSION, "current shape round-trips");
});

test("module.json: compatibility and dnd5e range", () => {
  const m = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
  assert.equal(m.compatibility.minimum, "13");
  assert.equal(m.compatibility.verified, "14.370");
  const sys = m.relationships.systems.find(s => s.id === "dnd5e");
  assert.ok(sys?.compatibility?.minimum && sys.compatibility.verified === "6.0.6");
  assert.ok(!m.relationships.requires?.length, "optional modules are recommends, never requires");
  assert.ok(m.relationships.recommends.some(r => r.id === "item-piles"));
});

test("release workflow: tag must be vMAJOR.MINOR.PATCH", async () => {
  const yml = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  const pattern = "^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$";
  assert.ok(yml.includes(pattern), "core's tag pattern");
  const re = new RegExp(pattern);
  for (const ok of ["v1.23.0", "v10.0.12", "v1.27.0"]) assert.ok(re.test(ok), ok);
  for (const bad of ["1.21", "1.22", "v1.24", "1.24.0", "v1.24.0-beta", "v01.2.3"]) assert.ok(!re.test(bad), bad);
  const { isReleaseTag } = await import("../vendor/wanderers-core/index.mjs");
  for (const t of ["v1.27.0", "v1.24", "1.24.0"]) assert.equal(re.test(t), isReleaseTag(t), t);
});

test("workflows: actions pinned by SHA, read-only by default, upload is the only writer, vendor in the zip", () => {
  const rel = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
  const tst = readFileSync(new URL("../.github/workflows/test.yml", import.meta.url), "utf8");
  for (const y of [rel, tst]) {
    for (const m of y.matchAll(/uses:\s*(\S+)/g)) {
      if (m[1].startsWith("cocoomg11/wanderers-core/")) { assert.match(m[1], /@v\d+\.\d+\.\d+$/, m[1]); continue; }
      assert.match(m[1], /@[0-9a-f]{40}$/, `${m[1]} is pinned by SHA`);
    }
    assert.match(y, /^permissions:\n {2}contents: read$/m);
  }
  assert.equal((rel.match(/contents: write/g) ?? []).length, 1, "one job writes");
  assert.match(rel, /upload:[\s\S]*contents: write[\s\S]*gh release upload/);
  assert.match(rel, /vendor\.mjs verify --remote/);
  assert.match(rel, /zip -r module\.zip [^\n]* vendor [^\n]*\\\n\s*-x 'vendor\/wanderers-core\/config\/\*' 'vendor\/wanderers-core\/vendor\.mjs'/);
  assert.match(rel, /-x [^\n]*'vendor\/wanderers-core\/testing\/\*'/, "core's test fakes stay out of the zip");
  assert.match(rel, /--ignore-scripts/);
  assert.match(tst, /module-checks\.yml@v0\.5\.1/);
});
