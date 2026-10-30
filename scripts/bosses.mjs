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
  if (!el) { el = document.createElement("section"); el.id = "wct-boss-frames"; el.setAttribute("aria-label", "Boss health"); document.body.append(el); }
  if (html !== lastHTML) { el.innerHTML = html; lastHTML = html; }
}
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
  Hooks.on("renderTokenHUD", addHudButton);
  for (const h of ["combatStart", "updateCombat", "deleteCombat", "createCombat", "createCombatant", "updateCombatant", "deleteCombatant", "canvasReady"]) Hooks.on(h, refresh);
  // Only redraw for documents that can change what a frame shows.
  Hooks.on("updateToken", (t, changes) => { if (isBoss(t) || foundry.utils.hasProperty(changes, `flags.${ID}`)) refresh(); });
  // Linked bosses change through their actor; unlinked ones also fire updateToken (their actor delta) above.
  Hooks.on("updateActor", a => { if (el && bosses().some(cb => cb.actor === a || cb.actor?.uuid === a.uuid || cb.actorId === a.id)) refresh(); });
  Hooks.once("ready", render);
}

export const api = { toggle, isBoss, refresh };
