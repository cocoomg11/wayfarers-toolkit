/**
 * Renown (feature `renown`), the pure HTML (no Foundry calls; tested in Node): the character sheet's Reputation page (also the
 * standalone Reputation window), the award chat card and the award dialog's preview line. renown.mjs / renown-apps.mjs gather the
 * facts; everything shown is escaped here.
 *
 * The page groups factions by category (subfactions under their parent side, others under their group), pins the tracked faction at
 * the top, filters (All / Subfactions / Neutral, Show inactive, search) and sorts (renown or name). Hidden factions only ever reach
 * this code on a GM's client (players' facts never contain them); a GM sees them marked "hidden from players".
 */
import { esc } from "../vendor/wanderers-core/index.mjs";
import * as R from "./renown-model.mjs";

const svg = (d, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
export const ICONS = Object.freeze({
  page: "M5 21V4M5 4h12l-2.5 4L17 12H5",
  crest: "M12 3l8 3v6c0 5-4 8-8 9c-4-1-8-4-8-9V6z",
  star: "M12 3l2.6 5.6l6 .7l-4.5 4.1l1.2 6L12 16.4L6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4",
  open: "M6 9l6 6l6-6",
  closed: "M9 6l6 6l-6 6",
  hidden: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.6 6.6A17 17 0 0 0 2 12s4 6 10 6a9.6 9.6 0 0 0 4.4-1.1",
  plus: "M12 5v14M5 12h14",
  award: "M12 3v10M7 8h10M7 19h10",
  x: "M6 6l12 12M18 6L6 18"
});
export const FILTERS = Object.freeze([{ key: "all", label: "All" }, { key: "sub", label: "Subfactions" }, { key: "neutral", label: "Neutral" }]);
export const SORTS = Object.freeze({ renown: "renown", name: "name" });
export const INACTIVE_GROUP = "Inactive";

/** Per-window page state, cleaned. @param {any} [s] */
export function pageState(s = {}) {
  const o = s && typeof s === "object" ? s : {};
  return {
    search: String(o.search ?? "").slice(0, 80), filter: FILTERS.some(f => f.key === o.filter) ? o.filter : "all",
    inactive: !!o.inactive, sort: o.sort === "name" ? "name" : "renown", closed: Array.isArray(o.closed) ? o.closed.map(String) : []
  };
}

/**
 * The page's view model.
 * @param {{ factions?: any[], config?: any, entries?: Record<string, any>, tracked?: string, isGM?: boolean, canTrack?: boolean, edit?: boolean, name?: string }} f
 *   `factions`: what this user may see (GM: visible and hidden, marked `hidden`); `entries`: { factionId: { score, ribbons } }.
 * @param {any} [state]
 */
export function pageModel(f = {}, state = {}) {
  const st = pageState(state); const config = R.normalizeConfig(f.config);
  const q = st.search.trim().toLowerCase();
  const row = fac => {
    const tiers = R.tiersOf(fac, config); const entry = R.normalizeEntry(f.entries?.[fac.id]); const s = R.standing(entry, tiers);
    return {
      id: fac.id, name: fac.name, note: fac.note, hidden: !!fac.hidden, inactive: !!fac.inactive, sub: !!fac.parent,
      group: fac.inactive ? INACTIVE_GROUP : R.groupOf(fac), score: entry.score, ribbons: entry.ribbons, s, tiers,
      discount: R.discountText(s.tier), now: R.tierText(s.tier), next: s.next ? R.tierText(s.next) : "", tracked: f.tracked === fac.id,
      merchants: (fac.merchants ?? []).length
    };
  };
  const all = (f.factions ?? []).map(row);
  const tracked = all.find(r => r.tracked) ?? null;
  const shown = all.filter(r => (st.inactive || !r.inactive)
    && (st.filter === "all" || (st.filter === "sub" ? r.sub : !r.sub))
    && (!q || r.name.toLowerCase().includes(q) || r.note.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)));
  const sorted = [...shown].sort(st.sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.s.total - a.s.total || a.name.localeCompare(b.name));
  /** @type {Map<string, any[]>} */
  const groups = new Map();
  for (const r of sorted) { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group)?.push(r); }
  // Groups in the order their first faction appears in the setup list; Inactive last.
  const order = [...new Set(all.map(r => r.group))].sort((a, b) => (a === INACTIVE_GROUP ? 1 : 0) - (b === INACTIVE_GROUP ? 1 : 0));
  return {
    st, isGM: !!f.isGM, canTrack: !!f.canTrack, edit: !!f.edit && !!f.isGM, name: String(f.name ?? ""),
    tracked, count: all.length, shown: shown.length,
    groups: order.filter(g => groups.has(g)).map(g => ({ label: g, rows: groups.get(g) ?? [], open: !st.closed.includes(g) })),
    tiers: config.tiers
  };
}

const bar = (s, label) => `<div class="wct-rn-bar" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.pct}" style="--tc:${esc(s.color)}"><i style="width:${s.pct}%"></i><span>${esc(s.bar)}</span></div>`;
const hiddenTag = `<span class="wct-rn-hid" data-tooltip="Players don't see this faction">${svg(ICONS.hidden)}hidden from players</span>`;

/** One faction row. @param {any} r @param {any} m */
function rowHTML(r, m) {
  const ribbons = r.ribbons.length ? `<span class="wct-rn-ribs">${r.ribbons.map(b => `<span class="wct-rn-rib" data-tooltip="Other source, added by the GM">${esc(b.text)} ${esc(R.signed(b.amount))}${m.isGM ? `<button type="button" class="wct-rn-x" data-wct-rn="unribbon" data-faction="${esc(r.id)}" data-ribbon="${esc(b.id)}" aria-label="Remove ${esc(b.text)}">${svg(ICONS.x)}</button>` : ""}</span>`).join("")}</span>` : "";
  const tip = [r.now && `Now: ${r.now}`, r.s.next && `At ${r.s.next.name} (${r.s.next.from}): ${r.next || "—"}`].filter(Boolean).join("<br>");
  const score = m.edit ? `<label class="wct-rn-score" data-tooltip="Score without other sources"><span class="wc-sr">${esc(r.name)} score</span><input type="text" inputmode="numeric" data-wct-rn-score="${esc(r.id)}" value="${r.score}"></label>` : "";
  const gm = m.isGM ? `<button type="button" class="wct-rn-ic" data-wct-rn="award" data-faction="${esc(r.id)}" aria-label="Award renown with ${esc(r.name)}" data-tooltip="Award or take renown">${svg(ICONS.award)}</button><button type="button" class="wct-rn-ic" data-wct-rn="ribbon" data-faction="${esc(r.id)}" aria-label="Add another source for ${esc(r.name)}" data-tooltip="Add another source (a label with an amount)">${svg(ICONS.plus)}</button>` : "";
  const track = m.canTrack
    ? `<button type="button" class="wct-rn-ic${r.tracked ? " on" : ""}" data-wct-rn="track" data-faction="${esc(r.id)}" aria-pressed="${r.tracked}" aria-label="Track ${esc(r.name)}" data-tooltip="${r.tracked ? "Tracked: shown at the top" : "Track: pin at the top"}">${svg(ICONS.star)}</button>`
    : r.tracked ? `<span class="wct-rn-ic on static" aria-label="Tracked">${svg(ICONS.star)}</span>` : "<span></span>";
  return `<div class="wct-rn-row" data-faction-id="${esc(r.id)}" style="--tc:${esc(r.s.color)}">
    <span class="wct-rn-crest">${svg(ICONS.crest)}</span>
    <span class="wct-rn-nm"><b>${esc(r.name)}${r.hidden ? hiddenTag : ""}</b>${r.note ? `<small>${esc(r.note)}</small>` : ""}${ribbons}</span>
    <span class="wct-rn-tier"${tip ? ` data-tooltip="${esc(tip)}"` : ""}>${esc(r.s.name)}</span>
    ${bar(r.s, `${r.name} renown`)}
    <span class="wct-rn-disc${r.s.discount ? " on" : ""}" data-tooltip="${esc(r.merchants ? `At ${r.name} merchants` : "Discount at this faction's merchants (none linked yet)")}">${esc(r.discount)}</span>
    <span class="wct-rn-acts">${score}${gm}${track}</span>
  </div>`;
}

/** The tracked faction's box. @param {any} r */
function trackedHTML(r) {
  return `<section class="wct-cs-box wct-rn-tracked" style="--tc:${esc(r.s.color)}">
    <h4>${svg(ICONS.star)}Tracked<span class="r">pinned for this character</span></h4>
    <div class="wct-rn-tbody">
      <span class="wct-rn-crest big">${svg(ICONS.crest)}</span>
      <div class="wct-rn-thead"><b>${esc(r.name)}</b><span class="wct-rn-tier">${esc(r.s.name)}</span>${r.hidden ? hiddenTag : ""}${r.note ? `<span class="wct-cs-dim">${esc(r.note)}</span>` : ""}<span class="wct-rn-num">Renown ${r.s.total}</span></div>
      ${bar(r.s, `${r.name} renown`)}
      <p class="wct-rn-line">Now: ${esc([r.s.tier ? r.s.name : "no tier yet", r.now].filter(Boolean).join(" · "))}</p>
      ${r.s.next ? `<p class="wct-rn-line">${svg(ICONS.lock)}At <b style="color:${esc(r.s.next.color)}">${esc(r.s.next.name)}</b> (${r.s.next.from}): ${esc(r.next || "no perk written yet")}</p>` : `<p class="wct-rn-line">Top tier reached.</p>`}
    </div>
  </section>`;
}

/** The page body (inside the sheet's page, or the Reputation window). @param {ReturnType<typeof pageModel>} m */
export function pageHTML(m) {
  if (!m.count) {
    return `<div class="wct-rn"><div class="wct-cs-placeholder"><p>No factions yet.</p>${m.isGM ? `<p>Set them up in <em>Factions and renown</em> (control panel › Character).</p><p><button type="button" class="wct-cs-gbtn" data-wct-rn="setup">Factions and renown…</button></p>` : `<p>The GM hasn't set up any factions you know of.</p>`}</div></div>`;
  }
  const chip = (attr, label, on) => `<button type="button" class="wct-cs-chip${on ? " on" : ""}" ${attr} aria-pressed="${on}">${esc(label)}</button>`;
  const tbar = `<div class="wct-cs-tbar"><label class="wct-cs-srch">${svg(ICONS.search)}<span class="wc-sr">Search factions</span><input type="search" data-wct-rn-search value="${esc(m.st.search)}" placeholder="Search factions"></label>
    ${FILTERS.map(f => chip(`data-wct-rn="filter" data-value="${f.key}"`, f.label, m.st.filter === f.key)).join("")}
    ${chip(`data-wct-rn="inactive"`, "Show inactive", m.st.inactive)}
    <button type="button" class="wct-cs-chip" data-wct-rn="sort" data-tooltip="Sort order">Sort: ${m.st.sort === "name" ? "name" : "renown"}</button>
    ${m.isGM ? `<button type="button" class="wct-cs-gbtn sm" data-wct-rn="award">${svg(ICONS.award)} Award</button><button type="button" class="wct-cs-chip" data-wct-rn="setup" data-tooltip="Factions and renown (GM)">Factions…</button>` : ""}</div>`;
  const groups = m.groups.map(g => `<div class="wct-rn-grp">
      <h4 class="wct-rn-gh"><button type="button" class="wct-rn-cat" data-wct-rn="group" data-group="${esc(g.label)}" aria-expanded="${g.open}">${svg(g.open ? ICONS.open : ICONS.closed)}${esc(g.label)}<span class="n">${g.rows.length} ${g.rows.length === 1 ? "faction" : "factions"}</span></button></h4>
      ${g.open ? g.rows.map(r => rowHTML(r, m)).join("") : ""}
    </div>`).join("");
  const tiers = `<div class="wct-rn-key"><span class="wct-cs-lab">Renown tiers</span><span class="wct-rn-tkey"><span style="--tc:${R.NO_TIER.color}">${R.NO_TIER.name} 0–${Math.max(0, (m.tiers[0]?.from ?? 1) - 1)}</span>${m.tiers.map(t => `<span style="--tc:${esc(t.color)}" data-tooltip="${esc(R.tierText(t) || "No perk written yet")}">${esc(t.name)} ${t.from}</span>`).join("")}</span></div>`;
  return `<div class="wct-rn">
    ${m.tracked ? trackedHTML(m.tracked) : ""}
    <section class="wct-cs-box wct-rn-list">${tbar}
      ${m.shown ? groups : `<p class="wct-cs-dim wct-rn-none">No faction matches.</p>`}
      ${tiers}
    </section>
    <p class="wct-cs-dim wct-rn-foot">Renown is kept for this character only (no party score). It never goes below 0.</p>
  </div>`;
}

// ---------------------------------------------------------------- the award card
/**
 * The award chat card. `rows`: [{ name, delta, roll?: { formula, total }, before, after, tierBefore, tierAfter, tierName, tierColor,
 * tierText }]. One header amount when every row has the same flat change; otherwise each row shows its own.
 * @param {{ faction: string, reason?: string, rows: any[] }} c
 */
export function cardHTML({ faction, reason = "", rows = [] }) {
  const same = rows.length > 0 && rows.every(r => !r.roll && r.delta === rows[0].delta);
  const head = same ? `${R.signed(rows[0].delta)} renown` : "Renown";
  const line = r => {
    const up = r.tierAfter !== r.tierBefore;
    const roll = r.roll ? ` <span class="wct-rn-roll">(${esc(r.roll.formula)} = ${r.roll.total})</span>` : "";
    const change = same ? "" : `<b class="${r.delta >= 0 ? "pos" : "neg"}">${esc(R.signed(r.delta))}</b>${roll} `;
    const tier = up
      ? ` is now <span class="wct-rn-tierup" style="--tc:${esc(r.tierColor)}">${esc(r.tierName)}</span> (${r.after})${r.tierText && r.tierAfter > r.tierBefore ? `: ${esc(r.tierText)}` : ""}`
      : ` ${r.before} → ${r.after}${r.tierName ? ` <span class="wct-cs-dim">(${esc(r.tierName)})</span>` : ""}`;
    return `<li>${change}<strong>${esc(r.name)}</strong>${tier}</li>`;
  };
  return `<div class="wct-rn-card"><header><span class="wct-rn-amt${same && rows[0].delta < 0 ? " neg" : ""}">${esc(head)}</span> ${esc(faction)}</header>
    <ul>${rows.map(line).join("")}</ul>${reason ? `<p class="wct-rn-why">${esc(reason)}</p>` : ""}</div>`;
}

/**
 * The award dialog's preview line. `rows`: [{ name, total, tiers }] for the picked characters; `amount` from parseAmount.
 * @param {Array<{ name: string, entry: any, tiers: any[] }>} rows @param {ReturnType<typeof R.parseAmount>} amount
 */
export function awardHint(rows, amount) {
  if (!rows.length) return "Pick at least one character.";
  if (!amount) return "Choose a gain, a loss or type an amount (e.g. +2, −1 or −2d6).";
  if (amount.kind === "dice") return `Each character rolls ${amount.formula} and ${amount.sign < 0 ? "loses" : "gains"} it on their own score (never below 0).`;
  const parts = rows.map(r => {
    const before = R.totalOf(r.entry);
    const after = R.totalOf({ ...r.entry, score: R.applyDelta(r.entry?.score ?? 0, amount.value) });
    const ti = R.tierIndex(after, r.tiers);
    return `${r.name.split(" ")[0]} ${before} → ${after}${ti !== R.tierIndex(before, r.tiers) && ti >= 0 ? ` (${r.tiers[ti].name})` : ""}`;
  });
  return `Each character ${amount.value >= 0 ? "gains" : "loses"} it on their own score: ${parts.join(" · ")}.`;
}
