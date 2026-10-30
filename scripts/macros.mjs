/**
 * The module's macros, in one place. Run setup creates world copies from this list (main.mjs) and the release build writes the
 * same macros into the "Wayfarer's Toolkit Macros" compendium (tools/build-packs.mjs), so the two can't drift apart.
 * No Foundry globals at import time: the build script loads this file in Node.
 * Each macro only calls the module API; the API warns when its tool is turned off or GM only.
 */
export const ID = "wayfarers-toolkit";

/** Compendium folders (stable 16-character ids). */
export const MACRO_FOLDERS = [
  { id: "wctFolderTravel0", name: "Travel", sort: 100000 },
  { id: "wctFolderSession", name: "Sessions and Quests", sort: 200000 },
  { id: "wctFolderVTrash0", name: "Vendor Trash", sort: 300000 },
  { id: "wctFolderBossLt0", name: "Boss Loot", sort: 400000 }
];

/**
 * id: stable 16-character compendium id; fn: API path called; slot: preferred GM hotbar slot in setup;
 * feature: features.mjs id (setup skips it when off); shared: setup lets players see the world copy; folder: compendium folder id.
 */
export const MACROS = [
  { id: "wctHexTravel0000", name: "Hex Travel", fn: "hexTravel", img: "icons/environment/wilderness/terrain-forest-gray.webp", slot: 2, feature: "hexTravel", folder: "wctFolderTravel0" },
  { id: "wctFlightMaster0", name: "Flight Master", fn: "flight", img: "icons/creatures/birds/raptor-hawk-flying.webp", slot: 3, feature: "flightMaster", folder: "wctFolderTravel0" },
  { id: "wctSessionStart0", name: "Session Start", fn: "sessionStart", img: "icons/sundries/books/book-open-turquoise.webp", slot: 5, feature: "sessionStart", folder: "wctFolderSession" },
  { id: "wctVendorTrash00", name: "Vendor Trash", fn: "vendorTrash", img: "icons/containers/bags/sack-simple-leather-brown.webp", slot: null, feature: "vendorTrash", folder: "wctFolderVTrash0" },
  { id: "wctPreviewTrash0", name: "Preview Vendor Trash", fn: "trash.showPreview", img: "icons/tools/scribal/magnifying-glass.webp", slot: null, feature: "vendorTrash", folder: "wctFolderVTrash0" },
  { id: "wctSellTrash0000", name: "Sell Vendor Trash", fn: "sellTrash", img: "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp", slot: null, feature: "vendorTrash", folder: "wctFolderVTrash0" },
  { id: "wctQuestLog00000", name: "Quest Log", fn: "questLog", img: "icons/sundries/scrolls/scroll-bound-sealed-red-tan.webp", slot: null, feature: "questLog", shared: true, folder: "wctFolderSession" },
  { id: "wctPreviewBoss00", name: "Preview Boss Loot", fn: "previewBossLoot", img: "icons/commodities/gems/gem-faceted-round-white.webp", slot: null, feature: "bossLoot", folder: "wctFolderBossLt0" }
];

/** The script body every copy of a macro runs. */
export function macroCommand(m) {
  return [
    `// ${m.name}: Wayfarer's Toolkit`,
    `const api = game.modules.get("${ID}")?.api;`,
    `if (!api) return ui.notifications.error("Wayfarer's Toolkit module is not active.");`,
    `return api.${m.fn}();`
  ].join("\n");
}

/** Macro data shared by the world copy and the compendium entry. */
export function macroData(m) {
  return { name: m.name, type: "script", img: m.img, command: macroCommand(m), flags: { [ID]: { macro: m.fn } } };
}
