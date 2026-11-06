import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.foundry.utils.randomID ??= () => Math.random().toString(36).slice(2, 10);
const QL = await import("../scripts/quest-log-model.mjs");
const QM = await import("../scripts/quests-model.mjs");
const UX = await import("../scripts/quest-ux-model.mjs");
const PM = await import("../scripts/pins-model.mjs");
const Pan = await import("../scripts/panel-model.mjs");
const R = await import("../scripts/requests.mjs");
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- migration: record version 2
test("normalizeQuest: version 1 records read into version 2 (level parsed, party empty, counters off, no choices)", () => {
  const v1 = { v: 1, status: "active", zone: "Hills", level: "Lv 4", giver: "Miller", objectives: ["Find the mill", { text: "Ask around", done: true }], rewards: { coin: "1g", items: ["Item.a"] } };
  const q = QL.normalizeQuest(v1, { id: () => "x" });
  assert.equal(q.v, 2); assert.equal(q.level, 4); assert.equal(q.levelText, ""); assert.equal(q.party, "");
  assert.deepEqual(q.objectives.map(o => [o.text, o.done, o.target, o.progress]), [["Find the mill", false, 0, 0], ["Ask around", true, 0, 0]]);
  assert.deepEqual(q.rewards.choice, []); assert.equal(q.rewards.pick, "");
  assert.equal(q.rewards.items[0].rarity, "", "rarity unknown until the move looks it up");
  assert.equal(q.giver.name, "Miller");
  const again = QL.normalizeQuest(q);
  assert.deepEqual({ ...again, objectives: again.objectives.map(o => ({ ...o, id: "x" })) }, q, "version 2 round-trips");
});

test("parseLevel: numbers and Lv text become numbers; other text is kept", () => {
  assert.deepEqual(QL.parseLevel("Lv 4"), { level: 4, text: "" });
  assert.deepEqual(QL.parseLevel("4"), { level: 4, text: "" });
  assert.deepEqual(QL.parseLevel("level 12"), { level: 12, text: "" });
  assert.deepEqual(QL.parseLevel("Lvl. 7"), { level: 7, text: "" });
  assert.deepEqual(QL.parseLevel(9), { level: 9, text: "" });
  assert.deepEqual(QL.parseLevel("3-5"), { level: null, text: "3-5" });
  assert.deepEqual(QL.parseLevel("Heroic tier"), { level: null, text: "Heroic tier" });
  assert.deepEqual(QL.parseLevel(""), { level: null, text: "" });
  assert.equal(QL.parseLevel("999").level, QL.LEVEL_MAX, "clamped");
  // A v2 record with kept text stays as it is.
  const q = QL.normalizeQuest({ v: 2, level: null, levelText: "3-5" });
  assert.equal(q.level, null); assert.equal(q.levelText, "3-5");
  assert.equal(QL.levelLabel(q), "[3-5]"); assert.equal(QL.levelLabel({ level: 4 }), "[4]"); assert.equal(QL.levelLabel({}), "");
});

test("isLegacy: flags without version 2 keep the old visibility rule until the move", () => {
  assert.ok(QL.isLegacy({ v: 1, pub: true })); assert.ok(QL.isLegacy({ pub: true }));
  assert.ok(!QL.isLegacy({ v: 2, pub: true })); assert.ok(!QL.isLegacy(null));
});

test("quests2 migration: registered, gated by the quest log, gives the party actor, never writes the Parties setting", () => {
  const m = src("scripts/migrate.mjs");
  assert.match(m, /export const MOVES = \[[^\]]*"quests2"\]/);
  assert.match(m, /quests2: F\.on\("questLog"\)/);
  assert.match(m, /Q\.upgrade\(j, party\?\.id \?\? ""\)/);
  assert.doesNotMatch(m.slice(m.indexOf("async function quests2")), /settings\.set\(ID, "questParties"/);
  const q = src("scripts/quests.mjs");
  assert.match(q, /export async function upgrade\(j, partyId\)/);
  assert.match(q, /export const QUEST_VERSION = QL\.QUEST_VERSION;/);
  assert.equal(QL.QUEST_VERSION, 2);
});

// ---------------------------------------------------------------- party level and difficulty
test("partyLevel: average of character levels, rounded; null with none", () => {
  assert.equal(QL.partyLevel([4, 5, 5]), 5); assert.equal(QL.partyLevel([3, 4]), 4); assert.equal(QL.partyLevel([]), null);
  assert.equal(QL.partyLevel([undefined, 0, 6]), 6, "unreadable levels are skipped");
});

test("difficulty bands: Trivial ≤−5, Easy −4..−2, Even −1..+1, Hard +2..+3, Deadly ≥+4", () => {
  const at = d => QL.difficulty(10 + d, 10)?.id;
  assert.deepEqual([-9, -5, -4, -2, -1, 0, 1, 2, 3, 4, 9].map(at), ["trivial", "trivial", "easy", "easy", "even", "even", "even", "hard", "hard", "deadly", "deadly"]);
  assert.equal(QL.difficulty(null, 4), null); assert.equal(QL.difficulty(4, null), null);
  assert.deepEqual(QL.DIFFICULTY.map(b => b.colour), ["grey", "green", "yellow", "orange", "red"]);
  assert.deepEqual(QL.DIFFICULTY.map(b => b.label), ["Trivial", "Easy", "Even", "Hard", "Deadly"]);
  // One place for the thresholds: nothing else in the scripts compares level differences.
  assert.doesNotMatch(src("scripts/quests.mjs"), /level\s*-\s*partyLevel|<=\s*-5/);
});

// ---------------------------------------------------------------- objective counters
test("counters: progress clamps, ticks at the target, unticks below; plain objectives unchanged", () => {
  let o = QL.normalizeObjective({ text: "Wolf pelts", target: 8, progress: 7 }, "a");
  assert.equal(o.done, false); assert.equal(QL.counterText(o), "7/8");
  o = QL.stepProgress(o, 1); assert.equal(o.progress, 8); assert.equal(o.done, true, "auto-tick");
  o = QL.stepProgress(o, 5); assert.equal(o.progress, 8, "clamped at the target");
  o = QL.stepProgress(o, -1); assert.equal(o.done, false); assert.equal(o.progress, 7);
  o = QL.stepProgress(o, -99); assert.equal(o.progress, 0);
  assert.equal(QL.normalizeObjective({ text: "x", target: 3, progress: 5 }, "b").progress, 3);
  assert.equal(QL.normalizeObjective({ text: "x", target: 3, progress: 3, done: false }, "b").done, true, "done follows progress");
  const plain = QL.normalizeObjective({ text: "Go", done: true }, "c");
  assert.equal(plain.target, 0); assert.equal(QL.counterText(plain), ""); assert.deepEqual(QL.stepProgress(plain, 1), plain);
  assert.deepEqual(QL.tickObjective({ ...o, target: 4, progress: 1 }, true).progress, 4, "ticking fills the counter");
  assert.equal(QL.tickObjective({ text: "x", target: 4, progress: 4, done: true }, false).progress, 3, "unticking drops below");
});

test("ready: active with every required objective done", () => {
  const q = { status: "active", objectives: [{ done: true }, { done: false, optional: true }] };
  assert.ok(QL.isReady(q)); assert.ok(!QL.isReady({ ...q, status: "completed" }));
  assert.ok(!QL.isReady({ status: "active", objectives: [] }));
  assert.ok(!QL.isReady({ status: "active", objectives: [{ done: false }] }));
});

// ---------------------------------------------------------------- rewards
test("quality from dnd5e rarity: common white, uncommon green, rare blue, very rare purple, legendary orange, mundane grey", () => {
  assert.deepEqual(["", "common", "uncommon", "rare", "veryRare", "legendary", "artifact", "odd"].map(QL.quality),
    ["mundane", "common", "uncommon", "rare", "veryrare", "legendary", "legendary", "mundane"]);
  const css = src("styles/quests.css");
  for (const q of ["mundane", "common", "uncommon", "rare", "veryrare", "legendary"]) assert.match(css, new RegExp(`\\.q-${q} \\{ --q:`), q);
});

test("reward plan: fixed items plus the pick; a choice with no pick blocks paying", () => {
  const a = { uuid: "Item.a", name: "A" }, b = { uuid: "Item.b", name: "B" }, c = { uuid: "Item.c", name: "C" };
  assert.deepEqual(QL.rewardPlan({ rewards: { items: [a], choice: [b, c], pick: "Item.c" } }).items, [a, c]);
  assert.equal(QL.rewardPlan({ rewards: { items: [a], choice: [b, c], pick: "" } }).missingPick, true);
  assert.equal(QL.rewardPlan({ rewards: { items: [a], choice: [] } }).missingPick, false);
  // A pick that isn't (any longer) one of the choices is dropped when read.
  assert.equal(QL.normalizeQuest({ v: 2, rewards: { choice: [b], pick: "Item.zzz" } }).rewards.pick, "");
  assert.equal(QL.normalizeQuest({ v: 2, rewards: { choice: [b], pick: "Item.b" } }).rewards.pick, "Item.b");
});

test("decidePick: members of the party (or the GM) pick one of the choices before paying", () => {
  const q = { status: "active", paid: false, rewards: { choice: [{ uuid: "Item.b" }, { uuid: "Item.c" }] } };
  assert.ok(QL.decidePick(q, "Item.b", { member: true }).ok);
  assert.ok(!QL.decidePick(q, "Item.b", {}).ok, "not in the party");
  assert.ok(!QL.decidePick(q, "Item.zzz", { member: true }).ok, "not a choice");
  assert.ok(!QL.decidePick(q, "", { member: true }).ok, "players can't clear");
  assert.ok(QL.decidePick(q, "", { isGM: true }).ok, "the GM can clear");
  assert.ok(QL.decidePick(q, "Item.c", { isGM: true }).ok, "the GM can override");
  assert.ok(!QL.decidePick({ ...q, paid: true }, "Item.b", { isGM: true }).ok, "paid");
  assert.ok(!QL.decidePick({ ...q, status: "available" }, "Item.b", { isGM: true }).ok, "not given");
  assert.ok(!QL.decidePick({ ...q, rewards: { choice: [] } }, "Item.b", { isGM: true }).ok);
});

test("questPick request: player kind, quest id and a uuid; handled by the leader; the sender decides membership", () => {
  assert.ok(R.REQUESTS.questPick); assert.notEqual(R.REQUESTS.questPick.from, "gm");
  const q = src("scripts/quests.mjs");
  assert.match(q, /handle\("questPick", \(d, user\) => onPick\(d, user\)\)/);
  assert.match(q, /OPS\.pick\(j\.id, d\.uuid, user\)/);
  assert.match(q, /request\("questPick", \{ questId: id, uuid \}\)/);
});

test("pay: to the quest's party, fixed + picked items, coin with a reason; Complete and pay", () => {
  const q = src("scripts/quests.mjs");
  assert.match(q, /const party = q\.party \? game\.actors\.get\(q\.party\) : null;/);
  assert.match(q, /for \(const i of plan\.items\)/);
  assert.match(q, /addMoney\(party, amount, \{ reason: `Quest reward: \$\{j\.name\}` \}\)/);
  assert.match(q, /Complete and pay to \$\{pName\}/);
  assert.doesNotMatch(q, /data-action="(share|abandon)"/, "no Share / Abandon");
});

// ---------------------------------------------------------------- visibility
test("visibleTo: given, unhidden, readable, and a member of the quest's party; no party = GM only", () => {
  const q = { status: "active", hidden: false, party: "P1" };
  assert.ok(QL.visibleTo({ quest: q, member: true }));
  assert.ok(!QL.visibleTo({ quest: q, member: false }), "another party's quest");
  assert.ok(!QL.visibleTo({ quest: { ...q, party: "" }, member: true }), "no party: GM only");
  assert.ok(!QL.visibleTo({ quest: { ...q, hidden: true }, member: true }));
  assert.ok(!QL.visibleTo({ quest: { ...q, status: "available" }, member: true }));
  assert.ok(!QL.visibleTo({ quest: q, member: true, readable: false }));
  assert.ok(QL.visibleTo({ quest: { ...q, party: "" }, legacy: true }), "an old record: the old rule until the move");
  assert.ok(QL.visibleTo({ quest: { ...q, status: "available" }, isGM: true }));
});

test("ownership: Observer for the party's players while shown, None for others; old records by default", () => {
  const users = [{ id: "gm", isGM: true, member: false }, { id: "u1", isGM: false, member: true }, { id: "u2", isGM: false, member: false }];
  const q = { status: "active", hidden: false, party: "P1" };
  assert.deepEqual(QL.questOwnership({ quest: q, users }), { default: 0, u1: 2, u2: 0 });
  assert.deepEqual(QL.questOwnership({ quest: { ...q, hidden: true }, users }), { default: 0, u1: 0, u2: 0 });
  assert.deepEqual(QL.questOwnership({ quest: { ...q, party: "" }, users }), { default: 0, u1: 0, u2: 0 });
  assert.deepEqual(QL.questOwnership({ quest: q, users, legacy: true }), { default: 2 });
  assert.ok(QL.sameOwnership({ default: 0, u1: 2, u2: 0, gm: 3 }, { default: 0, u1: 2, u2: 0 }));
  assert.ok(QL.sameOwnership({ default: 0, u1: 2 }, { default: 0, u1: 2, u2: 0 }), "missing = none");
  assert.ok(!QL.sameOwnership({ default: 2 }, { default: 0, u1: 2 }));
  const s = src("scripts/quests.mjs");
  assert.match(s, /await j\.update\(\{ name, ownership: ownershipOf\(q\), \[`flags\.\$\{ID\}\.quest`\]: publicQuest\(q(?:, PUB)?\) \}\)/);
  assert.match(s, /JournalEntry\.create\(\{ name, folder: folder\.id, ownership: ownershipOf\(q\), flags: \{ \[ID\]: \{ quest: publicQuest\(q(?:, PUB)?\) \} \}/);
});

test("public view of a hidden quest keeps no party", () => {
  const pub = QM.publicQuest({ v: 2, status: "available", hidden: false, party: "P1", sort: 1 });
  assert.equal(pub.party, ""); assert.equal(pub.level, null);
  assert.equal(QM.publicQuest({ v: 2, status: "active", hidden: false, party: "P1", objectives: [], description: "", rewards: {}, sort: 1 }).party, "P1");
});

test("chat cards whisper the quest's viewers; pins and the tracker follow canSee", () => {
  const q = src("scripts/quests.mjs");
  assert.match(q, /const whisper = legacy\(j\) \? undefined : viewers\(j\)\.map\(u => u\.id\);/);
  assert.match(q, /const list = tracked\(\)\.map\(find\)\.filter\(j => j && canSee\(j\) && data\(j\)\.status === "active"\);/);
  assert.ok(PM.pinVisible({ pin: { kind: "gm", quest: "Q" }, isGM: false, questOk: true }));
  assert.ok(!PM.pinVisible({ pin: { kind: "gm", quest: "Q" }, isGM: false, questOk: false }), "another party's quest pin");
  assert.ok(PM.pinVisible({ pin: { kind: "gm", quest: "Q" }, isGM: true, questOk: false }), "GM sees it");
  assert.ok(PM.pinVisible({ pin: { kind: "party" }, isGM: false, questOk: false }), "a pin with no quest isn't affected");
  assert.match(src("scripts/pins.mjs"), /return M\.pinVisible\(\{ pin, isGM: game\.user\.isGM, levelOk, questOk \}\);/);
});

test("party member changes rewrite ownership on the leader only; the hot hook bails first", () => {
  const q = src("scripts/quests.mjs");
  const i = q.indexOf('Hooks.on("updateActor"'); assert.ok(i > 0);
  const body = q.slice(i, i + 600);
  assert.match(body, /hasProperty\(changes \?\? \{\}, "system\.members"\)/);
  assert.ok(body.indexOf("return;") < body.indexOf("syncOwnership"), "bails before any work");
  assert.match(body, /if \(!isActiveGM\(\)\) return;/);
});

// ---------------------------------------------------------------- parties, cap, hooks
test("parties: the setting's group actors, else the party actor", () => {
  const groups = new Set(["P1", "P2"]); const isGroup = id => groups.has(id);
  assert.deepEqual(QL.partyIds(["P2", "P1", "P2", "gone"], "P1", isGroup), ["P2", "P1"]);
  assert.deepEqual(QL.partyIds([], "P1", isGroup), ["P1"]);
  assert.deepEqual(QL.partyIds(null, "", isGroup), []);
  assert.deepEqual(QL.partyIds(["gone"], "nope", isGroup), []);
});

test("cap: default 25, active per party, warns past the cap, header text", () => {
  assert.equal(QL.CAP_DEFAULT, 25); assert.equal(QL.readCap(undefined), 25); assert.equal(QL.readCap(0), 25); assert.equal(QL.readCap(9999), QL.CAP_MAX);
  assert.deepEqual(QL.activeByParty([{ party: "A", status: "active" }, { party: "A", status: "completed" }, { party: "B", status: "active" }, { party: "", status: "active" }]), { A: 1, B: 1 });
  assert.ok(!QL.overCap(24, 25)); assert.ok(QL.overCap(25, 25));
  assert.equal(QL.capHeader(3, 25), "Quest Log (3 / 25)"); assert.equal(QL.capHeader(7, 25, true), "Quest Log (7)");
  const q = src("scripts/quests.mjs");
  assert.match(q, /function capWarn\(partyId, except\)/);
  assert.doesNotMatch(q.slice(q.indexOf("function capWarn"), q.indexOf("function capWarn") + 600), /throw|return null/, "warns, never blocks");
});

test("questUpdated: 'assigned' fires after the save when the party changes", () => {
  const q = src("scripts/quests.mjs");
  assert.ok(q.includes(`q.party = id; await save(j, q);\n    emit(j, "assigned");`));
  assert.match(q, /await save\(j, next, name\);\n {4}emit\(j, moved \? "assigned" : "updated"\);/);
  assert.ok(UX.QUEST_CHANGES.includes("assigned"));
});

test("settings: Parties and Quest cap on the Quests tab; collapsed zones a hidden client record", () => {
  const tab = Pan.TABS.find(t => t.id === "quests");
  const keys = [...tab.basic, ...tab.advanced].map(r => r[0]);
  assert.ok(keys.includes("questParties")); assert.ok(keys.includes("questCap"));
  assert.ok(Pan.LABELS.questParties && Pan.LABELS.questCap);
  assert.ok(Pan.RECORD_SETTINGS.has("questZonesCollapsed") && Pan.WIZARD_IGNORE.has("questZonesCollapsed"));
  assert.ok(Pan.RECORD_SETTINGS.has("questParties"), "actor ids: not exported");
  const q = src("scripts/quests.mjs");
  assert.match(q, /register\(ID, "questZonesCollapsed", \{ scope: "client", config: false, type: Object, default: \{\} \}\)/);
});

test("collapsed zones: flip, clean, capped", () => {
  let r = QL.toggleZone({}, "Hills"); assert.deepEqual(r, { v: 1, zones: { Hills: true } });
  r = QL.toggleZone(r, "Hills"); assert.deepEqual(r.zones, {});
  assert.deepEqual(QL.readCollapsed({ zones: { a: true, b: "yes" } }).zones, { a: true });
  assert.deepEqual(QL.readCollapsed("junk").zones, {});
  let big = {}; for (let i = 0; i < QL.ZONES_MAX + 5; i++) big = QL.toggleZone(big, `z${i}`);
  assert.equal(Object.keys(big.zones).length, QL.ZONES_MAX);
});

test("glow: the new shape re-baselines once instead of glowing every quest", () => {
  const live = [{ id: "a", stamp: "new" }];
  const old = { v: 1, init: true, seen: { a: "old" } };
  const next = UX.baseline(old, live, 2);
  assert.equal(next.shape, 2); assert.equal(next.seen.a, "new"); assert.ok(!UX.glowing(next, "a", "new"));
  const later = UX.baseline(next, live, 2); assert.equal(later.seen.a, "new");
  assert.equal(UX.glowing(UX.markSeen(later, "a", "x"), "a", "y"), true, "real changes still glow");
});

// ---------------------------------------------------------------- shared UI
test("quest log on wanderers-core's shared UI: UI_CLASSES on the window, core stylesheet first", () => {
  const mod = JSON.parse(src("module.json"));
  assert.equal(mod.styles[0], "vendor/wanderers-core/styles/wanderers-ui.css");
  assert.match(src("scripts/quests.mjs"), /classes: \["wct-quests", "wct-window", \.\.\.UI_CLASSES\]/);
  assert.equal(JSON.parse(src("wanderers-core.lock.json")).version, "0.5.1");
});

test("quest list and page look the same in both themes (no theme selectors in the module's quest CSS)", () => {
  const css = src("styles/quests.css");
  assert.doesNotMatch(css, /theme-(dark|light)/);
  assert.doesNotMatch(css, /url\(/, "no image files: CSS only");
});

test("no game-publisher wording in the 1.29 strings", () => {
  for (const f of ["scripts/quest-log-model.mjs", "scripts/quests.mjs", "styles/quests.css"]) assert.doesNotMatch(src(f), /warcraft|blizzard|\bwow\b|azeroth/i, f);
});

test("quest-log-model has no Foundry calls", () => {
  assert.doesNotMatch(src("scripts/quest-log-model.mjs"), /\b(game|ui|Hooks|foundry|canvas|document|window|CONST)\./);
});

test("1.29.0: update note and changelog section kept", async () => {
  const { NOTES } = await import("../scripts/update-notes.mjs");
  const n = NOTES.find(x => x.version === "1.29.0");
  assert.ok(n);
  assert.doesNotMatch(JSON.stringify(n), /warcraft|blizzard|azeroth|\bwow\b/i);
  assert.match(src("CHANGELOG.md"), /## 1\.29\.0[\s\S]*?Untested in Foundry/);
});
