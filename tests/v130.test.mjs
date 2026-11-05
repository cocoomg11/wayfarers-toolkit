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

// ---------------------------------------------------------------- character pane (classic sheet)
const PM = await import("../scripts/pane-model.mjs");

test("pane: subtitle, Rested tooltip", () => {
  assert.equal(PM.subtitle({ level: 5, classes: "Fighter", species: "Human", party: "The Party" }), "Level 5 Fighter · Human · The Party");
  assert.equal(PM.subtitle({ level: "CR 2", classes: "", species: "", party: "" }), "CR 2");
  assert.equal(PM.subtitle({}), "");
  assert.equal(PM.restedTip({ inn: "The Inn", benefit: "Heroic Inspiration" }), "Rested at The Inn: Heroic Inspiration at the end of the next long rest.");
  assert.match(PM.restedTip({}), /the inn/);
});

test("pane: HP bar with a temporary segment; tones; no bar without a maximum", () => {
  const b = PM.hpBar({ value: 30, max: 40, temp: 10 });
  assert.equal(b.hpPct, 60); assert.equal(b.tempPct, 20); assert.equal(b.tone, "ok"); assert.equal(b.text, "30 / 40 (+10)");
  assert.equal(PM.hpBar({ value: 9, max: 40 }).tone, "bad");
  assert.equal(PM.hpBar({ value: 15, max: 40 }).tone, "warn");
  assert.equal(PM.hpBar({ value: 50, max: 40 }).hpPct, 100, "never over full");
  assert.equal(PM.hpBar({ value: 10, max: 40, effectiveMax: 50 }).max, 50, "dnd5e effectiveMax wins");
  assert.equal(PM.hpBar({ value: 5, max: null }), null);
  assert.equal(PM.hpBar(null), null);
});

test("pane: purse in the smallest coin and the ratio for core's coins()", () => {
  const three = [["gp", 10000], ["sp", 100], ["cp", 1]];
  assert.deepEqual(PM.purse({ gp: 12, sp: 46, cp: 8, pp: 0, ep: 0 }, three), { copper: 124608, ratio: 100 });
  const std = [["pp", 1000], ["gp", 100], ["ep", 50], ["sp", 10], ["cp", 1]];
  assert.deepEqual(PM.purse({ pp: 1, gp: 2, ep: 1, sp: 3, cp: 4 }, std), { copper: 1284, ratio: 10 });
  assert.equal(PM.purse({ gp: -5, sp: "x" }, std).copper, 0);
  assert.equal(PM.purse({}, []).ratio, 10);
});

test("pane: attributes and defence boxes from prepared data (save as number or { value })", () => {
  const rows = PM.attributes([["str", { label: "Strength", abbreviation: "str" }], ["dex", { label: "Dexterity", abbreviation: "dex" }], ["hon", {}]], { str: { value: 16, mod: 3 }, dex: { value: 9, mod: -1 } });
  assert.deepEqual(rows.map(r => [r.abbr, r.value, r.mod]), [["STR", 16, 3], ["DEX", 9, -1]]);
  const d = PM.defence({ ac: 17, hp: { value: 20, max: 30 }, hd: { value: 3, max: 5, denom: "d10" }, init: 2, speed: { walk: 30, units: "ft" }, saves: [{ abbr: "STR", value: { value: 5 }, prof: true }, { abbr: "DEX", value: -1 }, { abbr: "CON", value: null }] });
  assert.equal(d.ac, 17); assert.equal(d.hp, "20 / 30"); assert.equal(d.hd, "3 / 5 d10"); assert.equal(d.init, "+2"); assert.equal(d.speed, "30 ft");
  assert.deepEqual(d.saves, [{ abbr: "STR", value: "+5", prof: true }, { abbr: "DEX", value: "−1", prof: false }, { abbr: "CON", value: "–", prof: false }]);
  assert.deepEqual(PM.defence({}).hd, "–");
});

test("pane: Attack box follows the set in hand; the dropdown overrides", () => {
  assert.equal(PM.attackMode({ active: "melee" }), "melee");
  assert.equal(PM.attackMode({ active: "ranged" }), "ranged");
  assert.equal(PM.attackMode({ active: "utility", caster: true }), "spell");
  assert.equal(PM.attackMode({ active: "utility", caster: false }), "melee");
  assert.equal(PM.attackMode({ active: "melee", caster: true, focusInHand: true, weaponInHand: false }), "spell");
  assert.equal(PM.attackMode({ active: "melee", caster: true, focusInHand: true, weaponInHand: true }), "melee");
  assert.equal(PM.attackMode({ active: "ranged", override: "spell" }), "spell");
  assert.equal(PM.attackMode({ active: "ranged", override: "nonsense" }), "ranged");
  const w = PM.attackRows("melee", { weapon: { name: "Longsword", toHit: "5", damage: "1d8 + 3 Slashing", range: "5 ft", quality: "rare" } });
  assert.deepEqual(w.rows.map(r => r.value), ["+5", "1d8 + 3 Slashing", "5 ft"]); assert.equal(w.name, "Longsword");
  assert.match(PM.attackRows("ranged", {}).empty, /Ranged set/);
  const s = PM.attackRows("spell", { spell: { attack: 7, dc: 15, ability: "Wisdom", focus: { name: "Holy Symbol", quality: "common" } } });
  assert.deepEqual(s.rows.map(r => r.value), ["+7", "15", "Wisdom"]); assert.equal(s.name, "Holy Symbol");
  assert.match(PM.attackRows("spell", { spell: {} }).empty, /No spellcasting/);
  const o = PM.attackOptions("ranged", "melee");
  assert.match(o, /<option value="auto">Auto \(Melee\)<\/option>/); assert.match(o, /<option value="ranged" selected>/);
});

test("pane: quality keys from tooltip colours or dnd5e rarity (core's keys)", () => {
  assert.equal(PM.qualityKey({ color: "#A335EE" }), "epic");
  assert.equal(PM.qualityKey({ color: "#1eff00", rarity: "legendary" }), "uncommon", "the tooltip wins");
  assert.equal(PM.qualityKey({ rarity: "veryRare" }), "epic");
  assert.equal(PM.qualityKey({ rarity: "" }), "poor");
  assert.equal(PM.qualityKey({}), "poor");
});

test("pane: an original outline for every slot the toolkit has (stroke-only SVG, hidden from screen readers)", async () => {
  const pane = src("scripts/pane.mjs");
  const slots = [...pane.slice(pane.indexOf("export const SLOTS = {"), pane.indexOf("const LEFT")).matchAll(/^\s+(\w+): \{ label/gm)].map(m => m[1]);
  assert.ok(slots.length >= 20);
  for (const s of slots) { assert.ok(PM.SLOT_GLYPH[s], s); assert.ok(PM.GLYPHS[PM.SLOT_GLYPH[s]], s); }
  for (const [k, d] of Object.entries(PM.GLYPHS)) assert.match(d, /^M[\d\s.,MmLlHhVvCcSsQqAaZz-]+$/, k);
  const g = PM.glyph("head");
  assert.match(g, /^<svg class="wct-glyph-svg" viewBox="0 0 24 24" aria-hidden="true"/);
  assert.match(PM.glyph("nope"), /<path d="/);
});

test("pane: core look (UI_CLASSES, item slots, coins), dark sheet in both themes, every behaviour kept", () => {
  const pane = src("scripts/pane.mjs"); const css = src("styles/pane.css");
  assert.match(pane, /classes: \["wct-pane", "wct-window", \.\.\.UI_CLASSES\]/);
  assert.doesNotMatch(pane + css, /wc-r\d/, "never a literal revision");
  assert.match(pane, /wc-item-slot/); assert.match(pane, /coinHTML\(purse\.copper, \{ ratio: purse\.ratio \}\)/);
  assert.match(pane, /Attuned \$\{att\.value\} \/ \$\{att\.max\}/);
  assert.match(pane, /Slot equipped items/);
  assert.match(pane, /data-attack-mode/);
  for (const kept of ["_onDrop", "_slotMenu", "_handMenu", "_equipFromBag", "slotEquipped", "_tooltip", "data-activate", "data-stow-shield", "contextmenu", "dragstart"]) assert.ok(pane.includes(kept), kept);
  const sheet = css.slice(css.indexOf("/* Wanderer's Toolkit 1.30: character pane"), css.indexOf("/* Item tooltip"));
  assert.ok(sheet.length > 1000);
  assert.doesNotMatch(sheet, /\.theme-(dark|light)/, "no theme selectors inside the sheet");
  assert.match(sheet, /\.wct-pane \.wct-frame \{[^}]*--wc-text: #/, "the sheet sets its own tokens");
  assert.doesNotMatch(src("scripts/pane-model.mjs"), /warcraft|blizzard|\bwow\b|azeroth/i);
});

// ---------------------------------------------------------------- Option A look: windows, dialogs and chat cards on core's look
const Look = await import("../scripts/look-model.mjs");
const PanelM = await import("../scripts/panel-model.mjs");
const { readdirSync } = await import("node:fs");
const scripts = readdirSync(new URL("../scripts/", import.meta.url)).filter(f => f.endsWith(".mjs")).map(f => [f, src(`scripts/${f}`)]);

test("look: card() wraps once in core's root classes and escapes its extra class", () => {
  const h = Look.card("<p>x</p>", "wct-loot");
  assert.equal(h, `<div class="${UI_CLASSES.join(" ")} wct-chat-card wct-loot"><p>x</p></div>`);
  assert.equal(Look.card(h), h, "not wrapped twice");
  assert.match(Look.card("<p/>", `a"b`), /wct-chat-card a&quot;b"/);
  assert.equal(Look.isCurrent(h), true); assert.equal(Look.isCurrent("<p>old</p>"), false);
});

test("look: every toolkit window and dialog carries core's UI_CLASSES; no literal revision anywhere", () => {
  for (const [f, s] of scripts) {
    for (const m of s.matchAll(/classes: \[([^\]]*)\]/g)) if (m[1].includes('"wct-')) assert.match(m[1], /\.\.\.UI_CLASSES/, `${f}: ${m[0]}`);
    assert.doesNotMatch(s, /wc-r\d/, f);
  }
  for (const css of ["pane", "quests", "bosses", "loot", "panel", "places", "pins"]) assert.doesNotMatch(src(`styles/${css}.css`), /wc-r\d/, css);
  // Overlays built outside windows carry the root classes too.
  assert.match(src("scripts/quests.mjs"), /hud\.id = "wct-quest-tracker"; hud\.classList\.add\(\.\.\.UI_CLASSES\)/);
  assert.match(src("scripts/bosses.mjs"), /el\.id = "wct-boss-frames"; el\.classList\.add\(\.\.\.UI_CLASSES\)/);
  // Every DialogV2 has the shared dialog class.
  for (const [f, s] of scripts) for (const m of s.matchAll(/DialogV2\.(?:prompt|confirm|wait)\(\{\s*classes: \[([^\]]*)\]/g)) assert.match(m[1], /"wct-dialog"/, f);
});

test("look: chat cards go through card() (loot, trash, boss loot, summary, quests, inn, travel pace, updates, health)", () => {
  const S = Object.fromEntries(scripts);
  assert.match(S["loot.mjs"], /return card\(`<div class="wct-loot-card"/);
  assert.match(S["trash.mjs"], /content: card\(content, "wct-trash"\)/);
  assert.match(S["bossloot.mjs"], /content: lookCard\(content, "wct-bossloot"\)/);
  assert.match(S["summary.mjs"], /content: card\(content, "wct-loot-summary"\)/);
  assert.match(S["quests.mjs"], /content: lookCard\(content, "wct-quest-chat"\)/);
  assert.match(S["updates.mjs"], /content: card\(N\.cardHTML\(notice\), "wct-update-card"\)/);
  assert.match(S["main.mjs"], /gmWhisper\(content\) \{ return ChatMessage\.create\(\{ content: card\(content\)/);
  assert.match(S["main.mjs"], /say\(content, alias = "Narrator"\) \{ return ChatMessage\.create\(\{ content: card\(content\)/);
  assert.match(S["inn.mjs"], /content: card\(`<p><strong>\$\{esc\(u\.name\)\}<\/strong> asks for rooms/);
  assert.match(S["main.mjs"], /content: card\(`<p><strong>\$\{esc\(u\.name\)\}<\/strong> asks to travel/);
});

test("look: control panel on core's sidebar shell; sidebar keys", () => {
  const p = src("scripts/panel.mjs");
  assert.match(p, /div\.className = "wc-shell wct-panel-body"/);
  assert.match(p, /<nav class="wc-side wct-tabs" role="tablist"/);
  assert.match(p, /class="wc-nav" role="tab"/);
  assert.match(p, /ev\.key === " " \|\| ev\.key === "Enter"\) \{ ev\.stopPropagation\(\)/, "Space never pauses the game");
  assert.equal(PanelM.navKey("ArrowDown", 0, 5), 1); assert.equal(PanelM.navKey("ArrowDown", 4, 5), 0);
  assert.equal(PanelM.navKey("ArrowUp", 0, 5), 4); assert.equal(PanelM.navKey("ArrowLeft", 2, 5), 1); assert.equal(PanelM.navKey("ArrowRight", 2, 5), 3);
  assert.equal(PanelM.navKey("Home", 3, 5), 0); assert.equal(PanelM.navKey("End", 0, 5), 4);
  assert.equal(PanelM.navKey("a", 0, 5), null); assert.equal(PanelM.navKey("Home", 0, 0), null);
});

test("look: core coins in money displays, ratio from the coins in use (100 three-coin, 10 standard)", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /function moneyHTML\(amount\) \{ return coinsMarkup\(/);
  assert.match(m, /return v\.sp > 0 && v\.cp > 0 \? Math\.round\(v\.sp \/ v\.cp\) : 10;/);
  assert.match(m, /parseMoney, fmtMoney, coins, moneyHTML, coinRatio,/);
  for (const f of ["coinlog.mjs", "inn.mjs"]) assert.match(Object.fromEntries(scripts)[f], /API\.moneyHTML\(amount\)/, f);
});

test("look: toolkit CSS reads core tokens; only in-world surfaces keep their own palette, and none uses theme selectors", () => {
  for (const f of ["panel", "loot", "pins"]) assert.doesNotMatch(src(`styles/${f}.css`), /\.theme-(dark|light)/, f);
  assert.doesNotMatch(src("styles/quests.css"), /theme-(dark|light)/);
  const bosses = src("styles/bosses.css"); assert.match(bosses, /#wct-boss-frames \{[^}]*--wc-text:/);
  assert.doesNotMatch(src("styles/pins.css"), /\.window-content \{ background: #efe4c6/, "pin dialogs follow the theme");
});

test("1.30.0: version, download URL, update note, changelog with the live checklist", async () => {
  const m = JSON.parse(src("module.json"));
  assert.match(m.version, /^1\.(30|31|32|33)\.\d+$/);
  assert.equal(m.download, `https://github.com/cocoomg11/wayfarers-toolkit/releases/download/v${m.version}/module.zip`);
  assert.equal(m.styles[0], "vendor/wanderers-core/styles/wanderers-ui.css");
  const { NOTES } = await import("../scripts/update-notes.mjs");
  const n130 = NOTES.find(n => n.version === "1.30.0");
  assert.ok(n130);
  assert.doesNotMatch(JSON.stringify(n130), /warcraft|blizzard|azeroth|\bwow\b/i);
  const cl = src("CHANGELOG.md");
  assert.match(cl, /## 1\.30\.0[\s\S]*?\*\*Fixed\*\*[\s\S]*?Untested in Foundry/);
  assert.equal(JSON.parse(src("wanderers-core.lock.json")).version, "0.5.1");
});
