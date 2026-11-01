import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

globalThis.foundry.utils.randomID ??= () => Math.random().toString(36).slice(2, 10);
const QL = await import("../scripts/quest-log-model.mjs");
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- 1.30 fixes: quest levels and reward rarity
test("parseLevel: Lv N / Level N found inside longer text; the text is kept for display", () => {
  assert.deepEqual(QL.parseLevel("Act 4 · Lv 8"), { level: 8, text: "Act 4 · Lv 8" });
  assert.deepEqual(QL.parseLevel("Level 12 (raid)"), { level: 12, text: "Level 12 (raid)" });
  assert.deepEqual(QL.parseLevel("Hills, lvl. 3"), { level: 3, text: "Hills, lvl. 3" });
  assert.deepEqual(QL.parseLevel("Act 4 Lv 8 · Lv 8"), { level: 8, text: "Act 4 Lv 8 · Lv 8" }, "the same level twice is fine");
  // Bare forms unchanged (number only, no text).
  assert.deepEqual(QL.parseLevel("Lv 4"), { level: 4, text: "" });
  assert.deepEqual(QL.parseLevel("7"), { level: 7, text: "" });
});

test("parseLevel: ranges, two levels and text without the word give no number", () => {
  for (const s of ["3-5", "Lv 3-5", "Level 3 to 5", "Lv 3 – 5", "Act 4", "Heroic", "Lv 3 or Lv 5", "Level up the party"])
    assert.deepEqual(QL.parseLevel(s), { level: null, text: s }, s);
  assert.equal(QL.parseLevel("Act 1 · Lv 999").level, QL.LEVEL_MAX, "clamped");
  assert.equal(QL.parseLevel("Lv 12345").level, null, "more than three digits is not a level");
});

test("normalizeQuest: a v2 record with a null level reads the number from its text (no migration)", () => {
  const q = QL.normalizeQuest({ v: 2, level: null, levelText: "Act 4 · Lv 8", status: "active" }, { id: () => "x" });
  assert.equal(q.level, 8); assert.equal(q.levelText, "Act 4 · Lv 8");
  // A stored number wins over the text; text without a level stays text only.
  assert.equal(QL.normalizeQuest({ v: 2, level: 5, levelText: "Act 4 · Lv 8" }).level, 5);
  assert.equal(QL.normalizeQuest({ v: 2, level: null, levelText: "3-5" }).level, null);
  // Normalizing again keeps it (the save writes level 8 and the text).
  const again = QL.normalizeQuest(q, { id: () => "x" });
  assert.equal(again.level, 8); assert.equal(again.levelText, "Act 4 · Lv 8");
  assert.ok(QL.difficulty(q.level, 8), "a difficulty band now shows");
});

test("levelInput: the editor shows the kept text, else the number", () => {
  assert.equal(QL.levelInput({ level: 8, levelText: "Act 4 · Lv 8" }), "Act 4 · Lv 8");
  assert.equal(QL.levelInput({ level: 4, levelText: "" }), "4");
  assert.equal(QL.levelInput({ level: null, levelText: "" }), "");
  assert.equal(QL.levelInput(null), "");
});

test("reward rarity: filled at save time from the pack index with system.rarity (one index per pack, no document loads)", () => {
  const q = src("scripts/quests.mjs");
  assert.match(q, /export async function fillRarity\(q\)/);
  assert.match(q, /getIndex\(\{ fields: \["system\.rarity"\] \}\)/);
  assert.match(q, /q = await fillRarity\(normalize\(q\)\)/, "every save fills it");
  assert.match(q, /const q = await fillRarity\(normalize\(\{ \.\.\.d, status/, "create fills it");
  const fn = q.slice(q.indexOf("export async function fillRarity"), q.indexOf("async function save("));
  assert.doesNotMatch(fn, /fromUuid\(/, "no async document load per item");
});

// ---------------------------------------------------------------- short health card
const Card = await import("../scripts/health-card-model.mjs");
const { UI_CLASSES } = await import("../vendor/wanderers-core/index.mjs");
const report = [{ title: "Setup", lines: [{ level: "ok", text: "a" }, { level: "warn", text: "b" }] }, { title: "Quests", lines: [{ level: "ok", text: "c" }, { level: "off", text: "d" }, { level: "bad", text: "<b>e</b>" }] }];

test("health card: counts, overall tone and text", () => {
  assert.deepEqual(Card.counts(report), { ok: 2, warn: 1, bad: 1 });
  assert.deepEqual(Card.counts(null), { ok: 0, warn: 0, bad: 0 });
  assert.deepEqual(Card.counts([{ lines: [null, { level: "x" }] }]), { ok: 0, warn: 0, bad: 0 });
  assert.equal(Card.overall({ ok: 3, warn: 1, bad: 0 }), "warn");
  assert.equal(Card.overall({ ok: 3, warn: 1, bad: 2 }), "bad");
  assert.equal(Card.overall({ ok: 0, warn: 0, bad: 0 }), "ok");
  assert.equal(Card.countText({ ok: 1, warn: 2, bad: 0 }), "1 fine, 2 warnings, 0 problems");
});

test("health card: short card is one summary line with the Satchel button; core root classes; no status characters", () => {
  const h = Card.shortCard({ version: "1.30.0", counts: Card.counts(report), satchel: true });
  assert.ok(h.startsWith(`<div class="${UI_CLASSES.join(" ")} `));
  assert.match(h, /Problems found: 2 fine, 1 warning, 1 problem\./);
  assert.match(h, /data-wct-action="open-satchel"[^>]*>.*Open in Wanderer's Satchel/);
  assert.doesNotMatch(h, /run-setup/);
  assert.doesNotMatch(h, /[✓⚠✗]/);
  assert.doesNotMatch(h, /<h4>/, "no sections");
  assert.match(Card.shortCard({ counts: { ok: 1, warn: 0, bad: 0 }, satchel: true, setup: true }), /run-setup/);
  assert.doesNotMatch(Card.shortCard({ counts: { ok: 1, warn: 0, bad: 0 }, satchel: false }), /open-satchel/);
  assert.match(Card.shortCard({ version: "<x>", counts: { ok: 1, warn: 0, bad: 0 } }), /&lt;x&gt;/);
});

test("health card: full card keeps every section and line (lines are the check's own HTML)", () => {
  const h = Card.fullCard({ version: "1.30.0", sections: report });
  assert.equal((h.match(/<h4>/g) ?? []).length, 2);
  assert.equal((h.match(/class="wc-status /g) ?? []).length, 5);
  assert.match(h, /<b>e<\/b>/);
  assert.doesNotMatch(h, /[✓⚠✗]/);
  assert.ok(h.includes(UI_CLASSES.join(" ")));
});

test("health: chat card is short only while the Satchel is active; healthReport unchanged", () => {
  const h = src("scripts/health.mjs");
  assert.match(h, /const satchel = satchelOn\(\);/);
  assert.match(h, /satchel \? Card\.shortCard\(/);
  assert.match(h, /api\.health\(\{ window: true, ids: \[ID\] \}\)/);
  assert.match(h, /export async function report\(api, \{ timeoutMs \} = \{\}\)/);
  assert.match(h, /if \(!game\.user\?\.isGM\) return \[\];/);
});
