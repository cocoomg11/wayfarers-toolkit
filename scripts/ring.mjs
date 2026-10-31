/**
 * Custom token ring: your own ring image used through Foundry's dynamic token ring system (not an overlay). The module registers
 * a ring configuration (TokenRingConfig, the initializeDynamicTokenRingConfig hook) whose spritesheet is a small JSON file in the
 * module with one frame. The frame's texture isn't read from disk: each client draws the image from the world setting into a
 * 512 × 512 canvas and hands that texture to the spritesheet loader, so one image of any size is enough and it's one shared texture.
 * Tokens then only need `ring.enabled`; their token image and the actor's portrait are never changed.
 *
 * Which tokens: NPCs only (default) or every token. New tokens get it as they're created; existing ones with Apply (active GM,
 * batched). What the toolkit changed is recorded on each token (flags.wayfarers-toolkit.ring) so Remove puts it back.
 * The helpers at the top take plain objects and are tested in Node; nothing here touches Foundry at import time.
 */
const ID = "wayfarers-toolkit";
export const RING_ID = "wayfarersToolkitCustom";
export const SHEET = `modules/${ID}/assets/token-ring.json`;
export const FRAME = 512;
export const TARGETS = { npc: "NPCs only", all: "Every token (player characters too)" };
const BATCH = 100;

// ---------------------------------------------------------------- pure helpers
/** Whether a token of this actor type gets the ring. No actor, no ring. */
export function wants(actorType, mode = "npc") {
  if (!actorType) return false;
  return mode === "all" ? true : actorType === "npc";
}

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
/** The ring scale setting, kept to 0.5 – 1.5. */
export const clampScale = v => Math.min(1.5, Math.max(0.5, Math.round(num(v, 0.85) * 100) / 100));

/**
 * The update that puts the ring on a token (or prototype token) source: { ring: { enabled, subject: { scale } }, flags }.
 * Keys are prefixed (e.g. "prototypeToken."). Returns null when nothing changes. The subject scale is only set when it is
 * untouched (1) or still the value the toolkit set; a scale you chose yourself is kept. The first time, the previous values are
 * recorded in flags.wayfarers-toolkit.ring so remove can put them back.
 */
export function ringUpdate(src, { scale = 0.85, prefix = "" } = {}) {
  const ring = src?.ring ?? {}; const rec = src?.flags?.[ID]?.ring ?? null;
  const enabled = !!ring.enabled; const cur = num(ring.subject?.scale, 1);
  const s = clampScale(scale);
  const ownScale = cur === 1 || (rec && cur === rec.applied);
  const out = {};
  if (!enabled) out[`${prefix}ring.enabled`] = true;
  const newScale = ownScale ? s : cur;
  if (newScale !== cur) out[`${prefix}ring.subject.scale`] = newScale;
  if (!Object.keys(out).length) return null;
  out[`${prefix}flags.${ID}.ring`] = { enabled: rec ? !!rec.enabled : enabled, scale: rec ? num(rec.scale, 1) : cur, applied: ownScale ? s : (rec?.applied ?? null) };
  return out;
}

/** The update that takes the toolkit's ring off again (the recorded values come back). null when the toolkit never changed it. */
export function ringRevert(src, { prefix = "" } = {}) {
  const rec = src?.flags?.[ID]?.ring; if (!rec || typeof rec !== "object") return null;
  const out = { [`${prefix}ring.enabled`]: !!rec.enabled, [`${prefix}flags.${ID}.ring`]: null };
  const cur = num(src?.ring?.subject?.scale, 1);
  if (rec.applied != null && cur === rec.applied) out[`${prefix}ring.subject.scale`] = num(rec.scale, 1);
  return out;
}

/** Where to draw an image of w × h in the square frame: centred, scaled to fit. */
export function fitRect(w, h, size = FRAME) {
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, w: size, h: size };
  const k = Math.min(size / w, size / h); const dw = w * k, dh = h * k;
  return { x: (size - dw) / 2, y: (size - dh) / 2, w: dw, h: dh };
}

/** Splits a list into batches. */
export const chunks = (arr, n = BATCH) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

// ---------------------------------------------------------------- Foundry side
const S = key => game.settings.get(ID, key);
const image = () => String(S("ringImage") ?? "").trim();
const mode = () => S("ringTargets") === "all" ? "all" : "npc";
const scale = () => clampScale(S("ringSubjectScale"));
let texture = null; let loadError = null;

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: false, type, default: def, ...extra });
  s("ringImage", "Custom token ring: Ring image", "A square ring image with a transparent middle (any size; 256 × 256 or larger). Used by every token with Foundry's dynamic ring turned on. Reloads Foundry.", String, "", { filePicker: "image", requiresReload: true });
  s("ringTargets", "Custom token ring: Which tokens", "Which tokens the toolkit turns the ring on for.", String, "npc", { choices: TARGETS });
  s("ringNewTokens", "Custom token ring: New tokens get the ring", "Tokens placed from now on get the ring as they're created.", Boolean, true);
  s("ringSubjectScale", "Custom token ring: Token art size inside the ring", "Foundry's ring subject scale set on the tokens the toolkit rings. Below 1 the ring sits outside the token art; 1 draws the art over the ring.", Number, 0.85, { range: { min: 0.5, max: 1.5, step: 0.01 } });
  s("ringExisting", "Custom token ring: Keep existing tokens ringed", "Each time the world loads, the active GM puts the ring on any token (and actor prototype token) that should have it and doesn't yet.", Boolean, false);
}

/** init (feature on): registers the ring configuration and the texture the spritesheet uses, and the hooks. */
export function init() {
  if (!image()) return; // nothing to show; the health check says so
  Hooks.on("initializeDynamicTokenRingConfig", cfg => {
    const D = foundry.canvas?.placeables?.tokens?.DynamicRingData;
    if (!D) return console.warn(`${ID} | dynamic token rings not available`);
    cfg.addConfig(RING_ID, new D({ id: RING_ID, label: "Wayfarer's Toolkit: custom ring", spritesheet: SHEET }));
  });
  // Registered before the canvas loads the spritesheet: the loader reads the frames from the JSON and takes this texture.
  Hooks.once("setup", () => {
    const el = document.createElement("canvas"); el.width = el.height = FRAME;
    texture = PIXI.Texture.from(el);
    try { PIXI.Assets.add({ alias: SHEET, src: SHEET, data: { texture } }); } catch (e) { console.warn(`${ID} | custom ring texture`, e); }
    try { foundry.canvas.TextureLoader.pinSource?.(SHEET); } catch { }
    draw(el).catch(e => { loadError = e?.message ?? String(e); console.warn(`${ID} | custom ring image "${image()}" couldn't be loaded`, e); });
  });
  // Foundry picks the ring configuration after the setup hook; use ours before each canvas draw loads its textures.
  Hooks.on("canvasInit", () => { try { CONFIG.Token.ring.useConfig(RING_ID); } catch { } });
  Hooks.on("preCreateToken", (doc, data, options, userId) => {
    if (userId !== game.user.id || !S("ringNewTokens")) return;
    const type = doc.actor?.type ?? game.actors.get(doc.actorId)?.type;
    if (!wants(type, mode())) return;
    const u = ringUpdate(doc._source, { scale: scale() }); if (u) doc.updateSource(foundry.utils.expandObject(u));
  });
}

async function draw(el) {
  const img = new Image(); img.decoding = "async";
  if (/^https?:/i.test(image())) img.crossOrigin = "anonymous"; // a tainted canvas can't be uploaded to the GPU
  img.src = image();
  await img.decode();
  const r = fitRect(img.naturalWidth, img.naturalHeight);
  const ctx = el.getContext("2d"); ctx.clearRect(0, 0, FRAME, FRAME); ctx.drawImage(img, r.x, r.y, r.w, r.h);
  texture.baseTexture.update();
  loadError = null;
}

export function ready() {
  if (image() && S("ringExisting") && game.user.isGM) {
    import("./gm.mjs").then(({ isActiveGM }) => { if (isActiveGM() && plan().count) applyAll({ quiet: true }); }).catch(() => { });
  }
}

/** Every token source that should get the ring (or come back), without changing anything. */
export function plan({ npcOnly = mode() === "npc", revert = false } = {}) {
  const m = npcOnly ? "npc" : "all"; const sc = scale();
  const actors = []; const scenes = []; let count = 0;
  for (const a of game.actors) {
    if (!revert && !wants(a.type, m)) continue;
    const u = revert ? ringRevert(a._source.prototypeToken, { prefix: "prototypeToken." }) : ringUpdate(a._source.prototypeToken, { scale: sc, prefix: "prototypeToken." });
    if (u) actors.push({ _id: a.id, ...u });
  }
  for (const s of game.scenes) {
    const ups = [];
    for (const t of s.tokens) {
      if (!revert && !wants(t.actor?.type ?? game.actors.get(t.actorId)?.type, m)) continue;
      const u = revert ? ringRevert(t._source) : ringUpdate(t._source, { scale: sc });
      if (u) ups.push({ _id: t.id, ...u });
    }
    if (ups.length) scenes.push([s, ups]);
  }
  count = actors.length + scenes.reduce((n, [, u]) => n + u.length, 0);
  return { actors, scenes, count, tokens: count - actors.length };
}

/** Turns the record flag's null (remove it) into the deletion Foundry wants: v14's deletion operator, or the older "-=" key. */
function foundryDeletes(list) {
  const del = globalThis._del; const tail = `flags.${ID}.ring`;
  for (const u of list) for (const k of Object.keys(u)) {
    if (!k.endsWith(tail) || u[k] !== null) continue;
    delete u[k]; if (del) u[k] = del; else u[k.replace(/ring$/, "-=ring")] = null;
  }
  return list;
}

async function run(p, verb, quiet) {
  foundryDeletes(p.actors); for (const [, ups] of p.scenes) foundryDeletes(ups);
  for (const c of chunks(p.actors)) await Actor.updateDocuments(c);
  for (const [s, ups] of p.scenes) for (const c of chunks(ups)) await s.updateEmbeddedDocuments("Token", c);
  if (!quiet || p.count) ui.notifications.info(`Wayfarer's Toolkit: custom ring ${verb} ${p.actors.length} actor prototype token${p.actors.length === 1 ? "" : "s"} and ${p.tokens} placed token${p.tokens === 1 ? "" : "s"}.`);
  return { actors: p.actors.length, tokens: p.tokens };
}

async function gmCheck() {
  const { isActiveGM } = await import("./gm.mjs");
  if (!game.user.isGM || !isActiveGM()) { ui.notifications.warn("Custom token ring: only the active GM can change tokens."); return false; }
  return true;
}

/** Active GM: turns the ring on for the prototype tokens of matching actors and every matching placed token. Art is untouched. */
export async function applyAll({ npcOnly = mode() === "npc", quiet = false } = {}) {
  if (!(await gmCheck())) return null;
  if (!image()) { ui.notifications.warn("Custom token ring: choose a ring image first (control panel › Tokens)."); return null; }
  return run(plan({ npcOnly }), "put on", quiet);
}

/** Active GM: undoes what the toolkit changed (ring on/off and its scale), on prototype tokens and placed tokens alike. */
export async function remove() {
  if (!(await gmCheck())) return null;
  return run(plan({ revert: true }), "taken off", false);
}

/** For the health check. */
export function status() {
  const st = { image: image(), mode: mode(), scale: scale(), active: null, error: loadError, registered: false };
  try { st.registered = CONFIG.Token.ring.configIDs.includes(RING_ID); st.active = CONFIG.Token.ring.id === RING_ID; } catch { }
  return st;
}
