// 1.30.0: health lines with a fix (core 0.5.0's contract): FIXES, the pure ownership rule, pass-through in healthReport().
import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { healthCollector, readFix, storableReport } from "../vendor/wanderers-core/index.mjs";

const H = await import("../scripts/health.mjs");
const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("FIXES: each is a readable core fix with a label and a confirm text (they change data)", async () => {
  const ran = [];
  const api = { setup: () => { ran.push("setup"); return []; }, bossLoot: { autoLink: () => { ran.push("autolink"); } } };
  for (const [k, f] of Object.entries({ setup: H.FIXES.setup(api), autolink: H.FIXES.autolink(api), vaultPrivate: H.FIXES.vaultPrivate(), fileVault: H.FIXES.fileVault() })) {
    const r = readFix(f);
    assert.ok(r && typeof r.run === "function", k);
    assert.ok(r.label.length > 0 && r.label.length <= 60, k);
    assert.ok(r.confirm && r.confirm.length > 20, `${k} asks first`);
  }
  await H.FIXES.setup(api).run(); await H.FIXES.autolink(api).run();
  assert.deepEqual(ran, ["setup", "autolink"]);
});

test("vaultOwnership: default and every player with their own level go to None; GMs and others untouched", () => {
  assert.deepEqual(H.vaultOwnership({ default: 2, p1: 3, gm: 3 }, ["p1", "p2"], 0), { default: 0, p1: 0 });
  assert.deepEqual(H.vaultOwnership(null, ["p1"], 0), { default: 0 });
});

test("healthReport passes a line's fix through core's collector; storableReport keeps none of the functions", () => {
  const h = src("scripts/health.mjs");
  assert.match(h, /add\(l\.level, toPlain\(l\.text\), l\.fix\)/);
  const c = healthCollector({ timeoutMs: 50 });
  c.section("Setup"); c.add("bad", "Macro: missing", H.FIXES.setup({ setup: () => [] }));
  const rep = c.report();
  assert.equal(rep[0].lines[0].fix.label, "Run setup");
  assert.equal(typeof rep[0].lines[0].fix.run, "function");
  assert.equal(storableReport(rep)[0].lines[0].fix, undefined, "run-only fixes are not stored");
});

test("which lines carry a fix: missing setup, unlinked boss tables, shared records journal, unfiled records journal", () => {
  const h = src("scripts/health.mjs");
  assert.match(h, /bad\(`\$\{esc\(p\.label\)\}: missing`, FIXES\.setup\(api\)\)/);
  assert.match(h, /Link boss tables by name<\/button>`, FIXES\.autolink\(api\)\)/);
  assert.match(h, /Set its ownership back to None for players[^\n]*FIXES\.vaultPrivate\(\)\)/);
  assert.match(h, /"Module data" folder once on their next load\.`, FIXES\.fileVault\(\)\)/);
  // The control panel's Overview offers a line's own fix when it has none of its own, with the confirm.
  const p = src("scripts/panel.mjs");
  assert.match(p, /l\.fix\?\.run \? \{ action: "run"/);
  assert.match(p, /fix\.action === "run" && typeof fix\.run === "function"\) \{\n\s*if \(fix\.confirm && !\(await confirm/);
});
