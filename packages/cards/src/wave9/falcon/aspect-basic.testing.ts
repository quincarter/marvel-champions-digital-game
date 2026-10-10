import { cardId } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { firstLegal, settle } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { wave1StarterDeckSetup } from "../../wave1/setup.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9StarterDeckSetup } from "../setup.js";
import { FALCON_ASPECT_BASIC } from "./aspect-basic.js";
import { falconSeat } from "./testing.js";

/**
 * Every earlier script and this module only: the tests do not depend on the pack's other modules (Falcon's own
 * "Eagle-Eyed" response, say, would otherwise be offered after every Aerial card these tests play).
 */
export const ASPECT_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, FALCON_ASPECT_BASIC) };

/**
 * A game past setup (alter-ego form, hand of 6) for the Falcon Leadership precon, which holds every card of this
 * module's first half, against Core's Rhino. `second` adds a Core Spider-Man seat. `swap` replaces the first deck copy
 * of a card by another (the deck is then not legal, so legality is unchecked).
 */
export function aspectGame(
  opts: {
    readonly seed?: number;
    readonly second?: boolean;
    /** The second seat is Core's Captain America (Steve Rogers, `cap-leadership`) instead of Spider-Man. */
    readonly steve?: boolean;
    /** The second seat is the Winter Soldier precon (`winter-aggression`; Bucky Barnes in alter-ego form). */
    readonly bucky?: boolean;
    readonly swap?: Readonly<Record<string, string>>;
  } = {},
): GameState {
  const seed = opts.seed ?? 1;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const second = opts.bucky
    ? wave9StarterDeckSetup("winter-aggression")
    : opts.steve
      ? wave1StarterDeckSetup("cap-leadership")
      : coreScenario("rhino", {
          players: [{ starterDeckId: "core-spider-man-justice" }],
          seed,
          modularSetIds: [],
        }).players[0]!;
  const seat = falconSeat(opts.swap);
  const created = createGame(
    {
      ...base,
      players: opts.second || opts.steve || opts.bucky ? [seat, second] : [seat],
      requireLegalDecks: false,
    },
    ASPECT_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", ASPECT_DEPS);
}

/** The same game with Falcon in hero form. */
export const aspectHero = (opts: Parameters<typeof aspectGame>[0] = {}): GameState =>
  withForm(aspectGame(opts), { heroForm: 0 });

/**
 * Test surgery: Captain America's Shield 53034 set aside the way the linked keyword asks (RRG 1.8 "Linked", p. 27): a
 * faceup copy owned and controlled by nobody in the encounter set-aside area. Setup does not do this for the Falcon
 * precon today (its keyword names the title "Captain America upgrade", which no card is named), so a game stages it.
 */
export function withLinkedShield(
  state: GameState,
  name = "linked-shield",
): { readonly state: GameState; readonly id: InstanceId } {
  const id = name as InstanceId;
  const donor = state.instances[state.players[0]!.deck[0]!]!;
  return {
    id,
    state: {
      ...state,
      encounterSetAside: [...state.encounterSetAside, id],
      instances: {
        ...state.instances,
        [id]: { ...donor, instanceId: id, cardId: cardId("53034"), ownerId: null, controllerId: null, faceup: true },
      },
    },
  };
}
