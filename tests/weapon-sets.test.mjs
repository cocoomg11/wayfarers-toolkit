import { test } from "node:test";
import assert from "node:assert/strict";
import * as WS from "../scripts/weapon-sets.mjs";
import * as M from "../scripts/panel-model.mjs";

const ID = "wayfarers-toolkit";
const weapon = (id, name, props = [], type = "martialM", extra = {}) => ({ id, name, type: "weapon", system: { equipped: false, type: { value: type }, properties: new Set(props), ...extra } });
const shield = (id, name, flags) => ({ id, name, type: "equipment", system: { equipped: false, type: { value: "shield" } }, flags: flags ? { [ID]: flags } : {} });
const gear = (id, name, t = "trinket", props = [], flags) => ({ id, name, type: "equipment", system: { equipped: false, type: { value: t }, properties: new Set(props) }, flags: flags ? { [ID]: flags } : {} });
const d = (item, opts) => WS.describe(item, opts);

const sword = d(weapon("sw", "Longsword", ["ver"]), { versatileFormula: "1d10" });
const great = d(weapon("gs", "Greatsword", ["two", "hvy"]));
const dagger = d(weapon("dg", "Dagger", ["fin", "lgt", "thr"], "simpleM"));
const bow = d(weapon("lb", "Longbow", ["amm", "two", "hvy"], "martialR"));
const crossbow = d(weapon("hc", "Hand Crossbow", ["amm", "lgt"], "martialR"));
const kite = d(shield("ks", "Kite Shield"));
const buckler = d(shield("bk", "Iron Buckler"));
const torch = d(gear("tc", "Torch", "trinket"));

test("buckler: auto-detected by name, the flag wins either way, shields only", () => {
  assert.equal(WS.isBuckler(shield("a", "Iron Buckler")), true);
  assert.equal(WS.isBuckler(shield("b", "Kite Shield")), false);
  assert.equal(WS.isBuckler(shield("c", "Round Shield", { buckler: true })), true);
  assert.equal(WS.isBuckler(shield("d", "Buckler of Doom", { buckler: false })), false);
  assert.equal(WS.isBuckler(gear("e", "Buckler belt", "trinket")), false);
});

test("what fits which hand", () => {
  assert.ok(WS.fitsHand(sword, "melee", "main") && WS.fitsHand(sword, "melee", "off"));
  assert.ok(WS.fitsHand(great, "melee", "main")); assert.ok(!WS.fitsHand(great, "melee", "off"), "two-handed: main hand only");
  assert.ok(!WS.fitsHand(bow, "melee", "main")); assert.ok(WS.fitsHand(bow, "ranged", "main"));
  assert.ok(WS.fitsHand(dagger, "melee", "main") && WS.fitsHand(dagger, "ranged", "main"), "thrown weapons go in Melee or Ranged");
  assert.ok(!WS.fitsHand(sword, "ranged", "main"), "plain melee weapon isn't a ranged weapon");
  assert.ok(WS.fitsHand(kite, "melee", "off") && !WS.fitsHand(kite, "melee", "main"));
  assert.ok(WS.fitsHand(torch, "utility", "off") && WS.fitsHand(torch, "utility", "main"));
  assert.ok(!WS.fitsHand(torch, "melee", "main"), "a torch isn't a melee main-hand weapon");
  assert.ok(!WS.fitsHand(d(gear("ar", "Chain Mail", "heavy")), "utility", "off"), "armour never goes in a hand");
  assert.ok(!WS.fitsHand(d(gear("cl", "Cloak", "trinket")), "utility", "off"), "a cloak isn't a held item");
  assert.ok(WS.fitsHand(d(gear("hs", "Holy Symbol", "trinket", ["foc"])), "utility", "off"));
  assert.ok(WS.fitsHand(d(gear("lu", "Lute")), "utility", "off"));
  assert.ok(!WS.fitsHand(sword, "nope", "main"));
});

test("hands rule: two-handed weapons and shields", () => {
  let r = WS.checkHands("melee", { main: great, worn: [kite] });
  assert.equal(r.ok, false); assert.equal(r.block.code, "shield"); assert.equal(r.block.shieldId, "ks"); assert.match(r.block.message, /Stow the shield first/);
  r = WS.checkHands("melee", { main: great, worn: [buckler] });
  assert.equal(r.ok, false, "bucklers are still blocked with two-handed weapons"); assert.equal(r.block.shieldId, "bk");
  r = WS.checkHands("melee", { main: great, off: kite });
  assert.equal(r.block.code, "shieldInSet");
  r = WS.checkHands("melee", { main: great, off: dagger });
  assert.equal(r.block.code, "hands");
  assert.equal(WS.checkHands("melee", { main: great }).ok, true);
  assert.equal(WS.checkHands("melee", { main: sword, off: kite }).ok, true, "one-handed weapon and shield");
  assert.equal(WS.checkHands("melee", { main: sword, worn: [kite] }).ok, true, "shield worn from another set, off hand empty");
});

test("hands rule: ranged weapons, shields and bucklers", () => {
  let r = WS.checkHands("ranged", { main: crossbow, worn: [kite] });
  assert.equal(r.ok, false, "a weapon that loads ammunition needs the hand a shield takes"); assert.equal(r.block.code, "shield");
  assert.equal(WS.checkHands("ranged", { main: crossbow, worn: [buckler] }).ok, true, "a buckler leaves the hand free");
  assert.equal(WS.checkHands("ranged", { main: crossbow, off: buckler }).ok, true, "buckler paired in the set");
  assert.equal(WS.checkHands("ranged", { main: bow, worn: [buckler] }).ok, false, "two-handed bow with a buckler: blocked");
  assert.equal(WS.checkHands("ranged", { main: dagger, worn: [kite] }).ok, true, "thrown dagger with a shield");
  assert.equal(WS.checkHands("ranged", { main: crossbow, off: dagger }).ok, true, "one-handed ranged weapon with an off-hand item");
  assert.equal(WS.checkHands("melee", { main: sword, off: dagger, worn: [buckler] }).ok, true, "buckler on the arm, a weapon in each hand");
  r = WS.checkHands("melee", { main: sword, off: dagger, worn: [kite] });
  assert.equal(r.ok, false, "a shield's hand can't also hold a dagger"); assert.equal(r.block.shieldId, "ks");
});

test("ammunition warns, never blocks; versatile shows two-handed damage only with the off hand empty", () => {
  let r = WS.checkHands("ranged", { main: bow, hasAmmo: false });
  assert.equal(r.ok, true); assert.match(r.warnings[0], /ammunition/);
  assert.deepEqual(WS.checkHands("ranged", { main: bow, hasAmmo: true }).warnings, []);
  assert.deepEqual(WS.checkHands("ranged", { main: dagger, hasAmmo: false }).warnings, [], "thrown weapons need no ammunition");
  r = WS.checkHands("melee", { main: sword });
  assert.match(r.info[0], /both hands: 1d10/);
  assert.deepEqual(WS.checkHands("melee", { main: sword, off: kite }).info, []);
  assert.deepEqual(WS.checkHands("melee", { main: sword, worn: [buckler] }).info, [], "anything on the other arm: one-handed damage");
});

test("migration from the single slots", () => {
  const s = WS.migrate({ mainhand: "sw", offhand: "ks", ranged: "lb" });
  assert.deepEqual(s, { v: 1, active: "melee", sets: { melee: { main: "sw", off: "ks" }, ranged: { main: "lb", off: null }, utility: { main: null, off: null } } });
  assert.deepEqual(WS.migrate({}), WS.emptyState());
  assert.equal(WS.migrate({ mainhand: "x", ranged: "x" }).sets.ranged.main, null, "an item is only kept in its first place");
});

test("normalize drops unknown and missing items and fixes the active set", () => {
  const raw = { active: "bogus", sets: { melee: { main: "a", off: "b" }, ranged: { main: "a", off: 5 }, utility: { main: "gone" }, extra: { main: "c" } } };
  const s = WS.normalize(raw, new Set(["a", "b", "c"]));
  assert.equal(s.active, "melee");
  assert.deepEqual(s.sets, { melee: { main: "a", off: "b" }, ranged: { main: null, off: null }, utility: { main: null, off: null } });
  assert.deepEqual(WS.normalize(null), WS.emptyState());
  assert.equal(WS.normalize({ active: "utility" }).active, "utility");
  assert.deepEqual(WS.locate(s, "b"), { set: "melee", hand: "off" }); assert.equal(WS.locate(s, "zz"), null);
  assert.deepEqual(WS.assignedIds(s), ["a", "b"]);
});

test("swap plan: equips the target set, unequips the others, worn shields stay on", () => {
  const eq = x => ({ ...x, equipped: true });
  const state = WS.normalize({ active: "melee", sets: { melee: { main: "sw", off: "ks" }, ranged: { main: "hc" }, utility: { main: "dg", off: "tc" } } });
  const items = { sw: eq(sword), ks: eq(kite), hc: crossbow, dg: dagger, tc: torch };
  let p = WS.planSwap(state, "utility", { items, equippedShields: [eq(kite)] });
  assert.equal(p.ok, false, "dagger + torch with a kite shield still on: the off hand is taken"); assert.equal(p.block.shieldId, "ks");
  p = WS.planSwap(state, "utility", { items: { ...items, ks: kite }, equippedShields: [] });
  assert.equal(p.ok, true); assert.deepEqual(p.equip.sort(), ["dg", "tc"]); assert.deepEqual(p.unequip, ["sw"]);
  const bState = WS.normalize({ active: "melee", sets: { melee: { main: "sw", off: "bk" }, ranged: { main: "hc" } } });
  p = WS.planSwap(bState, "ranged", { items: { sw: eq(sword), bk: eq(buckler), hc: crossbow }, equippedShields: [eq(buckler)] });
  assert.equal(p.ok, true, "buckler stays strapped on for the hand crossbow"); assert.deepEqual(p.equip, ["hc"]); assert.deepEqual(p.unequip, ["sw"], "the buckler isn't taken off");
  const gState = WS.normalize({ active: "ranged", sets: { melee: { main: "gs" }, ranged: { main: "hc", off: "bk" } } });
  p = WS.planSwap(gState, "melee", { items: { gs: great, hc: eq(crossbow), bk: eq(buckler) }, equippedShields: [eq(buckler)] });
  assert.equal(p.ok, false, "greatsword with the buckler on: blocked, not stowed automatically"); assert.equal(p.block.code, "shield"); assert.deepEqual(p.equip, ["gs"]);
  p = WS.planSwap(state, "melee", { items: { ...items, ks: kite, sw: sword } });
  assert.equal(p.donShield, true, "taking the shield up again is flagged for the chat line");
});

test("swap cost wording and chat lines", () => {
  assert.deepEqual(Object.keys(WS.SWAP_COSTS), ["free", "attack", "object", "bonus", "action"]);
  assert.equal(WS.swapCostText("attack"), "part of an attack");
  assert.equal(WS.swapCostText("object"), "an object interaction");
  assert.equal(WS.swapCostText("bonus"), "a bonus action");
  assert.equal(WS.swapCostText("action"), "an action");
  assert.equal(WS.swapCostText("free"), "free");
  assert.equal(WS.swapCostText("junk"), "part of an attack", "unknown values read as the default");
  assert.equal(WS.swapLine("Mira", "ranged", "attack"), "Mira swaps to Ranged (part of an attack).");
  assert.equal(WS.swapLine("Mira", "melee", "bonus", { donShield: true }), "Mira swaps to Melee (a bonus action; putting on a shield takes the Utilize action).");
  assert.match(WS.stowShieldLine("Mira", "Kite Shield"), /^Mira takes off Kite Shield \(.*Utilize action\)\.$/);
});

test("relic slot: eligible items and classes", () => {
  assert.equal(WS.isRelicItem(gear("a", "Holy Symbol (Amulet)")), true);
  assert.equal(WS.isRelicItem(gear("b", "Crystal", "trinket", ["foc"])), true, "Spellcasting Focus property");
  for (const n of ["Libram of Light", "Idol of the Grove", "Totem of Storms", "Ancient Relic", "Sigil of Warding"]) assert.equal(WS.isRelicItem(gear("x", n)), true, n);
  assert.equal(WS.isRelicItem(gear("c", "Cloak of Elvenkind")), false);
  assert.equal(WS.isRelicItem(gear("d", "Cloak", "trinket", [], { relic: true })), true, "flag on");
  assert.equal(WS.isRelicItem(gear("e", "Idol of Doom", "trinket", [], { relic: false })), false, "flag off wins");
  assert.equal(WS.isRelicItem(weapon("f", "Relic Blade")), false, "weapons never");
  assert.equal(WS.isRelicItem(shield("g", "Sigil Shield")), false, "shields never");
  assert.equal(WS.isRelicItem({ id: "h", name: "Idol", type: "loot", system: {} }), false, "not equippable");
  assert.equal(WS.hasRelicSlot(["paladin"], WS.RELIC_DEFAULT), true);
  assert.equal(WS.hasRelicSlot(["fighter", "Druid"], WS.RELIC_DEFAULT), true);
  assert.equal(WS.hasRelicSlot(["wizard"], WS.RELIC_DEFAULT), false);
  assert.equal(WS.hasRelicSlot(["wizard"], "wizard, warlock"), true);
  assert.equal(WS.hasRelicSlot(["cleric"], ""), false);
  assert.deepEqual(WS.relicClassList("Paladin, druid  cleric,,"), ["paladin", "druid", "cleric"]);
  assert.equal(WS.relicClassValue(["Paladin", "paladin", "Druid"]), "paladin, druid");
});

test("control panel: Character tab and the class checklist", () => {
  const tab = M.TABS.find(t => t.id === "pane");
  assert.deepEqual(M.tabKeys(tab), ["weaponSets", "weaponSwapCost", "relicClasses"]);
  assert.equal(tab.basic.find(([k]) => k === "relicClasses")[2], "classes");
  for (const k of M.tabKeys(tab)) assert.ok(M.LABELS[k]?.[1], k);
  assert.deepEqual(M.classesToList("paladin, Druid cleric"), ["paladin", "druid", "cleric"]);
  assert.equal(M.listToClasses(["cleric", "Cleric", "druid"]), "cleric, druid");
  assert.equal(M.listToClasses(M.classesToList(WS.RELIC_DEFAULT)), WS.RELIC_DEFAULT, "round trip keeps the stored default");
});

test("no MMO brand names in the weapon-set strings", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const f of ["../scripts/weapon-sets.mjs"]) {
    const src = await readFile(new URL(f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /warcraft|blizzard|\bwow\b/i, f);
  }
});
