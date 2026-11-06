import "./_globals.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as CC from "../scripts/chat-cards-model.mjs";
import * as Perm from "../scripts/permissions.mjs";
import * as Flight from "../scripts/flight.mjs";
import * as PM from "../scripts/pane-model.mjs";
import { TABS, GENERAL_TAB, LABELS, RECORD_SETTINGS, WIZARD_IGNORE } from "../scripts/panel-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const ID = "wayfarers-toolkit";
const HEALTH = `<div class="wc-ui wc-r3 wct-chat-card wct-health"><h3>x</h3></div>`;
const HEALTH_OLD = `<div class="wct-health"><h3>Wayfarer's Toolkit 1.20: health check</h3></div>`;
const UPDATE = `<div class="wc-ui wc-r3 wct-chat-card wct-update-card"><div class="wct-update"><h3>x</h3></div></div>`;
const msg = (id, t, flags, content, o = {}) => ({ id, timestamp: t, flags: { [ID]: flags }, content, ...o });

// ---------------------------------------------------------------- 1. chat clutter
test("card kinds: flag and class together; players' messages and other toolkit cards never match", () => {
  assert.equal(CC.cardKind(msg("a", 1, { health: true }, HEALTH)), "health");
  assert.equal(CC.cardKind(msg("a", 1, { health: true }, HEALTH_OLD)), "health", "pre-1.30 card");
  assert.equal(CC.cardKind(msg("a", 1, { toolkitCard: "health", health: true }, HEALTH)), "health");
  assert.equal(CC.cardKind(msg("b", 1, { updateNotes: { from: "1.0", to: "1.1", actions: [], done: [] } }, UPDATE)), "updates");
  assert.equal(CC.cardKind(msg("b", 1, { updateNotes: {} }, `<div class="wct-update">x</div>`)), "updates", "pre-1.30 update card");
  assert.equal(CC.cardKind(msg("c", 1, { health: true }, `<p>hello</p>`)), null, "flag without our card markup");
  assert.equal(CC.cardKind({ id: "d", flags: {}, content: HEALTH }), null, "markup without our flag");
  assert.equal(CC.cardKind(msg("e", 1, { health: true }, HEALTH, { authorIsGM: false })), null, "written by a player");
  for (const f of [{ quest: { id: "q" } }, { lootRoll: {} }, { roomRequest: {} }, { paceRequest: {} }, { restedRest: {} }, { vendorTrash: {} }]) assert.equal(CC.cardKind(msg("f", 1, f, HEALTH)), null, JSON.stringify(f));
  assert.equal(CC.cardKind(null), null);
});

test("prune: newest of each kind kept, older ones listed, others untouched", () => {
  const list = [
    msg("h1", 10, { health: true }, HEALTH), msg("h2", 30, { health: true }, HEALTH), msg("h3", 20, { health: true }, HEALTH_OLD),
    msg("u1", 5, { updateNotes: {} }, UPDATE), msg("u2", 40, { updateNotes: {} }, UPDATE),
    msg("q1", 1, { quest: { id: "x" } }, `<div class="wct-quest-chat">q</div>`), { id: "p1", timestamp: 2, flags: {}, content: "hi" }
  ];
  assert.deepEqual(CC.pruneIds(list).sort(), ["h1", "h3", "u1"]);
  assert.deepEqual(CC.pruneIds(list, { kinds: ["health"] }).sort(), ["h1", "h3"]);
  assert.deepEqual(CC.pruneIds(list, { kinds: ["updates"] }), ["u1"]);
  assert.deepEqual(CC.pruneCounts(list), { health: 2, updates: 1, total: 3 });
  // Same timestamp: the later message in the list is the newest.
  assert.deepEqual(CC.pruneIds([msg("a", 5, { health: true }, HEALTH), msg("b", 5, { health: true }, HEALTH)]), ["a"]);
  assert.deepEqual(CC.pruneIds([]), []); assert.deepEqual(CC.pruneIds([msg("only", 1, { health: true }, HEALTH)]), []);
});

test("prune wiring: new cards are marked, older ones go after posting, setting and panel button", () => {
  const h = src("scripts/health.mjs"), u = src("scripts/updates.mjs"), c = src("scripts/chat-cards.mjs"), p = src("scripts/panel.mjs");
  assert.match(h, /flags: \{ \[ID\]: \{ health: true, toolkitCard: "health" \} \} \}\);\n\s*await Cards\.afterPost\("health"\);/);
  assert.match(u, /toolkitCard: "updates", updateNotes:/); assert.match(u, /await Cards\.afterPost\("updates"\);/);
  assert.match(c, /register\(ID, "pruneToolkitCards", \{[^\n]*scope: "world", config: false, type: Boolean, default: true/);
  assert.match(c, /if \(!game\.user\?\.isGM \|\| get\("pruneToolkitCards"\) === false\)/);
  assert.match(c, /ChatMessage\.deleteDocuments\(there\)/); assert.doesNotMatch(c, /\.delete\(\)/);
  assert.match(p, /data-act="clear-cards"/); assert.match(p, /async clearCards\(btn\) \{[\s\S]*?await confirm\("Clear old toolkit cards"/);
  assert.match(p, /\["updateNotes", "pruneToolkitCards"\]\.map/); assert.ok(LABELS.pruneToolkitCards[0]);
  assert.match(src("scripts/main.mjs"), /Cards\.registerSettings\(\)/);
});

// ---------------------------------------------------------------- 2. ignored users
const facts = players => ({ on: id => id === "lootRolls", settings: {}, socket: true, players });
test("no-character warning: ignored players left out; the line offers Ignore these users; all ignored → ok", () => {
  const P = (id, o = {}) => ({ id, name: id.toUpperCase(), character: null, ownsAnyCharacter: false, characterOwned: false, can: {}, ...o });
  let lines = Perm.featureChecks(facts([P("p4"), P("p5", { ignored: true }), P("p1", { character: "C", characterOwned: true })]));
  const w = lines.find(l => l.feature === "characters" && l.level === "warn");
  assert.match(w.text, /No character to act with: P4\./); assert.deepEqual(w.ignore, ["p4"]);
  assert.ok(lines.some(l => l.level === "info" && /Not checked for P5 \(ignored/.test(l.text)));
  lines = Perm.featureChecks(facts([P("p4", { ignored: true }), P("p1", { character: "C", characterOwned: true })]));
  assert.ok(!lines.some(l => l.level === "warn" && l.feature === "characters"));
  assert.ok(lines.some(l => l.level === "ok" && /not checked for P4 \(ignored\)/.test(l.text)));
  assert.deepEqual(Perm.normalizeIgnored(["a", "a", "", 3, "b"]), ["a", "b"]); assert.deepEqual(Perm.normalizeIgnored(null), []);
  assert.deepEqual(Perm.withIgnored(["a"], ["b", "a"]), ["a", "b"]);
  assert.equal(Perm.withIgnored([], Array.from({ length: 150 }, (_, i) => `u${i}`)).length, Perm.IGNORE_MAX);
});

test("ignored users: setting, panel row, health fix", () => {
  const m = src("scripts/main.mjs"), h = src("scripts/health.mjs");
  assert.match(m, /register\(ID, "permIgnoreUsers", \{[^\n]*scope: "world", config: false, type: Array, default: \[\]/);
  const t = TABS.find(x => x.id === GENERAL_TAB); assert.ok(t.advanced.some(([k, , kind]) => k === "permIgnoreUsers" && kind === "users"));
  assert.ok(LABELS.permIgnoreUsers[0]); assert.ok(RECORD_SETTINGS.has("permIgnoreUsers")); assert.ok(WIZARD_IGNORE.has("permIgnoreUsers"));
  assert.match(h, /ignored: ignored\.has\(u\.id\)/); assert.match(h, /FIXES\.ignoreUsers\(l\.ignore\)/);
  assert.match(h, /ignoreUsers: ids => \(\{ label: "Ignore these users", confirm:/);
  assert.match(src("scripts/panel.mjs"), /kind === "users"\) return dirty \? listChanged\("\[data-user\]"\)/);
});

// ---------------------------------------------------------------- 3. flight warnings
test("routes into locked points: one route as before, several collapse with the list behind Show", async () => {
  assert.equal(Flight.lockedRoutesLine([]), null);
  assert.deepEqual(Flight.lockedRoutesLine(["A → B"]), { text: "Route into a locked flight point (not flown until it's unlocked): A → B.", items: [] });
  const r = Flight.lockedRoutesLine(["A → B", "C ↔ D", "E → F"]);
  assert.match(r.text, /^3 routes lead into locked flight points/); assert.deepEqual(r.items, ["A → B", "C ↔ D", "E → F"]);
  const h = src("scripts/health.mjs");
  assert.match(h, /<details class="wct-hc-more"><summary>Show the routes<\/summary>/);
  const { toPlain } = await import("../scripts/health.mjs");
  assert.equal(toPlain(`${r.text} <details class="wct-hc-more"><summary>Show the routes</summary>A → B<br>C ↔ D<br>E → F</details>`), `${r.text.replace(/\.$/, "")}: A → B, C ↔ D, E → F.`);
});

// ---------------------------------------------------------------- 4. character pane, panel marker
test("character pane height follows short screens; sheet scrolls inside", () => {
  assert.equal(PM.paneHeight(1200, { def: 880, min: 780 }), 880);
  assert.equal(PM.paneHeight(900, { def: 880, min: 780 }), 800);
  assert.equal(PM.paneHeight(700, { def: 880, min: 780 }), 600);
  assert.equal(PM.paneHeight(300, { def: 880, min: 780 }), PM.PANE_FLOOR);
  assert.equal(PM.paneMinHeight(1200, 780), 780); assert.equal(PM.paneMinHeight(700, 780), 600);
  assert.equal(PM.paneHeight(NaN, { def: 880, min: 780 }), 880);
  const css = src("styles/pane.css");
  assert.match(css, /\.application\.wct-pane \.window-content \{[^}]*overflow-y: auto/);
  assert.match(src("scripts/pane.mjs"), /height: PM\.paneHeight\(window\.innerHeight, \{ def: DEF_H, min: MIN_H \}\)/);
});

test("control panel: unsaved marker on Save and tabs", () => {
  const p = src("scripts/panel.mjs");
  assert.match(p, /save\.classList\.toggle\("wct-unsaved", n > 0\)/);
  assert.match(src("styles/panel.css"), /button\.wct-unsaved::after/);
});

// ---------------------------------------------------------------- 5. key and api.open
test("control panel key Shift+K (Shift+T is core's add-target) and api.open()", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /CONTROL_PANEL_KEY = \[\{ key: "KeyK", modifiers: \["Shift"\] \}\]/);
  assert.doesNotMatch(m, /key: "KeyT"/);
  assert.match(m, /\n {2}open\(tab\) \{ return this\.panel\(tab\); \},/);
  assert.match(m, /\n {2}panel\(tab\) \{ return this\.gmOnly\(\) \? Panel\.open\(tab\) : undefined; \},/);
});

test("1.32 version, changelog, update note", async () => {
  assert.match(JSON.parse(src("module.json")).version, /^(1\.(32|33)|2\.[012])\.\d+$/);
  assert.match(src("CHANGELOG.md"), /## 1\.32\.0[\s\S]*Untested in Foundry/);
  const { NOTES } = await import("../scripts/update-notes.mjs"); assert.ok(NOTES.some(n => n.version === "1.32.0"));
});
