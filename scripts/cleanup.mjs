/**
 * Remove toolkit data: a settings-menu window (GM only) that strips what the toolkit stored in a world. It first counts (a dry run),
 * lets the GM tick what goes, then asks to type REMOVE. Only the toolkit's own data is touched: `flags.wayfarers-toolkit` on
 * documents (chat messages only when ticked), items the toolkit created (vendor trash and boss loot, when ticked), the Rested status
 * effect, map pins (Note documents with flags.wayfarers-toolkit.pin, and hidden pins in the GM-only store, when ticked), the GM-only
 * records journal (when ticked, with its flags vaultEntry, vault and dataFolderFiled, through core's store remove(), which also deletes
 * the shared "Module data" folder when it is empty), Hex Travel's trip counter (flags.world.trackers on the tracker journal), macros Run setup made (when ticked) and the module's
 * settings (when ticked). Other flags, items and documents are never changed. It doesn't need to be the active GM.
 */
import { isToolkitFolderName } from "./macros.mjs";
import { pinsByScene } from "./pins-model.mjs";
import { hasFlags, confirmed, CONFIRM_WORD, UI_CLASSES } from "../vendor/wanderers-core/index.mjs";
import { card } from "./look-model.mjs";
const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ours = doc => hasFlags(doc, ID);
/** Items the toolkit created on a body or the party: vendor trash and boss loot. */
export const toolkitItem = i => !!(i?.flags?.[ID]?.trash || i?.flags?.[ID]?.bossLoot);
/** The Rested status effect Rent rooms adds when "Rested token status" is on (an active effect, not a flag). */
export const RESTED_STATUS = "wct-rested";
export const restedEffect = e => !!(e?.statuses?.has?.(RESTED_STATUS) || (Array.isArray(e?.statuses) && e.statuses.includes(RESTED_STATUS)));
/** Hex Travel's trip counter lives in flags.world.trackers on the tracker journal (kept there since the library version). */
export const trackerFlag = (j, journalName) => !!(j && journalName && j.name === journalName && j.flags?.world?.trackers && typeof j.flags.world.trackers === "object");
/** The flags on the GM-only records journal (vault.mjs): its marker, its data, and core's one-time "filed in Module data" mark. */
export const VAULT_FLAGS = ["vaultEntry", "vault", "dataFolderFiled"];
export const CATEGORIES = [
  ["actors", "Toolkit flags on actors (boss loot links, phase marks, No loot, Everything is lootable, weapon sets, Rested and its status icon, …)"],
  ["tokens", "Toolkit flags on tokens and their own actors, every scene (pre-rolled loot, looted, boss, phase marks, No loot, Everything is lootable, …)"],
  ["scenes", "Toolkit flags on scenes (Dungeon, Title card, inns; the old Hub and Inn marks too, which the Red Book module may still read)"],
  ["items", "Toolkit flags on items (world items and items on actors; Lootable, Buckler and Relic marks too, the items themselves stay)"],
  ["deleteItems", "Also delete items created by the toolkit (vendor trash, boss loot) wherever they are"],
  ["pins", "Delete map pins (the map notes the toolkit's Map pins tool placed, every scene, party and GM pins)"],
  ["journals", "Toolkit flags on journals and roll tables (flags only; quests stop being quests; the tracker journal's trip counter)"],
  ["vault", "Delete the GM-only records journal (the full flight network, hidden map pins, quest GM text, room rentals, gold snapshots, loot history; the shared Module data folder too when nothing else is in it)"],
  ["messages", "Toolkit flags on chat messages (loot, loot roll, quest, health and update cards; their buttons stop working)"],
  ["macros", "World macros created by Run setup (or imported from the toolkit's macro compendium)"],
  ["settings", "Reset the module's settings to their defaults (feature toggles and the loot roll history too; reloads)"]
];

/** Every actor whose items can hold toolkit items: world actors and unlinked tokens' own actors. */
function* holders() {
  for (const a of game.actors) yield a;
  for (const s of game.scenes) for (const t of s.tokens) if (!t.actorLink && t.actor) yield t.actor;
}

/** Counts what each category would remove. Nothing is changed. */
export function plan() {
  /** @type {Record<string, any>} */
  const p = { actors: [], effects: [], tokens: [], tokenActors: [], scenes: [], pins: [], hiddenPins: 0, items: [], deleteItems: [], journals: [], vault: [], trackers: [], messages: [], macros: [], settings: [] };
  for (const a of game.actors) if (ours(a)) p.actors.push(a);
  // Map pins: Note documents carrying flags.wayfarers-toolkit.pin; grouped by scene so each scene is one delete.
  p.pins = pinsByScene(game.scenes);
  // Hidden GM pins have no Note: they're records in the GM-only store (removed with it, or on their own with "pins").
  try { p.hiddenPins = Object.keys(game.journal.find(j => j.flags?.[ID]?.vaultEntry === true)?.flags?.[ID]?.vault?.buckets?.pins ?? {}).length; } catch { p.hiddenPins = 0; }
  for (const s of game.scenes) {
    if (ours(s)) p.scenes.push(s);
    for (const t of s.tokens) {
      if (ours(t)) p.tokens.push(t);
      if (!t.actorLink && t.actor && t.delta?._source?.flags?.[ID] && Object.keys(t.delta._source.flags[ID]).length) p.tokenActors.push(t.actor);
    }
  }
  for (const i of game.items) { if (toolkitItem(i)) p.deleteItems.push(i); else if (ours(i)) p.items.push(i); }
  for (const a of holders()) {
    // An unlinked token's actor also shows its world actor's items; only the token's own (delta) items are counted for it.
    const own = a.isToken ? new Set((a.token?.delta?._source?.items ?? []).map(i => i._id)) : null;
    for (const i of a.items) { if (own && !own.has(i.id)) continue; if (toolkitItem(i)) p.deleteItems.push(i); else if (ours(i)) p.items.push(i); }
    const ownFx = a.isToken ? new Set((a.token?.delta?._source?.effects ?? []).map(e => e._id)) : null;
    for (const e of a.effects ?? []) { if (ownFx && !ownFx.has(e.id)) continue; if (restedEffect(e)) p.effects.push(e); }
  }
  for (const j of game.journal) {
    if (j.flags?.[ID]?.vaultEntry === true) { p.vault.push(j); continue; }
    if (ours(j)) p.journals.push(j); for (const pg of j.pages) if (ours(pg)) p.journals.push(pg);
  }
  for (const t of game.tables) if (ours(t)) p.journals.push(t);
  let tj = ""; try { tj = game.settings.get(ID, "trackerJournal"); } catch { }
  for (const j of game.journal) if (trackerFlag(j, tj)) p.trackers.push(j);
  for (const m of game.messages ?? []) if (ours(m)) p.messages.push(m);
  for (const m of game.macros) if (m.flags?.[ID]?.macro) p.macros.push(m);
  for (const [, c] of game.settings.settings) if (c.namespace === ID && (c.scope === "world" ? game.user.isGM : true)) p.settings.push(c);
  return p;
}
const count = (p, k) => k === "pins" ? p.pins.reduce((n, g) => n + g.ids.length, 0) + p.hiddenPins : k === "tokens" ? p.tokens.length + p.tokenActors.length : k === "actors" ? p.actors.length + p.effects.length : k === "journals" ? p.journals.length + p.trackers.length : p[k].length;

/** Removes every toolkit flag from one document, key by key (unsetFlag writes the deletion the way this Foundry version wants). */
async function stripFlags(doc) {
  const keys = Object.keys(doc?._source?.flags?.[ID] ?? doc?.flags?.[ID] ?? {});
  for (const k of keys) await doc.unsetFlag(ID, k);
  return keys.length ? 1 : 0;
}
async function stripDelta(actor) {
  const keys = Object.keys(actor?.token?.delta?._source?.flags?.[ID] ?? {});
  for (const k of keys) await actor.unsetFlag(ID, k);
  return keys.length ? 1 : 0;
}

/** Carries out the ticked categories. Returns { [category]: number removed }. */
export async function remove(pick = {}) {
  if (!game.user.isGM) { ui.notifications.warn("GM only."); return null; }
  const p = plan(); const done = {};
  const each = async (list, fn) => { let n = 0; for (const d of list) { try { n += (await fn(d)) ?? 1; } catch (e) { console.warn(`${ID} | remove data: ${d?.name ?? d?.id}`, e); } } return n; };
  if (pick.deleteItems) {
    const byParent = new Map(); const world = [];
    for (const i of p.deleteItems) { if (i.parent) { if (!byParent.has(i.parent)) byParent.set(i.parent, []); byParent.get(i.parent).push(i.id); } else world.push(i.id); }
    let n = 0;
    for (const [a, ids] of byParent) { try { await a.deleteEmbeddedDocuments("Item", ids); n += ids.length; } catch (e) { console.warn(`${ID} | remove data: items on ${a.name}`, e); } }
    if (world.length) { try { await Item.deleteDocuments(world); n += world.length; } catch (e) { console.warn(`${ID} | remove data: world items`, e); } }
    done.deleteItems = n;
  }
  if (pick.items) done.items = await each(pick.deleteItems ? p.items : [...p.items, ...p.deleteItems], stripFlags);
  if (pick.actors) done.actors = (await each(p.actors, stripFlags)) + (await each(p.effects, async e => { await e.delete(); return 1; }));
  if (pick.tokens) done.tokens = (await each(p.tokens, stripFlags)) + (await each(p.tokenActors, stripDelta));
  if (pick.scenes) done.scenes = await each(p.scenes, stripFlags);
  if (pick.pins) {
    done.pins = await each(p.pins, async g => { await g.scene.deleteEmbeddedDocuments("Note", g.ids); return g.ids.length; });
    if (p.hiddenPins && !pick.vault) { try { await (await import("./vault.mjs")).set("pins", {}); done.pins += p.hiddenPins; } catch (e) { console.warn(`${ID} | remove data: hidden pins`, e); } }
  }
  // Core's store removes every copy of the entry and the shared "Module data" folder when nothing else is left in it.
  if (pick.vault && p.vault.length) { try { done.vault = await (await import("./vault.mjs")).remove(); } catch (e) { console.warn(`${ID} | remove data: GM-only records`, e); done.vault = 0; } }
  if (pick.journals) done.journals = (await each(p.journals, stripFlags)) + (await each(p.trackers, async j => { await j.unsetFlag("world", "trackers"); return 1; }));
  if (pick.messages) done.messages = await each(p.messages, stripFlags);
  if (pick.macros && p.macros.length) {
    const folders = new Set(p.macros.map(m => m.folder).filter(Boolean));
    try { await Macro.deleteDocuments(p.macros.map(m => m.id)); done.macros = p.macros.length; } catch (e) { console.warn(`${ID} | remove data: macros`, e); done.macros = 0; }
    // The setup folder goes too once it's empty.
    for (const f of folders) if (isToolkitFolderName(f.name) && !f.contents?.length && !f.children?.length) { try { await f.delete(); } catch { } }
  }
  if (pick.settings) {
    let n = 0;
    // Core's character-sheet key, if the sheet moved it (Alt+C, or 1.33.0's Shift+C) on this client: back to its default before the record is reset.
    try { await (await import("./sheet.mjs")).restoreCoreKey(); } catch (e) { console.warn(`${ID} | remove data: core sheet key`, e); }
    for (const c of p.settings) { try { const cur = game.settings.get(ID, c.key); const def = foundry.utils.deepClone(c.default); if (JSON.stringify(cur) !== JSON.stringify(def)) { await game.settings.set(ID, c.key, def); n++; } } catch (e) { console.warn(`${ID} | remove data: setting ${c.key}`, e); } }
    done.settings = n;
  }
  return done;
}

export class CleanupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-cleanup`, classes: ["wct-cleanup", "wct-window", ...UI_CLASSES], tag: "form", form: { closeOnSubmit: false }, window: { title: "Wanderer's Toolkit · Remove toolkit data", icon: "fa-solid fa-broom", resizable: true }, position: { width: 560, height: "auto" } };
  async _renderHTML() {
    const div = document.createElement("div");
    if (!game.user.isGM) { div.textContent = "GM only."; return div; }
    const p = plan();
    div.innerHTML = `<p>Removes what Wanderer's Toolkit stored in this world. Counts below are what would go now; nothing is changed until you confirm. Your own documents, other modules' data and items the toolkit didn't create are never touched. Item Piles piles stay piles (revert them with Reset loot first if you want normal tokens back).</p>
      ${CATEGORIES.map(([k, label]) => `<div class="form-group"><label><input type="checkbox" name="${k}" ${["deleteItems", "pins", "vault", "messages", "macros", "settings"].includes(k) ? "" : "checked"}> ${esc(label)}</label><span class="hint" style="margin-left:auto;">${count(p, k)}</span></div>`).join("")}
      <div class="form-group"><label for="wct-cleanup-confirm">Type <strong>${CONFIRM_WORD}</strong> to confirm</label><div class="form-fields"><input type="text" id="wct-cleanup-confirm" name="confirm" autocomplete="off"></div></div>
      <footer class="form-footer"><button type="button" data-action="cancel"><i class="fa-solid fa-xmark"></i> Cancel</button><button type="submit" data-action="remove"><i class="fa-solid fa-broom"></i> Remove</button></footer>`;
    return div;
  }
  _replaceHTML(result, content) {
    content.replaceChildren(result);
    const form = this.element;
    const cancel = form.querySelector("[data-action=cancel]"); if (cancel) cancel.onclick = ev => { ev.preventDefault(); this.close(); };
    form.onsubmit = async ev => {
      ev.preventDefault();
      if (!confirmed(form.elements.confirm?.value)) return ui.notifications.warn("Remove toolkit data: type REMOVE to confirm.");
      const pick = Object.fromEntries(CATEGORIES.map(([k]) => [k, !!form.elements[k]?.checked]));
      if (!Object.values(pick).some(Boolean)) return ui.notifications.info("Remove toolkit data: nothing ticked.");
      form.querySelector("[data-action=remove]").disabled = true;
      const done = await remove(pick);
      await this.close();
      if (!done) return;
      const label = Object.fromEntries(CATEGORIES);
      const lines = Object.entries(done).map(([k, n]) => `${label[k].replace(/ \(.*\)$/, "")}: ${n}`);
      const text = lines.length ? lines.join("; ") : "nothing";
      ui.notifications.info(`Wanderer's Toolkit data removed: ${text}.`);
      await ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Wanderer's Toolkit" }, content: card(`<h3>Toolkit data removed</h3><ul>${lines.map(l => `<li>${esc(l)}</li>`).join("") || "<li>nothing</li>"}</ul>`) });
      if (pick.settings && done.settings) foundry.applications?.settings?.SettingsConfig?.reloadConfirm?.({ world: true });
    };
  }
}
