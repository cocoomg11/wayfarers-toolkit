import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SM from "../scripts/sheet-model.mjs";
import * as SX from "../scripts/sheet-extra-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- Effects
test("effects: categories decided exactly as dnd5e's prepareCategories", () => {
  assert.equal(SX.effectCategory({ concealed: true }), null);
  assert.equal(SX.effectCategory({ condition: true }), null, "conditions show in the Conditions box");
  assert.equal(SX.effectCategory({ condition: true, concentrating: true, temporary: true }), "temporary", "concentration stays listed");
  assert.equal(SX.effectCategory({ appliedEnchantment: true }), "enchantmentActive");
  assert.equal(SX.effectCategory({ appliedEnchantment: true, disabled: true }), "enchantmentInactive");
  assert.equal(SX.effectCategory({ enchantment: true }), "enchantment");
  assert.equal(SX.effectCategory({ expired: true, temporary: true }), "inactive");
  assert.equal(SX.effectCategory({ suppressed: true }), "suppressed");
  assert.equal(SX.effectCategory({ disabled: true }), "inactive");
  assert.equal(SX.effectCategory({ temporary: true }), "temporary");
  assert.equal(SX.effectCategory({}), "passive");
  assert.deepEqual(SX.EFFECT_CATEGORIES.map(c => c.id), ["enchantment", "temporary", "enchantmentActive", "passive", "enchantmentInactive", "inactive", "suppressed"]);
  assert.deepEqual(SX.effectSections([]).map(s => s.id), ["temporary", "passive", "inactive"], "enchantment and unavailable sections only when used (dnd5e)");
});

const fx = (o = {}) => ({
  effects: [
    { id: "e1", uuid: "Actor.a.ActiveEffect.e1", parentId: null, name: "Bless", img: "b.webp", cat: "temporary", disabled: false, toggleable: true, source: { name: "Cleric", uuid: "Actor.c" }, duration: ["9 rounds"], showDuration: true },
    { id: "e2", uuid: "Actor.a.Item.i1.ActiveEffect.e2", parentId: "i1", name: "Ring of Protection", img: "r.webp", cat: "passive", disabled: false, toggleable: true, source: { name: "Ring", uuid: "Actor.a.Item.i1", item: true }, changes: [{ name: "AC bonus", value: "+1" }] },
    { id: "e3", name: "Concentrating", img: "c.webp", cat: "temporary", toggleable: false },
    { id: "e4", name: "Cloak magic", img: "k.webp", cat: "suppressed", parentId: "i2" }
  ],
  conditions: [{ id: "blinded", name: "Blinded", img: "bl.svg", active: false, level: null }, { id: "exhaustion", name: "Exhaustion", img: "ex.svg", active: true, level: 2 }],
  editable: true, edit: false, search: "", ...o
});

test("effects: inside dnd5e's <dnd5e-effects> element with its markup hooks (toggle, expand, menu, item effects, conditions)", () => {
  const h = SX.effectsPageHTML(fx());
  assert.match(h, /^<dnd5e-effects class="effects-element wct-cs-effects">/);
  assert.match(h, /data-effect-id="e2" data-entry-id="e2" data-item-name="Ring of Protection" data-parent-id="i1"/, "item effects carry their item (dnd5e's getEffect)");
  assert.match(h, /data-effect-id="e1"[\s\S]*?data-action="toggle" aria-label="Disable effect"/);
  const e3 = h.slice(h.indexOf('data-effect-id="e3"')); assert.doesNotMatch(e3.slice(0, e3.indexOf("</li>")), /data-action="toggle"/, "concentration isn't toggled (dnd5e)");
  assert.match(h, /data-action="toggleExpand"/); assert.match(h, /data-context-menu/);
  assert.match(h, /<span class="effect-source"><a data-uuid="Actor\.c">Cleric<\/a>/);
  assert.match(h, /9 rounds/);
  assert.match(h, /data-effect-type="suppressed"[\s\S]*?equipped or attuned/);
  assert.match(h, /data-action="toggleCondition" data-condition-id="blinded" aria-pressed="false"/);
  assert.match(h, /data-condition-id="exhaustion" aria-pressed="true"[^>]*>[\s\S]*?<b class="wct-cs-clvl">2<\/b>/);
  assert.match(h, /AC bonus<\/span><b>\+1/);
});

test("effects: edit mode = edit / delete / create; observers get no buttons; search", () => {
  const e = SX.effectsPageHTML(fx({ edit: true }));
  assert.match(e, /data-action="edit" aria-label="Edit effect"/); assert.match(e, /data-action="delete" aria-label="Delete effect"/);
  assert.match(e, /data-action="wctCreateEffect">\+ Create effect/);
  const ro = SX.effectsPageHTML(fx({ editable: false }));
  assert.doesNotMatch(ro, /data-action="toggle"|toggleCondition|wctCreateEffect/);
  assert.match(SX.effectsPageHTML(fx({ search: "ring" })), /data-item-name="Bless"[^>]*hidden/);
  assert.match(SX.effectsPageHTML(fx({ search: "zzz" })), /wct-cs-nomatch"\s*>No effects match/);
});

// ---------------------------------------------------------------- Biography
const bio = (o = {}) => ({
  characteristics: SX.CHARACTERISTICS.map(k => ({ key: k, label: k[0].toUpperCase() + k.slice(1), value: k === "age" ? "86" : "", source: k === "age" ? "86" : "" })),
  text: { ideal: "A road walked\nstays open.\n\nAlways.", bond: "", flaw: "<b>x</b>", trait: "", appearance: "" },
  biography: { enriched: "<p>Grew up by the fens.</p>", source: "<p>Grew up by the fens.</p>" }, uuid: "Actor.a", editable: true, edit: false, ...o
});

test("biography: dnd5e's characteristics and text boxes; plain text formatted like dnd5e's textFormat", () => {
  assert.deepEqual(SX.CHARACTERISTICS, ["alignment", "eyes", "height", "faith", "hair", "weight", "gender", "skin", "age"]);
  assert.deepEqual(SX.TEXTBOXES.map(t => t.key), ["ideal", "bond", "flaw", "trait", "appearance"]);
  assert.equal(SX.textFormat("a\nb\n\nc"), "<p>a<br>b</p><p>c</p>"); assert.equal(SX.textFormat(""), "");
  const h = SX.biographyPageHTML(bio());
  assert.match(h, /<span class="wct-cs-dim">Age<\/span><b>86<\/b>/);
  assert.match(h, /<p>A road walked<br>stays open\.<\/p><p>Always\.<\/p>/);
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/, "escaped");
  assert.match(h, /<div class="wct-cs-bio editor-content"><p>Grew up by the fens\.<\/p>/);
  assert.doesNotMatch(h, /prose-mirror|<textarea|<input/);
});

test("biography: edit mode = inputs, text areas and Foundry's prose-mirror on system.details.biography.value", () => {
  const e = SX.biographyPageHTML(bio({ edit: true }));
  assert.match(e, /<input type="text" class="wct-cs-tin" data-name="system\.details\.age" value="86"/);
  assert.match(e, /<textarea class="wct-cs-ta" data-name="system\.details\.ideal"/);
  assert.match(e, /<prose-mirror name="system\.details\.biography\.value" value="&lt;p&gt;Grew up by the fens\.&lt;\/p&gt;" document-uuid="Actor\.a" data-wct-prose="system\.details\.biography\.value">/);
  assert.doesNotMatch(SX.biographyPageHTML(bio({ edit: true, editable: false })), /prose-mirror|<textarea/);
  assert.match(src("scripts/sheet.mjs"), /addEventListener\("save", ev => \{[\s\S]*?a\.update\(\{ \[t\.dataset\.wctProse\]: t\.value \}\)/);
});

// ---------------------------------------------------------------- Bastion
test("bastion: facility counts from dnd5e's advancement table; free slots; basic always offers a build slot", () => {
  const table = { 5: 2, 9: 4, 13: 5 };
  assert.equal(SX.facilitiesAt(table, 4), 0); assert.equal(SX.facilitiesAt(table, 5), 2); assert.equal(SX.facilitiesAt(table, 12), 4); assert.equal(SX.facilitiesAt(table, 20), 5);
  assert.deepEqual(SX.facilitySlots("special", [{ free: false }, { free: true }], 2), { value: 1, max: 2, available: [{ build: false }] }, "free special facilities don't count");
  assert.deepEqual(SX.facilitySlots("basic", [{}, {}], 2).available, [{ build: true }]);
});

const bastion = (o = {}) => ({
  name: "Reedwatch", nameSource: "Reedwatch", defenders: [{ uuid: "Actor.d1", name: "Odo", img: "o.webp", facility: "f2", index: 0 }],
  basic: { chosen: [{ id: "f1", name: "Bedroom", img: "bed.webp", subtitle: "Roomy", built: true }], value: 1, max: 2, available: [{ build: false }] },
  special: { chosen: [{ id: "f2", name: "Barrack", img: "bar.webp", subtitle: "Cramped", built: true, special: true, order: "Recruit", progress: { value: 2, max: 7, pct: 28 },
    defenders: [{ index: 0, uuid: "Actor.d1", name: "Odo", img: "o.webp" }, { empty: true, index: 1 }], hirelings: [{ index: 0, uuid: "Actor.h", name: "Tam", img: "t.webp" }], creatures: [{ index: 0, uuid: "Actor.cow", pending: true }] }],
    value: 1, max: 2, available: [{ build: false }] },
  description: { enriched: "<p>A stilt house.</p>", source: "<p>A stilt house.</p>" }, uuid: "Actor.a", editable: true, edit: false, ...o
});

test("bastion: defenders, basic and special facilities with occupants, order progress; dnd5e's actions", () => {
  const h = SX.bastionPageHTML(bastion());
  assert.match(h, /<h3 class="wct-cs-ttl wct-cs-bname">Reedwatch<\/h3>/);
  assert.match(h, /<li class="defender" data-facility-id="f2" data-prop="system\.defenders" data-index="0" data-uuid="Actor\.d1">/);
  assert.match(h, /data-facility-id="f2"[\s\S]*?data-action="wctUseFacility"[^>]*><b>Barrack<\/b>/);
  assert.match(h, /aria-valuemax="7" aria-valuenow="2"/); assert.match(h, /Recruit/);
  assert.match(h, /facility-occupants defenders" data-prop="system\.defenders">/); assert.match(h, /facility-occupants hirelings" data-prop="system\.hirelings">/);
  assert.match(h, /occupant-slot pending" data-index="0" data-uuid="Actor\.cow" data-tooltip="Trade pending">/);
  assert.match(h, /data-action="wctFindItem" data-item-type="facility" data-facility-type="special">\+ Free special facility/);
  assert.match(h, /<span class="r">1 \/ 2<\/span>/);
  assert.doesNotMatch(h, /data-action="wctDeleteOccupant"/, "2.2 review: the × is Edit mode only (dnd5e)");
  assert.match(SX.bastionPageHTML(bastion({ edit: true })), /data-action="wctDeleteOccupant"/);
  const ro = SX.bastionPageHTML(bastion({ editable: false }));
  assert.doesNotMatch(ro, /wctDeleteOccupant|wctFindItem|wctUseFacility/);
  const e = SX.bastionPageHTML(bastion({ edit: true }));
  assert.match(e, /data-name="system\.bastion\.name" value="Reedwatch"/); assert.match(e, /<prose-mirror name="system\.bastion\.description"/);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /f\?\.use\(\{ legacy: false, chooseActivity: true, event \}\)/, "dnd5e's useFacility");
  assert.match(s, /trade: \{ pending: \{ creatures: \[\], operation: null \} \}/, "dnd5e's cancel-trade update");
  assert.match(s, /filters\.locked\.additional = \{ type: \{ \[facilityType\]: 1, \[other\]: -1 \}, level: \{ max: this\.actor\.system\.details\.level \} \}/, "dnd5e's facility browser filter");
  assert.match(s, /\[`\$\{prop\}\.value`\]: value\.filter\(\(_, i\) => i !== Number\(index\)\)/);
});

test("bastion page only when dnd5e offers one (slice 1's bookmark rule)", () => {
  assert.ok(!SM.visiblePages({}).some(p => p.id === "bastion"));
  assert.equal(SM.pickPage("bastion", {}), "character");
  assert.equal(SM.pickPage("bastion", { bastion: true }), "bastion");
});

// ---------------------------------------------------------------- Special traits
const special = (o = {}) => ({
  classes: [{ value: "c1", label: "Fighter" }, { value: "c2", label: "Rogue" }], originalClass: "c2", classHint: "Saves and starting HP come from it.",
  sections: [{ label: "Feats", fields: [{ name: "flags.dnd5e.diamondSoul", label: "Diamond Soul", hint: "Proficiency in all saves.", type: "boolean", value: true }, { name: "flags.dnd5e.weaponCriticalThreshold", label: "Weapon crit", type: "number", value: 19 }] },
    { label: "Global bonuses", fields: [{ name: "system.bonuses.abilities.check", label: "Ability checks", type: "string", value: "1d4" }] }],
  editable: true, edit: false, ...o
});

test("special traits: original class, dnd5e's character flags and global bonuses; disabled in Play like dnd5e", () => {
  const h = SX.specialPageHTML(special());
  assert.match(h, /data-name="system\.details\.originalClass" disabled>[\s\S]*?<option value="c2" selected>Rogue/);
  assert.match(h, /data-name="flags\.dnd5e\.diamondSoul" data-wct-check checked disabled>/);
  assert.match(h, /Switch to Edit to change these/);
  const e = SX.specialPageHTML(special({ edit: true }));
  assert.doesNotMatch(e, / disabled/); assert.match(e, /data-name="flags\.dnd5e\.weaponCriticalThreshold" value="19" inputmode="numeric">/);
  assert.match(e, /data-name="system\.bonuses\.abilities\.check" value="1d4">/);
  assert.match(e, /Saves and starting HP come from it\./);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /D\.characterFlags/); assert.match(s, /add\(a\.system\?\.schema\?\.fields\?\.bonuses\); add\(a\.system\?\.schema\?\.fields\?\.rolls, true\);/);
});

// ---------------------------------------------------------------- level up
test("level up: title band medallion in edit mode; one class → dnd5e's level change; several → chooser; max level → notice", () => {
  const v = SM.sheetView({ name: "A", level: 5, editable: true }, { mode: "edit" });
  assert.match(SM.bandHTML(v), /<button type="button" class="wct-cs-lvl wct-cs-lvlup" data-action="wctLevelUp"[^>]*>5<i aria-hidden="true">\+<\/i><\/button>/);
  assert.doesNotMatch(SM.bandHTML(SM.sheetView({ name: "A", level: 5, editable: true })), /wctLevelUp/, "play mode: plain medallion");
  assert.doesNotMatch(SM.bandHTML(SM.sheetView({ name: "A", level: 5, editable: false }, { mode: "edit" })), /wctLevelUp/);
  assert.deepEqual(SX.levelUpChoices([{ id: "c1", name: "Fighter", levels: 3 }], 3), { atMax: false, classes: [{ id: "c1", name: "Fighter", next: 4 }] });
  assert.deepEqual(SX.levelUpChoices([{ id: "c1", name: "Fighter", levels: 20 }], 20), { atMax: true, classes: [] });
  const s = src("scripts/sheet.mjs");
  assert.match(s, /async changeLevel\(cls, delta\) \{[\s\S]*?A\.AdvancementManager\.forLevelChange\(a, cls\.id, delta\)[\s\S]*?this\._renderChild\(manager\)/);
  assert.match(s, /if \(pick\.classes\.length === 1\) return this\.changeLevel\(a\.items\.get\(pick\.classes\[0\]\.id\), 1\);/);
  assert.match(s, /return this\.changeLevel\(a\.items\.get\(el\.dataset\.wctLevel\), Number\(el\.value\)\);/, "the Features level select uses the same path");
});

test("advancement prompts open dnd5e's own windows as children of the sheet (APP_CONTRACT intact)", () => {
  const s = src("scripts/sheet.mjs");
  for (const name of SM.APP_CONTRACT) assert.match(s, new RegExp(`\\n  (get |async )?${name.replace(/\$/g, "\\$")}\\(`), name);
  assert.match(s, /_onDropCreateItems\(event, items, behavior\) \{ return this\.dnd5eHost\(\)\?\._onDropCreateItems/);
  assert.match(s, /primary: \["inventory", "features", "spells", "effects", "bastion"\]\.includes\(this\._page\)/, "effects and actors dropped on the Effects / Bastion pages go to dnd5e's handlers on that tab");
});

// ---------------------------------------------------------------- shell, look, repo
test("all pages built; pure model; css scoped; public repo", () => {
  assert.deepEqual(SM.BUILT_PAGES, ["character", "details", "inventory", "features", "spells", "effects", "biography", "reputation", "bastion", "special"]); // 2.2: + reputation
  assert.deepEqual([...SM.BUILT_PAGES].sort(), SM.PAGE_IDS.slice().sort(), "every bookmark has a page");
  assert.doesNotMatch(src("scripts/sheet-extra-model.mjs").replace(/\/\*[\s\S]*?\*\//g, ""), /\b(game|canvas|ui|CONFIG|foundry)\./);
  const css = src("styles/sheet.css");
  assert.doesNotMatch(css, /theme-(dark|light)/);
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map(r => r.split("{")[0].trim()).filter(Boolean))
    for (const sel of rule.split(",")) assert.match(sel.trim(), /^\.(application\.)?wct-sheet\b/, sel);
  assert.doesNotMatch(src("scripts/sheet-extra-model.mjs") + src("scripts/sheet.mjs") + css, /warcraft|blizzard|azeroth|defias|onyx/i);
  const all = SX.effectsPageHTML(fx()) + SX.biographyPageHTML(bio()) + SX.bastionPageHTML(bastion()) + SX.specialPageHTML(special());
  assert.doesNotMatch(all, /favourite|favorite/i);
});

// ---------------------------------------------------------------- slices 3–4 review fixes
test("review: level down without removing advancements still lowers the level (dnd5e's #changeLevel)", () => {
  const s = src("scripts/sheet.mjs");
  const body = s.slice(s.indexOf("async changeLevel(cls, delta) {")); const fn = body.slice(0, body.indexOf("\n  }\n"));
  assert.match(fn, /forLevelDown\(cls, \{ sheet: this \}\)\) return this\._renderChild\(manager\); \} catch \{ return this\.render\(\); \}\n {6}\}\n {4}\}\n {4}return cls\.update\(\{ "system\.levels": cls\.system\.levels \+ delta \}\);/, "falls through to the level update");
});

test("review: occupant × only in Edit mode; pending trades still confirm via dnd5e's question", () => {
  const play = SX.bastionPageHTML(bastion({ editable: true, edit: false }));
  assert.doesNotMatch(play, /wctDeleteOccupant/);
  const edit = SX.bastionPageHTML(bastion({ edit: true }));
  assert.match(edit, /occupant-slot pending[^>]*>[\s\S]*?data-action="wctDeleteOccupant"/);
  assert.match(edit, /<li class="defender"[\s\S]*?data-action="wctDeleteOccupant"/);
  assert.match(src("scripts/sheet.mjs"), /target\.closest\("\.occupant-slot\.pending"\)[\s\S]*?DialogV2\.confirm/);
});

test("review: facility subtitle is escaped", () => {
  const b = bastion(); b.basic.chosen[0].subtitle = "<img src=x onerror=1> • 2 / 4";
  const h = SX.bastionPageHTML(b);
  assert.doesNotMatch(h, /<img src=x/); assert.match(h, /&lt;img src=x onerror=1&gt; • 2 \/ 4/);
  assert.doesNotMatch(src("scripts/sheet.mjs"), /&sol;|&bull;/, "plain text from the facts");
});

test("review: emptied dnd5e flags are unset, not saved as 0", () => {
  assert.equal(SX.isClearedFlag("flags.dnd5e.weaponCriticalThreshold", ""), true);
  assert.equal(SX.isClearedFlag("flags.dnd5e.weaponCriticalThreshold", " 19"), false);
  assert.equal(SX.isClearedFlag("system.abilities.str.value", ""), false);
  assert.equal(SX.unsetPath("flags.dnd5e.weaponCriticalThreshold"), "flags.dnd5e.-=weaponCriticalThreshold");
  assert.match(src("scripts/sheet.mjs"), /if \(SX\.isClearedFlag\(path, t\.value\)\) \{ t\.value = ""; return a\.update\(\{ \[SX\.unsetPath\(path\)\]: null \}\); \}/);
});

test("review: compendium-browser picks set the drop helper's page explicitly", () => {
  const s = src("scripts/sheet.mjs");
  assert.match(s, /host\.tabGroups = \{ \.\.\.\(host\.tabGroups \?\? \{\}\), primary: type === "facility" \? "bastion" : "features" \};\n {4}await host\._onDropCreateItems/);
});

test("review: leaving Edit saves open ProseMirror text first; the Play/Edit switch goes through changeMode", () => {
  const s = src("scripts/sheet.mjs");
  assert.match(s, /if \(this\._mode === "edit"\) await this\.saveEditors\(\);\n {4}this\._mode = want; this\.render\(\);/);
  assert.match(s, /async saveEditors\(\) \{[\s\S]*?prose-mirror\[data-wct-prose\][\s\S]*?await this\.actor\.update\(data\)/);
  assert.match(s, /static #mode\(event, target\) \{ return this\.changeMode\(/);
});
