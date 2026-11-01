import "./_globals.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** Rules `selector { body }` (no nesting except @container/@media, which are flattened by ignoring their wrappers). */
const rules = css => [...strip(css).matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));

// In-world roots: dark (or parchment) surfaces that must look the same in both themes. Foundry sets text colours per theme on
// dl dd, dt, label, h1-h6, a and form controls, so each root needs a rule that sets them explicitly.
const ROOTS = [
  { file: "styles/pane.css", root: ".wct-pane .wct-frame", also: ["button", "input", "select", "textarea"] },
  { file: "styles/pane.css", root: ".wct-tip", also: [] },
  { file: "styles/quests.css", root: ".wct-quests .wctq-list", also: ["button", "input", "select", "textarea"] },
  { file: "styles/quests.css", root: ".wct-quests .wctq-detail", also: ["button", "input", "select", "textarea"] },
  { file: "styles/quests.css", root: "#wct-quest-tracker", also: ["button", "input"] },
  { file: "styles/bosses.css", root: ".wct-boss", also: ["button"] }
];
const TEXT = ["a", "dd", "dt", "label", "h1", "h3", "h6", "p", "li", "td", "th"];

for (const { file, root, also } of ROOTS) {
  test(`in-world root ${root}: sets a text colour on the elements Foundry colours per theme`, () => {
    const css = src(file);
    const base = rules(css).filter(r => r.sel.startsWith(`${root} :where(`) && /(^|[\s;])color:/.test(r.body));
    assert.ok(base.length, `${root} needs a ":where(...) { color }" rule`);
    const listed = base.map(r => r.sel).join(" ");
    for (const el of [...TEXT, ...also]) assert.match(listed, new RegExp(`[(,\\s]${el}[,)]`), `${root} covers <${el}>`);
    for (const r of base) assert.doesNotMatch(r.body, /!important/);
    assert.ok(css.indexOf(`${root} :where(`) < css.lastIndexOf(`${root} `), "baseline comes first so component rules win ties");
  });
}

test("character pane: every stat value (dd) sets its own colour on the dark sheet", () => {
  const dd = rules(src("styles/pane.css")).find(r => r.sel === ".wct-pane .wct-box dd");
  assert.ok(dd);
  assert.match(dd.body, /color: var\(--wc-text\)/);
  const frame = rules(src("styles/pane.css")).find(r => r.sel === ".wct-pane .wct-frame");
  assert.match(frame.body, /--wc-text: #/); assert.match(frame.body, /color: var\(--wc-text\)/);
});

test("in-world roots define their colour tokens; none uses theme selectors outside the old backdrop rule", () => {
  assert.match(src("styles/quests.css"), /#wct-quest-tracker \{[^}]*--wc-text: #/);
  assert.match(src("styles/bosses.css"), /#wct-boss-frames \{[^}]*--wc-text: #/);
  assert.match(src("styles/quests.css"), /\.application\.wct-quests \{[^}]*--wctq-text: #[^}]*--wctq-ink: #/);
  for (const f of ["quests", "bosses", "panel", "loot", "pins", "places"]) assert.doesNotMatch(src(`styles/${f}.css`), /theme-(dark|light)/, f);
  const pane = strip(src("styles/pane.css"));
  assert.equal([...pane.matchAll(/theme-(dark|light)/g)].length, 4, "only the backdrop-blur rule names themes");
});

test("theme-following windows (panel, flight map and editor, gold, coin log, history, inns, trash, pins, chat cards) hard-code no text colour", () => {
  for (const f of ["styles/panel.css", "styles/pins.css", "styles/loot.css"]) {
    for (const r of rules(src(f))) {
      for (const m of r.body.matchAll(/(?:^|[\s;])(color|fill):\s*([^;]+)/g)) {
        assert.match(m[2].trim(), /^(var\(|inherit|currentColor|none|transparent)/, `${f}: "${r.sel}" sets ${m[1]}: ${m[2]}`);
      }
    }
  }
});
