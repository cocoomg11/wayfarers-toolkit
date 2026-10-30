/**
 * Builds the module's compendium packs.
 *   node tools/build-packs.mjs sources   writes src/packs/macros/*.json from scripts/macros.mjs (commit the result)
 *   node tools/build-packs.mjs check     fails when src/packs/macros differs from scripts/macros.mjs
 *   node tools/build-packs.mjs compile   compiles src/packs/* into packs/* (LevelDB); needs @foundryvtt/foundryvtt-cli installed
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MACROS, MACRO_FOLDERS, macroData } from "../scripts/macros.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "packs");
const OUT = join(ROOT, "packs");
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function macroSources() {
  const files = {};
  MACRO_FOLDERS.forEach(f => {
    files[`_folder_${slug(f.name)}.json`] = { _id: f.id, name: f.name, type: "Macro", folder: null, sorting: "a", sort: f.sort, color: null, description: "", flags: {}, _key: `!folders!${f.id}` };
  });
  MACROS.forEach((m, i) => {
    files[`${slug(m.name)}.json`] = { _id: m.id, ...macroData(m), folder: m.folder, sort: (i + 1) * 100000, ownership: { default: 0 }, _key: `!macros!${m.id}` };
  });
  for (const [k, v] of Object.entries(files)) if (!/^[A-Za-z0-9]{16}$/.test(v._id)) throw new Error(`${k}: _id must be 16 letters or digits`);
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, JSON.stringify(v, null, 2) + "\n"]));
}

const mode = process.argv[2];
const dir = join(SRC, "macros");
if (mode === "sources") {
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  for (const [name, text] of Object.entries(macroSources())) await writeFile(join(dir, name), text);
  console.log(`wrote ${Object.keys(macroSources()).length} files to src/packs/macros`);
} else if (mode === "check") {
  const want = macroSources(); const have = (await readdir(dir).catch(() => [])).filter(f => f.endsWith(".json"));
  const bad = [...new Set([...Object.keys(want), ...have])];
  const diff = [];
  for (const f of bad) { const t = have.includes(f) ? await readFile(join(dir, f), "utf8") : null; if (t !== (want[f] ?? null)) diff.push(f); }
  if (diff.length) { console.error(`src/packs/macros is out of date (${diff.join(", ")}). Run: node tools/build-packs.mjs sources`); process.exit(1); }
  console.log("src/packs/macros matches scripts/macros.mjs");
} else if (mode === "compile") {
  const { compilePack } = await import("@foundryvtt/foundryvtt-cli");
  for (const pack of await readdir(SRC)) {
    await rm(join(OUT, pack), { recursive: true, force: true });
    await compilePack(join(SRC, pack), join(OUT, pack), { log: true });
  }
} else {
  console.error("usage: node tools/build-packs.mjs sources|check|compile"); process.exit(2);
}
