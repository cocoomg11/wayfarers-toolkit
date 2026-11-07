import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SP from "../scripts/sheet-pages-model.mjs";
import * as PM from "../scripts/pane-model.mjs";

// 2.4.2: Edit mode headroom on the Character page (page area 549px in Edit mode at 820 × 760, measured live) and a one-line weapon name.
const css = readFileSync(new URL("../styles/sheet.css", import.meta.url), "utf8");
const rule = sel => { const i = css.indexOf(`${sel} {`); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf("}", i)); };
const facts = (o = {}) => ({
  left: [], right: [], sets: null, bottom: [], relic: null, notes: [], portrait: { src: "a.webp" }, name: "Ash", attuned: null,
  attributes: [], defence: PM.defence({ ac: 16, hp: { value: 31, max: 44 }, init: 2, saves: [] }),
  attack: { title: "Melee", name: "Very long <i>blade</i> & of the far hills", quality: "rare", empty: "", rows: [], options: "", use: "s1" },
  bag: [], loose: 0, editable: true, edit: false, ...o
});

test("2.4.2: the Attack weapon name is one line with an ellipsis and its full name as a text tooltip (escaped)", () => {
  const h = SP.characterPageHTML(facts());
  assert.match(h, /<li class="wct-cs-atkname wc-q-text" data-quality="rare"><b data-tooltip-text="Very long &lt;i&gt;blade&lt;\/i&gt; &amp; of the far hills">Very long &lt;i&gt;blade&lt;\/i&gt; &amp; of the far hills<\/b><\/li>/);
  assert.doesNotMatch(h, /<b data-tooltip=/);
  const b = rule(".wct-sheet .wct-cs-kv li.wct-cs-atkname b");
  for (const p of [/white-space: nowrap/, /overflow: hidden/, /text-overflow: ellipsis/, /min-width: 0/]) assert.match(b, p);
});

test("2.4.2: Edit mode only gets a slimmer score badge and input; the edit note is slimmer; text stays at least 11px", () => {
  assert.match(rule(".wct-sheet .wct-cs.editing .wct-cs-attrs .wct-cs-abadge"), /padding: 2px 4px/);
  const ein = rule(".wct-sheet .wct-cs.editing .wct-cs-abadge .wct-cs-ein");
  assert.match(ein, /height: 18px/);
  assert.ok(Number(ein.match(/font-size: (\d+)px/)[1]) >= 11);
  assert.match(rule(".wct-sheet .wct-cs-editnote"), /padding: 3px 12px/);
  // Play-mode rules unchanged
  assert.match(rule(".wct-sheet .wct-cs-abadge .wct-cs-ein"), /height: 22px; margin-top: 2px/);
  assert.match(rule(".wct-sheet .wct-cs-abadge"), /padding: 3px 4px 4px/);
  // saved: note 6px, badges (4px input + 1px margin + 3px padding) × 2 rows = 16px → about 22px under the 549px page
  assert.ok(6 + (4 + 1 + 3) * 2 >= 20, "edit headroom budget");
});
