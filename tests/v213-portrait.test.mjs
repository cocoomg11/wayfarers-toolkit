import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SP from "../scripts/sheet-pages-model.mjs";

const css = readFileSync(new URL("../styles/sheet.css", import.meta.url), "utf8");
const rule = sel => { const i = css.indexOf(`${sel} {`); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf("}", i)); };

test("portrait: whole picture on a centred 3:4 plate, never cropped wide or stretched", () => {
  const art = rule(".wct-sheet .wct-cs-art");
  assert.match(art, /aspect-ratio: 3 \/ 4/); assert.match(art, /left|inset: 8px auto 8px 50%/); assert.match(art, /transform: translateX\(-50%\)/); assert.match(art, /max-width: calc\(100% - 16px\)/);
  const img = rule(".wct-sheet .wct-cs-art img, .wct-sheet .wct-cs-art video");
  assert.match(img, /object-fit: contain/); assert.doesNotMatch(img, /object-fit: cover/);
});

test("portrait: the frame column is narrow (at most 360px) and centred between the slot columns", () => {
  const g = rule(".wct-sheet .wct-cs-dollgrid");
  assert.match(g, /grid-template-columns: var\(--wct-slot\) minmax\(0, 360px\) var\(--wct-slot\)/); assert.match(g, /justify-content: center/);
});

test("portrait: drop target, art button and edit controls unchanged", () => {
  const f = { left: [], right: [], sets: null, bottom: [], portrait: { src: "p.jpg" }, name: "A", attuned: { value: 1, max: 3 }, attributes: [], bag: [], loose: 0, editable: true, edit: true };
  const h = SP.characterPageHTML(/** @type {any} */ (f));
  assert.match(h, /class="wct-cs-model wct-portrait" data-drop="auto"/);
  assert.match(h, /data-action="wctArtwork"/); assert.match(h, /data-action="wctPortrait"/); assert.match(h, /data-wct-tokport/); assert.match(h, /Attuned <b>1 \/ 3<\/b>/);
});
