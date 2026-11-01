// 1.30.0 on wanderers-core 0.5.0: the GM-only store (vault.mjs over core's createStore), checked on core's shared fakes
// (vendor/wanderers-core/testing, dev only), plus source checks for the data folder, windows, keybindings and health fixes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeWorld, installFakes, actAs, OWNERSHIP, FAKE_DEL } from "../vendor/wanderers-core/testing/index.mjs";

const ID = "wayfarers-toolkit";
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const Vault = await import("../scripts/vault.mjs");
const VM = await import("../scripts/vault-model.mjs");

/** A world with a GM and a player, and (optionally) the toolkit's pre-1.30 root-level vault entry. */
async function world({ existing = true, deletionOperator = false } = {}) {
  const w = fakeWorld({ users: [{ id: "gm", name: "GM", isGM: true }, { id: "pl", name: "Player" }] });
  const restore = installFakes(w, "gm", { deletionOperator });
  if (existing) {
    await globalThis.JournalEntry.create({
      _id: "vault1", name: "Wayfarer's Toolkit (GM only)", ownership: { default: OWNERSHIP.NONE },
      flags: { [ID]: { vaultEntry: true, vault: { v: 1, buckets: { pins: { a: { at: 1 }, b: { at: 2 } }, migrations: { inns1: { at: 1, iso: "x" } } } } } }
    });
  }
  return { w, restore };
}

test("store: the existing vault entry is found by its marker, old name and data kept", async () => {
  const { w, restore } = await world();
  try {
    assert.equal(Vault.entry()?.id, "vault1");
    assert.deepEqual(Object.keys(Vault.get("pins", {})), ["a", "b"]);
    assert.ok(Vault.migrated("inns1"));
    assert.equal(Vault.entry().name, "Wayfarer's Toolkit (GM only)", "never renamed");
    assert.equal(w.journal.size ?? Array.from(w.journal).length, 1);
  } finally { restore(); }
});

test("store: file() moves the root-level entry into Module data once; a GM's later move is kept", async () => {
  const { w, restore } = await world();
  try {
    assert.equal(await Vault.file(), true);
    const j = Vault.entry();
    const folder = Array.from(w.folders).find(f => f.name === "Module data");
    assert.ok(folder, "folder made");
    assert.equal(j.folder?.id ?? j.folder, folder.id);
    assert.equal(j.getFlag(ID, "dataFolderFiled"), true);
    assert.ok(Vault.status().filed && Vault.status().inFolder);
    await j.update({ folder: null });   // the GM drags it back to the root
    assert.equal(await Vault.file(), false, "filed once only");
    assert.equal(Vault.entry().folder, null);
  } finally { restore(); }
});

test("store: a fresh world's first write creates one entry inside Module data, ownership None, About page", async () => {
  const { w, restore } = await world({ existing: false });
  try {
    assert.equal(Vault.entry(), null);
    await Promise.all([Vault.setKey("pins", "p1", { at: 1 }), Vault.setKey("pins", "p2", { at: 2 })]);
    const all = Array.from(w.journal);
    assert.equal(all.length, 1, "chained writes make one entry");
    const j = all[0];
    assert.equal(j.name, VM.VAULT_NAME);
    assert.equal(j.ownership.default, OWNERSHIP.NONE);
    assert.equal(j.getFlag(ID, "vaultEntry"), true);
    assert.ok(j.folder, "created inside the folder");
    assert.match(j.pages?.[0]?.text?.content ?? "", /GM-only records/);
    assert.deepEqual(Object.keys(Vault.get("pins")).sort(), ["p1", "p2"]);
    await assert.rejects(Vault.set("nope", 1), /unknown key/, "unknown bucket is a programming mistake");
  } finally { restore(); }
});

for (const deletionOperator of [false, true]) {
  test(`store: a removed key is really deleted (${deletionOperator ? "v14 _del" : "v13 -= key"})`, async () => {
    const { restore } = await world({ deletionOperator });
    try {
      await Vault.setKey("pins", "a", null);
      assert.deepEqual(Object.keys(Vault.get("pins")), ["b"]);
      assert.deepEqual(Object.keys(Vault.entry().flags[ID].vault.buckets.pins), ["b"], "stored data, not just the cache");
      await Vault.update(v => { const { pins: _gone, ...rest } = v.buckets; return { ...v, buckets: rest }; });
      assert.equal(Vault.get("pins", "gone"), "gone");
    } finally { restore(); }
  });
}

test("store: players get the fallback and can't write", async () => {
  const { w, restore } = await world();
  try {
    actAs(w, "pl");
    assert.equal(Vault.entry(), null);
    assert.equal(Vault.get("pins", "fb"), "fb");
    assert.equal(Vault.migrated("inns1"), false);
    await assert.rejects(Vault.set("pins", {}));
    assert.equal(Vault.status().exists, false);
    assert.equal(await Vault.file(), false);
    assert.equal(await Vault.remove(), 0);
  } finally { restore(); }
});

test("store: status() names players who can see the entry", async () => {
  const { restore } = await world();
  try {
    await Vault.entry().update({ ownership: { default: OWNERSHIP.OBSERVER } });
    assert.deepEqual(Vault.status().playersCanSee, ["Player"]);
  } finally { restore(); }
});

test("store: remove() deletes the entry and the Module data folder only when nothing else is in it", async () => {
  const { w, restore } = await world();
  try {
    await Vault.file();
    const folder = Array.from(w.folders).find(f => f.name === "Module data");
    await globalThis.JournalEntry.create({ name: "Other module (GM only)", folder: folder.id, flags: { other: { storeEntry: true } } });
    assert.equal(await Vault.remove(), 1);
    assert.equal(Vault.entry(), null);
    assert.ok(Array.from(w.folders).some(f => f.id === folder.id), "another module's entry keeps the folder");
  } finally { restore(); }
  const again = await world();
  try {
    await Vault.file();
    assert.equal(await Vault.remove(), 1);
    assert.equal(Array.from(again.w.folders).length, 0, "empty folder removed");
  } finally { again.restore(); }
});

test("vault-model deletions(): core's walk, every bucket, three levels", () => {
  const prev = VM.withKey(VM.withKey(null, "pins", "a", { at: 1 }), "pins", "b", { at: 2 });
  assert.deepEqual(VM.deletions(prev, VM.withKey(prev, "pins", "a", null), "f"), { "f.buckets.pins.-=a": null });
  const fl = VM.withBucket(null, "flightNetwork", { points: { x: 1 } });
  assert.deepEqual(VM.deletions(VM.withKey(fl, "quests", "q", { at: 1 }), VM.withKey(fl, "quests", "q", null), "f"), { "f.buckets.quests.-=q": null });
  assert.ok(FAKE_DEL);
});

test("store wiring: leader files the entry at ready; cleanup uses the store's remove() and knows dataFolderFiled", () => {
  const main = src("scripts/main.mjs"); const cl = src("scripts/cleanup.mjs");
  assert.match(main, /isActiveGM\(\)\) await Vault\.file\(\)/);
  assert.match(cl, /\.remove\(\)/);
  assert.doesNotMatch(cl, /p\.vault, async j => \{ await j\.delete\(\)/, "no hand-made journal delete");
  assert.match(cl, /VAULT_FLAGS = \["vaultEntry", "vault", "dataFolderFiled"\]/);
  assert.doesNotMatch(src("scripts/vault.mjs"), /JournalEntry\.create/, "creation is core's");
});
