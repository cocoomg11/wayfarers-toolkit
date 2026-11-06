// 2.2 review fix: the Renown bucket in the GM-only store, written and cleared on core's shared fakes (vendor/wanderers-core/testing).
// Keyed maps below the store's deletion depth were merged back by Foundry-style updates; the bucket is now stored as arrays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeWorld, installFakes, OWNERSHIP } from "../vendor/wanderers-core/testing/index.mjs";

const ID = "wayfarers-toolkit";
const Vault = await import("../scripts/vault.mjs");
const R = await import("../scripts/renown-model.mjs");
const Renown = await import("../scripts/renown.mjs");

async function world(bucket = null, { deletionOperator = false } = {}) {
  const w = fakeWorld({ users: [{ id: "gm", name: "GM", isGM: true }, { id: "pl", name: "Player" }] });
  const restore = installFakes(w, "gm", { deletionOperator });
  await globalThis.JournalEntry.create({ _id: "vault1", name: "Wanderer's Toolkit (GM only)", ownership: { default: OWNERSHIP.NONE }, flags: { [ID]: { vaultEntry: true, vault: { v: 1, buckets: bucket ? { renown: bucket } : {} } } } });
  return { w, restore };
}
const stored = () => Vault.entry().getFlag(ID, "vault").buckets.renown;

for (const deletionOperator of [false, true]) {
  test(`renown store (${deletionOperator ? "v14 deletion operator" : "-= keys"}): a hidden score set to 0, a removed source and a cleared record stay gone`, async () => {
    const { restore } = await world(null, { deletionOperator });
    try {
      await Renown.writeHidden(h => R.withHiddenEntry(h, "a1", "veil", { score: 5, ribbons: [{ text: "Base", amount: 1 }] }));
      await Renown.writeHidden(h => ({ ...h, applied: { m1: { "Actor.a1": 0.9 } } }));
      assert.equal(R.normalizeHidden(Vault.get("renown")).scores.a1.veil.score, 5);
      assert.ok(Array.isArray(stored().scores) && Array.isArray(stored().applied), "stored as arrays");
      assert.equal(stored().v, R.HIDDEN_VERSION);
      // Take the score to 0 and drop the source: the entry must be gone after the write, read back from the journal.
      await Renown.writeHidden(h => R.withHiddenEntry(h, "a1", "veil", { score: 0, ribbons: [] }));
      await Renown.writeHidden(h => ({ ...h, applied: {} }));
      const back = R.normalizeHidden(Vault.entry().getFlag(ID, "vault").buckets.renown);
      assert.deepEqual(back.scores, {}, "hidden score cleared");
      assert.deepEqual(back.applied, {}, "discount record cleared");
      // One entry of two removed: the other stays.
      await Renown.writeHidden(h => R.withHiddenEntry(R.withHiddenEntry(h, "a1", "veil", { score: 3 }), "a2", "veil", { score: 4 }));
      await Renown.writeHidden(h => R.withHiddenEntry(h, "a1", "veil", { score: 0 }));
      assert.deepEqual(Object.keys(R.normalizeHidden(stored()).scores), ["a2"]);
    } finally { restore(); }
  });
}

test("renown store: a pre-release map-shaped bucket is read, and the next write converts it and clears what went", async () => {
  const { restore } = await world({ v: 1, factions: [{ id: "veil", name: "Veiled" }], scores: { a1: { veil: { score: 5 } } }, applied: { m1: { "Actor.a1": 0.9 } } });
  try {
    const h = Renown.hidden();
    assert.equal(h.scores.a1.veil.score, 5); assert.equal(h.applied.m1["Actor.a1"], 0.9); assert.equal(h.factions[0].id, "veil");
    await Renown.writeHidden(cur => ({ ...R.withHiddenEntry(cur, "a1", "veil", { score: 0 }), applied: {} }));
    const s = stored();
    assert.ok(Array.isArray(s.scores) && Array.isArray(s.applied));
    assert.deepEqual(R.normalizeHidden(s).scores, {}); assert.deepEqual(R.normalizeHidden(s).applied, {});
    assert.equal(R.normalizeHidden(s).factions[0].id, "veil", "factions kept");
  } finally { restore(); }
});

test("renown store: storeHidden / normalizeHidden round trip", () => {
  const h = { factions: [{ id: "veil", name: "V" }], scores: { a1: { veil: { score: 2, ribbons: [{ id: "r1", text: "x", amount: 1, at: 1 }] } } }, applied: { m1: { "Actor.a": 0.85 } } };
  const s = R.storeHidden(h);
  assert.deepEqual(s.scores, [{ actor: "a1", faction: "veil", score: 2, ribbons: [{ id: "r1", text: "x", amount: 1, at: 1 }] }]);
  assert.deepEqual(s.applied, [{ merchant: "m1", actorUuid: "Actor.a", buy: 0.85 }]);
  assert.deepEqual(R.normalizeHidden(s), R.normalizeHidden(h));
  assert.equal(R.normalizeHidden({ scores: Array.from({ length: 3000 }, (_, i) => ({ actor: `a${i % 150}`, faction: `f${i}`, score: 1 })) }).scores && Object.values(R.normalizeHidden({ scores: Array.from({ length: 3000 }, (_, i) => ({ actor: `a${i % 150}`, faction: `f${i}`, score: 1 })) }).scores).reduce((n, m) => n + Object.keys(m).length, 0), R.HIDDEN_ROWS_MAX);
});

// ---------------------------------------------------------------- finding 2: quests naming a faction are re-saved when it changes
const { fakeCollection } = await import("../vendor/wanderers-core/testing/index.mjs");
test("renown: hiding, showing, renaming or deleting a faction re-saves the quests that name it (players' copy rebuilt)", async () => {
  const { restore } = await world();
  try {
    globalThis.game.actors = fakeCollection([]);
    Renown.registerSettings();
    const calls = []; Renown.setQuestResaver(async id => { calls.push(id); return 1; });
    const id = await Renown.saveFaction({ name: "Watch" });
    assert.ok(id); assert.deepEqual(calls, [], "a new faction names no quest yet");
    await Renown.saveFaction({ id, name: "Watch", hidden: true });
    assert.deepEqual(calls, [id], "hidden → re-saved");
    assert.ok(!Renown.config().factions.some(f => f.id === id), "out of the world setting");
    assert.ok(Renown.hidden().factions.some(f => f.id === id), "in the GM-only store");
    assert.equal(Renown.isShown(id), false, "the public copy built now leaves its rewards out");
    await Renown.saveFaction({ id, name: "Watch", hidden: true, note: "same name, same visibility" });
    assert.equal(calls.length, 1, "no change that players read: nothing re-saved");
    await Renown.saveFaction({ id, name: "Watch", hidden: false });
    assert.equal(calls.length, 2); assert.equal(Renown.isShown(id), true);
    await Renown.saveFaction({ id, name: "Town Watch" });
    assert.equal(calls.length, 3, "renamed");
    await Renown.deleteFaction(id);
    assert.equal(calls.length, 4, "deleted");
    assert.deepEqual(Renown.hidden().factions, []);
  } finally { Renown.setQuestResaver(async () => 0); restore(); }
});

test("quests: the re-save path is the quest log's own save, for quests naming the faction", async () => {
  const { readFileSync } = await import("node:fs");
  const q = readFileSync(new URL("../scripts/quests.mjs", import.meta.url), "utf8");
  assert.match(q, /Renown\.setQuestResaver\(resaveNaming\);/);
  assert.match(q, /export async function resaveNaming\(factionId\) \{[\s\S]*?if \(!QL\.namesFaction\(q, factionId\)\) continue;\s*await save\(j, q\);/);
  const QL = await import("../scripts/quest-log-model.mjs");
  assert.equal(QL.namesFaction({ rewards: { renown: [{ faction: "watch", amount: 1 }] } }, "watch"), true);
  assert.equal(QL.namesFaction({ rewards: {} }, "watch"), false);
});
