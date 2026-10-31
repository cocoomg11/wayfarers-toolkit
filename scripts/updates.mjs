/**
 * The post-update notice: the first time a world loads a newer version, the active GM whispers the GMs one chat card with what
 * changed since the version this world last ran and a button for each thing still to do (update-notes.mjs has the notes and the
 * pure logic). The last version seen is the hidden world setting lastSeenVersion. Replaces the pre-1.17 setup reminder, whose
 * setupReminded setting is only read, to tell an upgraded world from a new one.
 */
import * as F from "./features.mjs";
import * as N from "./update-notes.mjs";
import * as FlightEditor from "./flight-editor.mjs";
import { isActiveGM } from "./gm.mjs";
import { MACRO_HINT } from "./macros.mjs";

const ID = "wayfarers-toolkit";
let API = null;
const get = key => { try { return game.settings.get(ID, key); } catch { return undefined; } };
const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id);
const ctx = () => ({ api: API, on: F.on, importFlights: () => FlightEditor.importFlow(API) });
const allActions = () => [...N.NOTES.flatMap(n => n.actions ?? []), ...N.ALWAYS_ACTIONS];
const actionById = id => allActions().find(a => a.id === id);

export function registerSettings() {
  game.settings.register(ID, "lastSeenVersion", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(ID, "updateNotes", { name: "Show update notes after updating", hint: "After the module is updated, the GM gets a whispered chat card saying what changed and what needs doing.", scope: "world", config: false, type: Boolean, default: true });
}

/** Builds the notice from `from` (exclusive; null = every entry) to the running version. */
export function build(from = null) {
  return N.build({ from, to: API.version ?? "", on: F.on, ctx: ctx() });
}

/** Whispers the card to the GMs. Returns the message. */
export function post(notice) {
  return ChatMessage.create({
    content: N.cardHTML(notice), whisper: gmIds(), speaker: { alias: "Wayfarer's Toolkit" },
    flags: { [ID]: { updateNotes: { from: notice.from, to: notice.to, actions: notice.actions.map(a => a.id), done: [] } } }
  });
}

/**
 * Ready, active GM only (after the welcome wizard decided). New worlds and downgrades store the version silently; an upgrade posts
 * the card when there's something to say (and the setting is on), then stores the version.
 */
export async function onReady(api) {
  API = api;
  if (!isActiveGM()) return;
  const current = api.version ?? "";
  const d = N.decide({ stored: get("lastSeenVersion") ?? "", current, wizardDone: !!get("wizardDone"), setupReminded: get("setupReminded") ?? "" });
  if (d.kind === "same") { if (get("lastSeenVersion") !== current) await game.settings.set(ID, "lastSeenVersion", current); return; }
  if (d.kind === "upgrade" && get("updateNotes") !== false) {
    const notice = await build(d.from);
    if (notice.post) await post(notice);
  }
  await game.settings.set(ID, "lastSeenVersion", current);
}

/** api.updateNotes.show(fromVersion?): posts the card again. Without a version, only the running version's own notes. */
export async function show(fromVersion) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const to = API.version ?? "";
  const notice = await build(fromVersion ?? N.previousVersion(N.NOTES, to));
  if (!notice.post) return ui.notifications.info(`Wayfarer's Toolkit: no update notes for ${to}.`);
  return post(notice);
}

function markDone(btn) {
  btn.disabled = true; btn.classList.add("done");
  btn.innerHTML = `<i class="fa-solid fa-check"></i> ${btn.textContent.trim()} (done)`;
}

async function runAction(message, id, btn) {
  if (id === "panel") return API.panel();
  const a = actionById(id); if (!a) return;
  btn.disabled = true;
  try {
    const r = await a.run(ctx());
    if (id === "setup") ui.notifications.info(`Wayfarer's Toolkit: ${r?.length ? "created " + r.join(", ") : "everything already exists"}. ${MACRO_HINT}`);
  } catch (e) { ui.notifications.error(`Wayfarer's Toolkit: ${e.message}`); }
  let still = true; try { still = !!(await a.check(ctx())); } catch { }
  if (still) { btn.disabled = false; return; }
  markDone(btn);
  const f = message.getFlag(ID, "updateNotes");
  if (f && !f.done?.includes(id) && message.canUserModify?.(game.user, "update") !== false) {
    try { await message.setFlag(ID, "updateNotes", { ...f, done: [...(f.done ?? []), id] }); } catch { }
  }
}

/** Called from init: the card's buttons (after reload too), GM only; done ones disabled. */
export function init(api) {
  API = api;
  Hooks.on("renderChatMessageHTML", (message, el) => {
    const f = message.flags?.[ID]?.updateNotes; if (!f) return;
    const root = el instanceof HTMLElement ? el : el?.[0]; if (!root) return;
    const buttons = [...root.querySelectorAll("[data-wct-update]")];
    if (!game.user.isGM) { buttons.forEach(b => b.closest("li")?.remove() ?? b.remove()); return; }
    for (const b of buttons) {
      const id = b.dataset.wctUpdate;
      if (id !== "panel" && f.done?.includes(id)) { markDone(b); continue; }
      // Done somewhere else since the card was posted (the control panel, a macro): show it as done.
      const a = actionById(id);
      if (a && id !== "panel") Promise.resolve().then(() => a.check(ctx())).then(need => { if (!need) markDone(b); }).catch(() => { });
    }
    root.addEventListener("click", ev => {
      const b = ev.target.closest("[data-wct-update]"); if (!b || b.disabled) return;
      ev.preventDefault(); runAction(message, b.dataset.wctUpdate, b);
    });
  });
}

/** For the health check: { on, lastSeen }. */
export const status = () => ({ on: get("updateNotes") !== false, lastSeen: get("lastSeenVersion") ?? "" });
