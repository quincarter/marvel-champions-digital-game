/**
 * Issue #991: an action's cost that picks cards in play is asked on the decision sheet (`scenes/choice.ts`) as a
 * `chooseCostCards` question, the one the engine raises for an interrupt's cost, so it shows full card faces, the source
 * card, Peek at table and Back out. Real game: `store/dev-repurpose-game.ts` (Iron Man, seven Tech upgrades in play,
 * Repurpose in hand).
 */
import { describe, expect, test } from "vitest";
import { applyCommand, tryPayment } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "../store/dev-game-steps.js";
import { REPURPOSE, startRepurposeGame, techInPlay } from "../store/dev-repurpose-game.js";
import { SessionStore } from "../store/session-store.js";
import { choiceSourceOf, promptTitleOf } from "./choice-source.js";
import {
  beginInPlayCostChoice,
  costChoicesOf,
  inPlayCostPendingChoice,
  slotAnswered,
  withSlotPicks,
} from "./in-play-cost-choice.js";
import { localChoice, onLocalChoiceChange, setLocalChoice } from "./local-choice.js";

async function repurpose() {
  const store = new SessionStore(new LocalEngineHost());
  await startRepurposeGame(store);
  const game = store.state.game!;
  const actions = store.state.legal!.actions;
  if (actions.kind !== "turn") throw new Error("not a turn");
  const entry = actions.legal.find(
    (e) => e.action.kind === "playCard" && codeOf(game, e.action.instanceId) === REPURPOSE,
  )!;
  return { game, entry, choice: beginInPlayCostChoice(game, POOL_DEPS, entry)! };
}

describe("Repurpose's Tech upgrade as a decision for the sheet", () => {
  test("one card to discard, every Tech upgrade in play a card option, the source is Repurpose", async () => {
    const { game, entry, choice } = await repurpose();
    expect(choice).not.toBeNull();
    const decision = inPlayCostPendingChoice(game, POOL_DEPS, choice)!;
    expect(decision.prompt).toMatchObject({ kind: "chooseCostCards", mode: "discard" });
    expect(decision.minSelections).toBe(1);
    expect(decision.maxSelections).toBe(1);
    expect(decision.options.map((o) => o.optionId).sort()).toEqual([...techInPlay(game)].sort());
    for (const option of decision.options) expect(option.ref).toEqual({ kind: "card", instanceId: option.optionId });
    const source = entry.action.kind === "playCard" ? entry.action.instanceId : null;
    expect(choiceSourceOf(game, decision)?.instanceId).toBe(source);
    expect(promptTitleOf(decision.prompt, POOL_DEPS, decision, game)).toBe("Choose a card to discard");
  });

  test("the sheet's answer becomes the play's costChoices, and the engine discards exactly that upgrade", async () => {
    const { game, entry, choice } = await repurpose();
    const last = inPlayCostPendingChoice(game, POOL_DEPS, choice)!.options.at(-1)!.optionId;
    expect(slotAnswered(withSlotPicks(choice, []), game, POOL_DEPS)).toBe(false);
    // A card not offered is left out, and one past the cap too.
    const first = inPlayCostPendingChoice(game, POOL_DEPS, choice)!.options[0]!.optionId;
    expect(withSlotPicks(choice, ["nope", last, first]).picks).toEqual({ [choice.slots[0]!.slot]: [last] });
    const answered = withSlotPicks(choice, ["nope", last]);
    expect(slotAnswered(answered, game, POOL_DEPS)).toBe(true);
    const attempt = tryPayment(
      game,
      game.players[0]!.playerId,
      entry.action,
      [],
      { target: null, costChoices: costChoicesOf(answered) },
      POOL_DEPS,
    );
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    const next = applyCommand(game, attempt.command, POOL_DEPS);
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.state.players[0]!.discard).toContain(last);
  });

  test("the local decision store tells its listeners only of a new question", () => {
    const heard: string[] = [];
    const off = onLocalChoiceChange(() => heard.push(String(localChoice()?.choice.choiceId ?? null)));
    const choice = { choiceId: "local-cost:a:0" } as never;
    const one = {
      choice,
      title: "",
      note: () => null,
      canConfirm: () => true,
      answer: async () => true,
      backOut: () => {},
    };
    setLocalChoice(one);
    setLocalChoice({ ...one });
    setLocalChoice(null);
    off();
    expect(heard).toEqual(["local-cost:a:0", "null"]);
  });
});
