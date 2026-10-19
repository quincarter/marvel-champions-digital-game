/**
 * Two options of `EffectSpec putIntoPlay` a campaign instruction needs (docs/phase7-wave11-scenarios.md §S3.15): MC60
 * p. 9 step 12, "Place the environment for each Completed scenario into play Completed side faceup and the environment
 * for each Failed scenario into play Failed side faceup. Resolve the 'Setup' abilities on each of these cards."
 *
 * - `otherFace`: the card enters play with its other face (`EncounterCardCommon.flipSide`) faceup. That is where it
 *   starts, not a flip: RRG 1.8 "Flip" (p. 20) is a card in play turning over, so no `cardFlipped` is announced. Nor is
 *   it a reveal (rulings January 26, 2026 (4) answer 2 and April 30, 2026 (3) answer 3: flipping is not revealing, so
 *   placing a card on a face is not either). Logged `cardEnteredOnOtherFace`.
 * - `resolveSetup`: the Setup abilities of each card that entered play then resolve, after everything the entries
 *   themselves put on the stack (the `cardEntersPlay` windows, a quickstrike): MC60 p. 9 step 12 places the cards,
 *   then resolves their Setup, and a response to the entry resolves "immediately after" it (RRG 1.8 "Response",
 *   p. 38). RRG 1.8 "Setup (Triggered Ability)" (p. 40) places a Setup ability in Appendix II steps 12 and 16 (p. 51);
 *   a card put into play any other time has no step to resolve it in, so it resolves only when the text that put it
 *   into play says so, which is what this option is. "You" for a card nobody controls is the player the entry is
 *   attributed to (`putIntoPlay.controller`).
 *
 *   The Setups of several cards share one timing (they resolve "during setup", forced), so the first player orders
 *   them (RRG 1.8 "Simultaneous Resolution", p. 40; "First Player", p. 19), with the `orderTriggers` prompt as When
 *   Defeated abilities across cards are ordered (`defeated-together.ts`); one card's own abilities keep their printed
 *   order. Built when the step resolves, after the entries, so the frames read the face each card is on by then.
 */

import { pushFrames, requestChoice, setFrame, updateInstance, emit, type Ctx } from "../ctx.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardOf } from "../query.js";
import { cardsInPlay } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { StackFrame, TriggerCandidate } from "../stack.js";
import { simultaneousOrderer } from "../villain/authority.js";
import { base, gameAbilityFrames, type Frame } from "./frames.js";
import { candidateOption } from "./window.js";

type SetupsTogether = Extract<EffectSpec, { kind: "resolveSetupsTogether" }>;

/** A card `turnBeforeEntry` turned, with what it had hidden, so a card that did not enter can be put back as it was. */
export interface TurnedForEntry {
  readonly id: InstanceId;
  readonly reverseHidden: boolean;
}

/**
 * Turns a card about to enter play to its `flipSide` face, so everything its entry reads (where it goes, a side
 * scheme's starting threat, its enter-play keywords, a quickstrike) is that face's. A card with no such face (one
 * face, or a card whose other face is a card of its own, `otherFaceId`) is unchanged and `null` is returned. Each card
 * turned here is settled by `settleEntryFaces` once the effect's entries are done.
 */
export function turnBeforeEntry(ctx: Ctx, id: InstanceId): TurnedForEntry | null {
  const card = cardOf(ctx.state, id);
  if (!card || !("flipSide" in card) || card.flipSide === undefined) return null;
  const reverseHidden = ctx.state.instances[id]?.reverseHidden === true;
  // Its other face is the one showing from the start: nothing of the card is hidden (as `turnToFlipSide`).
  updateInstance(ctx, id, ({ reverseHidden: _shown, ...i }) => ({ ...i, flipped: true }));
  return { id, reverseHidden };
}

/**
 * Logs `cardEnteredOnOtherFace` for each turned card that entered play, and puts back each one that did not (a
 * refused entry, an attachment with no host): a card out of play shows its front (`CardInstance.flipped`), and a
 * reverse that was hidden stays hidden.
 */
export function settleEntryFaces(ctx: Ctx, turned: readonly TurnedForEntry[], playerId: PlayerId): void {
  const inPlay = cardsInPlay(ctx.state);
  for (const { id, reverseHidden } of turned) {
    if (inPlay.includes(id)) emit(ctx, { type: "cardEnteredOnOtherFace", instanceId: id, playerId });
    else
      updateInstance(ctx, id, (i) => ({
        ...i,
        flipped: false,
        ...(reverseHidden ? { reverseHidden: true as const } : {}),
      }));
  }
}

/**
 * Pushes the `resolveSetupsTogether` step for the cards of `entered`, below every frame pushed since the stack held
 * `heldStack` frames (the entries' own frames), so the entries resolve first.
 */
export function resolveSetupOnEntry(
  ctx: Ctx,
  heldStack: number,
  entered: readonly InstanceId[],
  playerId: PlayerId,
): void {
  if (entered.length === 0) return;
  const step: StackFrame = {
    ...base(ctx),
    kind: "effects",
    effects: [{ kind: "resolveSetupsTogether", cards: entered, playerId }],
    cursor: 0,
    bindings: {},
    vars: {},
    scopedPlayerId: null,
    selfInstanceId: null,
    controllerId: playerId,
    event: null,
    eventFrameId: null,
  };
  // Lifted off and put back on top, as setup step 11's frames are over step 12's (`resolveScenarioSetup`).
  const entryFrames = ctx.state.stack.slice(0, Math.max(0, ctx.state.stack.length - heldStack));
  ctx.state = { ...ctx.state, stack: ctx.state.stack.slice(entryFrames.length) };
  pushFrames(ctx, [step]);
  ctx.state = { ...ctx.state, stack: [...entryFrames, ...ctx.state.stack] };
}

/**
 * The `resolveSetupsTogether` step: the Setup abilities of each of its cards still in play and faceup. With Setups on
 * two or more cards the first player orders them first (module docblock); the frames then go on in that order.
 */
export function executeResolveSetupsTogether(ctx: Ctx, frame: Frame<"effects">, step: SetupsTogether): void {
  const inPlay = cardsInPlay(ctx.state);
  const byCard = step.cards
    .filter((id) => inPlay.includes(id) && ctx.state.instances[id]?.facedownAs == null)
    .map((id) => gameAbilityFrames(ctx, id, ["setup"], null, undefined, step.playerId));
  let frames = byCard.flat();
  if (byCard.filter((own) => own.length > 0).length > 1) {
    const key = (f: StackFrame): string => (f.kind === "ability" ? `${f.instanceId}:${f.abilityId}` : "");
    if (frame.answer === null) {
      const candidates = frames.flatMap((f): TriggerCandidate[] =>
        f.kind === "ability"
          ? [
              {
                instanceId: f.instanceId,
                abilityId: f.abilityId,
                controllerId: f.controllerId,
                forced: true,
                fromHand: false,
              },
            ]
          : [],
      );
      const [first] = candidates;
      if (!first) return;
      requestChoice(ctx, {
        playerId: simultaneousOrderer(ctx.state),
        authority: "firstPlayerOrders",
        prompt: {
          kind: "orderTriggers",
          event: { kind: "cardEntersPlay", instanceId: first.instanceId, playerId: step.playerId },
          timing: "response",
        },
        options: candidates.map(candidateOption(ctx.state)),
        minSelections: candidates.length,
        maxSelections: candidates.length,
        frameId: frame.frameId,
        ordered: true,
      });
      return;
    }
    const answer = frame.answer;
    frames = [...frames].sort((a, b) => answer.indexOf(key(a)) - answer.indexOf(key(b)));
  }
  setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  pushFrames(ctx, frames);
}
