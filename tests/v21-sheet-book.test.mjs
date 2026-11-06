import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SM from "../scripts/sheet-model.mjs";
import * as BM from "../scripts/sheet-book-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const row = (o = {}) => ({ id: "f1", uuid: "Actor.a.Item.f1", name: "Second Wind", img: "sw.webp", quality: "common", subtitle: "Class feature", activations: ["bonus"], recovery: ["sr"], uses: { value: 1, max: 1 }, recharge: null, recoveryLabel: "SR", canDelete: true, canUse: true, sort: 10, ...o });

// ---------------------------------------------------------------- shared rules
test("book: chips follow dnd5e's _filterItems (activation any-of, ritual, concentration, prepared, magic, rest, school, class)", () => {
  assert.equal(BM.bookChipsMatch(row(), ["bonus"]), true);
  assert.equal(BM.bookChipsMatch(row(), ["action"]), false);
  assert.equal(BM.bookChipsMatch(row(), ["action", "bonus"]), true);
  assert.equal(BM.bookChipsMatch(row(), ["sr"]), true); assert.equal(BM.bookChipsMatch(row(), ["lr"]), false);
  assert.equal(BM.bookChipsMatch(row({ concentration: true }), ["concentration"]), true);
  assert.equal(BM.bookChipsMatch(row(), ["ritual"]), false);
  assert.equal(BM.bookChipsMatch(row({ prepared: false }), ["prepared"]), false);
  assert.equal(BM.bookChipsMatch(row({ magical: true }), ["mgc"]), true);
  const keys = { schools: ["evo", "abj"], classes: ["wizard"] };
  assert.equal(BM.bookChipsMatch(row({ school: "evo" }), ["evo", "abj"], keys), true);
  assert.equal(BM.bookChipsMatch(row({ school: "nec" }), ["evo"], keys), false);
  assert.equal(BM.bookChipsMatch(row({ classId: "cleric" }), ["wizard"], keys), false);
});

test("book: sort modes a / m / p (dnd5e's sortItemsPriority: linked item, level, prepared first, method, name)", () => {
  const rows = [row({ id: "1", name: "b", sort: 2, level: 2, prepared: true }), row({ id: "2", name: "a", sort: 3, level: 1 }), row({ id: "3", name: "c", sort: 1, level: 1, prepared: true })];
  assert.deepEqual(BM.sortBook(rows, "a").map(r => r.name), ["a", "b", "c"]);
  assert.deepEqual(BM.sortBook(rows, "m").map(r => r.name), ["c", "b", "a"]);
  assert.deepEqual(BM.sortBook(rows, "p").map(r => r.name), ["c", "a", "b"]);
});

// ---------------------------------------------------------------- Features
test("features: dnd5e's grouping (advancement root → class / subclass's class / species / background; active = activities and not a trait)", () => {
  assert.deepEqual(BM.featureGroup({ active: true, rootType: "class", rootClass: "fighter" }), { activation: "active", origin: "fighter" });
  assert.deepEqual(BM.featureGroup({ active: false, rootType: "subclass", rootClass: "fighter" }), { activation: "passive", origin: "fighter" });
  assert.deepEqual(BM.featureGroup({ active: false, rootType: "race" }), { activation: "passive", origin: "species" });
  assert.deepEqual(BM.featureGroup({ active: false, rootType: "background" }), { activation: "passive", origin: "background" });
  assert.deepEqual(BM.featureGroup({ active: false }), { activation: "passive", origin: "other" });
  const rows = [row({ id: "a", group: { activation: "active", origin: "fighter" } }), row({ id: "b", group: { activation: "passive", origin: "species" } }), row({ id: "c", group: { activation: "passive", origin: "nope" } })];
  const by = BM.featureSections(rows, { classes: [{ identifier: "fighter", name: "Fighter" }], species: true, background: true });
  assert.deepEqual(by.map(s => s.id), ["class-fighter", "species", "other"], "origin: classes, species, background, other; empties dropped");
  assert.deepEqual(by.find(s => s.id === "other")?.rows.map(r => r.id), ["c"]);
  assert.deepEqual(BM.featureSections(rows, { classes: [], mode: "activation" }).map(s => [s.id, s.rows.length]), [["active", 1], ["passive", 2]]);
});

const feats = (o = {}) => ({
  classes: [{ id: "c1", name: "Fighter", img: "f.webp", levels: 5, identifier: "fighter", subclass: { id: "s1", name: "Champion", img: "s.webp" }, hitDie: "d10" },
    { id: "c2", name: "Rogue", img: "r.webp", levels: 3, identifier: "rogue", subclass: null, needsSubclass: true }],
  sections: [{ id: "class-fighter", label: "Fighter features", rows: [row(), row({ id: "f2", name: "Action Surge", activations: ["action"], recovery: ["sr"], recharge: "cooldown", uses: null })] }, { id: "other", label: "Other features", rows: [row({ id: "f3", name: "Alert", activations: [], recovery: [], uses: null, canExpand: true })] }],
  summary: { level: 8, prof: 3 }, editable: true, edit: false, search: "", filters: [], sort: "m", group: "origin", ...o
});

test("features: classes box, sections in dnd5e's inventory element, uses / recovery, use, expand, context menu", () => {
  const h = BM.featuresPageHTML(feats());
  assert.match(h, /<h4>Classes<span class="r">Level 8 · Proficiency \+3/);
  assert.match(h, /Champion · hit die d10/); assert.match(h, /<span class="c">Level 5<\/span>/);
  assert.match(h, /data-action="wctFindItem" data-item-type="subclass" data-class-identifier="rogue">\+ Add subclass/);
  assert.match(h, /<dnd5e-inventory class="inventory-element wct-cs-inv wct-cs-feats">/);
  assert.match(h, /data-section="class-fighter"><div class="wct-cs-sect">Fighter features<span class="cols"><span>Uses<\/span><span>Recovery<\/span>/);
  assert.match(h, /data-name="system\.uses\.value"/); assert.match(h, /<span class="c">SR<\/span>/);
  assert.match(h, /data-action="recharge"/);
  assert.match(h, /data-action="use" aria-label="Second Wind: use"/);
  assert.match(h, /data-action="toggleExpand"/); assert.match(h, /data-context-menu/);
  assert.doesNotMatch(h, /data-action="delete"|wctCreateFeature|data-wct-level/);
  assert.match(h, /data-wct-group="activation"[^>]*>Group: origin/);
});

test("features: edit mode = level selects, delete class, create feature, delete / edit rows; observers get nothing to press", () => {
  const e = BM.featuresPageHTML(feats({ edit: true }));
  assert.match(e, /<select class="wct-cs-sel" data-wct-level="c1">[\s\S]*?<option value="0" selected>5<\/option>/, "dnd5e's level selector: deltas, current = 0");
  assert.match(e, /<option value="-4">1<\/option>/); assert.match(e, /<option value="15">20<\/option>/);
  assert.match(e, /data-action="wctDeleteItem" aria-label="Delete Fighter"/);
  assert.match(e, /data-action="wctCreateFeature">\+ Create feature/); assert.match(e, /data-action="wctFindItem" data-item-type="class">\+ Add class/);
  assert.match(e, /data-action="delete"/); assert.match(e, /data-action="edit"/);
  const ro = BM.featuresPageHTML(feats({ editable: false, edit: true }));
  assert.doesNotMatch(ro, /wctFindItem|wctDeleteItem|data-wct-level|data-name=|data-action="recharge"/);
});

test("features: search and chips hide rows and empty sections; no match note", () => {
  const h = BM.featuresPageHTML(feats({ filters: ["action"] }));
  assert.match(h, /data-wct-filter="action" aria-pressed="true"/);
  assert.match(h, /data-wct-chips="0"[^>]*data-item-id="f1"[^>]*hidden/);
  assert.match(h, /data-section="other" hidden/);
  assert.match(BM.featuresPageHTML(feats({ search: "zzz" })), /wct-cs-nomatch">No features match/);
  assert.deepEqual(BM.FEATURE_FILTERS.map(f => f.key), ["action", "bonus", "reaction", "sr", "lr", "concentration", "mgc"]);
});

// ---------------------------------------------------------------- Spells
test("spells: slot pips follow dnd5e (override wins, temporary pips past the max, togglePip rule)", () => {
  assert.deepEqual(BM.slotPips({ value: 2, max: 4 }).map(p => p.filled), [true, true, false, false]);
  assert.deepEqual(BM.slotPips({ value: 1, max: 4, override: 2 }).map(p => p.n), [1, 2]);
  assert.deepEqual(BM.slotPips({ value: 5, max: 4 }).map(p => p.temp), [false, false, false, false, true]);
  assert.equal(BM.pipTarget(2, 2), 1, "click the last lit pip: spend it");
  assert.equal(BM.pipTarget(2, 4), 4, "click an empty pip: restore up to it");
  assert.equal(BM.pipTarget(2, 1), 1);
  assert.equal(BM.pipTarget(0, 0), 0);
  assert.equal(BM.pipTarget(1, 9, 4), 4);
});

const spells = (o = {}) => ({
  casting: [{ label: "Wizard spellcasting", ability: "int", abilityLabel: "Int", mod: 3, attack: 6, save: 14, prepared: { value: 5, max: 6 }, primary: true }],
  sections: [
    { id: "spell0", label: "Cantrips", method: "spell", level: 0, slots: null, rows: [row({ id: "s0", name: "Fire Bolt", activations: ["action"], recovery: [], uses: null, school: "evo", level: 0, prep: null, cols: { activation: "1A", range: "120 ft", target: "", roll: "+6" } })] },
    { id: "spell1", label: "1st Level", method: "spell", level: 1, slots: { value: 2, max: 4 }, rows: [
      row({ id: "s1", name: "Shield", activations: ["reaction"], recovery: [], uses: null, school: "abj", level: 1, prepared: true, prep: { state: "prepared", label: "Prepared" } }),
      row({ id: "s2", name: "Detect Magic", activations: ["action"], recovery: [], uses: null, school: "div", level: 1, concentration: true, ritual: true, prepared: false, prep: { state: "unprepared", label: "Unprepared" } })] },
    { id: "pact", label: "Pact Magic", method: "pact", level: 3, slots: { value: 1, max: 2 }, rows: [] },
    { id: "spell2", label: "2nd Level", method: "spell", level: 2, slots: { value: 0, max: 0 }, rows: [] }
  ],
  schools: [{ key: "evo", label: "Evocation" }, { key: "abj", label: "Abjuration" }], classFilters: [{ key: "wizard", label: "Wizard" }],
  editable: true, edit: false, search: "", filters: [], sort: "a", ...o
});

test("spells: spellcasting cards (ability, attack, DC, prepared n / max; radio = dnd5e's setSpellcastingAbility)", () => {
  const h = BM.spellsPageHTML(spells());
  assert.match(h, /wct-cs-cast primary" data-ability="int"/);
  assert.match(h, /data-action="wctSpellAbility" aria-pressed="true"/);
  assert.match(h, /Attack<\/span><span class="v">\+6<\/span>/); assert.match(h, /Save DC<\/span><span class="v">14<\/span>/);
  assert.match(h, /Prepared<\/span><span class="v">5 \/ 6<\/span>/);
  assert.match(BM.spellsPageHTML(spells({ casting: [{ ...spells().casting[0], prepared: { value: 7, max: 6 } }] })), /<span class="v neg">7 \/ 6/);
  assert.match(src("scripts/sheet.mjs"), /"system\.attributes\.spellcasting": ability/);
});

test("spells: sections by dnd5e's spellbook, slot pips (pact styled), columns, tags, preparation toggle", () => {
  const h = BM.spellsPageHTML(spells());
  assert.match(h, /data-section="spell1" data-level="1" data-method="spell">/, "dnd5e's data-level / data-method (its spell drop reads them)");
  assert.match(h, /data-prop="system\.spells\.spell1\.value"[^>]*aria-label="1st Level: 2 of 4 slots left"><button type="button" class="wct-cs-slot-pip on" data-action="wctPip" data-n="1"/);
  assert.match(h, /class="wct-cs-slot-pip on pact" data-action="wctPip" data-n="1"/);
  assert.match(h, /data-section="pact" data-level="3" data-method="pact">/, "slot sections stay even when empty (keepEmpty, as dnd5e)");
  assert.doesNotMatch(h, /data-section="spell2"[^>]*hidden/);
  assert.match(h, /<span class="c">1A<\/span><span class="c">120 ft<\/span><span class="c"><\/span><span class="c">\+6<\/span>/);
  assert.match(h, /Detect Magic <span class="wct-cs-tag c"[^>]*>C<\/span> <span class="wct-cs-tag r"[^>]*>R<\/span>/);
  assert.match(h, /data-action="prepare" aria-label="Prepared"[^>]*aria-pressed="true"/);
  assert.match(h, /data-action="prepare" aria-label="Unprepared"[^>]*aria-pressed="false"/);
  assert.match(BM.spellsPageHTML(spells({ sections: [{ ...spells().sections[1], rows: [row({ id: "x", prep: { state: "always", label: "Always prepared" } })] }] })), /data-action="prepare" aria-label="Always prepared"[^>]*aria-disabled="true"/);
});

test("spells: edit mode = slot config (dnd5e's SpellSlotsConfig), create spell, delete; observers: no pips buttons", () => {
  const e = BM.spellsPageHTML(spells({ edit: true }));
  assert.match(e, /data-action="wctConfig" data-config="spellSlots"/); assert.doesNotMatch(e, /data-action="wctPip"/);
  assert.match(e, /data-action="wctCreateSpell">\+ Create spell/); assert.match(e, /data-action="delete"/);
  const ro = BM.spellsPageHTML(spells({ editable: false }));
  assert.doesNotMatch(ro, /data-action="wctPip"|data-action="prepare"|wctSpellAbility/);
  assert.match(ro, /<i class="wct-cs-slot-pip on"><\/i>/);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /case "spellSlots": return open\(C\.SpellSlotsConfig\);/);
});

test("spells: filters (prepared, concentration, ritual, action types, schools, classes) and sorts", () => {
  assert.deepEqual(BM.SPELL_FILTERS.map(f => f.key), ["action", "bonus", "reaction", "concentration", "ritual", "prepared"]);
  const h = BM.spellsPageHTML(spells({ filters: ["ritual"] }));
  assert.match(h, /data-wct-chips="0"[^>]*data-item-id="s1"[^>]*hidden/); assert.match(h, /data-wct-chips="1"[^>]*data-item-id="s2"/);
  assert.match(h, /data-section="spell0" data-level="0" data-method="spell" hidden/, "no slots: hidden when nothing shows");
  assert.match(h, /data-wct-filter="evo"[^>]*>Evocation/); assert.match(h, /data-wct-filter="wizard"[^>]*>Wizard/);
  const sch = BM.spellsPageHTML(spells({ filters: ["abj"] }));
  assert.match(sch, /data-wct-chips="1"[^>]*data-item-id="s1"/); assert.match(sch, /data-wct-chips="0"[^>]*data-item-id="s2"/);
  assert.match(h, /data-wct-sort="p"[^>]*>Sort: A–Z/);
  assert.match(BM.spellsPageHTML(spells({ sort: "p" })), /data-wct-sort="m"[^>]*>Sort: Priority/);
});

// ---------------------------------------------------------------- wiring
test("sheet: Features and Spells are built; facts follow dnd5e's preparation; actions are dnd5e's", () => {
  assert.deepEqual(SM.BUILT_PAGES.slice(0, 5), ["character", "details", "inventory", "features", "spells"]);
  const s = src("scripts/sheet.mjs");
  for (const x of ['getFlag?.("dnd5e", "advancementRoot")', 'getFlag?.("dnd5e", "advancementOrigin")', "sc.getAvailableLevels?.(a)", "sc.getSpellSlotKey(l)", 'getFlag?.("dnd5e", "cachedFor")', "s.linkedActivity?.displayInSpellbook",
    "a.spellcastingClasses", "c.advancement?.byType?.Subclass?.[0]", "CB.selectOne({ filters })", "A.AdvancementManager.forLevelChange(a, cls.id, delta)", "A.AdvancementConfirmationDialog?.forLevelDown(cls, { sheet: this })",
    'cls.update({ "system.levels": cls.system.levels + delta })', "item?.deleteDialog({ sheet: this })", "this._onDropCreateItems(event, [game.items.fromCompendium("])
    assert.ok(s.includes(x), x);
  assert.match(s, /primary: \["inventory", "features", "spells", "effects", "bastion"\]\.includes\(this\._page\) \? this\._page : "details"/, "dnd5e's spell drop (method from the section) and scrolls only on Inventory");
  assert.doesNotMatch(src("scripts/sheet-book-model.mjs").replace(/\/\*[\s\S]*?\*\//g, ""), /\b(game|canvas|ui|CONFIG|foundry)\./, "pure");
  const all = BM.featuresPageHTML(feats()) + BM.spellsPageHTML(spells());
  assert.doesNotMatch(all, /favourite|favorite/i);
  assert.match(BM.featuresPageHTML(feats({ sections: [{ id: "other", label: "Other", rows: [row({ name: "<i>x</i>" })] }] })), /&lt;i&gt;x&lt;\/i&gt;/);
});

test("css and public repo", () => {
  const css = src("styles/sheet.css");
  assert.doesNotMatch(css, /theme-(dark|light)/);
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map(r => r.split("{")[0].trim()).filter(Boolean))
    for (const sel of rule.split(",")) assert.match(sel.trim(), /^\.(application\.)?wct-sheet\b/, sel);
  assert.doesNotMatch(src("scripts/sheet-book-model.mjs") + src("scripts/sheet.mjs"), /warcraft|blizzard|azeroth|defias|onyx/i);
});
