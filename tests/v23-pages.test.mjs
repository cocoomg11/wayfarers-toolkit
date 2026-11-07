// 2.3.0: other modules' pages on the toolkit character sheet (api.sheet, core 0.6.0 guest pages), plus the core move.
import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as SM from "../scripts/sheet-model.mjs";
import * as Sheet from "../scripts/sheet.mjs";
import * as PM from "../scripts/pane-model.mjs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const guest = (o = {}) => ({ id: "guild.professions", label: "Professions", hint: "from your tools", icon: null, fa: null, order: 85, guest: /** @type {const} */ (true), ...o });

// ---------------------------------------------------------------- pure: pages, bookmarks, page body
test("built-in pages carry increasing orders (character 10 … special 90), same ids and order as before", () => {
  assert.deepEqual(SM.PAGES.map(p => p.id), ["character", "details", "inventory", "features", "spells", "effects", "biography", "reputation", "bastion", "special"]);
  const orders = SM.PAGES.map(p => p.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  assert.equal(new Set(orders).size, orders.length);
  assert.deepEqual([orders[0], orders.at(-1)], [10, 90]);
  for (const p of SM.PAGES) assert.equal(SM.isGuestPage(p.id), false, p.id);
  assert.equal(SM.isGuestPage("guild.professions"), true);
});

test("visiblePages merges visible guests by order; a guest can't take a built-in id; pickPage accepts guest ids", () => {
  const ids = f => SM.visiblePages(f).map(p => p.id);
  assert.deepEqual(ids({ bastion: true, guests: [guest()] }), ["character", "details", "inventory", "features", "spells", "effects", "biography", "bastion", "guild.professions", "special"]);
  assert.deepEqual(ids({ guests: [guest({ order: null }), guest({ id: "a.first", order: 1 }), guest({ id: "z.tie", order: 20 })] }),
    ["a.first", "character", "details", "z.tie", "inventory", "features", "spells", "effects", "biography", "special", "guild.professions"]);
  assert.deepEqual(ids({ guests: [guest({ id: "details", order: 1 }), /** @type {any} */ ({ id: "x.y", label: "no flag" })] }), ids({}), "only real guest summaries");
  assert.equal(SM.pickPage("guild.professions", { guests: [guest()] }), "guild.professions");
  assert.equal(SM.pickPage("guild.professions", {}), "character", "unregistered or hidden → Character, as before");
  assert.equal(SM.pickPage("nope", { guests: [guest()] }), "character");
});

test("guestSummary drops a guest's functions", () => {
  const s = SM.guestSummary({ id: "m.p", label: "P", hint: "h", icon: "M1 1", fa: null, order: 5, render: () => "", activate: () => {}, visible: () => true });
  assert.deepEqual(s, { id: "m.p", label: "P", hint: "h", icon: "M1 1", fa: null, order: 5, guest: true });
  assert.deepEqual(SM.guestSummary({ id: "m.q", label: "Q" }), { id: "m.q", label: "Q", hint: "", icon: null, fa: null, order: null, guest: true });
});

test("bookmarks: guest path icon, Font Awesome icon, default icon; labels escaped", () => {
  const v = SM.sheetView({ name: "Ann", guests: [guest({ icon: "M14 6l4 4" }), guest({ id: "a.fa", label: "<b>Fa</b>", fa: "fa-solid fa-hammer", order: 86 }), guest({ id: "a.none", order: 87 })] }, { page: "a.fa" });
  assert.equal(v.page, "a.fa");
  const tabs = SM.tabsHTML(v);
  assert.match(tabs, /data-page="guild\.professions"[^>]*><svg[^>]*><path d="M14 6l4 4"\/>/);
  assert.match(tabs, /class="wct-cs-btab on guest"[^>]*data-page="a\.fa"[^>]*aria-label="&lt;b&gt;Fa&lt;\/b&gt;"[^>]*><i class="fa-solid fa-hammer wct-cs-fa" aria-hidden="true"><\/i>/);
  assert.match(tabs, new RegExp(`data-page="a\\.none"[^>]*><svg[^>]*><path d="${SM.GUEST_ICON.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"/>`));
  assert.doesNotMatch(tabs, /<b>Fa<\/b>/);
  assert.equal((tabs.match(/ guest"/g) ?? []).length, 3, "the three guest bookmarks are marked");
});

test("a guest page: our head, its body as is in its container, no system-sheet link", () => {
  const v = SM.sheetView({ name: "Ann", guests: [guest({ label: "Pro<fessions", hint: "a & b" })] }, { page: "guild.professions" });
  const html = SM.pageHTML(v, "<section class=\"g\">raw <em>markup</em></section>");
  assert.match(html, /<main class="wct-cs-page wct-cs-guestpage" data-page="guild\.professions" role="tabpanel" aria-label="Pro&lt;fessions">/);
  assert.match(html, /<h3 class="wct-cs-ttl">Pro&lt;fessions<\/h3><span class="wct-cs-dim">a &amp; b<\/span>/);
  assert.match(html, /<div class="wct-cs-guest" data-guest-page="guild\.professions"><section class="g">raw <em>markup<\/em><\/section><\/div>/);
  assert.doesNotMatch(html, /wctSystemSheet/);
  assert.doesNotMatch(SM.pageHTML(SM.sheetView({ guests: [guest({ hint: "" })] }, { page: "guild.professions" }), ""), /wct-cs-dim/, "no empty hint");
  // Built-in pages are unchanged.
  assert.match(SM.pageHTML(SM.sheetView({}, { page: "details" }), "<p>x</p>"), /data-action="wctSystemSheet" data-page="details"/);
  assert.match(SM.sheetHTML(v, "<p>g</p>"), /wct-cs-guestpage/);
});

test("guestErrorHTML is one escaped line", () => {
  const e = SM.guestErrorHTML("<P>", "bad <thing>");
  assert.equal(e, `<p class="wct-cs-dim wct-cs-guest-error" role="alert">The &lt;P&gt; page couldn't be drawn (bad &lt;thing&gt;). The other pages still work.</p>`);
});

// ---------------------------------------------------------------- registry and API object
test("api.sheet object: registerPage / unregisterPage / pages only; bad definitions refused without throwing", () => {
  assert.deepEqual(Object.keys(Sheet.PAGE_API).sort(), ["pages", "registerPage", "unregisterPage"]);
  assert.ok(Object.isFrozen(Sheet.PAGE_API));
  const warn = console.warn; const said = []; console.warn = (...a) => said.push(a.join(" "));
  try {
    const before = Sheet.PAGE_API.pages().map(p => p.id);
    assert.deepEqual(before, SM.PAGES.map(p => p.id), "built-ins in bookmark order");
    const bad = Sheet.PAGE_API.registerPage({ id: "no-dot", label: "x", render: () => "" });
    assert.equal(bad.ok, false); assert.equal(typeof bad.reason, "string"); assert.match(said.join("\n"), /refused/);
    assert.doesNotThrow(() => Sheet.PAGE_API.registerPage(null));
    const off = Sheet.PAGE_API.registerPage({ id: "guild.professions", label: "Professions", order: 85, render: () => "<p>x</p>", activate: () => {} });
    assert.equal(off.ok, true);
    const list = Sheet.PAGE_API.pages();
    assert.deepEqual(list.map(p => p.id).slice(-3), ["bastion", "guild.professions", "special"]);
    const g = list.find(p => p.id === "guild.professions");
    assert.deepEqual(g, { id: "guild.professions", label: "Professions", hint: "", icon: null, fa: null, order: 85, guest: true }, "no functions handed out");
    assert.equal(list.find(p => p.id === "character")?.guest, false);
    assert.equal(Sheet.PAGE_API.unregisterPage("guild.professions"), true);
    assert.equal(off(), false);
    assert.equal(Sheet.PAGE_API.unregisterPage("character"), false, "built-ins stay");
    assert.deepEqual(Sheet.PAGE_API.pages().map(p => p.id), before);
  } finally { console.warn = warn; }
});

test("guestBody: render gets { actor, mode, editable, root }; html, element and error results", async () => {
  const sheet = new Sheet.WctCharacterSheet();
  const actor = { name: "Ann" };
  Object.defineProperties(sheet, { actor: { value: actor }, isEditable: { value: false }, element: { value: null } });
  sheet._mode = "edit";
  let ctx;
  const off = Sheet.PAGE_API.registerPage({ id: "t.ok", label: "Ok", render: c => { ctx = c; return "<p>ok</p>"; } });
  const offEl = Sheet.PAGE_API.registerPage({ id: "t.el", label: "El", render: () => ({ nodeType: 1 }) });
  const offBad = Sheet.PAGE_API.registerPage({ id: "t.bad", label: "B<ad", render: () => { throw new Error("no <data>"); } });
  const warn = console.warn; console.warn = () => {};
  try {
    assert.deepEqual(await sheet.guestBody("t.ok"), { html: "<p>ok</p>", element: null });
    assert.deepEqual(Object.keys(ctx).sort(), ["actor", "editable", "mode", "root"]);
    assert.equal(ctx.actor, actor); assert.equal(ctx.mode, "play", "edit only when editable"); assert.equal(ctx.editable, false); assert.equal(ctx.root, null);
    assert.ok(Object.isFrozen(ctx));
    assert.deepEqual(await sheet.guestBody("t.el"), { html: "", element: { nodeType: 1 } });
    const bad = await sheet.guestBody("t.bad");
    assert.equal(bad.html, SM.guestErrorHTML("B<ad", "no <data>")); assert.equal(bad.element, null);
    assert.match((await sheet.guestBody("t.gone")).html, /no longer registered/);
  } finally { console.warn = warn; off(); offEl(); offBad(); }
});

// ---------------------------------------------------------------- wiring (source checks: Foundry-only paths)
test("main.mjs: api.sheet only with the sheet on; sheetReady fired after api is set, every client", () => {
  const m = src("scripts/main.mjs");
  assert.match(m, /get sheet\(\) \{ return F\.on\("characterSheet"\) \? Sheet\.PAGE_API : undefined; \}/);
  assert.match(m, /export const SHEET_READY_HOOK = `\$\{ID\}\.sheetReady`;/);
  const ready = m.slice(m.indexOf('Hooks.once("ready"'));
  const apiAt = ready.indexOf("mod.api = WCT"); const hookAt = ready.indexOf("Hooks.callAll(SHEET_READY_HOOK, WCT.sheet)");
  assert.ok(apiAt >= 0 && hookAt > apiAt, "hook after the API");
  assert.match(ready.slice(apiAt, hookAt + 60), /if \(F\.on\("characterSheet"\)\) \{ try \{ Hooks\.callAll\(SHEET_READY_HOOK, WCT\.sheet\); \}/);
  assert.doesNotMatch(ready.slice(apiAt, hookAt), /isActiveGM|moduleHooks/, "not GM-only, not behind Hooks for other modules");
});

test("sheet.mjs: guests rendered through core with a time limit, activated after render, their fields left alone, open sheets redrawn", () => {
  const s = src("scripts/sheet.mjs");
  assert.match(s, /renderGuest\(\/\*\* @type \{any\} \*\/ \(def\), this\.guestContext\(\), \{ timeoutMs: GUEST_RENDER_MS \}\)/);
  assert.match(s, /if \(SM\.isGuestPage\(this\._page\)\) this\._onRenderGuest\(root\);/);
  assert.match(s, /activateGuest\(/);
  assert.match(s, /if \(el\.closest\("\.wct-cs-guest"\)\) return;/);
  assert.match(s, /onChange: \(\) => rerenderOpenSheets\(\)/);
  assert.match(s, /guests: PAGE_HOST\.guests\(a\)\.map/);
  // Guests never get the sheet or a toolkit writer in their context.
  const ctx = s.slice(s.indexOf("guestContext() {"), s.indexOf("guestContext() {") + 300);
  assert.doesNotMatch(ctx, /sheet:|this,|Vault|api/);
});

// ---------------------------------------------------------------- core 0.6.0 and the release
test("core 0.6.0 vendored; heirloom tooltip colour; version, changelog, docs", () => {
  const lock = JSON.parse(src("wanderers-core.lock.json"));
  assert.equal(lock.version, "0.6.0");
  const m = JSON.parse(src("module.json"));
  assert.match(m.version, /^2\.([3-9]|\d\d)\.\d+$/);
  assert.equal(m.download, `https://github.com/cocoomg11/wayfarers-toolkit/releases/download/v${m.version}/module.zip`);
  assert.equal(PM.qualityKey({ color: "#00CCFF" }), "heirloom");
  assert.equal(PM.qualityKey({ color: "#e6cc80" }), "artifact");
  const cl = src("CHANGELOG.md");
  assert.match(cl, /## 2\.3\.0\n\n2026-11-06\.[\s\S]*?\*\*Untested in Foundry\*\*/);
  const doc = src("docs/scripting.md");
  for (const k of ["registerPage", "unregisterPage", "wayfarers-toolkit.sheetReady", "api.sheet"]) assert.ok(doc.includes(k), k);
  assert.match(doc, /`sheet` \(2\.3[^|]*\| experimental/s);
  assert.match(src("CLAUDE.md"), /## 2\.3 notes: Sheet pages for other modules/);
});
