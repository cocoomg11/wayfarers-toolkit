// 2.3.2: tooltips never render document text as HTML, request card cooldown, flight queue, pay refuses short purses, batched loads.
import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as SX from "../scripts/sheet-extra-model.mjs";
import * as BM from "../scripts/sheet-book-model.mjs";
import * as R from "../scripts/trash-rules.mjs";
import { cardCooldown, CARD_COOLDOWN_S } from "../scripts/gm-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const scripts = readdirSync(new URL("../scripts/", import.meta.url)).filter(f => f.endsWith(".mjs"));

/** Every `data-tooltip="…"` value in a template literal (the text between the quotes, `${…}` kept whole). */
function tooltipValues(s, attrName = "data-tooltip") {
  const out = []; const re = new RegExp(`${attrName}="`, "g"); let m;
  while ((m = re.exec(s))) {
    let i = re.lastIndex, depth = 0, v = "";
    while (i < s.length) {
      if (s.startsWith("${", i)) { depth++; v += "${"; i += 2; continue; }
      const c = s[i]; if (depth && c === "{") depth++; if (depth && c === "}") depth--;
      if (!depth && c === '"') break; v += c; i++;
    }
    out.push({ v, line: s.slice(0, m.index).split("\n").length });
  }
  return out;
}

test("no data-tooltip takes interpolated text: Foundry renders data-tooltip as HTML (cleaned), so built text goes in data-tooltip-text", () => {
  // Foundry 13.339+: a data-tooltip that isn't a localization key is innerHTML (cleanHTML); data-tooltip-text is textContent;
  // data-tooltip-html is innerHTML (cleanHTML). An escaped name is attribute-decoded back to markup, so it must not go in data-tooltip.
  for (const f of scripts) {
    const s = src(`scripts/${f}`);
    for (const { v, line } of tooltipValues(s)) assert.ok(!v.includes("${"), `${f}:${line} data-tooltip="${v.slice(0, 60)}" interpolates; use data-tooltip-text`);
    assert.doesNotMatch(s, /\.dataset\.tooltip = [^"\n;]*(\$\{|\btip\b)/, `${f}: dataset.tooltip set from built text; use dataset.tooltipText`);
    assert.doesNotMatch(s, /attr\("data-tooltip",/, `${f}: attr("data-tooltip", …)`);
  }
});

test("HTML tooltips are module markup only: data-tooltip-html values double-escape every world-supplied piece", () => {
  const html = scripts.flatMap(f => tooltipValues(src(`scripts/${f}`), "data-tooltip-html").map(t => ({ f, ...t })));
  assert.deepEqual(html.map(t => `${t.f}:${t.v}`).sort(), ["renown-view-model.mjs:${esc(tip)}", "sheet-model.mjs:${esc(warnTip)}"]);
  assert.match(src("scripts/sheet-model.mjs"), /const warnTip = v\.warnings \? v\.warnings\.map\(esc\)\.join\("<br>"\) : "";/);
  assert.match(src("scripts/renown-view-model.mjs"), /const tip = \[r\.now && esc\(`Now: \$\{r\.now\}`\), r\.s\.next && esc\(`At \$\{r\.s\.next\.name\}/);
});

const evil = '<img src=x onerror="alert(1)">';
/** What Foundry would put in the tooltip from this markup's attributes: data-tooltip / -html as HTML, -text as text. */
function rendered(h) {
  const out = [];
  for (const m of h.matchAll(/data-tooltip(-text|-html)?="([^"]*)"/g)) {
    const decoded = m[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    out.push({ kind: m[1] === "-text" ? "text" : "html", decoded });
  }
  return out;
}
const noLiveTag = h => { for (const r of rendered(h)) if (r.kind === "html") assert.ok(!/<img/i.test(r.decoded), `HTML tooltip would contain markup: ${r.decoded}`); };

test("class, subclass, occupant and defender names: escaped text tooltips, no markup reaches an HTML tooltip", () => {
  const f = { classes: [{ id: "c1", name: evil, img: "f.webp", levels: 5, identifier: "x", subclass: { id: "s1", name: evil, img: "s.webp" }, hitDie: "d10" }],
    sections: [], summary: { level: 5, prof: 3 }, editable: true, edit: true, search: "", filters: [], sort: "m", group: "origin" };
  const h = BM.featuresPageHTML(f);
  assert.ok(rendered(h).some(r => r.kind === "text" && r.decoded === evil), "the name shows as text");
  noLiveTag(h);
  const b = SX.bastionPageHTML({ name: "B", nameSource: "B", defenders: [{ uuid: "Actor.d", name: evil, img: "o.webp", facility: "f2", index: 0 }],
    basic: { chosen: [], value: 0, max: 0, available: [] },
    special: { chosen: [{ id: "f2", name: "F", img: "f.webp", subtitle: "", built: true, special: true, defenders: [{ index: 0, uuid: "Actor.d", name: evil, img: "o.webp" }], hirelings: [], creatures: [] }], value: 1, max: 1, available: [] },
    description: { enriched: "", source: "" }, uuid: "Actor.a", editable: true, edit: false });
  assert.ok(rendered(b).filter(r => r.kind === "text" && r.decoded === evil).length >= 2);
  noLiveTag(b);
});

test("request card cooldown: one card per user per kind per 30 s; other users and kinds unaffected", () => {
  assert.equal(CARD_COOLDOWN_S, 30);
  const c = cardCooldown(); const t0 = 1_000_000;
  assert.equal(c.take("paceRequest", "u1", t0), true);
  assert.equal(c.take("paceRequest", "u1", t0 + 1000), false);
  assert.equal(c.take("roomRequest", "u1", t0 + 1000), true, "another kind");
  assert.equal(c.take("paceRequest", "u2", t0 + 1000), true, "another user");
  assert.equal(c.take("paceRequest", "u1", t0 + 29_000), false);
  assert.equal(c.take("paceRequest", "u1", t0 + 30_001), true);
  const g = src("scripts/gm.mjs");
  assert.match(g, /export function cardAllowed\(kind, user, what\) \{\n {2}if \(!user \|\| user\.isGM\) return true;/);
  assert.match(src("scripts/inn.mjs"), /if \(!cardAllowed\("roomRequest", u, "Rent rooms"\)\) return;\n {2}return ChatMessage\.create/);
  assert.match(src("scripts/main.mjs"), /if \(!cardAllowed\("paceRequest", u, "Travel pace"\)\) return;\n {4}return ChatMessage\.create/);
});

test("flights run one at a time and re-check the purse inside; pay() never pays part of a sum", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /doFlight\(opts\) \{[\s\S]*?const run = FLIGHT_QUEUE\.then\(\(\) => this\.runFlight\(opts\)\);\n {4}FLIGHT_QUEUE = run\.catch/);
  // The purse check (Flight.decide) is inside runFlight, so it runs after the previous flight has paid.
  const body = m.slice(m.indexOf("async runFlight("), m.indexOf("/** Long Road"));
  assert.match(body, /purse: party \? this\.totalMoney\(party\) : null/);
  assert.match(body, /if \(charge && !\(await this\.pay\(party, charge, \{ reason: `Flight/);
  assert.equal((m.match(/this\.runFlight\(/g) ?? []).length, 1, "runFlight only through the queue");
  assert.match(m, /if \(!\(Math\.round\(amount\) >= 0\) \|\| before < Math\.round\(amount\)\) \{[^\n]*return false; \}/);
  const c = src("scripts/coinlog.mjs");
  assert.match(c, /if \(!\(await API\.pay\(actor, plan\.amount/);
  assert.match(c, /if \(!\(await API\.pay\(party, now\.take, \{ reason: "Split coin" \}\)\)\) return null;/);
});

test("groupItemUuids: compendium items by pack, world items, the rest; duplicates and blanks dropped", () => {
  const g = R.groupItemUuids(["Compendium.m.items.Item.a", "Compendium.m.items.Item.b", "Compendium.m.items.Item.a", "Compendium.n.gear.Item.c", "Item.w", "Actor.x.Item.y", "", null]);
  assert.deepEqual([...g.packs.keys()], ["m.items", "n.gear"]);
  assert.deepEqual([...(g.packs.get("m.items") ?? new Map()).keys()], ["a", "b"]);
  assert.deepEqual([...g.world.keys()], ["w"]);
  assert.deepEqual(g.other, ["Actor.x.Item.y"]);
});

test("Vendor Trash and boss loot load drops in batches, never fromUuid per drop", () => {
  const t = src("scripts/trash.mjs"); const b = src("scripts/bossloot.mjs");
  assert.match(t, /pack\.getDocuments\(\{ _id__in: todo \}\)/);
  assert.match(t, /export function resetPool\(\) \{ POOL = null; SOURCES\.clear\(\); \}/);
  assert.doesNotMatch(t, /async function trashItemData/);
  assert.equal((t.match(/trashItemData\(srcs, /g) ?? []).length, 4, "the definition and its three callers");
  assert.match(b, /Trash\.itemSources\(picks\.map\(resultUuid\), \{ cache: false \}\)/);
  assert.match(b, /Trash\.itemSources\(data\.drops \?\? \[\], \{ cache: false \}\)/);
});

test("small fixes: local esc copies gone, loot card map pruned, pins per scene, bastion sync lookups, setupPlan GM gate, rest scene", () => {
  for (const f of scripts) assert.doesNotMatch(src(`scripts/${f}`), /const esc = s => String/, `${f} keeps its own esc`);
  const l = src("scripts/loot.mjs");
  assert.match(l, /pruneCards\(\); cards\.delete\(root\); cards\.set\(root/);
  assert.match(l, /while \(cards\.size > CARDS_MAX\)/);
  assert.match(src("scripts/pins.mjs"), /return perScene\(String\(data\?\.sceneId \?\? ""\), \(\) => decideRequest\(data, sender\)\);/);
  const s = src("scripts/sheet.mjs");
  assert.match(s, /if \(String\(uuid\)\.startsWith\("Compendium\."\)\) return fromUuid\(uuid\)\.catch\(\(\) => null\);\n {6}try \{ return fromUuidSync\(uuid, \{ strict: false \}\); \}/);
  const body = s.slice(s.indexOf("async bastionFacts()"), s.indexOf("async bastionFacts()") + 2500);
  assert.equal((body.match(/await fromUuid\(/g) ?? []).length, 0);
  assert.match(src("scripts/main.mjs"), /setupPlan\(\) \{\n[^\n]*\n {4}if \(!this\.gmOnly\(\)\) return undefined;/);
  const inn = src("scripts/inn.mjs");
  assert.match(inn, /const sc = anywhere \? \(game\.scenes\.get\(sceneId \?\? ""\) \?\? tokenScene\) : \(tokenScene \?\? game\.scenes\.get\(sceneId \?\? ""\) \?\? null\);/);
  assert.match(src("scripts/health.mjs"), /a determined player can still read them from the browser console/);
});

test("2.3.2 version, changelog with live checklist, update note, CLAUDE.md", () => {
  const m = JSON.parse(src("module.json"));
  assert.match(m.version, /^2\.(3\.([2-9]|\d\d)|([4-9]|\d\d)\.\d+)$/);
  assert.match(src("CHANGELOG.md"), /## 2\.3\.2\n\n2026-11-07\.[\s\S]*?\*\*Untested in Foundry\*\*[\s\S]*?## 2\.3\.1/);
  assert.match(src("scripts/update-notes.mjs"), /version: "2\.3\.2"/);
  assert.match(src("CLAUDE.md"), /## 2\.3\.2 notes/);
});
