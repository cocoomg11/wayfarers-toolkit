/**
 * Party gold tracker (feature "partyGold"): a GM-only, read-only window. It sums the coin of the player characters (actors of type
 * character with a player owner) and the party group actor, coins in their containers included, and optionally the price of
 * their mundane gear, then compares that with the wealth curve (gold per character per act) × the Party size setting. Nothing in
 * the world is changed, except the snapshot list (hidden world setting goldSnapshots) when the GM clicks Take snapshot. There's no
 * automatic snapshot at Session Start: Session Start has no hook to listen to. Maths: gold-model.mjs.
 */
import * as G from "./gold-model.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
const KEY = "goldSnapshots";
let API = null;

export function registerSettings() {
  game.settings.register(ID, KEY, { scope: "world", config: false, type: Object, default: { v: 1, list: [] }, onChange: () => refresh() });
}

export const snapshots = () => { const v = get(KEY, null); return Array.isArray(v?.list) ? v.list : []; };

/** Player characters: character actors at least one non-GM user owns or has assigned. */
function playerCharacters() {
  const players = game.users.filter(u => !u.isGM);
  return game.actors.filter(a => a.type === "character" && players.some(u => (u.character?.id ?? u.character) === a.id || a.testUserPermission?.(u, "OWNER")));
}

/** The coin values in use: { key: value in the smallest coin }. */
const coinVals = api => Object.fromEntries(api.coins());

/** An actor's coin (and its containers' coin) and its mundane gear, in the smallest coin. */
function actorWealth(actor, vals) {
  let coin = G.coinBase(actor.system?.currency, vals);
  const items = [];
  for (const i of actor.items ?? []) {
    if (i.type === "container") coin += G.coinBase(i.system?.currency, vals);
    items.push({ type: i.type, rarity: i.system?.rarity ?? "", magical: !!(i.system?.properties?.has?.("mgc") || i.system?.attunement), quantity: i.system?.quantity ?? 1, price: i.system?.price });
  }
  return { coin, gear: G.gearBase(items, vals) };
}

/** GM: everything the window shows. */
export function read(api = API) {
  const vals = coinVals(api); const gpVal = vals.gp ?? 100;
  const { curve, error } = G.parseCurve(get("goldCurve", G.curveText()));
  const useCurve = curve ?? G.DEFAULT_CURVE;
  const includeGear = !!get("goldIncludeGear", false);
  const size = api.partySize;
  const people = [];
  for (const a of playerCharacters()) people.push({ name: a.name, kind: "character", ...actorWealth(a, vals) });
  const party = api.partyActor();
  if (party) people.push({ name: party.name, kind: "party", ...actorWealth(party, vals) });
  const coin = people.reduce((t, p) => t + p.coin, 0); const gear = people.reduce((t, p) => t + p.gear, 0);
  const wealth = coin + (includeGear ? gear : 0);
  const act = G.clampAct(get("goldAct", 1), useCurve);
  const rows = G.actRows({ curve: useCurve, size, wealth, gpVal, current: act });
  return { people, coin, gear, wealth, includeGear, size, act, rows, curveError: error, gpVal, perChar: Math.round(wealth / Math.max(1, size)) };
}

/** GM: saves a snapshot of the party's wealth (newest first, the last 50 kept). */
export async function snapshot(api = API, note = "") {
  if (!game.user.isGM) return null;
  const r = read(api); const cur = r.rows.find(x => x.current);
  const snap = { at: Date.now(), worldTime: game.time?.worldTime ?? 0, note: String(note ?? ""), coin: r.coin, gear: r.gear, wealth: r.wealth, act: r.act, target: cur?.target ?? 0, status: cur?.status ?? "green", size: r.size };
  await game.settings.set(ID, KEY, { v: 1, list: G.addSnapshot(snapshots(), snap) });
  return snap;
}

export function open(api) {
  API = api;
  const app = foundry.applications.instances?.get?.(`${ID}-party-gold`) ?? new PartyGoldApp();
  return app.render({ force: true });
}
export function refresh() { const app = foundry.applications.instances?.get?.(`${ID}-party-gold`); if (app?.rendered) app.render(); }

const DOT = { green: "fa-circle-check", amber: "fa-circle-exclamation", red: "fa-circle-xmark" };

export class PartyGoldApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-party-gold`, classes: ["wct-panel", "wct-window", "wct-gold"],
    window: { title: "Party gold", icon: "fa-solid fa-scale-balanced", resizable: true },
    position: { width: 640, height: 640 }
  };

  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-gold-body";
    if (!game.user.isGM) { div.innerHTML = `<p class="wct-pad">The party gold tracker is for GMs.</p>`; return div; }
    const r = read(API); const m = API.fmtMoney.bind(API);
    const cur = r.rows.find(x => x.current);
    const people = r.people.length ? `<table class="wct-grid"><thead><tr><th>Who</th><th>Coin</th><th>Mundane gear</th></tr></thead><tbody>${r.people.map(p => `<tr><td>${esc(p.name)}${p.kind === "party" ? ' <span class="hint">(party actor)</span>' : ""}</td><td>${esc(m(p.coin))}</td><td class="${r.includeGear ? "" : "wct-dim"}">${esc(m(p.gear))}</td></tr>`).join("")}</tbody></table>`
      : `<p class="hint">No player characters (characters a player owns) and no party actor yet.</p>`;
    const rows = r.rows.map(x => `<tr class="${x.current ? "current" : ""}"><td>Act/Tier ${x.act}${x.current ? " <strong>(now)</strong>" : ""}</td><td>${esc(m(x.perChar * r.gpVal))}</td><td>${esc(m(x.target))}</td><td>${x.ratio == null ? "–" : `${Math.round(x.ratio * 100)}%`}</td><td class="wct-gold-status ${x.status}"><i class="fa-solid ${DOT[x.status]}"></i> ${esc(x.direction)}</td></tr>`).join("");
    const snaps = snapshots().slice(0, 10);
    div.innerHTML = `<div class="wct-main">
      ${r.curveError ? `<p class="wct-note warn"><i class="fa-solid fa-triangle-exclamation"></i> The wealth curve setting couldn't be read (${esc(r.curveError)}), so the default curve is shown. Fix it in control panel › Loot.</p>` : ""}
      <div class="wct-banner ${cur?.status === "green" ? "ok" : "warn"}"><i class="fa-solid ${DOT[cur?.status ?? "green"]}"></i><div>
        <strong>${esc(m(r.wealth))}</strong> party wealth${r.includeGear ? " (coin and mundane gear)" : " (coin)"} · ${esc(m(r.perChar))} per character
        <p>Act/Tier ${r.act} expects ${esc(m(cur?.target ?? 0))} for ${r.size} character${r.size === 1 ? "" : "s"}: ${esc(cur?.direction ?? "")}.</p></div></div>
      <h3>Who carries it</h3>${people}
      <h3>Against the wealth curve</h3>
      <table class="wct-grid"><thead><tr><th>Act / tier</th><th>Per character</th><th>× ${r.size} party</th><th>Party has</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="hint">Green: 75% to 150% of the target. Amber: 50% to 75% or 150% to 200%. Red: further off. Edit the curve, the current act and whether gear counts in control panel › Loot; party size there too.</p>
      <h3>Snapshots</h3>
      ${snaps.length ? `<table class="wct-grid"><thead><tr><th>When</th><th>Note</th><th>Wealth</th><th>Act</th><th>Status</th></tr></thead><tbody>${snaps.map(s => `<tr><td>${esc(new Date(s.at).toLocaleString())}</td><td>${esc(s.note)}</td><td>${esc(m(s.wealth))}</td><td>${esc(s.act)}</td><td class="wct-gold-status ${esc(s.status)}"><i class="fa-solid ${DOT[s.status] ?? DOT.green}"></i></td></tr>`).join("")}</tbody></table>` : `<p class="hint">None yet. Take snapshot saves the party's wealth now (the last 50 are kept).</p>`}
      </div>
      <footer class="wct-footer"><span class="hint">Read-only: nothing on the characters is changed.</span><button type="button" data-do="snap"><i class="fa-solid fa-camera"></i> Take snapshot</button><button type="button" data-do="again"><i class="fa-solid fa-rotate"></i> Refresh</button></footer>`;
    return div;
  }
  _replaceHTML(result, content) {
    content.replaceChildren(result);
    result.querySelector('[data-do="again"]')?.addEventListener("click", () => this.render());
    result.querySelector('[data-do="snap"]')?.addEventListener("click", async () => { await snapshot(API, "Manual"); ui.notifications.info("Party gold: snapshot saved."); });
  }
}
