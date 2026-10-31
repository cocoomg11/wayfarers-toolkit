/**
 * Rested at the inn (feature restedInn). Scenes flagged as an Inn (flags.wayfarers-toolkit.inn: { on, name, price }) let the GM rent
 * rooms: pick the characters, pay the price per person (from the party actor or each character's coin), and those characters are
 * Rested (flags.wayfarers-toolkit.rested). Their next long rest (dnd5e.restCompleted) grants the benefit set in the control panel and
 * clears Rested. Players can ask for rooms on an Inn scene over the socket; the active GM decides. Document writes happen on a GM's
 * client only (renting is a GM action; rest results go to the active GM). Pure rules: inn-model.mjs.
 */
import * as M from "./inn-model.mjs";
import { isActiveGM, activeGM } from "./gm.mjs";
import { log } from "./log.mjs";

const ID = "wayfarers-toolkit";
const SOCKET = `module.${ID}`;
const STATUS = "wct-rested";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };
let API = null;

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  s("innDefaultPrice", "Inn: default room price", "Price per person per night for Inn scenes that set none, like 5s or 1g 20s (a plain number is read in the fare unit).", String, M.DEFAULT_PRICE);
  s("innPayFrom", "Inn: rooms are paid from", "", String, "party", { choices: M.PAY_FROM });
  s("innBenefit", "Inn: Rested benefit", "What a Rested character gets at the end of their next long rest.", String, "inspiration", { choices: M.BENEFITS });
  s("innLastsAnywhere", "Inn: Rested lasts until the next long rest anywhere", "Off: a Rested character who long-rests away from an Inn scene loses Rested without the benefit.", Boolean, true);
  s("innStatus", "Inn: Rested status icon on tokens", "Rested characters also get a Rested status effect (a sleep icon) on their token. Reloads Foundry.", Boolean, false, { requiresReload: true });
  s("innRequests", "Inn: players can ask for rooms", "On an Inn scene, the Rent Rooms macro sends the GM a request with a button to rent.", Boolean, true);
}

/** The inn on a scene: { on, name, priceText, price, priceOk }. */
export function innFor(scene) {
  const s = typeof scene === "string" ? game.scenes.get(scene) : scene;
  const inn = M.innOf(s ? { name: s.name, flags: s.flags } : null, { defaultPrice: get("innDefaultPrice", M.DEFAULT_PRICE) });
  const p = M.readPrice(inn.priceText, t => API.parseMoney(t));
  return { ...inn, price: p.amount, priceOk: p.ok };
}

export const rested = actor => actor?.getFlag?.(ID, "rested") ?? null;

/** Characters who can take rooms: the party actor's character members, else player-owned characters with a token on the scene. */
export function candidates(scene) {
  const out = new Map();
  const party = API.partyActor?.();
  for (const m of party?.system?.members ?? []) { const a = m?.actor ?? m; if (a?.type === "character") out.set(a.id, a); }
  if (!out.size) for (const t of scene?.tokens ?? []) { const a = t.actor; if (a?.type === "character" && a.hasPlayerOwner) out.set(a.id, a); }
  return [...out.values()];
}

/** GM: the Rent rooms dialog and payment. Players: a request to the active GM (Inn scenes only). */
export async function rentRooms({ scene, actors } = {}) {
  scene = typeof scene === "string" ? game.scenes.get(scene) : scene ?? canvas?.scene;
  if (!scene) return ui.notifications.warn("Rent rooms: no scene.");
  const inn = innFor(scene);
  if (!game.user.isGM) return requestRooms(scene, inn);
  if (!inn.on) { const go = await API.confirm("Rent rooms", `<p><strong>${esc(scene.name)}</strong> isn't marked as an Inn (Scene configuration › Inn). Rent rooms here anyway at ${esc(API.fmtMoney(inn.price))} per person?</p>`); if (!go) return null; }
  if (!inn.priceOk) return ui.notifications.warn(`Rent rooms: ${scene.name}'s room price "${inn.priceText}" can't be read (try 5s or 1g 20s).`);
  const list = actors?.length ? actors.map(a => typeof a === "string" ? game.actors.get(a) : a).filter(Boolean) : candidates(scene);
  if (!list.length) return ui.notifications.warn("Rent rooms: no player characters found (add them to the party actor, or place their tokens on this scene).");
  const from = get("innPayFrom", "party"); const party = API.partyActor?.();
  const rows = list.map(a => `<label class="wct-check" style="display:flex;align-items:center;gap:6px;margin:3px 0;"><input type="checkbox" name="a_${a.id}" checked data-wct-room> <img src="${esc(a.img)}" alt="" style="width:24px;height:24px;border:none;"> ${esc(a.name)}${rested(a) ? ' <span class="hint">(already Rested)</span>' : ""}${from === "each" ? ` <span class="hint">${esc(API.purse(a))}</span>` : ""}</label>`).join("");
  const purse = from === "party" ? (party ? `Paid from ${esc(party.name)}: ${esc(API.purse(party))}.` : `No party actor named ${esc(API.PARTY)}: choose Each character's own coin in the control panel, or Run setup.`) : "Each character pays for their own room.";
  const content = `<p><strong>${esc(inn.name)}</strong>: ${esc(API.fmtMoney(inn.price))} per person per night.</p>${rows}
    <p>Total: <strong data-wct-room-total>${esc(API.fmtMoney(M.roomCost(inn.price, list.length)))}</strong></p><p class="hint">${purse}</p>`;
  const f = await foundry.applications.api.DialogV2.prompt({
    classes: ["wct-window"], window: { title: "Rent rooms" }, content, position: { width: 420 }, rejectClose: false,
    ok: { label: "Rent rooms", icon: "fa-solid fa-bed", callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object },
    render: (ev, dlg) => {
      const root = dlg?.element ?? ev?.target?.element; if (!root?.querySelector) return;
      const upd = () => { const n = root.querySelectorAll("[data-wct-room]:checked").length; const el = root.querySelector("[data-wct-room-total]"); if (el) el.textContent = API.fmtMoney(M.roomCost(inn.price, n)); };
      root.addEventListener("change", upd);
    }
  });
  if (!f) return null;
  const chosen = list.filter(a => f[`a_${a.id}`]);
  return pay(scene, inn, chosen, from);
}

/** GM: pays for rooms and marks the chosen characters Rested. Returns { ok, total, actors } or null. */
export async function pay(scene, inn, chosen, from = get("innPayFrom", "party")) {
  if (!game.user.isGM) return null;
  const party = API.partyActor?.(); const coins = API.coins();
  const plan = M.payPlan({ from, price: inn.price, chosen: chosen.map(a => ({ id: a.id, name: a.name, currency: a.system?.currency })), party: party ? { id: party.id, name: party.name, currency: party.system?.currency } : null, coins, fmt: n => API.fmtMoney(n) });
  if (!plan.ok) { await API.info("Rent rooms", `<p><strong>No rooms rented.</strong> ${esc(plan.error)}</p><p class="hint">Nothing was charged.</p>`); return { ok: false, error: plan.error }; }
  for (const p of plan.payers) await game.actors.get(p.id)?.update({ "system.currency": p.currency });
  const flag = M.restedFlag({ sceneId: scene.id, inn: inn.name, at: game.time.worldTime });
  for (const a of chosen) { await a.setFlag(ID, "rested", flag); await setStatus(a, true); }
  await API.say(`<p><i class="fa-solid fa-bed"></i> <strong>The party takes rooms at ${esc(inn.name)}.</strong> Rested.</p><p>${chosen.map(a => esc(a.name)).join(", ")} · ${esc(API.fmtMoney(plan.total))}${from === "each" ? ` (${esc(API.fmtMoney(inn.price))} each)` : ""}.</p>`, inn.name);
  log(`Inn: ${chosen.length} rooms at ${inn.name} for ${plan.total}`);
  return { ok: true, total: plan.total, actors: chosen.map(a => a.id) };
}

async function setStatus(actor, on) {
  if (!get("innStatus", false) || !CONFIG.statusEffects?.some?.(e => e.id === STATUS)) return;
  try { await actor.toggleStatusEffect(STATUS, { active: !!on }); } catch (e) { console.warn(`${ID} | Rested status`, e); }
}

/** GM: clears Rested (and its status icon) from actors. */
export async function clearRested(actors) {
  if (!game.user.isGM) return;
  for (const a of [actors].flat().filter(Boolean)) { if (rested(a)) await a.unsetFlag(ID, "rested"); await setStatus(a, false); }
}

function requestRooms(scene, inn) {
  if (!inn.on) return ui.notifications.warn("Rooms can only be asked for on an Inn scene.");
  if (!get("innRequests", true)) return ui.notifications.info(`Ask your GM for rooms at ${inn.name}.`);
  if (!activeGM()) return ui.notifications.warn("A GM needs to be connected.");
  game.socket.emit(SOCKET, { action: "roomRequest", sceneId: scene.id, userId: game.user.id });
  ui.notifications.info(`Asked the GM for rooms at ${inn.name} (${API.fmtMoney(inn.price)} per person).`);
}

/** Active GM: a player's room request becomes a whisper with a Rent rooms button. */
async function onRoomRequest(msg, senderId) {
  const r = M.readRoomRequest(msg); if (!r || !isActiveGM() || !get("innRequests", true)) return;
  const u = game.users.get(typeof senderId === "string" && game.users.has(senderId) ? senderId : r.userId); if (!u || u.isGM) return;
  const scene = game.scenes.get(r.sceneId); if (!scene) return;
  const inn = innFor(scene); if (!inn.on) return;
  return ChatMessage.create({ whisper: game.users.filter(x => x.isGM).map(x => x.id), speaker: { alias: inn.name }, flags: { [ID]: { roomRequest: { sceneId: scene.id, user: u.name } } },
    content: `<p><strong>${esc(u.name)}</strong> asks for rooms at <strong>${esc(inn.name)}</strong> (${esc(API.fmtMoney(inn.price))} per person).</p><p><button type="button" data-wct-action="rent-rooms"><i class="fa-solid fa-bed"></i> Rent rooms…</button></p>` });
}

/** Active GM: what a long rest does to a Rested character. `sceneId`: the scene the resting client was viewing. */
export async function afterLongRest(actor, sceneId) {
  const flag = rested(actor); if (!flag || !game.user.isGM) return null;
  const sc = game.scenes.get(sceneId ?? "") ?? actor.getActiveTokens?.()[0]?.scene ?? null;
  const onInn = !!sc && innFor(sc).on;
  const outcome = M.restOutcome({ rested: !!flag, onInn, lastsAnywhere: get("innLastsAnywhere", true) });
  if (outcome === "none") return null;
  let text;
  if (outcome === "grant") {
    const sys = actor.system ?? {};
    const classes = (actor.items ?? []).filter(i => i.type === "class").map(i => ({ id: i.id, name: i.name, denomination: i.system?.hd?.denomination ?? i.system?.hitDice, spent: i.system?.hd?.spent ?? i.system?.hitDiceUsed ?? 0 }));
    const plan = M.benefitPlan(get("innBenefit", "inspiration"), { inspiration: !!sys.attributes?.inspiration, temp: sys.attributes?.hp?.temp ?? 0, level: sys.details?.level ?? 0, classes });
    if (Object.keys(plan.actor).length) await actor.update(plan.actor);
    if (plan.items.length) await actor.updateEmbeddedDocuments("Item", plan.items);
    text = `${esc(actor.name)} wakes Rested from ${esc(flag.inn)}: ${esc(plan.text)}.`;
  } else text = `${esc(actor.name)} rested away from the inn; the comfort of ${esc(flag.inn)} has worn off.`;
  await clearRested(actor);
  await ChatMessage.create({ content: `<p><i class="fa-solid fa-bed"></i> ${text}</p>`, speaker: ChatMessage.getSpeaker?.({ actor }) ?? { alias: actor.name } });
  return outcome;
}

function onRestCompleted(actor, result, config) {
  const long = result?.longRest === true || result?.type === "long" || config?.type === "long";
  if (!long || actor?.type !== "character" || !rested(actor)) return;
  const sceneId = canvas?.scene?.id ?? null;
  if (isActiveGM()) return afterLongRest(actor, sceneId).catch(e => console.warn(`${ID} | Rested`, e));
  if (!activeGM()) return ui.notifications.warn(`${actor.name} is Rested, but no GM is connected to apply it; it stays until the next long rest with a GM online.`);
  game.socket.emit(SOCKET, { action: "restedRest", actorId: actor.id, sceneId, userId: game.user.id });
}

function onRestReport(msg, senderId) {
  const r = M.readRestReport(msg); if (!r || !isActiveGM()) return;
  const a = game.actors.get(r.actorId); if (!a) return;
  const sender = game.users.get(senderId);
  // Only someone who owns the character (or a GM) can report its rest.
  if (sender && !sender.isGM && !a.testUserPermission(sender, "OWNER")) return;
  return afterLongRest(a, r.sceneId).catch(e => console.warn(`${ID} | Rested`, e));
}

/** Inn fields in the scene configuration (GM). */
function addSceneFields(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0]; const scene = app?.document; if (!root || !scene || !game.user.isGM) return;
  if (root.querySelector("[data-wct-fieldset=inn]")) return;
  const tab = root.querySelector('.tab[data-tab="basics"]') ?? root.querySelector(".tab"); if (!tab) return;
  const f = scene.getFlag(ID, "inn") ?? {}; const n = `flags.${ID}.inn`;
  const fs = document.createElement("fieldset"); fs.dataset.wctFieldset = "inn";
  fs.innerHTML = `<legend>Inn (Wayfarer's Toolkit)</legend>
    <div class="form-group"><label>Inn</label><div class="form-fields"><input type="checkbox" name="${n}.on" ${f.on ? "checked" : ""}></div><p class="hint">The party can rent rooms here and wake Rested.</p></div>
    <div class="form-group"><label>Inn name</label><div class="form-fields"><input type="text" name="${n}.name" value="${esc(f.name ?? "")}" placeholder="${esc(scene.name)}"></div></div>
    <div class="form-group"><label>Room price (per person, per night)</label><div class="form-fields"><input type="text" name="${n}.price" value="${esc(f.price ?? "")}" placeholder="${esc(get("innDefaultPrice", M.DEFAULT_PRICE))}"></div><p class="hint">Like 5s or 1g 20s. Blank: the default price from the control panel.</p></div>`;
  tab.append(fs);
}

export function init(api) {
  API = api;
  if (get("innStatus", false) && Array.isArray(CONFIG.statusEffects) && !CONFIG.statusEffects.some(e => e.id === STATUS)) CONFIG.statusEffects.push({ id: STATUS, name: "Rested", img: "icons/svg/sleep.svg" });
  Hooks.on("renderSceneConfig", addSceneFields);
  // dnd5e.restCompleted(actor, result, config) fires on the client that ran the rest, after its updates (dnd5e 4.x to 6.x).
  Hooks.on("dnd5e.restCompleted", onRestCompleted);
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const req = message.flags?.[ID]?.roomRequest; if (!req) return;
    const btn = html.querySelector?.("[data-wct-action=rent-rooms]"); if (!btn) return;
    if (!game.user.isGM) return btn.remove();
    btn.addEventListener("click", ev => { ev.preventDefault(); rentRooms({ scene: req.sceneId }).catch(e => ui.notifications.error(`Rent rooms: ${e.message}`)); });
  });
}
export function ready() {
  game.socket.on(SOCKET, (msg, senderId) => {
    if (msg?.action === "roomRequest") onRoomRequest(msg, senderId)?.catch?.(e => console.warn(`${ID} | room request`, e));
    else if (msg?.action === "restedRest") onRestReport(msg, senderId);
  });
}
