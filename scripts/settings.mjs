/**
 * Settings submenus: the toolkit's settings grouped per feature, each in its own window opened from a button in the module's
 * settings list ("Vendor Trash settings…", "Travel settings…" and so on). The settings themselves are registered as before, with the
 * same keys (so nothing stored is lost), just with `config: false`; a submenu lists them and saves them. A submenu whose features are
 * all turned off isn't registered, and a setting whose feature is off is left out of its submenu.
 */
import * as F from "./features.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Each submenu: key, button label, window title, icon, the features it belongs to (registered when any is on; `null` = always) and
 * its settings as [settingKey, feature | null]. Labels shown come from each setting's own `name`.
 */
export const MENUS = [
  {
    key: "menuGeneral", label: "General settings…", title: "General", icon: "fa-solid fa-sliders", features: null,
    settings: [["trackerJournal", null], ["partyActor", null], ["itemPilesCoins", null], ["debugLog", null]]
  },
  {
    key: "menuTravel", label: "Travel settings…", title: "Travel", icon: "fa-solid fa-route", features: ["hexTravel", "flightMaster", "sessionStart", "riderFeat"],
    settings: [
      ["zones", "hexTravel"], ["encounterDie", "hexTravel"], ["offroadMult", "hexTravel"], ["mountMult", "hexTravel"],
      ["paceSlow", "hexTravel"], ["paceNormal", "hexTravel"], ["paceFast", "hexTravel"],
      ["playerFlights", "flightMaster"], ["fareUnit", "flightMaster"], ["flightSound", "flightMaster"], ["flightVolume", "flightMaster"],
      ["hiddenScenes", "sessionStart"], ["riderFeat", "riderFeat"]
    ]
  },
  {
    key: "menuVendorTrash", label: "Vendor Trash settings…", title: "Vendor Trash", icon: "fa-solid fa-sack-dollar", features: ["vendorTrash"],
    settings: [["trashPacks", "vendorTrash"], ["trashItemPiles", "vendorTrash"], ["trashAutoRoll", "vendorTrash"], ["trashAutoLoot", "vendorTrash"],
      ["dungeonCoinMult", "vendorTrash"], ["dungeonDropBonus", "vendorTrash"], ["dungeonExtraRoll", "vendorTrash"]]
  },
  {
    key: "menuBoss", label: "Boss loot & frames settings…", title: "Boss loot & frames", icon: "fa-solid fa-crown", features: ["bossLoot", "bossFrames"],
    settings: [["bossLootAuto", "bossLoot"], ["bossLootExtraDraw", "bossLoot"], ["bossHpDisplay", "bossFrames"], ["bossAutoFromLoot", "bossFrames:bossLoot"]],
    actions: [{ label: "Link boss tables by name", icon: "fa-solid fa-link", feature: "bossLoot", hint: "Links NPC actors to world tables named \"<name> · Loot\" (keeps existing links).", run: () => game.modules.get(ID)?.api?.bossLoot?.autoLink() }]
  },
  {
    key: "menuLootRolls", label: "Loot rolls settings…", title: "Loot rolls", icon: "fa-solid fa-dice", features: ["lootRolls"],
    settings: [["lootRollSeconds", "lootRolls"]]
  },
  {
    key: "menuQuests", label: "Quest log settings…", title: "Quest log", icon: "fa-solid fa-scroll", features: ["questLog"],
    settings: [["questFolder", "questLog"], ["questObjectiveChat", "questLog"], ["questSoundAccept", "questLog"], ["questSoundComplete", "questLog"], ["questVolume", "questLog"]]
  }
];

/** A setting's feature condition is "a" (feature a on) or "a:b" (both on). */
/** Which settings a submenu shows, given which features are on (pure over `isOn`). */
export function menuKeys(menu, isOn = F.on) {
  return menu.settings.filter(([, cond]) => !cond || cond.split(":").every(isOn)).map(([k]) => k);
}
/** Whether a submenu is registered, given which features are on. */
export const menuOn = (menu, isOn = F.on) => !menu.features || menu.features.some(isOn);

const cfgOf = key => game.settings.settings.get(`${ID}.${key}`);

function field(key) {
  const c = cfgOf(key); if (!c) return "";
  const v = game.settings.get(ID, key); const id = `wct-set-${key}`; const name = esc(key);
  let input;
  if (c.type === Boolean) input = `<input type="checkbox" id="${id}" name="${name}" ${v ? "checked" : ""}>`;
  else if (c.choices) input = `<select id="${id}" name="${name}">${Object.entries(c.choices).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === k ? "selected" : ""}>${esc(game.i18n?.localize?.(l) ?? l)}</option>`).join("")}</select>`;
  else if (c.type === Number && c.range) input = `<input type="range" id="${id}" name="${name}" min="${c.range.min}" max="${c.range.max}" step="${c.range.step ?? 1}" value="${esc(v)}"><span class="range-value" style="min-width:3em;text-align:right;">${esc(v)}</span>`;
  else if (c.type === Number) input = `<input type="number" id="${id}" name="${name}" value="${esc(v)}" step="any">`;
  else if (c.filePicker) input = `<file-picker name="${name}" type="${esc(c.filePicker === true ? "any" : c.filePicker)}" value="${esc(v)}"></file-picker>`;
  else if (key === "zones") input = `<textarea id="${id}" name="${name}" rows="3" style="font-family:monospace;">${esc(v)}</textarea>`;
  else input = `<input type="text" id="${id}" name="${name}" value="${esc(v)}">`;
  return `<div class="form-group"><label for="${id}">${esc(c.name)}</label><div class="form-fields">${input}</div>${c.hint ? `<p class="hint">${esc(c.hint)}</p>` : ""}</div>`;
}

/** Reads a field's value back with its setting's type. */
function readField(form, key) {
  const c = cfgOf(key); const el = form.elements[key] ?? form.querySelector(`[name="${key}"]`); if (!c || !el) return undefined;
  if (c.type === Boolean) return !!el.checked;
  if (c.type === Number) { const n = Number(el.value); return Number.isFinite(n) ? n : c.default; }
  return String(el.value ?? "");
}

/** Builds the ApplicationV2 class for one submenu. */
export function menuApp(menu) {
  return class WctSettingsMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = { id: `${ID}-${menu.key}`, classes: ["wct-settings-menu"], tag: "form", form: { closeOnSubmit: false }, window: { title: `Wayfarer's Toolkit · ${menu.title}`, icon: menu.icon, resizable: true }, position: { width: 560, height: "auto" } };
    async _renderHTML() {
      const div = document.createElement("div");
      const keys = menuKeys(menu);
      const actions = (menu.actions ?? []).filter(a => !a.feature || F.on(a.feature));
      div.innerHTML = `${keys.length ? keys.map(field).join("") : `<p class="hint">No settings for the features turned on.</p>`}
        ${actions.map((a, i) => `<p><button type="button" data-wct-menu-action="${i}"><i class="${a.icon}"></i> ${esc(a.label)}</button> <span class="hint">${esc(a.hint ?? "")}</span></p>`).join("")}
        <footer class="form-footer"><button type="submit"><i class="fa-solid fa-floppy-disk"></i> Save</button></footer>`;
      div.style.maxHeight = "75vh"; div.style.overflowY = "auto";
      div.querySelectorAll('input[type="range"]').forEach(r => r.addEventListener("input", () => { r.nextElementSibling.textContent = r.value; }));
      div.querySelectorAll("[data-wct-menu-action]").forEach(b => b.addEventListener("click", async ev => { ev.preventDefault(); b.disabled = true; try { await actions[+b.dataset.wctMenuAction].run(); } finally { b.disabled = false; } }));
      return div;
    }
    _replaceHTML(result, content) {
      content.replaceChildren(result);
      const form = this.element;
      form.onsubmit = async ev => {
        ev.preventDefault();
        let reload = false;
        for (const key of menuKeys(menu)) {
          const v = readField(form, key); if (v === undefined) continue;
          if (v !== game.settings.get(ID, key)) { await game.settings.set(ID, key, v); if (cfgOf(key)?.requiresReload) reload = true; }
        }
        await this.close();
        if (reload) foundry.applications?.settings?.SettingsConfig?.reloadConfirm?.({ world: true });
      };
    }
  };
}

/** Registers the submenus for the features turned on (call at the end of init, once every setting is registered). */
export function registerMenus() {
  for (const m of MENUS) {
    if (!menuOn(m)) continue;
    game.settings.registerMenu(ID, m.key, { name: m.title, label: m.label, hint: `${m.title} settings of Wayfarer's Toolkit.`, icon: `fas ${m.icon.replace("fa-solid ", "")}`, type: menuApp(m), restricted: true });
  }
}
