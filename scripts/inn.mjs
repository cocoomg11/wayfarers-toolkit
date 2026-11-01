/**
 * Rested at the inn (feature restedInn). Since 1.27.0 inns are records on their scene (flags.wayfarers-toolkit.inns, several per
 * scene; inn-model.mjs): a name, a room price per person per night, an optional innkeeper (actor UUID and token id) and an optional
 * v14 Region. The GM rents rooms from the innkeeper's token HUD, the Places tab or the Rent Rooms macro: pick the characters, pay the
 * price per person (party actor or each character's coin), and those characters are Rested. The rental is recorded GM-side (GM-only
 * store, bucket "rentals"); the actor flag `rested` only shows it. Their next long rest (dnd5e.restCompleted) grants the benefit set in
 * the control panel and clears both, but only when the GM-side rental exists, so a player can't grant themselves Rested.
 *
 * Players can ask for rooms (core request roomRequest); the leader whispers the GM a Rent rooms button. Document writes happen on a
 * GM's client only (renting is a GM action; rest results go to the leader). Pure rules: inn-model.mjs.
 */
import * as M from "./inn-model.mjs";
import { isActiveGM, activeGM, settled, cardPosted, handle, request } from "./gm.mjs";
import { log } from "./log.mjs";
import * as Vault from "./vault.mjs";
import * as CoinLog from "./coinlog.mjs";
import * as F from "./features.mjs";
import { esc, UI_CLASSES } from "../vendor/wanderers-core/index.mjs";
import { card } from "./look-model.mjs";

const ID = "wayfarers-toolkit";
const STATUS = "wct-rested";
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
const newInnId = () => foundry.utils.randomID(12);
/** @type {any} */
let API = null;

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  s("innDefaultPrice", "Inn: default room price", "Price per person per night for inns that set none, like 5s or 1g 20s (a plain number is read in the fare unit).", String, M.DEFAULT_PRICE);
  s("innPayFrom", "Inn: rooms are paid from", "", String, "party", { choices: M.PAY_FROM });
  s("innBenefit", "Inn: Rested benefit", "What a Rested character gets at the end of their next long rest.", String, "inspiration", { choices: M.BENEFITS });
  s("innLastsAnywhere", "Inn: Rested lasts until the next long rest anywhere", "Off: a Rested character who long-rests away from a scene with an inn loses Rested without the benefit.", Boolean, true);
  s("innStatus", "Inn: Rested status icon on tokens", "Rested characters also get a Rested status effect (a sleep icon) on their token. Reloads Foundry.", Boolean, false, { requiresReload: true });
  s("innRequests", "Inn: players can ask for rooms", "On a scene with an inn, the Rent Rooms macro sends the GM a request with a button to rent.", Boolean, true);
}

// ---------------------------------------------------------------- reading
const sceneOf = s => (typeof s === "string" ? game.scenes.get(s) : s) ?? null;
/** The scene's inn records (cleaned). */
export const inns = scene => M.innsOf(sceneOf(scene)?.flags).list;
/** One inn as shown and charged: { ...record, scene, name, priceText, price, priceOk, on: true }. */
function view(scene, inn) {
  const v = M.innView(inn, { sceneName: scene.name, defaultPrice: get("innDefaultPrice", M.DEFAULT_PRICE) });
  const p = M.readPrice(v.priceText, t => API.parseMoney(t));
  return { ...v, on: true, sceneId: scene.id, name: v.displayName, price: p.amount, priceOk: p.ok };
}
/**
 * An inn on a scene: by id, else the first. { on: false, … } when the scene has none (kept for callers of api.inn.inn(scene)).
 * @param {any} scene
 * @param {string | null} [innId]
 */
export function innFor(scene, innId = null) {
  const s = sceneOf(scene); const list = s ? inns(s) : [];
  const inn = (innId && list.find(x => x.id === innId)) || list[0];
  if (!s || !inn) {
    const p = M.readPrice(get("innDefaultPrice", M.DEFAULT_PRICE), t => API.parseMoney(t));
    return { on: false, id: null, name: s?.name ?? "the inn", priceText: get("innDefaultPrice", M.DEFAULT_PRICE), price: p.amount, priceOk: p.ok, sceneId: s?.id ?? null };
  }
  return view(s, inn);
}
/** Every inn in the world: [{ scene, inn (view) }]. */
export function allInns() {
  const out = []; for (const s of game.scenes ?? []) for (const i of inns(s)) out.push({ scene: s, inn: view(s, i) });
  return out;
}

export const rested = actor => actor?.getFlag?.(ID, "rested") ?? null;
/** GM: the GM-side rental for a character (what Rested is checked against), or null. Players: null. */
export const rental = actor => (game.user?.isGM && actor?.id ? Vault.get("rentals", {})?.[actor.id] ?? null : null);

/** Characters who can take rooms: the party actor's character members, else player-owned characters with a token on the scene. */
export function candidates(scene) {
  const out = new Map();
  const party = API.partyActor?.();
  for (const m of party?.system?.members ?? []) { const a = m?.actor ?? m; if (a?.type === "character") out.set(a.id, a); }
  if (!out.size) for (const t of scene?.tokens ?? []) { const a = t.actor; if (a?.type === "character" && a.hasPlayerOwner) out.set(a.id, a); }
  return [...out.values()];
}

// ---------------------------------------------------------------- inn records (GM)
/** GM: adds or changes an inn on a scene. Returns the record or null. */
export async function saveInn(scene, inn) {
  const s = sceneOf(scene); if (!s || !game.user.isGM) return null;
  const r = M.upsertInn(s.getFlag(ID, "inns"), { ...inn, id: inn.id ?? newInnId() });
  if (!r.ok) { ui.notifications.warn(`Inns: ${r.error}`); return null; }
  await s.update({ [`flags.${ID}.inns`]: r.inns });
  return r.inns.list.find(x => x.id === (inn.id ?? r.inns.list[r.inns.list.length - 1].id)) ?? null;
}
export async function deleteInn(scene, id) {
  const s = sceneOf(scene); if (!s || !game.user.isGM) return;
  await s.update({ [`flags.${ID}.inns`]: M.removeInn(s.getFlag(ID, "inns"), id) });
}

/** GM: the inn dialog (new or edit). Returns form values or null. */
async function innForm(scene, inn = {}) {
  const regions = [...(scene.regions ?? [])];
  const k = inn.innkeeper;
  const content = `<div class="form-group"><label>Inn name</label><div class="form-fields"><input type="text" name="name" value="${esc(inn.name ?? "")}" placeholder="${esc(scene.name)}" maxlength="80"></div></div>
    <div class="form-group"><label>Room price (per person, per night)</label><div class="form-fields"><input type="text" name="price" value="${esc(inn.price ?? "")}" placeholder="${esc(get("innDefaultPrice", M.DEFAULT_PRICE))}"></div><p class="hint">Like 5s or 1g 20s. Blank: the default price from the control panel.</p></div>
    ${regions.length ? `<div class="form-group"><label>Region</label><div class="form-fields"><select name="region"><option value="">The whole scene</option>${regions.map(r => `<option value="${esc(r.id)}" ${r.id === inn.region ? "selected" : ""}>${esc(r.name || r.id)}</option>`).join("")}</select></div><p class="hint">Optional: a long rest counts as at this inn when the character's token is inside the region.</p></div>` : ""}
    ${k ? `<p class="hint">Innkeeper: ${esc(scene.tokens.get(k.token ?? "")?.name ?? (k.actor ? fromUuidSync(k.actor, { strict: false })?.name : null) ?? "a token no longer on this scene")}. Set it with <em>Make innkeeper here…</em> on a token's HUD.</p>` : ""}`;
  return foundry.applications.api.DialogV2.prompt({ classes: ["wct-window", ...UI_CLASSES], window: { title: inn.id ? "Edit inn" : "New inn" }, content, position: { width: 440 }, rejectClose: false, ok: { label: "Save", icon: "fa-solid fa-bed", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object } });
}

/** GM, token HUD: makes this token the innkeeper of a new or existing inn on its scene. */
export async function makeInnkeeper(tokenDoc) {
  if (!game.user.isGM || !tokenDoc?.parent) return null;
  const scene = tokenDoc.parent; const list = inns(scene);
  const current = M.innOfToken(scene.getFlag(ID, "inns"), tokenDoc.id);
  const content = `<p><strong>${esc(tokenDoc.name)}</strong> keeps an inn on ${esc(scene.name)}.</p>
    <div class="form-group"><label>Inn</label><div class="form-fields"><select name="inn"><option value="">A new inn…</option>${list.map(i => `<option value="${esc(i.id)}" ${i.id === current?.id ? "selected" : ""}>${esc(M.innView(i, { sceneName: scene.name }).displayName)}</option>`).join("")}</select></div></div>`;
  const pick = await foundry.applications.api.DialogV2.prompt({ classes: ["wct-window", ...UI_CLASSES], window: { title: "Make innkeeper here" }, content, rejectClose: false, ok: { label: "Next", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object } });
  if (!pick) return null;
  const base = list.find(i => i.id === pick.inn) ?? { name: tokenDoc.name ? `${tokenDoc.name}'s inn` : "" };
  const f = await innForm(scene, base); if (!f) return null;
  // One innkeeper token per inn; a token keeps at most one inn.
  for (const other of list) if (other.id !== base.id && other.innkeeper?.token === tokenDoc.id) await saveInn(scene, { ...other, innkeeper: null });
  return saveInn(scene, { ...base, name: f.name, price: f.price, region: f.region || base.region || null, innkeeper: { actor: tokenDoc.actor?.uuid ?? null, token: tokenDoc.id } });
}

// ---------------------------------------------------------------- renting
/**
 * GM: the Rent rooms dialog and payment. Players: a request to the leader. `inn`: an inn id on the scene (default: the first).
 * @param {{ scene?: any, actors?: any, inn?: string }} [opts]
 */
export async function rentRooms({ scene, actors, inn: innId } = {}) {
  scene = sceneOf(scene) ?? canvas?.scene;
  if (!scene) return ui.notifications.warn("Rent rooms: no scene.");
  const list = inns(scene);
  if (!innId && list.length > 1) innId = await pickInn(scene, list); if (list.length > 1 && !innId) return null;
  const inn = innFor(scene, innId);
  if (!game.user.isGM) return requestRooms(scene, inn);
  if (!inn.on) { const go = await API.confirm("Rent rooms", `<p><strong>${esc(scene.name)}</strong> has no inn (Scene configuration › Table Tools › Inns, or <em>Make innkeeper here…</em> on a token). Rent rooms here anyway at ${esc(API.fmtMoney(inn.price))} per person?</p>`); if (!go) return null; }
  if (!inn.priceOk) return ui.notifications.warn(`Rent rooms: ${inn.name}'s room price "${inn.priceText}" can't be read (try 5s or 1g 20s).`);
  const chosenList = actors?.length ? actors.map(a => typeof a === "string" ? game.actors.get(a) : a).filter(Boolean) : candidates(scene);
  if (!chosenList.length) return ui.notifications.warn("Rent rooms: no player characters found (add them to the party actor, or place their tokens on this scene).");
  const from = get("innPayFrom", "party"); const party = API.partyActor?.();
  const rows = chosenList.map(a => `<label class="wct-check" style="display:flex;align-items:center;gap:6px;margin:3px 0;"><input type="checkbox" name="a_${a.id}" checked data-wct-room> <img src="${esc(a.img)}" alt="" style="width:24px;height:24px;border:none;"> ${esc(a.name)}${rested(a) ? ' <span class="hint">(already Rested)</span>' : ""}${from === "each" ? ` <span class="hint">${esc(API.purse(a))}</span>` : ""}</label>`).join("");
  const purse = from === "party" ? (party ? `Paid from ${esc(party.name)}: ${esc(API.purse(party))}.` : `No party actor named ${esc(API.PARTY)}: choose Each character's own coin in the control panel, or Run setup.`) : "Each character pays for their own room.";
  const content = `<p><strong>${esc(inn.name)}</strong>: ${esc(API.fmtMoney(inn.price))} per person per night.</p>${rows}
    <p>Total: <strong data-wct-room-total>${esc(API.fmtMoney(M.roomCost(inn.price, chosenList.length)))}</strong></p><p class="hint">${purse}</p>`;
  const f = await foundry.applications.api.DialogV2.prompt({
    classes: ["wct-window", ...UI_CLASSES], window: { title: "Rent rooms" }, content, position: { width: 420 }, rejectClose: false,
    ok: { label: "Rent rooms", icon: "fa-solid fa-bed", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object },
    render: (ev, dlg) => {
      const root = dlg?.element ?? ev?.target?.element; if (!root?.querySelector) return;
      const upd = () => { const n = root.querySelectorAll("[data-wct-room]:checked").length; const el = root.querySelector("[data-wct-room-total]"); if (el) el.textContent = API.fmtMoney(M.roomCost(inn.price, n)); };
      root.addEventListener("change", upd);
    }
  });
  if (!f) return null;
  const res = await pay(scene, inn, chosenList.filter(a => f[`a_${a.id}`]), from);
  if (res?.ok && F.on("innRestOffer")) await restOffer(res.actors.map(id => game.actors.get(id)).filter(Boolean), inn.name);
  return res;
}

/**
 * 1.28 (feature innRestOffer): after renting, offers the GM a long rest for everyone who rented and, optionally, to move world time
 * on by the Inn rest hours setting. dnd5e's own long rest runs with no dialog and its chat card (Actor5e#longRest({ dialog: false,
 * chat: true, advanceTime: false })), so its restCompleted hook grants Rested as usual. Time moves once, here, not per character.
 * Returns { rested: [names], hours } or null when declined.
 * @param {any[]} actors
 * @param {string} innName
 */
export async function restOffer(actors, innName = "the inn") {
  if (!game.user.isGM || !actors?.length) return null;
  const hours = Math.max(0, Math.min(24, Math.round(Number(get("innRestHours", 8)) || 0)));
  const content = `<p>Long rest now at <strong>${esc(innName)}</strong> for everyone who rented: ${actors.map(a => esc(a.name)).join(", ")}?</p>
    ${hours ? `<label class="wct-check"><input type="checkbox" name="advance" checked> Move world time on by ${hours} hour${hours === 1 ? "" : "s"}</label>` : ""}
    <p class="hint">Each character gets dnd5e's long rest (with its chat card) and their Rested benefit. You can also let the players rest themselves later.</p>`;
  const f = await foundry.applications.api.DialogV2.prompt({
    classes: ["wct-window", ...UI_CLASSES], window: { title: "Rest at the inn" }, content, position: { width: 420 }, rejectClose: false,
    ok: { label: "Long rest everyone", icon: "fa-solid fa-moon", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object }
  });
  if (!f) return null;
  const rested = [];
  for (const a of actors) {
    if (typeof a.longRest !== "function") continue;
    try { const r = await a.longRest({ dialog: false, chat: true, advanceTime: false }); if (r) rested.push(a.name); }
    catch (e) { console.warn(`${ID} | inn rest: ${a.name}`, e); ui.notifications.warn(`Rest at the inn: ${a.name}'s long rest failed (${e.message}).`); }
  }
  const advanced = hours > 0 && !!f.advance;
  if (advanced) await game.time.advance(hours * 3600);
  log(`Inn: long rest for ${rested.join(", ") || "nobody"}${advanced ? `, ${hours} h passed` : ""}`);
  return { rested, hours: advanced ? hours : 0 };
}

async function pickInn(scene, list) {
  const content = `<div class="form-group"><label>Inn</label><div class="form-fields"><select name="inn">${list.map(i => { const v = innFor(scene, i.id); return `<option value="${esc(i.id)}">${esc(v.name)} (${esc(API.fmtMoney(v.price))})</option>`; }).join("")}</select></div></div>`;
  const f = await foundry.applications.api.DialogV2.prompt({ classes: ["wct-window", ...UI_CLASSES], window: { title: "Which inn?" }, content, rejectClose: false, ok: { label: "OK", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object } });
  return f?.inn ?? null;
}

/** GM: pays for rooms, records the rentals GM-side and marks the chosen characters Rested. Returns { ok, total, actors } or null. */
export async function pay(scene, inn, chosen, from = get("innPayFrom", "party")) {
  if (!game.user.isGM) return null;
  const party = API.partyActor?.(); const coins = API.coins();
  const plan = M.payPlan({ from, price: inn.price, chosen: chosen.map(a => ({ id: a.id, name: a.name, currency: a.system?.currency })), party: party ? { id: party.id, name: party.name, currency: party.system?.currency } : null, coins, fmt: n => API.fmtMoney(n) });
  if (!plan.ok) { await API.info("Rent rooms", `<p><strong>No rooms rented.</strong> ${esc(plan.error)}</p><p class="hint">Nothing was charged.</p>`); return { ok: false, error: plan.error }; }
  for (const p of plan.payers) {
    const a = game.actors.get(p.id); if (!a) continue;
    const was = API.totalMoney(a); await a.update({ "system.currency": p.currency });
    await CoinLog.record(a, API.totalMoney(a) - was, `Rooms at ${inn.name}`);
  }
  const at = game.time.worldTime;
  await Vault.update(v => ({ ...v, buckets: { ...v.buckets, rentals: M.addRentals(v.buckets.rentals, chosen.map(a => a.id), { innId: inn.id, inn: inn.name, sceneId: scene.id, at, by: game.user.id }) } }));
  const flag = M.restedFlag({ sceneId: scene.id, inn: inn.name, at });
  for (const a of chosen) { await a.setFlag(ID, "rested", flag); await setStatus(a, true); }
  await API.say(`<p><i class="fa-solid fa-bed"></i> <strong>The party takes rooms at ${esc(inn.name)}.</strong> Rested.</p><p>${chosen.map(a => esc(a.name)).join(", ")} · ${esc(API.fmtMoney(plan.total))}${from === "each" ? ` (${esc(API.fmtMoney(inn.price))} each)` : ""}.</p>`, inn.name);
  log(`Inn: ${chosen.length} rooms at ${inn.name} for ${plan.total}`);
  return { ok: true, total: plan.total, actors: chosen.map(a => a.id) };
}

async function setStatus(actor, on) {
  if (!get("innStatus", false) || !CONFIG.statusEffects?.some?.(e => e.id === STATUS)) return;
  try { await actor.toggleStatusEffect(STATUS, { active: !!on }); } catch (e) { console.warn(`${ID} | Rested status`, e); }
}

/** GM: clears Rested (the flag, its status icon and the GM-side rental) from actors. */
export async function clearRested(actors) {
  if (!game.user.isGM) return;
  const list = [actors].flat().filter(Boolean);
  for (const a of list) { if (rested(a)) await a.unsetFlag(ID, "rested"); await setStatus(a, false); }
  const ids = list.map(a => a.id);
  if (ids.some(id => Vault.get("rentals", {})?.[id])) await Vault.update(v => { const r = { ...(v.buckets.rentals ?? {}) }; for (const id of ids) delete r[id]; return { ...v, buckets: { ...v.buckets, rentals: r } }; });
}

function requestRooms(scene, inn) {
  if (!inn.on) return ui.notifications.warn("Rooms can only be asked for on a scene with an inn.");
  if (!get("innRequests", true)) return ui.notifications.info(`Ask your GM for rooms at ${inn.name}.`);
  if (!activeGM()) return ui.notifications.warn("A GM needs to be connected.");
  if (!request("roomRequest", { sceneId: scene.id, ...(inn.id ? { innId: inn.id } : {}) })) return ui.notifications.warn("Rent rooms: the request couldn't be sent.");
  ui.notifications.info(`Asked the GM for rooms at ${inn.name} (${API.fmtMoney(inn.price)} per person).`);
}

/**
 * Leader: a player's room request becomes a whisper with a Rent rooms button. `u` is Foundry's sender.
 * @param {any} data
 * @param {any} u
 * @param {{ rid?: string }} [meta]
 */
async function onRoomRequest(data, u, { rid } = {}) {
  const r = M.readRoomRequest({ action: "roomRequest", ...data }); if (!r || !get("innRequests", true)) return;
  if (cardPosted("roomRequest", rid)) return;
  if (!u || u.isGM) return;
  const scene = game.scenes.get(r.sceneId); if (!scene) return;
  const inn = innFor(scene, typeof data.innId === "string" ? data.innId : null); if (!inn.on) return;
  return ChatMessage.create({ whisper: game.users.filter(x => x.isGM).map(x => x.id), speaker: { alias: inn.name }, flags: { [ID]: { roomRequest: { sceneId: scene.id, innId: inn.id, user: u.name, rid } } },
    content: card(`<p><strong>${esc(u.name)}</strong> asks for rooms at <strong>${esc(inn.name)}</strong> (${esc(API.fmtMoney(inn.price))} per person).</p><p><button type="button" class="wc-btn wc-btn-sm" data-wct-action="rent-rooms"><i class="fa-solid fa-bed"></i> Rent rooms…</button></p>`) });
}

// ---------------------------------------------------------------- the long rest
/**
 * Leader: what a long rest does to a Rested character. `sceneId`: the scene the resting client was viewing.
 * @param {any} actor
 * @param {string} sceneId
 * @param {string | null} [rid]
 */
export async function afterLongRest(actor, sceneId, rid = null) {
  if (!game.user.isGM || !actor) return null;
  if (applying.has(actor.id) || cardPosted("restedRest", rid)) return null;
  applying.add(actor.id);
  try { return await applyRest(actor, sceneId, rid); } finally { applying.delete(actor.id); }
}
const applying = new Set();
/** Whether the actor rests at an inn: a scene with an inn; an inn with a Region needs the token inside it (when it can be told). */
function restsAtInn(actor, sc) {
  if (!sc) return false; const list = inns(sc); if (!list.length) return false;
  const tok = sc.tokens.find(t => t.actorId === actor.id);
  return list.some(i => {
    if (!i.region) return true;
    const reg = sc.regions?.get?.(i.region); if (!reg || !tok) return true;
    try { return reg.testPoint?.({ x: tok.x + (tok.width * (sc.grid?.size ?? 100)) / 2, y: tok.y + (tok.height * (sc.grid?.size ?? 100)) / 2, elevation: tok.elevation ?? 0 }) ?? true; } catch { return true; }
  });
}
async function applyRest(actor, sceneId, rid) {
  const flag = rested(actor); const rent = rental(actor);
  // The GM-side rental decides. A Rested flag without one (written by a player, or left from before 1.27 and not moved) is cleared.
  if (!rent) { if (flag) { await actor.unsetFlag(ID, "rested"); await setStatus(actor, false); log(`Inn: ${actor.name} had a Rested flag without a rental; cleared`); } return null; }
  const sc = game.scenes.get(sceneId ?? "") ?? actor.getActiveTokens?.()[0]?.scene ?? null;
  const outcome = M.restOutcomeChecked({ rental: rent, onInn: restsAtInn(actor, sc), lastsAnywhere: get("innLastsAnywhere", true) });
  if (outcome === "none") return null;
  let text;
  if (outcome === "grant") {
    const sys = actor.system ?? {};
    const classes = (actor.items ?? []).filter(i => i.type === "class").map(i => ({ id: i.id, name: i.name, denomination: i.system?.hd?.denomination ?? i.system?.hitDice, spent: i.system?.hd?.spent ?? i.system?.hitDiceUsed ?? 0 }));
    const plan = M.benefitPlan(get("innBenefit", "inspiration"), { inspiration: !!sys.attributes?.inspiration, temp: sys.attributes?.hp?.temp ?? 0, level: sys.details?.level ?? 0, classes });
    if (Object.keys(plan.actor).length) await actor.update(plan.actor);
    if (plan.items.length) await actor.updateEmbeddedDocuments("Item", plan.items);
    text = `${esc(actor.name)} wakes Rested from ${esc(rent.inn)}: ${esc(plan.text)}.`;
  } else text = `${esc(actor.name)} rested away from the inn; the comfort of ${esc(rent.inn)} has worn off.`;
  await clearRested(actor);
  await ChatMessage.create({ content: card(`<p><i class="fa-solid fa-bed"></i> ${text}</p>`), speaker: ChatMessage.getSpeaker?.({ actor }) ?? { alias: actor.name }, flags: { [ID]: { restedRest: { actorId: actor.id, rid } } } });
  return outcome;
}

async function onRestCompleted(actor, result, config) {
  const long = result?.longRest === true || result?.type === "long" || config?.type === "long";
  if (!long || actor?.type !== "character" || !rested(actor)) return;
  const sceneId = canvas?.scene?.id ?? null;
  if (game.user.isGM) await settled();
  if (isActiveGM()) return afterLongRest(actor, sceneId, null).catch(e => console.warn(`${ID} | Rested`, e));
  if (!activeGM()) return ui.notifications.warn(`${actor.name} is Rested, but no GM is connected to apply it; it stays until the next long rest with a GM online.`);
  // Another client acts: a player's rest, or a GM tab that isn't the leader (it sends to the one that is).
  request("restedRest", { actorId: actor.id, ...(sceneId ? { sceneId } : {}) });
}

/** @param {any} data @param {any} sender @param {{ rid?: string }} [meta] */
async function onRestReport(data, sender, { rid } = {}) {
  const r = M.readRestReport({ action: "restedRest", ...data }); if (!r || !sender) return;
  const a = game.actors.get(r.actorId); if (!a) return;
  // Only someone who owns the character (or a GM) can report its rest.
  if (!sender.isGM && !a.testUserPermission(sender, "OWNER")) return;
  return afterLongRest(a, r.sceneId, rid ?? null).catch(e => console.warn(`${ID} | Rested`, e));
}

// ---------------------------------------------------------------- scene config (Table Tools section) and token HUD
/** The inns list for the shared Table Tools tab (scene-tab.mjs builds the section). Inns are edited with buttons, not form fields. */
export function sceneSection(scene) {
  const list = inns(scene);
  const rows = list.map(i => { const v = innFor(scene, i.id); return `<li data-wct-inn="${esc(i.id)}"><strong>${esc(v.name)}</strong> · ${esc(v.priceOk ? API.fmtMoney(v.price) : `${v.priceText} (can't be read)`)}${i.innkeeper ? ` · <i class="fa-solid fa-user"></i> ${esc(scene.tokens.get(i.innkeeper.token ?? "")?.name ?? "innkeeper")}` : ""}${i.region ? ' · <i class="fa-solid fa-draw-polygon"></i> region' : ""} <button type="button" data-wct-inn-act="edit" style="width:auto;">Edit</button> <button type="button" data-wct-inn-act="delete" style="width:auto;">Delete</button></li>`; }).join("");
  const el = document.createElement("div");
  el.innerHTML = `<div class="form-group stacked"><label>Inns</label><ul class="wct-inn-list" style="list-style:none;margin:0;padding:0;">${rows || "<li class=\"hint\">No inn on this scene.</li>"}</ul>
    <button type="button" data-wct-inn-act="add" style="width:auto;"><i class="fa-solid fa-plus"></i> Add inn</button>
    <p class="hint">The party can rent rooms here and wake Rested. Or right-click a token and use <em>Make innkeeper here…</em>; rent from that token's HUD. Changes save at once.</p></div>`;
  el.addEventListener("click", async ev => {
    const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (ev.target).closest("[data-wct-inn-act]")); if (!b) return; ev.preventDefault();
    const id = /** @type {HTMLElement | null} */ (b.closest("[data-wct-inn]"))?.dataset.wctInn; const inn = list.find(i => i.id === id);
    if (b.dataset.wctInnAct === "add") { const f = await innForm(scene, {}); if (f) await saveInn(scene, { name: f.name, price: f.price, region: f.region || null }); }
    else if (b.dataset.wctInnAct === "edit" && inn) { const f = await innForm(scene, inn); if (f) await saveInn(scene, { ...inn, name: f.name, price: f.price, region: f.region || null }); }
    else if (b.dataset.wctInnAct === "delete" && inn) { if (await API.confirm("Delete inn", `<p>Delete the inn <strong>${esc(innFor(scene, inn.id).name)}</strong>? Characters already Rested keep it.</p>`)) await deleteInn(scene, inn.id); }
  });
  return el;
}

function addHudButtons(hud, html) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; const doc = hud.object?.document ?? hud.document; if (!root || !doc?.parent) return;
  const col = root.querySelector(".col.right") ?? root.querySelector(".col.left"); if (!col) return;
  col.querySelector(".wct-innkeeper")?.remove(); col.querySelector(".wct-rent")?.remove();
  const keeps = M.innOfToken(doc.parent.getFlag(ID, "inns"), doc.id);
  if (keeps) {
    const rb = document.createElement("button"); rb.type = "button"; rb.className = "control-icon wct-rent";
    rb.dataset.tooltip = `Rent rooms at ${innFor(doc.parent, keeps.id).name}`; rb.setAttribute("aria-label", "Rent rooms");
    rb.innerHTML = '<i class="fa-solid fa-bed"></i>';
    rb.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); rentRooms({ scene: doc.parent, inn: keeps.id }).catch(e => ui.notifications.error(`Rent rooms: ${e.message}`)); });
    col.append(rb);
  }
  const kb = document.createElement("button"); kb.type = "button"; kb.className = "control-icon wct-innkeeper";
  kb.dataset.tooltip = keeps ? "Innkeeper: change the inn…" : "Make innkeeper here…"; kb.setAttribute("aria-label", "Make innkeeper here");
  kb.innerHTML = '<i class="fa-solid fa-mug-hot"></i>';
  kb.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); makeInnkeeper(doc).then(() => hud.render?.()).catch(e => ui.notifications.error(`Innkeeper: ${e.message}`)); });
  col.append(kb);
}

export function init(api) {
  API = api;
  if (get("innStatus", false) && Array.isArray(CONFIG.statusEffects) && !CONFIG.statusEffects.some(e => e.id === STATUS)) CONFIG.statusEffects.push({ id: STATUS, name: "Rested", img: "icons/svg/sleep.svg" });
  Hooks.on("renderTokenHUD", addHudButtons);
  // dnd5e.restCompleted(actor, result, config) fires on the client that ran the rest, after its updates (dnd5e 4.x to 6.x).
  Hooks.on("dnd5e.restCompleted", (...args) => { onRestCompleted(...args).catch(e => console.warn(`${ID} | Rested`, e)); });
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const req = message.flags?.[ID]?.roomRequest; if (!req) return;
    const btn = html.querySelector?.("[data-wct-action=rent-rooms]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    btn.addEventListener("click", ev => { ev.preventDefault(); rentRooms({ scene: req.sceneId, inn: req.innId ?? undefined }).catch(e => ui.notifications.error(`Rent rooms: ${e.message}`)); });
  });
}
export function ready() {
  handle("roomRequest", (data, user, meta) => onRoomRequest(data, user, meta));
  handle("restedRest", (data, user, meta) => onRestReport(data, user, meta));
}
