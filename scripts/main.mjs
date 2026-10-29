/**
 * Wayfarer's Toolkit
 * Hex travel, flight routes and a session-start helper
 * for Foundry VTT (dnd5e). Campaign content (tables, journals, routes) lives in each world; this module is the logic.
 */
const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const setting = key => game.settings.get(ID, key);

const DEFAULTS = {
  trackerJournal: "Campaign Trackers (GM)",
  partyActor: "The Party",
  campaignName: "",
  zones: JSON.stringify({ "Forest": "Encounters · Forest", "Hills": "Encounters · Hills" }),
  encounterDie: 12,
  offroadMult: 2,
  mountMult: 1.5,
  paceSlow: 2,
  paceNormal: 3,
  paceFast: 4,
  hiddenScenes: "Hex Test|NPC Gallery",
  flightSound: "modules/wayfarers-toolkit/sounds/be-good.ogg",
  flightVolume: 0.8,
  playerFlights: true
};
const SOCKET = `module.${ID}`;

function registerSettings() {
  const s = (key, name, hint, type, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: true, type, default: DEFAULTS[key], ...extra });
  s("campaignName", "Campaign name", "Used in the Session Start recap (\"Previously, in …\"). Leave blank to use the world title.", String);
  s("trackerJournal", "Tracker journal", "Journal holding the Travel Log, Flight Routes and Session Recap pages.", String);
  s("partyActor", "Party actor", "Group actor whose purse pays flight fares and whose members count as passengers.", String);
  s("zones", "Encounter zones", "JSON object mapping zone name to encounter roll table name.", String);
  s("encounterDie", "Encounter die", "Each off-road hex rolls this die; a 1 is an encounter.", Number);
  s("offroadMult", "Off-road time multiplier", "Off-road hexes take this many times as long as road hexes.", Number);
  s("mountMult", "Mounted speed multiplier", "Overland speed multiplier when the party travels mounted.", Number);
  s("paceSlow", "Slow pace (mph)", "", Number);
  s("paceNormal", "Normal pace (mph)", "", Number);
  s("paceFast", "Fast pace (mph)", "", Number);
  s("hiddenScenes", "Scenes hidden from Session Start", "Regular expression; matching scene names are left out of the list.", String);
  s("playerFlights", "Players can use Flight Master", "Players get a Flight Master button in the token controls and can book flights themselves. A GM must be logged in; the fare comes out of the party purse.", Boolean, { onChange: () => ui.controls?.render?.({ reset: true }) });
  s("flightSound", "Flight sound", "Audio file played for everyone when a flight departs. Defaults to the bundled \"Be Good\" clip; clear it for no sound.", String, { filePicker: "audio" });
  s("flightVolume", "Flight sound volume", "", Number, { range: { min: 0, max: 1, step: 0.05 } });
  game.settings.register(ID, "flightCache", { scope: "world", config: false, type: Object, default: { pts: [], routes: [] } });
  game.settings.registerMenu(ID, "setup", { name: "Set up this world", label: "Run setup", hint: "Creates the tracker journal, party actor and hotbar macros if they don't exist yet. Safe to run again.", icon: "fas fa-hammer", type: SetupApp, restricted: true });
}

class SetupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: `${ID}-setup`, window: { title: "Wayfarer's Toolkit · Setup" }, position: { width: 420 } };
  async _renderHTML() {
    const div = document.createElement("div");
    div.innerHTML = `<p>This creates anything that's missing:</p><ul><li>the tracker journal (<em>${esc(setting("trackerJournal"))}</em>)</li><li>the party actor (<em>${esc(setting("partyActor"))}</em>)</li><li>a <em>Wayfarer's Toolkit</em> macro folder, with the macros on empty hotbar slots</li></ul><p>Nothing existing is overwritten.</p><button type="button" data-action="run"><i class="fas fa-hammer"></i> Run setup</button>`;
    div.querySelector("[data-action=run]").addEventListener("click", async () => { const r = await WCT.setup(); ui.notifications.info(`Wayfarer's Toolkit: ${r.length ? "created " + r.join(", ") : "everything already exists"}.`); this.close(); });
    return div;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); }
}

const MACROS = [
  ["Hex Travel", "hexTravel", "icons/environment/wilderness/terrain-forest-gray.webp", 2],
  ["Flight Master", "flight", "icons/creatures/birds/raptor-hawk-flying.webp", 3],
  ["Session Start", "sessionStart", "icons/sundries/books/book-open-turquoise.webp", 5]
];

const TRACKER_PAGES = {
  "Travel Log": `<h2>Travel Rules</h2><ul><li><strong>1 hex = 1 mile.</strong> Roads are safe: no encounter rolls on road hexes.</li><li>Off-road hexes take longer and each rolls for an encounter on the zone's table.</li><li>Tick <em>Mounted</em> in Hex Travel when the party rides.</li></ul><p>The Hex Travel and Flight Master tools write each trip below.</p><h2>Log</h2>`,
  "Flight Routes": `<h2>Flight Points</h2><p>Only points marked <strong>yes</strong> appear in Flight Master. <em>Scene</em> is opened on arrival (optional).</p><table><thead><tr><th>Flight point</th><th>Scene</th><th>Unlocked</th></tr></thead><tbody><tr><td>Example Town</td><td></td><td>yes</td></tr><tr><td>Example Outpost</td><td></td><td>no</td></tr></tbody></table><h2>Routes</h2><p>Direct flights, both directions. Fare per passenger in gold; hours of flight.</p><table><thead><tr><th>From</th><th>To</th><th>Fare (gp)</th><th>Hours</th></tr></thead><tbody><tr><td>Example Town</td><td>Example Outpost</td><td>2</td><td>1</td></tr></tbody></table>`,
  "Session Recap": `<h2>Last Session Recap</h2><p><em>Write a short recap here after each session. The Session Start macro offers it as the opening recap.</em></p>`
};

export const WCT = {
  ID,
  get version() { return game.modules.get(ID)?.version; },
  get JOURNAL() { return setting("trackerJournal"); },
  get PARTY() { return setting("partyActor"); },
  get ZONES() { try { return JSON.parse(setting("zones") || "{}"); } catch (e) { ui.notifications.error("Wayfarer's Toolkit: the Encounter zones setting isn't valid JSON."); return {}; } },
  get PACE() { return { slow: setting("paceSlow"), normal: setting("paceNormal"), fast: setting("paceFast") }; },
  get OFFROAD_MULT() { return setting("offroadMult"); },
  get MOUNT_MULT() { return setting("mountMult"); },
  get ENC_DIE() { return setting("encounterDie"); },

  // ------------------------------------------------------------ helpers
  tracker() { const j = game.journal.getName(this.JOURNAL); if (!j) throw new Error(`Wayfarer's Toolkit: journal "${this.JOURNAL}" not found. Run setup from the module settings.`); return j; },
  state() { return foundry.utils.duplicate(this.tracker().getFlag("world", "trackers") ?? {}); },
  async setState(patch) { const s = { ...this.state(), ...patch }; await this.tracker().setFlag("world", "trackers", s); return s; },
  stamp(t = game.time.worldTime) { const d = Math.floor(t / 86400) + 1, h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60); return `Day ${d}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; },
  page(name) { const p = this.tracker().pages.getName(name); if (!p) throw new Error(`Wayfarer's Toolkit: page "${name}" missing from "${this.JOURNAL}".`); return p; },
  async appendPage(name, html) { const p = this.page(name); await p.update({ "text.content": (p.text.content || "") + html }); },
  parseTable(html, i) { const t = new DOMParser().parseFromString(html, "text/html").querySelectorAll("table")[i]; return t ? [...t.querySelectorAll("tbody tr")].map(tr => [...tr.children].map(td => td.textContent.trim())) : []; },
  gmWhisper(content) { return ChatMessage.create({ content, whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Wayfarer's Toolkit" } }); },
  say(content, alias = "Narrator") { return ChatMessage.create({ content, speaker: { alias } }); },
  form(title, content, label = "OK") { return foundry.applications.api.DialogV2.prompt({ window: { title }, content, position: { width: 460 }, ok: { label, callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object }, rejectClose: false }); },
  confirm(title, content) { return foundry.applications.api.DialogV2.confirm({ window: { title }, content, rejectClose: false }); },
  gmOnly() { if (!game.user.isGM) { ui.notifications.warn("GM only."); return false; } return true; },
  opt(v, label, sel) { return `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label ?? v)}</option>`; },
  campaign() { return setting("campaignName") || game.world.title; },
  trackerPages() { return { ...TRACKER_PAGES }; },

  // ------------------------------------------------------------ setup
  async setup() {
    if (!this.gmOnly()) return [];
    const made = [];
    if (!game.journal.getName(this.JOURNAL)) {
      await JournalEntry.create({ name: this.JOURNAL, ownership: { default: 0 }, flags: { world: { trackers: { mountsUnlocked: false, trips: 0 } } }, pages: Object.entries(this.trackerPages()).map(([name, content]) => ({ name, type: "text", text: { content, format: 1 } })) });
      made.push("tracker journal");
    } else {
      const j = game.journal.getName(this.JOURNAL); const tp = this.trackerPages(); const missing = Object.keys(tp).filter(n => !j.pages.getName(n));
      if (missing.length) { await j.createEmbeddedDocuments("JournalEntryPage", missing.map(name => ({ name, type: "text", text: { content: tp[name], format: 1 } }))); made.push(`tracker pages (${missing.join(", ")})`); }
    }
    if (!game.actors.find(a => a.type === "group" && a.name === this.PARTY)) {
      await Actor.create({ name: this.PARTY, type: "group", img: "icons/environment/people/group.webp", ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
      made.push("party actor");
    }
    let folder = game.folders.find(f => f.type === "Macro" && f.name === "Wayfarer's Toolkit");
    for (const [name, fn, img, slot] of MACROS) {
      if (game.macros.getName(name)) continue;
      folder ??= await Folder.create({ name: "Wayfarer's Toolkit", type: "Macro", sorting: "m" });
      const m = await Macro.create({ name, type: "script", img, folder: folder.id, command: `// ${name}: Wayfarer's Toolkit\nreturn game.modules.get("${ID}")?.api?.${fn}() ?? ui.notifications.error("Wayfarer's Toolkit module is not active.");` });
      if (!game.user.hotbar[slot]) await game.user.assignHotbarMacro(m, slot);
      made.push(`macro "${name}"`);
    }
    if (setting("playerFlights")) made.push(...await this.shareFlightMacro());
    return made;
  },
  /** Lets players see the Flight Master macro and puts it on their hotbars (slot 3, or the first free slot). */
  async shareFlightMacro() {
    if (!this.gmOnly()) return [];
    const m = game.macros.getName("Flight Master"); if (!m) return [];
    const done = []; const OBS = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
    if ((m.ownership.default ?? 0) < OBS) { await m.update({ "ownership.default": OBS }); done.push("Flight Master shared with players"); }
    for (const u of game.users.filter(u => !u.isGM)) {
      if (Object.values(u.hotbar ?? {}).includes(m.id)) continue;
      const slot = !u.hotbar?.[3] ? 3 : Array.from({ length: 50 }, (_, i) => i + 1).find(i => !u.hotbar?.[i]);
      if (slot) { await u.update({ [`hotbar.${slot}`]: m.id }); done.push(`Flight Master on ${u.name}'s hotbar`); }
    }
    return done;
  },

  // ------------------------------------------------------------ travel
  async hexTravel() {
    if (!this.gmOnly()) return;
    const s = this.state(); const Z = this.ZONES; const zones = Object.keys(Z);
    const sc = canvas.scene?.name ?? ""; const guess = zones.find(z => sc.includes(z.split(" ")[0])) ?? zones[0];
    const content = `<div class="form-group"><label>Zone</label><select name="zone">${[...zones, "Other (no encounter table)"].map(z => this.opt(z, z, z === guess)).join("")}</select></div>
      <div class="form-group"><label>Road hexes</label><input type="number" name="road" value="0" min="0"></div>
      <div class="form-group"><label>Off-road hexes</label><input type="number" name="off" value="0" min="0"></div>
      <div class="form-group"><label>Pace</label><select name="pace">${this.opt("slow", `Slow · ${this.PACE.slow} mph · can travel stealthily`)}${this.opt("normal", `Normal · ${this.PACE.normal} mph`, true)}${this.opt("fast", `Fast · ${this.PACE.fast} mph · −5 passive Perception`)}</select></div>
      <p class="hint">1 hex = 1 mile. Roads are safe; each off-road hex takes ×${this.OFFROAD_MULT} time and rolls 1d${this.ENC_DIE} (1 = encounter). </p>
      <div class="form-group"><label>Mounted (speed ×${this.MOUNT_MULT})</label><input type="checkbox" name="mounted" ${s.mountsUnlocked ? "checked" : ""}></div>`;
    const f = await this.form("Hex Travel", content, "Travel"); if (!f) return;
    const road = Math.max(0, Math.floor(+f.road || 0)), off = Math.max(0, Math.floor(+f.off || 0));
    if (!road && !off) return ui.notifications.warn("No hexes entered.");
    const mph = this.PACE[f.pace] * (f.mounted ? this.MOUNT_MULT : 1);
    const hours = (road + off * this.OFFROAD_MULT) / mph;
    const table = game.tables.getName(Z[f.zone] ?? "");
    const enc = [];
    for (let i = 1; i <= off; i++) {
      const r = await new Roll(`1d${this.ENC_DIE}`).evaluate();
      if (r.total === 1) { if (table) { const d = await table.roll(); const res = d.results[0]; enc.push(`Off-road hex ${i} (rolled ${d.roll.total}): ${res.description || res.name}`); } else enc.push(`Off-road hex ${i}: encounter (no table for this zone)`); }
    }
    const before = this.stamp(); await game.time.advance(Math.round(hours * 3600)); const after = this.stamp();
    const trips = (s.trips || 0) + 1; await this.setState({ trips });
    const summary = `<strong>${esc(f.zone)}</strong>: ${road} road + ${off} off-road hexes, ${f.pace} pace${f.mounted ? ", mounted" : ""}. ${hours.toFixed(1)} h (${before} → ${after}).`;
    const encHtml = enc.length ? `<ul>${enc.map(e => `<li>${e}</li>`).join("")}</ul>` : `<p>No encounters${off ? "" : ". Roads are safe"}.</p>`;
    await this.appendPage("Travel Log", `<p><strong>Trip ${trips}.</strong> ${summary}</p>${encHtml}`);
    await this.gmWhisper(`<h3>Hex Travel</h3><p>${summary}</p>${encHtml}`);
    await this.say(`<p><em>The party travels ${road + off} miles through ${esc(f.zone)} (${hours.toFixed(1)} hours).</em></p>`, "Travel");
    return { hours, enc };
  },
  /** Flight points and routes. The GM reads the tracker journal; players read a copy the GM keeps in a world setting, since they can't open the GM journal. */
  flightData() {
    if (!game.user.isGM) return game.settings.get(ID, "flightCache") ?? { pts: [], routes: [] };
    const html = this.page("Flight Routes").text.content;
    const pts = this.parseTable(html, 0).map(([n, sc, u]) => ({ n, sc, u: /^y/i.test(u || "") }));
    const routes = this.parseTable(html, 1).map(([a, b, f, h]) => ({ a, b, f: +f || 0, h: +h || 0 }));
    return { pts, routes };
  },
  async syncFlightCache() {
    if (!game.users.activeGM?.isSelf) return;
    let data; try { data = this.flightData(); } catch { return; }
    const old = game.settings.get(ID, "flightCache");
    if (JSON.stringify(old) !== JSON.stringify(data)) await game.settings.set(ID, "flightCache", data);
  },
  route(from, to, open, routes) {
    const ok = new Set(open); const dist = { [from]: { f: 0, h: 0, path: [from] } }; const done = new Set();
    while (true) {
      const cur = Object.keys(dist).filter(k => !done.has(k)).sort((x, y) => dist[x].f - dist[y].f)[0];
      if (!cur) return null; if (cur === to) return dist[cur]; done.add(cur);
      for (const r of routes) {
        const nb = r.a === cur ? r.b : r.b === cur ? r.a : null; if (!nb || !ok.has(nb) || done.has(nb)) continue;
        const nf = dist[cur].f + r.f; if (!dist[nb] || nf < dist[nb].f) dist[nb] = { f: nf, h: dist[cur].h + r.h, path: [...dist[cur].path, nb] };
      }
    }
  },
  partyActor() { return game.actors.find(a => a.type === "group" && a.name === this.PARTY); },
  playFlightSound() {
    const src = setting("flightSound"); if (!src) return;
    foundry.audio.AudioHelper.play({ src, volume: setting("flightVolume") ?? 0.8, autoplay: true, loop: false }, true);
  },
  /** Opens Flight Master. The GM flies the party directly; a player's booking is sent to the GM's client, which carries it out. */
  async flight() {
    const gm = game.user.isGM;
    if (!gm && !setting("playerFlights")) return ui.notifications.warn("Flight Master is GM only in this world.");
    if (!gm && !game.users.activeGM) return ui.notifications.warn("The flight master is waiting for a GM: one needs to be logged in to book a flight.");
    const { pts, routes } = this.flightData(); const open = pts.filter(p => p.u).map(p => p.n);
    if (open.length < 2) return ui.notifications.warn(gm ? `Fewer than two flight points are unlocked. Mark them yes in ${this.JOURNAL} › Flight Routes.` : "There are no flight paths open yet.");
    const party = this.partyActor();
    const members = party?.system.members?.length || 0;
    const here = pts.find(p => p.u && p.sc && p.sc === canvas.scene?.name)?.n ?? open[0];
    const content = `<div class="form-group"><label>From</label><select name="from">${open.map(n => this.opt(n, n, n === here)).join("")}</select></div>
      <div class="form-group"><label>To</label><select name="to">${open.map(n => this.opt(n, n, n !== here && n === open.find(x => x !== here))).join("")}</select></div>
      <div class="form-group"><label>Passengers</label><input type="number" name="pax" min="1" max="20" value="${members || 4}"></div>
      ${gm ? `<div class="form-group"><label>Open destination scene for players</label><input type="checkbox" name="scene" checked></div>` : ""}
      <p class="hint">${gm ? `Fares and routes come from ${esc(this.JOURNAL)} › Flight Routes. ` : "Fares are paid from the party purse. "}${party ? `Party purse: ${this.purse(party)}.` : gm ? `No group actor named ${esc(this.PARTY)}; fares won't be deducted.` : ""}</p>`;
    const f = await this.form("Flight Master", content, "Check route"); if (!f) return;
    if (f.from === f.to) return ui.notifications.warn("Pick two different flight points.");
    const r = this.route(f.from, f.to, open, routes);
    if (!r) return ui.notifications.warn(`No route between ${f.from} and ${f.to} through open flight points.`);
    const pax = Math.min(20, Math.max(1, Math.floor(+f.pax || 1))); const fare = r.f * pax;
    const canPay = party ? this.totalCp(party) >= fare * 100 : false;
    const path = `<p><strong>${r.path.map(esc).join(" → ")}</strong></p><p>${r.h} hours · ${r.f} gp each × ${pax} = <strong>${fare} gp</strong></p>`;
    if (!gm) {
      if (party && !canPay) return foundry.applications.api.DialogV2.prompt({ window: { title: "Flight Master" }, content: `${path}<p><strong>The party can't afford this flight</strong> (purse: ${this.purse(party)}).</p>`, rejectClose: false });
      const go = await this.confirm("Flight Master", `${path}${party ? `<p>Paid from the party purse (${this.purse(party)}).</p>` : ""}<p>Book this flight?</p>`);
      if (!go) return;
      game.socket.emit(SOCKET, { action: "flight", from: f.from, to: f.to, pax, userId: game.user.id });
      ui.notifications.info("Flight booked. Mount up!");
      return r;
    }
    const go = await this.confirm("Flight Master", `${path}${party ? (canPay ? `<p>Party purse: ${this.purse(party)}.</p>` : `<p><strong>The party can't afford this</strong> (${this.purse(party)}). Fly anyway without charging?</p>`) : ""}`);
    if (!go) return;
    return this.doFlight({ from: f.from, to: f.to, pax, scene: !!f.scene });
  },
  /** Carries out a flight on the GM's client: fare, sound, time, log, chat, scene. Re-checks the route so a player's request can't set its own price. */
  async doFlight({ from, to, pax, scene = true, userId = null }) {
    const { pts, routes } = this.flightData(); const open = pts.filter(p => p.u).map(p => p.n);
    const by = userId ? game.users.get(userId) : null;
    const r = (open.includes(from) && open.includes(to) && from !== to) ? this.route(from, to, open, routes) : null;
    if (!r) { if (by) await this.gmWhisper(`<p>${esc(by.name)} tried to book a flight from ${esc(from)} to ${esc(to)}, but there's no open route.</p>`); return null; }
    pax = Math.min(20, Math.max(1, Math.floor(+pax || 1))); const fare = r.f * pax;
    const party = this.partyActor(); const canPay = party ? this.totalCp(party) >= fare * 100 : false;
    if (by && party && !canPay) { await this.gmWhisper(`<p>${esc(by.name)} tried to book ${esc(from)} → ${esc(to)} (${fare} gp), but the party can't afford it.</p>`); return null; }
    if (party && canPay) await this.pay(party, fare * 100);
    this.playFlightSound();
    await game.time.advance(Math.round(r.h * 3600));
    await this.appendPage("Travel Log", `<p><strong>Flight.</strong> ${r.path.map(esc).join(" → ")}, ${r.h} h, ${fare} gp${party && !canPay ? " (not charged)" : ""}${by ? `, booked by ${esc(by.name)}` : ""}. Arrived ${this.stamp()}.</p>`);
    await this.say(`<p><em>The party flies from ${esc(from)} to ${esc(to)}${r.path.length > 2 ? ` by way of ${r.path.slice(1, -1).map(esc).join(", ")}` : ""}. ${r.h} hours in the air.</em></p><p>Fare: ${fare} gp${party && !canPay ? " (owed)" : ""}.</p>`, "Flight Master");
    const dest = pts.find(p => p.n === to); const sc = dest?.sc ? game.scenes.getName(dest.sc) : null;
    if (scene && sc) await sc.activate();
    return r;
  },
  totalCp(a) { const c = a.system.currency ?? {}; return (c.pp || 0) * 1000 + (c.gp || 0) * 100 + (c.ep || 0) * 50 + (c.sp || 0) * 10 + (c.cp || 0); },
  purse(a) { const c = a.system.currency ?? {}; return ["pp", "gp", "ep", "sp", "cp"].filter(k => c[k]).map(k => `${c[k]} ${k}`).join(", ") || "empty"; },
  async pay(a, cp) {
    const c = { ...a.system.currency }; let need = cp;
    for (const [k, v] of [["cp", 1], ["sp", 10], ["ep", 50], ["gp", 100], ["pp", 1000]]) { const take = Math.min(c[k] || 0, Math.floor(need / v)); c[k] -= take; need -= take * v; }
    if (need > 0) {
      for (const [k, v] of [["sp", 10], ["ep", 50], ["gp", 100], ["pp", 1000]]) {
        if ((c[k] || 0) > 0 && v >= need) { c[k] -= 1; let change = v - need; need = 0; c.gp = (c.gp || 0) + Math.floor(change / 100); change %= 100; c.sp = (c.sp || 0) + Math.floor(change / 10); c.cp = (c.cp || 0) + change % 10; break; }
      }
    }
    await a.update({ "system.currency": c });
  },

  // ------------------------------------------------------------ session
  async sessionStart() {
    if (!this.gmOnly()) return;
    const recapPage = this.page("Session Recap");
    const recapText = new DOMParser().parseFromString(recapPage.text.content || "", "text/html").body.textContent.replace(/^\s*Last Session Recap\s*/, "").replace(/Write a short recap here[^.]*\.[^.]*\./, "").trim();
    let hide; try { hide = new RegExp(setting("hiddenScenes") || "(?!)"); } catch { hide = /(?!)/; }
    const scenes = game.scenes.filter(s => !hide.test(s.name)).sort((a, b) => a.name.localeCompare(b.name));
    const content = `<div class="form-group"><label>Scene</label><select name="scene">${scenes.map(s => this.opt(s.id, s.name, s.id === canvas.scene?.id)).join("")}</select></div>
      <div class="form-group"><label>Activate it for players</label><input type="checkbox" name="activate" checked></div>
      <div class="form-group stacked"><label>Recap ("Previously…")</label><textarea name="recap" rows="6">${esc(recapText)}</textarea></div>
      <div class="form-group"><label>Post recap to chat</label><input type="checkbox" name="post" checked></div>
      <div class="form-group"><label>Unpause the game</label><input type="checkbox" name="unpause" checked></div>`;
    const f = await this.form("Session Start", content, "Start session"); if (!f) return;
    const recap = (f.recap || "").trim();
    if (recap && recap !== recapText) await recapPage.update({ "text.content": `<h2>Last Session Recap</h2>${recap.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("")}` });
    const s = game.scenes.get(f.scene); if (f.activate && s) await s.activate();
    if (f.post && recap) await this.say(`<h3>Previously, in ${esc(this.campaign())}…</h3>${recap.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("")}`, "Narrator");
    if (f.unpause && game.paused) game.togglePause(false, { broadcast: true });
    await this.appendPage("Travel Log", `<p><strong>Session started</strong> at ${this.stamp()}${s ? ` on ${esc(s.name)}` : ""}.</p>`);
  }
};

Hooks.once("init", () => { registerSettings(); });
Hooks.once("ready", () => {
  const mod = game.modules.get(ID); mod.api = WCT;
  globalThis.WCT = WCT; // lets world macros written for the library version keep working
  game.socket.on(SOCKET, async msg => {
    if (msg?.action !== "flight" || !game.users.activeGM?.isSelf) return;
    if (!setting("playerFlights")) return;
    try { await WCT.doFlight({ from: msg.from, to: msg.to, pax: msg.pax, userId: msg.userId, scene: true }); }
    catch (e) { console.error(`${ID} | player flight failed`, e); ui.notifications.error(`Wayfarer's Toolkit: a player's flight failed (${e.message}).`); }
  });
  WCT.syncFlightCache();
  console.log(`${ID} | ready (v${mod.version})`);
});

// Keep the players' copy of the flight routes current whenever the GM edits the Flight Routes page.
const routesPage = p => p?.name === "Flight Routes" && p.parent?.name === WCT.JOURNAL;
Hooks.on("updateJournalEntryPage", p => { if (routesPage(p)) WCT.syncFlightCache(); });
Hooks.on("createJournalEntryPage", p => { if (routesPage(p)) WCT.syncFlightCache(); });

// Flight Master button in the token controls, for the GM and (when allowed) players.
Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens ?? controls.token; if (!tokens?.tools) return;
  if (!game.user.isGM && !game.settings.get(ID, "playerFlights")) return;
  tokens.tools.wctFlight = { name: "wctFlight", title: "Flight Master", icon: "fa-solid fa-feather-pointed", order: 99, button: true, visible: true, onChange: () => WCT.flight() };
});
