/**
 * Drives each aspect's `SessionConfig` (guide/aspect-tryit-config.ts, guided mode G10d) through a real session
 * core — the same layer `guide/tutorial-config.test.ts` drives — asserting its own precondition: the signature
 * card is in the opening hand, and legally playable, on the very first turn (`docs/guided-mode.md` brief for G10d:
 * "assert the signature card is in hand and playable within the first turn, or state why not"). Every aspect here
 * *is* playable turn one — see `aspect-tryit-config.ts`'s own header for why each signature card was chosen over
 * the other members of its aspect's `AspectGuide.signatureCardCodes` specifically to avoid a board dependency
 * (threat on a scheme, a minion in play, an ally already down) that would make it not.
 */
import { describe, expect, test } from "vitest";
import { choiceId } from "@mc/engine";
import { EngineSessionCore } from "../engine/session-core.js";
import { ASPECT_TRYIT_CONFIGS, ASPECT_TRYIT_PLAYER_ID, type AspectTryItId } from "./aspect-tryit-config.js";

/** The mulligan is always the first choice a fresh solo game deals (same instance-id-numbering determinism
 * `tutorial-config.ts`'s own header notes) — `TUTORIAL_SCRIPT`'s own first command hardcodes the same id. */
const MULLIGAN_CHOICE_ID = choiceId("c1");

const ASPECTS: readonly AspectTryItId[] = ["justice", "aggression", "leadership", "protection"];

describe("ASPECT_TRYIT_CONFIGS (guided mode G10d)", () => {
  test.each(ASPECTS)("%s: the signature card is in the opening hand", async (aspect) => {
    const { config, signatureCardId } = ASPECT_TRYIT_CONFIGS[aspect];
    const core = new EngineSessionCore();
    const started = await core.start(config);
    const state = started.snapshot.state;
    expect(state.round).toBe(1);

    const player = state.players.find((p) => p.playerId === ASPECT_TRYIT_PLAYER_ID)!;
    expect(player.identity.form).toBe("alterEgo");
    expect(player.hand.map((id) => state.instances[id]!.cardId)).toContain(signatureCardId as string);
    expect(player.hand).toHaveLength(6);

    // The mulligan choice this suite keeps below is exactly what `start-aspect-tryit.ts` resolves.
    expect(started.snapshot.legal?.actions.kind).toBe("choice");
  });

  test.each(ASPECTS)("%s: the signature card is a legal play on turn one, after setup", async (aspect) => {
    const { config, signatureCardId } = ASPECT_TRYIT_CONFIGS[aspect];
    const core = new EngineSessionCore();
    const started = await core.start(config);
    expect(started.snapshot.legal?.actions.kind === "choice" && started.snapshot.legal.actions.choice.choiceId).toBe(
      MULLIGAN_CHOICE_ID as string,
    );

    // Keep the stacked hand as dealt (mulligan), then answer any further setup choice (e.g. Black Panther's own
    // "pick a starting upgrade") with its first option — the same loop `start-aspect-tryit.ts` runs, and its own
    // header explains why that's fine here.
    let snapshot = started.snapshot;
    for (let choice = snapshot.state.pendingChoice; choice; choice = snapshot.state.pendingChoice) {
      const answer = choice.minSelections > 0 ? [choice.options[0]!.optionId] : [];
      const result = core.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: answer,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      snapshot = result.snapshot;
    }

    const player = snapshot.state.players.find((p) => p.playerId === ASPECT_TRYIT_PLAYER_ID)!;
    const signatureInstanceId = player.hand.find(
      (id) => snapshot.state.instances[id]!.cardId === (signatureCardId as string),
    );
    expect(signatureInstanceId).toBeDefined();

    const legal = snapshot.legal;
    expect(legal?.actions.kind).toBe("turn");
    const playSignature =
      legal?.actions.kind === "turn"
        ? legal.actions.legal.find(
            (entry) => entry.action.kind === "playCard" && entry.action.instanceId === signatureInstanceId,
          )
        : undefined;
    expect(playSignature).toBeDefined();
  });
});
