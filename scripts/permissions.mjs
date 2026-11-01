/**
 * Permission checks for the health check (always part of the health check since 1.27.0). Each tool that's on says which permissions it relies on, and
 * the world's facts are checked against them: pass (ok), warn or fail (bad) lines, each with a fix hint. Pure (tested in Node): the
 * health check gathers the facts (health.mjs) and nothing here touches Foundry.
 *
 * facts: {
 *   on(id) → feature on, settings: { playerFlights, paceRequests, trashItemPiles, junkSellButton, innRequests, pinsPlayers },
 *   socket: the module's socket is on (module.json), itemPiles: Item Piles active,
 *   players: [{ id, name, ignored (1.32: on the permIgnoreUsers list), active, character: name | null, characterOwned: bool, ownsAnyCharacter: bool, can: { MACRO_SCRIPT, ... } }],
 *   party: null | { name, playerLevel (lowest ownership any player has: 0 none … 3 owner) },
 *   macros: { "<name>": default ownership level | undefined (no world copy) },
 *   quests: { visible: n, unreadable: [names], noParty: [names] }  (quests players should see but whose journal they can't open;
 *           given quests with no party, which only the GM sees since 1.29)
 * }
 * Each line: { feature, level: ok | warn | bad | info, text, hint } (the no-character warning also has `ignore`: the user ids an
 * Ignore these users button would add).
 */
export const LEVELS = { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 };
const list = (a, n = 6) => a.slice(0, n).join(", ") + (a.length > n ? `, and ${a.length - n} more` : "");
const L = (feature, level, text, hint = "") => ({ feature, level, text, hint });

/** Most user ids kept in the "ignore these users" list (permIgnoreUsers, 1.32). */
export const IGNORE_MAX = 100;
/** The ignore list as stored → unique non-empty ids, capped. @param {unknown} v */
export const normalizeIgnored = v => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === "string" && x))].slice(0, IGNORE_MAX);
/** The list after ignoring `ids` too (capped). @param {unknown} current @param {string[]} ids */
export const withIgnored = (current, ids) => normalizeIgnored([...normalizeIgnored(current), ...(ids ?? [])]);

/** Players (non-GM users) who lack a core permission. */
const lacking = (players, perm) => players.filter(p => p.can?.[perm] === false).map(p => p.name);

/** The lines for one feature's needs. */
export function featureChecks(facts) {
  const on = facts.on ?? (() => true); const s = facts.settings ?? {};
  const players = facts.players ?? []; const out = [];
  // 1.32: players the GM chose to ignore (e.g. spare accounts) aren't nagged about having no character.
  const noCharAll = players.filter(p => !p.character && !p.ownsAnyCharacter);
  const noChar = noCharAll.filter(p => !p.ignored).map(p => p.name);
  const skipped = noCharAll.filter(p => p.ignored).map(p => p.name);
  const notOwned = players.filter(p => p.character && !p.characterOwned).map(p => `${p.name} (${p.character})`);
  const socketUsers = [];
  if (on("flightMaster") && s.playerFlights) socketUsers.push("player flight bookings");
  if (on("lootRolls")) socketUsers.push("Need / Greed / Pass choices");
  if (on("travelPace") && on("hexTravel") && s.paceRequests) socketUsers.push("travel pace requests");
  if (on("questLog")) socketUsers.push("quest notices");
  if (on("mapPins") && s.pinsPlayers) socketUsers.push("players' map pins");
  if (on("restedInn")) socketUsers.push(s.innRequests ? "room requests and Rested long rests" : "Rested long rests");

  // Socket: the module's channel between players and the active GM.
  if (socketUsers.length) {
    out.push(facts.socket ? L("socket", "ok", `Module socket is on (${list(socketUsers)}).`)
      : L("socket", "bad", `The module's socket is off, so ${list(socketUsers)} never reach the GM.`, "Reinstall the module: its manifest turns the socket on. A copy with \"socket\": false in module.json can't talk to the GM."));
  }

  if (!players.length) {
    if (["flightMaster", "lootRolls", "characterPane", "vendorTrash", "questLog"].some(on)) out.push(L("players", "warn", "No player users in this world yet, so player permissions can't be checked.", "Add your players under Configure Players, then run the check again."));
    return out;
  }

  // Characters: loot rolls, the character pane, looting bodies and Sell all junk act through the player's own character.
  const needsChar = [on("restedInn") && "Rested at the inn", on("lootRolls") && "loot rolls", on("characterPane") && "the character pane", on("vendorTrash") && s.trashItemPiles && facts.itemPiles && "looting bodies", on("vendorTrash") && s.junkSellButton && facts.itemPiles && "Sell all junk", on("merchantShop") && facts.itemPiles && "shops opened for players"].filter(Boolean);
  if (needsChar.length) {
    if (notOwned.length) out.push(L("characters", "bad", `Assigned a character they don't own: ${list(notOwned)}. ${needsChar.join(", ").replace(/^./, c => c.toUpperCase())} won't work for them.`, "Give each player Owner on their character (right-click the actor › Ownership), or assign them a character they own (Configure Player)."));
    if (noChar.length) out.push({ ...L("characters", "warn", `No character to act with: ${list(noChar)}. They're left out of ${needsChar.join(", ")}.`, "Assign each player a character (User Configuration › Character), give them Owner on one, or ignore them (Ignore these users)."), ignore: noCharAll.filter(p => !p.ignored && p.id).map(p => p.id) });
    if (!notOwned.length && !noChar.length) out.push(L("characters", "ok", skipped.length ? `Every player has a character they own (${needsChar.join(", ")}); not checked for ${list(skipped)} (ignored).` : `Every player has a character they own (${needsChar.join(", ")}).`));
    else if (skipped.length) out.push(L("characters", "info", `Not checked for ${list(skipped)} (ignored; control panel › Loot › Advanced).`));
  }

  // Shared script macros: players need permission to run script macros.
  const shared = [];
  if (on("flightMaster") && s.playerFlights) shared.push("Flight Master");
  if (on("questLog")) shared.push("Quest Log");
  if (on("travelPace") && on("hexTravel") && s.paceRequests) shared.push("Travel Pace");
  if (on("flightMap") && on("flightMaster")) shared.push("Flight Route Map");
  if (on("restedInn") && s.innRequests) shared.push("Rent Rooms");
  if (shared.length) {
    const cant = lacking(players, "MACRO_SCRIPT");
    out.push(cant.length ? L("macros", "warn", `Can't run script macros: ${list(cant)}. The ${list(shared)} macro${shared.length === 1 ? " does" : "s do"} nothing for them (the token-control buttons and keys still work).`, "Game Settings › Configure Permissions › Use Script Macros: tick the Player role (or Trusted, and make them Trusted).")
      : L("macros", "ok", `Players can run the shared ${list(shared)} macro${shared.length === 1 ? "" : "s"}.`));
    const unshared = shared.filter(n => n in (facts.macros ?? {}) && (facts.macros[n] ?? 0) < LEVELS.OBSERVER);
    if (unshared.length) out.push(L("macros", "warn", `World macro${unshared.length === 1 ? "" : "s"} players can't see: ${list(unshared)}.`, "Give players Observer on the macro (right-click it in the Macro Directory › Configure Ownership), or let them drag it from the Wanderer's Toolkit Macros compendium."));
  }

  // The party actor: players see the purse Flight Master charges, and the gold tracker reads it.
  if (on("flightMaster") && s.playerFlights) {
    if (!facts.party) out.push(L("party", "warn", "No party group actor: player flights aren't charged and players can't see a purse.", "Run setup to create the party actor."));
    else if (facts.party.playerLevel < LEVELS.OBSERVER) out.push(L("party", "warn", `Players can't open the party actor ${facts.party.name}, so they can't check the purse that pays their flights.`, "Give players Observer (or Owner) on the party actor."));
    else out.push(L("party", "ok", `Players can see the party actor ${facts.party.name}.`));
  }

  // Quests players should see must be readable.
  if (on("questLog") && facts.quests) {
    const bad = facts.quests.unreadable ?? [];
    out.push(bad.length ? L("quests", "warn", `Quests shown to players but whose journal they can't read: ${list(bad)}.`, "Open the quest in the quest log and save it once (it resets the journal's ownership), or give players Observer on the journal.")
      : L("quests", "ok", `Players can read the ${facts.quests.visible ?? 0} quest${facts.quests.visible === 1 ? "" : "s"} shown to them.`));
    const loose = facts.quests.noParty ?? [];
    if (loose.length) out.push(L("questParty", "info", `Given quests with no party (only you see them): ${list(loose)}.`, "Choose a party for each in the quest log (the party badge on the quest's page)."));
  }

  // Item Piles moves items between players' characters and piles; it needs a GM online and its own setup.
  if (on("vendorTrash") && s.trashItemPiles && !facts.itemPiles) out.push(L("itemPiles", "warn", "Bodies can't be looted by players: Item Piles isn't active (Give to Party cards are used instead).", "Install and enable Item Piles and Item Piles: D&D 5e, or turn off Loot stays on the body."));
  return out;
}

/** Counts by level, for a summary line. */
export function summary(lines) {
  const c = { ok: 0, warn: 0, bad: 0 }; for (const l of lines) if (l.level in c) c[l.level]++;
  return c;
}
