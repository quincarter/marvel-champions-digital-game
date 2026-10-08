/**
 * Log lines for wave 8's engine events (docs/phase7-wave8.md): the additional cost to change form (§3.63), a card
 * instructing a basic power (§3.64), "ready" and "discard from the top of your deck" costs (§3.54, §3.55), setup
 * options (§3.5), the villain row (§3.7), top-of-deck reveals (§3.48), wild declarations (§3.62) and the discard a
 * response took away (Q32). `attackAwaitsAbility` stays an explicit no-line.
 */

import { activeVillain, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";
import { cardName } from "./names.js";

let state: GameState;
let me: PlayerId;
let villain: InstanceId;
let hand: InstanceId[];

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
  villain = activeVillain(state).instanceId;
  hand = [...state.players[0]!.hand];
}, 30_000);

const textOf = (event: GameEvent): string | null => logLine(event, state, me, POOL_DEPS)?.text ?? null;
const name = (id: InstanceId): string => cardName(state, id);

describe("additional cost to change form", () => {
  const base = { playerId: undefined as unknown as PlayerId, to: "hero" as const };
  test("asked, then paid, declined or unpayable", () => {
    const common = { ...base, playerId: me, sourceInstanceIds: [hand[0]!] };
    expect(textOf({ type: "formChangeCostAsked", ...common })).toBe("Changing to hero form costs extra.");
    const settled = (outcome: "paid" | "declined" | "unpayable", to: "hero" | "alterEgo" = "hero") =>
      textOf({ type: "formChangeCostSettled", ...common, to, outcome });
    expect(settled("paid")).toBe("You paid the extra cost to change to hero form.");
    expect(settled("declined")).toBe("You declined the extra cost; the form stays.");
    expect(settled("unpayable", "alterEgo")).toBe("You can't pay the extra cost; the form stays.");
  });
});

describe("a card instructing a basic power", () => {
  test("names the card, the character, the power and the target", () => {
    const [character, source] = hand as [InstanceId, InstanceId];
    expect(
      textOf({
        type: "basicPowerInstructed",
        playerId: me,
        characterInstanceId: character,
        power: "attack",
        targetInstanceId: villain,
        sourceInstanceId: source,
      }),
    ).toBe(`${name(source)}: ${name(character)} attacks ${name(villain)}.`);
  });

  test("a thwart made with ATK says so, and a missing source card is left out", () => {
    expect(
      textOf({
        type: "basicPowerInstructed",
        playerId: me,
        characterInstanceId: hand[0]!,
        power: "thwart",
        targetInstanceId: state.mainScheme.instanceId,
        sourceInstanceId: null,
        useAtk: true,
      }),
    ).toBe(`${name(hand[0]!)} thwarts ${name(state.mainScheme.instanceId)} with ATK.`);
  });

  test("basicPowerNotMade gives one short reason each", () => {
    const made = (reason: "noLegalUse" | "costNotPaid" | "refused") =>
      textOf({ type: "basicPowerNotMade", playerId: me, sourceInstanceId: hand[0]!, reason });
    expect(made("noLegalUse")).toBe(`${name(hand[0]!)}: no basic attack or thwart is possible.`);
    expect(made("costNotPaid")).toBe(`${name(hand[0]!)}: the extra cost wasn't paid, so no basic power.`);
    expect(made("refused")).toBe(`${name(hand[0]!)}: the basic power couldn't be declared.`);
  });
});

describe("attack lines", () => {
  test("attackAwaitsAbility is bookkeeping and has no line", () => {
    expect(
      textOf({
        type: "attackAwaitsAbility",
        attackFrameId: "f1" as never,
        abilityFrameId: "f2" as never,
        attackerInstanceId: hand[0]!,
      }),
    ).toBeNull();
  });

  test("attackTargetSkipped says the enemy takes no damage", () => {
    expect(
      textOf({
        type: "attackTargetSkipped",
        attackerInstanceId: hand[0]!,
        targetInstanceId: villain,
        sourceInstanceId: null,
      }),
    ).toBe(`${name(hand[0]!)} can't attack ${name(villain)}, so it takes no damage from that attack.`);
  });
});

describe("costs", () => {
  test("a ready cost names the readied cards, or says it was not paid", () => {
    const common = { instanceId: hand[0]!, playerId: me, instanceIds: [hand[1]!, hand[2]!] };
    expect(textOf({ type: "readyCardsCostSettled", ...common, readied: 2, paid: true })).toBe(
      `${name(hand[1]!)}, ${name(hand[2]!)} readied as a cost.`,
    );
    expect(textOf({ type: "readyCardsCostSettled", ...common, readied: 1, paid: false })).toBe(
      `${name(hand[1]!)}, ${name(hand[2]!)} didn't ready, so the cost wasn't paid.`,
    );
  });

  test("a deck-discard cost counts the cards, or says how few could go", () => {
    const common = { instanceId: hand[0]!, playerId: me, chosen: 3 };
    expect(
      textOf({ type: "deckDiscardCostSettled", ...common, discarded: [hand[1]!, hand[2]!, hand[3]!], paid: true }),
    ).toBe("You discarded 3 cards from the top of your deck as a cost.");
    expect(textOf({ type: "deckDiscardCostSettled", ...common, chosen: 1, discarded: [hand[1]!], paid: true })).toBe(
      "You discarded 1 card from the top of your deck as a cost.",
    );
    expect(textOf({ type: "deckDiscardCostSettled", ...common, discarded: [hand[1]!], paid: false })).toBe(
      "You could discard only 1 of 3 cards, so the cost wasn't paid.",
    );
    expect(
      textOf({
        type: "deckDiscardCostSettled",
        instanceId: null,
        playerId: null,
        chosen: 2,
        discarded: [],
        paid: true,
      }),
    ).toBe("A player discarded 0 cards from the top of the deck as a cost.");
  });

  test("deckDiscardNotCounted names the card", () => {
    expect(textOf({ type: "deckDiscardNotCounted", playerId: me, instanceId: hand[1]!, slot: "discarded" })).toBe(
      `${name(hand[1]!)} doesn't count as discarded.`,
    );
  });
});

describe("setup and the villain row", () => {
  test("setupOptionApplied speaks the icon markup and drops nothing else", () => {
    expect(
      textOf({
        type: "setupOptionApplied",
        option: "syn-set.modular-difficulty",
        amount: 2,
        text: "Place 2[per_hero] threat on the Syn Pool.",
        citation: "MC45 p. 8",
      }),
    ).toBe("Setup option: Place 2 per hero threat on the Syn Pool.");
  });

  test("villainRowSet lists the row left to right", () => {
    expect(textOf({ type: "villainRowSet", order: [villain, state.mainScheme.instanceId] })).toBe(
      `Villains in a row, left to right: ${name(villain)}, ${name(state.mainScheme.instanceId)}.`,
    );
  });

  test("the active counter moving along the row reads differently from an effect moving it", () => {
    const moved = (reason: "nextInRow" | "effect") =>
      textOf({ type: "activeVillainChanged", from: villain, to: hand[0]!, reason });
    expect(moved("nextInRow")).toBe(`The active counter moves along the row to ${name(hand[0]!)}.`);
    expect(moved("effect")).toBe(`The active villain is now ${name(hand[0]!)}.`);
  });
});

describe("moments, deck top and wilds", () => {
  test("momentRaised is silent unless it carries a pulled count", () => {
    const raised = { type: "momentRaised", name: "x", playerId: me, sourceInstanceId: null } as const;
    expect(textOf(raised)).toBeNull();
    expect(textOf({ ...raised, carriedVars: { other: 2 } })).toBeNull();
    expect(textOf({ ...raised, carriedVars: { "pulled.count": 3 } })).toBe("You discarded 3 cards.");
    expect(textOf({ ...raised, carriedVars: { "pulled.count": 1 } })).toBe("You discarded 1 card.");
  });

  test("the top of a deck showing and hiding", () => {
    const top = state.instances[hand[0]!]!.cardId;
    expect(textOf({ type: "deckTopShown", playerId: me, instanceId: hand[0]!, cardId: top })).toMatch(
      /^Your top card is faceup: .+\.$/,
    );
    expect(textOf({ type: "deckTopHidden", playerId: me })).toBe("Your top card is facedown again.");
  });

  test("a declared wild is a line; one the engine skipped is not", () => {
    const declared = {
      type: "wildTypesDeclared",
      playerId: me,
      instanceId: hand[0]!,
      declared: ["energy", "wild"],
      paidAs: { physical: 0, mental: 0, energy: 0, wild: 0 },
    } as const;
    expect(textOf({ ...declared, skipped: false })).toBe("You count the wilds as energy, wild.");
    expect(textOf({ ...declared, declared: ["mental"], skipped: false })).toBe("You count the wild as mental.");
    expect(textOf({ ...declared, skipped: true })).toBeNull();
  });
});
