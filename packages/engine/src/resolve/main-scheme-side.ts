/**
 * Which side of a main scheme stage is faceup (docs/phase7-wave8.md §4.1 Q56).
 *
 * RRG 1.8 Appendix II step 12 (p. 51): "a. Resolve any 'Setup' abilities on main scheme card 1A. b. Flip the main
 * scheme card to side 1B and resolve any 'When Revealed' abilities on that side." RRG 1.8 "Main Scheme" (p. 27), when
 * the main scheme deck advances: "2. Resolve any 'When Revealed' ability on the 'A' side of the new top card … 3. Flip
 * the top card of the main scheme deck to its 'B' side, place threat on that card equal to its starting threat value,
 * and resolve any 'When Revealed' ability on that side of the card."
 *
 * So a stage begins with its A side faceup (`MainSchemeState.faceupSide`), and its B side's abilities are not live
 * until the stage turns over: nothing printed on the B side answers what the A side's instructions do (or what step
 * 11 of setup puts into play), and an ability that becomes live when the stage turns does not trigger for something
 * that happened before. The turn is its own event on the stack, `mainSchemeTurnsToB`, behind the A side's frames; its
 * apply step turns the stage and only then puts the B side's own Setup and When Revealed frames on the stack.
 *
 * **Hinder on a stage** (docs/phase7-wave10.md §3.13). RRG 1.8 "Hinder X" (p. 22): "A card with the hinder X keyword
 * enters play with X threat on it", "in addition to any threat it normally enters play with"; MC56 p. 9: "When a card
 * with hinder X enters play, place X threat on that card." A stage's keywords are its B side's, printed or gained from
 * its own text ("If there is more than 1 player on your team, this stage gains hinder 2[per_hero]", the Civil War
 * stage 1B cards), so they are read once that side is the faceup one: the turn places `keywordTotal(hinder)` as one
 * placement, before the B side's Setup and When Revealed resolve. The stage's starting threat is its own placement
 * (at setup it is already on the stage; on an advance, or a stage revealed into a game area, the turn places it just
 * before the hinder, `placeStartingThreat`), so the stage ends with both. Read once, as the stage turns: a stage that
 * gains hinder later, or loses it, has no threat placed or removed for it.
 */

import type { Ctx } from "../ctx.js";
import { pushFrames } from "../ctx.js";
import { updateMainSchemeState } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { keywordTotal } from "../keywords.js";
import { mainSchemeStageOf, mainSchemeStateOf, mainSchemeValue } from "../query.js";
import type { StackFrame } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { eventFrame, gameAbilityFrames } from "./frames.js";

type SideAbilityKind = "setup" | "whenRevealed";

/**
 * The frames for a main scheme stage that has just become the faceup stage with its A side up: the A side's `aKind`
 * abilities, then the turn to the B side, which resolves the B side's `bKinds` abilities in that order.
 */
export function mainSchemeStageFrames(
  ctx: Ctx,
  schemeId: InstanceId,
  aKind: SideAbilityKind,
  bKinds: readonly SideAbilityKind[],
  playerId: PlayerId,
  options: { readonly placeStartingThreat?: boolean } = {},
): readonly StackFrame[] {
  const scheme = mainSchemeStateOf(ctx.state, schemeId);
  if (!scheme) return [];
  const stage = mainSchemeStageOf(ctx.state, scheme);
  return [
    ...gameAbilityFrames(ctx, schemeId, [aKind], null, stage.aSide.abilities, playerId),
    eventFrame(ctx, {
      kind: "mainSchemeTurnsToB",
      schemeInstanceId: schemeId,
      stageIndex: scheme.stageIndex,
      resolve: bKinds,
      playerId,
      ...(options.placeStartingThreat ? { placeStartingThreat: true as const } : {}),
    }),
  ];
}

/**
 * The stage turns to its B side and that side's abilities resolve. Nothing happens for a stage that is no longer the
 * scheme's (it advanced again while its A side was resolving: the new stage has its own turn on the stack).
 */
export function applyMainSchemeTurnsToB(ctx: Ctx, event: Extract<TriggerEvent, { kind: "mainSchemeTurnsToB" }>): void {
  const scheme = mainSchemeStateOf(ctx.state, event.schemeInstanceId);
  if (!scheme || scheme.stageIndex !== event.stageIndex) return;
  updateMainSchemeState(ctx, event.schemeInstanceId, ({ faceupSide: _turned, ...turned }) => turned);
  const hinder = keywordTotal(ctx.state, event.schemeInstanceId, "hinder", ctx.deps);
  // Step 3's starting threat, read with the B side faceup, goes on before that side's When Revealed resolves (RRG 1.8
  // "Main Scheme", p. 27), so a When Revealed that counts or removes threat sees it.
  const turned = mainSchemeStateOf(ctx.state, event.schemeInstanceId);
  const startingThreat =
    event.placeStartingThreat && turned ? mainSchemeValue(ctx.state, "startingThreat", ctx.deps, turned) : 0;
  pushFrames(ctx, [
    ...(event.placeStartingThreat
      ? [
          eventFrame(ctx, {
            kind: "placeThreat",
            schemeInstanceId: event.schemeInstanceId,
            amount: startingThreat,
            sourceInstanceId: null,
          }),
        ]
      : []),
    ...(hinder > 0
      ? [
          eventFrame(ctx, {
            kind: "placeThreat",
            schemeInstanceId: event.schemeInstanceId,
            amount: hinder,
            sourceInstanceId: null,
          }),
        ]
      : []),
    ...event.resolve.flatMap((kind) =>
      gameAbilityFrames(ctx, event.schemeInstanceId, [kind], null, undefined, event.playerId),
    ),
  ]);
}
