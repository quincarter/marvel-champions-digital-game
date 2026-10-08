import { createGame, type Command, type GameState, type InstanceId } from "@mc/engine";
import { PLAYABLE_CARDS, cardId, parseMarvelCdbDeckJsonText, type CoreAspect, type DeckContents } from "@mc/content";
import { firstLegal, identityOf, P1, patchInstance, playerOf, settle, use, type Picker } from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { conjure } from "../wave7/cross-hero-testing.js";
import { WAVE8_DEPS, wave8Scenario } from "./index.js";

// `import.meta.glob` (Vite/vitest's static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig has no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURES = (import.meta as unknown as ImportMetaEnv).glob("./fixtures/decklists/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** The saved MarvelCDB decklist 34506, unmodified. */
export const FIXTURE_TEXT = FIXTURES["./fixtures/decklists/doctor-strange-invoke-the-fourth-wall.json"]!;

export function importedDeck(): DeckContents {
  const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, PLAYABLE_CARDS);
  if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
  return result.contents;
}

/** The imported deck in a one-player game on `scenario`, opened on the first player turn with every opening hand kept. */
export function openedGame(seed = 1, scenario = "unus"): GameState {
  const contents = importedDeck();
  const config = wave8Scenario(scenario, {
    seed,
    players: [
      {
        identityCardId: contents.identityCardId,
        deck: contents.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
        aspects: contents.aspects as readonly CoreAspect[],
      },
    ],
  });
  const created = createGame({ ...config, cards: PLAYABLE_CARDS }, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}

/** Doctor Strange in hero form (the identity starts as Stephen Strange; surgery, so no form change is spent). */
export const heroGame = (seed = 1, scenario = "unus"): GameState =>
  withForm(openedGame(seed, scenario), { heroForm: 0 }, P1);

export const SPELL_MASTERY = "09001a.spell-mastery";

export const topInvocation = (state: GameState): InstanceId => {
  const top = playerOf(state, P1).separateDecks["Invocation"]?.deck[0];
  if (!top) throw new Error("empty Invocation deck");
  return top;
};
export const invocationCodes = (state: GameState, pile: "deck" | "discard"): string[] =>
  (playerOf(state, P1).separateDecks["Invocation"]?.[pile] ?? []).map((id) => state.instances[id]!.cardId as string);

/** The Spell Mastery command: exhaust Doctor Strange, pay the top Invocation's printed cost with `pay`. */
export const spellMastery = (state: GameState, pay: readonly InstanceId[] = []): Command =>
  use(
    P1,
    identityOf(state),
    SPELL_MASTERY,
    pay.map((fromHand) => ({ fromHand })),
    { invocation: [topInvocation(state)] },
  );

export const pickFirstOffered: Picker = firstLegal;

// ---- test-only state surgery (staging a situation, never the behavior under test) ----

/** Takes the first copy of `code` out of the deck/hand/discard and attaches it to the identity (an upgrade in play). */
export function attachedUpgrade(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in the player's cards`);
  const host = identityOf(state);
  const stripped: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            deck: p.deck.filter((i) => i !== id),
            discard: p.discard.filter((i) => i !== id),
          }
        : p,
    ),
  };
  const attached = patchInstance(stripped, id, { attachedTo: host, exhausted: false, faceup: true });
  return { state: patchInstance(attached, host, { attachments: [...attached.instances[host]!.attachments, id] }), id };
}

/** Takes the first copy of `code` out of the deck/hand/discard and puts it in the player's play area (an ally). */
export function allyInPlay(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, P1);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in the player's cards`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: p.hand.filter((i) => i !== id),
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
              playArea: [...p.playArea, id],
            }
          : p,
      ),
    },
  };
}

/** `n` extra Strength (01090, [physical]) cards in hand, conjured: payment fodder that is not in the deck under test. */
export function withFodder(state: GameState, n: number, code = "01090"): { state: GameState; ids: InstanceId[] } {
  let s = state;
  const ids: InstanceId[] = [];
  for (let k = 0; k < n; k++) {
    const made = conjure(s, code, "hand", P1);
    s = made.state;
    ids.push(made.id);
  }
  return { state: s, ids };
}
