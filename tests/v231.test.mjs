// 2.3.1: dnd5e's Favorite / Remove Favorite context menu entries are dropped on the toolkit sheet only.
import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SM from "../scripts/sheet-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const menu = () => [{ label: "DND5E.ContextMenuActionEdit" }, { label: "DND5E.Favorite" }, { label: "DND5E.Identify" }, { label: "DND5E.FavoriteRemove" }, { label: "Favourite (de)" }];

test("dropFavourites removes dnd5e's favourite entries in place, by key and by localized label; others kept", () => {
  const m = menu();
  assert.equal(SM.dropFavourites(m), 2);
  assert.deepEqual(m.map(e => e.label), ["DND5E.ContextMenuActionEdit", "DND5E.Identify", "Favourite (de)"]);
  const m2 = menu();
  assert.equal(SM.dropFavourites(m2, ["Favourite (de)", "", /** @type {any} */ (null)]), 3);
  assert.deepEqual(m2.map(e => e.label), ["DND5E.ContextMenuActionEdit", "DND5E.Identify"]);
  assert.equal(SM.dropFavourites(null), 0);
  assert.equal(SM.dropFavourites([null, 3, { label: 5 }]), 0);
  assert.deepEqual(SM.FAVOURITE_LABELS, ["DND5E.Favorite", "DND5E.FavoriteRemove"]);
});

test("onToolkitSheet: only inside the toolkit sheet's content", () => {
  const at = sel => ({ closest: s => (s === sel ? {} : null) });
  assert.equal(SM.onToolkitSheet(at(".wct-sheet .wct-cs")), true);
  assert.equal(SM.onToolkitSheet({ closest: () => null }), false, "dnd5e's sheet");
  assert.equal(SM.onToolkitSheet(null), false);
  assert.equal(SM.onToolkitSheet({}), false);
});

test("wiring: registered once in init behind characterSheet, dnd5e's three menu hooks, nothing written", () => {
  const main = src("scripts/main.mjs");
  assert.match(main, /if \(F\.on\("characterSheet"\)\) Sheet\.registerFavouriteFilter\(\);/);
  const s = src("scripts/sheet.mjs");
  const fn = s.slice(s.indexOf("export function registerFavouriteFilter()"), s.indexOf("/** Registers the sheet for dnd5e character actors"));
  assert.match(fn, /if \(favouriteHooks\) return; favouriteHooks = true;/);
  for (const h of ["dnd5e.getItemContextOptions", "dnd5e.getActiveEffectContextOptions", "dnd5e.getItemActivityContext"]) assert.ok(fn.includes(`Hooks.on("${h}"`), h);
  assert.match(fn, /document\.addEventListener\("contextmenu", ev => \{ menuOnSheet = SM\.onToolkitSheet\(ev\.target\); \}, \{ capture: true \}\)/);
  assert.ok(!/favorites|addFavorite|removeFavorite|\.update\(/.test(fn), "never touches the actor's favourites");
});

test("2.3.1 version, changelog, docs", () => {
  const m = JSON.parse(src("module.json"));
  assert.match(m.version, /^2\.(3\.([1-9]|\d\d)|([4-9]|\d\d)\.\d+)$/);
  assert.match(src("CHANGELOG.md"), /## 2\.3\.1\n\n2026-11-07\.[\s\S]*?\*\*Untested in Foundry\*\*/);
  assert.match(src("docs/quests-and-characters.md"), /\*\*No favourites\*\*/);
});
