import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import { WAVE11_CARDS, WAVE11_DEPS, coreScenario } from "@mc/cards";
import { choiceId, createGame, type GameState, type InstanceId, type PendingChoice, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { chosenResourcesNoteOf, isPaymentSheet, paymentSheetView } from "./payment-sheet.js";

const STATE = { players: [], instances: {}, stack: [] } as unknown as GameState;
const BASE = {
  choiceId: choiceId("c1"),
  playerId: "p1" as never,
  minSelections: 0,
  maxSelections: 0,
  options: [],
  frameId: null,
  ordered: false,
  soleDecider: false,
  authority: "player",
} as const;
const pay = (kind: "payForCard" | "payForAbility", cost: number): PendingChoice => ({
  ...BASE,
  prompt: { kind, instanceId: "i1" as never, abilityId: "a1" as never, cost },
});

describe("paymentSheetView", () => {
  test("nothing picked: Confirm is off and says what is missing; declining is its own, named control", () => {
    const view = paymentSheetView(STATE, pay("payForAbility", 2), [], POOL_DEPS);
    expect(view).toMatchObject({ canConfirm: false, confirmLabel: "Pay 2 more", declineLabel: "Don't use it" });
  });

  test("a card in a window says 'Don't play it'", () => {
    expect(paymentSheetView(STATE, pay("payForCard", 1), [], POOL_DEPS)?.declineLabel).toBe("Don't play it");
  });

  test("a selection the engine rejects never enables Confirm", () => {
    expect(paymentSheetView(STATE, pay("payForAbility", 1), ["hand:x"], POOL_DEPS)?.canConfirm).toBe(false);
  });

  test("a chosen-size cost says up to max is spent and never caps the selection", () => {
    const chosen: PendingChoice = {
      ...BASE,
      prompt: {
        kind: "payForAbility",
        instanceId: "i1" as never,
        abilityId: "a1" as never,
        cost: 0,
        chosenResources: { min: 1, max: 3, payingFor: "i1" as never },
      },
    };
    const view = paymentSheetView(STATE, chosen, [], POOL_DEPS);
    expect(view?.note).toBe("Pay 1 to 3. Up to 3 are spent; extra is overpaid.");
    expect(view?.confirmLabel).toBe("Pay 1 more");
    expect(chosenResourcesNoteOf(pay("payForAbility", 2).prompt)).toBeNull();
  });

  test("only payment prompts have a payment sheet", () => {
    const other: PendingChoice = { ...BASE, prompt: { kind: "chooseTarget", slot: "s", abilityId: null } };
    expect(isPaymentSheet(other)).toBe(false);
    expect(paymentSheetView(STATE, other, [], POOL_DEPS)).toBeNull();
  });
});

describe("another player's hand card on the payment sheet", () => {
  /** Surgery: a deck card of `player`'s retagged `code`, moved to `where`, faceup and controlled by that player. */
  const give = (s: GameState, player: PlayerId, code: string, where: "hand" | "playArea") => {
    const owner = s.players.find((p) => p.playerId === player)!;
    const id = owner.deck.at(-1)!;
    const moved: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === player ? { ...p, deck: p.deck.filter((i) => i !== id), [where]: [...p[where], id] } : p,
      ),
      instances: {
        ...s.instances,
        [id]: { ...s.instances[id]!, cardId: cardId(code), faceup: true, controllerId: player },
      },
    };
    return { state: moved, id };
  };

  test("is priced as its holder's: P2's The Defenders with 2 Defender allies is worth 2 to P1", () => {
    const config = coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
      seed: 1,
      difficulty: "standard",
      modularSetIds: [],
      cardPool: WAVE11_CARDS,
    } as never);
    const created = createGame(config, WAVE11_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const [p1, p2] = created.state.players.map((p) => p.playerId) as [PlayerId, PlayerId];
    const defenders = give(created.state, p2, "64033", "hand");
    const allied = give(give(defenders.state, p2, "64022", "playArea").state, p2, "64022", "playArea").state;
    const choice: PendingChoice = {
      ...BASE,
      playerId: p1,
      options: [
        { optionId: `hand:${defenders.id}`, label: "The Defenders", ref: { kind: "card", instanceId: defenders.id } },
      ],
      prompt: { kind: "payForCard", instanceId: "i1" as InstanceId, cost: 3 } as never,
    };
    expect(paymentSheetView(allied, choice, [`hand:${defenders.id}`], WAVE11_DEPS)?.paid).toBe(2);
  });
});
