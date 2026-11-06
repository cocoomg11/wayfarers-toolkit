# Loot and coins

[Back to the README](../README.md)

Everything that drops, is rolled for, sold or paid: junk loot on every creature, boss drops, Need / Greed loot rolls, shops, and the coins themselves.

- [Vendor Trash](#vendor-trash): [Sell all junk](#sell-all-junk-at-a-merchant), [Open shop for players](#open-shop-for-players), [Merchant coin rounding](#merchant-coin-rounding), [Item Piles](#with-item-piles-loot-the-bodies) ([setup](#setting-up-item-piles)), [what drops](#what-drops), [your own loot](#adding-your-own-loot), [no loot](#no-loot), [value by CR](#value-by-challenge-rating), [rules page](#your-own-rules-the-vendor-trash-rules-page), [dungeons](#dungeon-loot)
- [Loot rolls](#loot-rolls) and [loot history](#loot-history)
- [Boss loot](#boss-loot)
- [Party gold tracker](#party-gold-tracker)
- [Three-coin economy](#three-coin-economy-copper-silver-gold)
- [Coin log and Split coin](#coin-log-and-split-coin)

Settings for all of these are on the control panel's **Loot** and **Boss & Combat** tabs.

## Vendor Trash

**How to use:** just place NPC tokens; each rolls its own loot. When one dies, its body becomes lootable. To cash in, run **Sell Vendor Trash**, or click **Sell all junk** on an Item Piles merchant.

Grey "vendor trash" from defeated creatures, in the style of classic MMOs.

1. Place NPC tokens as usual. Each unlinked NPC token gets its drop and coin rolled the moment it's placed. The loot waits on the token's own copy of the actor; players can't see it.
2. When the creature drops to 0 HP or is marked defeated in the combat tracker (or, with the setting on, falls unconscious), its body becomes lootable (see below). Nothing else to do.
3. At a vendor, run **Sell Vendor Trash**. Pick whose trash to sell (the party actor or a character holding some; a selected token's actor is picked by default) and confirm. The coin goes to the same actor.

Every item is priced at its vendor value and marked as vendor trash. Each token is only looted once. Characters and group actors are never looted.

**Placing and rolling.** Only unlinked NPC tokens are pre-rolled; characters, group actors, linked tokens and tokens that are already piles or looted are left alone. A copied or pasted token rolls its own drop. Healing a creature back above 0 HP before its body is looted doesn't reroll anything; it keeps the loot it had. To check or change a drop, open the token HUD and hover the **dice** button (it lists the current drop) or click it to reroll.

**Resetting loot.** To undo a looting (say, to replay an encounter), open the token HUD on a looted body, an Item Piles pile, a body that dropped [boss loot](#boss-loot) or a linked NPC carrying trash and click the **Reset loot** button (the circular arrow). Confirm, optionally ticking *Also clear coin*. The pile is turned back into a normal token, items marked as vendor trash or boss loot are removed (nothing else is touched) and the token can be looted again (and draw its boss loot again). For a linked token this changes the world actor: its trash is removed and its pile setting cleared, so later tokens of that actor aren't piles; it stays unrolled. An unlinked token gets a fresh pre-rolled drop when pre-rolling is on.

**The Vendor Trash macro** still works: select (or target) creatures and run it to loot them by hand (for example linked tokens, or with the automatic settings off). It uses the pre-rolled drop when there is one and rolls one otherwise.

| Setting | Default | Effect |
| --- | --- | --- |
| **Roll loot when creatures are placed** | on | Pre-rolls the drop of every unlinked NPC token as it's placed. Off: the drop is rolled when the body is looted. |
| **Bodies can be looted when they die** | on | At 0 HP or when marked defeated, the body becomes an Item Piles pile (or, without Item Piles, the GM gets the Give to Party card). Off: run the Vendor Trash macro yourself. |
| **Items you give a creature count as loot** | on | A weapon, armour, consumable, tool, loot item or container a GM adds to an NPC is marked *Lootable* and shows in its body's pile. See [Adding your own loot](#adding-your-own-loot). |
| **Unconscious creatures can be looted** | off | The Unconscious condition also makes an unlinked NPC's body lootable, as if it had died. No loot and one-loot-per-body still apply. |

All of these are on the control panel's **Loot** tab (greyed out while Vendor Trash is switched off). The rolling and looting happen on the active GM's client, so a GM has to be logged in.

**Several deaths at once.** When several bodies become lootable within about a second and a half of each other (an area spell), the GM gets **one** summary card instead of one per creature: a Vendor Trash section and a Boss loot section, a line per creature and the totals. The Give to Party and per-item **Start loot roll** buttons are on it as usual.


### Sell all junk at a merchant

With Item Piles, a merchant window opened for a character (a player's own, or the GM's) gets a **Sell all junk** button in its title bar. It lists every grey item the character carries (anything Vendor Trash dropped, items whose MMO-style tooltip is grey, and items of *poor* rarity) with the price the merchant pays and the total, and sells them all when you confirm. The sale goes through Item Piles' own trade, so the merchant's buy and sell price modifiers, its coin and the [three-coin economy](#three-coin-economy-copper-silver-gold) all apply, and the coin lands on the character.

Never sold: equipped items, items marked as favourites on the dnd5e sheet, items in any of the character's [weapon sets](quests-and-characters.md#weapon-sets), containers, and anything the merchant would pay nothing for. The confirm says which junk was kept back and why. If the merchant won't buy one of the items, the rest are still sold, one by one, and you're told which wasn't. Merchants set to *purchase only* get no button. A GM has to be connected (Item Piles carries out trades on a GM's client).

Switch it off with **Sell all junk button** (control panel › Loot › Advanced).


### Open shop for players

With **Open shop for players** on (a feature of its own, on by default; needs Item Piles), the GM can put a merchant in front of the players instead of each of them opening it:

- **Merchant window**: a GM's Item Piles merchant window gets **Open for players** and **Close for everyone** in its title bar.
- **Token HUD**: merchant tokens get a shop button (GM only). Click: open for players. Right-click: close for everyone.
- **Macro**: see *For scripters* below.

The pick dialog lists the connected players who have a character they own, all ticked, with an optional **Only players whose tokens are on this scene**. Each chosen player gets the merchant's own Item Piles window with **their own character** as the buyer and seller, so prices, coin, the merchant's settings and Item Piles' trades work as when they open it themselves; the **Sell all junk** button and the item comparison tooltips appear in it as usual. Players with no character, a character they don't own, or who aren't connected are left out and named in a notification; nothing errors. Item Piles itself sends the window to the players' screens; the toolkit stores nothing. **Close for everyone** closes the merchant on the players it was opened for from this GM's client (after a reload: on every connected player).

**Say when a shop opens** (control panel › Loot › Advanced, off by default) whispers "The shop is open" to those players and the GM.


<details><summary>For scripters</summary>

`api.shop.open(merchantTokenOrActor, { users })` and `api.shop.close(merchant)` (GM only). Leave `users` out to get the pick dialog; `users: null` means every connected player with a character; otherwise a user, user id, user name or a list of them. `{ onlyOnScene: true }` skips players whose character has no token on the scene being viewed. `api.shop.openedFor(merchant)` lists the user ids it was last opened for from this client. Item Piles opens the window through its own `renderItemPileInterface` API; the toolkit sends no socket message.

</details>

### Merchant coin rounding

Item Piles works a merchant's price out in the primary coin, multiplies it by the merchant's price modifier and then drops any part of the smallest coin. With gold as the primary coin, an item worth 1 copper sold or bought at half price comes to half a copper, which Item Piles shows as "0g 0s 0c" and gives away; 3 copper at half price becomes 1 copper.

With **Merchant coin rounding** on (a feature of its own, **off by default**; needs Item Piles), merchant prices round to a whole smallest coin: **half a coin or more rounds up**. A 1-copper item at half price costs 1 copper, 3 copper at half price costs 2, 1 silver at half price costs 50 copper, and items with no price stay free. The quantity is applied after rounding (three of the 3-copper item at half price cost 6 copper).

How: Item Piles has no hook or setting for rounding up, but its *Currency decimal digits* setting is the precision its merchant maths rounds to. When the world loads, the active GM sets it (through Item Piles' own API) to the smallest coin of Item Piles' currencies and of any merchant's own currency list, for example 0.0001 when copper is 1/10000 of a gold piece. The value found first is remembered and put back when you turn the feature off (on the next load), set **Merchant prices round** (control panel › Loot › Advanced) to **Item Piles default**, or reset the settings in Remove toolkit data.

Limits:
- Less than half a smallest coin still rounds down. At a merchant that buys or sells under half price, an item worth exactly 1 smallest coin rounds to no price at all, and Item Piles won't trade it there; the health check names those merchants.
- It changes nothing when Item Piles has a single coin, or two coins with the same exchange rate (Item Piles then works the precision out itself), and it doesn't change Item Piles' code. Checked against Item Piles 3.3.4.

### With Item Piles: loot the bodies

When the [Item Piles](https://foundryvtt.com/packages/item-piles) module is active (and *Loot stays on the body (Item Piles)* is on, the default), Vendor Trash puts each creature's drop and coin on that creature and turns its token into an Item Pile. The token keeps its image and name. Players double-click the body (standing next to it) to open it and take the items and coin, which go onto their own character. The GM gets a short summary card. A creature that dropped nothing is left as it is.

- **Only the loot shows.** The creature's own weapons, armor and features stay on it but are hidden from the pile, so players see just the trash, coin and anything you [marked as loot](#adding-your-own-loot).
- **The world actor isn't touched** for ordinary unlinked tokens: the loot goes onto the token's own copy of the actor. (If an NPC's token is linked to its actor, the loot goes onto that actor.)
- **Empty bodies** stay on the map unless you turn on Item Piles' *Delete empty piles* setting. To make a body a normal token again, use **Reset loot** in its token HUD, or turn the pile off in its Item Piles configuration.

#### Setting up Item Piles

1. Install and enable **Item Piles** and its system add-on: for dnd5e that's **Item Piles: D&D 5e** (`itempilesdnd5e`). Item Piles 3 has no system settings of its own; without the add-on it doesn't know item quantities or coins, and Vendor Trash falls back to the Give to Party card with a warning.
2. Reload. Item Piles applies the dnd5e settings the first time it sees the add-on.
3. **Three-coin economy:** the dnd5e add-on sets up five coins at 10 to 1. With the three-coin economy on and *Keep Item Piles' coins in step* on (the default, control panel › Loot › Advanced), this module replaces them each time the world loads with copper (×0.0001), silver (×0.01) and gold (primary), in that order, and whispers the GM when it changes them. To do it by hand instead, turn that setting off and in **Item Piles → Module Settings → System → Currencies** keep three attribute currencies, in this order: `system.currency.cp` (0.0001), `system.currency.sp` (0.01) and `system.currency.gp` (exchange rate 1, primary), and delete platinum and electrum.

### Without Item Piles: Give to Party

The GM gets a loot card listing each creature's drop and its vendor value. Click **Give to Party** on the card: items go into the party actor's inventory and coin into its purse. This is also what happens when *Loot stays on the body (Item Piles)* is off.


### What drops

What drops depends on the creature: its type, its subtype and the words in its name.

| Creature | Drops |
| --- | --- |
| Beast, monstrosity | A body part (70%), sometimes two, made of what that creature has: a wolf or bear fur, fangs, claws and meat; a spider or scorpion chitin, silk, venom and stingers; a bird feathers, talons and beaks; a crocodile or snake scales, teeth and eggs. No coin. |
| Humanoid, giant | Coin (75%), a trinket or other junk (50%), a piece of worn gear for its level (35%). Never body parts, except ones named after its own kind (a gnoll's mane). |
| Undead | Bones, dust and rotting flesh (60%), sometimes worn gear or coin. |
| Elemental, construct | Stones, ash, embers, essences and shards (60%). |
| Plant, fey | Roots, petals, bark, leaves and spores (60%). |
| Ooze | Slime and residue (60%). |
| Dragon | Scales, claws, teeth and wing parts. Never fur, insect parts, feathers or bones, not even through the rules page. |

**Material tags.** Each item is sorted by the words in its name: `fur` (fur, pelt, hide, leather, mane…), `tooth` (tooth, tusk, horn, fang, claw…), `flesh` (meat, flank, heart, eye, gland…), `insect` (chitin, carapace, mandible, stinger, ichor, silk, web…), `venom`, `egg`, `scale`, `avian` (feather, talon, beak, quill), `wing`, `aquatic` (fin, gill, blubber, pearl), `shell`, `undead` (bone, skull, dust, grave…), `elemental` (stone, ash, ember, essence, shard, crystal…), `plant` (root, petal, spore, bark, leaf…), `ooze` (slime, goo, residue) and `trinket` (made things: spoons, mugs, pouches, candles, rings…). Weapons and armour are `gear`; loot whose name matches nothing is `misc`, which humanoids and creatures of unusual types can drop.

**Creature words.** The creature's name and subtype are matched against ordinary English animal words (wolf, hound, bear, boar, cat, stag, rat, ape, spider, scorpion, beetle, wasp, crab, turtle, crocodile, lizard, snake, raptor, bat, owl, hawk, vulture, wyvern, shark, gnoll, kobold, goblin, orc, ogre, troll, dragon, drake, whelp, skeleton, zombie, ghost…). The words decide which materials it may drop. If the sheet has no creature type the name decides the type too (a "Mangy Wolf" is a beast, a "Bandit Lookout" a humanoid). A humanoid race word (gnoll, kobold, goblin, orc, ogre, troll) in the name or subtype makes the creature a humanoid whatever its type on the sheet, so a gnoll statted as a fiend still drops trinkets, gear and coin; so does a role word such as *bandit* or *guard* when no animal word is beside it. Dragons, undead, elementals, constructs, oozes and plants keep their type (a gnoll lich drops bones).

**Family words.** If an item's name contains a creature-family word, only creatures of that family drop it. The family words are the animal words above plus the first word of every NPC name in your world (skipping words such as *Young*, *Mangy* or colours) and any listed on the rules page. So once a "Duskwing Stalker" exists in the world, a "Duskwing Chitin" only drops from creatures whose name contains *Duskwing*, never from ordinary spiders, without that name being written anywhere in the module. Items named after the creature are picked first (75% of the time). Items matching no rule fall back to the creature type's usual kinds of junk.

**Where the items come from.** The tool reads an item compendium; it ships no items. With the optional classic MMO item module installed (see [Optional integrations](../README.md#requirements)), it uses that compendium's grey-quality items, their item levels and their vendor sell prices, which is what you want with the three-coin economy. To use other items, tick compendiums in **Where junk loot comes from** (control panel › Loot › Advanced); in those, loot-type items with no rarity count as trash.


### Adding your own loot

Any item can be loot, not just vendor trash: a key, a letter, the bandit captain's sword.

- **Drag it onto the NPC.** With *Items you give a creature count as loot* on (the default), an item a GM adds to an NPC actor or an unlinked token's sheet is marked **Lootable** and shows in the pile when the body becomes lootable, next to its trash and coin. The items that came with the stat block (imported or created with the actor) are never marked, so the creature's own gear stays hidden as before.
- **Mark or unmark by hand.** On an NPC's item sheet the GM sees a **Lootable** checkbox in the header; in the NPC sheet's inventory, right-click an item for **Mark as loot** / **Unmark loot**. Unmarking an item the GM added keeps it on the creature but out of the pile.
- **Everything is lootable.** For a creature whose whole kit should be lootable (a fallen adventurer), use the NPC sheet's header menu: **Everything is lootable: turn on**. Its pile then shows every physical item (weapons, equipment, consumables, tools, loot and containers), never features, spells or classes. Items explicitly unmarked stay hidden. On an unlinked token's sheet this affects only that token.
- **Bodies that are already piles** update straight away when a mark changes or *Everything is lootable* is toggled.
- **Without Item Piles** the hand-added loot of an unlinked token goes onto the Give to Party card with the trash.
- **Reset loot** keeps marked items on the creature (with their mark) unless you tick *Also remove hand-added loot*. **Remove toolkit data** counts and removes the marks with the other toolkit flags (the items themselves stay).
- The health check shows how many NPCs have *Everything is lootable* and how many items are marked.


<details><summary>For scripters</summary>

The flags are `flags.wayfarers-toolkit.lootable` (`true` or `false`) on items and `flags.wayfarers-toolkit.allLootable` on actors. From a macro (GM only): `api.trash.setLootable(itemsOrUuids, true)` (`false` hides, `null` clears the mark) and `api.trash.setAllLootable(actorOrToken, true)`. `api.trash.reset(tokens, { removeHandAdded: true })` also removes marked items.

From a macro: `api.trash.reroll(tokens)` rerolls pre-rolled trash; `api.trash.reset(tokens, { clearCoin: true })` resets looted tokens (GM only; defaults to the selected tokens); `api.sellJunk(character, merchantActorOrToken)` sells a character's junk to a merchant; `game.itempiles.API.revertTokensFromItemPiles(token)` (Item Piles' own call) turns a pile back into a normal token.

</details>

### No loot

Some creatures shouldn't drop anything (summons, illusions, a captured prisoner). Open the token HUD as the GM and click the **crossed-out sack** button: *click* marks this token, *Shift-click* marks the world actor (every token of it); the tooltip says which is set. A marked creature gets no pre-rolled trash, its body isn't made lootable on death, boss loot isn't drawn, and the Vendor Trash macro skips it with a note. Turning it on for a token that already has pre-rolled trash removes that trash (nothing is rerolled). A token can be turned back on while its actor stays marked.


<details><summary>For scripters</summary>

The flag is `flags.wayfarers-toolkit.noLoot = true` on the actor or the token (a token's own `true` or `false` wins over its actor's). From a macro: `api.trash.setNoLoot(tokensOrActors, true, { actor: false })`.

</details>

### Value by challenge rating

Higher CR means better loot: more rolls, higher item levels and more coin. The bands (one commented constant, `CR_BANDS` in `scripts/trash-rules.mjs`, if you want to tune the code):

| Band | Item level | Vendor value of unlevelled items | Coin (if it carries any) | Rolls of its drop table |
| --- | --- | --- | --- | --- |
| CR 0–1/4 | 1–6 | 1–30c | 60c–3s 20c | 1 |
| CR 1/2–1 | 3–10 | 5c–1s | 1s 50c–6s | 1 |
| CR 2–4 | 7–16 | 20c–4s | 10s–40s | 1 |
| CR 5–8 | 15–28 | 1s–15s | 50s–1g 60s | 1–2 |
| CR 9–12 | 28–42 | 4s–40s | 2g–5g 60s | 1–2 |
| CR 13–16 | 41–55 | 10s–80s | 3g–7g | 2 |
| CR 17+ | 54–63 | 20s–2g | 6g–17g | 2–3 |

(Copper, silver and gold at 100 to 1. In a standard 5e economy the same copper amounts are paid out in cp, sp and gp.) The bands aim for trash to be a modest slice of a party's income, around a tenth, on a wealth curve of roughly 1g per character by level 2, 15g by 6, 75g by 10, 400g by 14 and 1,200g by 18; quest rewards and treasure stay the main income. If too few matching items fall inside a band, the item-level range widens a few levels at a time until some do: a creature drops a slightly off-level item before it drops one that doesn't fit it.


**Preview Vendor Trash macro.** Select (or target) one or more tokens and run **Preview Vendor Trash** (GM only; Run setup creates it). Each token gets a GM-whispered card: its kind and CR band, the materials it may and may not drop, the rules from the Vendor Trash Rules page that matched it, how many pool items fit and whether the item-level band had to be widened, its current pre-rolled drop and coin (or *looted*), a sample of up to 12 possible drops with item level and vendor value (in collapsible lists), and its coin odds and range. Nothing is rolled or changed.

<details><summary>For scripters</summary>

**Checking a creature.** Select a token and run `game.modules.get("wayfarers-toolkit").api.trash.preview()` (or pass a token or actor, and how many items to list: `preview(token, 40)`). It returns the creature's kind, materials, CR band, the rules that matched and a sample of what it can drop, and logs how many items of the pool fit. `api.trash.showPreview(tokens, n)` posts the Preview Vendor Trash card.

</details>


### Your own rules: the Vendor Trash Rules page

**Run setup** adds a **Vendor Trash Rules** page to the tracker journal. Its first table holds extra rules for your world; edit it like any journal table. Each row applies to every creature whose name, type or subtype contains the text in the first column (not case-sensitive; `*` matches every creature):

| Creature match | Allow tags | Allow items | Deny items | Family words |
| --- | --- | --- | --- | --- |
| ember | elemental | | | |
| trapper | fur, gear | | | |
| swamp | plant | Bog Lily | Dry Leaf | |
| marsh lurker | | | | murkfin |

- **Allow tags**: material tags (listed above) the creature may also drop. `gear` lets it drop worn weapons and armour; `coin` makes it carry coin.
- **Allow items**: parts of item names it may always drop, and drops first.
- **Deny items**: parts of item names it never drops.
- **Family words**: words that tie items to this creature, as if they were the first word of its name. In the last row, items with *Murkfin* in their name drop from Marsh Lurkers (and from creatures named Murkfin…), and no one else.

Lists are separated by commas. Rows with an unknown tag or an empty first column are skipped, and the GM gets a warning naming them. Changes apply to the next roll; already pre-rolled tokens keep their loot until rerolled.


### Dungeon loot

Mark a scene as a dungeon to make its creatures richer: open the scene's configuration and tick **Dungeon** on the **Table Tools** tab (*Wanderer's Toolkit* section). Creatures looted on that scene then get:

| Setting | Default | Effect |
| --- | --- | --- |
| **Dungeon coin multiplier** | 2 | Coin a creature drops is multiplied by this. |
| **Dungeon drop bonus (%)** | 25 | Percentage points added to every item-drop chance (a 70% body part becomes 95%), never above 100%. |
| **Dungeons roll items twice** | on | The creature's item drops are rolled a second time (coin is not). |

The dungeon bonus comes on top of the creature's CR band. The trash pool is grey items only by design, so instead of raising item quality the dungeon bonus gives an extra roll. A pre-rolled token gets the bonus of the scene it was placed on. Whether coin drops at all is unchanged; only the amount goes up. Scenes not marked as dungeons drop exactly as before. The GM's Vendor Trash card shows a small **Dungeon** tag when the bonus applied. The checkbox and settings belong to Vendor Trash and disappear when it's turned off.


## Loot rolls

**How to use:** as GM, open an Item Piles pile or body and click the **dice** button on an item's row.

Needs Item Piles set up for your system (for dnd5e, Item Piles: D&D 5e). Without it the feature just adds nothing.

1. Open an Item Piles pile or lootable body as the GM. Each item row has a **dice** button (*Roll for this*), next to *Take*.
2. A **Loot roll** chat card shows the item's name, icon and rarity colour, with **Need**, **Greed** and **Pass** buttons and a countdown (**Seconds to choose Need / Greed / Pass**, control panel › Loot, default 60 seconds). Every logged-in player who has a character can choose once; the GM can **Close the roll now**.
3. Each choice goes to the GM's client, which rolls a d100 for Need and Greed and writes it on the card, so everyone sees every roll and nobody can set their own.
4. When everyone has chosen or time runs out: the highest Need wins; if nobody chose Need, the highest Greed. Ties reroll among the tied players. The item (the whole stack) moves from the pile to the winner's assigned character (or the first character they own) through Item Piles, and the result is posted to chat. If everyone passes or nobody answers, the item stays in the pile.

**If the winner can't take it** (they have no character, their character was deleted, or Item Piles can't move the item), the item goes to the next-best roll (Need before Greed, then by roll) and the card says who was passed over and why. If nobody who rolled can receive it, it stays in the pile.

**Assign to…** The GM's copy of an open card has a dropdown of the player characters and the party actor and an **Assign to…** button: it ends the roll and moves the item there straight away.

**Compare on the card** (1.31). While a roll is open, each player who can roll sees, on their own copy of the card, the item compared with what their character has in that slot or weapon-set hand (the same comparison as the character pane's tooltips: armour class, damage, bonuses, properties, value, weight). It is built on that player's screen when the card is shown; nothing is added to the chat message, and the GM and other players never see it. It follows **Item comparison tooltips** (control panel › Character) and needs the character pane turned on.

The players of the receiving character (everyone who owns it or has it as their character) get a whisper, "You won *item*", as well as the public line; the same goes for a GM Assign. Given to the party actor, its player owners get the whisper, if it has any.

A GM must be connected for players' choices to count. While none is, players' Need / Greed / Pass buttons are disabled with "A GM needs to be connected." and come back when a GM connects. An open roll survives a GM reload and closes when its time is up.

### Loot history

With **Keep a loot roll history** on (control panel › Loot › Advanced; on by default), every finished roll is recorded: date and time, scene, the item (name, rarity colour, UUID, quantity), each player's choice (Need, Greed or Pass) and rolls, rerolls included, who received it, and how it ended: *Won*, *All passed*, *GM assigned* (Assign to…), *Expired* (nobody chose before the time ran out) or *Not handed out* (nobody who won could receive it, or it had left the pile). The GM's client keeps it in the toolkit's hidden GM journal, so it can't be edited by accident and players don't see it. The last 500 rolls are kept; older ones drop off.

Open the **Loot history** window (GM only) from **control panel › Loot › Loot history…**, the **Loot History** macro (compendium folder *Loot Rolls*):

- **The list.** Click a column heading (Date, Scene, Item, How it ended, Received by) to sort by it; click again to reverse. Under each roll, everyone's choice and roll.
- **Filters.** *Player* (anyone who chose, or received an item) and *Session* (1.31): with the [Red Book](https://github.com/cocoomg11/red-book) module active, each of its sessions (rolls between its start and end time; a session past midnight stays one session, an open session runs until now); without it, or for rolls outside every session, each date with rolls (*Session date*). Each choice shows how many rolls it holds.
- **By session** (1.31): groups the list under a heading per session (or date), newest first, keeping the column sort inside each group.
- **Per player.** For each player: rolls taken part in, items received, Need wins, Greed wins and items the GM assigned. It follows the session filter.
- **Export CSV** downloads what's shown, in the order shown (spreadsheet-safe: a value starting with `=`, `+`, `-` or `@` gets a leading apostrophe).
- **Clear history…** deletes every recorded roll after asking. Export first if you want a copy.


<details><summary>For scripters</summary>

`game.modules.get("wayfarers-toolkit").api.lootRoll.start(itemOrUuid, { seconds })` starts a roll. `api.lootRoll.history()` opens the window, `api.lootRoll.historyEntries()` returns the entries (plain objects, newest first), `api.lootRoll.exportHistory()` and `api.lootRoll.clearHistory({ confirm: false })`.

</details>

## Boss loot

**How to use:** open a creature's token HUD (right-click the token), click the **gem** button and pick a roll table of drops.

Hand-picked drops for named creatures, alongside (or instead of) vendor trash. Works with linked and unlinked tokens.

1. Make a **roll table** with one result per possible drop. Each result is a document result pointing at an Item (a world item or a compendium item); its **weight** is its relative chance. Text results (such as "Nothing") drop nothing.
2. As the GM, open the creature's token HUD and click the **gem** button (*Boss loot…*). Pick a world table from the list, or drag any roll table (also from a compendium) onto the *Table UUID* box. Set **Draws** (how many results drop), optional **Coin** (in copper) and a **Note** for yourself. For an unlinked token you choose whether it applies to this token only or to every token of that actor. Choose *(none)* to remove it. The gem is lit on tokens with a table.
3. When the creature drops to 0 HP or is marked defeated, the active GM's client draws the table once: `draws` results, weighted, without replacement (the same item never drops twice in one draw). The roll table itself is never changed, so "drawn" marks on it don't matter. The items are copied onto the body and, with Item Piles, it becomes a lootable pile showing only loot (vendor trash and boss loot) and coin; the creature's own gear stays hidden. Without Item Piles the GM's card has a **Give to Party** button.
4. The GM gets a card "*Name* dropped:" with a link per item and, when Loot rolls is on, a **Start loot roll** button per item.

**Party size.** Boss coin is scaled by the **Party size** setting: coin × party size ÷ 4, rounded to the copper (a 1,000c boss drops 1,250c for five). The flag itself is not changed. With **Extra boss drop for parties over 4** on (the default), a boss with 3 or more draws draws one more for a party of 5 or more, never more than its table's usable results. Preview Boss Loot and the health check show the adjusted coin and draws next to the ones set.

**Link boss tables by name.** If your tables are named after their creatures, link them all at once: **Link boss tables by name** (control panel › Boss & Combat, or the Overview tab when it applies), the button in the health check. Every world NPC actor without a boss loot link gets the world roll table named exactly "*Actor name* · Loot" (also "*Actor name* - Loot" or "Loot: *Actor name*"), with 1 draw and no coin, unless the table's description says otherwise ("draws: 2" / "coin: 1500", in copper). Existing links are never changed. You get a notification and a whisper listing what was linked and skipped.

**Fallback.** If the linked table has been deleted, has no results that can drop, or the draw finds none of the items its results point at, the body gets the normal vendor-trash drop instead (unless it's marked No loot) and the GM is whispered which creature, why and what happened: "vendor trash dropped instead", "no vendor trash rolled for it either", "its vendor trash is already on the body", or why there's none (Vendor Trash off, No loot, no compendium). A linked boss has no pre-rolled trash, so its fallback drop is rolled then (up to three tries before it counts as empty). The health check lists these links in advance.

Each death draws once: healing and dying again doesn't draw again. **Reset loot** (token HUD) removes the boss loot items as well as vendor trash and lets it draw again. **Boss loot drops on death** (control panel › Boss & Combat, on by default) can be turned off; then drop it yourself from a macro (see below).

**Preview Boss Loot** (macro) whispers the GM a card per selected token: the table, the number of draws and coin (adjusted for the party size), note, and every result with its weight and its chance per draw.


<details><summary>For scripters: flag format and macros</summary>

The link is an actor flag, set on the world actor (linked tokens, or every token of an actor) or on an unlinked token's own actor:

```json
"flags": {
  "wayfarers-toolkit": {
    "bossLoot": { "table": "RollTable.abc123def456ghi7", "draws": 2, "coinCp": 1500, "note": "Drops from the cave guardian" }
  }
}
```

- `table` (required): the roll table's UUID (`RollTable.<id>` or `Compendium.<pack>.RollTable.<id>`).
- `draws` (default 1): how many results drop, never more than the table has.
- `coinCp` (optional): coin added to the body, in copper.
- `note` (optional): shown on the GM's cards.

Dropped items carry the item flag `flags.wayfarers-toolkit.bossLoot` and the token gets `flags.wayfarers-toolkit.bossLootDrawn` once it has dropped.

From a macro:

```js
const api = game.modules.get("wayfarers-toolkit").api;
await api.bossLoot.set(token, { table: "RollTable.abc123def456ghi7", draws: 2, coinCp: 1500 }); // a token or an actor
api.bossLoot.get(token.actor);   // { table, draws, coinCp, note } or null
api.bossLoot.preview(token);     // GM card with the odds
api.bossLoot.drop([token]);      // drop now (skipped if it already dropped)
await api.bossLoot.autoLink();   // link tables named "<creature> · Loot"; { folder, overwrite }
```

Link tables by name from a macro with `api.bossLoot.autoLink({ folder, overwrite })`: `folder` (a folder, its id or name) limits it to actors in that folder, and `overwrite: true` replaces existing links. A table can carry its own defaults in the flag `flags.wayfarers-toolkit.bossLootDefaults = { draws, coinCp, note }`. Boss coin with the party size is `coinCp × party size / 4`.

</details>

## Party gold tracker

**How to use:** run the **Party Gold** macro (GM only) or click **Party gold…** in control panel › Loot.

With **Party gold tracker** on, GMs get a **Party gold** window (*control panel › Loot › Party gold…* or the **Party Gold** macro). It's read-only.

- **Wealth** is the coin of every player character (a character actor a player owns or has assigned) and of the party group actor, coins in their containers included. With *Count mundane gear in party wealth* on, the price of their non-magical gear with no rarity is added. Amounts show in your coin system (three coins or standard).
- **The wealth curve** is gold per character for each act or tier (*Wealth curve*, Loot › Advanced, numbers separated by commas, Act/Tier 1 first). The default is 1, 3, 15, 30, 75, 200, 400, 600, 1200; change it to suit your game. Each act's target is its gold × **Party size**.
- **Status** per act: **green** at 75% to 150% of the target, **amber** at 50% to 75% or 150% to 200%, **red** further off. *Party is in act / tier* picks the act the banner talks about.
- **Take snapshot** saves the wealth now (the last 50 are kept, in the toolkit's hidden GM journal) to compare later. Nothing is taken automatically.


<details><summary>For scripters</summary>

`api.partyGold()` opens the window; `api.gold.read()` returns the same numbers.

</details>

## Three-coin economy (copper, silver, gold)

**How to use:** in control panel › Features, switch on **Three-coin economy** and click **Save features**. The steps are below.

An optional classic-MMO-style economy: no electrum or platinum, and **100 copper = 1 silver, 100 silver = 1 gold**. Character, NPC, group, vehicle and container sheets, the currency manager and award dialogs show only copper, silver and gold, in that order (abbreviated c, s, g); dnd5e's currency **Convert** button changes coins at the new rates, and Flight Master charges and gives change in the new coins.

### Setup

1. **Platinum and electrum are converted for you.** Each time the world loads in three-coin mode (and when you **Run setup**), the GM's client turns any pp or ep left on actors, containers and unlinked tokens into the new coins: **1 pp = 10 gold** and **1 ep = 50 silver** (half a gold piece, its standard 5e value), and whispers the GM who was changed. If you'd rather decide yourself, convert or remove them while you're still on Standard.
2. In the control panel's **Features** tab, switch on **Three-coin economy** and click **Save features**; Foundry reloads.
3. Set **Fares without a coin are in** (control panel › Travel) to the coin your flight fares use when typed as plain numbers. For MMO-style prices that's usually *Silver*. Or write each fare with its coin (`2s`, `1g 20s`) and the setting doesn't matter.
4. Check a sheet: the currency block should show only copper, silver and gold, left to right.

To switch back, switch **Three-coin economy** off again. Coin amounts stay as they are; they're just read at 5e rates again.

### What it doesn't change

**Item prices.** Nothing on your items is rewritten. dnd5e keeps each price's number and coin, so an item listed at *15 gp* now costs 15 **gold**, a hundred times more in silver than before. Many tables using this economy read a 5e price in gp as the same number of **silver** (a 15 gp longsword costs 15s). If you want that, reprice your items separately; this setting won't do it for you.

**Treasure and rewards** you award by hand: give coin in the new denominations.

## Coin log and Split coin

**Coin log** (GM only, feature *Coin log*): control panel › Loot › **Coin log…**. Every coin movement the toolkit makes is listed, newest first: quest rewards paid, rooms rented, flight fares (and a refund when a flight's scene fails to open), vendor trash sold, coin put on bodies by Vendor Trash and Boss loot, coin given with *Give to Party*, Split coin, and undos. Each line has the actor, the amount (and as gold / silver / copper), the reason and the time. The last 200 are kept in the toolkit's hidden GM journal. Coin you move by hand on a sheet isn't logged.

**Undo** on one of the latest 20 entries reverses it once: coin that was paid is given back; coin that was given is taken back only if the actor still has at least that much (otherwise nothing changes and you're told why). The undo is logged too and can't itself be undone.

**Split coin** (GM, feature *Split coin*): the party actor's sheet header menu (**Split coin among members**), control panel › Loot › **Split coin…**. The preview shows each member's share; the remainder that doesn't divide evenly stays with the party. If the party's coin changes while the preview is open, nothing moves.

<details><summary>For scripters</summary>

`api.coinLog` (GM; experimental): `entries()`, `open()`, `undo(id)`. `api.pay(actor, amount, { reason })` and `api.addMoney(actor, amount, { reason })` log when given a reason. `api.splitCoin(party?)` opens Split coin.

</details>
