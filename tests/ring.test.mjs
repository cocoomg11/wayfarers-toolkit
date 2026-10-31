import { test } from "node:test";
import assert from "node:assert/strict";
import "./_globals.mjs";
const R = await import("../scripts/ring.mjs");
const M = await import("../scripts/panel-model.mjs");
const F = await import("../scripts/features.mjs");
const N = await import("../scripts/update-notes.mjs");
const ID = "wayfarers-toolkit";
const tok = (enabled = false, scale = 1, rec) => ({ ring: { enabled, subject: { scale } }, flags: rec ? { [ID]: { ring: rec } } : {} });

test("which tokens get the ring", () => {
  assert.equal(R.wants("npc", "npc"), true);
  assert.equal(R.wants("character", "npc"), false, "NPCs only leaves characters alone");
  assert.equal(R.wants("character", "all"), true);
  assert.equal(R.wants("group", "all"), true);
  assert.equal(R.wants(undefined, "all"), false, "no actor, no ring");
});

test("ringUpdate: turns the ring on, sets the scale only when it's untouched, records what was there", () => {
  const u = R.ringUpdate(tok(), { scale: 0.85 });
  assert.deepEqual(u, { "ring.enabled": true, "ring.subject.scale": 0.85, [`flags.${ID}.ring`]: { enabled: false, scale: 1, applied: 0.85 } });
  const own = R.ringUpdate(tok(false, 1.2), { scale: 0.85 });
  assert.equal(own["ring.subject.scale"], undefined, "a scale you set yourself is kept");
  assert.deepEqual(own[`flags.${ID}.ring`], { enabled: false, scale: 1.2, applied: null });
  assert.equal(R.ringUpdate(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 }), { scale: 0.85 }), null, "already done");
  const again = R.ringUpdate(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 }), { scale: 0.9 });
  assert.equal(again["ring.subject.scale"], 0.9, "the toolkit's own scale follows the setting");
  assert.deepEqual(again[`flags.${ID}.ring`], { enabled: false, scale: 1, applied: 0.9 }, "the original values stay recorded");
  const p = R.ringUpdate(tok(), { scale: 0.85, prefix: "prototypeToken." });
  assert.ok("prototypeToken.ring.enabled" in p && `prototypeToken.flags.${ID}.ring` in p);
  for (const k of Object.keys(u)) assert.doesNotMatch(k, /texture|img/, "never touches art");
});

test("ringRevert puts back what the toolkit changed", () => {
  assert.equal(R.ringRevert(tok(true)), null, "not ours: left alone");
  assert.deepEqual(R.ringRevert(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 })), { "ring.enabled": false, [`flags.${ID}.ring`]: null, "ring.subject.scale": 1 });
  const moved = R.ringRevert(tok(true, 1.1, { enabled: false, scale: 1, applied: 0.85 }));
  assert.equal(moved["ring.subject.scale"], undefined, "a scale changed since is kept");
  assert.equal(R.ringRevert(tok(true, 1, { enabled: true, scale: 1, applied: null }))["ring.enabled"], true, "a ring that was on stays on");
});

test("scale clamp, image fit and batching", () => {
  assert.equal(R.clampScale(0.1), 0.5); assert.equal(R.clampScale(3), 1.5); assert.equal(R.clampScale("x"), 0.85); assert.equal(R.clampScale(0.876), 0.88);
  assert.deepEqual(R.fitRect(256, 256), { x: 0, y: 0, w: 512, h: 512 });
  assert.deepEqual(R.fitRect(512, 256), { x: 0, y: 128, w: 512, h: 256 });
  assert.deepEqual(R.fitRect(0, 0), { x: 0, y: 0, w: 512, h: 512 });
  assert.deepEqual(R.chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(R.chunks(Array.from({ length: 250 })).length, 3);
});

test("spritesheet JSON: one square frame matching the drawn texture, no colour band", async () => {
  const { readFile } = await import("node:fs/promises");
  const j = JSON.parse(await readFile(new URL("../assets/token-ring.json", import.meta.url)));
  const frames = Object.entries(j.frames);
  assert.equal(frames.length, 1);
  const [, f] = frames[0];
  assert.deepEqual(f.frame, { x: 0, y: 0, w: R.FRAME, h: R.FRAME });
  assert.deepEqual(j.meta.size, { w: R.FRAME, h: R.FRAME });
  assert.equal(f.gridTarget, 1);
  assert.deepEqual(j.config.defaultColorBand, { startRadius: 0, endRadius: 0 }, "the image's own colours are kept");
  assert.equal(R.SHEET, "modules/wayfarers-toolkit/assets/token-ring.json");
});

test("feature registry, panel and update notes", async () => {
  const f = F.FEATURES.find(x => x.id === "tokenRing");
  assert.equal(f.default, false, "off for new worlds"); assert.equal(f.key, "feature-tokenRing");
  assert.ok(M.FEATURE_IDS.includes("tokenRing"));
  assert.equal(M.presetSettings("everything")["feature-tokenRing"], false);
  assert.equal(M.presetSettings("classic")["feature-tokenRing"], false);
  const tab = M.TABS.find(t => t.id === "tokens");
  for (const k of ["ringImage", "ringTargets", "ringNewTokens", "ringSubjectScale", "ringExisting"]) assert.ok(M.tabKeys(tab).includes(k), k);
  assert.ok(tab.basic.every(([, cond]) => cond === "tokenRing"));
  assert.deepEqual(M.issueFix("Custom token ring", "… Apply ring to existing tokens …"), { action: "ringApply", label: "Apply ring to existing tokens" });
  assert.equal(M.issueFix("Custom token ring", "no ring image").tab, "tokens");
  const e = N.NOTES.find(n => n.version === "1.18.0"); assert.ok(e);
  const a = e.actions.find(x => x.id === "ringApply");
  assert.equal(a.check({ api: { ring: { plan: () => ({ actors: 2, tokens: 0 }), status: () => ({ image: "x.png" }) } } }), true);
  assert.equal(a.check({ api: { ring: { plan: () => ({ actors: 0, tokens: 0 }), status: () => ({ image: "x.png" }) } } }), false);
  assert.equal(a.check({ api: { ring: { plan: () => ({ actors: 2, tokens: 0 }), status: () => ({ image: "" }) } } }), false, "no image chosen: nothing to do yet");
  assert.equal(a.check({ api: {} }), false, "feature off");
  const off = await N.build({ always: [], from: "1.17.0", to: "1.18.0", on: id => id !== "tokenRing", ctx: { api: {} } });
  assert.equal(off.actions.length, 0);
  assert.equal(off.entries[0].changes.length, 1, "only the line about the new tool shows while it's off");
});
