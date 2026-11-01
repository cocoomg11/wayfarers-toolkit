import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const loot = readFileSync(new URL("../scripts/loot.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/loot.css", import.meta.url), "utf8");
test("loot card no-GM note does not rely on a hidden attribute", () => {
  assert.doesNotMatch(loot, /wct-loot-nogm"[^>]*\bhidden/);
  assert.match(css, /\.wct-loot-nogm \{ display: none;/);
  assert.match(css, /\.wct-loot-nogm\.wct-show \{ display: block;/);
});
test("GM state runs on every render and shows the note only for viewers who still need to act", () => {
  assert.match(loot, /cards\.set\(root, !!mine\); gmState\(root, !!mine\);/);
  assert.match(loot, /classList\.toggle\("wct-show", none && needs\)/);
});
