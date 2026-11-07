import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SM from "../scripts/sheet-model.mjs";
import * as SP from "../scripts/sheet-pages-model.mjs";
import * as PM from "../scripts/pane-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const view = (o = {}, page = "character") => SM.sheetView({ name: "Ash", level: 5, editable: true, ...o }, { page, mode: o.mode });

// ---------------------------------------------------------------- shell
test("pages: Character, Details and Inventory are built; the rest stay placeholders with the system-sheet link", () => {
  assert.deepEqual(SM.BUILT_PAGES.slice(0, 3), ["character", "details", "inventory"]);
  const built = SM.sheetHTML(view({}, "details"), "<p>BODY</p>");
  assert.match(built, /<p>BODY<\/p>/); assert.doesNotMatch(built, /coming in a later slice/);
  assert.match(built, /class="wct-cs-linkbtn" data-action="wctSystemSheet" data-page="details">Open in system sheet/, "a small footer link on each page");
  assert.match(built, /<h3 class="wct-cs-ttl">Details/);
  assert.doesNotMatch(SM.sheetHTML(view({}, "character"), "<p>B</p>"), /<h3 class="wct-cs-ttl">Character/, "the doll is the Character page's heading");
  const ph = SM.sheetHTML(view({}, "effects"));
  assert.match(ph, /coming in a later slice/); assert.doesNotMatch(ph, /BODY/);
  assert.match(SM.sheetHTML(view({}, "details")), /coming in a later slice/, "no body (an error) → placeholder");
});

// ---------------------------------------------------------------- Character page
const it = (id, q = "rare") => ({ id, name: `Item ${id}`, img: `${id}.webp`, quality: q });
const charFacts = (o = {}) => ({
  left: [{ slot: "head", label: "Head", item: it("h1", "epic") }, { slot: "neck", label: "Neck" }],
  right: [{ slot: "hands", label: "Hands" }, { slot: "finger1", label: "Finger", item: it("r1", "uncommon") }],
  sets: [
    { id: "melee", label: "Melee", active: false, lock: null, hands: [{ set: "melee", hand: "main", label: "Main hand", glyph: "mainhand", item: it("s1") }, { set: "melee", hand: "off", label: "Off hand", glyph: "offhand" }] },
    { id: "ranged", label: "Ranged", active: true, lock: null, hands: [{ set: "ranged", hand: "main", label: "Ranged", glyph: "ranged", item: it("b1", "legendary") }, { set: "ranged", hand: "off", label: "Off hand", glyph: "offhand", ghost: it("b1") }] },
    { id: "utility", label: "Utility", active: false, lock: "A two-handed weapon and a shield.", hands: [{ set: "utility", hand: "main", label: "Main hand", glyph: "mainhand" }, { set: "utility", hand: "off", label: "Off hand", glyph: "offhand" }] }
  ],
  relic: { slot: "relic", label: "Relic" },
  notes: [{ tone: "bad", text: "Blocked.", stowShield: "sh1" }],
  portrait: { src: "a.webp", isToken: false }, name: "Ash", attuned: { value: 2, max: 3 },
  attributes: [{ key: "str", label: "Strength", abbr: "STR", value: 10, mod: 0, source: 10 }, { key: "dex", label: "Dexterity", abbr: "DEX", value: 18, mod: 4, source: 16 }, { key: "cha", label: "Charisma", abbr: "CHA", value: 8, mod: -1, source: 8 }],
  defence: PM.defence({ ac: 16, hp: { value: 31, max: 44 }, init: 4, saves: [{ abbr: "STR", value: { value: 3 }, prof: true }] }),
  attack: { title: "Ranged", name: "Bow", quality: "epic", empty: "", rows: [{ label: "To hit", value: "+7" }], options: PM.attackOptions("auto", "ranged"), use: "b1" },
  bag: [{ ...it("x1", "poor"), equipped: true }, { ...it("x2"), equipped: false }], loose: 1, editable: true, edit: false, ...o
});

test("character: paper doll from the pane's slot facts; quality on data-quality; glyphs for empty slots", () => {
  const h = SP.characterPageHTML(charFacts());
  assert.match(h, /class="wct-cs-col wct-col left"><div class="wct-cs-slot wct-slot wc-item-slot filled draggable" data-quality="epic" data-slot="head" data-item-id="h1"/);
  assert.match(h, /data-slot="neck" aria-label="Neck \(empty\)" data-tooltip-text="Neck"><svg class="wct-glyph-svg"/);
  assert.match(h, /data-quality="uncommon" data-slot="finger1"/);
  assert.match(h, /data-drop="auto"/, "drop on the portrait = best place");
  assert.match(h, /Attuned <b>2 \/ 3<\/b>/);
  assert.doesNotMatch(SP.characterPageHTML(charFacts({ attuned: null })), /Attuned/);
  assert.match(SP.characterPageHTML(charFacts({ attuned: { value: 4, max: 3 } })), /wct-cs-attuned over/);
});

test("character: weapon sets (active lit, others stowed, locked note), relic slot, two-handed ghost", () => {
  const h = SP.characterPageHTML(charFacts());
  assert.match(h, /wct-cs-wset wct-set on active" data-set="ranged"/);
  assert.match(h, /wct-cs-wset wct-set off stowed" data-set="melee"/);
  assert.match(h, /data-wct-activate="melee" aria-pressed="false"/);
  assert.match(h, /aria-label="Locked: A two-handed weapon and a shield\."/);
  assert.match(h, /wct-hand wc-item-slot ghost" data-quality="rare" data-set="ranged" data-hand="off" data-item-id="b1"/);
  assert.match(h, /wct-relic"><span class="wct-cs-wtab static">Relic<\/span>/);
  assert.doesNotMatch(SP.characterPageHTML(charFacts({ relic: null })), /wct-relic/, "relic only for classes that use it (the pane decides)");
  assert.match(h, /data-wct-stow="sh1">Stow shield/);
  // Weapon sets off: the old Main Hand / Off Hand / Ranged row.
  const off = SP.characterPageHTML(charFacts({ sets: null, relic: null, bottom: [{ slot: "mainhand", label: "Main Hand" }, { slot: "ranged", label: "Ranged" }] }));
  assert.match(off, /data-slot="mainhand"/); assert.doesNotMatch(off, /data-wct-activate/);
});

test("character: Attributes in three aligned columns, click rolls a check; edit mode: score inputs on system.abilities.*.value", () => {
  const h = SP.characterPageHTML(charFacts());
  assert.match(h, /<li class="wct-cs-attr" data-ability="dex"><button type="button" class="wct-cs-roll" data-action="wctRoll" data-type="check" data-ability="dex"[^>]*>Dexterity<\/button><b>18<\/b><span class="wct-cs-num pos">\(\+4\)<\/span><\/li>/);
  assert.match(h, /data-ability="cha">[\s\S]*?<span class="wct-cs-num neg">\(−1\)<\/span>/);
  assert.match(h, /data-ability="str">[\s\S]*?<span class="wct-cs-num ">\(\+0\)<\/span>/);
  const e = SP.characterPageHTML(charFacts({ edit: true }));
  assert.match(e, /<input type="text" class="wct-cs-ein" data-name="system\.abilities\.dex\.value" value="16"/, "the source score, not the prepared one");
  const ro = SP.characterPageHTML(charFacts({ editable: false, edit: true }));
  assert.doesNotMatch(ro, /data-action="wctRoll"|<input|data-wct-activate|wctSlotEquipped/, "observers: no rolls, inputs or slot actions");
  assert.match(SM.sheetHTML(view({ editable: false }), "")?.toString() ?? "", /wct-cs/);
  assert.match(src("styles/sheet.css"), /\.wct-cs-attrs li\.wct-cs-attr \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 40px 44px/);
});

test("character: Defence and Attack boxes (the pane's models), Attack follows the set and has Use", () => {
  const h = SP.characterPageHTML(charFacts());
  assert.match(h, /<span>Armor Class<\/span><b>16<\/b>/);
  assert.match(h, /<span class="prof" data-tooltip="Proficient">STR \+3<\/span>/);
  assert.match(h, /<h4>Ranged<span class="r">/); assert.match(h, /data-wct-attack/); assert.match(h, /<option value="auto" selected>Auto \(Ranged\)/);
  assert.match(h, /wc-q-text" data-quality="epic">Bow/);
  assert.match(h, /data-action="wctUse" data-item-id="b1">Use/);
});

test("character: Equippable items strip with the 'equipped but not in a slot' note and Slot equipped items", () => {
  const h = SP.characterPageHTML(charFacts());
  assert.match(h, /data-drop="bag"/);
  assert.match(h, /1 equipped but not in a slot <button type="button" class="wct-cs-chip" data-action="wctSlotEquipped">Slot equipped items/);
  assert.match(h, /wct-item wc-item-slot draggable equipped" data-quality="poor" data-item-id="x1"/);
  assert.doesNotMatch(SP.characterPageHTML(charFacts({ loose: 0 })), /equipped but not in a slot/);
  assert.match(SP.characterPageHTML(charFacts({ bag: [] })), /Nothing else to equip/);
});

test("character: portrait shows dnd5e's preferred art; edit mode: change it and dnd5e's 'show token' flag", () => {
  const h = SP.characterPageHTML(charFacts());
  assert.match(h, /data-action="wctArtwork"[^>]*><img src="a\.webp" alt="Ash">/);
  assert.doesNotMatch(h, /wctPortrait|data-wct-tokport/);
  const e = SP.characterPageHTML(charFacts({ edit: true, portrait: { src: "t.webp", isToken: true } }));
  assert.match(e, /data-action="wctPortrait">Change token art/); assert.match(e, /data-wct-tokport checked/);
  assert.match(src("scripts/sheet.mjs"), /"flags\.dnd5e\.showTokenPortrait"/, "dnd5e's own flag (its sheet's toggle)");
  assert.match(src("scripts/sheet.mjs"), /a\.getPreferredArtwork\?\.\(\)/);
  assert.match(SP.characterPageHTML(charFacts({ portrait: { src: "v.webm", isVideo: true } })), /<video src="v\.webm"/);
});

// ---------------------------------------------------------------- shared with the character pane (one storage)
test("pane and sheet share the slot and weapon-set logic and flags (no second storage)", () => {
  const s = src("scripts/sheet.mjs"); const p = src("scripts/pane.mjs");
  for (const fn of ["slotted", "gearSlotted", "weaponState", "unslottedItems", "attackFacts", "autoEquip", "slotEquippedItems", "dropOnDoll", "slotMenu", "askSlotMenu", "itemTooltip", "activateSet", "stowShield", "unslotItem", "ensureSets", "relicShown", "setsOn"])
    assert.ok(s.includes(`Pane.${fn}(`), fn);
  for (const fn of ["autoEquip", "slotEquippedItems", "dropOnDoll", "slotMenu", "askSlotMenu", "itemTooltip", "attackFacts", "registerSlotHooks"])
    assert.match(p, new RegExp(`export (async )?function ${fn}\\(`), fn);
  // The pane itself uses the same functions.
  assert.match(p, /async _onDrop\(ev, el\) \{\s*const r = await dropOnDoll\(this\.actor, ev, el\)/);
  assert.match(p, /async _equipFromBag\(el, item\) \{\s*const r = await autoEquip\(this\.actor, item\)/);
  assert.match(p, /async slotEquipped\(\) \{ return slotEquippedItems\(this\.actor\); \}/);
  assert.match(p, /async _tooltip\(el, item\) \{ return itemTooltip\(this\.actor, el, item\); \}/);
  assert.doesNotMatch(s, /setFlag\(ID, "slot"|flags\.wayfarers-toolkit\.slot|weaponSets"\s*,|setFlag\(ID, "weaponSets"/, "the sheet never writes slot flags itself");
  // Slot bookkeeping (unequip → out of its slot; equip elsewhere → leaves its set) runs with either feature, once.
  assert.match(p, /let slotHooks = false;\nexport function registerSlotHooks\(\) \{\n {2}if \(slotHooks\) return; slotHooks = true;/);
  assert.match(src("scripts/main.mjs"), /if \(F\.on\("characterSheet"\)\) Pane\.registerSlotHooks\(\);/);
});

test("inventory equip toggle places the item in its paper-doll slot with the pane's rules", () => {
  const s = src("scripts/sheet.mjs");
  assert.match(s, /addEventListener\("inventory", ev => \{[\s\S]*?if \(e\.detail !== "equip"\) return;[\s\S]*?e\.preventDefault\(\);[\s\S]*?return equipToSlot\(a, item\);/);
  assert.match(s, /export async function equipToSlot\(actor, item\) \{\s*const r = await Pane\.autoEquip\(actor, item\);\s*if \(!r \|\| PM\.askOf\(r\)\) \{ if \(!item\.system\.equipped\) await item\.update\(\{ "system\.equipped": true \}\); \}/,
    "no clear slot: equipped without a slot (the Character page's note)");
  assert.match(s, /if \(item\.system\.equipped\) return Pane\.unslotItem\(item\)/, "unequip clears the slot / set too");
});

// ---------------------------------------------------------------- dnd5e's own methods
test("rolls and config apps are dnd5e's own (same choices as its sheet's roll / showConfiguration)", () => {
  const s = src("scripts/sheet.mjs");
  for (const call of ["a.rollConcentration({ event, legacy: false })", "a.rollSavingThrow({ ability, event })", "a.rollAbilityCheck({ ability, event })", "a.rollSkill({ skill: key, event })", "a.rollToolCheck({ tool: key, event })",
    "item.use({ event }, { options: { sheet: this } })"]) assert.ok(s.includes(call), call);
  for (const app of ["C.DamagesConfig", "C.LanguagesConfig", "C.ToolsConfig", "C.WeaponsConfig", "C.TraitsConfig", "C.ConcentrationConfig", "C.AbilityConfig", "C.SkillsConfig", "C.SkillToolConfig", "S.MovementSensesConfig", "S.CreatureTypeConfig", "dnd5e?.applications?.CurrencyManager", "Item.implementation.createDialog"])
    assert.ok(s.includes(app), app);
  assert.match(s, /proficiency-cycle\[data-wct-prof\]/, "dnd5e's own proficiency-cycle element");
  assert.doesNotMatch(s + src("scripts/sheet-pages-model.mjs"), /Math\.floor\(\([^)]*- 10\) \/ 2\)|proficiency \* |prof \* 2/, "no stat maths");
});

test("inventory sits in dnd5e's own <dnd5e-inventory> element (its use/view/edit/delete/equip/attune/qty/uses/expand/context menu)", () => {
  const h = SP.inventoryPageHTML(invFacts());
  assert.match(h, /<dnd5e-inventory class="inventory-element wct-cs-inv">/);
  assert.match(h, /data-action="use" aria-label="Bow: use"/);
  for (const a of ["equip", "attune", "toggleExpand"]) assert.match(h, new RegExp(`class="wct-cs-ic2 item-action[^"]*" data-action="${a}"`), a);
  assert.match(h, /data-context-menu aria-label="More actions"/);
  assert.match(h, /data-name="system\.quantity"/); assert.match(h, /data-name="system\.uses\.value"/);
  assert.match(h, /class="adjustment-button" data-action="increase" data-property="system\.quantity"/);
  const e = SP.inventoryPageHTML(invFacts({ edit: true }));
  assert.match(e, /data-action="edit"/); assert.match(e, /data-action="delete"/); assert.match(e, /data-action="wctCreateItem"/);
  assert.doesNotMatch(h, /data-action="delete"/, "delete only in edit mode, like dnd5e");
  const ro = SP.inventoryPageHTML(invFacts({ editable: false }));
  assert.doesNotMatch(ro, /data-action="equip"|data-name="system\.quantity"|wctCurrency/);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /get expandedSections\(\)/); assert.match(s, /get inventorySource\(\) \{ return this\.actor; \}/); assert.match(s, /_openDocumentSheet\(doc, options = \{\}\)/);
});

test("drag and drop: dnd5e's own drop handling through an unrendered dnd5e sheet (create, stack, sort, containers)", () => {
  const s = src("scripts/sheet.mjs");
  assert.match(s, /dnd5eHost\(\) \{[\s\S]*?new Cls\(\{ document: this\.actor \}\)/);
  assert.match(s, /async _onDrop\(event\) \{[\s\S]*?return host\._onDrop\(event\);/);
  assert.match(s, /host\.tabGroups = \{ \.\.\.\(host\.tabGroups \?\? \{\}\), primary: \["inventory", "features", "spells", "effects", "bastion"\]\.includes\(this\._page\) \? this\._page : "details" \}/, "spells dropped on Inventory become scrolls, as in dnd5e");
  assert.match(s, /_onDragOver\(event\) \{ try \{ this\.dnd5eHost\(\)\?\._onDragOver\?\.\(event\)/);
  assert.match(s, /\.wct-cs-doll \[data-slot\], \.wct-cs-doll \[data-set\], \.wct-cs-page \[data-drop\]/, "doll drops are the pane's");
  assert.match(src("scripts/pane.mjs"), /actor\.sheet\?\.dnd5eHost\?\.\(\)/, "adopt() uses dnd5e's creation while the toolkit sheet is the actor's sheet");
  const h = SP.inventoryPageHTML(invFacts());
  assert.match(h, /<div class="item-row wct-cs-irow draggable">/); assert.match(h, /<li class="container wct-cs-cont draggable" data-item-id="c1">/, "containers are drop targets (dnd5e's .container[data-item-id])");
});

// ---------------------------------------------------------------- Details page
const detFacts = (o = {}) => ({
  abilities: [{ key: "str", label: "Strength", abbr: "STR", mod: 0, value: 10, source: 10, save: { value: 3 }, saveProf: 1, saveSource: 1 }, { key: "dex", label: "Dexterity", abbr: "DEX", mod: 4, value: 18, source: 16, save: { value: 4 }, saveProf: 0, saveSource: 0 }],
  concentration: null,
  skills: [{ key: "prc", label: "Perception", ability: "wis", abbr: "Wis", total: 8, passive: 18, prof: 2, source: 2, baseAbility: "wis" }, { key: "sur", label: "Survival", ability: "wis", abbr: "Wis", total: 6, passive: 16, prof: 0.5, source: 0.5 }, { key: "arc", label: "Arcana", ability: "int", abbr: "Int", total: -1, passive: 9, prof: 0, source: 0 }],
  tools: [{ key: "herb", label: "Herbalism Kit", ability: "int", abbr: "Int", total: 5, prof: 1, source: 1 }],
  traits: [{ key: "senses", label: "Senses", values: [{ label: "Darkvision", value: "60 ft" }], config: "senses" }, { key: "dr", label: "Resistances", values: [], trait: "dr" }, { key: "languages", label: "Languages", values: [{ label: "Common" }, { label: "Elvish" }], trait: "languages" }],
  creature: { title: "Humanoid", subtitle: "elf", config: true }, size: { key: "med", label: "Medium", options: [["sm", "Small"], ["med", "Medium"]] },
  origin: [{ id: "sp1", name: "Elf", kind: "Species" }], abilityOptions: [["int", "Int"], ["wis", "Wis"]], editable: true, edit: false, ...o
});

test("details: six medallions (mod big, score small, save corner), click: check; corner: save", () => {
  const h = SP.detailsPageHTML(detFacts());
  assert.match(h, /data-action="wctRoll" data-type="save" data-ability="str"[^>]*><span class="wct-cs-sv p">save \+3<\/span>/, "proficient save in gold");
  assert.match(h, /data-action="wctRoll" data-type="check" data-ability="dex"[^>]*><span class="wct-cs-lab">DEX<\/span><span class="v pos">\+4<\/span><span class="m">18<\/span>/);
  assert.match(src("styles/sheet.css"), /\.wct-cs-meds \{ display: grid; grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
});

test("details: skills with proficiency marks (half, proficient, expertise), ability, total, passive; click rolls", () => {
  assert.equal(SP.profClass(0), ""); assert.equal(SP.profClass(0.5), "h"); assert.equal(SP.profClass(1), "f"); assert.equal(SP.profClass(2), "e"); assert.equal(SP.profClass(undefined), "");
  const h = SP.detailsPageHTML(detFacts());
  assert.match(h, /<li class="wct-cs-skill" data-key="prc"><i class="wct-cs-pm e" data-tooltip-text="Expertise"[^>]*><\/i><span class="wct-cs-dim wct-cs-ab">Wis<\/span><button[^>]*data-action="wctRoll" data-type="skill"[^>]*>Perception<\/button><b class="wct-cs-num pos">\+8<\/b><span[^>]*wct-cs-pass[^>]*>18<\/span>/);
  assert.match(h, /data-key="sur"><i class="wct-cs-pm h"/);
  assert.match(h, /data-key="arc">[\s\S]*?<b class="wct-cs-num neg">−1<\/b>/);
  assert.match(h, /data-key="herb">[\s\S]*?data-type="tool"/);
  assert.match(h, /<h4>Skills<span class="r">passive/);
});

test("details: traits as dnd5e lists them; origin pills; creature type and size", () => {
  const h = SP.detailsPageHTML(detFacts());
  assert.match(h, /data-trait-key="senses"><span>Senses<\/span><b><span class="wct-cs-tv">Darkvision 60 ft<\/span>/);
  assert.match(h, /Common<\/span>, <span class="wct-cs-tv">Elvish/);
  assert.doesNotMatch(h, /data-trait-key="dr"/, "empty traits hidden in play mode (dnd5e)");
  assert.match(h, /data-action="wctShowItem" data-item-id="sp1"[^>]*>Elf<\/button>/);
  assert.match(h, /Humanoid <small>\(elf\)<\/small>/); assert.match(h, /<span class="wct-cs-pill">Medium<\/span>/);
});

test("details: edit mode = dnd5e's proficiency cycles, config buttons, score inputs, skill ability and size selects", () => {
  const e = SP.detailsPageHTML(detFacts({ edit: true, concentration: { save: 3 } }));
  assert.match(e, /<proficiency-cycle type="ability" data-wct-prof="system\.abilities\.str\.proficient" value="1"/);
  assert.match(e, /<proficiency-cycle type="skill" data-wct-prof="system\.skills\.prc\.value" value="2"/);
  assert.match(e, /<proficiency-cycle type="tool" data-wct-prof="system\.tools\.herb\.value" value="1"/);
  assert.match(e, /data-name="system\.abilities\.dex\.value" value="16"/);
  assert.match(e, /data-name="system\.skills\.prc\.ability"[\s\S]*?<option value="wis" selected>Wis/);
  assert.match(e, /data-name="system\.traits\.size"/);
  for (const d of ['data-config="ability" data-ability="str"', 'data-config="skills"', 'data-config="skill"', 'data-trait="tool"', 'data-config="senses"', 'data-trait="dr"', 'data-trait="languages"', 'data-config="creatureType"', 'data-config="ability" data-ability="concentration"'])
    assert.ok(e.includes(`data-action="wctConfig" ${d}`), d);
  assert.match(e, /data-trait-key="dr"><span>Resistances/, "every trait row shown in edit mode, to configure");
  const ro = SP.detailsPageHTML(detFacts({ editable: false, edit: true }));
  assert.doesNotMatch(ro, /proficiency-cycle|wctConfig|wctRoll|<input|<select/);
  assert.doesNotMatch(SP.detailsPageHTML(detFacts()), /Concentration/, "concentration only while concentrating or editing (dnd5e)");
});

// ---------------------------------------------------------------- Inventory page
const row = (o = {}) => ({ id: "w1", uuid: "Actor.a.Item.w1", name: "Bow", img: "b.webp", quality: "epic", type: "weapon", subtitle: "Martial Ranged", slot: "Ranged set", price: { value: 50, label: "gp" }, weight: 2, qty: 1, uses: null, recharge: null, equip: true, attune: false, attuneTitle: "Attunement required", canDelete: true, magical: true, equipped: true, activations: ["action"], sort: 100, canUse: true, ...o });
function invFacts(o = {}) {
  return {
    rows: [row(), row({ id: "p1", name: "Potion of Healing", type: "consumable", quality: "uncommon", equip: null, attune: null, magical: false, equipped: false, activations: ["action"], uses: { value: 1, max: 1 }, qty: 2, sort: 50, slot: "" }),
      row({ id: "t1", name: "Thieves' Tools", type: "tool", equip: null, attune: null, magical: false, equipped: false, activations: [], sort: 10 }),
      row({ id: "o1", name: "Odd thing", type: "facility", equip: null, attune: null, activations: [], magical: false, equipped: false })],
    sections: [{ id: "consumables", label: "Consumables", order: 300, types: ["consumable"] }, { id: "weapons", label: "Weapons", order: 100, types: ["weapon"] }, { id: "tool", label: "Tools", order: 400, types: ["tool"] }],
    containers: [{ id: "c1", name: "Backpack", img: "bp.webp", pct: 40 }],
    currency: [{ key: "gp", label: "Gold", abbr: "gp", value: 12 }, { key: "sp", label: "Silver", abbr: "sp", value: 46 }],
    money: null, encumbrance: { value: 46.5, max: 150, pct: 31, low: 33.3, high: 66.6, units: "lb" }, carry: { str: 10, size: "Med", mod: 1 },
    attuned: { value: 1, max: 3 }, editable: true, edit: false, search: "", filters: [], sort: "m", ...o
  };
}

test("inventory: dnd5e's sections in order, other types last; each row's columns", () => {
  const h = SP.inventoryPageHTML(invFacts());
  const order = [...h.matchAll(/data-section="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ["weapons", "consumables", "tool", "contents"]);
  assert.match(h, /<span class="c">Ranged set<\/span><span class="c">50 gp<\/span><span class="c">2<\/span>/);
  assert.match(h, /data-quality="epic">Bow<\/b><small>Martial Ranged<\/small>/);
  assert.match(h, /data-action="equip" aria-label="Equipped \(click to unequip\)"[^>]*aria-pressed="true"/);
  assert.match(h, /data-action="attune" aria-label="Attunement required"/);
  assert.match(h, /<span class="c"><span class="wct-cs-uses"><input type="text" value="1"[^>]*data-name="system\.uses\.value"/);
  assert.match(SP.inventoryPageHTML(invFacts({ rows: [row({ recharge: "cooldown" })] })), /data-action="recharge"/);
  assert.equal(SP.priceText(row({ concealed: true })), "—"); assert.equal(SP.priceText(row({ price: null })), ""); assert.equal(SP.priceText(row({ price: { value: 1200, label: "gp" } })), "1,200 gp");
});

test("inventory: search, filter chips and sort follow dnd5e's rules", () => {
  assert.equal(SP.rowMatches(row(), { search: "bo" }), true); assert.equal(SP.rowMatches(row(), { search: "axe" }), false);
  assert.equal(SP.rowMatches(row(), { filters: ["bonus"] }), false); assert.equal(SP.rowMatches(row(), { filters: ["action", "bonus"] }), true, "any chosen activation");
  assert.equal(SP.rowMatches(row({ equipped: false }), { filters: ["equipped"] }), false);
  assert.equal(SP.rowMatches(row({ magical: false }), { filters: ["mgc"] }), false);
  assert.deepEqual(SP.INV_FILTERS.map(f => f.key), ["action", "bonus", "reaction", "equipped", "mgc"]);
  const h = SP.inventoryPageHTML(invFacts({ filters: ["equipped"] }));
  assert.match(h, /data-wct-filter="equipped" aria-pressed="true"/);
  assert.match(h, /data-wct-chips="0"[^>]*data-item-id="p1"[^>]*hidden/, "filtered rows hidden");
  assert.match(h, /data-section="consumables" hidden/);
  assert.match(SP.inventoryPageHTML(invFacts({ search: "zzz" })), /wct-cs-nomatch">No items match/);
  assert.deepEqual(SP.sortRows([row({ name: "b", sort: 1 }), row({ name: "a", sort: 2 })], "m").map(r => r.name), ["b", "a"]);
  assert.deepEqual(SP.sortRows([row({ name: "b", sort: 1 }), row({ name: "a", sort: 2 })], "a").map(r => r.name), ["a", "b"]);
  assert.match(SP.inventoryPageHTML(invFacts({ sort: "a" })), /data-wct-sort="m"[^>]*>Sort: A–Z/);
});

test("inventory: encumbrance from dnd5e's prepared data, coins (dnd5e fields; toolkit coins when three-coin), containers, attunement", () => {
  const h = SP.inventoryPageHTML(invFacts());
  assert.match(h, /<i class="enc" style="width:31%"><\/i><b class="tick" style="left:33\.3%"><\/b><b class="tick" style="left:66\.6%"><\/b><span>46\.5 \/ 150 lb<\/span>/);
  assert.match(h, /Str 10 · Med ×1/);
  assert.match(SP.inventoryPageHTML(invFacts({ encumbrance: { value: 120, max: 150, pct: 80, low: 33, high: 66 } })), /class="enc heavy"/);
  assert.match(h, /data-name="system\.currency\.gp" value="12"/);
  assert.match(h, /data-action="wctCurrency">[\s\S]*?Manage coin/);
  assert.match(SP.inventoryPageHTML(invFacts({ money: "<span class=\"wc-coins\">x</span>" })), /wct-cs-money"><span class="wc-coins">x<\/span>/);
  assert.match(h, /data-item-id="c1">[\s\S]*?<i class="cap" style="width:40%">/);
  assert.match(h, /Attuned <b class="">1 \/ 3<\/b>/);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /api\.moneyHTML\(api\.totalMoney\(a\)\)/, "the toolkit's coin helpers");
  assert.match(s, /encumbrance: enc \? \{ value: enc\.value, max: enc\.max, pct: enc\.pct, low: enc\.stops\?\.encumbered, high: enc\.stops\?\.heavilyEncumbered/);
});

test("delta inputs follow dnd5e (+n, -n, =n, plain)", () => {
  assert.equal(SP.parseDelta("+2", 10), 12); assert.equal(SP.parseDelta("-3", 10), 7); assert.equal(SP.parseDelta("=5", 10), 5); assert.equal(SP.parseDelta("14", 10), 14);
  assert.equal(SP.parseDelta("", 10), null); assert.equal(SP.parseDelta("abc", 10), 10);
});

// ---------------------------------------------------------------- look and rules
test("css: page styles scoped, no theme selectors, no favourites; text escaped", () => {
  const css = src("styles/sheet.css");
  assert.doesNotMatch(css, /theme-(dark|light)/);
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, "").split("}").map(r => r.split("{")[0].trim()).filter(Boolean))
    for (const sel of rule.split(",")) assert.match(sel.trim(), /^\.(application\.)?wct-sheet\b/, sel);
  const all = SP.characterPageHTML(charFacts()) + SP.detailsPageHTML(detFacts()) + SP.inventoryPageHTML(invFacts());
  assert.doesNotMatch(all, /favourite|favorite/i);
  assert.match(SP.inventoryPageHTML(invFacts({ rows: [row({ name: "<b>x</b>" })] })), /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(SP.characterPageHTML(charFacts({ name: "\"q" })), /alt="&quot;q"/);
});

test("public repo: no campaign or publisher names in the new files", () => {
  const all = src("scripts/sheet-pages-model.mjs") + src("scripts/sheet.mjs") + src("styles/sheet.css");
  assert.doesNotMatch(all, /warcraft|blizzard|azeroth|defias|onyx/i);
});

test("sheet stays pure-importable and every new window bit keeps the core look", () => {
  const s = src("scripts/sheet.mjs");
  assert.match(s, /classes: \["wct-sheet", "wct-window", \.\.\.UI_CLASSES\]/);
  assert.match(s, /form: \{ submitOnChange: false \}/);
  assert.doesNotMatch(src("scripts/sheet-pages-model.mjs").replace(/\/\*[\s\S]*?\*\//g, ""), /\b(game|canvas|ui|CONFIG|foundry)\./, "the page model is pure");
});

// ---------------------------------------------------------------- 2.0.1 fixes
test("2.0.1: equip / drop results are only asked about when they are objects (a slot string no longer throws)", () => {
  assert.equal(PM.askOf("finger1"), null, "dropOnDoll can resolve to a slot string");
  assert.equal(PM.askOf(undefined), null); assert.equal(PM.askOf(null), null); assert.equal(PM.askOf({ slot: "head" }), null); assert.equal(PM.askOf({ set: "melee", hand: "main" }), null);
  assert.deepEqual(PM.askOf({ ask: ["head", "neck"], item: {} }), ["head", "neck"]);
  assert.equal(PM.askOf({ ask: "head" }), null);
  for (const f of ["scripts/pane.mjs", "scripts/sheet.mjs"]) assert.doesNotMatch(src(f), /"ask" in r/, `${f}: every caller goes through askOf`);
});

test("2.0.1: the sheet implements dnd5e 6.0.6's app contract (delete, create, dialogs, group drops, sheet-mode key)", () => {
  const s = src("scripts/sheet.mjs");
  assert.deepEqual([...SM.APP_CONTRACT].sort(), ["_concentration", "_confirmDialog", "_onDropCreateItems", "_onDropSingleItem", "_onDropStackConsumables", "_openDocumentSheet", "_renderChild", "canExpand", "changeMode", "expandedSections", "inventorySource", "isEditMode"].sort());
  for (const name of SM.APP_CONTRACT) assert.match(s, new RegExp(`\\n  (get |async )?${name.replace(/\$/g, "\\$")}\\(`), name);
  assert.match(s, /_confirmDialog\(config = \{\}\) \{[\s\S]*?new foundry\.applications\.api\.DialogV2\(\{[\s\S]*?classes: \[\.\.\.\(rest\.classes \?\? \[\]\), "wct-dialog", \.\.\.UI_CLASSES\][\s\S]*?submit: result => resolve\(result\)[\s\S]*?addEventListener\("close", \(\) => resolve\(null\), \{ once: true \}\);\s*this\._renderChild\(app\);/);
  assert.match(s, /_onDropCreateItems\(event, items, behavior\) \{ return this\.dnd5eHost\(\)\?\._onDropCreateItems\?\.\(event, items, behavior\); \}/);
  assert.match(s, /Item\.implementation\.createDialog\(\{\}, \{ types, parent: this\.actor \}, \{ sheet: this \}\)/, "create still passes the sheet (now it has _renderChild)");
});
