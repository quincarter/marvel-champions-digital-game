/**
 * An either/or cost the player is not asked about, because only one branch can be paid, is paid on that branch all the
 * way through (issue #993). Sinking Ferry (Fear No Evil's Disasters, 60178): "Spend [energy][energy] resources or
 * exhaust a hero or ally you control → remove 1 civilian counter". With no [energy] to spend only the exhaust branch is
 * payable, so the board asks which character to exhaust; after Squirrel Girl was picked it opened a payment for two
 * [energy] (the first branch's cost) and the counter could never come off.
 *
 * Captain America in hero form with Squirrel Girl and Wonder Man ready (`dev-in-play-cost-games.ts`), then Sinking
 * Ferry put in the villain area with 2 civilian counters and the hand emptied, on a copy of the table the controller
 * reads (the Disasters only come in Protection Racket, whose villain phases a dev game would have to play through).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  legalActions,
  type Command,
  type GameState,
  type InstanceId,
  type LegalAction,
} from "@mc/engine";
import { POOL_DEPS } from "../../content/pool.js";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { startStrengthInNumbersDevGame } from "../../store/dev-in-play-cost-games.js";
import { SessionStore } from "../../store/session-store.js";
import type { Highlights } from "../../view/highlights.js";
import type { BoardModel } from "../../view/board-model.js";
import { BoardController, type BoardControllerHost } from "./controller.js";

class NoopWorker {
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}
(globalThis as unknown as { Worker: unknown }).Worker = NoopWorker;

const FERRY_ACTION = "60178.sinking-ferry-action";
const SQUIRREL_GIRL = "03013";

let table: GameState;
let ferry: InstanceId;
let squirrelGirl: InstanceId;
let dispatch: ReturnType<typeof vi.fn<(command: Command) => Promise<boolean>>>;

/** Sinking Ferry (an encounter card's instance, reprinted) in the villain area with 2 civilian counters; no hand. */
function withFerry(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck[0]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: pile.deck.slice(1) } },
      villainArea: [...state.villainArea, id],
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, cardId: cardId("60178"), faceup: true, counters: { civilian: 2 } },
      },
      players: state.players.map((p, i) => (i === 0 ? { ...p, hand: [] } : p)),
    },
  };
}

function host(): BoardControllerHost {
  return {
    model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
    marks: (): Highlights | null => ({ playable: new Set() }) as unknown as Highlights,
    tabbed: (): boolean => false,
    redraw: (): void => {},
    inspect: vi.fn<(id: InstanceId) => void>(),
    confirmEndTurn: vi.fn(),
    holdOn: vi.fn(),
  };
}

const ferryEntry = (): LegalAction | undefined => {
  const actions = legalActions(table, table.players[0]!.playerId, POOL_DEPS);
  return actions.kind === "turn"
    ? actions.legal.find((e) => e.action.kind === "useAbility" && e.action.abilityId === FERRY_ACTION)
    : undefined;
};

beforeEach(async () => {
  const real = new SessionStore(new LocalEngineHost());
  await startStrengthInNumbersDevGame(real);
  const staged = withFerry(real.state.game!);
  table = staged.state;
  ferry = staged.id;
  squirrelGirl = cardsInPlay(table).find((id) => (table.instances[id]!.cardId as string) === SQUIRREL_GIRL)!;
  dispatch = vi.fn<(command: Command) => Promise<boolean>>(async () => true);
  // The controller reads the table and its legal list from the store, and sends through `dispatch`.
  const actions = legalActions(table, table.players[0]!.playerId, POOL_DEPS);
  const store = { state: { ...real.state, game: table, legal: { ...real.state.legal!, actions } }, dispatch };
  (appSession() as unknown as { store: unknown }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
});

describe("Sinking Ferry with no [energy] to spend (issue #993)", () => {
  test("the engine offers only the exhaust branch", () => {
    expect(ferryEntry()?.costBranches).toEqual([1]);
  });

  test("picking Squirrel Girl to exhaust uses the action on the exhaust branch, with nothing to pay", async () => {
    const controller = new BoardController(host());
    controller.useAbilityById(ferry, FERRY_ACTION as never);
    // Captain America, Squirrel Girl and Wonder Man can each be exhausted: the player picks.
    expect(controller.selection.kind).toBe("choosingInPlayCost");
    expect(controller.tapInMode(squirrelGirl)).toBe(true);
    await controller.confirmInPlayCost();

    // Before the fix this opened a payment for two [energy] here.
    expect(controller.selection.kind).not.toBe("paying");
    expect(dispatch).toHaveBeenCalledTimes(1);
    const sent = dispatch.mock.calls[0]![0] as Extract<Command, { type: "useAbility" }>;
    expect(sent).toMatchObject({ type: "useAbility", cardInstanceId: ferry, abilityId: FERRY_ACTION, payment: [] });
    expect(sent.costSelection?.branch).toBe(1);
    expect(sent.costChoices?.["exhausted"]).toEqual([squirrelGirl]);
  });
});
