// 2.2.1: fixes from the 2.2.0 live test (faction form field names, addSource validation, preview names, award sync).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
const R = await import("../scripts/renown-model.mjs");
const V = await import("../scripts/renown-view-model.mjs");
const A = await import("../scripts/renown-apps.mjs");
const src = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const names = html => [...String(html).matchAll(/\bname="([^"]+)"/g)].map(m => m[1]);

test("faction form: tier inputs never share a name with the faction or presets fields (Save read the faction's name)", () => {
  const row = A.tierRow(R.DEFAULT_TIERS[0], 0);
  const tier = names(row);
  assert.deepEqual(tier.sort(), Object.values(A.TIER_FIELDS).sort(), "every tier input uses TIER_FIELDS");
  assert.equal(new Set(tier).size, tier.length);
  const s = src("scripts/renown-apps.mjs");
  const faction = names(s.slice(s.indexOf("  factionHTML(f, counts) {"), s.indexOf("  _replaceHTML(result, content) { content.replaceChildren(result); }\n  _onRender() {\n    const root = this.element; if (!root) return;")));
  const shared = names(s.slice(s.indexOf("  sharedHTML() {"), s.indexOf("  factionHTML(f, counts) {")));
  assert.ok(faction.includes("name") && faction.includes("note") && faction.includes("tierset"), "the faction form's own fields are found");
  for (const n of [...faction, ...shared]) assert.ok(!tier.includes(n), `"${n}" is both a tier field and a form field`);
  for (const n of ["name", "note", "parent", "group"]) assert.equal(faction.filter(x => x === n).length, 1, `one ${n} field`);
  const fsrc = s.slice(s.indexOf("  factionHTML(f, counts) {"), s.indexOf("  _replaceHTML(result, content) { content.replaceChildren(result); }\n  _onRender() {\n    const root = this.element; if (!root) return;"));
  for (const n of ["hidden", "inactive", "startBonus"]) { assert.equal((fsrc.match(new RegExp(`sw\\("${n}"`, "g")) ?? []).length, 1, `one ${n} switch`); assert.ok(!tier.includes(n)); }
  assert.match(s, /tr\.querySelector\(`\[name=\$\{TIER_FIELDS\[n\]\}\]`\)/, "readTiers reads the renamed fields");
  assert.match(s, /const name = form\.elements\.name\.value\.trim\(\);/);
});

test("addSource: the label must be text of at most 80 characters and the amount a whole number", () => {
  assert.deepEqual(R.sourceInput("  Bastion   +1 ", "+1"), { ok: true, text: "Bastion +1", amount: 1 });
  assert.deepEqual(R.sourceInput("Saved the mayor", "−2"), { ok: true, text: "Saved the mayor", amount: -2 });
  assert.equal(R.sourceInput("x", 3).amount, 3);
  assert.equal(R.sourceInput({ a: 1 }, 1).ok, false);
  assert.match(R.sourceInput({ a: 1 }, 1).reason, /must be text/);
  assert.equal(R.sourceInput("   ", 1).ok, false);
  assert.equal(R.sourceInput("x".repeat(R.NAME_MAX + 1), 1).ok, false);
  assert.equal(R.sourceInput("x", "1.5").ok, false);
  assert.equal(R.sourceInput("x", "lots").ok, false);
  assert.equal(R.sourceInput("x", 5000).ok, false);
  assert.equal(R.sourceInput("x").amount, 0, "no amount: 0");
  const rn = src("scripts/renown.mjs");
  assert.match(rn, /const check = R\.sourceInput\(text, amount\);\n\s+if \(!check\.ok\) \{ ui\.notifications\.warn\(`Renown: \$\{check\.reason\}`\); return null; \}/);
});

test("award preview: full names (characters and faction), an ellipsis only when long", () => {
  const tiers = R.normalizeTiers(null);
  const h = V.awardHint([{ name: "TEST Character", entry: { score: 1 }, tiers }], R.parseAmount("+2"), "TEST Faction of the Long Road");
  assert.equal(h, "Each character gains it with TEST Faction of the Long Road on their own score: TEST Character 1 → 3 (Known).");
  assert.equal(V.shortName("A".repeat(40)).length, 28); assert.ok(V.shortName("A".repeat(40)).endsWith("…"));
  assert.equal(V.shortName("Short"), "Short");
  assert.match(V.awardHint([{ name: "A", entry: {}, tiers }], R.parseAmount("-2d6"), "Watch"), /loses it with Watch on their own score/);
  assert.match(src("scripts/renown-apps.mjs"), /RV\.awardHint\(rows, R\.parseAmount\(this\.amountOf\(f\)\), fac\?\.name \?\? ""\)/);
});

test("award: merchant prices follow at once; 2.2.1 version and note", async () => {
  const rn = src("scripts/renown.mjs");
  const award = rn.slice(rn.indexOf("export async function award("), rn.indexOf("export async function setScore("));
  assert.match(award, /await syncNow\(\); onChanged\(\);/);
  assert.match(rn, /export async function syncNow\(\) \{\n {2}if \(!game\.user\?\.isGM \|\| !discountsOn\(\)\) return null;\n {2}clearTimeout\(syncTimer\);/);
  const m = JSON.parse(src("module.json"));
  assert.equal(m.version, "2.2.1");
  assert.equal(m.download, "https://github.com/cocoomg11/wayfarers-toolkit/releases/download/v2.2.1/module.zip");
  const { NOTES } = await import("../scripts/update-notes.mjs");
  assert.equal(NOTES[0].version, "2.2.1");
  assert.match(JSON.stringify(NOTES[0].changes), /Create faction and Save faction work again/);
  assert.match(src("CHANGELOG.md"), /## 2\.2\.1\n\n2026-11-06\./);
});
