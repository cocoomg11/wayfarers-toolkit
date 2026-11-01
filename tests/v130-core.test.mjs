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

// ---------------------------------------------------------------- windows, keybindings, Module data folder
const W = await import("../scripts/windows.mjs");
const { isWindowKey } = await import("../vendor/wanderers-core/index.mjs");
const { RememberedWindow } = await import("../vendor/wanderers-core/foundry/index.mjs");
const { FakeApplicationV2 } = await import("../vendor/wanderers-core/testing/index.mjs");
const PM = await import("../scripts/panel-model.mjs");

test("windows: every main window is remembered under its own stable key", () => {
  assert.deepEqual({ ...W.WINDOW_KEYS }, { panel: "panel", questLog: "questLog", pane: "pane", flightMap: "flightMap", flightEditor: "flightEditor", coinLog: "coinLog", lootHistory: "lootHistory", partyGold: "partyGold", health: "health" }, "never rename a key");
  for (const k of Object.values(W.WINDOW_KEYS)) assert.ok(isWindowKey(k), k);
  const where = { panel: ["panel.mjs", "ControlPanel"], questLog: ["quests.mjs", "QuestLog"], pane: ["pane.mjs", "CharacterPane"], flightMap: ["flight-map.mjs", "FlightMapApp"], flightEditor: ["flight-editor.mjs", "FlightEditor"], coinLog: ["coinlog.mjs", "CoinLogApp"], lootHistory: ["history.mjs", "LootHistoryApp"], partyGold: ["gold.mjs", "PartyGoldApp"], health: ["health.mjs", "HealthApp"] };
  for (const [key, [file, cls]] of Object.entries(where)) assert.match(src(`scripts/${file}`), new RegExp(`class ${cls} extends remembered\\(foundry\\.applications\\.api\\.ApplicationV2, "${key}"\\)`), cls);
  assert.doesNotMatch(src("scripts/quests.mjs"), /class QuestEditor extends remembered/, "the quest editor opens per quest, not remembered");
});

test("windows: placement saved on the fake ApplicationV2 under the toolkit's setting; reset forgets it", async () => {
  const w = fakeWorld({ users: [{ id: "gm", isGM: true }] });
  const restore = installFakes(w, "gm");
  Object.assign(globalThis, { innerWidth: 1600, innerHeight: 1000, addEventListener: () => {}, removeEventListener: () => {} });
  try {
    const R = RememberedWindow(FakeApplicationV2, { moduleId: ID, key: W.WINDOW_KEYS.pane, saveMs: 1 });
    const a = new R({ position: { width: 580, height: 880 } }); await a.render(); a.setPosition({ left: 300, top: 40, width: 600, height: 900 });
    await new Promise(r => setTimeout(r, 5)); await a.close();
    assert.deepEqual(game.settings.get(ID, W.PLACEMENT_SETTING).windows.pane, { left: 300, top: 40, width: 600, height: 900 });
    const b = new R({ position: { width: 580, height: 880 } });
    assert.equal(b.position.left, 300, "reopens where it was"); assert.equal(b.position.height, 900);
    await W.resetWindows();
    assert.deepEqual(game.settings.get(ID, W.PLACEMENT_SETTING).windows, {});
  } finally { restore(); }
});

test("character pane: own size memory replaced by core's; the 540 x 780 minimum still enforced; old value read once", () => {
  const p = src("scripts/pane.mjs");
  assert.match(p, /const MIN_W = 540, MIN_H = 780/);
  assert.match(p, /position\.width = Math\.max\(MIN_W, position\.width\)/);
  // 1.32: the height minimum follows short screens (pane-model.mjs paneMinHeight); still MIN_H when there's room.
  assert.match(p, /position\.height = Math\.max\(PM\.paneMinHeight\(window\.innerHeight, MIN_H\), position\.height\)/);
  assert.doesNotMatch(p, /game\.settings\.set\(ID, SIZE_KEY/, "paneWindow is no longer written");
  assert.match(p, /if \(savedPlacement\(ID, WINDOW_KEYS\.pane\)\) return null;/, "the old value only until core has one");
});

test("keybindings: core's helper, same action ids and defaults", () => {
  const m = src("scripts/main.mjs"); const q = src("scripts/quests.mjs");
  assert.doesNotMatch(m + q, /game\.keybindings\.register/);
  assert.match(m, /reg\("characterPane", /); assert.match(m, /reg\("controlPanel", [^\n]*, true, CONTROL_PANEL_KEY\);/, "control panel is GM only");
  assert.match(q, /action: "questLog"[^\n]*editable: \[\{ key: "KeyL" \}\]/);
  // 1.32: the control panel has a default (Shift+K); the pane still has none.
  assert.match(m, /reg\("characterPane", [^\n]*\(\) => WCT\.characterPane\(\)\);\n/, "pane: no default key");
  assert.match(m, /CONTROL_PANEL_KEY = \[\{ key: "KeyK", modifiers: \["Shift"\] \}\]/);
});

test("Module data folder: hidden client setting, hide hook in init, panel row, record lists", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /register\(ID, "showModuleData", \{[^\n]*scope: "client", config: false, type: Boolean, default: false, onChange: \(\) => ui\.journal\?\.render\(\)/);
  assert.match(m, /hideDataFolder\(ID, \{ shown: /);
  assert.match(m, /registerWindowPlacement\(ID\)/);
  for (const k of ["showModuleData", "windowPlacement"]) { assert.ok(PM.RECORD_SETTINGS.has(k), k); assert.ok(PM.WIZARD_IGNORE.has(k), k); }
  const general = PM.TABS.find(t => t.id === PM.GENERAL_TAB);
  assert.ok(general.advanced.some(([k]) => k === "showModuleData")); assert.ok(PM.LABELS.showModuleData[0]);
  assert.match(src("scripts/panel.mjs"), /data-act="reset-windows"[^\n]*Reset window positions/);
  assert.match(src("scripts/panel.mjs"), /act === "reset-windows"\) \{ await resetWindows\(\)/);
});

test("cleanup: settings reset covers client settings (windowPlacement, showModuleData)", () => {
  // plan() lists every setting of the namespace; client ones on every client, world ones for GMs.
  assert.match(src("scripts/cleanup.mjs"), /c\.namespace === ID && \(c\.scope === "world" \? game\.user\.isGM : true\)/);
});
