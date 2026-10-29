/**
 * Character pane: a World of Warcraft–style equipment frame for dnd5e actors.
 * Slot an item and it's equipped on the sheet; take it out and it's unequipped. The slot lives in flags.wayfarers-toolkit.slot.
 * Items that carry a WoW-style tooltip in their description (like the WoW Classic Items compendium) are placed by their "Slot" line.
 */
const ID = "wayfarers-toolkit";
const WOW = "wow-classic-items";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------- slots
/** WoW Classic's paper-doll slots (no Ammo slot). Two finger and two trinket slots share a group. */
export const SLOTS = {
  head: { label: "Head", icon: "fa-helmet-battle" },
  neck: { label: "Neck", icon: "fa-gem" },
  shoulder: { label: "Shoulder", icon: "fa-shield-halved" },
  back: { label: "Back", icon: "fa-scarf" },
  chest: { label: "Chest", icon: "fa-vest" },
  shirt: { label: "Shirt", icon: "fa-shirt" },
  tabard: { label: "Tabard", icon: "fa-flag-swallowtail" },
  wrist: { label: "Wrist", icon: "fa-watch" },
  hands: { label: "Hands", icon: "fa-hand-back-fist" },
  waist: { label: "Waist", icon: "fa-grip-lines" },
  legs: { label: "Legs", icon: "fa-pants" },
  feet: { label: "Feet", icon: "fa-boot" },
  finger1: { label: "Finger", icon: "fa-ring" },
  finger2: { label: "Finger", icon: "fa-ring" },
  trinket1: { label: "Trinket", icon: "fa-hourglass" },
  trinket2: { label: "Trinket", icon: "fa-hourglass" },
  mainhand: { label: "Main Hand", icon: "fa-sword" },
  offhand: { label: "Off Hand", icon: "fa-shield" },
  ranged: { label: "Ranged", icon: "fa-bow-arrow" }
};
const LEFT = ["head", "neck", "shoulder", "back", "chest", "shirt", "tabard", "wrist"];
const RIGHT = ["hands", "waist", "legs", "feet", "finger1", "finger2", "trinket1", "trinket2"];
const BOTTOM = ["mainhand", "offhand", "ranged"];
const WEAPON_SLOTS = new Set(BOTTOM);
const GEAR_SLOTS = Object.keys(SLOTS).filter(s => !WEAPON_SLOTS.has(s));
const group = s => s.replace(/\d$/, "");
/** Slot groups → concrete slots, in order: ["finger"] → ["finger1", "finger2"]. */
const expand = groups => [...new Set(groups.flatMap(g => Object.keys(SLOTS).filter(s => group(s) === g || s === g)))];

/** The "Slot" line of a WoW tooltip (or a WoW Classic Items folder name) → slot groups. */
const WOW_SLOTS = {
  "head": ["head"], "neck": ["neck"], "shoulder": ["shoulder"], "back": ["back"], "chest": ["chest"], "robe": ["chest"],
  "shirt": ["shirt"], "tabard": ["tabard"], "wrist": ["wrist"], "hands": ["hands"], "waist": ["waist"], "legs": ["legs"],
  "feet": ["feet"], "finger": ["finger"], "trinket": ["trinket"],
  "main hand": ["mainhand"], "one-hand": ["mainhand", "offhand"], "two-hand": ["mainhand"],
  "off hand": ["offhand"], "held in off-hand": ["offhand"],
  "ranged": ["ranged"], "thrown": ["ranged"], "relic": ["ranged"], "wands": ["ranged"]
};
const WOW_LINE = new RegExp(`^(${Object.keys(WOW_SLOTS).join("|")})$`, "i");

/** Name words that suggest where a non-WoW item is worn. Only used to pick a default slot. */
const NAME_HINTS = [
  ["finger", /\b(ring|signet|band of)\b/i],
  ["head", /\b(helm|helmet|hat|hood|cap|circlet|crown|coif|mask|headband|cowl|diadem|tiara|goggles|headdress)\b/i],
  ["neck", /\b(amulet|necklace|pendant|periapt|medallion|choker|torc|locket|scarab)\b/i],
  ["shoulder", /\b(pauldrons?|shoulders?|spaulders?|shoulderpads?|epaulets?|mantle)\b/i],
  ["back", /\b(cloak|cape|shawl|wings)\b/i],
  ["shirt", /\bshirt\b/i],
  ["tabard", /\btabard\b/i],
  ["wrist", /\b(bracers?|bracelets?|wristguards?|wristbands?|bindings|armbands?|vambraces?)\b/i],
  ["hands", /\b(gloves?|gauntlets?|handwraps|mitts|grips)\b/i],
  ["waist", /\b(belt|girdle|sash|cord|cinch|waistband)\b/i],
  ["legs", /\b(leggings|pants|trousers|greaves|legplates|legguards|kilt|breeches)\b/i],
  ["feet", /\b(boots|slippers|shoes|sandals|treads|footwraps|sabatons|stompers)\b/i],
  ["chest", /\b(robe|vest|tunic|breastplate|chestguard|chestpiece|jerkin|hauberk|cuirass|armor|armour|raiment|harness)\b/i],
  ["trinket", /\b(trinket|figurine|idol|charm|talisman|stone|orb|totem|token|horn|bead|feather)\b/i]
];

/** Quality colours, WoW style. dnd5e rarities map onto them. */
const QUALITY = { poor: "#9d9d9d", common: "#ffffff", uncommon: "#1eff00", rare: "#0070dd", veryRare: "#a335ee", legendary: "#ff8000", artifact: "#e6cc80" };

// ---------------------------------------------------------------- reading items
const tipCache = new Map();
/** Reads a WoW-style tooltip from an item's description: { slot, color }. Empty when there's none. */
function readTooltip(desc) {
  desc = String(desc ?? ""); if (!desc.includes("font-size:1.08em")) return {};
  if (tipCache.has(desc)) return tipCache.get(desc);
  const out = {};
  try {
    const doc = new DOMParser().parseFromString(desc, "text/html");
    const name = [...doc.querySelectorAll("div")].find(d => /font-size:\s*1\.08em/.test(d.getAttribute("style") || ""));
    if (name) {
      out.color = (name.getAttribute("style").match(/color:\s*(#[0-9a-f]{3,6})/i) || [])[1]?.toLowerCase();
      for (const line of [...name.parentElement.children].slice(1, 8)) {
        const t = (line.querySelector("span")?.textContent ?? line.textContent).trim();
        if (WOW_LINE.test(t)) { out.slot = t.toLowerCase(); break; }
      }
    }
  } catch (e) { /* not a tooltip */ }
  if (tipCache.size > 2000) tipCache.clear();
  tipCache.set(desc, out);
  return out;
}

/** WoW slot of an item copied from the WoW Classic Items compendium, read from the folder it came from. */
function wowFolderSlot(item) {
  const src = item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? "";
  const m = String(src).match(/^Compendium\.([^.]+\.[^.]+)\.Item\.([^.]+)$/); if (!m || !m[1].startsWith(`${WOW}.`)) return null;
  const pack = game.packs.get(m[1]); const e = pack?.index.get(m[2]); const f = e?.folder ? pack.folders.get(e.folder?.id ?? e.folder) : null;
  if (!f) return null;
  const n = f.name.toLowerCase();
  if (n === "clothing") return /tabard/i.test(item.name) ? "tabard" : "shirt";
  return WOW_SLOTS[n] ? n : null;
}

/** WoW slot ("head", "two-hand", …) and quality colour of an item, if its data has them. */
export function wowInfo(item) {
  const tip = readTooltip(item.system?.description?.value);
  return { slot: tip.slot ?? wowFolderSlot(item), color: tip.color ?? null };
}

/** Border colour for an item: the WoW tooltip's quality colour, else its dnd5e rarity. */
export function qualityColor(item) {
  return wowInfo(item).color ?? QUALITY[item.system?.rarity] ?? QUALITY.common;
}

const hint = item => NAME_HINTS.find(([, re]) => re.test(item.name))?.[0] ?? null;
const props = item => { const p = item.system?.properties; return p instanceof Set ? p : new Set(p ?? []); };
const ARMOR = ["light", "medium", "heavy", "natural"];
const isBodyArmor = item => item.type === "equipment" && ARMOR.includes(item.system?.type?.value);
const isShield = item => item.type === "equipment" && item.system?.type?.value === "shield";

/**
 * Where an item can go. { slots: concrete slots in order of preference, strict: false when the user may pick any gear slot,
 * two: true for a two-handed weapon in the main hand, ask: true when there's no clear default }.
 * Returns null for items that can't be equipped.
 */
export function fits(item) {
  if (!item || !("equipped" in (item.system ?? {}))) return null;
  const w = wowInfo(item).slot;
  if (w) return { slots: expand(WOW_SLOTS[w]), strict: true, two: w === "two-hand", wow: w };
  const t = item.system.type?.value ?? "";
  if (item.type === "weapon") {
    const p = props(item);
    if (["simpleR", "martialR"].includes(t)) return { slots: ["ranged"], strict: true, two: false };
    if (p.has("two")) return { slots: ["mainhand"], strict: true, two: true };
    return { slots: p.has("thr") ? ["mainhand", "offhand", "ranged"] : ["mainhand", "offhand"], strict: true, two: false };
  }
  if (item.type !== "equipment") return null;
  if (t === "shield") return { slots: ["offhand"], strict: true, two: false };
  if (ARMOR.includes(t)) return { slots: ["chest"], strict: true, two: false };
  if (t === "ring") return { slots: expand(["finger"]), strict: true, two: false };
  if (["wand", "rod"].includes(t)) return { slots: ["ranged", "offhand"], strict: true, two: false };
  const h = hint(item);
  if (t === "clothing") return { slots: expand([...(h ? [h] : []), "chest", "shirt", "tabard"]), prefer: h ? expand([h]) : ["chest", "shirt", "tabard"], strict: false, two: false };
  if (t === "trinket") return { slots: expand(["trinket", ...GEAR_SLOTS]), prefer: expand(["trinket"]), strict: false, two: false };
  return { slots: expand([...(h ? [h] : []), ...GEAR_SLOTS]), prefer: h ? expand([h]) : null, strict: false, two: false, ask: !h };
}
/** True when the item may go in this slot. */
export const canSlot = (item, slot) => { const f = fits(item); return !!f && (f.slots.includes(slot) || (!f.strict && GEAR_SLOTS.includes(slot))); };

/** The actor's slotted items: { slot: item }. An item counts only while it's equipped; the first item claiming a slot wins. */
export function slotted(actor) {
  const out = {};
  for (const i of actor.items) {
    const s = i.getFlag(ID, "slot");
    if (s && SLOTS[s] && i.system?.equipped && !out[s] && canSlot(i, s)) out[s] = i;
  }
  return out;
}
const isTwo = (item, slot = "mainhand") => slot === "mainhand" && !!fits(item)?.two;

// ---------------------------------------------------------------- slotting
const flagPath = `flags.${ID}.slot`;

/** Armour that counts for AC: anything equipped except armour-typed pieces in a slot other than Chest (a helm, boots...). */
const isSuit = (item, slot = item.getFlag(ID, "slot")) => isBodyArmor(item) && (!slot || slot === "chest");

/** Warnings (never blocks): attunement over the limit, a second suit of armour, a second shield. */
function warnings(actor, item, replaced, slot) {
  const out = [];
  const att = actor.system.attributes?.attunement;
  if (item.system.attunement === "required" && !item.system.attuned && att && att.value >= att.max)
    out.push(`${item.name} needs attunement, and ${actor.name} is already attuned to ${att.value} of ${att.max} items.`);
  const others = actor.items.filter(i => i !== item && i !== replaced && i.system?.equipped);
  if (isSuit(item, slot)) {
    const a = others.filter(i => isSuit(i));
    if (a.length) out.push(`${actor.name} is also wearing ${a.map(i => i.name).join(", ")}. dnd5e counts only one piece of armour for AC.`);
  }
  if (isShield(item)) {
    const s = others.filter(isShield);
    if (s.length) out.push(`${actor.name} already has a shield equipped (${s.map(i => i.name).join(", ")}).`);
  }
  return out;
}

/** Puts an owned item in a slot and equips it. Whatever was in the slot comes out (and is unequipped). */
export async function slotItem(actor, item, slot) {
  if (!actor?.isOwner) return ui.notifications.warn("You don't own this character.");
  if (item?.parent !== actor) return ui.notifications.warn("That item isn't on this character.");
  if (!SLOTS[slot]) return;
  if (!canSlot(item, slot)) return ui.notifications.warn(`${item.name} doesn't go in the ${SLOTS[slot].label} slot.`);
  const cur = slotted(actor);
  if (slot === "offhand" && cur.mainhand && cur.mainhand !== item && isTwo(cur.mainhand)) return ui.notifications.warn(`${cur.mainhand.name} is two-handed: the off hand is taken.`);
  const replaced = cur[slot] && cur[slot] !== item ? cur[slot] : null;
  const updates = [];
  if (replaced) updates.push({ _id: replaced.id, "system.equipped": false, [flagPath]: null });
  if (slot === "mainhand" && isTwo(item) && cur.offhand && cur.offhand !== item) {
    updates.push({ _id: cur.offhand.id, "system.equipped": false, [flagPath]: null });
    ui.notifications.info(`${item.name} is two-handed, so ${cur.offhand.name} comes out of the off hand.`);
  }
  for (const w of warnings(actor, item, replaced, slot)) ui.notifications.warn(w);
  updates.push({ _id: item.id, "system.equipped": true, [flagPath]: slot });
  await actor.updateEmbeddedDocuments("Item", updates);
  return slot;
}

/** Takes an item out of its slot and unequips it. */
export async function unslotItem(item) {
  if (!item?.isOwner) return;
  await item.update({ "system.equipped": false, [flagPath]: null });
}

/** The best slot for an item: a free one it fits, else the first it fits (replacing what's there). Null when the user should choose. */
export function autoSlot(actor, item) {
  const f = fits(item); if (!f || f.ask) return null;
  const cur = slotted(actor);
  const blocked = s => s === "offhand" && cur.mainhand && cur.mainhand !== item && isTwo(cur.mainhand);
  const ok = (f.prefer ?? f.slots).filter(s => !blocked(s));
  const mine = Object.keys(cur).find(s => cur[s] === item && f.slots.includes(s)); if (mine) return mine;
  return ok.find(s => !cur[s]) ?? ok[0] ?? null;
}

/** Items that could be slotted but aren't. */
function unslottedItems(actor, cur) {
  const used = new Set(Object.values(cur));
  return actor.items.filter(i => !used.has(i) && fits(i) && !i.system.container).sort((a, b) => (b.system.equipped - a.system.equipped) || a.name.localeCompare(b.name));
}

/** Copies an item dropped from a compendium, the sidebar or another actor onto this actor, the way the dnd5e sheet does. */
async function adopt(actor, item, event) {
  if (item.parent === actor) return item;
  if (!actor.isOwner) return null;
  const sheet = actor.sheet;
  try {
    if (typeof sheet?._onDropCreateItems === "function") {
      const created = await sheet._onDropCreateItems(event, [item], "copy");
      const doc = Array.isArray(created) ? created.find(d => d?.documentName === "Item") : null;
      if (doc) return doc;
    }
  } catch (e) { console.warn(`${ID} | dnd5e drop failed, copying the item directly`, e); }
  const o = item.toObject(); delete o._id; delete o.folder; delete o.sort;
  if (item.pack) foundry.utils.setProperty(o, "_stats.compendiumSource", item.uuid);
  o.system.equipped = false; foundry.utils.setProperty(o, flagPath, null);
  const [doc] = await actor.createEmbeddedDocuments("Item", [o]);
  return doc ?? null;
}

// ---------------------------------------------------------------- the pane
const TextEditorImpl = () => foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
const OPEN = new Map();

export class CharacterPane extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["wct-pane"],
    window: { title: "Character", icon: "fa-solid fa-shirt", resizable: false },
    position: { width: 470, height: "auto" }
  };

  constructor(actor, options = {}) {
    super({ id: `wct-pane-${actor.uuid.replace(/\./g, "-")}`, ...options });
    this.actor = actor;
    this._hooks = [];
    const mine = d => d?.parent === actor || d === actor || (d?.parent?.parent === actor);
    const rerender = d => { if (mine(d)) this._queueRender(); };
    for (const h of ["createItem", "updateItem", "deleteItem", "updateActor", "createActiveEffect", "deleteActiveEffect", "updateActiveEffect"]) this._hooks.push([h, Hooks.on(h, rerender)]);
  }

  get title() { return `${this.actor.name} · Character`; }

  _queueRender() { clearTimeout(this._t); this._t = setTimeout(() => { if (this.rendered) this.render(); }, 50); }

  async close(options) {
    for (const [h, id] of this._hooks) Hooks.off(h, id);
    this._hooks = [];
    OPEN.delete(this.actor.uuid);
    game.tooltip?.deactivate?.();
    return super.close(options);
  }

  slotHTML(slot, cur) {
    const item = cur[slot];
    const ghost = !item && slot === "offhand" && cur.mainhand && isTwo(cur.mainhand) ? cur.mainhand : null;
    const s = SLOTS[slot];
    if (item) return `<div class="wct-slot filled" data-slot="${slot}" data-item-id="${item.id}" draggable="true" style="--q:${qualityColor(item)}" aria-label="${esc(s.label)}: ${esc(item.name)}"><img src="${esc(item.img)}" alt=""></div>`;
    if (ghost) return `<div class="wct-slot ghost" data-slot="${slot}" data-item-id="${ghost.id}" style="--q:${qualityColor(ghost)}" aria-label="${esc(s.label)}: blocked by ${esc(ghost.name)}"><img src="${esc(ghost.img)}" alt=""></div>`;
    return `<div class="wct-slot empty" data-slot="${slot}" aria-label="${esc(s.label)} (empty)" data-tooltip="${esc(s.label)}"><i class="fa-solid ${s.icon}"></i><span>${esc(s.label)}</span></div>`;
  }

  async _renderHTML() {
    const a = this.actor; const sys = a.system; const cur = slotted(a);
    const ab = sys.abilities ?? {};
    const sign = n => (n >= 0 ? `+${n}` : `${n}`);
    const abil = Object.entries(CONFIG.DND5E.abilities).filter(([k]) => ab[k]).map(([k, c]) => `<li><span class="lbl">${esc(c.label)}</span><span class="val">${ab[k].value ?? "–"} <small>(${sign(ab[k].mod ?? 0)})</small></span></li>`).join("");
    const hp = sys.attributes?.hp ?? {}; const ac = sys.attributes?.ac?.value; const att = sys.attributes?.attunement;
    const classes = Object.values(a.classes ?? {}).map(c => `${c.name}${Object.keys(a.classes).length > 1 ? ` ${c.system.levels}` : ""}`).join(" / ");
    const race = sys.details?.race?.name ?? (typeof sys.details?.race === "string" ? sys.details.race : "");
    const level = sys.details?.level ?? (sys.details?.cr != null ? `CR ${sys.details.cr}` : "");
    const sub = [level ? (typeof level === "number" ? `Level ${level}` : level) : "", race, classes].filter(Boolean).join(" ");
    const bag = unslottedItems(a, cur);
    const loose = bag.filter(i => i.system.equipped).length;
    const div = document.createElement("div");
    div.className = "wct-frame";
    div.innerHTML = `
      <header class="wct-head"><h2>${esc(a.name)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</header>
      <div class="wct-doll">
        <div class="wct-col left">${LEFT.map(s => this.slotHTML(s, cur)).join("")}</div>
        <div class="wct-centre">
          <div class="wct-portrait" data-drop="auto"><img src="${esc(a.img)}" alt="${esc(a.name)}"></div>
          <div class="wct-stats">
            <ul class="wct-abil">${abil}</ul>
            <ul class="wct-def">
              <li><span class="lbl">Armor</span><span class="val">${ac ?? "–"}</span></li>
              <li><span class="lbl">Health</span><span class="val">${hp.value ?? "–"}${hp.max ? ` / ${hp.max}` : ""}${hp.temp ? ` <small>+${hp.temp}</small>` : ""}</span></li>
              ${att ? `<li class="${att.value > att.max ? "over" : ""}"><span class="lbl">Attuned</span><span class="val">${att.value} / ${att.max}</span></li>` : ""}
            </ul>
          </div>
        </div>
        <div class="wct-col right">${RIGHT.map(s => this.slotHTML(s, cur)).join("")}</div>
        <div class="wct-row bottom">${BOTTOM.map(s => this.slotHTML(s, cur)).join("")}</div>
      </div>
      <section class="wct-bag" data-drop="bag">
        <h3>Equippable items <small>drag onto a slot, click to equip, right-click a slot to remove</small></h3>
        ${loose ? `<p class="wct-note">${loose} equipped item${loose === 1 ? " isn't" : "s aren't"} in a slot. <button type="button" data-action="slotEquipped">Slot equipped items</button></p>` : ""}
        <div class="wct-bag-grid">${bag.length ? bag.map(i => `<div class="wct-item${i.system.equipped ? " equipped" : ""}" data-item-id="${i.id}" draggable="true" style="--q:${qualityColor(i)}" aria-label="${esc(i.name)}"><img src="${esc(i.img)}" alt=""></div>`).join("") : `<p class="wct-empty">Nothing else to equip. Drop items here from a compendium or the sidebar to add them.</p>`}</div>
      </section>
      <div class="wct-pop" hidden></div>`;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  _onRender(context, options) {
    const root = this.element.querySelector(".wct-frame"); if (!root) return;
    const editable = this.actor.isOwner;
    const itemOf = el => this.actor.items.get(el.closest("[data-item-id]")?.dataset.itemId);

    // Tooltips
    root.querySelectorAll("[data-item-id]").forEach(el => {
      el.addEventListener("pointerenter", () => this._tooltip(el, itemOf(el)));
      el.addEventListener("pointerleave", () => game.tooltip?.deactivate?.());
    });
    if (!editable) return;

    // Drag out
    root.querySelectorAll("[draggable=true]").forEach(el => el.addEventListener("dragstart", ev => {
      const item = itemOf(el); if (!item) return;
      game.tooltip?.deactivate?.();
      ev.dataTransfer.setData("text/plain", JSON.stringify({ ...item.toDragData(), wctSlot: el.dataset.slot ?? null }));
      ev.dataTransfer.effectAllowed = "copyMove";
    }));

    // Drop targets
    const targets = [...root.querySelectorAll(".wct-slot, [data-drop]")];
    for (const el of targets) {
      el.addEventListener("dragover", ev => { ev.preventDefault(); el.classList.add("over"); });
      el.addEventListener("dragleave", () => el.classList.remove("over"));
      el.addEventListener("drop", ev => { ev.preventDefault(); ev.stopPropagation(); el.classList.remove("over"); this._onDrop(ev, el); });
    }

    // Clicks
    root.querySelectorAll(".wct-slot").forEach(el => {
      el.addEventListener("click", ev => { ev.stopPropagation(); this._slotMenu(el); });
      el.addEventListener("contextmenu", ev => { ev.preventDefault(); const i = el.classList.contains("filled") ? itemOf(el) : null; if (i) unslotItem(i); });
    });
    root.querySelectorAll(".wct-item").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); this._equipFromBag(el, itemOf(el)); }));
    root.querySelector("[data-action=slotEquipped]")?.addEventListener("click", () => this.slotEquipped());
    root.addEventListener("click", ev => { if (!ev.target.closest(".wct-pop")) this._closePop(); });
  }

  async _onDrop(ev, el) {
    let data; try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
    if (data?.type !== "Item") return;
    const src = await Item.implementation.fromDropData(data).catch(() => null); if (!src) return;
    const slot = el.dataset.slot; const zone = el.dataset.drop;
    if (zone === "bag") {
      if (src.parent === this.actor) { if (src.getFlag(ID, "slot") && src.system.equipped) await unslotItem(src); return; }
      await adopt(this.actor, src, ev); return;
    }
    if (slot && !canSlot(src, slot)) return ui.notifications.warn(`${src.name} doesn't go in the ${SLOTS[slot].label} slot.`);
    if (!fits(src)) return ui.notifications.warn(`${src.name} can't be equipped.`);
    const item = await adopt(this.actor, src, ev); if (!item) return;
    if (slot) {
      // Dragging between the two finger or trinket slots swaps them.
      const from = data.wctSlot; const cur = slotted(this.actor);
      if (from && from !== slot && cur[from] === item && cur[slot] && canSlot(cur[slot], from) && group(from) === group(slot)) {
        await this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, [flagPath]: slot }, { _id: cur[slot].id, [flagPath]: from }]);
        return;
      }
      return slotItem(this.actor, item, slot);
    }
    return this._equipFromBag(null, item);
  }

  async _equipFromBag(el, item) {
    if (!item) return;
    const s = autoSlot(this.actor, item);
    if (s) return slotItem(this.actor, item, s);
    const f = fits(item); if (!f) return;
    this._showPop(el ?? this.element.querySelector(".wct-portrait"), `<h4>Where does ${esc(item.name)} go?</h4><ul>${f.slots.map(sl => `<li data-pick-slot="${sl}"><i class="fa-solid ${SLOTS[sl].icon}"></i> ${esc(SLOTS[sl].label)}${slotted(this.actor)[sl] ? ` <small>(replaces ${esc(slotted(this.actor)[sl].name)})</small>` : ""}</li>`).join("")}</ul>`,
      li => slotItem(this.actor, item, li.dataset.pickSlot));
  }

  _slotMenu(el) {
    const slot = el.dataset.slot; const cur = slotted(this.actor); const inSlot = el.classList.contains("filled") ? cur[slot] : null;
    if (el.classList.contains("ghost")) return ui.notifications.info(`${cur.mainhand.name} is two-handed: the off hand is taken.`);
    const choices = this.actor.items.filter(i => i !== inSlot && canSlot(i, slot) && !i.system.container).sort((a, b) => (fits(b).slots[0] === slot) - (fits(a).slots[0] === slot) || a.name.localeCompare(b.name));
    const where = i => { const s = Object.entries(cur).find(([, x]) => x === i)?.[0]; return s ? ` <small>(${esc(SLOTS[s].label)})</small>` : ""; };
    const rows = choices.map(i => `<li data-pick-item="${i.id}" style="--q:${qualityColor(i)}"><img src="${esc(i.img)}" alt=""> <span>${esc(i.name)}</span>${where(i)}</li>`).join("");
    this._showPop(el, `<h4>${esc(SLOTS[slot].label)}</h4>${inSlot ? `<p class="cur" style="--q:${qualityColor(inSlot)}"><img src="${esc(inSlot.img)}" alt=""> <span>${esc(inSlot.name)}</span></p>` : ""}<ul>${inSlot ? `<li data-pick-item="" class="remove"><i class="fa-solid fa-xmark"></i> Take off</li>` : ""}${rows || (inSlot ? "" : `<li class="none">Nothing on ${esc(this.actor.name)} fits here.</li>`)}</ul>`,
      li => { const id = li.dataset.pickItem; if (id === undefined) return; if (!id) return inSlot && unslotItem(inSlot); const it = this.actor.items.get(id); if (it) slotItem(this.actor, it, slot); });
  }

  _showPop(anchor, html, onPick) {
    const pop = this.element.querySelector(".wct-pop"); if (!pop) return;
    pop.innerHTML = html; pop.hidden = false;
    const box = this.element.querySelector(".wct-frame").getBoundingClientRect(); const r = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(4, r.left - box.left + r.width + 4), box.width - 234);
    pop.style.left = `${left}px`; pop.style.top = `${Math.max(4, r.top - box.top)}px`;
    pop.querySelectorAll("li[data-pick-item], li[data-pick-slot]").forEach(li => li.addEventListener("click", ev => { ev.stopPropagation(); this._closePop(); onPick(li); }));
  }
  _closePop() { const pop = this.element?.querySelector(".wct-pop"); if (pop) pop.hidden = true; }

  async _tooltip(el, item) {
    if (!item || !game.tooltip?.activate) return;
    this._tipFor = el;
    const desc = item.system.description?.value ?? "";
    const wowTip = desc.includes("font-size:1.08em");
    let body = "";
    try { body = await TextEditorImpl().enrichHTML(desc, { relativeTo: item, secrets: item.isOwner }); } catch { body = ""; }
    if (this._tipFor !== el || !el.matches(":hover")) return;
    const f = fits(item); const slot = item.getFlag(ID, "slot");
    const typeLine = [item.system.type?.label, f?.wow ? `WoW: ${f.wow}` : "", item.system.attunement === "required" ? (item.system.attuned ? "Attuned" : "Requires attunement") : ""].filter(Boolean).join(" · ");
    const tip = document.createElement("div");
    tip.className = "wct-tip-body";
    tip.innerHTML = wowTip ? `<div class="desc wow">${body}</div>` : `<h4 style="color:${qualityColor(item)}">${esc(item.name)}</h4>${typeLine ? `<p class="type">${esc(typeLine)}</p>` : ""}${body ? `<div class="desc">${body}</div>` : ""}`;
    if (wowTip && typeLine && item.system.attunement) tip.insertAdjacentHTML("beforeend", `<p class="type">${esc(typeLine)}</p>`);
    if (el.classList.contains("ghost")) tip.insertAdjacentHTML("afterbegin", `<p class="type">Two-handed: fills the off hand.</p>`);
    else if (el.classList.contains("wct-item") && item.system.equipped && !slot) tip.insertAdjacentHTML("beforeend", `<p class="type">Equipped, not in a slot.</p>`);
    game.tooltip.activate(el, { html: tip, cssClass: "wct-tip", direction: el.closest(".wct-col.right") ? "LEFT" : "RIGHT" });
  }

  /** Puts every equipped item that isn't in a slot into its best free slot. Items with no clear slot are left alone. */
  async slotEquipped() {
    const left = [];
    for (const i of unslottedItems(this.actor, slotted(this.actor)).filter(i => i.system.equipped)) {
      const cur = slotted(this.actor); const s = autoSlot(this.actor, i);
      if (!s || cur[s]) { left.push(i.name); continue; }
      if (s === "offhand" && cur.mainhand && isTwo(cur.mainhand)) { left.push(i.name); continue; }
      await this.actor.updateEmbeddedDocuments("Item", [{ _id: i.id, [flagPath]: s }]);
    }
    if (left.length) ui.notifications.info(`No free slot found for: ${left.join(", ")}. Click a slot to choose.`);
  }
}

/** Opens (or brings forward) the character pane for an actor: the given one, else the selected token's, else the user's character. */
export function characterPane(actor = null) {
  if (!game.settings.get(ID, "characterPane")) return ui.notifications.warn("The character pane is turned off in Wayfarer's Toolkit's settings.");
  if (typeof actor === "string") actor = fromUuidSync(actor) ?? game.actors.get(actor) ?? game.actors.getName(actor);
  actor ??= canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor) return ui.notifications.warn("Character pane: select a token or pass an actor.");
  if (!actor.isOwner) return ui.notifications.warn(`You don't own ${actor.name}.`);
  if (!actor.items || !actor.system?.attributes) return ui.notifications.warn(`${actor.name} has no equipment.`);
  let app = OPEN.get(actor.uuid);
  if (!app) { app = new CharacterPane(actor); OPEN.set(actor.uuid, app); }
  app.render({ force: true });
  return app;
}

/**
 * Armour-typed pieces worn in a slot other than Chest (WoW helms, shoulders, boots and so on are often typed as light, medium or
 * heavy armour with no AC) don't replace the body armour in dnd5e's AC calculation. Only the AC calculation is affected.
 */
export function patchArmorClass() {
  const AF = globalThis.dnd5e?.dataModels?.actor?.AttributesFields;
  if (!AF?.prepareArmorClass || AF.prepareArmorClass._wct) return;
  const orig = AF.prepareArmorClass;
  const patched = function (...args) {
    let hidden = [];
    try {
      if (game.settings.get(ID, "characterPane")) hidden = (this.parent?.itemTypes?.equipment ?? []).filter(i => i.system.equipped && isBodyArmor(i) && !isSuit(i));
    } catch (e) { hidden = []; }
    for (const i of hidden) i.system.equipped = false;
    try { return orig.apply(this, args); }
    finally { for (const i of hidden) i.system.equipped = true; }
  };
  patched._wct = true;
  AF.prepareArmorClass = patched;
}

/** Header button on dnd5e character and NPC sheets, and slot bookkeeping. */
export function registerHooks() {
  // Unequipping an item anywhere (the dnd5e sheet, a macro) takes it out of its slot too.
  Hooks.on("preUpdateItem", (item, changes) => {
    if (foundry.utils.getProperty(changes, "system.equipped") === false && item.getFlag(ID, "slot") && !foundry.utils.hasProperty(changes, flagPath))
      foundry.utils.setProperty(changes, flagPath, null);
  });
  const add = (app, controls) => {
    const actor = app.document ?? app.actor;
    if (!actor || !["character", "npc"].includes(actor.type) || !actor.isOwner || !game.settings.get(ID, "characterPane")) return;
    if (controls.some(c => c.action === "wctCharacterPane")) return;
    controls.unshift({ icon: "fa-solid fa-shirt", label: "Character Pane", action: "wctCharacterPane", visible: true, onClick: () => characterPane(actor) });
  };
  Hooks.on("getHeaderControlsBaseActorSheet", add);
  // A visible button in the window header as well as the controls menu.
  Hooks.on("renderBaseActorSheet", (app, element) => {
    const actor = app.document ?? app.actor; const html = app.element ?? element;
    const header = html?.querySelector?.(".window-header"); if (!header) return;
    if (!actor || !["character", "npc"].includes(actor.type) || !actor.isOwner || !game.settings.get(ID, "characterPane")) return header.querySelector(".wct-pane-btn")?.remove();
    if (header.querySelector(".wct-pane-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "header-control icon fa-solid fa-shirt wct-pane-btn";
    btn.dataset.tooltip = "Character Pane"; btn.setAttribute("aria-label", "Character Pane");
    btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); characterPane(actor); });
    btn.addEventListener("pointerdown", ev => ev.stopPropagation());
    const anchor = header.querySelector("[data-action=toggleControls]") ?? header.querySelector("[data-action=close]");
    anchor ? anchor.before(btn) : header.append(btn);
  });
}
