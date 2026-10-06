/**
 * The decklist text the app copies out: the exact inverse of `parseDecklistText` (`from-text.ts`), so what the
 * app exports always re-imports to the identical deck.
 *
 * - Cards are grouped by title and the copies summed into one line, which the import re-splits the way it always
 *   does (Core's four "Wakanda Forever!" codes).
 * - A title that the import could not resolve to the same cards on its own (Deadpool's ally "Cable" beside the hero,
 *   "Web-Shooter", "Mind Scan", "Hulk": several cards, or the identity itself, sharing a title) is written one line
 *   per card with its code in parentheses: `1x Cable (44002)`. The importer reads that suffix, and MarvelCDB's own
 *   text format also puts a parenthetical after a title, so the list still pastes cleanly elsewhere. A title that
 *   needs no help is written bare, so ordinary decks read as before.
 * - A hero whose name another hero shares (the two Spider-Men) is written `Hero: Spider-Man (27030a)`.
 * - One `Aspect:` line per chosen aspect, title-cased (the importer lower-cases).
 *
 * A card id not in `pool` has no name to print and is skipped.
 */
import type { AnyCard } from "../schema/cards/index.js";
import type { DeckContents } from "../schema/decks.js";
import { CATALOG_REPRINTS } from "../data/catalog.js";
import { indexByName, normalizeName, resolveTitleCopies } from "./pool-index.js";

export function exportDecklistText(deck: DeckContents, pool: readonly AnyCard[]): string {
  const byId = new Map(pool.map((card) => [card.id as string, card]));
  const byName = indexByName(pool);
  const identity = byId.get(deck.identityCardId as string) ?? null;
  const context = { identity, aspects: deck.aspects.map((a) => a.toLowerCase()) };

  // Two heroes can share a name (both Spider-Men): the code says which.
  const heroTwins = identity
    ? (byName.get(normalizeName(identity.name)) ?? []).filter((c) => c.type === "hero_identity")
    : [];
  const heroLine = identity
    ? heroTwins.length > 1
      ? `${identity.name} (${identity.id})`
      : identity.name
    : deck.identityCardId;
  const lines: string[] = [`Hero: ${heroLine}`];
  for (const aspect of deck.aspects) lines.push(`Aspect: ${aspect.charAt(0).toUpperCase()}${aspect.slice(1)}`);

  const groups = new Map<string, { name: string; copies: Map<string, number> }>();
  for (const entry of deck.cards) {
    const card = byId.get(entry.cardId as string);
    if (!card) continue;
    const key = normalizeName(card.name);
    const group = groups.get(key) ?? { name: card.name, copies: new Map<string, number>() };
    group.copies.set(card.id, (group.copies.get(card.id) ?? 0) + entry.quantity);
    groups.set(key, group);
  }
  const out: { name: string; line: string }[] = [];
  for (const [key, { name, copies }] of groups) {
    const total = [...copies.values()].reduce((a, b) => a + b, 0);
    const matches = byName.get(key) ?? [];
    const bare =
      matches.length === 1 ||
      (() => {
        const resolved = resolveTitleCopies(matches, total, context, CATALOG_REPRINTS);
        return (
          resolved !== null &&
          resolved.size === copies.size &&
          [...copies].every(([id, quantity]) => resolved.get(id as never) === quantity)
        );
      })();
    if (bare) out.push({ name, line: `${total}x ${name}` });
    else for (const [id, quantity] of copies) out.push({ name, line: `${quantity}x ${name} (${id})` });
  }
  out.sort((a, b) => a.name.localeCompare(b.name) || a.line.localeCompare(b.line));
  for (const { line } of out) lines.push(line);
  return lines.join("\n");
}
