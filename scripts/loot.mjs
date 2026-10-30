/**
 * Loot rolls: classic-MMO-style Need / Greed / Pass for an item lying in an Item Piles pile or body.
 * The GM starts a roll from the dice button on the item's row in the pile window (or api.lootRoll.start(item)). A chat card goes
 * to everyone; each player with a character picks Need, Greed or Pass before the countdown runs out. Every choice is sent to the
 * active GM's client, which makes and records the d100 rolls, settles ties, moves the item with Item Piles and posts the result.
 * Players only ever send a choice, so they can't set a roll. Turned off with the "Loot rolls" feature, nothing here is registered.
 */
import { qualityColor } from "./pane.mjs";

const ID = "wayfarers-toolkit";
const SOCKET = `module.${ID}`;
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const S = key => game.settings.get(ID, key);
const CHOICES = { need: { label: "Need", icon: "fa-dice-d20" }, greed: { label: "Greed", icon: "fa-coins" }, pass: { label: "Pass", icon: "fa-xmark" } };
const isGMClient = () => !!game.users.activeGM?.isSelf;

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
      <button type="button" data-wct-loot="close" class="wct-loot-close"><i class="fa-solid fa-gavel"></i> Close the roll now</button>`;
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

/** Settles the roll: Need beats Greed, highest d100 wins, ties reroll among the tied. Moves the item to the winner's character. */
async function resolve(messageId) {
  clearTimeout(timers.get(messageId)); timers.delete(messageId);
  const message = game.messages.get(messageId); const st = foundry.utils.deepClone(state(message));
  if (!st || st.status !== "open") return;
  st.status = "done";
  const entries = Object.entries(st.choices);
  const tier = ["need", "greed"].find(k => entries.some(([, c]) => c.choice === k));
  if (!tier) {
    st.result = entries.length ? "Everyone passed. The item stays where it is." : "Nobody rolled. The item stays where it is.";
    await save(message, st); return;
  }
  let tied = entries.filter(([, c]) => c.choice === tier).map(([uid]) => uid);
  const last = uid => { const c = st.choices[uid]; return c.rerolls?.length ? c.rerolls.at(-1) : c.roll; };
  for (let guard = 0; guard < 20; guard++) {
    const top = Math.max(...tied.map(last)); tied = tied.filter(uid => last(uid) === top);
    if (tied.length === 1) break;
    for (const uid of tied) (st.choices[uid].rerolls ??= []).push(await d100());
  }
  const winner = tied[0]; st.winner = winner;
  const user = game.users.get(winner); const actor = characterOf(user);
  const label = `${CHOICES[tier].label} ${last(winner)}`;
  const item = await fromUuid(st.itemUuid);
  if (!item || item.parent?.uuid !== st.pileUuid) {
    st.result = `${esc(st.names?.[winner] ?? user?.name)} won (${label}), but ${esc(st.name)} is no longer in the pile.`;
    await save(message, st); return;
  }
  if (!actor) { st.result = `${esc(user?.name)} won (${label}) but has no character; the item stays in the pile.`; await save(message, st); return; }
  try { await itemPiles().transferItems(item.parent, actor, [item.id]); }
  catch (e) { st.result = `${esc(actor.name)} won (${label}), but the item couldn't be moved: ${esc(e.message)}`; await save(message, st); throw e; }
  st.result = `<strong>${esc(actor.name)}</strong> wins ${esc(st.name)}${st.quantity > 1 ? ` ×${st.quantity}` : ""} (${label}).`;
  await save(message, st);
  await ChatMessage.create({ content: `<p class="wct-loot-won" style="--q:${esc(st.color)}"><img src="${esc(st.img)}" alt=""> <strong>${esc(actor.name)}</strong> receives <span class="item">${esc(st.name)}</span>${st.quantity > 1 ? ` ×${st.quantity}` : ""}.</p>`, speaker: { alias: "Loot" } });
}

// ---------------------------------------------------------------- every client
function send(message, choice) {
  if (choice === "close") { if (game.user.isGM) return isGMClient() ? queue(message.id, () => resolve(message.id)) : game.socket.emit(SOCKET, { action: "lootClose", messageId: message.id, userId: game.user.id }); return; }
  if (!game.users.activeGM) return ui.notifications.warn("A GM needs to be logged in to roll for loot.");
  if (isGMClient()) return queue(message.id, () => choose(message.id, game.user.id, choice));
  game.socket.emit(SOCKET, { action: "lootChoice", messageId: message.id, userId: game.user.id, choice });
}

function onRender(message, html) {
  const st = state(message); if (!st) return;
  if (st.status === "open" && isGMClient() && !timers.has(message.id)) schedule(message);
  const root = html instanceof HTMLElement ? html : html?.[0]; if (!root) return;
  const mine = st.eligible?.includes(game.user.id) && !st.choices?.[game.user.id];
  root.querySelectorAll("[data-wct-loot]").forEach(b => {
    const k = b.dataset.wctLoot;
    if (k === "close" ? !game.user.isGM : !mine) return b.remove();
    b.addEventListener("click", ev => { ev.preventDefault(); root.querySelectorAll("[data-wct-loot]").forEach(x => { x.disabled = true; }); send(message, k); });
  });
  if (!root.querySelector(".wct-loot-buttons button")) root.querySelector(".wct-loot-buttons")?.remove();
  const span = root.querySelector("[data-wct-loot-ends]"); if (!span) return;
  const tick = () => {
    if (!span.isConnected && iv) { clearInterval(iv); return; }
    const left = Math.max(0, Math.ceil((Number(span.dataset.wctLootEnds) - Date.now()) / 1000));
    span.textContent = left ? `${left}s left` : "Time's up";
    if (!left) clearInterval(iv);
  };
  let iv = null; tick(); iv = setInterval(tick, 1000);
}

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

/** Called from the module's init hook when the feature is on: its setting and the chat and Item Piles hooks. */
export function init() {
  game.settings.register(ID, "lootRollSeconds", {
    name: "Loot rolls: time to choose (seconds)", hint: "How long players have to pick Need, Greed or Pass. The GM can close a roll early from its chat card.",
    scope: "world", config: true, type: Number, default: 60, range: { min: 10, max: 300, step: 5 }
  });
  Hooks.on("renderChatMessageHTML", onRender);
  Hooks.on("item-piles-renderPileItem", addPileButton);
}

/** Called from the module's ready hook: the GM's socket handler, and timers for rolls still open after a reload. */
export function ready() {
  game.socket.on(SOCKET, (msg, senderId) => {
    if (!isGMClient() || !msg?.messageId || !["lootChoice", "lootClose"].includes(msg.action)) return;
    // Foundry passes the sender's user id; fall back to the one in the message.
    const uid = typeof senderId === "string" && game.users.has(senderId) ? senderId : msg.userId;
    if (msg.action === "lootChoice") queue(msg.messageId, () => choose(msg.messageId, uid, msg.choice));
    else if (game.users.get(uid)?.isGM) queue(msg.messageId, () => resolve(msg.messageId));
  });
  if (isGMClient()) for (const m of game.messages) if (state(m)?.status === "open") schedule(m);
}

export const api = { start, close: id => (game.user.isGM && isGMClient() ? queue(id, () => resolve(id)) : null) };
