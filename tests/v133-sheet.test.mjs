import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SM from "../scripts/sheet-model.mjs";
import { FEATURES } from "../scripts/features.mjs";
import * as PM from "../scripts/panel-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- feature toggle and registration
test("sheet: its own feature, off by default, a card, not in the Classic preset", () => {
  const f = FEATURES.find(x => x.id === "characterSheet");
  assert.ok(f); assert.equal(f.default, false); assert.equal(f.key, "feature-characterSheet"); assert.equal(f.label, "Character sheet replacement");
  assert.ok(PM.FEATURE_IDS.includes("characterSheet")); assert.ok(PM.FEATURE_CARDS.some(c => c.id === "characterSheet"));
  assert.equal(PM.presetSettings("classic")["feature-characterSheet"], false);
  assert.equal(PM.presetSettings("minimal")["feature-characterSheet"], false);
  assert.equal(PM.presetSettings("everything")["feature-characterSheet"], true);
});

test("sheet: registered only while the feature is on; makeDefault, character type, label", () => {
  const m = src("scripts/main.mjs"); const s = src("scripts/sheet.mjs");
  assert.match(m, /if \(F\.on\("characterSheet"\)\) \{ Sheet\.register\(\); if \(F\.on\("keybindings"\)\) Sheet\.registerKey\(\); \}/);
  assert.match(s, /DSC\.registerSheet\(Actor, ID, WctCharacterSheet, \{ types: \["character"\], makeDefault: true, label: SM\.SHEET_LABEL \}\)/);
  assert.equal(SM.SHEET_LABEL, "Wanderer's Toolkit sheet");
  assert.doesNotMatch(s, /unregisterSheet|game\.settings\.set\("core", "sheetClasses"/, "never touches dnd5e's registration or stored defaults");
  assert.match(s, /class WctCharacterSheet extends foundry\.applications\.sheets\.ActorSheetV2/);
  assert.match(s, /classes: \["wct-sheet", "wct-window", \.\.\.UI_CLASSES\]/);
});

test("sheet: dnd5e's own methods for every button; nothing computed", () => {
  const s = src("scripts/sheet.mjs");
  for (const call of ["this.actor.shortRest(", "this.actor.longRest(", "this.actor.rollInitiativeDialog(", "this.actor.rollDeathSave(",
    '"system.attributes.inspiration": !this.actor.system.attributes.inspiration', '"system.attributes.exhaustion": level'])
    assert.ok(s.includes(call), call);
  assert.match(s, /GM only: open this actor in the system's own sheet/);
  assert.match(s, /if \(game\.user\.isGM\) \{\s*const btn/, "System sheet button for GMs only");
  assert.match(s, /_preparationWarnings/, "warnings come from dnd5e");
});

// ---------------------------------------------------------------- key
test("key: own action, default C (no modifier), registered only with keyboard shortcuts on", () => {
  assert.equal(SM.SHEET_ACTION, "characterSheet");
  assert.deepEqual(SM.SHEET_KEY, [{ key: "KeyC", modifiers: [] }]);
  const m = src("scripts/main.mjs");
  assert.match(m, /reg\("characterPane", [^\n]*\(\) => WCT\.characterPane\(\)\);\n/, "the pane keeps its action and no default key");
  // Clashes: core (v14) moves with W/A/S/D and arrows, Shift+T targets, Shift+C nothing toolkit; dnd5e Shift+B / Shift+E;
  // toolkit Shift+K, L. Plain C is core's Toggle Character Sheet, which this action runs ahead of (PRIORITY).
  const taken = ["Shift+KeyW", "Shift+KeyA", "Shift+KeyS", "Shift+KeyD", "Shift+KeyC", "Shift+KeyT", "Shift+KeyB", "Shift+KeyE", "Shift+KeyK", "Shift+KeyR", "Shift+KeyG", "Control+Shift+KeyN", "KeyL"];
  const mine = SM.SHEET_KEY.map(b => [...b.modifiers, b.key].join("+"));
  for (const k of mine) assert.ok(!taken.includes(k), k);
  assert.match(src("scripts/sheet.mjs"), /precedence: CONST\.KEYBINDING_PRECEDENCE\.PRIORITY/);
});

test("key: never while typing", () => {
  assert.equal(SM.isTyping(null), false);
  assert.equal(SM.isTyping({ tagName: "INPUT", type: "text" }), true);
  assert.equal(SM.isTyping({ tagName: "INPUT" }), true, "no type = text");
  assert.equal(SM.isTyping({ tagName: "input", type: "number" }), true);
  assert.equal(SM.isTyping({ tagName: "INPUT", type: "checkbox" }), false);
  assert.equal(SM.isTyping({ tagName: "TEXTAREA" }), true);
  assert.equal(SM.isTyping({ tagName: "SELECT" }), true);
  assert.equal(SM.isTyping({ tagName: "DIV", isContentEditable: true }), true, "ProseMirror");
  assert.equal(SM.isTyping({ tagName: "BUTTON" }), false);
  assert.equal(SM.isTyping({ tagName: "BODY" }), false);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /cfg\.onDown = ctx => \(SM\.isTyping\(ctx\?\.event\?\.target\) \|\| SM\.isTyping\(document\.activeElement\) \? false : run\(ctx\)\)/, "the press passes through to the field");
});

test("key: which actor", () => {
  const pc = { type: "character", name: "A" }; const npc = { type: "npc", name: "Wolf" };
  assert.equal(SM.pickSheetActor({ isGM: false, character: pc }).actor, pc);
  assert.match(SM.pickSheetActor({ isGM: false, character: null }).warn ?? "", /no character assigned/);
  assert.equal(SM.pickSheetActor({ isGM: false, controlled: [npc], character: pc }).actor, pc, "players ignore the selection");
  assert.equal(SM.pickSheetActor({ isGM: true, controlled: [pc], character: null }).actor, pc);
  assert.equal(SM.pickSheetActor({ isGM: true, controlled: [null, pc] }).actor, pc, "token without an actor skipped");
  assert.match(SM.pickSheetActor({ isGM: true, controlled: [] }).warn ?? "", /Select a character's token/);
  assert.match(SM.pickSheetActor({ isGM: true, controlled: [npc] }).warn ?? "", /Wolf isn't a player character/);
});

// ---------------------------------------------------------------- view model
const facts = (o = {}) => ({
  name: "Ash", level: 5, classes: [{ name: "Ranger", levels: 5 }], species: "Elf", background: "Guide", showXp: true,
  xp: { value: 7250, min: 6500, max: 14000, pct: 10 }, rested: null, inspiration: true,
  hp: { value: 31, max: 44, effectiveMax: 44, temp: 5 }, hd: { value: 3, max: 5, denom: "d10" }, ac: 16, init: 4,
  speed: { walk: 35, units: "ft" }, prof: 3, exhaustion: { value: 1, max: 6 }, death: { success: 1, failure: 0 }, warnings: ["Two armors"],
  conditions: [{ id: "poisoned", name: "Poisoned" }, { id: "exhaustion", name: "Exhaustion" }], bastion: false, editable: true, isGM: false, showRests: true, ...o
});

test("view: band and vitals read straight from the facts", () => {
  const v = SM.sheetView(facts());
  assert.equal(v.sub, "Ranger 5 · Elf · Guide");
  assert.deepEqual(v.xp, { pct: 10, text: "7,250 / 14,000" }, "dnd5e's pct used as is");
  assert.equal(v.ac, 16); assert.equal(v.init, "+4"); assert.equal(v.initTone, "pos"); assert.equal(v.prof, "+3"); assert.equal(v.speed, "35");
  assert.equal(v.hp?.text, "HP 31 / 44 · +5"); assert.equal(v.hp?.hpPct, 63.3); assert.equal(v.hp?.tempPct, 10.2);
  assert.equal(v.hd?.text, "Hit dice 3 / 5 d10"); assert.equal(v.hd?.pct, 60);
  assert.deepEqual(v.exhaustion.pips, [true, false, false, false, false, false]);
  assert.deepEqual(v.death, { success: 1, failure: 0 });
  assert.deepEqual(v.conditions.map(c => c.id), ["poisoned"], "exhaustion has its own pips");
  assert.equal(SM.sheetView(facts({ classes: [{ name: "Fighter", levels: 3 }, { name: "Rogue", levels: 2 }] })).sub, "Fighter 3 / Rogue 2 · Elf · Guide");
  assert.equal(SM.sheetView(facts({ xp: { value: 400000, max: Infinity } })).xp?.text, "400,000", "level cap");
  assert.equal(SM.sheetView(facts({ showXp: false })).xp, null);
  assert.equal(SM.sheetView(facts({ init: -1 })).init, "−1");
  assert.equal(SM.sheetView(facts({ hp: {} })).hp, null);
});

test("view: modes, warnings only in edit mode, rests and buttons only for owners", () => {
  assert.equal(SM.sheetView(facts()).mode, "play");
  assert.equal(SM.sheetView(facts(), { mode: "edit" }).mode, "edit");
  assert.equal(SM.sheetView(facts({ editable: false }), { mode: "edit" }).mode, "play", "observers can't edit");
  assert.equal(SM.sheetView(facts()).warnings, null, "play mode: no badge");
  assert.deepEqual(SM.sheetView(facts(), { mode: "edit" }).warnings, ["Two armors"]);
  assert.equal(SM.sheetView(facts({ warnings: null }), { mode: "edit" }).warnings, null, "not exposed: badge hidden");
  assert.equal(SM.sheetView(facts({ warnings: [] }), { mode: "edit" }).warnings, null);
  const ro = SM.sheetHTML(SM.sheetView(facts({ editable: false })));
  for (const a of ["wctShortRest", "wctLongRest", "wctInitiative", "wctDeathSave", "wctExhaustion", "wctInspiration", "wctMode"]) assert.ok(!ro.includes(`data-action="${a}"`), a);
  const rw = SM.sheetHTML(SM.sheetView(facts(), { mode: "edit" }));
  for (const a of ["wctShortRest", "wctLongRest", "wctInitiative", "wctDeathSave", "wctExhaustion", "wctInspiration", "wctMode"]) assert.ok(rw.includes(`data-action="${a}"`), a);
  assert.match(rw, /1 warning</); assert.match(rw, /Edit mode:/);
  assert.ok(!SM.sheetHTML(SM.sheetView(facts({ showRests: false }))).includes("wctShortRest"), "dnd5e's allowRests off");
});

test("view: bookmarks, Bastion only when dnd5e offers one, placeholder pages with the system-sheet link", () => {
  assert.deepEqual(SM.visiblePages({}).map(p => p.id), ["character", "details", "inventory", "features", "spells", "effects", "biography", "special"]);
  assert.ok(SM.visiblePages({ bastion: true }).some(p => p.id === "bastion"));
  assert.equal(SM.pickPage("bastion", {}), "character");
  assert.equal(SM.pickPage("spells", {}), "spells");
  assert.equal(SM.pickPage(undefined, {}), "character");
  const h = SM.sheetHTML(SM.sheetView(facts(), { page: "spells" }));
  assert.match(h, /data-page="spells" aria-selected="true"/);
  assert.match(h, /coming in a later slice/); assert.match(h, /data-action="wctSystemSheet" data-page="spells"/);
  assert.match(h, /<footer class="wct-cs-foot"><span class="wct-cs-lab">Conditions<\/span>/);
  assert.ok(!h.includes("favourite") && !h.includes("Favourites"), "no favourites bar");
  assert.match(SM.sheetHTML(SM.sheetView(facts({ conditions: [] }))), /wct-cs-dim">None</);
});

test("view: limited viewers see name only; text is escaped", () => {
  const h = SM.sheetHTML(SM.sheetView(facts({ limited: true, editable: false })));
  assert.ok(!h.includes("wct-cs-vitals")); assert.match(h, /only see this character's name/);
  assert.match(SM.sheetHTML(SM.sheetView(facts({ name: "<b>x</b>" }))), /&lt;b&gt;x&lt;\/b&gt;/);
});

test("exhaustion pips: click a level to set it, the current one to lower it", () => {
  assert.equal(SM.exhaustionTarget(0, 1), 1);
  assert.equal(SM.exhaustionTarget(1, 1), 0);
  assert.equal(SM.exhaustionTarget(2, 5), 5);
  assert.equal(SM.exhaustionTarget(3, 3), 2);
  assert.equal(SM.exhaustionTarget(0, 9), 6, "capped");
  assert.equal(SM.exhaustionTarget(undefined, 0), 0);
});

// ---------------------------------------------------------------- look
test("css: scoped to the sheet, dark in both themes (no theme selectors), registered", () => {
  const css = src("styles/sheet.css");
  assert.doesNotMatch(css, /theme-(dark|light)/);
  assert.doesNotMatch(css, /wc-r\d/);
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map(r => r.split("{")[0].trim()).filter(Boolean))
    for (const sel of rule.split(",")) assert.match(sel.trim(), /^\.(application\.)?wct-sheet\b/, sel);
  assert.ok(JSON.parse(src("module.json")).styles.includes("styles/sheet.css"));
});

test("public repo: no campaign or publisher names in the sheet files", () => {
  const all = src("scripts/sheet.mjs") + src("scripts/sheet-model.mjs") + src("styles/sheet.css");
  assert.doesNotMatch(all, /warcraft|blizzard|azeroth|defias|onyx/i);
});
