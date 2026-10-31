/**
 * Remove toolkit data: a settings-menu window (GM only) that strips what the toolkit stored in a world. It first counts (a dry run),
 * lets the GM tick what goes, then asks to type REMOVE. Only the toolkit's own data is touched: `flags.wayfarers-toolkit` on
 * documents, items the toolkit created (vendor trash and boss loot, when ticked), macros Run setup made (when ticked) and the module's
 * settings (when ticked). Other flags, items and documents are never changed. It doesn't need to be the active GM.
 */
const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ours = doc => { const f = doc?._source?.flags?.[ID] ?? doc?.flags?.[ID]; return !!(f && typeof f === "object" && Object.keys(f).length); };
/** Items the toolkit created on a body or the party: vendor trash and boss loot. */
export const toolkitItem = i => !!(i?.flags?.[ID]?.trash || i?.flags?.[ID]?.bossLoot);
export const CATEGORIES = [
  ["actors", "Toolkit flags on actors (boss loot links, No loot, Everything is lootable, weapon sets, …)"],
  ["tokens", "Toolkit flags on tokens and their own actors, every scene (pre-rolled loot, looted, boss, No loot, Everything is lootable, …)"],
  ["scenes", "Toolkit flags on scenes (Dungeon)"],
  ["items", "Toolkit flags on items (world items and items on actors; Lootable, Buckler and Relic marks too, the items themselves stay)"],
  ["deleteItems", "Also delete items created by the toolkit (vendor trash, boss loot) wherever they are"],
  ["journals", "Toolkit flags on journals and roll tables (flags only; quests stop being quests)"],
  ["macros", "World macros created by Run setup (or imported from the toolkit's macro compendium)"],
  ["settings", "Reset the module's settings to their defaults (feature toggles too; reloads)"]
];

/** Every actor whose items can hold toolkit items: world actors and unlinked tokens' own actors. */
function* holders() {
  for (const a of game.actors) yield a;
  for (const s of game.scenes) for (const t of s.tokens) if (!t.actorLink && t.actor) yield t.actor;
}

/** Counts what each category would remove. Nothing is changed. */
export function plan() {
  const p = { actors: [], tokens: [], tokenActors: [], scenes: [], items: [], deleteItems: [], journals: [], macros: [], settings: [] };
  for (const a of game.actors) if (ours(a)) p.actors.push(a);
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
  }
  for (const j of game.journal) { if (ours(j)) p.journals.push(j); for (const pg of j.pages) if (ours(pg)) p.journals.push(pg); }
  for (const t of game.tables) if (ours(t)) p.journals.push(t);
  for (const m of game.macros) if (m.flags?.[ID]?.macro) p.macros.push(m);
  for (const [k, c] of game.settings.settings) if (c.namespace === ID && (c.scope === "world" ? game.user.isGM : true)) p.settings.push(c);
  return p;
}
const count = (p, k) => k === "tokens" ? p.tokens.length + p.tokenActors.length : p[k].length;

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
  if (pick.actors) done.actors = await each(p.actors, stripFlags);
  if (pick.tokens) done.tokens = (await each(p.tokens, stripFlags)) + (await each(p.tokenActors, stripDelta));
  if (pick.scenes) done.scenes = await each(p.scenes, stripFlags);
  if (pick.journals) done.journals = await each(p.journals, stripFlags);
  if (pick.macros && p.macros.length) {
    const folders = new Set(p.macros.map(m => m.folder).filter(Boolean));
    try { await Macro.deleteDocuments(p.macros.map(m => m.id)); done.macros = p.macros.length; } catch (e) { console.warn(`${ID} | remove data: macros`, e); done.macros = 0; }
    // The setup folder goes too once it's empty.
    for (const f of folders) if (f.name === "Wayfarer's Toolkit" && !f.contents?.length && !f.children?.length) { try { await f.delete(); } catch { } }
  }
  if (pick.settings) {
    let n = 0;
    for (const c of p.settings) { try { const cur = game.settings.get(ID, c.key); const def = foundry.utils.deepClone(c.default); if (JSON.stringify(cur) !== JSON.stringify(def)) { await game.settings.set(ID, c.key, def); n++; } } catch (e) { console.warn(`${ID} | remove data: setting ${c.key}`, e); } }
    done.settings = n;
  }
  return done;
}

export class CleanupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-cleanup`, classes: ["wct-cleanup", "wct-window"], tag: "form", form: { closeOnSubmit: false }, window: { title: "Wayfarer's Toolkit · Remove toolkit data", icon: "fa-solid fa-broom", resizable: true }, position: { width: 560, height: "auto" } };
  async _renderHTML() {
    const div = document.createElement("div");
    if (!game.user.isGM) { div.textContent = "GM only."; return div; }
    const p = plan();
    div.innerHTML = `<p>Removes what Wayfarer's Toolkit stored in this world. Counts below are what would go now; nothing is changed until you confirm. Your own documents, other modules' data and items the toolkit didn't create are never touched. Item Piles piles stay piles (revert them with Reset loot first if you want normal tokens back).</p>
      ${CATEGORIES.map(([k, label]) => `<div class="form-group"><label><input type="checkbox" name="${k}" ${["deleteItems", "macros", "settings"].includes(k) ? "" : "checked"}> ${esc(label)}</label><span class="hint" style="margin-left:auto;">${count(p, k)}</span></div>`).join("")}
      <div class="form-group"><label for="wct-cleanup-confirm">Type <strong>REMOVE</strong> to confirm</label><div class="form-fields"><input type="text" id="wct-cleanup-confirm" name="confirm" autocomplete="off"></div></div>
      <footer class="form-footer"><button type="button" data-action="cancel"><i class="fa-solid fa-xmark"></i> Cancel</button><button type="submit" data-action="remove"><i class="fa-solid fa-broom"></i> Remove</button></footer>`;
    return div;
  }
  _replaceHTML(result, content) {
    content.replaceChildren(result);
    const form = this.element;
    const cancel = form.querySelector("[data-action=cancel]"); if (cancel) cancel.onclick = ev => { ev.preventDefault(); this.close(); };
    form.onsubmit = async ev => {
      ev.preventDefault();
      if (String(form.elements.confirm?.value ?? "").trim() !== "REMOVE") return ui.notifications.warn("Remove toolkit data: type REMOVE to confirm.");
      const pick = Object.fromEntries(CATEGORIES.map(([k]) => [k, !!form.elements[k]?.checked]));
      if (!Object.values(pick).some(Boolean)) return ui.notifications.info("Remove toolkit data: nothing ticked.");
      form.querySelector("[data-action=remove]").disabled = true;
      const done = await remove(pick);
      await this.close();
      if (!done) return;
      const label = Object.fromEntries(CATEGORIES);
      const lines = Object.entries(done).map(([k, n]) => `${label[k].replace(/ \(.*\)$/, "")}: ${n}`);
      const text = lines.length ? lines.join("; ") : "nothing";
      ui.notifications.info(`Wayfarer's Toolkit data removed: ${text}.`);
      await ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Wayfarer's Toolkit" }, content: `<h3>Toolkit data removed</h3><ul>${lines.map(l => `<li>${esc(l)}</li>`).join("") || "<li>nothing</li>"}</ul>` });
      if (pick.settings && done.settings) foundry.applications?.settings?.SettingsConfig?.reloadConfirm?.({ world: true });
    };
  }
}
