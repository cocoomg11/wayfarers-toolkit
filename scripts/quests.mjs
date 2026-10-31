/**
 * Quest log: narrative quests with free-text objectives the GM ticks off, an MMO-style log window and an on-screen tracker.
 * Each quest is a JournalEntry in the Quest folder. Its data lives in flags.wayfarers-toolkit.quest and its single text page is
 * rebuilt from that data on every change, so the journal reads well on its own (and in exports). Players only read; every write
 * happens on a GM's client. Turned off with the "Quest log" setting, nothing here is registered.
 */
const ID = "wayfarers-toolkit";
const SOCKET = `module.${ID}`;
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const S = key => game.settings.get(ID, key);
const TextEditorImpl = () => foundry.applications.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
const MAX_TRACKED = 5;

/** The module API object from main.mjs (money helpers, party actor, dialogs). Set by init(). */
let WCT = null;
/** Whether the Quest tracker feature is on (tracking, the Track box and the on-screen list). */
let TRACKER = true;

export const STATUS = {
  available: { label: "Not given", glyph: "!" },
  active: { label: "Active", glyph: "?" },
  completed: { label: "Completed", glyph: "✔" },
  failed: { label: "Failed", glyph: "✖" }
};

// ---------------------------------------------------------------- data
const uid = () => foundry.utils.randomID(8);
const safeSync = uuid => { try { return fromUuidSync(uuid); } catch { return null; } };

/** Cleans quest data into its full shape. Accepts shortcuts: objectives as strings, giver as a name, reward items as UUIDs. */
export function normalize(raw = {}) {
  const q = foundry.utils.deepClone(raw ?? {});
  const giver = typeof q.giver === "string" ? { name: q.giver } : (q.giver ?? {});
  const r = q.rewards ?? {};
  return {
    status: STATUS[q.status] ? q.status : "available",
    hidden: !!q.hidden,
    zone: String(q.zone ?? "").trim(),
    level: String(q.level ?? "").trim(),
    giver: { name: String(giver.name ?? "").trim(), uuid: String(giver.uuid ?? "").trim() },
    summary: String(q.summary ?? "").trim(),
    description: String(q.description ?? ""),
    objectives: (q.objectives ?? []).map(o => (typeof o === "string" ? { text: o } : o)).filter(o => String(o?.text ?? "").trim())
      .map(o => ({ id: String(o.id || uid()), text: String(o.text).trim(), done: !!o.done, hidden: !!o.hidden, optional: !!o.optional })),
    rewards: {
      coin: String(r.coin ?? "").trim(),
      items: (r.items ?? []).map(i => (typeof i === "string" ? { uuid: i } : i)).filter(i => i?.uuid).map(i => {
        const src = (!i.name || !i.img) ? safeSync(i.uuid) : null;
        return { uuid: String(i.uuid), name: String(i.name ?? src?.name ?? "Item"), img: String(i.img ?? src?.img ?? "icons/svg/item-bag.svg") };
      }),
      other: String(r.other ?? "").trim()
    },
    paid: !!q.paid,
    sort: Number(q.sort) || Date.now()
  };
}

export const isQuest = j => !!j?.flags?.[ID]?.quest;
export const data = j => normalize(j.flags[ID].quest);
export const all = () => game.journal.filter(isQuest);
/** Whether this user may see the quest: the GM sees everything, players only given, unhidden quests they can observe. */
export function canSee(j, user = game.user) {
  if (user.isGM) return true;
  const q = data(j);
  return !q.hidden && q.status !== "available" && j.testUserPermission(user, "OBSERVER");
}
/** A quest from a JournalEntry, its id or UUID, or its exact name. */
export function find(ref) {
  if (!ref) return null;
  if (ref instanceof JournalEntry) return isQuest(ref) ? ref : null;
  const s = String(ref);
  const j = game.journal.get(s) ?? (s.startsWith("JournalEntry.") ? safeSync(s) : null) ?? all().find(x => x.name === s) ?? all().find(x => x.name.toLowerCase() === s.toLowerCase());
  return isQuest(j) ? j : null;
}
function need(ref) { const j = find(ref); if (!j) throw new Error(`Quest log: no quest "${ref?.name ?? ref}".`); return j; }
/** An objective by index, id or text (exact, then partial, ignoring case). */
function objective(q, key) {
  if (typeof key === "number" || /^\d+$/.test(String(key))) return q.objectives[+key] ?? null;
  const k = String(key ?? "").toLowerCase();
  return q.objectives.find(o => o.id === key) ?? q.objectives.find(o => o.text.toLowerCase() === k) ?? q.objectives.find(o => o.text.toLowerCase().includes(k)) ?? null;
}
const required = q => q.objectives.filter(o => !o.optional);
const allDone = q => q.objectives.length > 0 && required(q).every(o => o.done);
const ownershipFor = q => (!q.hidden && q.status !== "available") ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
const coinText = q => { const n = q.rewards.coin ? WCT.parseMoney(q.rewards.coin) : 0; return n > 0 ? WCT.fmtMoney(n) : ""; };
const link = (uuid, name) => uuid ? `@UUID[${uuid}]{${String(name).replace(/[{}[\]]/g, "")}}` : esc(name);

/** The journal page, written from the quest data. Hidden objectives go in a secret block, which only the GM sees in Foundry. */
export function pageHTML(q, name) {
  const meta = [`<strong>Status:</strong> ${STATUS[q.status].label}${q.hidden ? " (hidden from players)" : ""}`];
  if (q.level) meta.push(`<strong>Level:</strong> ${esc(q.level)}`);
  if (q.zone) meta.push(`<strong>Zone:</strong> ${esc(q.zone)}`);
  const obj = o => `<li>${o.done ? "☑" : "☐"} ${o.done ? `<s>${esc(o.text)}</s>` : esc(o.text)}${o.optional ? " <em>(optional)</em>" : ""}</li>`;
  const shown = q.objectives.filter(o => !o.hidden), secret = q.objectives.filter(o => o.hidden);
  const rewards = [coinText(q), ...q.rewards.items.map(i => link(i.uuid, i.name)), q.rewards.other ? esc(q.rewards.other) : ""].filter(Boolean);
  return [
    `<p>${meta.join(" · ")}</p>`,
    q.giver.name ? `<p><strong>Quest giver:</strong> ${link(q.giver.uuid, q.giver.name)}</p>` : "",
    q.summary ? `<p><em>${esc(q.summary)}</em></p>` : "",
    `<h2>Objectives</h2>`,
    shown.length ? `<ul>${shown.map(obj).join("")}</ul>` : (secret.length ? "" : `<p>None yet.</p>`),
    secret.length ? `<section class="secret" id="secret-wct-objectives"><p><strong>Hidden objectives</strong></p><ul>${secret.map(obj).join("")}</ul></section>` : "",
    q.description ? `<h2>Description</h2>${q.description}` : "",
    rewards.length ? `<h2>Rewards</h2><ul>${rewards.map(r => `<li>${r}</li>`).join("")}</ul>${q.paid ? "<p><em>Rewards paid.</em></p>" : ""}` : ""
  ].filter(Boolean).join("\n");
}

async function questFolder() {
  const name = S("questFolder") || "Quest Log";
  return game.folders.find(f => f.type === "JournalEntry" && f.name === name) ?? Folder.create({ name, type: "JournalEntry", sorting: "a" });
}

/** Writes quest data, ownership and the page in one go. */
async function save(j, q, name = j.name) {
  q = normalize(q);
  await j.update({ name, "ownership.default": ownershipFor(q), [`flags.${ID}.quest`]: q });
  const content = pageHTML(q, name); const page = j.pages.contents[0];
  if (page) { if (page.name !== name || page.text?.content !== content) await page.update({ name, "text.content": content }); }
  else await j.createEmbeddedDocuments("JournalEntryPage", [{ name, type: "text", text: { content, format: 1 } }]);
  return j;
}

// ---------------------------------------------------------------- moments (chat, sound)
function playSound(key) {
  const src = S(key); if (!src) return;
  foundry.audio.AudioHelper.play({ src, volume: S("questVolume") ?? 0.8, autoplay: true, loop: false }, true);
}
function card(kind, j, q, body = "") {
  const head = { active: ["!", "New quest"], completed: ["✔", "Quest complete"], failed: ["✖", "Quest failed"], reopened: ["?", "Quest reopened"] }[kind];
  const meta = [q.level && `Level ${esc(q.level)}`, q.zone && esc(q.zone), q.giver.name && `from ${esc(q.giver.name)}`].filter(Boolean).join(" · ");
  return `<div class="wct-quest-card ${kind}"><header><span class="wct-glyph">${head[0]}</span><div><small>${head[1]}</small><h3>${esc(j.name)}</h3></div></header>${meta ? `<p class="meta">${meta}</p>` : ""}${body}<button type="button" data-wct-quest-open="${j.id}"><i class="fa-solid fa-scroll"></i> Open quest log</button></div>`;
}
function say(content, j, extra = {}) {
  return ChatMessage.create({ content, speaker: { alias: "Quest Log" }, flags: { [ID]: { quest: { id: j.id, ...extra } } } });
}
async function announceStatus(j, q, prev) {
  if (q.status === "active") {
    playSound("questSoundAccept");
    if (prev === "available" || prev === null) return say(card("active", j, q, q.summary ? `<p>${esc(q.summary)}</p>` : ""), j, { kind: "active" });
    return say(card("reopened", j, q), j, { kind: "reopened" });
  }
  if (q.status === "completed") {
    playSound("questSoundComplete");
    const coin = coinText(q);
    const rewards = [coin && `<li class="coin">${esc(coin)}</li>`, ...q.rewards.items.map(i => `<li><img src="${esc(i.img)}" alt=""> ${esc(i.name)}</li>`), q.rewards.other && `<li>${esc(q.rewards.other)}</li>`].filter(Boolean);
    const hasPay = !!(coin || q.rewards.items.length);
    const body = `${rewards.length ? `<p class="lbl">Rewards</p><ul class="rewards">${rewards.join("")}</ul>` : ""}${hasPay ? `<button type="button" data-wct-action="pay-quest"><i class="fa-solid fa-coins"></i> Pay rewards</button>` : ""}`;
    return say(card("completed", j, q, body), j, { kind: "completed" });
  }
  if (q.status === "failed") return say(card("failed", j, q), j, { kind: "failed" });
}
async function announceObjective(j, o, verb) {
  const text = `${verb === "new" ? "New objective" : "Objective complete"}: ${o.text}`;
  if (S("questObjectiveChat")) return say(`<div class="wct-quest-line ${verb}"><span class="wct-glyph">${verb === "new" ? "!" : "✔"}</span> <strong>${esc(j.name)}</strong>: ${verb === "new" ? "" : "<s>"}${esc(o.text)}${verb === "new" ? "" : "</s>"}${o.optional ? " <em>(optional)</em>" : ""}</div>`, j, { kind: "objective" });
  game.socket.emit(SOCKET, { action: "questNotify", text: `${j.name}: ${text}` });
  ui.notifications.info(`${j.name}: ${text}`);
}

// ---------------------------------------------------------------- writes (GM client only)
const OPS = {
  async create(d = {}) {
    const name = String(d.title ?? d.name ?? "").trim() || "New Quest";
    const q = normalize({ ...d, status: d.status ?? "available" });
    const folder = await questFolder();
    const j = await JournalEntry.create({ name, folder: folder.id, ownership: { default: ownershipFor(q) }, flags: { [ID]: { quest: q } }, pages: [{ name, type: "text", text: { content: pageHTML(q, name), format: 1 } }] });
    if (q.status !== "available" && !q.hidden && d.announce !== false) await announceStatus(j, q, null);
    return j;
  },
  /** Changes fields (not the status; use setStatus for that so the moment is announced). */
  async update(ref, patch = {}) {
    const j = need(ref); const q = data(j); const name = String(patch.title ?? patch.name ?? j.name).trim() || j.name;
    const next = normalize({ ...q, ...patch, status: q.status, rewards: { ...q.rewards, ...(patch.rewards ?? {}) }, giver: patch.giver ?? q.giver });
    const wasHidden = q.hidden;
    await save(j, next, name);
    if (wasHidden && !next.hidden && next.status === "active") await announceStatus(j, next, "available");
    return j;
  },
  async setStatus(ref, status, { announce = true } = {}) {
    if (!STATUS[status]) throw new Error(`Quest log: unknown status "${status}".`);
    const j = need(ref); const q = data(j); const prev = q.status; if (prev === status) return j;
    q.status = status; if (status === "available") q.paid = false;
    await save(j, q);
    if (announce && !q.hidden) await announceStatus(j, q, prev);
    return j;
  },
  async setHidden(ref, hidden) {
    const j = need(ref); const q = data(j); if (q.hidden === !!hidden) return j;
    q.hidden = !!hidden; await save(j, q);
    if (!q.hidden && q.status === "active") await announceStatus(j, q, "available");
    return j;
  },
  async tick(ref, key, done = true) {
    const j = need(ref); const q = data(j); const o = objective(q, key);
    if (!o) throw new Error(`Quest log: "${j.name}" has no objective "${key}".`);
    if (o.done === !!done) return j;
    o.done = !!done; await save(j, q);
    if (o.done && !q.hidden && !o.hidden && q.status === "active") await announceObjective(j, o, "done");
    return j;
  },
  async reveal(ref, key, reveal = true) {
    const j = need(ref); const q = data(j); const o = objective(q, key);
    if (!o) throw new Error(`Quest log: "${j.name}" has no objective "${key}".`);
    if (o.hidden === !reveal) return j;
    o.hidden = !reveal; await save(j, q);
    if (reveal && !q.hidden && q.status === "active") await announceObjective(j, o, "new");
    return j;
  },
  async remove(ref) { const j = need(ref); await j.delete(); return true; },
  /** Pays a completed quest's coin and items to the party group actor, once. */
  async pay(ref, messageId = null) {
    const j = need(ref); const q = data(j);
    if (q.paid) { ui.notifications.info(`${j.name}: rewards already paid.`); return false; }
    const party = WCT.partyActor(); if (!party) { ui.notifications.warn(`Quest log: no group actor named ${WCT.PARTY}.`); return false; }
    const amount = q.rewards.coin ? WCT.parseMoney(q.rewards.coin) : 0;
    if (amount > 0) await WCT.addMoney(party, amount);
    const docs = [];
    for (const i of q.rewards.items) {
      const src = await fromUuid(i.uuid).catch(() => null);
      if (!(src instanceof Item)) { ui.notifications.warn(`${j.name}: reward item ${i.name} not found.`); continue; }
      const o = src.toObject(); delete o._id; foundry.utils.setProperty(o, `flags.${ID}.questReward`, j.id); docs.push(o);
    }
    if (docs.length) await party.createEmbeddedDocuments("Item", docs);
    q.paid = true; await save(j, q);
    const msg = messageId ? game.messages.get(messageId) : null;
    if (msg) await msg.setFlag(ID, "quest", { ...(msg.getFlag(ID, "quest") ?? {}), paid: true });
    ui.notifications.info(`${j.name}: paid ${[amount > 0 && WCT.fmtMoney(amount), docs.length && `${docs.length} item${docs.length === 1 ? "" : "s"}`].filter(Boolean).join(" and ") || "nothing"} to ${party.name}.`);
    return true;
  }
};
/** Runs a write op. Only GMs write quests; players (and anything running on a player's client) only read and track. */
async function run(op, ...args) {
  if (!game.user.isGM) { ui.notifications.warn("Only the GM can change quests."); return null; }
  try { return await OPS[op](...args); }
  catch (e) { ui.notifications.error(e.message); console.error(`${ID} |`, e); return null; }
}

// ---------------------------------------------------------------- tracking (per user, stored in this browser)
export function tracked() { try { const v = JSON.parse(S("trackedQuests") || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
async function setTracked(list) { await game.settings.set(ID, "trackedQuests", JSON.stringify([...new Set(list)])); refresh(); }
export async function track(ref, on = null) {
  const j = find(ref); if (!j) return false; const list = tracked(); const has = list.includes(j.id);
  on ??= !has; if (on === has) return on;
  if (on && list.filter(id => { const x = find(id); return x && data(x).status === "active"; }).length >= MAX_TRACKED) { ui.notifications.warn(`You can track up to ${MAX_TRACKED} quests.`); return false; }
  await setTracked(on ? [...list, j.id] : list.filter(id => id !== j.id));
  return on;
}
/** Active-and-visible state per quest, so a quest that becomes active for this user is tracked automatically. */
const seen = new Map();
const liveFor = j => isQuest(j) && canSee(j) && data(j).status === "active";
function autoTrack(j) {
  if (!TRACKER) return;
  const now = liveFor(j); const before = seen.get(j.id) ?? false; seen.set(j.id, now);
  if (!now || before) return;
  const list = tracked(); if (list.includes(j.id)) return;
  const live = list.filter(id => { const x = find(id); return x && liveFor(x); });
  if (live.length < MAX_TRACKED) setTracked([...list.filter(id => game.journal.has(id)), j.id]);
}

// ---------------------------------------------------------------- tracker HUD
let hud = null; let hudHTML = "";
function renderTracker() {
  if (!TRACKER || !S("questTracker")) { hud?.remove(); hud = null; hudHTML = ""; return; }
  const list = tracked().map(find).filter(j => j && canSee(j) && data(j).status === "active");
  if (!hud) {
    hud = document.createElement("section"); hud.id = "wct-quest-tracker"; hud.setAttribute("aria-label", "Tracked quests");
    (document.getElementById("ui-middle") ?? document.body).append(hud);
    hud.addEventListener("click", ev => {
      const t = ev.target.closest("[data-action]"); if (!t) return;
      if (t.dataset.action === "collapse") game.settings.set(ID, "trackerCollapsed", !S("trackerCollapsed")).then(renderTracker);
      else if (t.dataset.action === "open") open(t.closest("[data-quest-id]")?.dataset.questId);
    });
  }
  hud.hidden = !list.length;
  const collapsed = !!S("trackerCollapsed");
  const item = j => {
    const q = data(j); const left = q.objectives.filter(o => !o.hidden && !o.done).sort((a, b) => a.optional - b.optional);
    const lines = left.map(o => `<li class="${o.optional ? "opt" : ""}">${esc(o.text)}${o.optional ? " <em>(optional)</em>" : ""}</li>`);
    if (allDone(q) && !left.some(o => !o.optional)) lines.unshift(`<li class="ready">All objectives complete</li>`);
    return `<li data-quest-id="${j.id}"><a data-action="open" class="ttl">${esc(j.name)}</a>${lines.length ? `<ul>${lines.join("")}</ul>` : ""}</li>`;
  };
  hud.classList.toggle("collapsed", collapsed);
  // Only touch the DOM when the list actually changed (most journal updates don't change what the tracker shows).
  const html = `<header><button type="button" data-action="collapse" aria-expanded="${!collapsed}" data-tooltip="${collapsed ? "Show" : "Hide"} tracked quests"><i class="fa-solid fa-chevron-${collapsed ? "down" : "up"}"></i></button><span>Quests</span><span class="n">${list.length}</span></header>${collapsed ? "" : `<ol>${list.map(item).join("")}</ol>`}`;
  if (html !== hudHTML) { hud.innerHTML = html; hudHTML = html; }
}

// ---------------------------------------------------------------- the quest log window
let LOG = null;
const TABS = { active: "Active", completed: "Completed", available: "Not given" };
const inTab = (q, tab) => tab === "completed" ? ["completed", "failed"].includes(q.status) : q.status === tab;

export class QuestLog extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "wct-quest-log",
    classes: ["wct-quests", "wct-window"],
    window: { title: "Quest Log", icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 780, height: 580 }
  };
  tab = "active";
  selected = null;

  async _renderHTML() {
    const gm = game.user.isGM;
    const quests = all().filter(j => canSee(j)).map(j => ({ j, q: data(j) })).sort((a, b) => a.q.sort - b.q.sort || a.j.name.localeCompare(b.j.name));
    const tabs = Object.keys(TABS).filter(t => gm || t !== "available");
    if (!tabs.includes(this.tab)) this.tab = "active";
    // When the selected quest moves (given, completed, failed), follow it to its tab.
    const cur = quests.find(x => x.j.id === this.selected);
    if (cur && !inTab(cur.q, this.tab)) this.tab = tabs.find(t => inTab(cur.q, t)) ?? this.tab;
    const here = quests.filter(x => inTab(x.q, this.tab));
    let sel = here.find(x => x.j.id === this.selected) ?? here[0] ?? null;
    this.selected = sel?.j.id ?? null;

    const zones = new Map();
    for (const x of here) { const z = x.q.zone || "General"; if (!zones.has(z)) zones.set(z, []); zones.get(z).push(x); }
    const zoneNames = [...zones.keys()].sort((a, b) => (a === "General") - (b === "General") || a.localeCompare(b));
    const tr = tracked();
    const glyph = q => q.status === "active" ? `<span class="wct-glyph ${allDone(q) ? "" : "dim"}">?</span>` : `<span class="wct-glyph ${q.status}">${STATUS[q.status].glyph}</span>`;
    const row = ({ j, q }) => `<li class="wctq-row ${j.id === this.selected ? "sel" : ""} ${q.status}" data-quest-id="${j.id}" tabindex="0">${glyph(q)}<span class="name">${esc(j.name)}</span>${q.level ? `<span class="lvl">${esc(q.level)}</span>` : ""}${q.hidden ? `<i class="fa-solid fa-eye-slash" data-tooltip="Hidden from players"></i>` : ""}${TRACKER && q.status === "active" && tr.includes(j.id) ? `<i class="fa-solid fa-location-crosshairs" data-tooltip="Tracked"></i>` : ""}</li>`;
    const list = here.length ? zoneNames.map(z => `<li class="wctq-zone"><h4>${esc(z)}</h4><ul>${zones.get(z).map(row).join("")}</ul></li>`).join("")
      : `<li class="wctq-none">${this.tab === "active" ? "No quests yet." : this.tab === "completed" ? "Nothing finished yet." : "No quests waiting to be given."}</li>`;

    const div = document.createElement("div");
    div.className = "wctq-frame";
    div.innerHTML = `
      <nav class="wctq-tabs" role="tablist">${tabs.map(t => `<button type="button" role="tab" data-tab="${t}" aria-selected="${t === this.tab}" class="${t === this.tab ? "on" : ""}">${TABS[t]} <span>${quests.filter(x => inTab(x.q, t)).length}</span></button>`).join("")}
        ${gm ? `<button type="button" class="wctq-new" data-action="new"><i class="fa-solid fa-plus"></i> New quest</button>` : ""}</nav>
      <div class="wctq-body">
        <aside class="wctq-list"><ul>${list}</ul></aside>
        <article class="wctq-detail">${sel ? await this.detailHTML(sel.j, sel.q) : `<div class="wctq-empty"><p>${gm ? "Create a quest with <strong>New quest</strong>." : "Your quest log is empty."}</p></div>`}</article>
      </div>`;
    return div;
  }

  async detailHTML(j, q) {
    const gm = game.user.isGM;
    const objs = q.objectives.filter(o => gm || !o.hidden);
    const meta = [q.level && `<span>Level ${esc(q.level)}</span>`, q.zone && `<span>${esc(q.zone)}</span>`, q.status === "failed" && `<span class="bad">Failed</span>`, q.status === "completed" && `<span class="good">Completed</span>`, gm && q.status === "available" && `<span>Not given</span>`, gm && q.hidden && `<span class="bad"><i class="fa-solid fa-eye-slash"></i> Hidden from players</span>`].filter(Boolean).join("");
    const obj = (o) => {
      const i = q.objectives.indexOf(o);
      return `<li class="${o.done ? "done" : ""} ${o.hidden ? "secret" : ""}" data-obj="${i}">${gm ? `<button type="button" class="box" data-action="tick" aria-pressed="${o.done}" data-tooltip="${o.done ? "Untick" : "Tick off"}">${o.done ? "✔" : ""}</button>` : `<span class="box">${o.done ? "✔" : ""}</span>`}<span class="txt">${esc(o.text)}${o.optional ? " <em>(optional)</em>" : ""}</span>${gm && o.hidden ? `<button type="button" class="mini" data-action="reveal"><i class="fa-solid fa-eye"></i> Reveal</button>` : ""}${gm && !o.hidden && !o.done ? `<button type="button" class="mini ghost" data-action="conceal" data-tooltip="Hide from players"><i class="fa-solid fa-eye-slash"></i></button>` : ""}</li>`;
    };
    const desc = q.description ? await TextEditorImpl().enrichHTML(q.description, { secrets: gm, relativeTo: j }) : "";
    const coin = coinText(q);
    const rewards = [coin && `<div class="coin"><i class="fa-solid fa-coins"></i> ${esc(coin)}</div>`, q.rewards.items.length && `<div class="items">${q.rewards.items.map(i => `<a class="item" data-uuid="${esc(i.uuid)}" data-tooltip="${esc(i.name)}"><img src="${esc(i.img)}" alt=""><span>${esc(i.name)}</span></a>`).join("")}</div>`, q.rewards.other && `<div class="other">${esc(q.rewards.other)}</div>`].filter(Boolean).join("");
    const isTracked = tracked().includes(j.id);
    const btn = (action, icon, label, cls = "") => `<button type="button" data-action="${action}" class="${cls}"><i class="fa-solid ${icon}"></i> ${label}</button>`;
    const gmBar = gm ? [
      q.status === "available" && btn("give", "fa-exclamation", "Give quest", "primary"),
      q.status === "active" && btn("complete", "fa-check", "Complete", "primary"),
      q.status === "active" && btn("fail", "fa-xmark", "Fail"),
      ["completed", "failed"].includes(q.status) && btn("reopen", "fa-rotate-left", "Reopen"),
      q.status === "completed" && (coin || q.rewards.items.length) && !q.paid && btn("pay", "fa-coins", "Pay rewards"),
      btn("hide", q.hidden ? "fa-eye" : "fa-eye-slash", q.hidden ? "Show to players" : "Hide from players"),
      btn("edit", "fa-pen", "Edit"), btn("journal", "fa-book-open", "Journal"), btn("delete", "fa-trash", "Delete", "danger")
    ].filter(Boolean).join("") : "";
    return `
      <div class="wctq-page" data-quest-id="${j.id}">
        <header><h2>${esc(j.name)}</h2>${meta ? `<p class="meta">${meta}</p>` : ""}</header>
        ${q.giver.name ? `<p class="giver">Quest giver: ${q.giver.uuid ? `<a data-uuid="${esc(q.giver.uuid)}">${esc(q.giver.name)}</a>` : esc(q.giver.name)}</p>` : ""}
        ${q.summary ? `<p class="summary">${esc(q.summary)}</p>` : ""}
        <h3>Objectives</h3>
        ${objs.length ? `<ul class="wctq-objs">${objs.map(obj).join("")}</ul>` : `<p class="faint">No objectives yet.</p>`}
        ${desc ? `<h3>Description</h3><div class="desc">${desc}</div>` : ""}
        ${rewards ? `<h3>Rewards${q.paid ? ' <small>(paid)</small>' : ""}</h3><div class="wctq-rewards">${rewards}</div>` : ""}
      </div>
      <footer class="wctq-bar">
        ${q.status === "active" && TRACKER ? `<label class="track"><input type="checkbox" data-action="track" ${isTracked ? "checked" : ""}> Track</label>` : ""}
        ${gmBar}
      </footer>`;
  }

  _replaceHTML(result, content) {
    const top = content.querySelector(".wctq-list")?.scrollTop ?? 0, dtop = content.querySelector(".wctq-detail")?.scrollTop ?? 0;
    const same = content.querySelector(".wctq-page")?.dataset.questId === this.selected;
    content.replaceChildren(result);
    const l = content.querySelector(".wctq-list"); if (l) l.scrollTop = top;
    const d = content.querySelector(".wctq-detail"); if (d && same) d.scrollTop = dtop;
  }

  _onRender() {
    const root = this.element.querySelector(".wctq-frame"); if (!root) return;
    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this.tab = b.dataset.tab; this.selected = null; this.render(); }));
    root.querySelectorAll(".wctq-row").forEach(r => {
      const pick = () => { this.selected = r.dataset.questId; this.render(); };
      r.addEventListener("click", pick);
      r.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
    });
    root.querySelectorAll("a[data-uuid]").forEach(a => a.addEventListener("click", async ev => {
      ev.preventDefault(); const d = await fromUuid(a.dataset.uuid).catch(() => null);
      if (d?.sheet && (d.testUserPermission?.(game.user, "LIMITED") ?? true)) d.sheet.render(true); else ui.notifications.info(a.textContent.trim());
    }));
    root.querySelector("[data-action=new]")?.addEventListener("click", () => new QuestEditor(null).render({ force: true }));
    const page = root.querySelector(".wctq-page"); if (!page) return;
    const id = page.dataset.questId; const j = find(id); if (!j) return;
    root.querySelector("[data-action=track]")?.addEventListener("change", async ev => { const on = await track(id, ev.target.checked); ev.target.checked = !!on; });
    const act = {
      give: () => run("setStatus", id, "active"),
      complete: () => run("setStatus", id, "completed"),
      fail: async () => { if (await WCT.confirm("Fail quest", `<p>Mark <strong>${esc(j.name)}</strong> as failed?</p>`)) return run("setStatus", id, "failed"); },
      reopen: () => run("setStatus", id, "active"),
      pay: () => run("pay", id),
      hide: () => run("setHidden", id, !data(j).hidden),
      edit: () => new QuestEditor(j).render({ force: true }),
      journal: () => j.sheet.render(true),
      delete: async () => { if (await WCT.confirm("Delete quest", `<p>Delete <strong>${esc(j.name)}</strong> and its journal entry? This can't be undone.</p>`)) return run("remove", id); },
      tick: el => run("tick", id, +el.closest("[data-obj]").dataset.obj, !data(j).objectives[+el.closest("[data-obj]").dataset.obj]?.done),
      reveal: el => run("reveal", id, +el.closest("[data-obj]").dataset.obj, true),
      conceal: el => run("reveal", id, +el.closest("[data-obj]").dataset.obj, false)
    };
    root.querySelectorAll("button[data-action]").forEach(b => { const fn = act[b.dataset.action]; if (fn) b.addEventListener("click", ev => { ev.preventDefault(); fn(b); }); });
  }

  async close(options) { if (LOG === this) LOG = null; return super.close(options); }
}

/** Opens the quest log (or brings it forward), optionally on one quest. */
export function open(ref = null) {
  LOG ??= new QuestLog();
  const j = ref ? find(ref) : null;
  if (j && canSee(j)) { const q = data(j); LOG.tab = q.status === "available" ? "available" : ["completed", "failed"].includes(q.status) ? "completed" : "active"; LOG.selected = j.id; }
  LOG.render({ force: true });
  return LOG;
}
function toggle() { if (LOG?.rendered) LOG.close(); else open(); }

// ---------------------------------------------------------------- the editor (GM)
export class QuestEditor extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["wct-quests", "wct-quest-edit", "wct-window"],
    window: { title: "Quest", icon: "fa-solid fa-pen", resizable: true },
    position: { width: 600, height: 720 }
  };
  constructor(j, options = {}) {
    super({ id: `wct-quest-edit-${j?.id ?? "new"}`, ...options });
    this.quest = j; this.q = j ? data(j) : normalize({});
  }
  get title() { return this.quest ? `Edit quest · ${this.quest.name}` : "New quest"; }

  objRow(o = {}) {
    return `<li class="wctq-orow" data-id="${esc(o.id ?? "")}">
      <input type="text" class="otext" value="${esc(o.text ?? "")}" placeholder="e.g. Deal with the bandit camp" aria-label="Objective">
      <label data-tooltip="Already done"><input type="checkbox" class="odone" ${o.done ? "checked" : ""}> Done</label>
      <label data-tooltip="Players don't see it until you reveal it"><input type="checkbox" class="ohidden" ${o.hidden ? "checked" : ""}> Hidden</label>
      <label data-tooltip="Not needed to finish the quest"><input type="checkbox" class="oopt" ${o.optional ? "checked" : ""}> Optional</label>
      <span class="omove"><button type="button" data-action="up" aria-label="Move up"><i class="fa-solid fa-arrow-up"></i></button><button type="button" data-action="down" aria-label="Move down"><i class="fa-solid fa-arrow-down"></i></button><button type="button" data-action="rm" aria-label="Remove"><i class="fa-solid fa-trash"></i></button></span>
    </li>`;
  }
  itemChip(i) { return `<li class="wctq-chip" data-uuid="${esc(i.uuid)}" data-name="${esc(i.name)}" data-img="${esc(i.img)}"><img src="${esc(i.img)}" alt=""><span>${esc(i.name)}</span><button type="button" data-action="rmitem" aria-label="Remove ${esc(i.name)}"><i class="fa-solid fa-xmark"></i></button></li>`; }

  async _renderHTML() {
    const q = this.q; const name = this.quest?.name ?? "";
    const div = document.createElement("form");
    div.className = "wctq-edit"; div.autocomplete = "off";
    div.innerHTML = `
      <div class="form-group"><label>Title</label><input type="text" name="title" value="${esc(name)}" placeholder="e.g. Trouble at the Old Mill" required></div>
      <div class="wctq-two">
        <div class="form-group"><label>Zone / region</label><input type="text" name="zone" value="${esc(q.zone)}" placeholder="Groups quests in the log"></div>
        <div class="form-group"><label>Level / tier</label><input type="text" name="level" value="${esc(q.level)}" placeholder="optional"></div>
      </div>
      <div class="form-group"><label>Quest giver</label><div class="wctq-giver" data-drop="giver"><input type="text" name="giver" value="${esc(q.giver.name)}" placeholder="Name, or drop an actor here"><input type="hidden" name="giverUuid" value="${esc(q.giver.uuid)}"><span class="linked ${q.giver.uuid ? "" : "off"}" data-tooltip="Linked to an actor"><i class="fa-solid fa-link"></i><button type="button" data-action="unlink" aria-label="Remove link"><i class="fa-solid fa-xmark"></i></button></span></div></div>
      <div class="wctq-two">
        <div class="form-group"><label>Status</label><select name="status">${Object.entries(STATUS).map(([k, s]) => `<option value="${k}" ${k === q.status ? "selected" : ""}>${s.label}</option>`).join("")}</select></div>
        <div class="form-group"><label>Hidden from players</label><input type="checkbox" name="hidden" ${q.hidden ? "checked" : ""}></div>
      </div>
      <div class="form-group stacked"><label>Summary <small>one or two lines, shown in chat and the tracker's log</small></label><textarea name="summary" rows="2">${esc(q.summary)}</textarea></div>
      <div class="form-group stacked"><label>Description</label><div class="wctq-desc"></div></div>
      <fieldset><legend>Objectives</legend><p class="hint">Write what needs doing, not a count: "Handle the bandit camp", "Find out who hired them".</p>
        <ol class="wctq-olist">${q.objectives.map(o => this.objRow(o)).join("")}</ol>
        <button type="button" data-action="addobj"><i class="fa-solid fa-plus"></i> Add objective</button></fieldset>
      <fieldset><legend>Rewards</legend>
        <div class="form-group"><label>Coin</label><input type="text" name="coin" value="${esc(q.rewards.coin)}" placeholder="e.g. 1g 20s"><span class="hint coinprev"></span></div>
        <div class="form-group stacked"><label>Items <small>drop items here</small></label><ul class="wctq-items" data-drop="items">${q.rewards.items.map(i => this.itemChip(i)).join("")}</ul></div>
        <div class="form-group"><label>Other</label><input type="text" name="other" value="${esc(q.rewards.other)}" placeholder="e.g. Renown with the town watch"></div>
      </fieldset>
      <footer class="wctq-bar"><button type="submit" class="primary"><i class="fa-solid fa-floppy-disk"></i> Save</button><button type="button" data-action="cancel">Cancel</button></footer>`;
    // Rich text: Foundry's ProseMirror element when available, else a plain HTML textarea.
    const PM = foundry.applications?.elements?.HTMLProseMirrorElement;
    let ed = null;
    try { if (PM?.create) ed = PM.create({ name: "description", value: q.description, toggled: false, height: 200, documentUUID: this.quest?.uuid }); } catch (e) { console.warn(`${ID} | ProseMirror editor unavailable`, e); }
    if (!ed) { ed = document.createElement("textarea"); ed.name = "description"; ed.rows = 8; ed.value = q.description; }
    div.querySelector(".wctq-desc").append(ed);
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  _onRender() {
    const f = this.element.querySelector("form.wctq-edit"); if (!f) return;
    const list = f.querySelector(".wctq-olist");
    const coinPrev = () => { const v = f.coin.value.trim(); const n = v ? WCT.parseMoney(v) : 0; f.querySelector(".coinprev").textContent = v ? (n > 0 ? `= ${WCT.fmtMoney(n)}` : "not a coin amount") : ""; };
    f.coin.addEventListener("input", coinPrev); coinPrev();
    f.addEventListener("click", ev => {
      const b = ev.target.closest("button[data-action]"); if (!b) return;
      const row = b.closest(".wctq-orow");
      switch (b.dataset.action) {
        case "addobj": list.insertAdjacentHTML("beforeend", this.objRow()); list.lastElementChild.querySelector(".otext").focus(); break;
        case "up": if (row.previousElementSibling) row.previousElementSibling.before(row); break;
        case "down": if (row.nextElementSibling) row.nextElementSibling.after(row); break;
        case "rm": row.remove(); break;
        case "rmitem": b.closest(".wctq-chip").remove(); break;
        case "unlink": f.giverUuid.value = ""; f.querySelector(".linked").classList.add("off"); break;
        case "cancel": this.close(); break;
        default: return;
      }
      ev.preventDefault();
    });
    const dropData = ev => { try { return TextEditorImpl().getDragEventData(ev); } catch { return null; } };
    for (const zone of f.querySelectorAll("[data-drop]")) {
      zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("over"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("over"));
      zone.addEventListener("drop", async ev => {
        ev.preventDefault(); zone.classList.remove("over"); const d = dropData(ev); if (!d?.uuid) return;
        const doc = await fromUuid(d.uuid).catch(() => null); if (!doc) return;
        if (zone.dataset.drop === "giver") {
          if (doc.documentName !== "Actor") return ui.notifications.warn("Drop an actor to link the quest giver.");
          f.giver.value = doc.name; f.giverUuid.value = doc.uuid; f.querySelector(".linked").classList.remove("off");
        } else {
          if (doc.documentName !== "Item") return ui.notifications.warn("Drop an item to add it as a reward.");
          if (zone.querySelector(`[data-uuid="${CSS.escape(doc.uuid)}"]`)) return;
          zone.insertAdjacentHTML("beforeend", this.itemChip({ uuid: doc.uuid, name: doc.name, img: doc.img }));
        }
      });
    }
    f.addEventListener("submit", async ev => {
      ev.preventDefault();
      const title = f.title.value.trim(); if (!title) { ui.notifications.warn("Give the quest a title."); return f.title.focus(); }
      const ed = f.querySelector("[name=description]");
      const giverName = f.giver.value.trim();
      const patch = {
        title, zone: f.zone.value, level: f.level.value, hidden: f.hidden.checked,
        giver: { name: giverName, uuid: giverName ? f.giverUuid.value : "" },
        summary: f.summary.value, description: String(ed?.value ?? ""),
        objectives: [...list.querySelectorAll(".wctq-orow")].map(r => ({ id: r.dataset.id || undefined, text: r.querySelector(".otext").value, done: r.querySelector(".odone").checked, hidden: r.querySelector(".ohidden").checked, optional: r.querySelector(".oopt").checked })),
        rewards: { coin: f.coin.value, other: f.other.value, items: [...f.querySelectorAll(".wctq-chip")].map(c => ({ uuid: c.dataset.uuid, name: c.dataset.name, img: c.dataset.img })) }
      };
      const status = f.status.value;
      let j;
      if (this.quest && find(this.quest.id)) { j = await run("update", this.quest.id, patch); if (j) await run("setStatus", j.id, status); }
      else j = await run("create", { ...patch, status });
      if (!j) return;
      this.close();
      open(j.id);
    });
  }
}

// ---------------------------------------------------------------- public API
export const api = {
  open, list: () => all().filter(j => canSee(j)).map(j => ({ id: j.id, name: j.name, ...data(j) })),
  get(ref) { const j = find(ref); return j && canSee(j) ? { id: j.id, name: j.name, ...data(j) } : null; },
  /** create({ title, zone, level, giver, summary, description, objectives: ["…"], rewards: { coin, items, other }, status, hidden }) */
  create: (d) => run("create", d),
  update: (ref, patch) => run("update", find(ref)?.id ?? ref, patch),
  activate: (ref, opts) => run("setStatus", find(ref)?.id ?? ref, "active", opts),
  complete: (ref, opts) => run("setStatus", find(ref)?.id ?? ref, "completed", opts),
  fail: (ref, opts) => run("setStatus", find(ref)?.id ?? ref, "failed", opts),
  reset: (ref) => run("setStatus", find(ref)?.id ?? ref, "available", { announce: false }),
  tickObjective: (ref, objective, done = true) => run("tick", find(ref)?.id ?? ref, objective, done),
  untickObjective: (ref, objective) => run("tick", find(ref)?.id ?? ref, objective, false),
  revealObjective: (ref, objective, reveal = true) => run("reveal", find(ref)?.id ?? ref, objective, reveal),
  hide: (ref, hidden = true) => run("setHidden", find(ref)?.id ?? ref, hidden),
  delete: (ref) => run("remove", find(ref)?.id ?? ref),
  payRewards: (ref) => run("pay", find(ref)?.id ?? ref),
  track, tracked, find, normalize, pageHTML
};

// ---------------------------------------------------------------- setup
/**
 * Called from the module's init hook whatever the feature toggle (the control panel shows a turned-off feature's settings greyed out).
 * World settings live in the control panel's Quests tab. `tracker`: the per-user "Show on screen" setting, registered (and listed in
 * the main settings list, so players can use it) only when the quest log and the tracker are both on.
 */
export function registerSettings({ tracker = false } = {}) {
  const w = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  w("questFolder", "Quest log: Quest folder", "Journal folder that holds the quests. Created when the first quest is made.", String, "Quest Log");
  w("questObjectiveChat", "Quest log: Objectives in chat", "Post a short chat line when an objective is ticked off or revealed. Off: a notification for everyone instead.", Boolean, true);
  w("questSoundAccept", "Quest log: Quest accepted sound", "Audio file played for everyone when a quest is given. Leave blank for none.", String, "", { filePicker: "audio" });
  w("questSoundComplete", "Quest log: Quest complete sound", "Audio file played for everyone when a quest is completed. Leave blank for none.", String, "", { filePicker: "audio" });
  w("questVolume", "Quest log: Sound volume", "", Number, 0.8, { range: { min: 0, max: 1, step: 0.05 } });
  if (tracker) game.settings.register(ID, "questTracker", { name: "Quest tracker: Show on screen", hint: "Show tracked quests and their open objectives on screen. Tick Track on a quest in the quest log to follow it.", scope: "client", config: true, type: Boolean, default: true, onChange: () => renderTracker() });
  game.settings.register(ID, "trackedQuests", { scope: "client", config: false, type: String, default: "[]" });
  game.settings.register(ID, "trackerCollapsed", { scope: "client", config: false, type: Boolean, default: false });
}

let refreshT = null;
function refresh() { clearTimeout(refreshT); refreshT = setTimeout(() => { if (LOG?.rendered) LOG.render(); renderTracker(); }, 60); }

/** Called from the module's init hook when the quest log is on: settings, key binding, scene control, chat and document hooks. `tracker`: the Quest tracker feature. */
export function init(wct, { tracker = true } = {}) {
  WCT = wct; TRACKER = !!tracker;
  try {
    game.keybindings.register(ID, "questLog", { name: "Open quest log", hint: "Opens or closes the Wayfarer's Toolkit quest log.", editable: [{ key: "KeyL" }], onDown: () => { toggle(); return true; }, precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL });
  } catch (e) { console.warn(`${ID} | quest log key binding not registered`, e); }

  Hooks.on("getSceneControlButtons", controls => {
    const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
    tokens.tools.wctQuests = { name: "wctQuests", title: "Quest Log", icon: "fa-solid fa-scroll", order: 100, button: true, visible: true, onChange: () => open() };
  });
  const onDoc = (j) => { if (!isQuest(j) && !seen.has(j.id)) return; if (isQuest(j)) autoTrack(j); else seen.delete(j.id); refresh(); };
  Hooks.on("createJournalEntry", onDoc);
  Hooks.on("updateJournalEntry", onDoc);
  Hooks.on("deleteJournalEntry", j => { if (!seen.has(j.id) && !isQuest(j)) return; seen.delete(j.id); if (tracked().includes(j.id) && game.ready) setTracked(tracked().filter(id => id !== j.id)); refresh(); });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    const info = message.flags?.[ID]?.quest; if (!info) return;
    html.querySelectorAll?.("[data-wct-quest-open]").forEach(b => {
      const j = find(b.dataset.wctQuestOpen); if (!j || !canSee(j)) return b.remove();
      b.addEventListener("click", ev => { ev.preventDefault(); open(j.id); });
    });
    const pay = html.querySelector?.("[data-wct-action=pay-quest]"); if (!pay) return;
    if (!game.user.isGM) return pay.remove();
    const j = find(info.id);
    if (info.paid || !j || data(j).paid) { pay.disabled = true; pay.innerHTML = `<i class="fa-solid fa-check"></i> ${j ? "Rewards paid" : "Quest deleted"}`; return; }
    pay.addEventListener("click", async ev => { ev.preventDefault(); pay.disabled = true; const ok = await run("pay", j.id, message.id); if (!ok) pay.disabled = false; });
  });
}

/** Called from the module's ready hook: socket (objective notifications only; no quest writes travel over it), tracker. */
export function ready() {
  game.socket.on(SOCKET, msg => { if (msg?.action === "questNotify" && typeof msg.text === "string") ui.notifications.info(msg.text.slice(0, 300)); });
  for (const j of all()) seen.set(j.id, liveFor(j));
  renderTracker();
  ui.controls?.render?.({ reset: true });
}

/** Tears down the UI (used when testing the file live). */
export function teardown() { LOG?.close(); hud?.remove(); hud = null; hudHTML = ""; }
