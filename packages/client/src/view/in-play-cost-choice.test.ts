/**
 * A cost that leaves a choice among cards in play asks the player which (RRG 1.8 "Cost", p. 13), for the cards that
 * print a range: Mutant Peacekeepers (34018, "any number of X-MEN allies"), Strength in Numbers (03017, "any number of
 * allies", a count bound to X) and Team Strike (32045, "any number of X-MEN allies"). Real games from
 * `store/dev-x-men-games.ts`, real engine: the candidates, the range and the legality of what is sent are the engine's.
 */
import { describe, expect, test } from "vitest";
import { applyCommand, cardsInPlay, type Command, type GameState, type InstanceId, type LegalAction } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import {
  PEACEKEEPERS_CARD,
  STRENGTH_IN_NUMBERS_CARD,
  TEAM_STRIKE_CARD,
  startPeacekeepersDevGame,
  startStrengthInNumbersDevGame,
  startTeamStrikeDevGame,
} from "../store/dev-in-play-cost-games.js";
import { SessionStore } from "../store/session-store.js";
import {
  advanceInPlayCostChoice,
  beginInPlayCostChoice,
  costChoicesOf,
  inPlayCostChoiceView,
  isLastSlot,
  slotAnswered,
  toggleInPlayPick,
} from "./in-play-cost-choice.js";
import { inPlayCostPanelOf } from "./pick-panels.js";

type Started = { readonly game: GameState; readonly entry: LegalAction; readonly allies: readonly InstanceId[] };

async function started(
  start: (store: SessionStore) => Promise<void>,
  held: string,
  allies: readonly string[],
): Promise<Started> {
  const store = new SessionStore(new LocalEngineHost());
  await start(store);
  const game = store.state.game!;
  const actions = store.state.legal!.actions;
  if (actions.kind !== "turn") throw new Error("not a turn");
  const entry = actions.legal.find(
    (e) => e.action.kind === "playCard" && (game.instances[e.action.instanceId]?.cardId as string) === held,
  );
  if (!entry) throw new Error(`${held} is not playable`);
  const inPlay = cardsInPlay(game).filter((id) => allies.includes(game.instances[id]!.cardId as string));
  return { game, entry, allies: inPlay };
}

describe("Mutant Peacekeepers: any number of X-MEN allies", () => {
  test("asks, offers both allies, and counts what is picked with a live X", async () => {
    const { game, entry, allies } = await started(startPeacekeepersDevGame, PEACEKEEPERS_CARD, ["34003", "34015"]);
    expect(allies).toHaveLength(2);
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry)!;
    expect(choice).not.toBeNull();
    expect(choice.slots).toHaveLength(1);
    expect([...choice.slots[0]!.candidates].sort()).toEqual([...allies].sort());
    expect(choice.slots[0]).toMatchObject({ mode: "exhaust", min: 1, max: 2, uncapped: true });

    const empty = inPlayCostChoiceView(game, POOL_DEPS, choice);
    expect(empty.summary).toBe("PICKED 0 (any number)");
    expect(empty.canConfirm).toBe(false);
    expect(empty.reason).toBe("Pick 1 more");

    const one = inPlayCostChoiceView(game, POOL_DEPS, toggleInPlayPick(choice, allies[0]!));
    const both = inPlayCostChoiceView(
      game,
      POOL_DEPS,
      toggleInPlayPick(toggleInPlayPick(choice, allies[0]!), allies[1]!),
    );
    expect(one.summary).toBe("PICKED 1 (any number)");
    expect(one.canConfirm).toBe(true);
    const xOf = (preview: string | null): number => Number(/X = (\d+) threat/.exec(preview ?? "")?.[1]);
    expect(xOf(one.preview)).toBeGreaterThan(0);
    expect(xOf(both.preview)).toBeGreaterThan(xOf(one.preview));
  });

  test("a second tap puts a card back; the picks go out as costChoices and the engine accepts them", async () => {
    const { game, entry, allies } = await started(startPeacekeepersDevGame, PEACEKEEPERS_CARD, ["34003", "34015"]);
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry)!;
    const picked = toggleInPlayPick(toggleInPlayPick(choice, allies[0]!), allies[0]!);
    expect(inPlayCostChoiceView(game, POOL_DEPS, picked).picked.size).toBe(0);

    const second = toggleInPlayPick(choice, allies[1]!);
    expect(isLastSlot(second)).toBe(true);
    expect(slotAnswered(second)).toBe(true);
    const costChoices = costChoicesOf(second);
    expect(costChoices).toEqual({ exhausted: [allies[1]] });
    const command = {
      ...entry.example,
      costChoices: { ...(entry.example as { costChoices?: object }).costChoices, ...costChoices },
    } as Command;
    const result = applyCommand(game, command, POOL_DEPS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.instances[allies[1]!]!.exhausted).toBe(true);
    expect(result.state.instances[allies[0]!]!.exhausted).toBe(false);
  });

  test("a card that is not a candidate is ignored, and the tiles carry the counts and the preview", async () => {
    const { game, entry, allies } = await started(startPeacekeepersDevGame, PEACEKEEPERS_CARD, ["34003", "34015"]);
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry)!;
    expect(toggleInPlayPick(choice, game.players[0]!.identity.instanceId)).toBe(choice);
    const panel = inPlayCostPanelOf(
      game,
      POOL_DEPS,
      inPlayCostChoiceView(game, POOL_DEPS, toggleInPlayPick(choice, allies[0]!)),
    );
    expect(panel.title).toBe("Choose cards to exhaust");
    expect(panel.options.map((o) => o.instanceId).sort()).toEqual([...allies].sort());
    expect(panel.options.every((o) => o.lines.some((line) => /THW \d/.test(line)))).toBe(true);
    expect(panel.multi?.summary).toBe("PICKED 1 (any number)");
    expect(panel.multi?.preview).toMatch(/^X = \d+ threat$/);
    expect(panel.multi?.canConfirm).toBe(true);
  });
});

describe("a pick with only one answer is not a question", () => {
  test("with one ready ally the cost is forced, so nothing is asked", async () => {
    const { game, entry, allies } = await started(startPeacekeepersDevGame, PEACEKEEPERS_CARD, ["34003", "34015"]);
    const spent = {
      ...game,
      instances: { ...game.instances, [allies[0]!]: { ...game.instances[allies[0]!]!, exhausted: true } },
    };
    expect(beginInPlayCostChoice(spent, POOL_DEPS, entry)).toBeNull();
  });
});

describe("Strength in Numbers: any number of allies, a card drawn for each", () => {
  test("offers both allies, previews the cards drawn, and sends exactly the allies picked", async () => {
    const { game, entry, allies } = await started(startStrengthInNumbersDevGame, STRENGTH_IN_NUMBERS_CARD, [
      "03013",
      "03014",
    ]);
    expect(allies).toHaveLength(2);
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry)!;
    expect(choice.slots[0]).toMatchObject({ mode: "exhaust", min: 1, max: 2, uncapped: true, bind: "n" });
    const [first, second] = allies as [InstanceId, InstanceId];

    const view = (c: typeof choice) => inPlayCostChoiceView(game, POOL_DEPS, c);
    expect(view(toggleInPlayPick(choice, first)).preview).toBe("X = 1 cards");
    const both = toggleInPlayPick(toggleInPlayPick(choice, first), second);
    expect(view(both).preview).toBe("X = 2 cards");

    // Nothing to pay (it costs 0), so the picks alone make the command; the engine draws one card per ally.
    const handBefore = game.players[0]!.hand.length;
    const command = { ...entry.example, costChoices: costChoicesOf(both) } as Command;
    const result = applyCommand(game, command, POOL_DEPS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.players[0]!.hand.length).toBe(handBefore - 1 + 2);
  });

  test("only one ally picked exhausts only that one", async () => {
    const { game, entry, allies } = await started(startStrengthInNumbersDevGame, STRENGTH_IN_NUMBERS_CARD, [
      "03013",
      "03014",
    ]);
    const choice = toggleInPlayPick(beginInPlayCostChoice(game, POOL_DEPS, entry)!, allies[1]!);
    const result = applyCommand(game, { ...entry.example, costChoices: costChoicesOf(choice) } as Command, POOL_DEPS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.instances[allies[1]!]!.exhausted).toBe(true);
    expect(result.state.instances[allies[0]!]!.exhausted).toBe(false);
  });
});

describe("Team Strike: any number of X-MEN allies, damage by their total ATK", () => {
  test("asks, and its preview is damage that grows with the allies picked", async () => {
    const { game, entry, allies } = await started(startTeamStrikeDevGame, TEAM_STRIKE_CARD, ["35003", "35014"]);
    expect(allies).toHaveLength(2);
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry)!;
    expect(choice.slots[0]).toMatchObject({ mode: "exhaust", min: 1, max: 2, uncapped: true });
    const one = inPlayCostChoiceView(game, POOL_DEPS, toggleInPlayPick(choice, allies[0]!)).preview;
    const both = inPlayCostChoiceView(
      game,
      POOL_DEPS,
      toggleInPlayPick(toggleInPlayPick(choice, allies[0]!), allies[1]!),
    ).preview;
    expect(one).toMatch(/^X = \d+ damage$/);
    expect(Number(/\d+/.exec(both ?? "")![0])).toBeGreaterThan(Number(/\d+/.exec(one ?? "")![0]));
  });

  test("advancing a single-slot cost does nothing, and an unanswered slot cannot advance", async () => {
    const { game, entry } = await started(startTeamStrikeDevGame, TEAM_STRIKE_CARD, ["35003", "35014"]);
    const choice = beginInPlayCostChoice(game, POOL_DEPS, entry)!;
    expect(advanceInPlayCostChoice(choice)).toBe(choice);
  });
});
