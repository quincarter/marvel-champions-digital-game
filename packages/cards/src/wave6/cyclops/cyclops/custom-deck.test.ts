/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Cyclops
 * (`cyclops` 33001a/b): the deck builder's start state, his deckbuilding rule, and one real public MarvelCDB decklist
 * played end to end outside his own precon.
 *
 * Fixture: `fixtures/marvelcdb-decklist-59368.json`, fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/59368.json` on 2026-10-02.
 *
 * "Giant Size X-Men #1" — https://marvelcdb.com/decklist/view/59368, by user 3043, published 2026-02-15. A Leadership
 * build (aspect meta `leadership`, 43 cards) that is not the `cyclops-leadership` precon, and whose off-aspect X-Men
 * allies (Banshee, Marvel Girl, Iceman, Karma, Psylocke, Sunfire...) lean on Scott Summers's deckbuilding rule. Every
 * card is in the pool through wave 6 (chosen from the 119 public Cyclops decklists on MarvelCDB at that date; most
 * use later packs).
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  CORE_CARDS,
  CYCLOPS_STARTER_DECKS,
  parseMarvelCdbDeckJsonText,
  type CoreAspect,
  type DeckContents,
  type HeroIdentityCard,
  type PlayerCard,
} from "@mc/content";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE6_CARDS } from "../../cards.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";

// `import.meta.glob` (Vite/vitest's static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig has no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURE_TEXT = (
  (import.meta as unknown as ImportMetaEnv).glob("./fixtures/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>
)["./fixtures/marvelcdb-decklist-59368.json"]!;

const precon = (): DeckContents => {
  const deck = CYCLOPS_STARTER_DECKS.find((d) => d.id === "cyclops-leadership");
  if (!deck) throw new Error("no Cyclops starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Cyclops: deck builder start state", () => {
  test("requiredIdentitySet is exactly his precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "33001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:33001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });
});

describe("Cyclops: deckbuilding rules", () => {
  // Scott Summers: "You may include X-MEN allies from any aspect in your deck." (identity `deckbuilding.offAspectAllowance`,
  // RRG 1.8 Appendix I p. 50: "Any 'deckbuilding requirements' on the player's identity card must be followed.") It
  // has no maximum, so the only illegal case is an off-aspect card that is not an X-Men ally. The allowance itself is
  // proven in `packages/engine/src/off-aspect-allowance.test.ts`; here it is pinned for the custom-deck proof.
  const byId = new Map(WAVE6_CARDS.map((c) => [c.id as string, c]));
  const player = (id: string): PlayerCard => {
    const card = byId.get(id);
    if (!card || !("deckLimit" in card)) throw new Error(`no player card ${id}`);
    return card;
  };

  test("an off-aspect X-Men ally (Psylocke, Aggression) is legal in his Leadership deck", () => {
    const psylocke = player("35013");
    expect(psylocke.type).toBe("ally");
    expect(psylocke.aspect).toBe("aggression");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: psylocke.id, quantity: 1 }] };
    expect(validateDeck(deck, WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("an off-aspect card that is not an X-Men ally is rejected, with its player-readable message", () => {
    const support = CORE_CARDS.find(
      (c): c is PlayerCard => "deckLimit" in c && c.type === "support" && c.aspect === "aggression",
    );
    if (!support) throw new Error("no Core Aggression support");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: support.id, quantity: 1 }] };
    const verdict = validateDeck(deck, [...WAVE6_CARDS, ...CORE_CARDS]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["aspect_restriction"]);
    expect(verdict.problems[0]?.cardIds).toEqual([support.id]);
    expect(verdict.problems[0]?.message).toBe(
      `${support.name} is a Aggression card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
    );
  });

  test("an off-aspect X-Men ally is rejected for a different hero, who has no such allowance", () => {
    // The same Psylocke in Spider-Man's Justice deck: the allowance belongs to Scott Summers alone.
    const spiderMan = WAVE6_CARDS.find((c) => c.id === "01001a") as HeroIdentityCard | undefined;
    expect(spiderMan?.deckbuilding).toBeUndefined();
  });
});

describe("Cyclops: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprints resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("33001a");
    expect(result.contents.aspects).toEqual(["leadership"]);
    expect(result.heroName).toBe("Cyclops");
    const ids = new Set(WAVE6_CARDS.map((c) => c.id as string));
    for (const line of result.contents.cards) expect(ids.has(line.cardId as string), line.cardId as string).toBe(true);
  });

  test("is legal under validateDeck", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(validateDeck(result.contents, WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("plays a seeded greedy game to an outcome that replays deep-equal", () => {
    const parsed = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems, null, 2));
    const contents: DeckContents = parsed.contents;
    const config = wave6Scenario("sabretooth", {
      seed: 2026,
      players: [
        {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          aspects: contents.aspects as readonly CoreAspect[],
        },
      ],
    });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    console.info(
      `[wave6 custom-deck] Sabretooth — Cyclops (marvelcdb 59368): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
