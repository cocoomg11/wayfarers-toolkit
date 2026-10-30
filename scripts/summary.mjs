/**
 * GM loot summaries for bodies made lootable automatically. When several creatures die close together (an area spell), their
 * Vendor Trash and Boss loot cards are gathered for BATCH_MS after the last one and posted as ONE card: a Vendor Trash section and a
 * Boss loot section, a line per creature and the totals. A lone card is posted as it is. The merged card keeps every button the
 * single cards have (Give to Party, Start loot roll per boss item), since it carries both cards' flags, merged.
 * `mergeParts` is pure (tested in Node).
 */
const ID = "wayfarers-toolkit";
export const BATCH_MS = 1500;
/** A burst never holds cards back longer than this. */
export const MAX_WAIT_MS = 6000;

/**
 * Merges queued parts into one card's pieces: { trash: { rows, coin, value, flag } | null, boss: { rows, coin, flag } | null }.
 * A part is { kind: "trash" | "boss", rows: [html], coin, value, flag } where `flag` is that card's own flag
 * (trash: { drops?, coin, value?, piles?, dungeon, given }; boss: { token, piles, drops, coin, given }).
 */
export function mergeParts(parts = []) {
  const out = { trash: null, boss: null };
  for (const p of parts) {
    if (p.kind === "trash") {
      const t = out.trash ??= { rows: [], coin: 0, value: 0, flag: { coin: 0, value: 0, dungeon: false, given: false } };
      t.rows.push(...(p.rows ?? [])); t.coin += p.coin || 0; t.value += p.value || 0;
      const f = p.flag ?? {};
      // Coin already on a pile isn't handed out again by Give to Party, so only card (non-pile) coin goes in the flag.
      if (!f.piles) t.flag.coin += f.coin || 0;
      t.flag.value += f.value || 0; t.flag.dungeon ||= !!f.dungeon;
      if (f.piles) t.flag.piles = true;
      if (f.drops) (t.flag.drops ??= []).push(...f.drops);
    } else if (p.kind === "boss") {
      const b = out.boss ??= { rows: [], coin: 0, flag: { tokens: [], piles: false, given: false, drops: [], coin: 0 } };
      b.rows.push(...(p.rows ?? [])); b.coin += p.coin || 0;
      const f = p.flag ?? {};
      if (f.token) b.flag.tokens.push(f.token);
      b.flag.piles ||= !!f.piles; b.flag.drops.push(...(f.drops ?? [])); b.flag.coin += f.coin || 0;
    }
  }
  return out;
}

let pending = []; let timer = null; let first = 0;
const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id);

/**
 * Queues a card. `part.single` is the ChatMessage data posted when it ends up alone; `fmt` formats money. Returns nothing: the card
 * is posted after the burst.
 */
export function queue(part, fmt) {
  pending.push({ ...part, fmt });
  const now = Date.now(); if (!timer) first = now;
  clearTimeout(timer);
  const wait = Math.max(0, Math.min(BATCH_MS, first + MAX_WAIT_MS - now));
  timer = setTimeout(() => flush().catch(e => console.warn(`${ID} | loot summary`, e)), wait);
}

export async function flush() {
  const parts = pending; pending = []; clearTimeout(timer); timer = null;
  if (!parts.length) return null;
  if (parts.length === 1) return ChatMessage.create(parts[0].single);
  const fmt = parts[0].fmt ?? String;
  const m = mergeParts(parts);
  const bodies = new Set(parts.map(p => p.body).filter(Boolean)).size;
  const sec = [];
  const flags = {};
  if (m.trash) {
    const btn = m.trash.flag.drops?.length || (!m.trash.flag.piles && m.trash.coin) ? `<button type="button" data-wct-action="give-trash"><i class="fas fa-sack"></i> Give to Party</button>` : "";
    sec.push(`<h4>Vendor Trash${m.trash.flag.dungeon ? " (dungeon)" : ""}</h4><ul>${m.trash.rows.join("")}</ul><p>Coin ${fmt(m.trash.coin)} · trash worth ${fmt(m.trash.value)} at a vendor.</p>${btn}`);
    flags.trash = m.trash.flag;
  }
  if (m.boss) {
    const btn = !m.boss.flag.piles && (m.boss.flag.drops.length || m.boss.flag.coin) ? `<button type="button" data-wct-action="give-bossloot"><i class="fas fa-sack"></i> Give to Party</button>` : "";
    sec.push(`<h4>Boss loot</h4><ul>${m.boss.rows.join("")}</ul>${m.boss.coin ? `<p>Coin ${fmt(m.boss.coin)}.</p>` : ""}${btn}`);
    flags.bossLootCard = m.boss.flag;
  }
  const total = (m.trash?.coin ?? 0) + (m.boss?.coin ?? 0);
  const content = `<h3>Loot: ${bodies} ${bodies === 1 ? "body" : "bodies"}</h3>${sec.join("")}<p class="hint">Total coin ${fmt(total)}.</p>`;
  return ChatMessage.create({ content, whisper: gmIds(), speaker: { alias: "Wayfarer's Toolkit" }, flags: { [ID]: flags } });
}
