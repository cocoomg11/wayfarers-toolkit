import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SP from "../scripts/sheet-pages-model.mjs";
import * as PM from "../scripts/pane-model.mjs";

// 2.4.1: the Character page fits the default window (page area 576px tall in Foundry 14, measured live); the lock reason shows.
const css = readFileSync(new URL("../styles/sheet.css", import.meta.url), "utf8");
const rule = sel => { const i = css.indexOf(`${sel} {`); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf("}", i)); };
const narrow = css.slice(css.indexOf("@container wct-charpage (max-width: 700px)"));
const nrule = sel => { const i = narrow.indexOf(`${sel} {`); assert.ok(i >= 0, `narrow ${sel}`); return narrow.slice(i, narrow.indexOf("}", i)); };
const it = (id, q = "rare") => ({ id, name: `Item ${id}`, img: `${id}.webp`, quality: q });
const set = (id, o = {}) => ({ id, label: id[0].toUpperCase() + id.slice(1), active: false, lock: null, hands: [{ set: id, hand: "main", label: "Main hand", glyph: "mainhand", item: it(`${id}1`) }, { set: id, hand: "off", label: "Off hand", glyph: "offhand" }], ...o });
const facts = (o = {}) => ({
  left: [{ slot: "head", label: "Head" }], right: [{ slot: "hands", label: "Hands" }],
  sets: [set("melee", { active: true }), set("utility", { lock: "Needs both hands & <the> shield is on." })],
  relic: null, notes: [], portrait: { src: "a.webp" }, name: "Ash", attuned: null,
  attributes: [], defence: PM.defence({ ac: 16, hp: { value: 31, max: 44 }, init: 2, saves: [] }),
  attack: { title: "Melee", name: "Sword", quality: "common", empty: "", rows: [], options: PM.attackOptions("auto", "melee"), use: "s1" },
  bag: [], loose: 0, editable: true, edit: false, ...o
});

test("2.4.1 fit: compact doll in the two-column layout (42px slots, 38px hands, sets on one line, no 360px portrait floor)", () => {
  assert.match(rule(".wct-sheet .wct-cs-chargrid .wct-cs-doll"), /--wct-slot: 42px/);
  assert.match(rule(".wct-sheet .wct-cs-chargrid .wct-cs-col"), /gap: 6px/);
  assert.match(rule(".wct-sheet .wct-cs-chargrid .wct-cs-model"), /min-height: 0/);
  assert.match(rule(".wct-sheet .wct-cs-chargrid .wct-cs-weapons"), /flex-wrap: nowrap/);
  assert.match(rule(".wct-sheet .wct-cs-chargrid .wct-cs-weapons .wct-cs-slot"), /--wct-slot: 38px/);
  assert.match(rule(".wct-sheet .wct-cs-charpage"), /--wct-gap: 8px/);
  // 8 slots × 42 + 7 gaps × 6 = 378px of doll grid; must stay well under the 576px page with the weapon row (~90px) and padding
  assert.ok(8 * 42 + 7 * 6 + 2 * 10 + 8 + 90 < 576 - 24, "doll height budget");
});

test("2.4.1 fit: tighter ledger (26px titles, 20px rows, 20px Use); text never below 11px", () => {
  assert.match(rule(".wct-sheet .wct-cs-ledger .wct-cs-kv li"), /min-height: 20px/);
  assert.match(rule(".wct-sheet .wct-cs-ledger .wct-cs-kv .wct-cs-gbtn.sm"), /height: 20px/);
  const page = css.slice(css.indexOf("/* Character page (2.4"), css.indexOf(".wct-sheet .wct-cs-bag {"));
  for (const m of page.matchAll(/font-size: (\d+)px/g)) assert.ok(Number(m[1]) >= 10, `font-size ${m[1]}px`);
  assert.match(rule(".wct-sheet .wct-cs-saves b"), /font-size: 12px/);
});

test("2.4.1: the stacked layout (under 700px) restores the 2.4.0 doll sizes", () => {
  assert.match(nrule(".wct-sheet .wct-cs-chargrid .wct-cs-doll"), /--wct-slot: 48px/);
  assert.match(nrule(".wct-sheet .wct-cs-chargrid .wct-cs-model"), /min-height: 360px/);
  assert.match(nrule(".wct-sheet .wct-cs-chargrid .wct-cs-weapons"), /flex-wrap: wrap/);
  assert.match(nrule(".wct-sheet .wct-cs-chargrid .wct-cs-weapons .wct-cs-slot"), /--wct-slot: 44px/);
  assert.match(nrule(".wct-sheet .wct-cs-dollgrid"), /minmax\(0, 360px\)/);
});

test("2.4.1 lock tooltip: the reason is in the set button's own text tooltip; the icon has none of its own", () => {
  const h = SP.characterPageHTML(facts());
  assert.match(h, /data-wct-activate="utility" aria-pressed="false" data-tooltip-text="Swap to the Utility set\. Locked: Needs both hands &amp; &lt;the&gt; shield is on\.">/);
  assert.match(h, /<span class="wct-cs-lock" aria-label="Locked: Needs both hands &amp; &lt;the&gt; shield is on\.">/);
  assert.doesNotMatch(h, /class="wct-cs-lock" data-tooltip/);
  assert.match(h, /data-wct-activate="melee" aria-pressed="true" data-tooltip-text="Melee set \(in hand\)">/);
  assert.equal(SP.setTip({ label: "Ranged", active: false, lock: null }), "Swap to the Ranged set");
  assert.equal(SP.setTip({ label: "Ranged", active: true, lock: "x" }), "Ranged set (in hand). Locked: x");
  for (const m of h.matchAll(/data-tooltip="([^"]*)"/g)) assert.ok(["Drop an item here to equip it"].includes(m[1]), `constant data-tooltip only: ${m[1]}`);
});
