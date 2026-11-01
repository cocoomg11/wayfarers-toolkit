import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import "./_globals.mjs";
import { readRequest, makeRequest } from "../vendor/wanderers-core/index.mjs";
const R = await import("../scripts/requests.mjs");
const { FEATURES } = await import("../scripts/features.mjs");
const N = await import("../scripts/update-notes.mjs");
const { RECORD_SETTINGS } = await import("../scripts/panel-model.mjs");

const src = f => readFileSync(new URL(`../scripts/${f}`, import.meta.url), "utf8");
const RID = "abcd1234-1-kz0a1b";
const req = (kind, data) => readRequest(R.REQUESTS, { action: "request", kind, rid: RID, data });

// ---------------------------------------------------------------- 1: onto wanderers-core
test("core: every socket request goes through core's schemas; no module socket code of our own", () => {
  for (const f of readdirSync(new URL("../scripts/", import.meta.url))) {
    if (!f.endsWith(".mjs")) continue;
    const s = src(f);
    assert.doesNotMatch(s, /game\.socket\.(on|emit)/, `${f} uses the socket directly`);
    assert.doesNotMatch(s, /msg\.userId|r\.userId|\.userId\s*:\s*game\.user\.id/, `${f} reads or sends a payload user id`);
  }
  assert.match(src("core.mjs"), /createLeader\(\{ id: ID, log: logger\.log, requests: REQUESTS, hooks: \[NOTICE_HOOK\] \}\)/);
});

test("core: request schemas accept what the toolkit sends and refuse the rest", () => {
  assert.ok(req("flight", { from: "a", to: "b", pax: 3 }).ok);
  assert.ok(!req("flight", { from: "a", to: "b", pax: 3, free: true }).ok, "a player can't ask for a free flight");
  assert.ok(!req("flight", { from: "a", to: "b", pax: 3, userId: "someone" }).ok, "no payload user id");
  assert.ok(!req("flight", { from: "a", to: "b", pax: 99 }).ok);
  assert.ok(req("paceRequest", { pace: "slow" }).ok);
  assert.ok(!req("paceRequest", { pace: "sprint" }).ok);
  assert.ok(req("lootChoice", { messageId: "abcdefghijklmnop", choice: "need" }).ok);
  assert.ok(!req("lootChoice", { messageId: "x", choice: "need" }).ok, "document ids only");
  assert.equal(R.REQUESTS.lootClose.from, "gm"); assert.equal(R.REQUESTS.lootAssign.from, "gm"); assert.equal(R.REQUESTS.notifyAll.from, "gm");
  assert.ok(req("mapPin", { op: "create", sceneId: "abcdefghijklmnop", x: 1, y: 2, pin: { label: "Mill", kind: "gm", hidden: true } }).ok, "extra pin fields are dropped");
  assert.deepEqual(req("mapPin", { op: "create", sceneId: "abcdefghijklmnop", x: 1, y: 2, pin: { label: "Mill", kind: "gm", hidden: true } }).data.pin, { label: "Mill" });
  assert.ok(!req("mapPin", { op: "reveal", sceneId: "abcdefghijklmnop" }).ok);
  assert.ok(req("roomRequest", { sceneId: "abcdefghijklmnop", innId: "inn1" }).ok);
  assert.ok(req("restedRest", { actorId: "abcdefghijklmnop" }).ok);
  assert.ok(!req("nope", {}).ok, "unknown kinds refused");
  assert.throws(() => makeRequest(R.REQUESTS, "flight", RID, { from: "a" }));
});

test("core: notices are read for this user only, with a level and a length cap", () => {
  assert.deepEqual(R.readNotice({ to: "u1", text: "hi" }, "u1"), { level: "info", text: "hi" });
  assert.equal(R.readNotice({ to: "u2", text: "hi" }, "u1"), null);
  assert.deepEqual(R.readNotice({ to: null, level: "warn", text: "all" }, "u1"), { level: "warn", text: "all" });
  assert.equal(R.readNotice({ to: null, level: "evil", text: "x" }, "u1").level, "info");
  assert.equal(R.readNotice({ text: "" }, "u1"), null);
  assert.equal(R.readNotice({ text: "x".repeat(900) }, "u1").text.length, 300);
  assert.equal(R.NOTICE_HOOK, "wayfarers-toolkit.notice");
});

test("core: update notes use core's ordering and still read the pre-1.17 record", async () => {
  assert.deepEqual(N.decide({ current: "1.27.0" }), { kind: "fresh", from: null });
  assert.deepEqual(N.decide({ current: "1.27.0", wizardDone: true }), { kind: "upgrade", from: null });
  assert.deepEqual(N.decide({ stored: "1.26.0", current: "1.27.0" }), { kind: "upgrade", from: "1.26.0" });
  assert.deepEqual(N.decide({ current: "1.27.0", setupReminded: "1.14.4" }), { kind: "upgrade", from: "1.14.4" });
  const r = await N.build({ from: "1.26.0", to: "1.27.0", always: [] });
  assert.equal(r.entries[0].version, "1.27.0");
});

// ---------------------------------------------------------------- 2: settings IO gone, permissions part of health, healthReport
test("settings export/import and the permission-checks switch are gone; records are still listed for the hub", () => {
  assert.ok(!FEATURES.some(f => f.id === "settingsIO" || f.id === "permissionChecks"));
  assert.doesNotMatch(src("main.mjs"), /settingsIO/);
  assert.doesNotMatch(src("health.mjs"), /F\.on\("permissionChecks"\)/);
  for (const k of ["lootHistoryData", "goldSnapshots", "lastSeenVersion", "pinsNotesShown"]) assert.ok(RECORD_SETTINGS.has(k), k);
  assert.match(src("main.mjs"), /settingsRecords: \(\) => \[\.\.\.RECORD_SETTINGS\]/);
});

test("healthReport: core's format, plain text, GM only", async () => {
  const H = src("health.mjs");
  assert.match(H, /export async function report\(api/);
  assert.match(H, /if \(!game\.user\?\.isGM\) return \[\];/);
  assert.match(H, /healthCollector\(\{ timeoutMs: reportTimeout\(timeoutMs\) \}\)/);
  const { toPlain } = await import("../scripts/health.mjs").catch(() => ({}));
  if (toPlain) {
    assert.equal(toPlain(`3 creatures: <em>A</em> &amp; B. <button type="button" data-x>Link</button>`), "3 creatures: A & B.");
  }
  assert.match(src("main.mjs"), /healthReport\(opts = \{\}\) \{ return Health\.report\(this, opts\); \}/);
});

// ---------------------------------------------------------------- 6B: boss loot health check runs lookups in parallel, bounded
test("boss loot inspect: bounded parallel lookups, results in order, a failing one doesn't stop the others", async () => {
  const BL = await import("../scripts/bossloot.mjs");
  let running = 0, peak = 0;
  const out = await BL.mapLimit([...Array(30).keys()], 8, async i => {
    running++; peak = Math.max(peak, running);
    await new Promise(r => setTimeout(r, 5 - (i % 5)));
    running--;
    if (i === 3) throw new Error("boom");
    return i * 2;
  });
  assert.equal(peak, 8, "never more than the limit at once, and actually parallel");
  assert.equal(out.length, 30); assert.equal(out[0], 0); assert.equal(out[29], 58); assert.equal(out[3], undefined);
  assert.deepEqual(await BL.mapLimit([], 8, async () => 1), []);
  assert.equal(BL.INSPECT_CONCURRENCY, 8);
  // Time: 40 lookups of 20 ms with 8 at once take ~100 ms, not 800 ms.
  const t = Date.now(); await BL.mapLimit(Array(40).fill(0), 8, () => new Promise(r => setTimeout(r, 20)));
  assert.ok(Date.now() - t < 400, `took ${Date.now() - t} ms`);
  assert.doesNotMatch(readFileSync(new URL("../scripts/bossloot.mjs", import.meta.url), "utf8").match(/export async function inspect[\s\S]*?\n}\n/)[0], /for \(const r of usableList\)[^]*await fromUuid/, "no serial awaits");
});

// ---------------------------------------------------------------- 3: inns are records; rentals are GM-side
const InnM = await import("../scripts/inn-model.mjs");
const TK = "wayfarers-toolkit";
test("inns: records on the scene, versioned and capped; the old scene inn becomes one record", () => {
  const legacy = { [TK]: { inn: { on: true, name: "The Gilded Goose", price: "7s" } } };
  assert.ok(InnM.needsInnMove(legacy));
  const rec = InnM.innFromLegacy(legacy, "Market", "abc123");
  assert.deepEqual(rec, { id: "abc123", name: "The Gilded Goose", price: "7s", innkeeper: null, region: null });
  assert.equal(InnM.innFromLegacy({ [TK]: { inn: { on: false, name: "x" } } }), null, "a scene not marked Inn isn't moved");
  assert.ok(!InnM.needsInnMove({ [TK]: { inn: { on: true }, inns: { v: 1, list: [] } } }), "already moved: never again");
  let inns = { v: 1, list: [] };
  for (let i = 0; i < InnM.INNS_MAX; i++) { const r = InnM.upsertInn(inns, { id: `i${i}`, name: `Inn ${i}` }); assert.ok(r.ok); inns = r.inns; }
  const over = InnM.upsertInn(inns, { id: "extra", name: "one too many" });
  assert.equal(over.ok, false); assert.equal(over.inns.list.length, InnM.INNS_MAX);
  assert.equal(InnM.upsertInn(inns, { id: "i3", name: "Renamed" }).inns.list.find(x => x.id === "i3").name, "Renamed", "replace by id stays under the cap");
  assert.equal(InnM.removeInn(inns, "i0").list.length, InnM.INNS_MAX - 1);
  const k = InnM.cleanInn({ id: "k1", name: "K", innkeeper: { actor: "Actor.abcdefghijklmnop", token: "abcdefghijklmnop" }, region: "ponmlkjihgfedcba" });
  assert.deepEqual(k.innkeeper, { actor: "Actor.abcdefghijklmnop", token: "abcdefghijklmnop" }); assert.equal(k.region, "ponmlkjihgfedcba");
  assert.equal(InnM.cleanInn({ id: "k2", innkeeper: { actor: "<script>", token: "x" }, region: "bad" }).innkeeper, null);
  assert.equal(InnM.innOfToken({ v: 1, list: [k] }, "abcdefghijklmnop").id, "k1");
  const v = InnM.innView({ id: "a", name: "", price: "" }, { sceneName: "Harbour", defaultPrice: "5s" });
  assert.equal(v.displayName, "Harbour"); assert.equal(v.priceText, "5s");
  assert.equal(InnM.DEFAULT_PRICE, "5s");
  assert.equal(InnM.innsOf({ [TK]: { inns: { list: [{ id: "a" }, { id: "a" }, null, { name: "no id" }] } } }).list.length, 1, "duplicates and junk dropped");
});

test("inns: Rested is granted only against a GM-side rental, and rentals are capped", () => {
  assert.equal(InnM.restOutcomeChecked({ rental: null, onInn: true }), "none", "a self-set Rested flag without a rental grants nothing");
  const rent = InnM.rentalFor({ innId: "a", inn: "Goose", sceneId: "abcdefghijklmnop", at: 5, by: "abcdefghijklmnop" });
  assert.equal(InnM.restOutcomeChecked({ rental: rent, onInn: false, lastsAnywhere: true }), "grant");
  assert.equal(InnM.restOutcomeChecked({ rental: rent, onInn: false, lastsAnywhere: false }), "lose");
  assert.equal(InnM.restOutcomeChecked({ rental: rent, onInn: true, lastsAnywhere: false }), "grant");
  let b = {};
  for (let i = 0; i < InnM.RENTALS_MAX + 30; i++) b = InnM.addRentals(b, [`a${String(i).padStart(15, "0")}`], { inn: "x", at: i });
  assert.equal(Object.keys(b).length, InnM.RENTALS_MAX);
  assert.deepEqual(InnM.addRentals({}, ["not-an-id"], { inn: "x" }), {}, "only document ids");
  const inn = src("inn.mjs");
  assert.match(inn, /const rent = rental\(actor\);[\s\S]*if \(!rent\)/, "the rest checks the GM-side rental first");
  assert.match(inn, /Vault\.update\(v => \(\{ \.\.\.v, buckets: \{ \.\.\.v\.buckets, rentals: M\.addRentals/, "renting records the rental GM-side");
  assert.match(inn, /renderTokenHUD/); assert.match(inn, /Make innkeeper here/);
  assert.doesNotMatch(inn, /renderSceneConfig/);
});

// ---------------------------------------------------------------- 4: Table Tools tab
test("Table Tools: one core scene-tab section for title card, Dungeon and inns; no own scene config injection", async () => {
  for (const f of ["zone-titles.mjs", "trash.mjs", "inn.mjs", "main.mjs"]) assert.doesNotMatch(src(f).replace(/\/\/.*$/gm, ""), /Hooks\.on\("renderSceneConfig"/, f);
  const sc = src("scene-config.mjs");
  assert.match(sc, /sceneTab\.addSection\(ID, \{/);
  const { parts } = await import("../scripts/scene-config.mjs");
  assert.deepEqual(parts(() => true), ["zoneTitles", "vendorTrash", "restedInn"]);
  assert.deepEqual(parts(id => id === "vendorTrash"), ["vendorTrash"]);
  assert.deepEqual(parts(() => false), [], "every tool off: no section at all");
  assert.match(src("zone-titles.mjs"), /name="\$\{n\}\.show"/); assert.match(src("trash.mjs"), /name="flags\.\$\{ID\}\.dungeon"/);
});

// ---------------------------------------------------------------- 5: GM-only data stays off player clients
const V = await import("../scripts/vault-model.mjs");
const QM = await import("../scripts/quests-model.mjs");
const Fl = await import("../scripts/flight.mjs");
const PM = await import("../scripts/pins-model.mjs");

test("GM-only store: versioned, known buckets only, keyed buckets capped", () => {
  assert.deepEqual(V.normalizeVault(null), { v: 1, buckets: {} });
  assert.deepEqual(V.normalizeVault({ v: 99, buckets: { quests: {} } }), { v: 1, buckets: {} }, "a newer shape isn't read");
  const v = V.withKey(V.withBucket(null, "flightNetwork", { points: [] }), "quests", "q1", { status: "active" });
  assert.deepEqual(V.bucket(v, "quests"), { q1: { status: "active" } });
  assert.deepEqual(V.normalizeVault({ v: 1, buckets: { junk: 1, pins: {} } }).buckets, { pins: {} });
  assert.throws(() => V.withBucket(null, "nope", 1));
  const many = {}; for (let i = 0; i < V.CAPS.pins + 10; i++) many[`p${i}`] = { at: i };
  assert.equal(Object.keys(V.withBucket(null, "pins", many).buckets.pins).length, V.CAPS.pins);
  assert.ok(V.withBucket(null, "pins", many).buckets.pins[`p${V.CAPS.pins + 9}`], "newest kept");
  assert.equal(V.withKey(v, "quests", "q1", null).buckets.quests.q1, undefined);
  assert.ok(V.migrated(V.markMigrated(null, "quests1"), "quests1")); assert.ok(!V.migrated(null, "quests1"));
  const vs = src("vault.mjs");
  // Since 1.30 (core 0.5.0) the journal is core's createStore: ownership None, found by the vaultEntry marker (tests/v130-core.test.mjs).
  assert.match(vs, /createStore\(ID, \{[^}]*flagKey: "vault", entryFlag: "vaultEntry"/);
});

test("quests: players' copy (journal flag and page) holds no hidden objectives or GM text", () => {
  const full = { v: 1, status: "active", hidden: false, zone: "Z", level: "3", giver: { name: "G", uuid: "" }, summary: "S",
    description: `<p>Open text.</p><section class="secret" id="secret-x"><p>The mayor did it.</p></section><p>More.</p>`,
    objectives: [{ id: "a", text: "Find the mill", done: false, hidden: false, optional: false }, { id: "b", text: "Unmask the mayor", done: false, hidden: true, optional: false }],
    rewards: { coin: "5g", items: [], other: "" }, paid: false, sort: 1 };
  const pub = QM.publicQuest(full);
  const text = JSON.stringify(pub);
  assert.doesNotMatch(text, /mayor/i); assert.match(text, /Find the mill/); assert.match(text, /Open text/); assert.equal(pub.pub, true);
  const hidden = QM.publicQuest({ ...full, hidden: true });
  assert.doesNotMatch(JSON.stringify(hidden), /mill|Open text|mayor|5g/i, "a hidden quest keeps nothing");
  assert.doesNotMatch(JSON.stringify(QM.publicQuest({ ...full, status: "available" })), /mill|mayor/i, "an ungiven quest keeps nothing");
  assert.equal(QM.stripSecrets(`<section class="secret"><section class="secret">x</section>y</section>z`), "z", "nested secret blocks go whole");
  assert.equal(QM.stripSecrets(`<p>a</p><section class="secret">never closed`), "", "an unclosed secret: drop it all");
  assert.equal(QM.stripSecrets(`<section class="note"><section class="secret">s</section>keep</section>`), `<section class="note">keep</section>`);
  assert.equal(QM.stripSecrets(`<p>a</p><section class='other secret'>x</section>`), "<p>a</p>");
  assert.ok(QM.isPublic(pub)); assert.ok(!QM.isPublic(full), "an old full flag is moved once");
  const q = src("quests.mjs");
  assert.match(q, /\[`flags\.\$\{ID\}\.quest`\]: publicQuest\(q\)/, "save writes only the public view to the journal");
  assert.match(q, /flags: \{ \[ID\]: \{ quest: publicQuest\(q\) \} \}/, "create too");
  assert.doesNotMatch(q, /class="secret" id="secret-wct-objectives"/, "no secret block on the page");
});

test("flight network: players' copy keeps no locked point (names, scenes, notes) and no fares into them", () => {
  const net = { points: [{ id: "a", name: "Port", unlocked: true, note: "GM: smuggler den" }, { id: "b", name: "Hidden Vale", unlocked: false, sceneUuid: "Scene.x", note: "secret" }, { id: "c", name: "Ridge", unlocked: true }],
    routes: [{ id: "r1", from: "a", to: "c", fareCp: 50, hours: 2 }, { id: "r2", from: "a", to: "b", fareCp: 999, hours: 9 }] };
  const hide = Fl.playerView(net);
  assert.doesNotMatch(JSON.stringify(hide), /Hidden Vale|Scene\.x|secret|smuggler|999/);
  assert.deepEqual(hide.points.map(p => p.id), ["a", "c"]); assert.deepEqual(hide.routes.map(r => r.id), ["r1"]);
  const grey = Fl.playerView(net, { locked: "grey" });
  assert.doesNotMatch(JSON.stringify(grey), /Hidden Vale|Scene\.x|secret|999/);
  assert.equal(grey.points.find(p => p.id === "b").name, ""); assert.equal(grey.routes.find(r => r.id === "r2").fareCp, 0);
  const auto = Fl.autoLayout(3);
  assert.deepEqual(hide.points.find(p => p.id === "c").pos, auto[2], "points keep the GM map's positions");
  assert.match(src("main.mjs"), /game\.settings\.set\(ID, "flightNetwork", Flight\.playerView\(net/);
});

test("map pins: hidden GM pins are store records, not Notes; revealing makes the Note; pin visibility needs no journal", () => {
  const rid = PM.newPinId(() => 0.5); assert.match(rid, /^[A-Za-z0-9]{16}$/);
  const r = PM.hiddenRecord({ label: "Lair", kind: "gm", hidden: true }, { id: rid, sceneId: "abcdefghijklmnop", x: 10.4, y: 20, size: 40 });
  assert.equal(r.pin.hidden, true); assert.equal(r.x, 10);
  assert.equal(PM.hiddenRecord({ label: "Camp", kind: "party" }, { id: rid, sceneId: "abcdefghijklmnop", x: 1, y: 1 }), null, "party pins are Notes");
  const note = PM.revealedNote(r);
  assert.equal(note.flags[TK].pin.hidden, false); assert.equal(note.text, "Lair");
  const notes = [
    { sceneId: "abcdefghijklmnop", note: { _id: "nnnnnnnnnnnnnnnn", x: 5, y: 6, iconSize: 32, flags: { [TK]: { pin: { label: "Secret", kind: "gm", hidden: true } } } } },
    { sceneId: "abcdefghijklmnop", note: { _id: "mmmmmmmmmmmmmmmm", x: 5, y: 6, flags: { [TK]: { pin: { label: "Open", kind: "party" } } } } },
    { sceneId: "abcdefghijklmnop", note: { _id: "oooooooooooooooo", x: 5, y: 6, flags: {} } }
  ];
  const mv = PM.hiddenToMove(notes);
  assert.equal(mv.records.length, 1); assert.equal(mv.records[0].id, "nnnnnnnnnnnnnnnn", "the record keeps the Note's id");
  assert.deepEqual(mv.del, [{ sceneId: "abcdefghijklmnop", id: "nnnnnnnnnnnnnnnn" }]);
  assert.equal(PM.hiddenOn({ [rid]: r, bad: { x: 1 } }, "abcdefghijklmnop").length, 1);
  // Bug A: a party pin (no journal) is visible to players.
  assert.equal(PM.pinVisible({ pin: PM.normalize({ label: "Camp", kind: "party" }), isGM: false }), true);
  assert.equal(PM.pinVisible({ pin: PM.normalize({ label: "X", kind: "gm", hidden: true }), isGM: false }), false);
  assert.equal(PM.pinVisible({ pin: PM.normalize({ label: "Camp" }), isGM: false, levelOk: false }), false);
  const P = src("pins.mjs");
  assert.match(P, /get isVisible\(\) \{[\s\S]*?M\.pinVisible\(/, "WctPinNote.isVisible uses the pin's own rule");
  assert.doesNotMatch(P.match(/get isVisible\(\) \{[\s\S]*?\n {4}\}/)[0], /return super\.isVisible;\n {4}\}$/, "doesn't fall through to core's journal check for pins");
  assert.match(P, /if \(made\.pin\.hidden\) return storeHidden/, "a new hidden pin never becomes a Note");
  assert.match(P, /await storeHidden\(r\);\n {2}await note\.delete\(\);/, "hiding a revealed pin deletes its Note");
});

test("notices and requests: GM senders only; no payload user ids; player-reachable GM APIs are gated", () => {
  const main = src("main.mjs");
  assert.doesNotMatch(main, /\.\.\.Trash,/, "the internal Vendor Trash module isn't spread into the API");
  assert.match(main, /trash: gmOnlyApi\(\{/); assert.match(main, /return gmOnlyApi\(\{\n {6}get: BossLoot\.get/);
  assert.match(main, /cleanup: gmOnlyApi\(/); assert.match(main, /get gold\(\) \{ return F\.on\("partyGold"\) \? gmOnlyApi\(/);
  for (const f of ["quests.mjs", "pins.mjs", "main.mjs"]) assert.doesNotMatch(src(f), /questNotify|mapPinResult|flightResult/, f);
  assert.match(src("gm.mjs"), /Hooks\.on\(NOTICE_HOOK/, "notices only arrive as core broadcast hooks (leader's GM session)");
  for (const f of ["history.mjs", "gold.mjs"]) assert.match(src(f), /if \(!game\.user\?\.isGM\) return \[\];/, `${f}: players read nothing`);
});

// ---------------------------------------------------------------- 8: Session Start and Who's online moved to Red Book
test("Session Start and Who's online are gone; their stored settings stay readable for Red Book's migration", () => {
  for (const id of ["sessionStart", "whosOnline"]) assert.ok(!FEATURES.some(f => f.id === id), id);
  const main = src("main.mjs");
  assert.doesNotMatch(main, /sessionStart\(\)|get online\(\)|whosOnline\(\)/, "no api.sessionStart, api.online, api.whosOnline");
  assert.doesNotMatch(main, /allPlayersOnline|playerCountChanged/);
  for (const f of readdirSync(new URL("../scripts/", import.meta.url))) if (f.endsWith(".mjs")) assert.doesNotMatch(src(f), /Hooks\.callAll\(`\$\{ID\}\.(allPlayersOnline|playerCountChanged)`/, f);
  // Red Book 0.3.0 reads these through game.settings: same keys, types and defaults, hidden.
  for (const [k, type, def] of [["onlineCount", "String", "characters"], ["onlineList", "String", ""], ["onlinePosition", "String", "top-left"]]) {
    assert.match(main, new RegExp(`\\["${k}", "${def}"\\]`), k); assert.ok(type);
  }
  assert.match(main, /register\(ID, "onlineDrag", \{ scope: "world", config: false, type: Boolean, default: true \}\)/);
  assert.match(main, /register\(ID, "onlineHudPos", \{ scope: "client", config: false, type: Object, default: \{\} \}\)/);
  assert.match(main, /s\("hiddenScenes", /);
  assert.doesNotMatch(src("macros.mjs"), /fn: "(sessionStart|whosOnline)"/);
  assert.doesNotMatch(src("cleanup.mjs"), /unsetFlag\(ID, "hub"\)/, "cleanup doesn't single out the hub flag");
});

test("GM-only store: an update also deletes the keys that went away", () => {
  const prev = V.withKey(V.withKey(null, "pins", "a", { at: 1 }), "pins", "b", { at: 2 });
  const next = V.withKey(prev, "pins", "a", null);
  assert.deepEqual(V.deletions(prev, next, "flags.x.vault"), { "flags.x.vault.buckets.pins.-=a": null });
  assert.deepEqual(V.deletions(V.withBucket(null, "lootHistory", { v: 1, entries: [] }), V.normalizeVault(null), "f"), { "f.buckets.-=lootHistory": null });
  assert.deepEqual(V.deletions(prev, prev, "f"), {});
});
