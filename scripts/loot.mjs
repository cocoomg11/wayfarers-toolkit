/**
 * Loot rolls: classic-MMO-style Need / Greed / Pass for an item lying in an Item Piles pile or body.
 * The GM starts a roll from the dice button on the item's row in the pile window (or api.lootRoll.start(item)). A chat card goes
 * to everyone; each player with a character picks Need, Greed or Pass before the countdown runs out. Every choice is sent to the
 * active GM's client, which makes and records the d100 rolls, settles ties, moves the item with Item Piles and posts the result.
 * Players only ever send a choice, so they can't set a roll. Turned off with the "Loot rolls" feature, nothing here is registered.
 */
import { qualityColor } from "./pane.mjs";
import { isActiveGM, activeGM } from "./gm.mjs";
import { log } from "./log.mjs";

const ID = "wayfarers-toolkit";
const SOCKET = `module.${ID}`;
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const S = key => game.settings.get(ID, key);
const CHOICES = { need: { label: "Need", icon: "fa-dice-d20" }, greed: { label: "Greed", icon: "fa-coins" }, pass: { label: "Pass", icon: "fa-xmark" } };
const isGMClient = () => isActiveGM();

/** Item Piles' API when it is active and set up for the game system. */
function itemPiles() {
  if (!game.modules.get("item-piles")?.active) return null;
  const IP = game.itempiles?.API;
  return IP?.transferItems && IP.ITEM_QUANTITY_ATTRIBUTE ? IP : null;
}
const inPile = item => { const IP = itemPiles(); const a = item?.parent; if (!IP || !(a instanceof Actor)) return false; try { return !!IP.isValidItemPile(a.token ?? a); } catch { return false; } };
const state = m => m?.flags?.[ID]?.lootRoll ?? null;
/** The character a user rolls for: their assigned character, else the first character they own. */
const characterOf = u => u?.character ?? game.actors.find(a => a.type === "character" && a.testUserPermission(u, "OWNER")) ?? null;

/**
 * Who gets the item, best first (pure; tested in Node). `choices` is { userId: { choice, roll, rerolls } }. Need beats Greed; within
 * the winning tier, the higher last roll wins. Ties are settled by `tieBreak(tiedIds)` (rerolls) before this is called, so equal last
 * rolls here keep their order. Returns [{ uid, tier, roll }] for Need and Greed choices only, Need first.
 */
export function rankChoices(choices = {}) {
  const last = c => (c.rerolls?.length ? c.rerolls.at(-1) : c.roll) ?? 0;
  const order = { need: 0, greed: 1 };
  return Object.entries(choices).filter(([, c]) => c && c.choice in order)
    .map(([uid, c], i) => ({ uid, tier: c.choice, roll: last(c), i }))
    .sort((a, b) => order[a.tier] - order[b.tier] || b.roll - a.roll || a.i - b.i)
    .map(({ uid, tier, roll }) => ({ uid, tier, roll }));
}
/** True when some connected user is a GM (pure helper over a user list). */
export const gmOnline = (users = []) => [...users].some(u => u?.isGM && u.active);

// ---------------------------------------------------------------- the card
function cardHTML(st) {
  const rows = Object.entries(st.choices ?? {}).map(([uid, c]) => {
    const u = game.users.get(uid);
    const rolls = [c.roll, ...(c.rerolls ?? [])].filter(n => n != null);
    return `<li class="${c.choice}${st.winner === uid ? " won" : ""}"><span class="who">${esc(c.name ?? u?.name ?? "?")}</span><span class="what">${CHOICES[c.choice]?.label ?? ""}</span><span class="roll">${rolls.length ? rolls.join(" → ") : ""}</span></li>`;
  });
  const waiting = (st.eligible ?? []).filter(uid => !st.choices?.[uid]).map(uid => esc(st.names?.[uid] ?? game.users.get(uid)?.name ?? "?"));
  let foot;
  if (st.status === "open") foot = `<div class="wct-loot-buttons">${Object.entries(CHOICES).map(([k, c]) => `<button type="button" data-wct-loot="${k}" class="${k}"><i class="fa-solid ${c.icon}"></i> ${c.label}</button>`).join("")}</div>
      <p class="wct-loot-timer"><i class="fa-solid fa-hourglass-half"></i> <span data-wct-loot-ends="${st.ends}"></span>${waiting.length ? ` · waiting on ${waiting.join(", ")}` : ""}</p>
      <p class="wct-loot-nogm" hidden><i class="fa-solid fa-plug-circle-xmark"></i> A GM needs to be connected.</p>
      <button type="button" data-wct-loot="close" class="wct-loot-close"><i class="fa-solid fa-gavel"></i> Close the roll now</button>
      <div class="wct-loot-assign" data-wct-loot-assign><select aria-label="Assign to"></select><button type="button" data-wct-loot="assign"><i class="fa-solid fa-hand-holding"></i> Assign to…</button></div>`;
  else foot = `<p class="wct-loot-result">${st.result ?? ""}</p>`;
  return `<div class="wct-loot-card" style="--q:${esc(st.color)}">
    <header><img src="${esc(st.img)}" alt=""><div><small>Loot roll${st.pileName ? ` · ${esc(st.pileName)}` : ""}</small><h3>${esc(st.name)}${st.quantity > 1 ? ` <span class="qty">×${st.quantity}</span>` : ""}</h3></div></header>
    ${rows.length ? `<ul class="wct-loot-rolls">${rows.join("")}</ul>` : ""}${foot}</div>`;
}

// ---------------------------------------------------------------- GM side
const queues = new Map();
/** Runs GM changes to one roll one at a time, so choices arriving together don't overwrite each other. */
function queue(messageId, fn) {
  const next = (queues.get(messageId) ?? Promise.resolve()).then(fn).catch(e => { console.error(`${ID} | loot roll`, e); ui.notifications.error(`Loot roll: ${e.message}`); });
  queues.set(messageId, next); return next;
}
async function save(message, st) { await message.update({ content: cardHTML(st), [`flags.${ID}.lootRoll`]: st }); }
const d100 = async () => (await new Roll("1d100").evaluate()).total;

const timers = new Map();
function schedule(message) {
  clearTimeout(timers.get(message.id));
  const st = state(message); if (!st || st.status !== "open") return;
  timers.set(message.id, setTimeout(() => queue(message.id, () => resolve(message.id)), Math.max(0, st.ends - Date.now())));
}

/** Starts a roll for an item in an Item Piles pile (GM only). Accepts an Item or its UUID. */
export async function start(itemRef, { seconds = null } = {}) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (!itemPiles()) return ui.notifications.warn("Loot rolls need Item Piles (with its system module) active.");
  const item = itemRef instanceof Item ? itemRef : await fromUuid(String(itemRef ?? ""));
  if (!(item instanceof Item)) return ui.notifications.warn("Loot roll: item not found.");
  if (!inPile(item)) return ui.notifications.warn(`Loot roll: ${item.name} isn't in an item pile.`);
  const players = game.users.filter(u => !u.isGM && u.active && characterOf(u));
  if (!players.length) return ui.notifications.warn("Loot roll: no players with a character are logged in.");
  const secs = Math.max(5, Math.round(Number(seconds ?? S("lootRollSeconds")) || 60));
  const pile = item.parent;
  const st = {
    itemUuid: item.uuid, itemId: item.id, pileUuid: pile.uuid, pileName: pile.token?.name ?? pile.name,
    name: item.name, img: item.img, color: qualityColor(item), quantity: Number(foundry.utils.getProperty(item, itemPiles().ITEM_QUANTITY_ATTRIBUTE)) || 1,
    eligible: players.map(u => u.id), names: Object.fromEntries(players.map(u => [u.id, `${u.name} (${characterOf(u).name})`])),
    choices: {}, status: "open", ends: Date.now() + secs * 1000, winner: null, result: ""
  };
  // The countdown runs on the active GM's client, which picks the card up when it renders (see onRender).
  return ChatMessage.create({ content: cardHTML(st), speaker: { alias: "Loot" }, flags: { [ID]: { lootRoll: st } } });
}

/** Records a player's choice on the GM client and rolls the d100 for Need and Greed. */
async function choose(messageId, userId, choice) {
  const message = game.messages.get(messageId); const st = foundry.utils.deepClone(state(message));
  if (!st || st.status !== "open" || !CHOICES[choice] || !st.eligible.includes(userId) || st.choices[userId]) return;
  st.choices[userId] = { choice, name: st.names?.[userId], roll: choice === "pass" ? null : await d100() };
  const done = st.eligible.every(uid => st.choices[uid]);
  await save(message, st);
  if (done) await resolve(messageId);
}

/** Moves the item from its pile to `actor` with Item Piles. Item Piles 3.3 wants Item documents (not ids). Throws on failure. */
async function moveTo(item, actor) {
  const IP = itemPiles(); if (!IP) throw new Error("Item Piles isn't active");
  const res = await IP.transferItems(item.parent, actor, [item]);
  if (Array.isArray(res) && !res.length) throw new Error("Item Piles moved nothing");
  return res;
}
/**
 * Who hears "You won": every non-GM user who owns the receiving actor or has it as their assigned character (the same way a roller's
 * character is found), plus `extra` (the user who won the roll). A party actor with no player owners gets nobody. Pure over `users`.
 */
export function winnerRecipients(actor, users = game.users, extra = null) {
  const ids = new Set();
  if (actor) for (const u of users) if (!u.isGM && ((u.character?.id ?? u.character) === actor.id || actor.testUserPermission?.(u, "OWNER"))) ids.add(u.id);
  if (extra && !extra.isGM) ids.add(extra.id);
  return [...ids];
}
/** Whispers the receiving actor's players that they won. */
function tellWinner(actor, st, extra = null) {
  const whisper = winnerRecipients(actor, game.users, extra);
  if (!whisper.length) return;
  return ChatMessage.create({ whisper, speaker: { alias: "Loot" }, content: `<p class="wct-loot-won" style="--q:${esc(st.color)}"><img src="${esc(st.img)}" alt=""> You won <span class="item">${esc(st.name)}</span>${st.quantity > 1 ? ` ×${st.quantity}` : ""}${actor ? `; it's on ${esc(actor.name)}` : ""}.</p>` });
}
async function announce(actor, st) {
  await ChatMessage.create({ content: `<p class="wct-loot-won" style="--q:${esc(st.color)}"><img src="${esc(st.img)}" alt=""> <strong>${esc(actor.name)}</strong> receives <span class="item">${esc(st.name)}</span>${st.quantity > 1 ? ` ×${st.quantity}` : ""}.</p>`, speaker: { alias: "Loot" } });
}

/**
 * Settles the roll: Need beats Greed, highest d100 wins, ties reroll among the tied. Moves the item to the winner's character. If the
 * winner has no character, their actor is gone or the move fails, the next-best valid roll (Need before Greed) gets it, and the card says so.
 */
async function resolve(messageId) {
  clearTimeout(timers.get(messageId)); timers.delete(messageId);
  const message = game.messages.get(messageId); const st = foundry.utils.deepClone(state(message));
  if (!st || st.status !== "open") return;
  st.status = "done";
  const entries = Object.entries(st.choices);
  const tier = ["need", "greed"].find(k => entries.some(([, c]) => c.choice === k));
  if (!tier) {
    st.result = entries.length ? "Everyone passed. The item stays where it is." : "Nobody rolled. The item stays where it is.";
    log("Loot roll:", st.name, st.result);
    await save(message, st); return;
  }
  // Ties at the top of each tier are rerolled now, so the ranking below is strict where it matters.
  const last = uid => { const c = st.choices[uid]; return c.rerolls?.length ? c.rerolls.at(-1) : c.roll; };
  for (const k of ["need", "greed"]) {
    let tied = entries.filter(([, c]) => c.choice === k).map(([uid]) => uid);
    for (let guard = 0; guard < 20 && tied.length > 1; guard++) {
      const top = Math.max(...tied.map(last)); tied = tied.filter(uid => last(uid) === top);
      if (tied.length === 1) break;
      for (const uid of tied) (st.choices[uid].rerolls ??= []).push(await d100());
    }
  }
  const ranked = rankChoices(st.choices);
  const item = await fromUuid(st.itemUuid);
  if (!item || item.parent?.uuid !== st.pileUuid) {
    const w = ranked[0]; st.winner = w.uid;
    st.result = `${esc(st.names?.[w.uid] ?? game.users.get(w.uid)?.name)} won (${CHOICES[w.tier].label} ${w.roll}), but ${esc(st.name)} is no longer in the pile.`;
    await save(message, st); return;
  }
  const notes = [];
  for (const r of ranked) {
    const user = game.users.get(r.uid); const actor = characterOf(user); const label = `${CHOICES[r.tier].label} ${r.roll}`;
    const who = esc(st.names?.[r.uid] ?? user?.name ?? "?");
    if (!user || !actor) { notes.push(`${who} (${label}) has no character`); continue; }
    try { await moveTo(item, actor); }
    catch (e) { console.warn(`${ID} | loot roll transfer to ${actor.name}`, e); notes.push(`${esc(actor.name)} (${label}) couldn't receive it: ${esc(e.message)}`); continue; }
    st.winner = r.uid;
    st.result = `<strong>${esc(actor.name)}</strong> wins ${esc(st.name)}${st.quantity > 1 ? ` ×${st.quantity}` : ""} (${label}).${notes.length ? `<br><span class="hint">Passed on: ${notes.join("; ")}.</span>` : ""}`;
    log("Loot roll:", st.name, "→", actor.name, label, notes);
    await save(message, st);
    await announce(actor, st); await tellWinner(actor, st, user);
    return;
  }
  st.result = `Nobody who rolled could receive ${esc(st.name)} (${notes.join("; ")}). It stays in the pile.`;
  log("Loot roll:", st.name, "no valid winner", notes);
  await save(message, st);
}

/** GM: ends an open roll and gives the item to `actorId` (a player character or the party actor). */
async function assign(messageId, actorId) {
  clearTimeout(timers.get(messageId)); timers.delete(messageId);
  const message = game.messages.get(messageId); const st = foundry.utils.deepClone(state(message));
  if (!st || st.status !== "open") return;
  const actor = game.actors.get(actorId); if (!actor) return ui.notifications.warn("Loot roll: pick who gets it.");
  const item = await fromUuid(st.itemUuid);
  st.status = "done";
  if (!item || item.parent?.uuid !== st.pileUuid) { st.result = `${esc(st.name)} is no longer in the pile.`; await save(message, st); return; }
  try { await moveTo(item, actor); }
  catch (e) { st.status = "open"; await save(message, st); schedule(message); throw new Error(`couldn't give ${st.name} to ${actor.name} (${e.message})`); }
  st.result = `The GM gave ${esc(st.name)}${st.quantity > 1 ? ` ×${st.quantity}` : ""} to <strong>${esc(actor.name)}</strong>.`;
  log("Loot roll:", st.name, "assigned to", actor.name);
  await save(message, st); await announce(actor, st);
  await tellWinner(actor, st);
}

/** Actors the GM can assign to: player characters, then the party actor. */
function assignees() {
  const party = game.actors.find(a => a.type === "group" && a.name === (() => { try { return game.settings.get(ID, "partyActor"); } catch { return ""; } })());
  const pcs = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));
  return [...pcs, ...(party ? [party] : [])];
}

// ---------------------------------------------------------------- every client
function send(message, choice, extra = {}) {
  if (choice === "close") { if (game.user.isGM) return isGMClient() ? queue(message.id, () => resolve(message.id)) : game.socket.emit(SOCKET, { action: "lootClose", messageId: message.id, userId: game.user.id }); return; }
  if (choice === "assign") { if (game.user.isGM) return isGMClient() ? queue(message.id, () => assign(message.id, extra.actorId)) : game.socket.emit(SOCKET, { action: "lootAssign", messageId: message.id, userId: game.user.id, actorId: extra.actorId }); return; }
  if (!activeGM()) { ui.notifications.warn("A GM needs to be connected."); return false; }
  if (isGMClient()) return queue(message.id, () => choose(message.id, game.user.id, choice));
  game.socket.emit(SOCKET, { action: "lootChoice", messageId: message.id, userId: game.user.id, choice });
}

function onRender(message, html) {
  const st = state(message); if (!st) return;
  if (st.status === "open" && isGMClient() && !timers.has(message.id)) schedule(message);
  const root = html instanceof HTMLElement ? html : html?.[0]; if (!root) return;
  const mine = st.eligible?.includes(game.user.id) && !st.choices?.[game.user.id];
  const assignBox = root.querySelector("[data-wct-loot-assign]");
  if (assignBox) {
    if (!game.user.isGM) assignBox.remove();
    else assignBox.querySelector("select").innerHTML = assignees().map(a => `<option value="${esc(a.id)}">${esc(a.name)}${a.type === "group" ? " (party)" : ""}</option>`).join("");
  }
  root.querySelectorAll("[data-wct-loot]").forEach(b => {
    const k = b.dataset.wctLoot;
    if ((k === "close" || k === "assign") ? !game.user.isGM : !mine) return b.remove();
    if (k === "assign") return b.addEventListener("click", ev => { ev.preventDefault(); const actorId = assignBox?.querySelector("select")?.value; if (!actorId) return ui.notifications.warn("Loot roll: no player character or party actor to assign to."); b.disabled = true; send(message, "assign", { actorId }); });
    b.addEventListener("click", ev => {
      ev.preventDefault();
      const btns = root.querySelectorAll("[data-wct-loot]:not([data-wct-loot=close]):not([data-wct-loot=assign])");
      btns.forEach(x => { x.disabled = true; });
      if (send(message, k) === false) btns.forEach(x => { x.disabled = false; });
      else btns.forEach(x => { x.dataset.wctChosen = "1"; });
    });
  });
  if (!root.querySelector(".wct-loot-buttons button")) root.querySelector(".wct-loot-buttons")?.remove();
  if (mine) { cards.add(root); gmState(root); }
  const span = root.querySelector("[data-wct-loot-ends]"); if (!span) return;
  const tick = () => {
    if (!span.isConnected && iv) { clearInterval(iv); return; }
    const left = Math.max(0, Math.ceil((Number(span.dataset.wctLootEnds) - Date.now()) / 1000));
    span.textContent = left ? `${left}s left` : "Time's up";
    if (!left) clearInterval(iv);
  };
  let iv = null; tick(); iv = setInterval(tick, 1000);
}

/** Open cards on this client with choice buttons, so they can be enabled and disabled as GMs connect and leave. */
const cards = new Set();
/** Disables a card's choice buttons (with a note) while no GM is connected. */
function gmState(root) {
  const none = !activeGM();
  root.querySelectorAll(".wct-loot-buttons button").forEach(b => { if (!b.dataset.wctChosen) b.disabled = none; });
  const note = root.querySelector(".wct-loot-nogm"); if (note) note.hidden = !none;
}
function refreshCards() { for (const r of cards) { if (!r.isConnected) cards.delete(r); else gmState(r); } }

/** Dice button on each item row of an Item Piles pile window, for the GM. */
function addPileButton(element, item) {
  if (!game.user.isGM || !(element instanceof HTMLElement) || !(item instanceof Item)) return;
  if (element.querySelector(".wct-loot-start") || !inPile(item)) return;
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "wct-loot-start"; btn.dataset.tooltip = "Roll for this (Need / Greed / Pass)";
  btn.setAttribute("aria-label", `Start a loot roll for ${item.name}`);
  btn.innerHTML = '<i class="fa-solid fa-dice"></i>';
  btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); start(item); });
  const take = element.querySelector(".item-piles-item-take-button");
  take ? take.before(btn) : element.append(btn);
}

/** Called from the module's init hook whatever the feature toggle (the control panel shows a turned-off feature's settings greyed out). */
export function registerSettings() {
  game.settings.register(ID, "lootRollSeconds", {
    name: "Loot rolls: time to choose (seconds)", hint: "How long players have to pick Need, Greed or Pass. The GM can close a roll early from its chat card.",
    scope: "world", config: false, type: Number, default: 60, range: { min: 10, max: 300, step: 5 }
  });
}

/** Called from the module's init hook when the feature is on: the chat and Item Piles hooks. */
export function init() {
  Hooks.on("renderChatMessageHTML", onRender);
  Hooks.on("item-piles-renderPileItem", addPileButton);
  // Players' Need / Greed / Pass buttons follow whether a GM is connected. activeGM() reads user.active, which Foundry updates
  // just after this hook, so check on the next tick.
  Hooks.on("userConnected", () => setTimeout(refreshCards, 0));
}

/** Called from the module's ready hook: the GM's socket handler, and timers for rolls still open after a reload. */
export function ready() {
  game.socket.on(SOCKET, (msg, senderId) => {
    if (!isGMClient() || !msg?.messageId || !["lootChoice", "lootClose", "lootAssign"].includes(msg.action)) return;
    // Foundry passes the sender's user id; fall back to the one in the message.
    const uid = typeof senderId === "string" && game.users.has(senderId) ? senderId : msg.userId;
    if (msg.action === "lootChoice") queue(msg.messageId, () => choose(msg.messageId, uid, msg.choice));
    else if (msg.action === "lootAssign" && game.users.get(uid)?.isGM) queue(msg.messageId, () => assign(msg.messageId, msg.actorId));
    else if (msg.action === "lootClose" && game.users.get(uid)?.isGM) queue(msg.messageId, () => resolve(msg.messageId));
  });
  if (isGMClient()) for (const m of game.messages) if (state(m)?.status === "open") schedule(m);
}

export const api = {
  start,
  close: id => (game.user.isGM && isGMClient() ? queue(id, () => resolve(id)) : null),
  /** GM: ends an open roll and gives the item to an actor (player character or party actor). */
  assign: (id, actor) => (game.user.isGM && isGMClient() ? queue(id, () => assign(id, actor?.id ?? actor)) : null),
  rankChoices
};
