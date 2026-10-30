import { test } from "node:test";
import assert from "node:assert/strict";
import { ID, Actor, Item, Doc, settings } from "./_globals.mjs";
const BL = await import("../scripts/bossloot.mjs");
const Trash = await import("../scripts/trash.mjs");

test("normalize and resultUuid", () => {
  assert.deepEqual(BL.normalize({ table: "RollTable.a" }), { table: "RollTable.a", draws: 1 });
  assert.deepEqual(BL.normalize({ table: " RollTable.a ", draws: "3", coinCp: 250, note: " hi " }), { table: "RollTable.a", draws: 3, coinCp: 250, note: "hi" });
  assert.equal(BL.normalize({ draws: 2 }), null);
  assert.equal(BL.resultUuid({ type: "text", name: "Nothing" }), null);
  assert.equal(BL.resultUuid({ type: "document", documentUuid: "Compendium.p.items.Item.abc" }), "Compendium.p.items.Item.abc");
  assert.equal(BL.resultUuid({ type: "document", documentUuid: "RollTable.xyz" }), null);
  assert.equal(BL.resultUuid({ type: "pack", documentCollection: "p.items", documentId: "q" }), "Compendium.p.items.Item.q");
});

test("draw without replacement, weighted, ignoring drawn marks", () => {
  const res = [{ id: "a", weight: 1, drawn: true }, { id: "b", weight: 1 }, { id: "c", weight: 8 }, { id: "z", weight: 0 }];
  for (let t = 0; t < 2000; t++) {
    const d = BL.drawWeighted(res, 3);
    assert.equal(d.length, 3); assert.equal(new Set(d.map(r => r.id)).size, 3); assert.ok(!d.some(r => r.id === "z"));
  }
  assert.equal(BL.drawWeighted(res, 10).length, 3, "capped at results with weight");
  let firstC = 0; const N = 20000; for (let t = 0; t < N; t++) if (BL.drawWeighted(res, 1)[0].id === "c") firstC++;
  assert.ok(Math.abs(firstC / N - 0.8) < 0.02, `c first ${firstC / N}`);
  assert.equal(res[0].drawn, true); assert.equal(res.length, 4, "input untouched");
  assert.deepEqual(BL.drawWeighted(res, 2, () => 0).map(r => r.id), ["a", "b"]);
  assert.deepEqual(BL.drawWeighted(res, 1, () => 0.999).map(r => r.id), ["c"]);
  const o = BL.odds(res); assert.equal(o.find(x => x.result.id === "c").pct, 80); assert.equal(o.find(x => x.result.id === "z").pct, 0);
});

test("fallback reasons", () => {
  assert.equal(BL.fallbackReason({ tableFound: false }), "table");
  assert.equal(BL.fallbackReason({ tableFound: true, usable: 0 }), "empty");
  assert.equal(BL.fallbackReason({ tableFound: true, usable: 3, items: 0, missing: 2 }), "items");
  assert.equal(BL.fallbackReason({ tableFound: true, usable: 3, items: 0, missing: 0 }), null);
  assert.equal(BL.fallbackReason({ tableFound: true, usable: 3, items: 1, missing: 1 }), null);
});

test("fallback wording reports what really happened", () => {
  assert.equal(Trash.fallbackText({ dropped: 1 }), "vendor trash dropped instead");
  assert.equal(Trash.fallbackText({ dropped: 0, empty: 1 }), "no vendor trash rolled for it either (its drop came up empty)");
  assert.equal(Trash.fallbackText({}), "no vendor trash rolled for it either (its drop came up empty)");
  assert.equal(Trash.fallbackText({ skipped: 1 }), "its vendor trash is already on the body");
  assert.match(Trash.fallbackText({ error: "boom" }), /failed too \(boom\)/);
});

test("party size scales boss coin and draws", () => {
  assert.equal(BL.scaledCoin(1000, 4), 1000);
  assert.equal(BL.scaledCoin(1000, 5), 1250);
  assert.equal(BL.scaledCoin(1000, 2), 500);
  assert.equal(BL.scaledCoin(333, 3), 250); // 249.75 rounds to the copper
  assert.equal(BL.scaledCoin(1000, 99), 2000, "party size clamped to 8");
  assert.equal(BL.scaledCoin(1000, 0), 1000, "0 / invalid reads as 4");
  assert.equal(BL.scaledDraws(3, 5), 4);
  assert.equal(BL.scaledDraws(2, 6), 2, "fewer than 3 draws: no extra");
  assert.equal(BL.scaledDraws(3, 4), 3, "party of 4: no extra");
  assert.equal(BL.scaledDraws(3, 6, { extra: false }), 3, "setting off");
  assert.equal(BL.scaledDraws(3, 6, { usable: 3 }), 3, "capped by usable results");
  assert.equal(BL.scaledDraws(5, 6, { usable: 3 }), 5, "never fewer than set");
  assert.equal(BL.clampParty("7.9"), 7); assert.equal(BL.clampParty(-2), 1);
});

test("bulk link: table names and defaults", () => {
  assert.equal(BL.tableOwnerName("Cave Guardian · Loot"), "Cave Guardian");
  assert.equal(BL.tableOwnerName("Cave Guardian - Loot"), "Cave Guardian");
  assert.equal(BL.tableOwnerName("Cave Guardian – Loot"), "Cave Guardian");
  assert.equal(BL.tableOwnerName("Loot: Cave Guardian"), "Cave Guardian");
  assert.equal(BL.tableOwnerName("Cave Guardian Loot"), null);
  assert.equal(BL.tableOwnerName("Encounters · Forest"), null);
  assert.deepEqual(BL.linkDefaults(null), { draws: 1, coinCp: 0, note: "" });
  assert.deepEqual(BL.linkDefaults({ draws: 3, coinCp: 1500, note: " n " }), { draws: 3, coinCp: 1500, note: "n" });
  assert.deepEqual(BL.linkDefaults(null, "<p>Draws: 2, coin: 500</p>"), { draws: 2, coinCp: 500, note: "" });
});

test("reset removes trash and boss loot items, keeps the creature's own", async () => {
  settings["feature-vendorTrash"] = true; settings.trashAutoRoll = false;
  const actor = new Actor({ type: "npc", items: [
    new Item({ id: "own" }), new Item({ id: "t1", flags: { [ID]: { trash: true } } }),
    new Item({ id: "b1", flags: { [ID]: { bossLoot: { table: "RollTable.a" } } } }), new Item({ id: "b2", flags: { [ID]: { bossLoot: { table: "RollTable.a" } } } })] });
  const tok = new Doc({ id: "tok1", name: "Boss", actor, actorLink: false, parent: null, flags: { [ID]: { looted: true, bossLootDrawn: { id: "tok1", items: ["x"] } } } });
  assert.ok(Trash.resettable(tok));
  const out = await Trash.reset({ coins: () => [["cp", 1]] }, [tok], { quiet: true });
  assert.deepEqual(actor.items.map(i => i.id), ["own"]);
  assert.equal(tok.getFlag(ID, "bossLootDrawn"), undefined); assert.equal(tok.getFlag(ID, "looted"), undefined);
  assert.equal(out[0].items, 1); assert.equal(out[0].boss, 2);
  const tok2 = new Doc({ id: "t2", name: "B2", actor: new Actor({ type: "npc", items: [] }), flags: { [ID]: { bossLootDrawn: { id: "t2" } } } });
  assert.ok(Trash.resettable(tok2));
});

test("serial runs one key's jobs in order, past failures", async () => {
  const log = []; const wait = ms => new Promise(r => setTimeout(r, ms));
  const p1 = Trash.serial("k", async () => { await wait(20); log.push(1); });
  const p2 = Trash.serial("k", async () => { log.push(2); throw new Error("x"); });
  const p3 = Trash.serial("k", async () => { log.push(3); });
  await p1; await p2.catch(() => {}); await p3; assert.deepEqual(log, [1, 2, 3]);
});

test("No loot precedence", () => {
  assert.deepEqual(Trash.resolveNoLoot({}), { on: false, source: null });
  assert.deepEqual(Trash.resolveNoLoot({ actor: true }), { on: true, source: "actor" });
  assert.deepEqual(Trash.resolveNoLoot({ token: true }), { on: true, source: "token" });
  assert.deepEqual(Trash.resolveNoLoot({ token: false, actor: true }), { on: false, source: "token" });
  assert.equal(Trash.resolveNoLoot({ token: true, actor: false }).on, true);
});

test("isPile: Item Piles' own check decides; flags only without the API", () => {
  const doc = new Doc({ id: "t1", actor: new Actor({ flags: { "item-piles": { data: { enabled: true } } } }) });
  const mods = game.modules.get; const had = game.itempiles;
  try {
    game.modules.get = id => id === "item-piles" ? { active: true } : null;
    game.itempiles = { API: { turnTokensIntoItemPiles() {}, ITEM_QUANTITY_ATTRIBUTE: "system.quantity", isValidItemPile: () => false } };
    assert.equal(Trash.isPile(doc), false, "stale delta flag ignored when Item Piles says no");
    game.itempiles.API.isValidItemPile = () => true;
    assert.equal(Trash.isPile(new Doc({ id: "t2" })), true);
    game.itempiles = undefined;
    assert.equal(Trash.isPile(doc), true, "flag fallback without the API");
    assert.equal(Trash.isPile(new Doc({ id: "t3", actor: new Actor({}) })), false);
  } finally { game.modules.get = mods; game.itempiles = had; }
});

test("priorDrop: an empty looted body isn't 'already on the body'", () => {
  const trash = new Item({ id: "i1", flags: { [ID]: { trash: true } } });
  assert.equal(Trash.priorDrop(new Doc({ id: "a", actor: new Actor({}) })), null);
  assert.equal(Trash.priorDrop(new Doc({ id: "b", flags: { [ID]: { looted: true } }, actor: new Actor({}) })), "empty");
  assert.equal(Trash.priorDrop(new Doc({ id: "c", flags: { [ID]: { looted: true } }, actor: new Actor({ items: [trash] }) })), "onBody");
  assert.equal(Trash.priorDrop(new Doc({ id: "d", actor: new Actor({ flags: { "item-piles": { data: { enabled: true } } } }) })), "onBody");
  assert.equal(Trash.fallbackText({ dropped: 0 }), "no vendor trash rolled for it either (its drop came up empty)");
});
