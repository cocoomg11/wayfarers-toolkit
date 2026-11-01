/**
 * One-time data moves for 1.27.0, run once per world by the leader (the active GM's acting client) after load. Each move is recorded
 * in the GM-only store (bucket "migrations") and is safe to run again (it skips what's already moved). Old data is kept where noted,
 * so going back to 1.26 still finds it; nothing a player wrote is trusted.
 *
 *   inns1        scene flag `inn` { on, name, price } → one record in `inns` (the old flag is kept)
 *   vault1       world settings flightNetwork (full), goldSnapshots, lootHistoryData → GM-only store; then flightNetwork is
 *                rewritten to the players' view and goldSnapshots / lootHistoryData are emptied (copies in the store)
 *   quests1      full quest flags → GM-only store; the journal flag and page are rewritten to the public view (the full text is
 *                only in the store afterwards)
 *   pins1        hidden GM pins (Notes) → GM-only store; their Notes are deleted (the record keeps their id, so revealing restores it)
 *   rested1      characters already Rested from 1.26 get a GM-side rental (they rented before the GM-side record existed)
 *   coinLog1     (1.28.0) the coin log's bucket is created, empty, in the GM-only store (nothing moves; earlier versions logged nothing)
 *
 * Undo: `api.migrations.status()` lists what ran; the README (Upgrading to 1.27) says what each move kept.
 */
import * as Vault from "./vault.mjs";
import * as Q from "./quests.mjs";
import { publicQuest } from "./quests-model.mjs";
import { esc } from "../vendor/wanderers-core/index.mjs";
import * as InnM from "./inn-model.mjs";
import * as PinM from "./pins-model.mjs";
import * as Flight from "./flight.mjs";
import { normalizeCoinLog } from "./coinlog-model.mjs";
import * as F from "./features.mjs";
import { log } from "./log.mjs";

const ID = "wayfarers-toolkit";
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };

export const MOVES = ["inns1", "vault1", "quests1", "pins1", "rested1", "coinLog1"];

async function inns1() {
  let n = 0;
  for (const s of game.scenes) {
    if (!InnM.needsInnMove(s.flags)) continue;
    const rec = InnM.innFromLegacy(s.flags, s.name, foundry.utils.randomID(12));
    await s.update({ [`flags.${ID}.inns`]: { v: InnM.INNS_VERSION, list: [rec] } });
    n++;
  }
  return n ? `${n} inn scene${n === 1 ? "" : "s"} became inn records (the old Inn setting on the scene is kept)` : null;
}

async function vault1() {
  const out = [];
  const net = get("flightNetwork", null);
  if (net && Array.isArray(net.points) && !Vault.get("flightNetwork", null)) {
    const full = Flight.normalizeNetwork(net);
    await Vault.set("flightNetwork", full);
    await game.settings.set(ID, "flightNetwork", Flight.playerView(full, { locked: get("flightMapLocked", "hide") }));
    if (full.points.length) out.push("the flight network (players now get only the unlocked points)");
  }
  const gold = get("goldSnapshots", null);
  if (Array.isArray(gold?.list) && gold.list.length && !Vault.get("goldSnapshots", null)) {
    await Vault.set("goldSnapshots", { v: 1, list: gold.list });
    await game.settings.set(ID, "goldSnapshots", { v: 1, list: [] });
    out.push(`${gold.list.length} party gold snapshot${gold.list.length === 1 ? "" : "s"}`);
  }
  const hist = get("lootHistoryData", null);
  if (Array.isArray(hist?.entries) && hist.entries.length && !Vault.get("lootHistory", null)) {
    await Vault.set("lootHistory", { v: 1, entries: hist.entries });
    await game.settings.set(ID, "lootHistoryData", { v: 1, entries: [] });
    out.push(`${hist.entries.length} loot roll${hist.entries.length === 1 ? "" : "s"} of history`);
  }
  return out.length ? `moved to the GM-only records: ${out.join(", ")}` : null;
}

async function quests1() {
  let n = 0;
  for (const j of game.journal) {
    if (!Q.unmoved(j)) continue;
    const full = Q.normalize(j.flags[ID].quest);
    await Vault.setKey("quests", j.id, full);
    await j.update({ [`flags.${ID}.quest`]: publicQuest(full) });
    const page = j.pages.contents[0]; const content = Q.pageHTML(full, j.name);
    if (page && page.text?.content !== content) await page.update({ "text.content": content });
    n++;
  }
  return n ? `${n} quest${n === 1 ? "" : "s"}: hidden objectives and GM text now kept GM-only` : null;
}

async function pins1() {
  const notes = [];
  for (const s of game.scenes) for (const n of s.notes) notes.push({ sceneId: s.id, note: n });
  const { records, del } = PinM.hiddenToMove(notes);
  if (!records.length) return null;
  await Vault.update(v => { const b = { ...(v.buckets.pins ?? {}) }; for (const r of records) b[r.id] = r; return { ...v, buckets: { ...v.buckets, pins: b } }; });
  const byScene = new Map(); for (const d of del) { if (!byScene.has(d.sceneId)) byScene.set(d.sceneId, []); byScene.get(d.sceneId).push(d.id); }
  for (const [sid, ids] of byScene) await game.scenes.get(sid)?.deleteEmbeddedDocuments("Note", ids);
  return `${records.length} hidden GM pin${records.length === 1 ? "" : "s"} moved off the map into the GM-only records (revealing one puts it back)`;
}

async function rested1() {
  const list = game.actors.filter(a => a.type === "character" && a.getFlag(ID, "rested"));
  const have = /** @type {Record<string, unknown>} */ (Vault.get("rentals", /** @type {any} */ ({})) ?? {});
  const todo = list.filter(a => !have[a.id]);
  if (!todo.length) return null;
  await Vault.update(v => {
    let b = v.buckets.rentals ?? {};
    for (const a of todo) { const f = a.getFlag(ID, "rested"); b = InnM.addRentals(b, [a.id], { innId: null, inn: f?.inn, sceneId: f?.scene, at: f?.at, by: game.user.id }); }
    return { ...v, buckets: { ...v.buckets, rentals: b } };
  });
  return `${todo.length} character${todo.length === 1 ? " already Rested keeps" : "s already Rested keep"} it`;
}

async function coinLog1() {
  if (Vault.get("coinLog", null)) return null;
  await Vault.set("coinLog", normalizeCoinLog(null));
  return null; // nothing to tell: an empty log
}

const RUN = { inns1, vault1, quests1, pins1, rested1, coinLog1 };
/** Which moves apply with the tools that are on (others wait until their tool is turned on). */
const wanted = id => ({ inns1: F.on("restedInn"), quests1: F.on("questLog"), pins1: F.on("mapPins"), rested1: F.on("restedInn"), coinLog1: F.on("coinLog"), vault1: true })[id];

/** Leader: runs every move not done yet. Returns the lines worth telling the GM. Never throws. */
export async function run(api) {
  if (!game.user?.isGM) return [];
  const lines = [];
  for (const id of MOVES) {
    if (!wanted(id) || Vault.migrated(id)) continue;
    try {
      const line = await RUN[id]();
      await Vault.markMigrated(id);
      if (line) lines.push(line);
      log(`migration ${id}: ${line ?? "nothing to move"}`);
    } catch (e) { console.warn(`${ID} | migration ${id} failed (it runs again on the next load)`, e); }
  }
  if (lines.length) {
    await ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Wayfarer's Toolkit" }, content: `<h3>Wayfarer's Toolkit: data moved once</h3><ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul><p class="hint">GM-only records now live in the journal entry "Wayfarer's Toolkit (GM only)". Don't share it with players.</p>` });
  }
  return lines;
}

/** For the health check and api.migrations: [{ id, done }]. */
export const status = () => MOVES.map(id => ({ id, done: Vault.migrated(id) }));
