import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./_globals.mjs";
import * as SX from "../scripts/sheet-extra-model.mjs";
import * as N from "../scripts/update-notes.mjs";

const src = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const base = { classes: [], sections: [], originalClass: "" };

test("2.1.2: Special traits hint only for users who can edit", () => {
  assert.match(SX.specialPageHTML({ ...base, editable: true, edit: false }), /Switch to Edit/);
  assert.doesNotMatch(SX.specialPageHTML({ ...base, editable: false, edit: false }), /Switch to Edit/);
  assert.doesNotMatch(SX.specialPageHTML({ ...base, editable: true, edit: true }), /Switch to Edit/);
});

test("2.1.2: version, download, note", () => {
  const m = JSON.parse(src("module.json"));
  assert.match(m.version, /^2\.(1\.2|2\.\d+)$/);
  assert.equal(m.download, `https://github.com/cocoomg11/wayfarers-toolkit/releases/download/v${m.version}/module.zip`);
  assert.equal(m.compatibility.verified, "14.370");
  assert.ok(N.NOTES.find(x => x.version === "2.1.2"));
});
