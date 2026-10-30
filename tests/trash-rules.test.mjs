import { test } from "node:test";
import assert from "node:assert/strict";
import * as R from "../scripts/trash-rules.mjs";

const mk = (name, type = "loot", ilvl = 5, copper = 10) => R.classifyItem({ name, type, ilvl, copper, uuid: name });
const pool = [
  mk("Thick Fur"), mk("Wolf Fang"), mk("Bear Claw"), mk("Boar Tusk"), mk("Spider Silk"), mk("Small Spider Chitin"), mk("Scorpion Stinger"),
  mk("Brittle Bone"), mk("Glowing Shard"), mk("Withered Leaves"), mk("Bent Spoon"), mk("Chipped Mug"), mk("Torn Feather"), mk("Owl Talon"),
  mk("Dragon Scale"), mk("Sharp Claw"), mk("Beetle Carapace"), mk("Stringy Meat"), mk("Gnoll Mane"), mk("Kobold Candle"), mk("Odd Thing"),
  mk("Murkfin Scale"), mk("Rotting Flesh"), mk("Worn Shortsword", "weapon", 6), mk("Frayed Robe", "equipment", 30),
  mk("Duskwing Wing"), mk("Duskwing Chitin")
];
const ctxFor = (name, subtype = "", fams = new Set()) => ({ worldFams: fams, creatureWords: R.creatureWordsOf(name, subtype) });
const drops = (c, slot = "item", fams = new Set(), rules = []) => {
  const prof = R.profileFor(c, rules); return pool.filter(i => R.suitability(i, prof, slot, ctxFor(c.name, c.subtype, fams))).map(i => i.name);
};

test("material tags from item names", () => {
  assert.deepEqual(R.tagsFor("Thick Fur"), ["fur"]);
  assert.deepEqual(R.tagsFor("Small Spider Chitin"), ["insect"]);
  assert.deepEqual(R.tagsFor("Broken Fang"), ["tooth"]);
  assert.deepEqual(R.tagsFor("Bent Spoon"), ["trinket"]);
  assert.deepEqual(R.tagsFor("Leather Pouch"), ["trinket"]);
  assert.deepEqual(R.tagsFor("Glowing Shard"), ["elemental"]);
  assert.deepEqual(R.tagsFor("Brittle Bone"), ["undead"]);
  assert.deepEqual(R.tagsFor("Withered Leaves"), ["plant"]);
  assert.deepEqual(R.tagsFor("Odd Thing"), ["misc"]);
  assert.deepEqual(R.tagsFor("Worn Shortsword", "weapon"), ["gear"]);
  assert.deepEqual(R.tagsFor("Scaly Claw").sort(), ["scale", "tooth"]);
});

test("wolf drops fur and fangs, not other families or insects", () => {
  const d = drops({ name: "Mangy Wolf", type: "beast" });
  for (const x of ["Thick Fur", "Wolf Fang", "Sharp Claw", "Stringy Meat"]) assert.ok(d.includes(x), x);
  for (const x of ["Spider Silk", "Bear Claw", "Boar Tusk", "Beetle Carapace", "Torn Feather", "Bent Spoon", "Dragon Scale", "Brittle Bone"]) assert.ok(!d.includes(x), x);
});

test("spider drops chitin and silk only", () => {
  const d = drops({ name: "Forest Spider", type: "beast" });
  assert.ok(d.includes("Spider Silk") && d.includes("Small Spider Chitin"));
  for (const x of ["Thick Fur", "Wolf Fang", "Beetle Carapace", "Scorpion Stinger"]) assert.ok(!d.includes(x), x);
});

test("dragon never drops fur or insect parts, even with a rule", () => {
  const d = drops({ name: "Black Dragon Whelp", type: "dragon" });
  assert.ok(d.includes("Dragon Scale") && d.includes("Sharp Claw"));
  for (const x of ["Thick Fur", "Spider Silk", "Beetle Carapace", "Torn Feather", "Wolf Fang"]) assert.ok(!d.includes(x), x);
  const { rules } = R.parseRules([["dragon", "fur, insect"]]);
  const prof = R.profileFor({ name: "Red Dragon", type: "dragon" }, rules);
  assert.equal(R.suitability(R.classifyItem({ name: "Thick Fur", type: "loot" }), prof, "item", { creatureWords: new Set(["red", "dragon"]) }), 0);
});

test("humanoids drop trinkets and gear, no body parts", () => {
  const d = drops({ name: "Bandit Lookout", type: "humanoid" });
  assert.ok(d.includes("Bent Spoon") && d.includes("Chipped Mug") && d.includes("Odd Thing"));
  for (const x of ["Thick Fur", "Wolf Fang", "Stringy Meat", "Gnoll Mane", "Kobold Candle"]) assert.ok(!d.includes(x), x);
  assert.deepEqual(drops({ name: "Bandit Lookout", type: "humanoid" }, "gear"), ["Worn Shortsword", "Frayed Robe"]);
});

test("family items only from their family", () => {
  const g = drops({ name: "Gnoll Brute", type: "humanoid", subtype: "gnoll" });
  assert.ok(g.includes("Gnoll Mane") && !g.includes("Kobold Candle") && !g.includes("Thick Fur"));
  assert.ok(drops({ name: "Tunnel Kobold", type: "humanoid", subtype: "kobold" }).includes("Kobold Candle"));
});

test("world family words", () => {
  const fams = R.familyWordsFrom(["Duskwing Stalker", "Young Duskwing", "Mangy Wolf", "Bandit Lookout", "Murkfin Hunter"]);
  assert.ok(fams.has("duskwing") && fams.has("murkfin") && fams.has("bandit"));
  assert.ok(!fams.has("young") && !fams.has("mangy") && !fams.has("wolf"));
  assert.ok(drops({ name: "Duskwing Stalker", type: "beast" }, "item", fams).includes("Duskwing Chitin"));
  assert.ok(!drops({ name: "Forest Spider", type: "beast" }, "item", fams).includes("Duskwing Chitin"));
  assert.ok(!drops({ name: "River Crocolisk", type: "beast" }, "item", fams).includes("Murkfin Scale"));
  assert.ok(drops({ name: "Murkfin Hunter", type: "humanoid" }, "item", fams).includes("Murkfin Scale"));
});

test("kind from the name when the type is blank", () => {
  assert.equal(R.profileFor({ name: "Mangy Wolf" }).kind, "beast");
  assert.equal(R.profileFor({ name: "Bandit Lookout" }).kind, "humanoid");
  assert.equal(R.profileFor({ name: "Rotting Zombie" }).kind, "undead");
  assert.equal(R.profileFor({ name: "Dragon Whelp" }).kind, "dragon");
  assert.equal(R.profileFor({ name: "Wolf Rider Bandit" }).kind, "humanoid");
  assert.equal(R.profileFor({ name: "Owlbear", type: "monstrosity" }).groups.sort().join(), "bear,bird");
});

test("humanoid race words override a soft dnd5e type", () => {
  // A gnoll statted as a fiend is still a gnoll: trinkets, gear and coin, not elemental or scale parts.
  const p = R.profileFor({ name: "Pack Leader", type: "fiend", subtype: "gnoll" });
  assert.equal(p.kind, "humanoid"); assert.ok(p.groups.includes("gnoll")); assert.ok(p.gear && p.coin > 0);
  assert.equal(R.profileFor({ name: "Gnoll Brute", type: "monstrosity" }).kind, "humanoid");
  assert.equal(R.profileFor({ name: "Cave Kobold", type: "beast" }).kind, "humanoid");
  assert.equal(R.profileFor({ name: "Bandit Captain", type: "fiend" }).kind, "humanoid");
  const g = drops({ name: "Pack Leader", type: "fiend", subtype: "gnoll" });
  assert.ok(g.includes("Gnoll Mane") && g.includes("Bent Spoon") && !g.includes("Glowing Shard") && !g.includes("Dragon Scale"));
});

test("hard types keep their kind despite humanoid words", () => {
  assert.equal(R.profileFor({ name: "Gnoll Lich", type: "undead" }).kind, "undead");
  assert.equal(R.profileFor({ name: "Kobold Dragon", type: "dragon" }).kind, "dragon");
  assert.equal(R.profileFor({ name: "Orc Golem", type: "construct" }).kind, "elemental");
  assert.equal(R.profileFor({ name: "Goblin Ooze", type: "ooze" }).kind, "ooze");
  assert.equal(R.profileFor({ name: "Troll Fungus", type: "plant" }).kind, "plant");
  assert.equal(R.profileFor({ name: "Ogre Elemental", type: "elemental" }).kind, "elemental");
  // A person word next to an animal word on a beast stays a beast ("Guard Dog").
  assert.equal(R.profileFor({ name: "Guard Dog", type: "beast" }).kind, "beast");
});

test("undead drop bones, not fur", () => {
  const d = drops({ name: "Skeletal Warrior", type: "undead" });
  assert.ok(d.includes("Brittle Bone") && !d.includes("Thick Fur") && !d.includes("Spider Silk"));
});

test("world rules are parsed defensively", () => {
  const { rules, errors } = R.parseRules([["Ember", "elemental, coin", "", "", ""], ["", "fur"], ["Swamp", "bogus"], ["Tide", "aquatic", "Murkfin Scale", "Wolf", "tidewalker"], "junk", ["", "", "", "", ""]]);
  assert.equal(rules.length, 2); assert.equal(errors.length, 3);
  const prof = R.profileFor({ name: "Ember Wolf", type: "beast" }, rules);
  assert.ok(prof.tags.has("elemental") && prof.coin > 0 && prof.rules.includes("ember"));
  const tide = R.profileFor({ name: "Tide Crawler", type: "beast" }, rules);
  const td = pool.filter(i => R.suitability(i, tide, "item", ctxFor("Tide Crawler"))).map(i => i.name);
  assert.ok(td.includes("Murkfin Scale") && !td.includes("Wolf Fang"));
  assert.ok(tide.familyWords.has("tidewalker"));
  const { rules: r2 } = R.parseRules([["trapper", "fur"]]);
  const d = drops({ name: "Bandit Trapper", type: "humanoid" }, "item", new Set(), r2);
  assert.ok(d.includes("Thick Fur") && !d.includes("Wolf Fang"));
});

test("CR bands", () => {
  assert.equal(R.bandFor(0).label, "CR 0–1/4"); assert.equal(R.bandFor(0.25).label, "CR 0–1/4");
  assert.equal(R.bandFor(0.5).label, "CR 1/2–1"); assert.equal(R.bandFor(1).label, "CR 1/2–1");
  assert.equal(R.bandFor(4).label, "CR 2–4"); assert.equal(R.bandFor(8).label, "CR 5–8");
  assert.equal(R.bandFor(12).label, "CR 9–12"); assert.equal(R.bandFor(16).label, "CR 13–16"); assert.equal(R.bandFor(30).label, "CR 17+");
  assert.equal(R.bandFor("x").label, "CR 0–1/4"); assert.equal(R.bandFor(-3).label, "CR 0–1/4");
  for (let i = 1; i < R.CR_BANDS.length; i++) {
    const a = R.CR_BANDS[i - 1], b = R.CR_BANDS[i];
    assert.ok(b.coin[0] > a.coin[0] && b.coin[1] > a.coin[1] && b.ilvl[1] > a.ilvl[1] && b.value[1] > a.value[1], b.label);
  }
});

test("item level filter and widening keep flavour", () => {
  const items = [mk("Thick Fur", "loot", 40), mk("Wolf Fang", "loot", 45), mk("Ruined Pelt", "loot", 44), mk("Spider Silk", "loot", 2), mk("Bent Spoon", "loot", 3), mk("Sharp Claw", "loot", 4)];
  const prof = R.profileFor({ name: "Mangy Wolf", type: "beast" });
  const low = R.candidates(items, prof, "item", R.bandFor(0), ctxFor("Mangy Wolf"));
  assert.ok(low.normal.every(i => !["Spider Silk", "Bent Spoon"].includes(i.name)));
  assert.ok(low.normal.some(i => i.name === "Sharp Claw") && low.widen > 0);
  const hi = R.candidates(items, prof, "item", R.bandFor(10), ctxFor("Mangy Wolf"));
  assert.ok(hi.normal.some(i => i.name === "Thick Fur") && !hi.normal.some(i => i.name === "Sharp Claw"));
  assert.ok(hi.widen <= 1 && hi.normal.length === 3);
});

test("coin per CR rises and stays modest", () => {
  const rng = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  const prof = R.profileFor({ name: "Bandit", type: "humanoid" });
  const avg = cr => { let s = 0; for (let i = 0; i < 4000; i++) s += R.coinRoll(prof, R.bandFor(cr), rng); return s / 4000; };
  const vals = [0, 0.5, 3, 6, 10, 14, 18].map(avg);
  for (let i = 1; i < vals.length; i++) assert.ok(vals[i] > vals[i - 1]);
  assert.ok(vals[0] < 400 && vals.at(-1) < 150000);
  assert.equal(R.coinRoll(R.profileFor({ name: "Wolf", type: "beast" }), R.bandFor(5), rng), 0);
});

test("slots scale with band; named items are preferred", () => {
  const prof = R.profileFor({ name: "Wolf", type: "beast" });
  assert.equal(R.slotsFor(prof, R.bandFor(0), 0, () => 0.99).length, 2);
  assert.equal(R.slotsFor(prof, R.bandFor(20), 0, () => 0.99).length, 6);
  const g = R.profileFor({ name: "Gnoll Brute", type: "humanoid", subtype: "gnoll" });
  let named = 0; for (let i = 0; i < 400; i++) if (R.pickFor(pool, g, "item", R.bandFor(0), ctxFor("Gnoll Brute", "gnoll"))?.name === "Gnoll Mane") named++;
  assert.ok(named > 200, String(named));
});
