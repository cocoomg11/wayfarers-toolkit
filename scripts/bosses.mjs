/**
 * Boss frames: classic-MMO-style unit frames at the top centre of every screen for creatures the GM marks as bosses, while
 * they are in a running combat. The mark is a token flag (flags.wayfarers-toolkit.boss), toggled from the token HUD.
 * Frames are redrawn from document hooks only (no polling). Turned off with the "Boss frames" feature, nothing here is registered.
 */
const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const S = key => game.settings.get(ID, key);

export const HP_MODES = { bar: "Bar only", percent: "Bar and percentage", exact: "Exact HP" };

const tokenDoc = t => t?.document ?? t;
/** Whether a token (Token or TokenDocument) is marked as a boss. */
export const isBoss = t => !!tokenDoc(t)?.getFlag?.(ID, "boss");

/** Marks or unmarks tokens as bosses (GM only). `on` null toggles each. Defaults to the controlled tokens. */
export async function toggle(tokens = null, on = null) {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  tokens = (tokens ?? canvas.tokens?.controlled ?? []).map(tokenDoc).filter(Boolean);
  if (!tokens.length) return ui.notifications.warn("Boss frames: select a token first.");
  for (const t of tokens) {
    const want = on ?? !isBoss(t);
    await (want ? t.setFlag(ID, "boss", true) : t.unsetFlag(ID, "boss"));
  }
}

/** Boss combatants in the viewed combat, once it has started. Hidden ones are left out for players. */
function bosses() {
  const c = game.combat; if (!c?.started) return [];
  return c.combatants.filter(cb => cb.token && cb.actor && isBoss(cb.token) && (game.user.isGM || !(cb.hidden || cb.token.hidden)));
}

function frame(cb) {
  const hp = cb.actor.system?.attributes?.hp ?? {};
  const max = Math.max(0, Number(hp.effectiveMax ?? hp.max) || 0);
  const value = Math.max(0, Math.min(Number(hp.value) || 0, max || Infinity));
  const temp = Math.max(0, Number(hp.temp) || 0);
  const pct = max ? value / max : 0;
  const dead = cb.isDefeated || (max > 0 && value <= 0);
  const mode = game.user.isGM ? "exact" : (HP_MODES[S("bossHpDisplay")] ? S("bossHpDisplay") : "bar");
  let text = "";
  if (dead) text = "Dead";
  else if (mode === "exact") text = `${value} / ${max}${temp ? ` <span class="tmp">+${temp}</span>` : ""}`;
  else if (mode === "percent") text = `${Math.round(pct * 100)}%`;
  const tone = pct > 0.5 ? "high" : pct > 0.2 ? "mid" : "low";
  const img = cb.token.texture?.src || cb.actor.img || "icons/svg/mystery-man.svg";
  const tempW = max && temp && !dead ? Math.min(1, temp / max) : 0;
  return `<div class="wct-boss${dead ? " dead" : ""}" data-combatant-id="${cb.id}">
    <div class="portrait"><img src="${esc(img)}" alt=""></div>
    <div class="info"><div class="name">${esc(cb.token.name || cb.name)}</div>
      <div class="bar ${tone}" role="meter" aria-label="${esc(cb.token.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${dead ? 0 : Math.round(pct * 100)}">
        <div class="fill" style="width:${dead ? 0 : (pct * 100).toFixed(1)}%"></div>
        ${tempW ? `<div class="temp" style="width:${(tempW * 100).toFixed(1)}%"></div>` : ""}
        ${text ? `<span class="txt">${text}</span>` : ""}
      </div></div></div>`;
}

let el = null; let lastHTML = ""; let timer = null;
function render() {
  const list = bosses();
  if (!list.length) { el?.remove(); el = null; lastHTML = ""; return; }
  const html = list.map(frame).join("");
  if (!el) {
    el = document.createElement("section"); el.id = "wct-boss-frames"; el.setAttribute("aria-label", "Boss health");
    el.dataset.tooltip = "Drag to move. Double-click to reset to the top centre."; el.dataset.tooltipDirection = "DOWN";
    el.addEventListener("pointerdown", dragStart); el.addEventListener("dblclick", resetPos);
    document.body.append(el);
  }
  if (html !== lastHTML) { el.innerHTML = html; lastHTML = html; }
  if (!drag) applyPos();
}

/* Position: each user's own, saved per client as viewport fractions of the stack's top-left corner. Empty = default top centre. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
function place(x, y) {
  const r = el.getBoundingClientRect();
  el.style.left = `${clamp(x, 0, innerWidth - r.width)}px`; el.style.top = `${clamp(y, 0, innerHeight - r.height)}px`;
  el.classList.add("moved");
}
function applyPos() {
  if (!el) return;
  const p = S("bossFramePos");
  if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) { el.classList.remove("moved"); el.style.left = el.style.top = ""; return; }
  place(p.x * innerWidth, p.y * innerHeight);
}
let drag = null;
function dragStart(ev) {
  if (ev.button !== 0 || ev.target.closest("button, a, input, select, textarea")) return;
  const r = el.getBoundingClientRect();
  drag = { id: ev.pointerId, dx: ev.clientX - r.left, dy: ev.clientY - r.top, moved: false };
  el.setPointerCapture(ev.pointerId); el.classList.add("dragging");
  el.addEventListener("pointermove", dragMove); el.addEventListener("pointerup", dragEnd); el.addEventListener("pointercancel", dragEnd);
  ev.preventDefault();
}
function dragMove(ev) {
  if (!drag || ev.pointerId !== drag.id) return;
  drag.moved = true; place(ev.clientX - drag.dx, ev.clientY - drag.dy);
}
function dragEnd(ev) {
  if (!drag || ev.pointerId !== drag.id) return;
  const moved = drag.moved; drag = null;
  el.removeEventListener("pointermove", dragMove); el.removeEventListener("pointerup", dragEnd); el.removeEventListener("pointercancel", dragEnd);
  el.classList.remove("dragging"); if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
  if (!moved) return;
  const r = el.getBoundingClientRect();
  game.settings.set(ID, "bossFramePos", { x: r.left / innerWidth, y: r.top / innerHeight });
}
function resetPos() { game.settings.set(ID, "bossFramePos", {}); }
/** Batches bursts of document updates into one redraw. */
const refresh = () => { clearTimeout(timer); timer = setTimeout(render, 50); };

function addHudButton(hud, html) {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; const doc = hud.object?.document ?? hud.document;
  const col = root?.querySelector(".col.right") ?? root?.querySelector(".col.left"); if (!col || !doc) return;
  col.querySelector(".wct-boss-toggle")?.remove();
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = `control-icon wct-boss-toggle${isBoss(doc) ? " active" : ""}`;
  btn.dataset.tooltip = "Boss frame"; btn.setAttribute("aria-label", "Toggle boss frame");
  btn.innerHTML = '<i class="fa-solid fa-crown"></i>';
  btn.addEventListener("click", async ev => { ev.preventDefault(); ev.stopPropagation(); await toggle([doc]); btn.classList.toggle("active", isBoss(doc)); });
  col.append(btn);
}

/** Called from the module's init hook when the feature is on: its setting, the token HUD button and the document hooks. */
export function init() {
  game.settings.register(ID, "bossHpDisplay", {
    name: "Boss frames: what players see", hint: "How much of a boss's health players see on its frame. The GM always sees exact hit points.",
    scope: "world", config: true, type: String, default: "bar", choices: HP_MODES, onChange: refresh
  });
  game.settings.register(ID, "bossFramePos", { scope: "client", config: false, type: Object, default: {}, onChange: () => { if (!drag) applyPos(); } });
  window.addEventListener("resize", () => { if (!drag) applyPos(); });
  Hooks.on("renderTokenHUD", addHudButton);
  for (const h of ["combatStart", "updateCombat", "deleteCombat", "createCombat", "createCombatant", "updateCombatant", "deleteCombatant", "canvasReady"]) Hooks.on(h, refresh);
  // Only redraw for documents that can change what a frame shows.
  Hooks.on("updateToken", (t, changes) => { if (isBoss(t) || foundry.utils.hasProperty(changes, `flags.${ID}`)) refresh(); });
  // Linked bosses change through their actor; unlinked ones also fire updateToken (their actor delta) above.
  Hooks.on("updateActor", a => { if (el && bosses().some(cb => cb.actor === a || cb.actor?.uuid === a.uuid || cb.actorId === a.id)) refresh(); });
  Hooks.once("ready", render);
}

export const api = { toggle, isBoss, refresh };
