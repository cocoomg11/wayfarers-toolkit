import "./_globals.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../scripts/shop-model.mjs";
import { FEATURES } from "../scripts/features.mjs";
import { FEATURE_IDS, FEATURE_CARDS, TABS, tabKeys, LABELS } from "../scripts/panel-model.mjs";
import * as Perm from "../scripts/permissions.mjs";

const src = f => readFileSync(new URL(`../scripts/${f}`, import.meta.url), "utf8");
const id = n => `user${String(n).padStart(12, "0")}`; // 16 characters
const uuid = n => `Actor.actor${String(n).padStart(11, "0")}`;
const U = (n, o = {}) => ({ id: id(n), name: `P${n}`, isGM: false, active: true, character: { uuid: uuid(n), name: `C${n}`, owned: true }, onScene: true, ...o });

test("user selection: GMs and offline players never listed; no or unowned character reported", () => {
  const users = [U(1), U(2, { isGM: true, character: null }), U(3, { active: false }), U(4, { character: null }), U(5, { character: { uuid: uuid(5), name: "C5", owned: false } }), U(6, { onScene: false })];
  const { ok, skipped } = S.eligible(users);
  assert.deepEqual(ok.map(r => r.id), [id(1), id(6)]);
  assert.deepEqual(skipped.map(s => [s.id, s.reason]), [[id(4), S.REASONS.noCharacter], [id(5), S.REASONS.notOwned]]);
  assert.equal(ok[1].onScene, false);
  assert.deepEqual(S.eligible(null), { ok: [], skipped: [] });
  // A malformed character UUID counts as no character (never sent to Item Piles).
  assert.equal(S.eligible([U(7, { character: { uuid: "Compendium.x.y.Actor.z", name: "c", owned: true } })]).skipped[0].reason, S.REASONS.noCharacter);
});

test("pick: everyone, ticked, only on scene, and requested users who can't be included", () => {
  const users = [U(1), U(2, { onScene: false }), U(3, { character: null }), U(4, { isGM: true }), U(5, { active: false })];
  const all = S.pick(users);
  assert.deepEqual(all.users.map(r => r.id), [id(1), id(2)]);
  assert.deepEqual(all.skipped.map(s => s.id), [id(3)], "everyone: tells the GM about the player without a character");
  const scene = S.pick(users, { onlyOnScene: true });
  assert.deepEqual(scene.users.map(r => r.id), [id(1)]);
  assert.equal(scene.skipped.find(s => s.id === id(2)).reason, S.REASONS.offScene);
  const req = S.pick(users, { requested: [id(2), id(3), id(4), id(5), "nobody000000000x", id(2)] });
  assert.deepEqual(req.users.map(r => r.id), [id(2)]);
  assert.deepEqual(req.skipped.map(s => s.reason), [S.REASONS.noCharacter, S.REASONS.gm, S.REASONS.offline, S.REASONS.unknown]);
  assert.deepEqual(S.pick(users, { requested: [] }).users, []);
});

test("Item Piles calls: one per player with their own character; bad ids and UUIDs never sent", () => {
  const rows = [{ id: id(1), uuid: uuid(1) }, { id: id(2), uuid: "Scene.scene00000000001.Token.token00000000001.Actor.actor00000000002" }, { id: "bad", uuid: uuid(3) }, { id: id(4), uuid: "x" }, { id: id(1), uuid: uuid(1) }];
  assert.deepEqual(S.openCalls(uuid(9), rows), [
    { userIds: [id(1)], inspectingTarget: uuid(1) },
    { userIds: [id(2)], inspectingTarget: "Scene.scene00000000001.Token.token00000000001.Actor.actor00000000002" }
  ]);
  assert.deepEqual(S.openCalls("not a uuid", rows), []);
  assert.deepEqual(S.openCalls("Scene.scene00000000001.Token.token00000000001", rows).length, 2, "a token merchant");
  assert.equal(S.openCalls(uuid(9), Array.from({ length: 80 }, (_, n) => ({ id: id(n + 10), uuid: uuid(n + 10) }))).length, S.MAX_USERS);
});

test("close targets: the players it was opened for who are still connected, never a GM", () => {
  const users = [U(1), U(2), U(3, { active: false }), U(4, { isGM: true })];
  assert.deepEqual(S.closeTargets([id(1), id(3), id(4)], users), [id(1)]);
  assert.deepEqual(S.closeTargets(null, users), [id(1), id(2)]);
  assert.deepEqual(S.closeTargets([], users), [id(1), id(2)]);
});

test("API users option: users, ids, names, lists", () => {
  const all = [{ id: id(1), name: "Ann" }, { id: id(2), name: "Bo" }];
  assert.equal(S.requestedIds(undefined, all), null);
  assert.equal(S.requestedIds(null, all), null);
  assert.deepEqual(S.requestedIds("ann", all), [id(1)]);
  assert.deepEqual(S.requestedIds([{ id: id(2) }, id(1), 5, "Zed"], all), [id(2), id(1), "Zed"]);
  assert.equal(S.skippedText([{ name: "Ann", reason: "has no character" }]), "Ann (has no character)");
});

test("merchantShop is a feature with a card, a setting row, a label and a permissions need", () => {
  const f = FEATURES.find(x => x.id === "merchantShop");
  assert.ok(f); assert.equal(f.default, true); assert.equal(f.key, "feature-merchantShop");
  assert.doesNotMatch(f.hint + FEATURE_CARDS.find(c => c.id === "merchantShop").text, /warcraft|blizzard|wow\b/i);
  assert.ok(FEATURE_IDS.includes("merchantShop"));
  assert.ok(TABS.flatMap(tabKeys).includes("shopChatLine")); assert.ok(LABELS.shopChatLine?.[0]);
  const facts = { on: x => x === "merchantShop", itemPiles: true, settings: {}, players: [{ name: "Ann", active: true, character: null, ownsAnyCharacter: false, can: {} }] };
  assert.ok(Perm.featureChecks(facts).some(l => l.feature === "characters" && /shops opened for players/.test(l.text)));
  assert.ok(!Perm.featureChecks({ ...facts, itemPiles: false }).some(l => /shops opened/.test(l.text)));
});

test("shop wiring: Item Piles only through its API, no socket of our own, gated, GM only, core look", () => {
  const shop = src("shop.mjs"); const main = src("main.mjs"); const health = src("health.mjs");
  assert.match(shop, /IP\.renderItemPileInterface\(merchant, c\)/);
  assert.match(shop, /IP\.unrenderItemPileInterface\(merchant, \{ userIds: ids \}\)/);
  assert.doesNotMatch(shop, /game\.socket|setFlag|flags\./);
  assert.match(shop, /classes: \["wct-window", "wct-dialog", \.\.\.UI_CLASSES\]/);
  assert.match(main, /if \(F\.on\("merchantShop"\)\) Shop\.init\(\);/);
  assert.match(main, /get shop\(\) \{ return F\.on\("merchantShop"\) \? gmOnlyApi\(/);
  assert.match(health, /Open shop for players: on/);
  // Never errors at the GM: every Item Piles call is in a try.
  for (const m of shop.matchAll(/await IP\.\w+\(/g)) assert.match(shop.slice(Math.max(0, m.index - 12), m.index), /try \{ ?$/);
});
