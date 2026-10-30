/**
 * Features: one world setting per tool, so each world picks what it uses. A turned-off feature registers nothing (no buttons,
 * hooks, key bindings, socket handlers, chat buttons or wrappers) and Run setup skips its macros and items.
 * To add a feature, add an entry to FEATURES and gate its registration with on("<id>").
 */
const ID = "wayfarers-toolkit";

/** id, label, hint, default. `key` overrides the setting key (kept for settings that existed before the registry). */
export const FEATURES = [
  { id: "hexTravel", label: "Hex Travel", hint: "Overland travel by hexes with off-road encounter rolls; advances time and logs the trip." },
  { id: "flightMaster", label: "Flight Master", hint: "Flight routes with fares from the party purse, the feather button in the token controls and player bookings." },
  { id: "sessionStart", label: "Session Start", hint: "Pick a scene, post a \"Previously…\" recap and unpause." },
  { id: "vendorTrash", label: "Vendor Trash", hint: "Grey loot pre-rolled on NPC tokens and lootable when they die (bodies with Item Piles, or a Give to Party card), matched to the creature and scaled by CR, richer in scenes marked as dungeons, and Sell Vendor Trash." },
  { id: "riderFeat", label: "Riding Training", hint: "Setup adds the Riding Training feat; Hex Travel rides mounted by default when every party member has it (Long Road)." },
  { id: "characterPane", key: "characterPane", label: "Character pane", hint: "A classic-MMO-style equipment frame opened from the character sheet header, and its AC handling for slotted armour pieces." },
  { id: "questLog", label: "Quest log", hint: "Narrative quests with objectives the GM ticks off, kept as journal entries, with a quest log window (key L)." },
  { id: "questTracker", label: "Quest tracker", hint: "An on-screen list of tracked quests and their open objectives. Needs the quest log; each player can still hide it." },
  { id: "bossFrames", label: "Boss frames", hint: "Health frames at the top of every screen for tokens the GM marks as bosses (crown button in the token HUD) while they're in combat." },
  { id: "lootRolls", label: "Loot rolls", hint: "Need / Greed / Pass rolls for an item in an Item Piles pile: a dice button on the item's row starts one; the winner's character gets the item. Needs Item Piles." }
].map(f => ({ default: true, key: `feature-${f.id}`, ...f }));

const byId = id => FEATURES.find(f => f.id === id);

/** Whether a feature is turned on in this world. Unknown ids count as on. */
export function on(id) {
  const f = byId(id); if (!f) return true;
  try { return !!game.settings.get(ID, f.key); } catch { return f.default; }
}

/** For API entry points: warns and returns false when the feature is off. */
export function need(id) {
  if (on(id)) return true;
  ui.notifications.warn(`${byId(id)?.label ?? id} is turned off in Wayfarer's Toolkit › Features.`);
  return false;
}

export function registerSettings() {
  for (const f of FEATURES) game.settings.register(ID, f.key, { name: `Feature: ${f.label}`, hint: f.hint, scope: "world", config: false, type: Boolean, default: f.default, requiresReload: true });
  game.settings.registerMenu(ID, "features", { name: "Features", label: "Choose features", hint: "Turn each of the toolkit's tools on or off for this world. Turned-off tools add nothing to Foundry. Reloads Foundry.", icon: "fas fa-toggle-on", type: FeaturesApp, restricted: true });
}

export class FeaturesApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-features`, classes: ["wct-features"], window: { title: "Wayfarer's Toolkit · Features", icon: "fa-solid fa-toggle-on" }, position: { width: 480 } };
  async _renderHTML() {
    const form = document.createElement("form");
    form.innerHTML = `<p class="hint">Turned-off tools add no buttons, macros, hooks or chat cards. Nothing in your world is deleted; turn a tool back on and it picks up where it left off. Saving reloads Foundry for everyone.</p>
      ${FEATURES.map(f => `<div class="form-group"><label for="wct-f-${f.id}">${f.label}</label><input type="checkbox" id="wct-f-${f.id}" name="${f.id}" ${on(f.id) ? "checked" : ""}><p class="hint">${f.hint}</p></div>`).join("")}
      <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> Save and reload</button></footer>`;
    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      let changed = false;
      for (const f of FEATURES) { const v = form.elements[f.id].checked; if (v !== on(f.id)) { await game.settings.set(ID, f.key, v); changed = true; } }
      await this.close();
      if (!changed) return;
      const SC = foundry.applications?.settings?.SettingsConfig;
      if (SC?.reloadConfirm) return SC.reloadConfirm({ world: true });
      foundry.utils.debouncedReload?.() ?? location.reload();
    });
    return form;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}
