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
  { id: "wctFolderBossLt0", name: "Boss Loot", sort: 400000 },
  { id: "wctFolderToolkt0", name: "Toolkit", sort: 500000 },
  { id: "wctFolderLootRl0", name: "Loot Rolls", sort: 450000 }
];

/**
 * id: stable 16-character compendium id; fn: API path called;
 * feature: features.mjs id, or "a:b" for several (setup skips it unless all are on; none = always); shared: setup lets players see the world copy; folder: compendium folder id.
 */
export const MACROS = [
  { id: "wctHexTravel0000", name: "Hex Travel", fn: "hexTravel", img: "icons/environment/wilderness/terrain-forest-gray.webp", feature: "hexTravel", folder: "wctFolderTravel0" },
  { id: "wctFlightMaster0", name: "Flight Master", fn: "flight", img: "icons/creatures/birds/raptor-hawk-flying.webp", feature: "flightMaster", folder: "wctFolderTravel0" },
  { id: "wctSessionStart0", name: "Session Start", fn: "sessionStart", img: "icons/sundries/books/book-open-turquoise.webp", feature: "sessionStart", folder: "wctFolderSession" },
  { id: "wctVendorTrash00", name: "Vendor Trash", fn: "vendorTrash", img: "icons/containers/bags/sack-simple-leather-brown.webp", feature: "vendorTrash", folder: "wctFolderVTrash0" },
  { id: "wctPreviewTrash0", name: "Preview Vendor Trash", fn: "trash.showPreview", img: "icons/tools/scribal/magnifying-glass.webp", feature: "vendorTrash", folder: "wctFolderVTrash0" },
  { id: "wctSellTrash0000", name: "Sell Vendor Trash", fn: "sellTrash", img: "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp", feature: "vendorTrash", folder: "wctFolderVTrash0" },
  { id: "wctQuestLog00000", name: "Quest Log", fn: "questLog", img: "icons/sundries/scrolls/scroll-bound-sealed-red-tan.webp", feature: "questLog", shared: true, folder: "wctFolderSession" },
  { id: "wctPreviewBoss00", name: "Preview Boss Loot", fn: "previewBossLoot", img: "icons/commodities/gems/gem-faceted-round-white.webp", feature: "bossLoot", folder: "wctFolderBossLt0" },
  { id: "wctLootHistory00", name: "Loot History", fn: "lootHistory", img: "icons/sundries/books/book-worn-brown.webp", feature: "lootRolls", folder: "wctFolderLootRl0" },
  { id: "wctFlightMap0000", name: "Flight Route Map", fn: "flightMap", img: "icons/tools/navigation/map-chart-tan.webp", feature: "flightMaster:flightMap", shared: true, folder: "wctFolderTravel0" },
  { id: "wctTravelPace000", name: "Travel Pace", fn: "travelPace", img: "icons/environment/settlement/signpost.webp", feature: "hexTravel:travelPace", shared: true, folder: "wctFolderTravel0" },
  { id: "wctPartyGold0000", name: "Party Gold", fn: "partyGold", img: "icons/commodities/currency/coins-stitched-pouch-brown.webp", feature: "partyGold", folder: "wctFolderToolkt0" },
  { id: "wctHealthCheck00", name: "Toolkit Health Check", fn: "health", img: "icons/tools/scribal/magnifying-glass.webp", folder: "wctFolderToolkt0" }
];

/** Whether a macro's feature(s) are on: `on` is features.mjs's on(id). */
export const macroOn = (m, on) => !m.feature || String(m.feature).split(":").every(id => on(id));

/** Where Run setup's macros are. Setup never puts macros on a hotbar; this is shown after setup and in the setup reminder. */
export const MACRO_HINT = "Macros are in the \"Wayfarer's Toolkit\" macro folder and the \"Wayfarer's Toolkit Macros\" compendium: drag them to your hotbar if you want them there.";

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
