/**
 * Character pane 1.30 ("classic sheet"), the pure part (no Foundry calls; tested in Node): the sheet's subtitle, the HP bar with
 * its temporary segment, the purse in copper for core's coins(), the stat boxes (attributes, defence) and the Attack box, which
 * follows the weapon set in hand. Also the empty-slot outlines: small original line drawings (24 × 24, stroke only, drawn for
 * this module), one per slot. pane.mjs reads the actor's prepared dnd5e data into plain facts and builds the HTML from these.
 */
import { esc, quality } from "../vendor/wanderers-core/index.mjs";

// ---------------------------------------------------------------- empty-slot outlines
/** Line drawings on a 24 × 24 grid (stroke: currentColor, no fill). Own artwork; nothing copied. */
export const GLYPHS = Object.freeze({
  helm: "M5 15V11a7 7 0 0 1 14 0v4M5 15h14M5 15v3h4v-3M15 15v3h4v-3M12 4v4M9 11h6",
  pendant: "M6 4c0 5 2.5 8 6 9 3.5-1 6-4 6-9M12 13l-3 3 3 4 3-4z",
  pauldron: "M4 14c0-5 3.5-8 8-8s8 3 8 8M4 14c2.5-1.5 5.5-2 8-2s5.5.5 8 2M7 9.5l1.5 2.5M12 6v4M17 9.5L15.5 12",
  cloak: "M9 4h6M9 4c-1 4-3 9-5 16h16c-2-7-4-12-5-16M12 6v14M8.5 13l-1.5 7M15.5 13l1.5 7",
  chest: "M8 4l-4 3v5l3 1v7h10v-7l3-1V7l-4-3M8 4c1 2 2.5 3 4 3s3-1 4-3M12 7v13",
  shirt: "M8 4L3 7l2 4 2-1v10h10V10l2 1 2-4-5-3M8 4c.5 1.5 2 2.5 4 2.5S15.5 5.5 16 4",
  tabard: "M7 3h10v13l-5 5-5-5zM7 7h10M12 10l-2 2 2 2 2-2z",
  bracers: "M6 6h12v12H6zM6 10h12M6 14h12M9 6v12",
  gloves: "M7 21v-7L5 10.5 6.5 9 8 11V5a1.2 1.2 0 0 1 2.4 0v5M10.4 4a1.2 1.2 0 0 1 2.4 0v6M12.8 5a1.2 1.2 0 0 1 2.4 0v6M15.2 7a1.2 1.2 0 0 1 2.4 0v7c0 3-1.5 5-3 7",
  belt: "M3 9h18v6H3zM10 8h4v8h-4zM12 11v2",
  legs: "M6 4h12l-1 17h-4l-1-11-1 11H7zM6 7h12",
  boot: "M8 3h6v10l5 3v4H6V3M8 3V2M6 17h13",
  ring: "M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 18a3 3 0 1 0 0-6M9.5 9l2.5-5 2.5 5",
  gem: "M7 4h10l4 5-9 11L3 9zM3 9h18M9.5 4L8 9l4 11M14.5 4L16 9l-4 11",
  sword: "M18 3h3v3L9 18M9 18l-3-3M6 15l-2 2M7 19l-2 2-2-2 2-2M6 13l5 5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6zM12 3v18.5M4 11h16",
  bow: "M6 3c7 2 11 8 9 18M6 3l9 18M3 12h14M14 9l3 3-3 3",
  relic: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"
});

/** Which outline each slot shows. */
export const SLOT_GLYPH = Object.freeze({
  head: "helm", neck: "pendant", shoulder: "pauldron", back: "cloak", chest: "chest", shirt: "shirt", tabard: "tabard", wrist: "bracers",
  hands: "gloves", waist: "belt", legs: "legs", feet: "boot", finger1: "ring", finger2: "ring", trinket1: "gem", trinket2: "gem",
  mainhand: "sword", offhand: "shield", ranged: "bow", relic: "relic"
});

/** The outline of a slot (or a glyph name) as inline SVG, hidden from screen readers (the slot carries its own label). */
export function glyph(slot) {
  const d = GLYPHS[SLOT_GLYPH[slot] ?? slot] ?? GLYPHS.gem;
  return `<svg class="wct-glyph-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

// ---------------------------------------------------------------- item quality
/** Classic tooltip name colours → core's quality keys (items carrying an MMO-style tooltip). */
const TIP_QUALITY = Object.freeze({ "#9d9d9d": "poor", "#ffffff": "common", "#fff": "common", "#1eff00": "uncommon", "#0070dd": "rare", "#a335ee": "epic", "#ff8000": "legendary", "#e6cc80": "artifact" });

/** The quality key of an item: its tooltip colour when it has one, else core's quality() of its dnd5e rarity. @param {{ color?: string | null, rarity?: unknown }} f */
export function qualityKey(f = {}) {
  const c = String(f.color ?? "").toLowerCase();
  return TIP_QUALITY[c] ?? quality(f.rarity);
}

// ---------------------------------------------------------------- header
/**
 * "Level 5 Fighter · Human · The Party": level (a number, or "CR 2" text for NPCs), classes, species, party name; blanks left out.
 * @param {{ level?: number | string | null, classes?: string, species?: string, party?: string }} f
 */
export function subtitle(f = {}) {
  const lv = typeof f.level === "number" ? `Level ${f.level}` : String(f.level ?? "").trim();
  const first = [lv, String(f.classes ?? "").trim()].filter(Boolean).join(" ");
  return [first, String(f.species ?? "").trim(), String(f.party ?? "").trim()].filter(Boolean).join(" · ");
}

/** The Rested pill's tooltip. @param {{ inn?: string, benefit?: string }} f */
export const restedTip = (f = {}) => `Rested at ${f.inn || "the inn"}: ${f.benefit ? `${f.benefit} at the end of the next long rest` : "a bonus at the end of the next long rest"}.`;

// ---------------------------------------------------------------- HP bar
const num = v => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : null);

/**
 * The HP bar: { value, max, temp, hpPct, tempPct, tone, text } or null without a maximum. The bar's full width is max + temp, so
 * temporary HP shows as its own segment after the current HP. tone: ok above half, warn above a quarter, bad below.
 * @param {{ value?: unknown, max?: unknown, temp?: unknown, effectiveMax?: unknown }} hp
 */
export function hpBar(hp = {}) {
  const max = num(hp?.effectiveMax) ?? num(hp?.max); if (!max || max <= 0) return null;
  const value = Math.max(0, num(hp?.value) ?? 0); const temp = Math.max(0, num(hp?.temp) ?? 0);
  const total = max + temp;
  const hpPct = Math.round(Math.min(value, max) / total * 1000) / 10; const tempPct = Math.round(temp / total * 1000) / 10;
  const ratio = value / max;
  return { value, max, temp, hpPct, tempPct, tone: ratio > 0.5 ? "ok" : ratio > 0.25 ? "warn" : "bad", text: `${value} / ${max}${temp ? ` (+${temp})` : ""}` };
}

// ---------------------------------------------------------------- coins
/**
 * An actor's purse in the smallest coin, and the ratio for core's coins(): `currency` is `system.currency`, `values` the coins in
 * use as [[key, value in the smallest coin], …] (api.coins()). Platinum and electrum count at their value; the ratio is the copper
 * per silver (10 in standard 5e, 100 with three coins).
 * @param {Record<string, unknown>} currency @param {Array<[string, number]>} values
 * @returns {{ copper: number, ratio: number }}
 */
export function purse(currency = {}, values = []) {
  const v = Object.fromEntries(values ?? []);
  const val = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1, ...v };
  let copper = 0;
  for (const [k, n] of Object.entries(currency ?? {})) if (val[k] > 0 && Number.isFinite(Number(n))) copper += Math.max(0, Number(n)) * val[k];
  const ratio = val.sp > 0 && val.gp > 0 && Math.round(val.gp / val.sp) === Math.round(val.sp / (val.cp || 1)) ? Math.round(val.sp / (val.cp || 1)) : 10;
  return { copper: Math.round(copper), ratio };
}

// ---------------------------------------------------------------- stat boxes
export const sign = (/** @type {unknown} */ n) => { const v = Number(n); return Number.isFinite(v) ? (v >= 0 ? `+${v}` : `−${Math.abs(v)}`) : "–"; };
/** A save bonus from dnd5e data: a number (older dnd5e) or `{ value }` (5.x / 6.x). */
export const saveValue = (/** @type {any} */ s) => (typeof s === "number" ? s : num(s?.value));

/**
 * Attributes box rows: [{ key, label, abbr, value, mod }] in dnd5e's ability order.
 * @param {Array<[string, { label?: string, abbreviation?: string }]>} config CONFIG.DND5E.abilities entries
 * @param {Record<string, any>} abilities system.abilities
 */
export function attributes(config = [], abilities = {}) {
  return config.filter(([k]) => abilities?.[k]).map(([k, c]) => ({ key: k, label: String(c?.label ?? k), abbr: String(c?.abbreviation ?? k).toUpperCase(), value: num(abilities[k].value), mod: num(abilities[k].mod) ?? 0 }));
}

/**
 * Defence box: { ac, hp, hd, init, speed, saves: [{ abbr, value, prof }] } with display text.
 * @param {{ ac?: unknown, hp?: any, hd?: { value?: unknown, max?: unknown, denom?: string } | null, init?: unknown, speed?: { walk?: unknown, units?: string } | null, saves?: Array<{ abbr: string, value: unknown, prof?: boolean }> }} f
 */
export function defence(f = {}) {
  const hp = hpBar(f.hp ?? {});
  const hdv = num(f.hd?.value); const hdm = num(f.hd?.max);
  const walk = num(f.speed?.walk);
  return {
    ac: num(f.ac) ?? "–",
    hp: hp ? hp.text : "–",
    hd: hdm ? `${hdv ?? hdm} / ${hdm}${f.hd?.denom ? ` ${f.hd.denom}` : ""}` : "–",
    init: num(f.init) === null ? "–" : sign(f.init),
    speed: walk === null ? "–" : `${walk} ${f.speed?.units || "ft"}`,
    saves: (f.saves ?? []).map(s => ({ abbr: s.abbr, value: saveValue(s.value) === null ? "–" : sign(saveValue(s.value)), prof: !!s.prof }))
  };
}

// ---------------------------------------------------------------- Attack box
export const ATTACK_MODES = Object.freeze({ melee: "Melee", ranged: "Ranged", spell: "Spell" });

/**
 * Which attack the box shows. `override` ("melee" / "ranged" / "spell", from the box's dropdown) wins; "auto" (or nothing) follows
 * the weapon set in hand: Ranged set → ranged; Utility set → spell for a caster, else melee; Melee set → melee, or spell when a
 * caster holds a focus there and no weapon.
 * @param {{ active?: string, override?: string, caster?: boolean, focusInHand?: boolean, weaponInHand?: boolean }} f
 */
export function attackMode(f = {}) {
  if (f.override && Object.hasOwn(ATTACK_MODES, f.override)) return f.override;
  if (f.active === "ranged") return "ranged";
  if (f.active === "utility") return f.caster ? "spell" : "melee";
  return f.caster && f.focusInHand && !f.weaponInHand ? "spell" : "melee";
}

/**
 * The Attack box rows for a mode: [{ label, value }] plus `name` (weapon or focus) and `quality`. `weapon`: the set's main-hand
 * item facts { name, toHit, damage, range, quality } (dnd5e labels: labels.toHit, labels.damages[0].label, labels.range / reach);
 * `spell`: { attack, dc, ability, focus }. A missing value shows "–"; no weapon says so.
 * @param {string} mode @param {{ weapon?: any, spell?: any }} f
 */
export function attackRows(mode, f = {}) {
  const dash = (/** @type {unknown} */ v) => (v === null || v === undefined || v === "" ? "–" : String(v));
  if (mode === "spell") {
    const s = f.spell ?? {};
    return { name: s.focus?.name ?? "", quality: s.focus?.quality ?? "", empty: !s.ability ? "No spellcasting ability." : "", rows: [
      { label: "Spell attack", value: num(s.attack) === null ? "–" : sign(s.attack) },
      { label: "Spell save DC", value: dash(num(s.dc)) },
      { label: "Ability", value: dash(s.ability) }
    ] };
  }
  const w = f.weapon;
  if (!w) return { name: "", quality: "", empty: mode === "ranged" ? "No ranged weapon in the Ranged set." : "No weapon in hand.", rows: [] };
  const hit = String(w.toHit ?? "").trim();
  return { name: String(w.name ?? ""), quality: String(w.quality ?? ""), empty: "", rows: [
    { label: "To hit", value: hit ? (/^[+-]/.test(hit) ? hit : `+${hit}`) : "–" },
    { label: "Damage", value: dash(w.damage) },
    { label: "Range", value: dash(w.range) }
  ] };
}

/** The Attack box's dropdown: Auto (follows the set in hand, with the mode it picked) and the three modes. */
export function attackOptions(current = "auto", auto = "melee") {
  const opts = [["auto", `Auto (${ATTACK_MODES[auto] ?? "Melee"})`], ...Object.entries(ATTACK_MODES)];
  return opts.map(([k, l]) => `<option value="${k}"${k === current ? " selected" : ""}>${esc(l)}</option>`).join("");
}

/**
 * 1.32: the pane's height on a screen `viewH` px tall. Room kept for Foundry's bars: PANE_MARGIN. The minimum height is the sheet's
 * (`min`) when the screen has room, else what fits (never under PANE_FLOOR); the sheet then scrolls inside the window.
 */
export const PANE_MARGIN = 100, PANE_FLOOR = 360;
/** @param {number} viewH @param {number} min */
export const paneMinHeight = (viewH, min) => Number.isFinite(viewH) && viewH > 0 ? Math.max(PANE_FLOOR, Math.min(min, Math.floor(viewH - PANE_MARGIN))) : min;
/** The opening height: min(def, viewH - PANE_MARGIN), not below paneMinHeight. @param {number} viewH @param {{ def: number, min: number }} o */
export const paneHeight = (viewH, { def, min }) => Number.isFinite(viewH) && viewH > 0 ? Math.max(paneMinHeight(viewH, min), Math.min(def, Math.floor(viewH - PANE_MARGIN))) : def;
