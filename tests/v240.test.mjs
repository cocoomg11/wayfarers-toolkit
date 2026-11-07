import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SP from "../scripts/sheet-pages-model.mjs";
import * as PM from "../scripts/pane-model.mjs";

// 2.4: the Character page as "doll and ledger" (doll left, Attributes / Defence / Attack right, Equippable items below both).
const css = readFileSync(new URL("../styles/sheet.css", import.meta.url), "utf8");
const rule = sel => { const i = css.indexOf(`${sel} {`); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf("}", i)); };
const it = (id, q = "rare") => ({ id, name: `Item ${id}`, img: `${id}.webp`, quality: q });
const facts = (o = {}) => ({
  left: [{ slot: "head", label: "Head", item: it("h1") }], right: [{ slot: "hands", label: "Hands" }],
  sets: [{ id: "melee", label: "Melee", active: true, lock: null, hands: [{ set: "melee", hand: "main", label: "Main hand", glyph: "mainhand", item: it("s1") }, { set: "melee", hand: "off", label: "Off hand", glyph: "offhand" }] }],
  relic: null, notes: [{ tone: "warn", text: "Note." }], portrait: { src: "a.webp" }, name: "Ash", attuned: { value: 1, max: 3 },
  attributes: ["str", "dex", "con", "int", "wis", "cha"].map((key, i) => ({ key, label: key, abbr: key.toUpperCase(), value: 10 + i, mod: i - 1, source: 10 + i })),
  defence: PM.defence({ ac: 16, hp: { value: 31, max: 44 }, init: 2, saves: [{ abbr: "STR", value: { value: 3 }, prof: true }] }),
  attack: { title: "Melee", name: "Fine <b>sword</b>", quality: "uncommon", empty: "", rows: [{ label: "To hit", value: "+6" }], options: PM.attackOptions("auto", "melee"), use: "s1" },
  bag: [it("x1")], loose: 0, editable: true, edit: false, ...o
});
const order = (h, ...needles) => { let at = -1; for (const n of needles) { const i = h.indexOf(n); assert.ok(i > at, `${n} after the previous block`); at = i; } };

test("2.4 layout: one page wrapper; doll and ledger side by side in the grid; Equippable items after the grid; popover last", () => {
  const h = SP.characterPageHTML(facts());
  order(h, '<div class="wct-cs-charpage">', '<div class="wct-cs-chargrid">', '<div class="wct-cs-doll">', 'class="wct-cs-dollgrid"', 'class="wct-cs-weapons sets"', 'class="wct-cs-setnotes"',
    '<div class="wct-cs-ledger">', 'wct-cs-attrbox', 'wct-cs-defbox', 'wct-cs-attack', 'wct-cs-bagbox', '<div class="wct-cs-pop" hidden>');
  assert.doesNotMatch(h, /wct-cs-boxes/, "the 2.0 three-box row is gone");
  // the bag box is outside the grid (after the grid closes), so it spans both columns
  const grid = h.slice(h.indexOf('<div class="wct-cs-chargrid">'), h.indexOf("wct-cs-bagbox"));
  assert.equal((grid.match(/<div\b/g) ?? []).length, (grid.match(/<\/div>/g) ?? []).length, "the grid is closed before Equippable items");
  assert.equal(h.match(/<div\b/g)?.length, h.match(/<\/div>/g)?.length, "balanced divs");
});

test("2.4 attributes: six badges in a 3 × 2 grid; rolls for owners, static for observers, inputs in edit mode", () => {
  const h = SP.characterPageHTML(facts());
  assert.equal(h.match(/class="wct-cs-attr"/g)?.length, 6);
  assert.equal(h.match(/class="wct-cs-abadge" data-action="wctRoll" data-type="check"/g)?.length, 6);
  assert.match(h, /<h4>Attributes<span class="r">click to roll<\/span>/);
  const ro = SP.characterPageHTML(facts({ editable: false }));
  assert.doesNotMatch(ro, /wctRoll|click to roll/); assert.equal(ro.match(/wct-cs-abadge static/g)?.length, 6);
  const e = SP.characterPageHTML(facts({ edit: true }));
  assert.equal(e.match(/data-name="system\.abilities\.\w+\.value"/g)?.length, 6); assert.doesNotMatch(e, /wctRoll|click to roll/);
  assert.match(rule(".wct-sheet .wct-cs-attrs"), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test("2.4 spacing fix: the weapon name / empty note is the Attack list's first row (no paragraph with its own margins)", () => {
  const h = SP.characterPageHTML(facts());
  assert.match(h, /<ul class="wct-cs-kv"><li class="wct-cs-atkname wc-q-text" data-quality="uncommon"><b>Fine &lt;b&gt;sword&lt;\/b&gt;<\/b><\/li><li><span>To hit<\/span><b>\+6<\/b><\/li>/, "escaped name, then the rows");
  assert.doesNotMatch(h, /<p class="wct-cs-atkname|wct-cs-boxnote/);
  const none = SP.characterPageHTML(facts({ attack: { title: "Melee", name: "", empty: "No weapon in hand.", rows: [], options: PM.attackOptions("auto", "melee"), use: null } }));
  assert.match(none, /<ul class="wct-cs-kv"><li class="wct-cs-atkempty wct-cs-dim">No weapon in hand\.<\/li><\/ul>/);
  assert.match(none, /data-wct-attack/, "the mode select stays when nothing is in hand");
  assert.doesNotMatch(rule(".wct-sheet .wct-cs-kv li.wct-cs-atkname"), /margin/);
  assert.doesNotMatch(css, /\.wct-cs-atkname \{ margin/);
});

test("2.4 spacing fix: Defence starts on its list's padding (no empty row or margin above Armor Class); one gap token between blocks", () => {
  const h = SP.characterPageHTML(facts());
  assert.match(h, /<section class="wct-cs-box wct-cs-defbox"><h4>Defence<\/h4><ul class="wct-cs-kv"><li><span>Armor Class<\/span>/);
  assert.match(rule(".wct-sheet .wct-cs-ledger .wct-cs-kv"), /padding: 4px 10px 5px; gap: 1px/, "2.4.1 values");
  assert.match(rule(".wct-sheet .wct-cs-ledger .wct-cs-box > h4"), /min-height: 26px/, "every ledger title the same height (Attack's holds the select)");
  for (const sel of [".wct-sheet .wct-cs-charpage", ".wct-sheet .wct-cs-chargrid", ".wct-sheet .wct-cs-ledger"]) assert.match(rule(sel), /gap: var\(--wct-gap\)/, sel);
});

test("2.4 columns: 384px doll + flexible ledger; a container query stacks them on a narrow page (above the sheet's 640px minimum)", () => {
  assert.match(rule(".wct-sheet .wct-cs-chargrid"), /grid-template-columns: 384px minmax\(0, 1fr\)/);
  assert.match(rule(".wct-sheet .wct-cs-charpage"), /container: wct-charpage \/ inline-size/);
  assert.match(css, /@container wct-charpage \(max-width: 700px\) \{\s*\.wct-sheet \.wct-cs-chargrid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(rule(".application.wct-sheet"), /min-width: 640px/);
});

test("2.4 unchanged behaviour hooks: doll selectors, drop targets, sets, Use, select, bag; tooltips stay text-only", () => {
  const h = SP.characterPageHTML(facts());
  for (const re of [/class="wct-cs-model wct-portrait" data-drop="auto"/, /data-slot="head" data-item-id="h1"/, /data-set="melee" data-hand="main"/, /data-wct-activate="melee"/, /data-action="wctUse" data-item-id="s1"/,
    /<select id="wct-cs-atk" class="wct-cs-sel" data-wct-attack>/, /data-drop="bag"/, /data-action="wctArtwork"/]) assert.match(h, re);
  // pane.mjs / sheet.mjs find doll items under .wct-cs-doll and the bag under .wct-cs-bag: both still wrap them
  const doll = h.slice(h.indexOf('<div class="wct-cs-doll">'), h.indexOf('<div class="wct-cs-ledger">'));
  assert.match(doll, /data-slot="head"/); assert.match(doll, /data-set="melee"/);
  for (const m of h.matchAll(/data-tooltip="([^"]*)"/g)) assert.ok(["Drop an item here to equip it", "Proficient"].includes(m[1]), `constant data-tooltip only: ${m[1]}`);
  const sheet = readFileSync(new URL("../scripts/sheet.mjs", import.meta.url), "utf8");
  assert.match(sheet, /\.wct-cs-doll \[data-item-id\], \.wct-cs-bag \[data-item-id\]/);
});

test("2.4 CSS stays scoped, no theme selectors, the pane's stylesheet untouched by the layout", () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@container[^{]*\{/g, "");
  for (const block of body.split("}")) {
    const sel = block.split("{")[0].trim();
    if (!sel) continue;
    for (const s of sel.split(",")) assert.match(s.trim(), /^\.(application\.)?wct-sheet\b|^\.wct-sheet\b/, `scoped: ${s.trim()}`);
  }
  assert.doesNotMatch(css, /theme-(dark|light)|prefers-color-scheme/);
  assert.doesNotMatch(readFileSync(new URL("../styles/pane.css", import.meta.url), "utf8"), /wct-cs-charpage|wct-cs-ledger/);
});
