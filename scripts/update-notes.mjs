/**
 * Update notes: what changed in each version, in plain words, and what a GM may need to do after updating. The active GM gets these
 * as one whispered chat card the first time the world loads a newer version (updates.mjs posts it). This file has no Foundry calls
 * at import time and is tested in Node.
 *
 * An entry: { version, changes: [text | { text, feature }], actions: [action] }. An action: { id, label, icon, feature?, hint?,
 * check(ctx) → true while it still needs doing, run(ctx) }. `ctx` is { api, on, importFlights } (the module API, the feature check and
 * the flight import flow), so
 * check and run only touch Foundry when they're called. Actions and lines with a `feature` are left out while that feature is off.
 * To add a version: add an entry at the top. A version with nothing worth saying needs no entry (patch updates without one post nothing).
 */

/** Offered after any update while it's still needed. */
export const ALWAYS_ACTIONS = [
  {
    id: "setup", label: "Run setup", icon: "fa-solid fa-hammer",
    hint: "Adds what the tools turned on still need (tracker journal, party actor, macros in the Wayfarer's Toolkit macro folder). Never overwrites anything and never touches a hotbar.",
    check: ({ api }) => api.setupPlan().some(p => !p.ok),
    run: ({ api }) => api.setup()
  }
];

export const NOTES = [
  {
    version: "1.18.0",
    changes: [
      "Custom token ring (a new tool, off until you switch it on in the Features tab): pick your own ring image and Foundry's dynamic token rings use it. NPC tokens (or every token) get the ring as they're placed; token art and portraits aren't changed.",
      { feature: "tokenRing", text: "Apply ring to existing tokens (control panel › Tokens) rings the prototype tokens of matching actors and the tokens already on your scenes; Remove the toolkit's ring puts them back." }
    ],
    actions: [
      {
        id: "ringApply", feature: "tokenRing", label: "Apply ring to existing tokens", icon: "fa-solid fa-circle-notch",
        hint: "Turns the custom ring on for matching actors' prototype tokens and the tokens already placed. Only the ring setting changes, not the art.",
        check: ({ api }) => { const p = api.ring?.plan?.(); return !!(api.ring?.status?.().image && p && (p.actors || p.tokens)); },
        run: ({ api }) => api.ring?.applyAll()
      }
    ]
  },
  {
    version: "1.17.0",
    changes: [
      "Update notes in chat: after an update, the GM gets one whispered card saying what changed since the version this world last ran, with a button for anything that needs doing. Buttons that are already done show as done.",
      "The card replaces the old once-per-version Run setup reminder.",
      "Switch it off with Show update notes after updating on the control panel's Overview tab; Show update notes there brings it back any time."
    ]
  },
  {
    version: "1.16.0",
    changes: [
      { feature: "flightMaster", text: "Flight network editor: flight points and routes are set up in a window (control panel › Travel › Flight network…), with fares, hours, two-way and free routes, and problems shown before you save." },
      { feature: "flightMaster", text: "Flight points don't need a scene: the party still flies, pays and lands there; the GM is told to move the party." },
      { feature: "flightMaster", text: "Free flights: the GM can fly the party without charging a fare, and a route can be marked free for everyone." },
      { feature: "flightMaster", text: "The old Flight Routes journal page is no longer read. Import it once into the new flight network." }
    ],
    actions: [
      {
        id: "flightImport", feature: "flightMaster", label: "Import flight network from the old Flight Routes page", icon: "fa-solid fa-feather-pointed",
        hint: "Copies the old page's flight points and routes into the flight network (asks first). The page isn't changed.",
        check: ({ api }) => !!api.canImportLegacyFlights(),
        run: ({ importFlights }) => importFlights()
      }
    ]
  },
  {
    version: "1.15.0",
    changes: [
      "Control panel: every setting in one window with tabs (Overview, Features, Travel, Loot, Boss & Combat, Quests). Open it from the module settings.",
      "The Overview tab says what needs attention, with a fix-it button for each problem.",
      "Pickers and tables in place of typed values (encounter zones, hidden scenes, compendiums). Nothing you set before was lost.",
      "A welcome wizard for new worlds."
    ]
  },
  {
    version: "1.14.4",
    changes: ["Toolkit windows no longer slow the game down while they're open."]
  },
  {
    version: "1.14.3",
    changes: ["Run setup no longer puts macros on any hotbar. Drag them from the Wayfarer's Toolkit macro folder or compendium."]
  },
  {
    version: "1.14.1",
    changes: [{ feature: "vendorTrash", text: "Add your own loot: items you give an NPC show in its body's loot, and an NPC can be marked Everything is lootable." }]
  },
  {
    version: "1.14.0",
    changes: [
      "Party size setting: boss loot coin and draws scale with it.",
      { feature: "lootRolls", text: "Loot rolls: the GM can assign an item, and the winner gets a whisper." },
      "Remove toolkit data, for cleaning the toolkit out of a world.",
      "Clearer error messages and a debug logging setting."
    ]
  },
  {
    version: "1.13.0",
    changes: [
      "With several GMs online, only one runs the automatic steps.",
      "Health check: a report of anything missing or misconfigured.",
      "No loot switch for creatures that shouldn't drop anything.",
      { feature: "flightMaster", text: "Flight Master shows the fare for everyone, the purse and the hours before you confirm." }
    ]
  }
];

// ---------------------------------------------------------------- versions
/** "1.16.0" → [1, 16, 0]; null when it isn't a version. A "v" prefix and a "-beta"-style suffix are ignored. */
export function parseVersion(v) {
  const m = /^v?(\d+(?:\.\d+)*)/.exec(String(v ?? "").trim());
  return m ? m[1].split(".").map(Number) : null;
}
/** -1, 0 or 1. Missing parts count as 0 (1.16 = 1.16.0). Unreadable versions sort before every real one. */
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return !x && !y ? 0 : !x ? -1 : 1;
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}

// ---------------------------------------------------------------- what to do on ready
/**
 * Decides what the ready hook does: { kind, from }. kinds: "fresh" (a new world: store the version, say nothing; the welcome wizard
 * covers it), "upgrade" (post notes from `from`, exclusive; null = an unknown older version), "same" (nothing), "downgrade" (store
 * the running version silently, so updating again shows the notes again).
 * `stored` is lastSeenVersion; `setupReminded` the version the pre-1.17 setup reminder last ran for; `wizardDone` the wizard flag.
 */
export function decide({ stored = "", current = "", wizardDone = false, setupReminded = "" } = {}) {
  if (!parseVersion(current)) return { kind: "same", from: null };
  if (parseVersion(stored)) {
    const c = compareVersions(current, stored);
    return c > 0 ? { kind: "upgrade", from: stored } : c < 0 ? { kind: "downgrade", from: stored } : { kind: "same", from: stored };
  }
  // No stored version: an earlier version that kept no record (before 1.17), or a new world.
  if (parseVersion(setupReminded)) {
    return compareVersions(current, setupReminded) > 0 ? { kind: "upgrade", from: setupReminded } : { kind: "same", from: setupReminded };
  }
  if (wizardDone) return { kind: "upgrade", from: null };
  return { kind: "fresh", from: null };
}

/** The entries newer than `from` (exclusive; null = all) up to `to` (inclusive), newest first. */
export function entriesBetween(notes = NOTES, from = null, to = null) {
  return notes.filter(n => (from == null || compareVersions(n.version, from) > 0) && (to == null || compareVersions(n.version, to) <= 0))
    .sort((a, b) => compareVersions(b.version, a.version));
}

const lineText = l => typeof l === "string" ? l : l?.text ?? "";
const allowed = (x, on) => !x?.feature || on(x.feature);

/**
 * Builds the notice: { from, to, entries: [{ version, changes: [text] }], actions: [action], post }. Lines and actions for features
 * that are off are dropped, actions are deduped by id (the newest entry's wins, then ALWAYS_ACTIONS), and an action whose check says
 * it's done (or throws) is left out. `post` is false when there's nothing to say. `check` is called with `ctx`.
 */
export async function build({ notes = NOTES, always = ALWAYS_ACTIONS, from = null, to, on = () => true, ctx = {} } = {}) {
  const ctxOn = { on, ...ctx };
  const entries = entriesBetween(notes, from, to).map(n => ({ version: n.version, changes: (n.changes ?? []).filter(l => allowed(l, on)).map(lineText).filter(Boolean), actions: (n.actions ?? []).filter(a => allowed(a, on)) }));
  const seen = new Set(); const candidates = [];
  for (const a of [...entries.flatMap(e => e.actions), ...always.filter(a => allowed(a, on))]) { if (!seen.has(a.id)) { seen.add(a.id); candidates.push(a); } }
  const actions = [];
  for (const a of candidates) { let need = false; try { need = !!(await a.check?.(ctxOn)); } catch { need = false; } if (need) actions.push(a); }
  const shown = entries.filter(e => e.changes.length).map(({ version, changes }) => ({ version, changes }));
  return { from, to, entries: shown, actions, post: shown.length > 0 || actions.length > 0 };
}

/** For a manual re-show without a version: the newest entry older than `to`, so only `to`'s own notes show. */
export function previousVersion(notes = NOTES, to) {
  return notes.map(n => n.version).filter(v => compareVersions(v, to) < 0).sort((a, b) => compareVersions(b, a))[0] ?? null;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The chat card's HTML. The newest version is open; older ones are collapsed. Buttons carry data-wct-update="<action id>". */
export function cardHTML(notice) {
  const { from, to, entries, actions } = notice;
  const range = from ? `${esc(from)} → ${esc(to)}` : `${esc(to)} (from an earlier version)`;
  const list = e => `<ul>${e.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`;
  const body = entries.map((e, i) => i === 0 ? `<h4>What's new in ${esc(e.version)}</h4>${list(e)}` : `<details><summary>${esc(e.version)}</summary>${list(e)}</details>`).join("");
  const todo = actions.length ? `<h4>To do</h4><ul class="wct-update-actions">${actions.map(a => `<li><button type="button" data-wct-update="${esc(a.id)}"><i class="${esc(a.icon ?? "fa-solid fa-check")}"></i> ${esc(a.label)}</button>${a.hint ? `<p class="hint">${esc(a.hint)}</p>` : ""}</li>`).join("")}</ul>` : `<p>Nothing needs doing.</p>`;
  return `<div class="wct-update"><h3>Wayfarer's Toolkit updated: ${range}</h3>${body}${todo}<p><a data-wct-update="panel"><i class="fa-solid fa-toolbox"></i> Open the control panel</a></p></div>`;
}
