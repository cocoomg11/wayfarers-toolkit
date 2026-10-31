/**
 * Settings export / import (feature "settingsIO"): the file format and its checks, pure (tested in Node). The windows are in
 * settings-io.mjs.
 *
 * File: { module: "wayfarers-toolkit", format: 1, version, exported, world: { key: value }, client: { key: value } }.
 * World settings are the GM's world-wide ones; client settings are this browser's own (window positions, the quest tracker).
 * Some world settings are records rather than choices (the loot history, the last version seen) and are never exported or imported.
 */
export const MODULE_ID = "wayfarers-toolkit";
export const FORMAT = 1;

/** Kept out of export and import: stored records and bookkeeping, not settings someone chose. */
export const SKIP = new Set(["lootHistoryData", "lastSeenVersion", "setupReminded", "wizardDone", "flightCache", "goldSnapshots"]);

/** Settings → the export object. `defs`: [{ key, scope: "world" | "client" | "user", value }]. */
export function buildExport(defs, { version = "", exported = "" } = {}) {
  const out = { module: MODULE_ID, format: FORMAT, version: String(version), exported: String(exported), world: {}, client: {} };
  for (const d of [...(defs ?? [])].sort((a, b) => String(a.key).localeCompare(String(b.key)))) {
    if (!d?.key || SKIP.has(d.key)) continue;
    const bucket = d.scope === "world" ? "world" : "client";
    out[bucket][d.key] = clone(d.value);
  }
  return out;
}
const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));

const typeName = t => typeof t === "function" ? t.name : typeof t === "string" ? t : "";
/**
 * Whether a value fits a setting's definition: { ok, value, reason }. `def`: { type (Boolean, Number, String, Object, Array, or a
 * name), choices?, range? }. Numbers are clamped to a range; a choice must be one of the choices.
 */
export function checkValue(def, value) {
  const t = typeName(def?.type);
  if (t === "Boolean") return typeof value === "boolean" ? { ok: true, value } : { ok: false, reason: "should be on or off (true or false)" };
  if (t === "Number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false, reason: "should be a number" };
    const r = def.range; const v = r ? Math.min(r.max ?? Infinity, Math.max(r.min ?? -Infinity, value)) : value;
    return { ok: true, value: v, ...(v !== value ? { reason: `kept within ${r.min} to ${r.max}` } : {}) };
  }
  if (t === "String") {
    if (typeof value !== "string") return { ok: false, reason: "should be text" };
    if (def.choices && !Object.prototype.hasOwnProperty.call(def.choices, value)) return { ok: false, reason: `"${value}" isn't one of the choices (${Object.keys(def.choices).join(", ")})` };
    return { ok: true, value };
  }
  if (t === "Array") return Array.isArray(value) ? { ok: true, value } : { ok: false, reason: "should be a list" };
  if (t === "Object") return value && typeof value === "object" && !Array.isArray(value) ? { ok: true, value } : { ok: false, reason: "should be an object" };
  // A data model or anything else: accept JSON-like values as they are.
  return value === undefined ? { ok: false, reason: "has no value" } : { ok: true, value };
}

/**
 * Reads an import file against the registered settings and the current values: { ok, error, version, rows, unknown, skipped,
 * invalid }. rows: [{ key, scope, label, from, to, changed, note }] (only valid ones). unknown: keys this version doesn't have
 * (ignored, with a warning). invalid: [{ key, reason }] (ignored). A key filed under the wrong scope is read from its real scope.
 * `defs`: Map key → { scope, type, choices, range, name }; `current`: key → value.
 */
export function readImport(text, defs, current = {}) {
  const fail = error => ({ ok: false, error, version: "", rows: [], unknown: [], skipped: [], invalid: [] });
  let data = text;
  if (typeof text === "string") { try { data = JSON.parse(text); } catch (e) { return fail(`the file isn't valid JSON (${String(e?.message ?? e)})`); } }
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("the file isn't a settings export");
  if (data.module !== MODULE_ID) return fail(data.module ? `the file is for "${data.module}", not this module` : "the file isn't a Wayfarer's Toolkit settings export");
  if (data.format !== FORMAT) return fail(`unknown file format ${JSON.stringify(data.format ?? null)} (this version reads format ${FORMAT})`);
  const rows = [], unknown = [], skipped = [], invalid = [];
  for (const bucket of ["world", "client"]) {
    const src = data[bucket]; if (src == null) continue;
    if (typeof src !== "object" || Array.isArray(src)) return fail(`"${bucket}" should be a list of settings`);
    for (const [key, value] of Object.entries(src)) {
      if (SKIP.has(key)) { skipped.push(key); continue; }
      const def = defs.get(key);
      if (!def) { unknown.push(key); continue; }
      const c = checkValue(def, value);
      if (!c.ok) { invalid.push({ key, reason: c.reason }); continue; }
      const scope = def.scope === "world" ? "world" : "client";
      const from = current[key];
      rows.push({ key, scope, label: def.name || key, from, to: c.value, changed: JSON.stringify(from ?? null) !== JSON.stringify(c.value ?? null), note: [c.reason, scope !== bucket ? `filed under ${bucket}, applied as a ${scope} setting` : ""].filter(Boolean).join("; ") });
    }
  }
  return { ok: true, error: null, version: String(data.version ?? ""), rows, unknown, skipped, invalid };
}

/** A value for the preview table, short. */
export function preview(v, max = 60) {
  const s = v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** The export's file name: wayfarers-toolkit-settings-<world>-<yyyy-mm-dd>.json (world id slugged). */
export function fileName(world = "", date = new Date()) {
  const d = new Date(date); const day = Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const w = String(world).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ["wayfarers-toolkit-settings", w, day].filter(Boolean).join("-") + ".json";
}
