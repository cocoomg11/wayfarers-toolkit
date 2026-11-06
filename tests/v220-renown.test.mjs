import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const R = await import("../scripts/renown-model.mjs");

test("renown tiers: generic defaults 3 / 10 / 25 / 50 with 0 / 10 / 15 / 25 % discounts, neutral names", () => {
  assert.deepEqual(R.DEFAULT_TIERS.map(t => t.from), [3, 10, 25, 50]);
  assert.deepEqual(R.DEFAULT_TIERS.map(t => t.discount), [0, 10, 15, 25]);
  for (const t of R.DEFAULT_TIERS) assert.doesNotMatch(t.name, /friendly|honou?red|revered|exalted/i, "no MMO-specific tier names");
  assert.deepEqual(R.DEFAULT_GAINS, [1, 2, 3]);
  assert.deepEqual(R.DEFAULT_LOSSES, ["1d8", "2d6", "2d12"]);
});

test("renown tiers: normalized, sorted, one per threshold, capped, never empty", () => {
  const t = R.normalizeTiers([{ name: "B", from: 10, discount: 150 }, { name: "A", from: 3, color: "nope" }, { name: "dup", from: 10 }, { from: "x" }]);
  assert.deepEqual(t.map(x => [x.name, x.from]), [["A", 3], ["B", 10], ["Tier 4", 50]], "sorted; the second tier at 10 dropped; a bad threshold takes its place's default");
  assert.equal(t[1].discount, 100, "discount clamped");
  assert.match(t[0].color, /^#[0-9a-f]{6}$/);
  assert.equal(R.normalizeTiers([]).length, 4, "empty → defaults");
  assert.equal(R.normalizeTiers(Array.from({ length: 20 }, (_, i) => ({ from: i + 1 }))).length, R.TIERS_MAX);
  assert.equal(R.normalizeTier({ from: 0 }).from, 1, "a tier starts at 1 or more");
});

test("renown: tier index, standing bar text, discount", () => {
  const tiers = R.normalizeTiers(null);
  assert.equal(R.tierIndex(2, tiers), -1);
  assert.equal(R.tierIndex(3, tiers), 0);
  assert.equal(R.tierIndex(12, tiers), 1);
  const s = R.standing({ score: 10, ribbons: [{ text: "Base", amount: 2 }] }, tiers);
  assert.equal(s.total, 12); assert.equal(s.name, "Trusted"); assert.equal(s.bar, "12 / 25 to Esteemed"); assert.equal(s.discount, 10);
  assert.equal(s.pct, Math.round(2 / 15 * 100));
  const none = R.standing({ score: 1 }, tiers);
  assert.equal(none.name, "No tier"); assert.equal(none.bar, "1 / 3 to Known"); assert.equal(none.discount, 0);
  const top = R.standing({ score: 60 }, tiers);
  assert.equal(top.bar, "60 · top tier"); assert.equal(top.pct, 100);
  assert.equal(R.totalOf({ score: 1, ribbons: [{ amount: -5 }] }), 0, "never below 0");
  assert.equal(R.discountText({ discount: 15, rarity: "up to Rare" }), "15% off, up to Rare");
  assert.equal(R.discountText(null), "no discount");
});

test("renown: amounts, losses and dice formulas", () => {
  assert.deepEqual(R.parseAmount("+2"), { kind: "flat", value: 2 });
  assert.deepEqual(R.parseAmount("−3"), { kind: "flat", value: -3 });
  assert.deepEqual(R.parseAmount(-4), { kind: "flat", value: -4 });
  assert.equal(R.parseAmount("0"), null);
  assert.deepEqual(R.parseAmount("-2d6"), { kind: "dice", formula: "2d6", sign: -1 });
  assert.deepEqual(R.parseAmount("d8 + 1"), { kind: "dice", formula: "1d8+1", sign: 1 });
  assert.equal(R.parseAmount("2d6*10"), null, "only dice and numbers with + and −");
  assert.equal(R.parseAmount("@abilities.str.mod"), null);
  assert.equal(R.cleanFormula("1d4+1d4+1d4+1d4+1d4+1d4+1"), "", "at most 6 terms");
  assert.equal(R.cleanFormula("5"), "", "a formula needs a die");
  assert.equal(R.applyDelta(3, -10), 0, "never below 0");
  assert.equal(R.applyDelta(3, 2), 5);
  assert.deepEqual(R.normalizeGains("1, +2, 2, x, 5"), [1, 2, 5]);
  assert.deepEqual(R.normalizeGains(""), [1, 2, 3]);
  assert.deepEqual(R.normalizeLosses("-1d8; 2d6, nope"), ["1d8", "2d6"]);
});

test("renown: factions and config are cleaned and capped", () => {
  let n = 0; const makeId = () => `f${++n}`;
  const f = R.normalizeFaction({ name: "  Watch  ", parent: "Kingdom", merchants: ["abc", "abc", "bad id!"], tiers: [{ from: 5 }], hidden: true }, { makeId });
  assert.equal(f.id, "f1"); assert.equal(f.name, "Watch"); assert.deepEqual(f.merchants, ["abc"]); assert.equal(f.tiers.length, 1);
  assert.equal("hidden" in f, false, "hidden is where it is stored, not a field");
  assert.equal(R.groupOf(f), "Kingdom · subfactions");
  assert.equal(R.groupOf({ group: "" }), "Factions");
  const c = R.normalizeConfig({ factions: Array.from({ length: 150 }, (_, i) => ({ id: `id${i}`, name: `F${i}` })).concat([{ id: "id1" }]) });
  assert.equal(c.factions.length, R.FACTIONS_MAX);
  assert.equal(c.v, R.RENOWN_VERSION);
  assert.deepEqual(R.merchantFactions([{ id: "a", merchants: ["m1"] }, { id: "b", merchants: ["m1", "m2"] }]), { m1: "a", m2: "b" });
});

test("renown: actor flag, entries, ribbons", () => {
  const a = R.normalizeActor({ scores: { f1: 4, f2: 0, "bad!": 3 }, ribbons: { f1: [{ text: "Base", amount: 1 }, { text: "" }] }, tracked: "f1" });
  assert.deepEqual(Object.keys(a.scores), ["f1"]);
  assert.equal(a.ribbons.f1.length, 1);
  assert.equal(R.totalOf(R.entryOf(a, "f1")), 5);
  const b = R.withEntry(a, "f1", { score: 0, ribbons: [] });
  assert.deepEqual(b.scores, {}); assert.deepEqual(b.ribbons, {});
  assert.equal(R.withoutFaction(a, "f1").tracked, "");
  assert.equal(R.normalizeActor({ ribbons: { f: Array.from({ length: 30 }, (_, i) => ({ text: `r${i}`, amount: 1 })) } }).ribbons.f.length, R.RIBBONS_MAX);
});

test("renown: hidden factions live in the GM-only bucket and move both ways", () => {
  const config = R.normalizeConfig({ factions: [{ id: "vis", name: "Visible" }, { id: "sec", name: "Secret" }] });
  const actors = [{ id: "a1", data: { scores: { sec: 7, vis: 2 }, tracked: "sec" } }, { id: "a2", data: { scores: { vis: 1 } } }];
  const hid = R.moveFaction({ config, hidden: null, actors, factionId: "sec", hide: true });
  assert.deepEqual(hid.config.factions.map(f => f.id), ["vis"]);
  assert.deepEqual(hid.hidden.factions.map(f => f.id), ["sec"]);
  assert.equal(hid.hidden.scores.a1.sec.score, 7);
  assert.equal(hid.actors.length, 1, "only actors with renown there change");
  assert.deepEqual(hid.actors[0].data.scores, { vis: 2 }); assert.equal(hid.actors[0].data.tracked, "");
  const all = R.allFactions(hid.config, hid.hidden);
  assert.deepEqual(all.map(f => [f.id, f.hidden]), [["vis", false], ["sec", true]]);
  assert.equal(R.readEntry({ actorId: "a1", actorData: hid.actors[0].data, hidden: hid.hidden, faction: all[1] }).score, 7);
  const back = R.moveFaction({ config: hid.config, hidden: hid.hidden, actors: [{ id: "a1", data: hid.actors[0].data }], factionId: "sec", hide: false });
  assert.deepEqual(back.config.factions.map(f => f.id), ["vis", "sec"]);
  assert.deepEqual(back.hidden.factions, []); assert.deepEqual(back.hidden.scores, {});
  assert.equal(back.actors[0].data.scores.sec, 7);
  assert.deepEqual(R.moveFaction({ config, hidden: null, actors, factionId: "nope", hide: true }).actors, []);
});

test("renown: GM-only bucket caps and cleans the Item Piles record", () => {
  const h = R.normalizeHidden({ applied: { m1: { "Actor.a": 0.9, "Actor.b": 3, "Actor.c": "x" }, "bad!": { "Actor.d": 0.5 } }, scores: { a1: { f: { score: 0 } } } });
  assert.deepEqual(h.applied, { m1: { "Actor.a": 0.9 } });
  assert.deepEqual(h.scores, {}, "empty entries dropped");
});

test("renown: quest rewards, public view and lines", () => {
  const list = R.normalizeQuestRenown([{ faction: "f1", amount: "+2" }, { faction: "f1", amount: 3 }, { faction: "f2", amount: "−1" }, { faction: "f3", amount: 0 }, { faction: "bad id", amount: 1 }]);
  assert.deepEqual(list, [{ faction: "f1", amount: 2 }, { faction: "f2", amount: -1 }]);
  assert.deepEqual(R.publicRenown(list, id => id !== "f2"), [{ faction: "f1", amount: 2 }]);
  assert.deepEqual(R.renownRewardLines(list, [{ id: "f1", name: "Watch" }]), ["Renown: Watch +2"]);
});

test("renown: hook payload carries ids and numbers only", () => {
  const p = R.hookPayload({ actorId: "a1", factionId: "f1", before: 8, after: 10, delta: 2, tierBefore: 0, tierAfter: 1, name: "Maren" });
  assert.deepEqual(p, { actorId: "a1", factionId: "f1", before: 8, after: 10, delta: 2, tierBefore: 0, tierAfter: 1 });
  assert.equal(R.hookPayload({ actorId: "", factionId: "f1" }), null);
  assert.equal(R.RENOWN_HOOK, "wayfarers-toolkit.renownChanged");
});

test("renown: Item Piles discount plan changes only the toolkit's own entries", () => {
  assert.equal(R.buyModifier(10), 0.9); assert.equal(R.buyModifier(0), null);
  // New discount: entry made with sell 1 (Item Piles would otherwise copy the merchant's sell modifier into it).
  let p = R.merchantPlan({ entries: [], applied: {}, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1, override: false }]);
  assert.deepEqual(p.applied, { "Actor.a": 0.9 });
  // Already right: nothing to write.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []);
  // Tier up: ours, rewritten.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 25 } });
  assert.equal(p.writes[0].buyPriceModifier, 0.75);
  // Discount gone: back to neutral, record dropped.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: {} });
  assert.deepEqual(p.writes, [{ actorUuid: "Actor.a", buyPriceModifier: 1, sellPriceModifier: 1, override: false }]);
  assert.deepEqual(p.applied, {});
  // The GM's own entry (or one changed since): left alone and reported.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.5, sellPriceModifier: 1 }], applied: {}, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []); assert.deepEqual(p.skipped, ["Actor.a"]);
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.8, sellPriceModifier: 1 }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []); assert.deepEqual(p.applied, {});
  // An override entry is never ours.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 0.9, override: true }], applied: { "Actor.a": 0.9 }, wants: { "Actor.a": 10 } });
  assert.deepEqual(p.writes, []);
  // A neutral entry (left by an earlier reset) is free to use; its sell is kept.
  p = R.merchantPlan({ entries: [{ actorUuid: "Actor.a", buyPriceModifier: 1, sellPriceModifier: 1 }], applied: {}, wants: { "Actor.a": 15 } });
  assert.equal(p.writes[0].buyPriceModifier, 0.85);
});

// ---------------------------------------------------------------- the page, card and hint (renown-view-model.mjs)
const V = await import("../scripts/renown-view-model.mjs");
const SM = await import("../scripts/sheet-model.mjs");
const { readFileSync } = await import("node:fs");
const src = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const FACS = [
  { id: "watch", name: "Town <Watch>", parent: "Kingdom", note: "city guard", merchants: ["m1"] },
  { id: "couriers", name: "Couriers", parent: "Kingdom" },
  { id: "traders", name: "Traders", group: "Neutral factions" },
  { id: "old", name: "Old Order", inactive: true },
  { id: "veil", name: "Veiled Hand", hidden: true }
].map(f => ({ ...R.normalizeFaction(f), hidden: !!f.hidden }));
const ENTRIES = { watch: { score: 10, ribbons: [{ id: "r1", text: "Base", amount: 2 }] }, couriers: { score: 4 }, traders: { score: 27 } };

test("renown page: groups, tracked pin, filters, inactive, sort", () => {
  const m = V.pageModel({ factions: FACS, entries: ENTRIES, tracked: "watch", isGM: true, canTrack: true });
  assert.equal(m.tracked?.id, "watch");
  assert.deepEqual(m.groups.map(g => g.label), ["Kingdom · subfactions", "Neutral factions", "Factions"]);
  assert.equal(m.groups[0].rows[0].id, "watch", "sorted by renown");
  assert.ok(!m.groups.some(g => g.label === V.INACTIVE_GROUP), "inactive hidden by default");
  assert.ok(V.pageModel({ factions: FACS }, { inactive: true }).groups.some(g => g.label === V.INACTIVE_GROUP));
  assert.deepEqual(V.pageModel({ factions: FACS }, { filter: "sub" }).groups.map(g => g.label), ["Kingdom · subfactions"]);
  assert.deepEqual(V.pageModel({ factions: FACS }, { filter: "neutral" }).groups.flatMap(g => g.rows.map(r => r.id)), ["traders", "veil"]);
  assert.deepEqual(V.pageModel({ factions: FACS, entries: ENTRIES }, { sort: "name" }).groups[0].rows.map(r => r.id), ["couriers", "watch"]);
  assert.equal(V.pageModel({ factions: FACS }, { search: "trad" }).shown, 1);
  assert.equal(V.pageModel({ factions: FACS }, { closed: ["Neutral factions"] }).groups[1].open, false);
  assert.equal(m.groups[0].rows[0].s.bar, "12 / 25 to Esteemed");
});

test("renown page HTML: escaped, GM controls only for GMs, hidden marked, empty states", () => {
  const gm = V.pageHTML(V.pageModel({ factions: FACS, entries: ENTRIES, tracked: "watch", isGM: true, canTrack: true, edit: true }));
  assert.match(gm, /Town &lt;Watch&gt;/); assert.doesNotMatch(gm, /<Watch>/);
  assert.match(gm, /hidden from players/);
  assert.match(gm, /data-wct-rn="award"/); assert.match(gm, /data-wct-rn="ribbon"/); assert.match(gm, /data-wct-rn-score="watch"/);
  assert.match(gm, /Base \+2/); assert.match(gm, /data-wct-rn="unribbon"/);
  assert.match(gm, /10% off/);
  // A player: their own facts never contain hidden factions; no GM controls; tracking their own character.
  const players = FACS.filter(f => !f.hidden);
  const pl = V.pageHTML(V.pageModel({ factions: players, entries: ENTRIES, tracked: "watch", canTrack: true }));
  assert.doesNotMatch(pl, /Veiled|hidden from players|data-wct-rn="award"|data-wct-rn="ribbon"|data-wct-rn-score|unribbon|data-wct-rn="setup"/);
  assert.match(pl, /data-wct-rn="track"/);
  const observer = V.pageHTML(V.pageModel({ factions: players, entries: ENTRIES, tracked: "watch" }));
  assert.doesNotMatch(observer, /data-wct-rn="track"/, "observers read only");
  assert.match(V.pageHTML(V.pageModel({ factions: [], isGM: true })), /Factions and renown…/);
  assert.match(V.pageHTML(V.pageModel({ factions: [] })), /hasn't set up any factions/);
  assert.match(gm, /Renown tiers/);
});

test("renown card and award hint", () => {
  const html = V.cardHTML({ faction: "Town <Watch>", reason: "Broke the <ring>", rows: [
    { name: "Maren", delta: 2, before: 8, after: 10, tierBefore: 0, tierAfter: 1, tierName: "Trusted", tierColor: "#3fd18a", tierText: "10% off" },
    { name: "Tobin", delta: 2, before: 3, after: 5, tierBefore: 0, tierAfter: 0, tierName: "Known", tierColor: "#7ad65a", tierText: "" }] });
  assert.match(html, /\+2 renown<\/span> Town &lt;Watch&gt;/);
  assert.match(html, /Maren<\/strong> is now <span class="wct-rn-tierup"[^>]*>Trusted<\/span> \(10\): 10% off/);
  assert.match(html, /Tobin<\/strong> 3 → 5/);
  assert.match(html, /Broke the &lt;ring&gt;/);
  const rolled = V.cardHTML({ faction: "F", rows: [{ name: "A", delta: -7, roll: { formula: "2d6", total: 7 }, before: 9, after: 2, tierBefore: 0, tierAfter: -1, tierName: "No tier", tierColor: "#e8d35a" }] });
  assert.match(rolled, /<span class="wct-rn-amt">Renown<\/span>/); assert.match(rolled, /−7<\/b> <span class="wct-rn-roll">\(2d6 = 7\)/);
  const tiers = R.normalizeTiers(null);
  assert.equal(V.awardHint([{ name: "Maren Ashby", entry: { score: 8 }, tiers }], R.parseAmount("+2")), "Each character gains it on their own score: Maren Ashby 8 → 10 (Trusted)."); // 2.2.1: full names
  assert.match(V.awardHint([{ name: "A", entry: {}, tiers }], R.parseAmount("-2d6")), /rolls 2d6 and loses it/);
  assert.match(V.awardHint([], null), /Pick at least one/);
});

test("renown: sheet bookmark only with the feature on, after Biography", () => {
  assert.ok(!SM.visiblePages({}).some(p => p.id === "reputation"));
  const ids = SM.visiblePages({ renown: true }).map(p => p.id);
  assert.equal(ids[ids.indexOf("biography") + 1], "reputation");
  assert.ok(SM.BUILT_PAGES.includes("reputation"));
  const sheet = src("scripts/sheet.mjs");
  assert.match(sheet, /renown: featureOn\("renown"\)/);
  assert.match(sheet, /if \(page === "reputation"\) return RenownUI\.pageBody\(/);
});

test("renown: wiring rules (feature, storage, cleanup, API, hook, CSS scope)", async () => {
  const { FEATURES } = await import("../scripts/features.mjs");
  assert.ok(FEATURES.some(f => f.id === "renown"));
  const VM = await import("../scripts/vault-model.mjs");
  assert.ok(VM.BUCKETS.includes("renown"), "hidden factions in the GM-only store");
  const P = await import("../scripts/panel-model.mjs");
  assert.ok(P.RECORD_SETTINGS.has("renownConfig") && P.WIZARD_IGNORE.has("renownConfig"));
  const C = src("scripts/cleanup.mjs");
  assert.match(C, /\["renown", "Put back the Item Piles merchant prices Renown set/);
  assert.match(C, /if \(pick\.renown \|\| pick\.vault\)[^\n]*resetDiscounts\(\)/, "prices put back whenever the records go too");
  assert.ok(C.indexOf("pick.renown || pick.vault") < C.indexOf("pick.vault && p.vault.length"), "prices put back before the records go");
  const CU = await import("../scripts/cleanup.mjs");
  assert.deepEqual(CU.renownApplied({ applied: { m1: { "Actor.a": 0.9, "Actor.b": 0.85 } } }), ["m1 Actor.a", "m1 Actor.b"]);
  const main = src("scripts/main.mjs");
  assert.match(main, /get renown\(\) \{\n\s+if \(!F\.on\("renown"\)\) return undefined;\n\s+return gmOnlyApi\(/);
  assert.match(main, /\{ open: \["factions", "faction", "tiers", "get", "open", "track"\] \}/);
  const rn = src("scripts/renown.mjs");
  assert.match(rn, /Hooks\.callAll\(R\.RENOWN_HOOK, p\)/);
  assert.match(rn, /content: card\(RV\.cardHTML\(/, "card through look-model card()");
  assert.match(rn, /IP\.updateMerchantPriceModifiers\(/, "discounts only through Item Piles' API");
  assert.doesNotMatch(rn, /setFlag\("item-piles"|flags\.item-piles\.data[^"]*"\s*\]?\s*:/, "never writes Item Piles' flags itself");
  assert.match(src("scripts/health.mjs"), /\["Renown", renown\]/);
  const css = src("styles/renown.css");
  assert.doesNotMatch(css, /\.theme-(dark|light)|wc-r\d/);
  for (const sel of css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@container[^{]*\{/g, "").match(/(^|\})\s*([^{}@]+)\{/g) ?? []) {
    const s = sel.replace(/^\}?\s*/, "").replace(/\{$/, "");
    for (const part of s.split(",")) assert.match(part.trim(), /^(\.wct-sheet|\.application\.wct-renown-window|\.wct-chat-card\.wct-renown|\.wct-renown-award|\.wct-renown-setup)\b/, `unscoped: ${part.trim()}`);
  }
  assert.match(src("module.json"), /"styles\/renown\.css"/);
  assert.doesNotMatch(src("scripts/renown-model.mjs") + src("scripts/renown-view-model.mjs") + src("scripts/renown-apps.mjs") + rn, /warcraft|blizzard|azeroth|\bwow\b|friendly|honored|revered|exalted/i);
});

// ---------------------------------------------------------------- quest renown rewards
test("quests: renown rewards normalized, planned, and kept out of players' copy for hidden factions", async () => {
  const QL = await import("../scripts/quest-log-model.mjs");
  const QM = await import("../scripts/quests-model.mjs");
  const UX = await import("../scripts/quest-ux-model.mjs");
  const q = QL.normalizeQuest({ v: 2, status: "active", party: "P1", rewards: { renown: [{ faction: "watch", amount: "+2" }, { faction: "veil", amount: -1 }] } });
  assert.deepEqual(q.rewards.renown, [{ faction: "watch", amount: 2 }, { faction: "veil", amount: -1 }]);
  assert.deepEqual(QL.normalizeQuest({ v: 2 }).rewards.renown, [], "older records read an empty list (no version change)");
  assert.deepEqual(QL.rewardPlan(q).renown, q.rewards.renown);
  assert.equal(QL.hasRewards(q), true); assert.equal(QL.hasRewards(QL.normalizeQuest({})), false); assert.equal(QL.hasRewards(QL.normalizeQuest({}), 5), true);
  const pub = QM.publicQuest(q, { renownShown: id => id === "watch" });
  assert.deepEqual(pub.rewards.renown, [{ faction: "watch", amount: 2 }]);
  assert.deepEqual(QM.publicQuest(q).rewards.renown, [], "without a check, nothing about renown reaches players");
  assert.deepEqual(QM.publicQuest({ ...q, hidden: true }).rewards.renown, []);
  // The glow stamp ignores the empty list every quest now gets, so nothing glows after updating.
  const qs = src("scripts/quests.mjs");
  assert.match(qs, /if \(!v\.rewards\.renown\?\.length\) delete v\.rewards\.renown;/);
  const old = QL.normalizeQuest({ v: 2, status: "active" }); const v = { ...old, rewards: { ...old.rewards } }; delete v.rewards.renown;
  const before = { ...old, rewards: { coin: "", items: [], choice: [], pick: "", other: "" } };
  assert.equal(UX.questStamp("Q", v), UX.questStamp("Q", before));
  // Paying gives renown to each member character, through the award (chat card, hook) and only with the feature on.
  assert.match(qs, /const pcs = membersOf\(party\)\.filter\(a => a\.type === "character"\);/);
  assert.match(qs, /await Renown\.award\(pcs, r\.faction, r\.amount, \{ reason: `Quest reward: \$\{j\.name\}` \}\)/);
  assert.match(qs, /WCT\.features\?\.on\?\.\("renown"\)/);
  assert.match(qs, /const PUB = \{ renownShown: id => Renown\.isShown\(id\) \};/);
});

// ---------------------------------------------------------------- review fixes (2.2): feature off, pay, card, guards
test("renown off: the leader puts back the prices it set; health says so; always registered", () => {
  assert.equal(R.offReset({ on: false, count: 2, itemPiles: true }), true);
  assert.equal(R.offReset({ on: true, count: 2, itemPiles: true }), false, "on: the sync owns them");
  assert.equal(R.offReset({ on: false, count: 0, itemPiles: true }), false);
  assert.equal(R.offReset({ on: false, count: 2, itemPiles: false }), false, "no Item Piles API: nothing to call");
  const main = src("scripts/main.mjs");
  assert.match(main, /\n {2}Renown\.initAlways\(\);/, "registered whatever the feature setting");
  const rn = src("scripts/renown.mjs");
  assert.match(rn, /export function initAlways\(\) \{\n {2}if \(discountsOn\(\)\) return;/, "runs when Renown or its discounts are off");
  assert.match(rn, /!R\.offReset\(\{ on: discountsOn\(\),/);
  assert.match(rn, /if \(!isActiveGM\(\) \|\| !R\.offReset\(/, "leader only");
  assert.match(rn, /const n = await resetDiscounts\(\);/);
  assert.match(src("scripts/health.mjs"), /set by Renown \$\{left === 1 \? "is" : "are"\} still in place/);
});

test("quest pay with Renown off: nothing paid, not marked paid; no Pay button for renown-only rewards; one payment at a time", async () => {
  const QL = await import("../scripts/quest-log-model.mjs");
  const q = QL.normalizeQuest({ v: 2, rewards: { renown: [{ faction: "watch", amount: 1 }] } });
  assert.equal(QL.hasRewards(q, 0, { renown: false }), false);
  assert.equal(QL.hasRewards(q, 0, { renown: true }), true);
  assert.equal(QL.hasRewards(q, 5, { renown: false }), true);
  const qs = src("scripts/quests.mjs");
  const pay = qs.slice(qs.indexOf("async function payOnce"), qs.indexOf("function capWarn"));
  assert.ok(pay.indexOf("if (plan.renown.length && !renownOn())") < pay.indexOf("WCT.addMoney"), "refused before anything is paid");
  assert.match(pay, /if \(plan\.renown\.length && !renownOn\(\)\) \{ ui\.notifications\.warn\([\s\S]*?Nothing was paid\.`\); return false; \}/);
  assert.match(qs, /if \(PAYING\.has\(j\.id\)\) return false;\n\s+PAYING\.add\(j\.id\);\n\s+try \{ return await payOnce\(j, messageId\); \} finally \{ PAYING\.delete\(j\.id\); \}/);
  assert.equal(qs.split("QL.hasRewards(").length, qs.split(", { renown: renownOn() })").length, "every Pay decision knows whether Renown is on");
  assert.equal(qs.split("QL.hasRewards(").length - 1, 3);
});

test("award: the card shows the change applied (a loss stops at 0); the window awards once", () => {
  const rn = src("scripts/renown.mjs");
  assert.match(rn, /rows\.push\(\{ name: a\.name, delta: res\.score - res\.prevScore, roll,/);
  const html = V.cardHTML({ faction: "F", rows: [{ name: "A", delta: -2, before: 2, after: 0, tierBefore: -1, tierAfter: -1, tierName: "No tier", tierColor: "#e8d35a" }] });
  assert.match(html, /−2 renown/);
  const apps = src("scripts/renown-apps.mjs");
  assert.match(apps, /if \(this\._busy\) return;/);
  assert.match(apps, /this\._busy = true; const btn = f\.querySelector\("button\[type=submit\]"\); if \(btn\) btn\.disabled = true;/);
});

test("renown: loops read the GM-only bucket once", () => {
  const rn = src("scripts/renown.mjs");
  assert.match(rn, /export const entryFor = \(a, f, h = undefined\) =>/);
  assert.match(rn, /entryFor\(pc, f, h\)/);
  assert.match(src("scripts/health.mjs"), /Renown\.entryFor\(a, f, hh\)/);
});

test("renown merchant discounts: their own switch, default off, needs Renown; off = information only, no Item Piles writes", async () => {
  const { FEATURES } = await import("../scripts/features.mjs");
  const f = FEATURES.find(x => x.id === "renownDiscounts");
  assert.ok(f); assert.equal(f.default, false); assert.equal(f.key, "feature-renownDiscounts");
  assert.match(src("scripts/features.mjs"), /renownDiscounts: \["renown"\]/);
  const P = await import("../scripts/panel-model.mjs");
  assert.ok(P.FEATURE_IDS.includes("renownDiscounts") && P.FEATURE_CARDS.some(c => c.id === "renownDiscounts"));
  assert.ok(!P.PRESETS.classic.on.includes("renownDiscounts"), "presets other than Everything leave it off");
  assert.equal(R.discountsOn(id => id === "renown"), false);
  assert.equal(R.discountsOn(() => true), true);
  assert.equal(R.discountsOn(id => id === "renownDiscounts"), false);
  assert.equal(R.discountText({ discount: 10 }, { on: false }), "10% (discounts off)");
  assert.match(R.tierText({ perk: "p", discount: 15 }, { on: false }), /15% \(discounts off\)/);
  const on = V.pageHTML(V.pageModel({ factions: FACS, entries: ENTRIES }));
  const offHtml = V.pageHTML(V.pageModel({ factions: FACS, entries: ENTRIES, discounts: false }));
  assert.match(on, /wct-rn-disc on/); assert.doesNotMatch(offHtml, /wct-rn-disc on/);
  assert.match(offHtml, /wct-rn-disc off[^>]*>10% \(discounts off\)/);
  const rn = src("scripts/renown.mjs");
  assert.match(rn, /export const discountsOn = \(\) => R\.discountsOn\(featureOn\);/);
  assert.match(rn, /if \(!game\.user\?\.isGM \|\| !discountsOn\(\) \|\| !itemPiles\(\)\) return null;/, "sync needs the switch");
  assert.match(rn, /export function scheduleSync\(\) \{\n {2}if \(!game\.user\?\.isGM \|\| !discountsOn\(\)\) return;/);
  assert.match(rn, /export function ready\(\) \{\n {2}if \(!discountsOn\(\)\) return;/);
  assert.match(src("scripts/renown-apps.mjs"), /discounts: Renown\.discountsOn\(\)/);
  assert.match(src("scripts/health.mjs"), /Merchant discounts: off \(Renown merchant discounts on the Features tab\)/);
});

test("renown defaults: the shipped numbers, every one GM-editable, with Reset to defaults", () => {
  const c = R.normalizeConfig(null);
  assert.deepEqual(c.startBonus, [1, 2, 3, 5]);
  assert.deepEqual(R.normalizeStartBonus("2, 2, +4"), [2, 2, 4], "order kept, repeats allowed");
  assert.deepEqual(R.normalizeStartBonus("x"), [1, 2, 3, 5]);
  assert.equal(R.normalizeStartBonus(Array(20).fill(1)).length, R.TIERS_MAX);
  assert.deepEqual(R.normalizeConfig({ startBonus: [3] }).startBonus, [3]);
  const d = R.defaultShared();
  assert.deepEqual(d.tiers.map(t => [t.from, t.discount]), [[3, 0], [10, 10], [25, 15], [50, 25]]);
  assert.deepEqual([d.gains, d.losses, d.startBonus], [[1, 2, 3], ["1d8", "2d6", "2d12"], [1, 2, 3, 5]]);
  d.tiers[0].from = 99; assert.equal(R.DEFAULT_TIERS[0].from, 3, "a copy");
  const apps = src("scripts/renown-apps.mjs");
  for (const n of ["tierName", "tierFrom", "tierDiscount", "tierRarity", "tierPerk", "tierTitle", "tierColor"]) assert.match(apps, new RegExp(`name="${n}"`), `tier field ${n}`); // 2.2.1 names
  for (const n of ["gains", "losses", "startBonus"]) assert.match(apps, new RegExp(`name="${n}" value=`), `preset field ${n}`);
  assert.match(apps, /data-act="reset-shared"/);
  assert.match(apps, /await Renown\.saveShared\(d\);/);
  assert.match(apps, /startBonus: R\.normalizeStartBonus\(form\.elements\.startBonus\.value\)/);
});
