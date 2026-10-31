import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../scripts/panel-model.mjs";

test("encounter zones: table rows ↔ JSON", () => {
  const json = JSON.stringify({ Forest: "Encounters · Forest", Hills: "Encounters · Hills" });
  const { rows, error } = M.zonesToRows(json);
  assert.equal(error, null);
  assert.deepEqual(rows, [{ zone: "Forest", table: "Encounters · Forest" }, { zone: "Hills", table: "Encounters · Hills" }]);
  assert.equal(M.rowsToZones(rows), json, "round trip keeps the stored value");
  assert.equal(M.rowsToZones([{ zone: "  Swamp ", table: "T" }, { zone: "", table: "" }]), JSON.stringify({ Swamp: "T" }), "trims names and drops empty rows");
  assert.equal(M.rowsToZones([]), "{}");
  assert.deepEqual(M.zonesToRows(""), { rows: [], error: null });
  assert.match(M.zonesToRows("{bad").error, /valid JSON/);
  assert.match(M.zonesToRows("[1]").error, /list of zones/);
  const mixed = M.zonesToRows(JSON.stringify({ A: "T", B: 3 }));
  assert.deepEqual(mixed.rows, [{ zone: "A", table: "T" }]); assert.match(mixed.error, /"B"/);
});

test("encounter zones: inline validation", () => {
  const probs = M.zoneRowProblems([{ zone: "Forest", table: "Woods" }, { zone: "forest", table: "Woods" }, { zone: "", table: "Woods" }, { zone: "Hills", table: "" }, { zone: "Bog", table: "Nope" }, { zone: "", table: "" }], ["Woods"]);
  assert.deepEqual(probs.map(p => [p.row, p.level]), [[1, "error"], [2, "error"], [3, "warn"], [4, "warn"]]);
  assert.match(probs.find(p => p.row === 1).message, /twice/);
  assert.match(probs.find(p => p.row === 4).message, /no roll table called "Nope"/);
  assert.deepEqual(M.zoneRowProblems([{ zone: "A", table: "T" }], ["T"]), []);
});

test("hidden scenes: checklist ↔ exact-name regex, with escaping", () => {
  assert.equal(M.scenesToRegex([]), "");
  assert.equal(M.scenesToRegex(["Hex Test", "NPC Gallery"]), "^(Hex Test|NPC Gallery)$");
  const odd = ["Map (old)", "a|b", "Cost $5?", "[draft] 1.2", "back\\slash", "x/y", "^start*+"];
  const re = M.scenesToRegex(odd);
  const rx = new RegExp(re);
  for (const n of odd) assert.ok(rx.test(n), `matches ${n}`);
  for (const n of ["Map (old) 2", "a", "b", "Cost 5", "1.2", "Map old"]) assert.ok(!rx.test(n), `doesn't match ${n}`);
  assert.deepEqual(M.regexToScenes(re), odd, "round trip");
  assert.deepEqual(M.regexToScenes(""), []);
  assert.deepEqual(M.regexToScenes("^(Only)$"), ["Only"]);
  assert.equal(M.regexToScenes("Hex Test|NPC Gallery"), null, "not one we made");
  assert.equal(M.regexToScenes("^(Test.*)$"), null, "unescaped special character");
  assert.equal(M.regexToScenes("^Test$"), null);
  assert.equal(M.regexToScenes("^(a\\)$"), null, "dangling escape");
  assert.deepEqual(M.scenesToRegex(["A", "A", ""]), "^(A)$", "duplicates and blanks dropped");
  // The pre-1.15 default reads as its two names.
  assert.deepEqual(M.hiddenToScenes(M.LEGACY_HIDDEN), ["Hex Test", "NPC Gallery"]);
  assert.equal(M.hiddenToScenes("^Draft"), null);
});

test("compendium list keeps the stored format", () => {
  assert.deepEqual(M.packsToList("a.items, b.items  c.items"), ["a.items", "b.items", "c.items"]);
  assert.equal(M.listToPacks(["a.items", "b.items", "a.items"]), "a.items, b.items");
  assert.equal(M.listToPacks([]), "");
  assert.deepEqual(M.packsToList(M.listToPacks(["x.y", "z.w"])), ["x.y", "z.w"]);
});

test("presets → feature settings", () => {
  const keys = M.FEATURE_IDS.map(id => `feature-${id}`);
  for (const p of Object.keys(M.PRESETS)) assert.deepEqual(Object.keys(M.presetSettings(p)).sort(), [...keys].sort(), `${p} writes every feature`);
  const min = M.presetSettings("minimal");
  assert.deepEqual(Object.entries(min).filter(([, v]) => v).map(([k]) => k).sort(), ["feature-characterPane", "feature-questLog", "feature-questTracker"]);
  const classic = M.presetSettings("classic");
  assert.equal(classic["feature-hexTravel"], false); assert.equal(classic["feature-riderFeat"], false);
  for (const id of ["flightMaster", "sessionStart", "vendorTrash", "characterPane", "questLog", "questTracker", "bossFrames", "lootRolls", "bossLoot"]) assert.equal(classic[`feature-${id}`], true, id);
  assert.ok(Object.values(M.presetSettings("everything")).every(Boolean));
  assert.throws(() => M.presetSettings("nope"));
});

test("welcome wizard skips worlds that already use the toolkit", () => {
  const s = (key, value, def, scope = "world") => ({ key, scope, value, default: def });
  const fresh = [s("partySize", 4, 4), s("zones", "{}", "{}"), s("feature-hexTravel", true, true), s("wizardDone", false, false), s("setupReminded", "", "")];
  assert.equal(M.worldConfigured({ settings: fresh, version: "1.15.0" }), false);
  assert.equal(M.worldConfigured({ settings: [...fresh, s("partySize", 5, 4)] }), true, "a changed setting");
  assert.equal(M.worldConfigured({ settings: [...fresh, s("feature-bossLoot", false, true)] }), true, "a feature switched off");
  assert.equal(M.worldConfigured({ settings: fresh, setupFound: true }), true, "setup items exist");
  assert.equal(M.worldConfigured({ settings: fresh, remindedVersion: "1.14.4", version: "1.15.0" }), true, "an earlier version ran here");
  assert.equal(M.worldConfigured({ settings: fresh, remindedVersion: "1.15.0", version: "1.15.0" }), false, "only this version ran");
  assert.equal(M.worldConfigured({ settings: [...fresh, s("flightCache", { pts: [1] }, { pts: [] }), s("questTracker", false, true, "client")] }), false, "bookkeeping and client settings don't count");
  assert.equal(M.worldConfigured({ settings: [s("trashPacks", "a.items", "")] }), true);
});

test("overview issues get fix buttons", () => {
  assert.equal(M.issueFix("Setup", "macro x: missing").action, "setup");
  assert.equal(M.issueFix("Encounter zones", "Zone A: no roll table").tab, "travel");
  assert.equal(M.issueFix("Dependencies", "Vendor trash compendiums not found: x.").tab, "loot");
  assert.equal(M.issueFix("Boss loot", "2 creatures …", { hasAutolink: true }).action, "autolink");
  assert.equal(M.issueFix("Flight Master", "Only 1 unlocked flight point").action, "flights");
  assert.equal(M.issueFix("Flight Master", "The flight network is empty but the old Flight Routes journal page has flight points: import them from the Flight Routes journal page").action, "flightImport");
  assert.equal(M.issueFix("Vendor Trash Rules page", "No Vendor Trash Rules page (Run setup adds it).").action, "setup");
  assert.equal(M.issueFix("GMs", "No GM is connected."), null);
});

test("every tab setting has a plain label and every feature has a card", () => {
  for (const k of M.TABS.flatMap(M.tabKeys)) assert.ok(M.LABELS[k]?.[0], k);
  for (const id of M.FEATURE_IDS) assert.ok(M.FEATURE_CARDS.some(c => c.id === id), id);
  for (const t of M.TABS) assert.ok(t.anchor, t.id);
});
