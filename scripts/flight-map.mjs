/**
 * Flight route map (feature "flightMap", needs Flight Master): an SVG drawing of the flight network. Everyone can open it from the
 * token controls (map button), the Flight Route Map macro or api.flight.map(). Players see unlocked points and the routes between
 * them; locked points are hidden, or greyed and unnamed (setting "Locked flight points on players' map"). The GM sees every point,
 * can drag points to arrange the map and saves their positions into the flight network (`pos` on each point, 0 to 1). The pure
 * model (what's drawn, auto layout) is Flight.mapModel in flight.mjs.
 */
import * as Flight from "./flight.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const W = 1000, H = 640, PAD = 60;
let API = null;

export function open(api) {
  API = api;
  const app = foundry.applications.instances?.get?.(`${ID}-flight-map`) ?? new FlightMapApp();
  return app.render({ force: true });
}
/** The network or the locked-points setting changed: an open map with no unsaved drags redraws. */
export function refresh() {
  const app = foundry.applications.instances?.get?.(`${ID}-flight-map`);
  if (app?.rendered && !Object.keys(app.moved).length) app.render();
}

const px = n => ({ x: PAD + n.x * (W - 2 * PAD), y: PAD + n.y * (H - 2 * PAD) });

export class FlightMapApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: `${ID}-flight-map`, classes: ["wct-panel", "wct-window", "wct-flight-map"],
    window: { title: "Flight route map", icon: "fa-solid fa-map-location-dot", resizable: true },
    position: { width: 820, height: 620 }
  };
  /** GM drags not saved yet: { pointId: { x, y } }. */
  moved = {};

  model() {
    const net = Flight.withPositions(API.flightNetwork(), this.moved);
    const here = net.points.find(p => p.sceneUuid && p.sceneUuid === canvas?.scene?.uuid)?.id ?? null;
    let locked = "hide"; try { locked = game.settings.get(ID, "flightMapLocked"); } catch { }
    return { net, ...Flight.mapModel(net, { isGM: game.user.isGM, lockedForPlayers: locked, here }) };
  }

  async _renderHTML() {
    const div = document.createElement("div"); div.className = "wct-fmap";
    const gm = game.user.isGM; const { nodes, edges } = this.model();
    const byId = new Map(nodes.map(n => [n.id, n]));
    const edge = e => {
      const a = px(byId.get(e.from)), b = px(byId.get(e.to));
      const tip = e.open ? `${byId.get(e.from).name} ${e.twoWay ? "↔" : "→"} ${byId.get(e.to).name}${e.hours != null ? ` · ${e.hours} h` : ""}${e.free ? " · free" : e.fareCp != null ? ` · ${API.fmtMoney(e.fareCp)} per passenger` : ""}` : "Not open yet";
      return `<line class="wct-fm-edge ${e.open ? "open" : "closed"} ${e.free ? "free" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${e.twoWay ? "" : 'marker-end="url(#wct-fm-arrow)"'} data-edge="${esc(e.id)}"><title>${esc(tip)}</title></line>`;
    };
    const node = n => {
      const p = px(n);
      return `<g class="wct-fm-node ${n.unlocked ? "open" : "locked"} ${n.here ? "here" : ""} ${gm ? "drag" : ""}" data-id="${esc(n.id)}" transform="translate(${p.x} ${p.y})">
        <circle r="${n.here ? 13 : 10}"></circle>${n.here ? '<circle class="ring" r="19"></circle>' : ""}
        <text y="-18" text-anchor="middle">${esc(n.name)}${gm && !n.unlocked ? " (locked)" : ""}</text><title>${esc(n.name)}${n.here ? " · you are here" : ""}${gm && !n.placed ? " · drag to place" : ""}</title></g>`;
    };
    const empty = !nodes.length ? `<p class="wct-note">${gm ? "No flight points yet. Add them in the flight network editor." : "No flight points are open yet."}</p>` : "";
    div.innerHTML = `${empty}<svg class="wct-fm-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Flight route map">
        <defs><marker id="wct-fm-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"></path></marker></defs>
        <g class="edges">${edges.map(edge).join("")}</g><g class="nodes">${nodes.map(node).join("")}</g></svg>
      <footer class="wct-footer"><span class="hint" data-note>${gm ? "Drag points to arrange the map; players see the same layout. Locked points: players " + (game.settings.get(ID, "flightMapLocked") === "grey" ? "see them greyed, unnamed." : "don't see them.") : "Solid lines are routes you can fly. Open Flight Master to book a flight."}</span>
        ${gm ? `<button type="button" data-do="editor"><i class="fa-solid fa-pen"></i> Edit network…</button><button type="button" data-do="auto"><i class="fa-solid fa-circle-nodes"></i> Arrange in a circle</button><button type="button" class="wct-primary" data-do="save" ${Object.keys(this.moved).length ? "" : "disabled"}><i class="fa-solid fa-floppy-disk"></i> Save layout</button>`
          : `<button type="button" data-do="fly"><i class="fa-solid fa-feather-pointed"></i> Flight Master</button>`}</footer>`;
    return div;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
    result.querySelectorAll("[data-do]").forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); this.act(b.dataset.do); }));
    if (game.user.isGM) this.wireDrag(result.querySelector("svg"));
  }

  wireDrag(svg) {
    if (!svg) return;
    let drag = null;
    const toUnit = ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const m = svg.getScreenCTM(); if (!m) return null;
      const p = pt.matrixTransform(m.inverse());
      return { x: (p.x - PAD) / (W - 2 * PAD), y: (p.y - PAD) / (H - 2 * PAD) };
    };
    svg.addEventListener("pointerdown", ev => {
      const g = ev.target.closest(".wct-fm-node"); if (!g) return;
      drag = { id: g.dataset.id, g }; svg.setPointerCapture?.(ev.pointerId); ev.preventDefault();
    });
    svg.addEventListener("pointermove", ev => {
      if (!drag) return; const u = Flight.cleanPos(toUnit(ev)); if (!u) return;
      this.moved[drag.id] = u; const p = px(u); drag.g.setAttribute("transform", `translate(${p.x} ${p.y})`);
      for (const l of svg.querySelectorAll(".wct-fm-edge")) this.moveEdge(l);
    });
    const end = () => { if (!drag) return; drag = null; const save = this.element?.querySelector('[data-do="save"]'); if (save) save.disabled = !Object.keys(this.moved).length; };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
  }
  /** Redraws one route line from its points' current positions during a drag. */
  moveEdge(line) {
    const { net } = this.model(); const r = net.routes.find(x => x.id === line.dataset.edge); if (!r) return;
    const pos = id => { const g = this.element.querySelector(`.wct-fm-node[data-id="${CSS.escape(id)}"]`); const m = g?.getAttribute("transform")?.match(/translate\(([\d.-]+) ([\d.-]+)\)/); return m ? { x: +m[1], y: +m[2] } : null; };
    const a = pos(r.from), b = pos(r.to); if (!a || !b) return;
    line.setAttribute("x1", a.x); line.setAttribute("y1", a.y); line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
  }

  async act(what) {
    try {
      if (what === "fly") return API.flight();
      if (what === "editor") return API.flightEditor();
      if (what === "auto") {
        const net = API.flightNetwork(); const pos = Flight.autoLayout(net.points.length);
        this.moved = Object.fromEntries(net.points.map((p, i) => [p.id, pos[i]])); return this.render();
      }
      if (what === "save") {
        if (!game.user.isGM) return;
        await API.setFlightNetwork(Flight.withPositions(API.flightNetwork(), this.moved));
        this.moved = {}; ui.notifications.info("Flight route map: layout saved."); return this.render();
      }
    } catch (e) { console.error(`${ID} | flight map`, e); ui.notifications.error(`Flight route map: ${e.message}`); }
  }

  async close(options) { this.moved = {}; return super.close(options); }
}
