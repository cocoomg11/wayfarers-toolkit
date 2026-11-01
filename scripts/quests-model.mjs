/**
 * What of a quest players may receive, pure (tested in Node). Since 1.27.0 a quest journal's flag (flags.wayfarers-toolkit.quest)
 * and its text page hold only the public view; the full quest (hidden objectives, the description's secret sections) is in the
 * GM-only store (vault.mjs, bucket "quests", keyed by journal id). The public view carries `pub: true`, so the one-time move can
 * tell an old full flag from a new public one.
 *
 * A quest players can't see yet (not given, or hidden) keeps no text at all in the public view: only its status and hidden mark
 * (not even its party, since 1.29).
 */

/**
 * HTML with every secret section removed: <section class="… secret …">…</section>, nested sections included (the matching close tag
 * is found by counting <section> depth). If the text can't be read reliably (an unclosed secret block), the whole text is dropped
 * rather than risk leaking it.
 */
export function stripSecrets(html) {
  const s = String(html ?? "");
  const TAG = /<(\/?)section\b([^>]*)>/gi;
  let out = ""; let pos = 0; let depth = 0; let secretAt = -1; let m;
  while ((m = TAG.exec(s))) {
    const close = m[1] === "/"; const isSecret = !close && /\bclass\s*=\s*["'][^"']*\bsecret\b/i.test(m[2]);
    if (secretAt < 0) {
      if (isSecret) { out += s.slice(pos, m.index); secretAt = depth; depth++; }
      else depth += close ? -1 : 1;
      continue;
    }
    depth += close ? -1 : 1;
    if (close && depth === secretAt) { pos = TAG.lastIndex; secretAt = -1; }
  }
  if (secretAt >= 0) return "";
  return out + s.slice(pos);
}

/** Whether players see the quest at all (given and not hidden). */
export const shown = q => !q.hidden && q.status !== "available";

/** The public view of a normalized quest `q`. */
export function publicQuest(q) {
  if (!shown(q)) {
    return { v: q.v, pub: true, status: q.status, hidden: q.hidden, party: "", zone: "", level: null, levelText: "", giver: { name: "", uuid: "" }, summary: "", description: "", objectives: [], rewards: { coin: "", items: [], choice: [], pick: "", other: "" }, paid: false, sort: q.sort };
  }
  return {
    ...q, pub: true,
    description: stripSecrets(q.description),
    objectives: q.objectives.filter(o => !o.hidden).map(o => ({ ...o }))
  };
}

/** Whether a stored quest flag is a public view (1.27.0+) rather than an old full one. */
export const isPublic = flag => flag?.pub === true;
