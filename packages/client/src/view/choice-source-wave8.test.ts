/**
 * Prompt titles and why-not wording for wave 8's engine additions (docs/phase7-wave8.md): a card-instructed basic
 * power (§3.64), wild declarations (§3.62), the additional cost to change form (§3.63), a "ready" cost (§3.54), a
 * deck-discard cost's size (§3.55), and the exclusion codes those prompts surface.
 */

import {
  PLAY_TO_OWN_AREA,
  frameId,
  playToAreaOption,
  inPlayPicksOf,
  type ChoicePrompt,
  type GameState,
  type InstanceId,
  type StackFrame,
  type TriggerEventKind,
} from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  costCardsPromptTitleOf,
  playDestinationTitleOf,
  promptTitleOf,
  setupOptionQuestionFor,
} from "./choice-source.js";
import { basicReasonWording, exclusionWording, exclusionWordingFor } from "./highlights.js";
import { paymentSubjectWords } from "./change-form-choice.js";
import { costPickSlot, playAimPrompt } from "./play-aim.js";
import { cardName } from "./names.js";
import { triggerEventWords } from "./trigger-event-words.js";

const title = (prompt: unknown, counts?: Parameters<typeof promptTitleOf>[2], state?: GameState): string =>
  promptTitleOf(prompt as ChoicePrompt, POOL_DEPS, counts, state);

describe("card-instructed basic power", () => {
  test("which character and power", () => {
    expect(title({ kind: "chooseBasicPower", powers: ["attack"], sourceInstanceId: null })).toBe("Choose who attacks");
    expect(title({ kind: "chooseBasicPower", powers: ["thwart"], sourceInstanceId: null })).toBe("Choose who thwarts");
    expect(title({ kind: "chooseBasicPower", powers: ["attack", "thwart"], sourceInstanceId: null })).toBe(
      "Choose who attacks or thwarts",
    );
  });

  test("which target", () => {
    expect(title({ kind: "chooseBasicPowerTarget", power: "attack", characterInstanceId: "x" })).toBe(
      "Choose an enemy to attack",
    );
    expect(title({ kind: "chooseBasicPowerTarget", power: "thwart", characterInstanceId: "x" })).toBe(
      "Choose a scheme to thwart",
    );
  });
});

describe("wild declarations", () => {
  test("one wild, or several", () => {
    expect(title({ kind: "declareWildTypes", wilds: 1 })).toBe("Choose what your wild counts as");
    expect(title({ kind: "declareWildTypes", wilds: 2 })).toBe("Choose what your two wilds count as");
  });
});

describe("the additional cost to change form", () => {
  const spend = (requirement: object, formChangeCost: object) =>
    title({ kind: "spendResources", requirement, formChangeCost });

  test("same-type, mixed and plain costs read as a question about the destination form", () => {
    expect(spend({ generic: 2 }, { to: "hero", sourceInstanceIds: [], sameType: 2 })).toBe(
      "Spend 2 resources of the same type to change to hero form?",
    );
    expect(spend({ generic: 3 }, { to: "alterEgo", sourceInstanceIds: [], sameType: 2 })).toBe(
      "Spend 3 resources, 2 of one type, to change to alter-ego form?",
    );
    expect(spend({ generic: 1 }, { to: "hero", sourceInstanceIds: [] })).toBe(
      "Spend 1 resource to change to hero form?",
    );
    expect(spend({}, { to: "hero", sourceInstanceIds: [] })).toBe("Pay to change to hero form?");
  });

  test("an ordinary spend keeps its own title", () => {
    expect(title({ kind: "spendResources", requirement: { generic: 2 } })).toBe("Spend 2 resources?");
  });
});

describe("ready cost", () => {
  test("chooseCostCards in ready mode asks for a card to ready", () => {
    expect(title({ kind: "chooseCostCards", instanceId: "c", abilityId: "a", slot: "s", mode: "ready" })).toBe(
      "Choose a card to ready",
    );
  });
});

describe("deck-discard cost size", () => {
  const frame = (effects: readonly { kind: string }[], cursor: number): StackFrame =>
    ({ kind: "effects", frameId: frameId("f9"), effects, cursor }) as unknown as StackFrame;
  const stateWith = (...frames: StackFrame[]): GameState => ({ stack: frames }) as unknown as GameState;
  const choice = { minSelections: 1, frameId: frameId("f9") };

  test("a chooseNumber followed by payDeckDiscardChoice is the size of the discard", () => {
    const state = stateWith(frame([{ kind: "chooseNumber" }, { kind: "payDeckDiscardChoice" }], 0));
    expect(title({ kind: "chooseNumber", min: 1, max: 3 }, choice, state)).toBe("Discard up to 3 cards from your deck");
    expect(title({ kind: "chooseNumber", min: 2, max: 4 }, choice, state)).toBe("Discard 2 to 4 cards from your deck");
    expect(title({ kind: "chooseNumber", min: 1, max: 1 }, choice, state)).toBe("Discard up to 1 card from your deck");
  });

  test("any other chooseNumber keeps the generic title", () => {
    const state = stateWith(frame([{ kind: "chooseNumber" }, { kind: "draw" }], 0));
    expect(title({ kind: "chooseNumber", min: 1, max: 3 }, choice, state)).toBe("Choose a number from 1 to 3");
    expect(title({ kind: "chooseNumber", min: 1, max: 3 })).toBe("Choose a number from 1 to 3");
  });
});

describe("why-not wording", () => {
  test("a guarded villain, a missing ability and a refused host each get their own words", () => {
    expect(exclusionWording("cannotBeAttacked")).toBe("can't be attacked right now");
    expect(exclusionWording("noSuchAbility")).toBe("has no such ability");
    expect(exclusionWording("cannotAttachTo")).toBe("can't be attached there");
  });

  test("a change of form short of its extra cost says so in a few words", () => {
    expect(
      basicReasonWording(
        "changeForm",
        "insufficient_resources",
        "changing to hero form has an additional cost: Card (2 resources of the same type): need 2, paid 0",
      ),
    ).toBe("can't pay the extra cost to change form");
    expect(basicReasonWording("changeForm", "wrong_form", "already in hero form")).toBe("already in hero form");
    expect(basicReasonWording("attack", "insufficient_resources", "nope")).toBe("nope");
    expect(basicReasonWording("endTurn", null, null)).toBe("not available right now");
  });

  test("the payment bar names a change of form", () => {
    expect(paymentSubjectWords({ kind: "changeForm" })).toBe("Change form");
    expect(paymentSubjectWords({ kind: "changeForm", to: "alterEgo" })).toBe("Change to alter-ego");
    expect(paymentSubjectWords({ kind: "basicRecover" })).toBe("This action");
  });
});

describe("pairing prompt", () => {
  test("pairCards has a title of its own", () => {
    expect(title({ kind: "pairCards", cards: [], with: [], icons: {}, matching: [], sourceInstanceId: null })).toBe(
      "Pair the cards with characters",
    );
  });
});

describe("the mission's damage pool", () => {
  const frame = (cursor: number, left?: number): StackFrame =>
    ({
      kind: "effects",
      frameId: frameId("f7"),
      effects: [{ kind: "assignDamage" }, { kind: "draw" }],
      cursor,
      vars: left === undefined ? {} : { "_pool.left": left },
    }) as unknown as StackFrame;
  const stateWith = (...frames: StackFrame[]): GameState => ({ stack: frames }) as unknown as GameState;
  const choice = { minSelections: 1, frameId: frameId("f7") };
  const target = { kind: "chooseTarget", slot: "assignDamage", abilityId: null };

  test("the character pick says it is the damage pool and how much is left", () => {
    expect(title(target, choice, stateWith(frame(0, 5)))).toBe("Mission damage pool, 5 left: choose a target");
  });

  test("the amount that follows names the pool and what is left of it", () => {
    expect(title({ kind: "chooseNumber", min: 1, max: 3 }, choice, stateWith(frame(0, 3)))).toBe(
      "Mission damage pool, 3 left: deal how much?",
    );
  });

  test("with the frame out of reach the title still says it is the pool, without a count", () => {
    expect(title(target)).toBe("Mission damage pool: choose a target");
    expect(title(target, choice, stateWith())).toBe("Mission damage pool: choose a target");
  });

  test("any other target slot or number keeps its own title", () => {
    expect(title({ kind: "chooseTarget", slot: "enemy", abilityId: null }, choice, stateWith(frame(0, 5)))).toBe(
      "Choose a target",
    );
    // The same frame, but the cursor has moved on from the damage pool.
    expect(title({ kind: "chooseNumber", min: 1, max: 3 }, choice, stateWith(frame(1, 5)))).toBe(
      "Choose a number from 1 to 3",
    );
  });
});

describe("cost prompts", () => {
  test("a cost paid with cards in hand names the verb", () => {
    expect(
      title({ kind: "chooseCostCards", instanceId: "c", abilityId: "a", slot: "discard", mode: "discardFromHand" }),
    ).toBe("Choose cards to discard from hand");
    expect(costCardsPromptTitleOf("discardFromHand")).toBe("Choose cards to discard from hand");
    expect(costCardsPromptTitleOf(undefined)).toBe("Choose a card for this cost");
  });

  test("ordering special abilities is neutral about Forced Interrupts and Responses", () => {
    expect(title({ kind: "orderSpecials" })).toBe("Order these abilities");
  });
});

describe("cost picks on a play or an ability", () => {
  test("the Setting a Special cost resolves is a pick in the slot the cost names", () => {
    const cost = {
      resolveAbility: { of: { kind: "each" }, choose: "setting", trigger: "special" },
    } as unknown as Parameters<typeof costPickSlot>[0];
    expect(costPickSlot(cost)).toBe("setting");
  });

  test("a character that takes a cost's damage is a pick in its slot (Rogue 48012)", () => {
    const cost = POOL_DEPS.abilities["48012.rogue-action"]?.cost;
    expect(cost?.dealDamage?.choose?.slot).toBe("friend");
    expect(costPickSlot(cost)).toBe("friend");
  });

  test("picks among cards in play that pay a cost are not a single slot", () => {
    // Teleport Drop's Bamf! (slot discarded) and Mutant Mayhem's two returned allies (xforce, xmen) are asked by
    // `in-play-cost-choice.ts`, one slot at a time, never aimed through a single target.
    expect(costPickSlot(POOL_DEPS.abilities["48008.teleport-drop-action"]?.cost)).toBeNull();
    expect(costPickSlot(POOL_DEPS.abilities["47028.mutant-mayhem-action"]?.cost)).toBeNull();
    const slots = (id: string) => inPlayPicksOf(POOL_DEPS.abilities[id]?.cost).map(({ pick }) => pick.slot);
    expect(slots("48008.teleport-drop-action")).toEqual(["discarded"]);
    expect(slots("47028.mutant-mayhem-action")).toEqual(["xforce", "xmen"]);
  });

  test("no cost, no slot", () => {
    expect(costPickSlot(undefined)).toBeNull();
  });
});

describe("trigger event words", () => {
  test("a form change and a card attached read as phrases", () => {
    const kinds: readonly TriggerEventKind[] = ["formChanging", "formChanged", "cardAttached"];
    expect(kinds.map(triggerEventWords)).toEqual(["a form change", "a form change", "a card attached"]);
  });
});

describe("why-not wording for the mission area", () => {
  test("areas and the other face read in a few words", () => {
    expect(exclusionWording("notInScenarioPlayArea")).toBe("not at the mission");
    expect(exclusionWording("closedScenarioPlayArea")).toBe("in the mission area, which this ability does not reach");
    expect(exclusionWording("notOtherFace")).toBe("not the other side of that card");
  });

  test("a card kept out of play names both reasons when the game is not at hand", () => {
    expect(exclusionWording("cannotEnterPlay")).toBe("a matching unique card is in play, or a rule bars it");
  });
});

describe("cannotEnterPlay told apart by the game", () => {
  let state: GameState;
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
    hand = [...state.players[0]!.hand];
  }, 30_000);

  test("a card a rule bars says so; a card nothing bars keeps the combined words", () => {
    const barred = hand.find((id) => state.instances[id]?.cardId !== undefined)!;
    const name = cardName(state, barred);
    const withRule = {
      ...state,
      scenarioRules: { ...state.scenarioRules, rules: [{ kind: "cannotEnterPlay", cards: { name } }] },
    } as unknown as GameState;
    expect(exclusionWordingFor(withRule, POOL_DEPS, "cannotEnterPlay", barred)).toBe("a rule keeps it out of play");
    expect(exclusionWordingFor(state, POOL_DEPS, "cannotEnterPlay", barred)).toBe(
      "a matching unique card is in play, or a rule bars it",
    );
    expect(exclusionWordingFor(state, POOL_DEPS, "notInPlay", barred)).toBe("not in play");
  });

  test("the aim question names the pick a cost asks for", () => {
    const aim = (abilityId: string) =>
      ({
        action: { kind: "useAbility", instanceId: hand[0]!, abilityId },
        example: { type: "useAbility", playerId: state.players[0]!.playerId },
        targets: [],
        blockedTargets: [],
        needsPayment: false,
      }) as unknown as Parameters<typeof playAimPrompt>[2];
    const name = cardName(state, hand[0]!);
    expect(playAimPrompt(state, POOL_DEPS, aim("48012.rogue-action"))).toBe(`${name}: choose who takes the damage`);
    const setting = Object.entries(POOL_DEPS.abilities).find(([, ability]) => ability.cost?.resolveAbility?.choose);
    expect(setting, "an ability whose cost resolves a chosen Setting").toBeDefined();
    expect(playAimPrompt(state, POOL_DEPS, aim(setting![0]))).toBe(`${name}: choose the Setting`);
    // Rock, Paper, Scissors' action discards a hand card as its cost: the board asks which one, up front.
    expect(playAimPrompt(state, POOL_DEPS, aim("44056.rock-paper-scissors-action"))).toBe(
      `${name}: choose a card for its cost`,
    );
  });
});

describe("the effect-path destination question (MC45 p. 5; docs/phase7-wave8.md §3.34)", () => {
  const option = (optionId: string, label: string) => ({
    optionId,
    label,
    ref: { kind: "cardDefinition", cardId: "x" } as never,
  });
  const destinations = [
    option(PLAY_TO_OWN_AREA, "Play Colossus to your area"),
    option(playToAreaOption("mission"), "Play Colossus to the mission"),
  ];

  test("asks where the ally goes instead of a bare 'Choose one'", () => {
    expect(title({ kind: "chooseOption" }, { minSelections: 1, options: destinations })).toBe(
      "Where does Colossus go?",
    );
    expect(playDestinationTitleOf(undefined, destinations)).toBe("Where does Colossus go?");
  });

  test("any other option choice keeps its own title", () => {
    const other = [option("opt:0", "Rejoin at full"), option("opt:1", "Sit this scenario out")];
    expect(title({ kind: "chooseOption" }, { minSelections: 1, options: other })).toBe("Choose one");
    expect(title({ kind: "chooseOption" })).toBe("Choose one");
    expect(playDestinationTitleOf(undefined, [])).toBeNull();
    expect(playDestinationTitleOf(undefined, [...destinations, ...other])).toBeNull();
  });
});

describe("the expert campaign's rejoin and heal questions (MC45 p. 20; owner decision, 2026-10-08)", () => {
  const instruction = {
    kind: "campaign",
    instructionId: "mc45.s2.setup.heal",
    text: "",
    citation: "MC45 p. 12",
  } as const;
  const prompt = { kind: "chooseOption" } as ChoicePrompt;

  test("a defeated seat is asked to rejoin; a living one whether to heal", () => {
    expect(
      setupOptionQuestionFor(instruction, prompt, [
        { label: "Rejoin at full · +3 threat" },
        { label: "Sit this scenario out" },
      ]),
    ).toBe("Rejoin your team?");
    expect(
      setupOptionQuestionFor(instruction, prompt, [{ label: "Heal to full · +3 threat" }, { label: "Decline" }]),
    ).toBe("Heal your identity to full?");
  });

  test("any other option choice, or a scenario instruction, keeps the generic header", () => {
    expect(setupOptionQuestionFor(instruction, prompt, [{ label: "Yes" }, { label: "No" }])).toBeNull();
    expect(
      setupOptionQuestionFor({ ...instruction, kind: "scenario" }, prompt, [{ label: "Rejoin at full · +3 threat" }]),
    ).toBeNull();
    expect(
      setupOptionQuestionFor(instruction, { kind: "chooseCards", slot: "x" } as unknown as ChoicePrompt, [
        { label: "Rejoin at full" },
      ]),
    ).toBeNull();
  });
});
