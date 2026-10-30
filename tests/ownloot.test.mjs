import { test } from "node:test";
import assert from "node:assert/strict";
import { ID, Actor, Item, Doc, settings } from "./_globals.mjs";
const Trash = await import("../scripts/trash.mjs");
const { MENUS } = await import("../scripts/settings.mjs");

const it = (id, type, f) => new Item({ id, type, flags: f ? { [ID]: f } : {} });

test("isLootItem: trash, boss loot and Lootable items; everything physical with allLootable", () => {
  assert.equal(Trash.isLootItem(it("a", "loot", { trash: true })), true);
  assert.equal(Trash.isLootItem(it("b", "weapon", { bossLoot: { table: "x" } })), true);
  assert.equal(Trash.isLootItem(it("c", "weapon", { lootable: true })), true);
  assert.equal(Trash.isLootItem(it("d", "weapon")), false);
  assert.equal(Trash.isLootItem(it("e", "weapon", { lootable: false })), false);
  for (const t of ["weapon", "equipment", "consumable", "tool", "loot", "container"]) assert.equal(Trash.isLootItem(it("p", t), { all: true }), true, t);
  for (const t of ["feat", "spell", "class", "subclass", "background", "race"]) assert.equal(Trash.isLootItem(it("n", t), { all: true }), false, t);
  assert.equal(Trash.isLootItem(it("x", "weapon", { lootable: false }), { all: true }), false, "explicit unmark wins over allLootable");
  assert.equal(Trash.isHandLoot(it("t", "loot", { trash: true })), false);
  assert.equal(Trash.isHandLoot(it("h", "weapon", { lootable: true })), true);
});

test("buildFilters hides everything that isn't loot by _id", () => {
  const items = [it("sword", "weapon"), it("bite", "feat"), it("fur", "loot", { trash: true }), it("ring", "equipment", { lootable: true }), it("fire", "spell")];
  const base = [{ path: "type", filters: "class" }];
  assert.deepEqual(Trash.buildFilters(base, items), [...base, { path: "_id", filters: ["sword", "bite", "fire"] }]);
  assert.deepEqual(Trash.buildFilters(base, items, { all: true }), [...base, { path: "_id", filters: ["bite", "fire"] }]);
  assert.deepEqual(Trash.buildFilters([], [it("fur", "loot", { trash: true })]), [], "nothing to hide: no _id filter");
  assert.equal(base.length, 1, "base filters untouched");
});

test("allLootableOf reads the actor flag from an actor or token", () => {
  const a = new Actor({ type: "npc", flags: { [ID]: { allLootable: true } } });
  assert.equal(Trash.allLootableOf(a), true);
  assert.equal(Trash.allLootableOf(new Doc({ actor: a })), true);
  assert.equal(Trash.allLootableOf(new Actor({ type: "npc" })), false);
  assert.deepEqual(Trash.handLoot(new Actor({ type: "npc", flags: { [ID]: { allLootable: true } }, items: [it("s", "weapon"), it("f", "feat"), it("t", "loot", { trash: true })] })).map(i => i.id), ["s"]);
});

test("auto-flag decision for items a GM adds to an NPC", () => {
  const base = { enabled: true, isGM: true, ownClient: true, actorType: "npc", itemType: "weapon", flags: {}, actorAgeMs: 60000 };
  assert.equal(Trash.autoLootDecision(base), true);
  assert.equal(Trash.autoLootDecision({ ...base, enabled: false }), false, "setting off");
  assert.equal(Trash.autoLootDecision({ ...base, isGM: false }), false, "player");
  assert.equal(Trash.autoLootDecision({ ...base, ownClient: false }), false, "another client created it");
  assert.equal(Trash.autoLootDecision({ ...base, actorType: "character" }), false, "not an NPC");
  assert.equal(Trash.autoLootDecision({ ...base, itemType: "feat" }), false, "not physical");
  assert.equal(Trash.autoLootDecision({ ...base, flags: { trash: true } }), false, "toolkit's own trash");
  assert.equal(Trash.autoLootDecision({ ...base, flags: { bossLoot: {} } }), false, "toolkit's own boss loot");
  assert.equal(Trash.autoLootDecision({ ...base, flags: { lootable: false } }), false, "already decided");
  assert.equal(Trash.autoLootDecision({ ...base, actorAgeMs: 500 }), false, "stat block of a just-created actor");
  assert.equal(Trash.autoLootDecision({ ...base, internal: true }), false, "created by the toolkit");
  assert.equal(Trash.autoLootDecision({ ...base, actorAgeMs: Infinity }), true, "unlinked token actor (no creation time)");
});

test("reset keeps hand-added loot unless asked", async () => {
  settings["feature-vendorTrash"] = true; settings.trashAutoRoll = false;
  const mk = () => new Actor({ type: "npc", items: [it("own", "weapon"), it("t1", "loot", { trash: true }), it("h1", "equipment", { lootable: true })] });
  const a1 = mk(); const t1 = new Doc({ id: "x1", name: "A", actor: a1, actorLink: false, parent: null, flags: { [ID]: { looted: true } } });
  await Trash.reset({ coins: () => [["cp", 1]] }, [t1], { quiet: true });
  assert.deepEqual(a1.items.map(i => i.id), ["own", "h1"]);
  assert.equal(a1.items[1].getFlag(ID, "lootable"), true);
  const a2 = mk(); const t2 = new Doc({ id: "x2", name: "B", actor: a2, actorLink: false, parent: null, flags: { [ID]: { looted: true } } });
  const out = await Trash.reset({ coins: () => [["cp", 1]] }, [t2], { quiet: true, removeHandAdded: true });
  assert.deepEqual(a2.items.map(i => i.id), ["own"]); assert.equal(out[0].hand, 1);
});

test("new settings live in the Vendor Trash submenu", () => {
  const keys = MENUS.find(m => m.key === "menuVendorTrash").settings.map(([k]) => k);
  for (const k of ["trashGmAddedLoot", "trashUnconscious"]) assert.ok(keys.includes(k), k);
});
