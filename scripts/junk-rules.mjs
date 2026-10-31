/**
 * Sell all junk: which items in a character's inventory count as junk, and which of those are kept back. Pure (tested in Node); the
 * merchant glue (merchant.mjs) turns each item into the plain description below.
 *
 * Junk is what Vendor Trash calls grey: an item Vendor Trash dropped (flags.wayfarers-toolkit.trash), an item whose MMO-style tooltip
 * names it in the grey quality colour (#9d9d9d, the colour Vendor Trash picks its pool by), or an item of "poor" rarity.
 * Never sold: equipped items, favourites, items in a weapon set, containers, and things that aren't inventory (features, spells…).
 */
export const GREY = "#9d9d9d";
export const PHYSICAL = new Set(["weapon", "equipment", "consumable", "tool", "loot"]);
export const KEEP_REASONS = { equipped: "equipped", favourite: "a favourite", weaponSet: "in a weapon set", noValue: "worth nothing here", empty: "none left" };

/** True when a described item is grey junk. `d`: { type, trash, color, rarity }. */
export function isJunk(d) {
  if (!d || !PHYSICAL.has(d.type)) return false;
  if (d.trash) return true;
  if (String(d.color ?? "").toLowerCase() === GREY) return true;
  return String(d.rarity ?? "").toLowerCase() === "poor";
}

/** Why a junk item is kept back, or null to sell it. `d` adds { equipped, favourite, inSet, quantity, price } (price: null = unknown). */
export function keepReason(d) {
  if (d.equipped) return "equipped";
  if (d.favourite) return "favourite";
  if (d.inSet) return "weaponSet";
  if (!(Number(d.quantity ?? 1) > 0)) return "empty";
  if (d.price != null && !(Number(d.price) > 0)) return "noValue";
  return null;
}

/** Splits described items into { sell: [d], kept: [{ ...d, reason, reasonText }] }. Items that aren't junk are in neither list. */
export function selectJunk(items = []) {
  const sell = []; const kept = [];
  for (const d of items) {
    if (!isJunk(d)) continue;
    const r = keepReason(d);
    if (r) kept.push({ ...d, reason: r, reasonText: KEEP_REASONS[r] }); else sell.push(d);
  }
  const byName = (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""));
  return { sell: sell.sort(byName), kept: kept.sort(byName) };
}

/** Whether a dnd5e favourites list ([{ type, id }], id like ".Item.abc123") holds an item id. */
export function isFavourite(favorites, itemId) {
  if (!itemId || !Array.isArray(favorites)) return false;
  return favorites.some(f => f && (f.type === "item" || f.type == null) && typeof f.id === "string" && (f.id === itemId || f.id.endsWith(`.Item.${itemId}`) || f.id.endsWith(`Item.${itemId}`)));
}

/**
 * Item Piles prices (primary-currency units, as getPricesForItem's totalCost) → the smallest coin, given that coin's exchange rate
 * (for example 0.01 for copper with gold primary). Rounded to a whole coin.
 */
export const toSmallest = (total, smallestRate) => (Number(smallestRate) > 0 ? Math.round((Number(total) || 0) / Number(smallestRate)) : 0);
