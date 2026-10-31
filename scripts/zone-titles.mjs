/**
 * Zone title cards (feature zoneTitles). When a scene is activated (or, with the setting, whenever a scene is viewed) a title card fades
 * in over the canvas on each client viewing it: the scene's title, an optional subtitle and a thin ornament line, with an optional short
 * sound. Nothing is written to any document: each client decides and draws its own card (zone-titles-model.mjs decides).
 * Per-scene: a fieldset in the scene configuration (flags.wayfarers-toolkit.zoneTitle).
 */
import * as M from "./zone-titles-model.mjs";
import { log } from "./log.mjs";

const ID = "wayfarers-toolkit";
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const get = (k, d) => { try { return game.settings.get(ID, k); } catch { return d; } };

let firstDraw = true; let pendingActivate = null; let timer = null; let lastShown = { id: null, at: 0 };

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  s("zoneTitleTrigger", "Zone titles: when", "When a title card shows.", String, "activate", { choices: M.TRIGGERS });
  s("zoneTitleAudience", "Zone titles: who sees them", "", String, "everyone", { choices: M.AUDIENCES });
  s("zoneTitleAll", "Zone titles: every scene gets a card", "Scenes you haven't set in their configuration show a card with the scene name. Off: only scenes you tick.", Boolean, true);
  s("zoneTitleSeconds", "Zone titles: seconds on screen", "", Number, 4, { range: { min: 1, max: 15, step: 0.5 } });
  s("zoneTitleStyle", "Zone titles: style", "", String, "classic", { choices: M.STYLES });
  s("zoneTitleSound", "Zone titles: default sound", "Played with every card whose scene names no sound of its own. Blank: no sound.", String, "", { filePicker: "audio" });
  s("zoneTitleVolume", "Zone titles: sound volume", "", Number, 0.6, { range: { min: 0, max: 1, step: 0.05 } });
  s("zoneTitleOnLoad", "Zone titles: show when the world loads", "Also show the card for the scene that's already active when someone loads the world.", Boolean, false);
}

/** The card for a scene (Scene document or id), from the world settings. */
export function configFor(scene) {
  const s = typeof scene === "string" ? game.scenes.get(scene) : scene;
  return M.titleConfig(s ? { name: s.name, flags: s.flags } : null, { all: get("zoneTitleAll", true), defaultSound: get("zoneTitleSound", "") });
}

function reducedMotion() { try { return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true; } catch { return false; } }

/** Shows a card now on this client: show(scene) uses the scene's config; show({ title, subtitle, sound }) shows any text. */
export function show(what) {
  const cfg = what?.title !== undefined && !(what instanceof foundry.abstract.Document) ? { enabled: true, title: String(what.title ?? ""), subtitle: String(what.subtitle ?? ""), sound: String(what.sound ?? "") } : configFor(what ?? canvas?.scene);
  if (!cfg.title) return null;
  document.getElementById("wct-zone-title")?.remove(); clearTimeout(timer);
  const t = M.timeline(get("zoneTitleSeconds", 4), reducedMotion());
  const el = document.createElement("div");
  el.id = "wct-zone-title"; el.className = `wct-zone-title style-${get("zoneTitleStyle", "classic") === "plain" ? "plain" : "classic"}`;
  el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
  el.style.setProperty("--wct-zt-in", `${t.fadeIn}ms`); el.style.setProperty("--wct-zt-out", `${t.fadeOut}ms`);
  el.innerHTML = `<div class="wct-zt-inner"><h1>${esc(cfg.title)}</h1><div class="wct-zt-orn" aria-hidden="true"><span></span><i></i><span></span></div>${cfg.subtitle ? `<p>${esc(cfg.subtitle)}</p>` : ""}</div>`;
  document.body.append(el);
  // Next frame: switch to visible so the opacity transition runs (instant with reduced motion: both durations are 0).
  requestAnimationFrame(() => el.classList.add("shown"));
  timer = setTimeout(() => { el.classList.remove("shown"); el.classList.add("leaving"); timer = setTimeout(() => el.remove(), t.fadeOut + 50); }, t.fadeIn + t.hold);
  if (cfg.sound) { try { foundry.audio.AudioHelper.play({ src: cfg.sound, volume: get("zoneTitleVolume", 0.6), autoplay: true, loop: false }, false); } catch (e) { console.warn(`${ID} | zone title sound`, e); } }
  return cfg;
}

function maybeShow(scene, reason) {
  const cfg = configFor(scene);
  const go = cfg.enabled && M.shouldShow({ reason, trigger: get("zoneTitleTrigger", "activate"), audience: get("zoneTitleAudience", "everyone"), isGM: game.user.isGM, onLoad: get("zoneTitleOnLoad", false) });
  // The activation and the redraw it causes can both reach here for one scene change: show it once.
  const dup = lastShown.id === scene?.id && Date.now() - lastShown.at < 5000;
  log(`Zone titles: ${scene?.name} (${reason}) → ${go && !dup ? "shown" : "not shown"}`);
  if (go && !dup) { lastShown = { id: scene?.id, at: Date.now() }; show(scene); }
}

/** Adds the "Title card" fieldset to the scene configuration (GM). */
function addSceneFields(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0]; const scene = app?.document; if (!root || !scene || !game.user.isGM) return;
  if (root.querySelector("[data-wct-fieldset=zoneTitle]")) return;
  const tab = root.querySelector('.tab[data-tab="basics"]') ?? root.querySelector(".tab"); if (!tab) return;
  const f = scene.getFlag(ID, "zoneTitle") ?? {}; const cfg = configFor(scene); const n = `flags.${ID}.zoneTitle`;
  const fs = document.createElement("fieldset"); fs.dataset.wctFieldset = "zoneTitle";
  fs.innerHTML = `<legend>Title card (Wayfarer's Toolkit)</legend>
    <div class="form-group"><label>Show a title card</label><div class="form-fields"><input type="checkbox" name="${n}.show" ${cfg.enabled ? "checked" : ""}></div><p class="hint">Fades in over the map when this scene is activated (control panel › Places sets when and for whom).</p></div>
    <div class="form-group"><label>Title</label><div class="form-fields"><input type="text" name="${n}.title" value="${esc(f.title ?? "")}" placeholder="${esc(scene.name)}"></div><p class="hint">Blank: the scene's name.</p></div>
    <div class="form-group"><label>Subtitle</label><div class="form-fields"><input type="text" name="${n}.subtitle" value="${esc(f.subtitle ?? "")}" placeholder="e.g. Levels 1–3"></div></div>
    <div class="form-group"><label>Sound</label><div class="form-fields"><file-picker name="${n}.sound" type="audio" value="${esc(f.sound ?? "")}"></file-picker></div><p class="hint">Blank: the default sound from the control panel, if any.</p></div>`;
  tab.append(fs);
}

export function init() {
  Hooks.on("renderSceneConfig", addSceneFields);
  // Every client hears the activation; the card shows once its canvas has drawn that scene (or at once if it's already on it).
  Hooks.on("updateScene", (scene, changes) => {
    if (changes?.active !== true) return;
    if (canvas?.ready && canvas.scene?.id === scene.id) return maybeShow(scene, "activate");
    pendingActivate = scene.id;
  });
  Hooks.on("canvasReady", c => {
    const scene = c?.scene; if (!scene) return;
    const reason = pendingActivate === scene.id ? "activate" : firstDraw ? "load" : "view";
    firstDraw = false; pendingActivate = null;
    maybeShow(scene, reason);
  });
}
