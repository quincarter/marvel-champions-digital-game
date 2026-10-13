/**
 * Who pays a shareable part of a cost (docs/phase7-wave10-hero-packs.md H3.19; `LegalAction.costHelp`): the prompt, the
 * `costSelection.paidBy` an answer makes, and the bar's and the log's words. A real two-player Core game supplies the
 * seats and their names; the legal action is written out as the engine reports one, since no card in the client's
 * pool prints "any player may help pay those costs" yet (Wonder Man's pack is not playable in the client).
 */
import type { CostSelection, GameEvent, GameState, LegalAction, PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import {
  consentHelpersOf,
  costHelpersOf,
  costHelpLines,
  costHelpPromptsFor,
  withCostHelper,
  withCostHelpAnswers,
  withEntryPayers,
} from "./cost-help-model.js";
import { logLine } from "./log-lines.js";
import { faceUpName, seatName } from "./names.js";
import { paymentView, type PaymentState } from "./payment-model.js";

let state: GameState;
let me: PlayerId;
let other: PlayerId;
let otherName: string;

beforeAll(async () => {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    seed: 4,
  });
  state = { ...started.snapshot.state, cardPool: started.cardPool, pendingChoice: null } as unknown as GameState;
  me = state.players[0]!.playerId;
  other = state.players[1]!.playerId;
  otherName = faceUpName(state, state.players[1]!.identity.instanceId);
}, 120_000);

/** A `useAbility` on the main scheme as `legalActions` lists one, with the given `costHelp`. */
const entry = (costHelp: LegalAction["costHelp"]): LegalAction => ({
  action: { kind: "useAbility", instanceId: state.mainScheme.instanceId, abilityId: "x.action" as never },
  example: {
    type: "useAbility",
    playerId: me,
    cardInstanceId: state.mainScheme.instanceId,
    abilityId: "x.action" as never,
    payment: [],
  },
  targets: [],
  blockedTargets: [],
  needsPayment: false,
  ...(costHelp ? { costHelp } : {}),
});

describe("costHelpPromptsFor", () => {
  test("asks who pays a part two players can pay, the user first and named 'You'", () => {
    expect(costHelpPromptsFor(state, entry([{ part: "damageSelf", payers: [me, other] }]))).toEqual([
      {
        part: "damageSelf",
        title: "Who takes the damage?",
        options: [
          { playerId: me, label: "You" },
          { playerId: other, label: otherName },
        ],
        unavailable: [],
      },
    ]);
  });

  test("asks nothing when only the user can pay, or the action has no shareable part", () => {
    expect(costHelpPromptsFor(state, entry([{ part: "damageSelf", payers: [me] }]))).toEqual([]);
    expect(costHelpPromptsFor(state, entry(undefined))).toEqual([]);
  });

  test("a part only another player can pay is still asked, with that player alone", () => {
    const [prompt] = costHelpPromptsFor(state, entry([{ part: "discardFromDeck", payers: [other] }]));
    expect(prompt?.title).toBe("Who discards from their deck?");
    expect(prompt?.options).toEqual([{ playerId: other, label: otherName }]);
  });
});

describe("withCostHelper", () => {
  test("names a helper in paidBy, keeps the rest of the selection, and removes the entry when the user pays", () => {
    const branch: CostSelection = { branch: 1 };
    const helped = withCostHelper(branch, me, "damageSelf", other);
    expect(helped).toEqual({ branch: 1, paidBy: { damageSelf: other } });
    expect(withCostHelper(helped, me, "damageSelf", me)).toEqual({ branch: 1 });
    expect(withCostHelper(undefined, me, "damageSelf", me)).toBeUndefined();
    expect(withCostHelper({ paidBy: { damageSelf: other } }, me, "discardFromDeck", other)).toEqual({
      paidBy: { damageSelf: other, discardFromDeck: other },
    });
  });
});

describe("the words for the bar and the log", () => {
  test("one line per helper, naming the parts they pay; none when the user pays everything", () => {
    const selection: CostSelection = { paidBy: { damageSelf: other, discardFromDeck: other } };
    expect(costHelpersOf(state, me, selection)).toEqual([
      { playerId: other, parts: ["damageSelf", "discardFromDeck"] },
    ]);
    expect(costHelpLines(state, me, selection)).toEqual([
      `Helped by ${otherName}: the damage, the discard from their deck`,
    ]);
    expect(costHelpLines(state, me, { paidBy: { damageSelf: me } })).toEqual([]);
    expect(costHelpLines(state, me, undefined)).toEqual([]);
  });

  test("the payment bar adds the line to its helper lines", () => {
    const payment: PaymentState = {
      action: { kind: "useAbility", instanceId: state.mainScheme.instanceId, abilityId: "x.action" as never },
      target: null,
      costSelection: { paidBy: { damageSelf: other } },
      query: { requirement: { generic: 1, physical: 0, mental: 0, energy: 0, wild: 0 }, sources: [], suggested: [] },
      picked: [],
      reductions: [],
    } as unknown as PaymentState;
    expect(paymentView(state, me, payment, "x", POOL_DEPS).helperLines).toEqual([`Helped by ${otherName}: the damage`]);
  });

  test("the log says who helped pay, and for which card", () => {
    const event = {
      type: "costPartPaidBy",
      playerId: me,
      helperId: other,
      sourceInstanceId: state.mainScheme.instanceId,
      part: "damageSelf",
    } as GameEvent;
    const scheme = faceUpName(state, state.mainScheme.instanceId);
    // The log names a seat as every other line does (`seatName`): the hero, or "You" for the viewer.
    expect(logLine(event, state, me, POOL_DEPS)?.text).toBe(
      `${seatName(state, other, me)} helps pay for ${scheme}: the damage.`,
    );
    expect(logLine(event, state, other, POOL_DEPS)?.text).toBe(`You help pay for ${scheme}: the damage.`);
  });
});

describe("the answers, carried into the command", () => {
  test("withCostHelpAnswers puts a helper's part in the example's paidBy and drops a part the user takes", () => {
    const asked = entry([{ part: "damageSelf", payers: [me, other] }]);
    const helped = withCostHelpAnswers(asked, [["damageSelf", other]]);
    expect(helped.example).toMatchObject({ type: "useAbility", costSelection: { paidBy: { damageSelf: other } } });
    expect(helped.costHelp).toEqual(asked.costHelp);
    const back = withCostHelpAnswers(helped, [["damageSelf", me]]);
    expect(back.example).not.toHaveProperty("costSelection");
  });

  test("withEntryPayers keeps the entry's helpers in a branch pick built from nothing", () => {
    const helped = withCostHelpAnswers(entry([{ part: "damageSelf", payers: [me, other] }]), [["damageSelf", other]]);
    expect(withEntryPayers(helped, { branch: 1 })).toEqual({ branch: 1, paidBy: { damageSelf: other } });
    expect(withEntryPayers(helped, undefined)).toEqual({ paidBy: { damageSelf: other } });
    expect(withEntryPayers(entry(undefined), { branch: 1 })).toEqual({ branch: 1 });
  });
});

describe("consentHelpersOf", () => {
  const command = (extra: object) =>
    ({
      type: "useAbility",
      playerId: me,
      cardInstanceId: state.mainScheme.instanceId,
      abilityId: "x",
      payment: [],
      ...extra,
    }) as never;

  test("is empty for a command that takes only the user's own things", () => {
    expect(consentHelpersOf(state, me, command({ costChoices: { discard: [state.players[0]!.hand[0]!] } }))).toEqual(
      [],
    );
  });

  test("names a helper whose hand card is discarded, and one handed a part of the cost", () => {
    const card = state.players[1]!.hand[0]!;
    expect(consentHelpersOf(state, me, command({ costChoices: { discard: [card] } }))).toEqual([
      { playerId: other, instanceIds: [card], parts: [] },
    ]);
    expect(consentHelpersOf(state, me, command({ costSelection: { paidBy: { damageSelf: other } } }))).toEqual([
      { playerId: other, instanceIds: [], parts: ["damageSelf"] },
    ]);
    expect(
      consentHelpersOf(
        state,
        me,
        command({ costChoices: { discard: [card] }, costSelection: { paidBy: { damageSelf: other } } }),
        [{ playerId: other, instanceIds: [card] }],
      ),
    ).toEqual([{ playerId: other, instanceIds: [card], parts: ["damageSelf"] }]);
  });
});
