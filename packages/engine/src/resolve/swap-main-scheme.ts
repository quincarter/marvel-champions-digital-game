/**
 * Swapping a main scheme in play with a set-aside main scheme (`EffectSpec swapCards`, docs/phase7-wave11-scenarios.md
 * §S3.2). Change of Venue (`fne` 60141), When Revealed: "Swap your main scheme with a random set-aside main scheme.
 * Place the threat from the previous scheme on the new scheme." MC60 p. 26 FAQ: "All cards attached to the previous
 * main scheme are discarded."
 *
 * RRG 1.8 "'Swap'" (p. 42): the two cards exchange locations. Cards that do not share a title: "the in-play card is
 * considered to leave play and the out-of-play card is considered to enter play. Tokens, attached cards, tucked cards,
 * and status cards on the previously in-play card are **not** transferred to the other card". So:
 * - the new card takes the old one's `MainSchemeState` slot (central or beside it) and its `playArea`, as a new instance
 *   (it entered play: no lasting effect, frame or attachment naming the old card reaches it, and it answers none of the
 *   triggering conditions still waiting for their response window, RRG 1.8 "Triggering Condition", p. 45, the owner's
 *   answer 43B, `noteEnteredPlay`), at its first stage with
 *   the B side faceup. Engine interpretation (tier 5): the card says swap, not reveal or advance, so no A side, no Setup,
 *   no When Revealed and no starting threat; and a set-aside main scheme has never been in play, so it is at its first
 *   stage;
 * - the old card takes the new one's place in the set-aside area, out of play: each card attached to it is discarded as
 *   attachments of a host leaving play are (`discardWithLeavingHost`, their "when this leaves play" interrupts first,
 *   `waitsForHostStep`), each card tucked under it is discarded, and its threat, counters and acceleration tokens go
 *   back to the pool (RRG 1.8 "Main Scheme", p. 27 does the same on an advance, keeping acceleration tokens; a swap
 *   transfers none of its tokens). It is a new copy of the card once it is out of play (RRG 1.8 "Leaves Play", p. 26):
 *   its ability uses (`abilityUses` keys `<instance>:…`) are cleared, and each lasting effect naming it by instance
 *   (`targets`) no longer does, ending (`targetLeftPlay`) when it named nothing else. A lasting effect that reaches cards
 *   by query (`affects`) reads the new card on its own terms. `leaveNow` (`effects.ts`) does neither for a card leaving
 *   play the usual way: an engine-wide gap to close separately, not a main scheme rule;
 * - `placePreviousThreat` ("Place the threat from the previous scheme on the new scheme") then places as much threat on
 *   the new scheme as the old one had, through the ordinary `placeThreat` event: a placement, so it can complete the
 *   new scheme, and it is not threat moved (RRG 1.8 "Move", p. 29, needs both cards in play).
 *
 * Engine interpretation (tier 5): no card in the pool answers a main scheme entering or leaving play, so the swap
 * raises no `cardEntersPlay` / `cardLeavesPlay` for the two schemes; it is logged `mainSchemeSwapped`.
 *
 * Whether the two share a title is read on the faces the swap compares (`swapTitles`): a double-sided card's faceup side
 * is the one in play (RRG 1.8 "In Play and Out of Play", p. 23), so the scheme in play is titled by its current stage's
 * B side (`currentName`: "Battle in the Bodega"), and the incoming card, which takes the original's orientation ("Swapped
 * cards maintain the orientation ... of the original card", p. 42), by its first stage's B side ("Bull in a China
 * Shop"). The five Protection Racket cards share their 1A title, "Protection Racket" (the card data's `name`), and no
 * 1B title, so Change of Venue's swap is the "do not share a title" one above, as its own "Place the threat from the
 * previous scheme on the new scheme" and the MC60 p. 26 FAQ (attachments discarded) both read it.
 *
 * Not built (refused `unsupported`): a main scheme of a separate game area (Kang's own stages: `removeMainSchemeStage`),
 * two main schemes whose compared faces share a title (whose swap would carry everything over, p. 42; no printed card
 * does it), and an incoming card anywhere but the scenario's set-aside area (`GameState.encounterSetAside`, where
 * Protection Racket 1A sets the unused schemes aside).
 */

import type { CardId } from "@mc/content";
import { type Ctx, emit, moveCard, updateInstance } from "../ctx.js";
import { discardWithLeavingHost, endLastingEffect, inLeavingOrder, waitsForHostStep } from "../effects.js";
import { noteEnteredPlay } from "../entered-since.js";
import type { GameEvent } from "../events.js";
import type { FrameId, InstanceId } from "../ids.js";
import { cardOf, currentName, discardZoneFor, getInstance, mustInstance, sharedMainSchemes } from "../query.js";
import type { GameState, MainSchemeState } from "../state.js";
import { cardsInPlay } from "../select.js";
import { pushEvents } from "./frames.js";

type Refusal = Extract<GameEvent, { type: "swapRefused" }>["reason"];

/** What the swapping ability adds to the exchange. */
export interface MainSchemeSwapOptions {
  /** "Place the threat from the previous scheme on the new scheme" (`EffectSpec swapCards.placePreviousThreat`). */
  readonly placePreviousThreat?: boolean;
  /** The card whose ability swaps them: the source of the threat it places. */
  readonly sourceInstanceId?: InstanceId | null;
  /** The swapping ability's effects frame, for a "then" when a resumed swap is refused (`runHostStep`). */
  readonly frameId?: FrameId;
}

/** The main scheme in play's slot this card fills (central or beside it), if it is one. */
const slotOf = (state: GameState, id: InstanceId): MainSchemeState | undefined =>
  sharedMainSchemes(state).find((scheme) => scheme.instanceId === id);

/** Whether this card is a main scheme anywhere: in play (any slot, a game area's included) or out of play. */
const isMainSchemeCard = (state: GameState, id: InstanceId): boolean => cardOf(state, id)?.type === "main_scheme";

/**
 * The pair a main scheme swap exchanges, the in-play one first, or null when neither card is a main scheme (the swap is
 * `swapCards`' own). A refusal when one is and the pair is not a main scheme in play and a set-aside main scheme card.
 */
export function mainSchemeSwapPair(
  state: GameState,
  a: InstanceId,
  b: InstanceId,
): { readonly outgoing: InstanceId; readonly incoming: InstanceId } | Refusal | null {
  if (!isMainSchemeCard(state, a) && !isMainSchemeCard(state, b)) return null;
  const [outgoing, incoming] = slotOf(state, a) ? [a, b] : slotOf(state, b) ? [b, a] : [null, null];
  if (outgoing === null || incoming === null) return "unsupported";
  if (slotOf(state, incoming)) return "bothInPlay";
  if (!isMainSchemeCard(state, incoming) || !state.encounterSetAside.includes(incoming)) return "unsupported";
  if (cardsInPlay(state).includes(incoming)) return "bothInPlay";
  const titles = swapTitles(state, outgoing, incoming);
  if (titles.outgoing === undefined || titles.outgoing === titles.incoming) return "unsupported";
  return { outgoing, incoming };
}

/**
 * The titles a main scheme swap compares (RRG 1.8 p. 42 "share a title"): the scheme in play's faceup side
 * (`currentName`, its current stage's own title or else the card's), and the set-aside card's first stage as it would
 * show in the original's orientation, B side up (its stage title or else the card's).
 */
function swapTitles(
  state: GameState,
  outgoing: InstanceId,
  incoming: InstanceId,
): { readonly outgoing: string | undefined; readonly incoming: string | undefined } {
  const card = cardOf(state, incoming);
  const first = card?.type === "main_scheme" ? card.stages[0] : undefined;
  return { outgoing: currentName(state, outgoing), incoming: first?.name ?? card?.name };
}

/**
 * Swaps `outgoing` (a main scheme in play) with `incoming` (a set-aside main scheme card), checked by
 * `mainSchemeSwapPair`. Returns `"waiting"` while the old scheme's attachments' "when this leaves play" interrupts
 * resolve (the host step calls this again), else `"swapped"`.
 */
export function swapMainScheme(
  ctx: Ctx,
  outgoing: InstanceId,
  incoming: InstanceId,
  options: MainSchemeSwapOptions = {},
): "swapped" | "waiting" | "refused" {
  const old = slotOf(ctx.state, outgoing);
  if (!old || !getInstance(ctx.state, incoming) || !ctx.state.encounterSetAside.includes(incoming)) {
    // Something moved one of them while the attachments' interrupts resolved: nothing to swap any more.
    emit(ctx, { type: "swapRefused", reason: "missingCard", instanceIds: [outgoing, incoming] });
    return "refused";
  }
  if (
    waitsForHostStep(ctx, [outgoing], {
      kind: "swapMainScheme",
      schemeId: outgoing,
      incoming,
      ...(options.placePreviousThreat ? { placePreviousThreat: true } : {}),
      ...(options.sourceInstanceId != null ? { sourceInstanceId: options.sourceInstanceId } : {}),
      ...(options.frameId !== undefined ? { frameId: options.frameId } : {}),
    })
  )
    return "waiting";

  const before = mustInstance(ctx.state, outgoing);
  const threat = before.threat;
  const incomingInstance = mustInstance(ctx.state, incoming);
  const fromCard = before.cardId;
  const toCard: CardId = incomingInstance.cardId;
  // Off the old scheme first, as a host leaving play sheds them (RRG 1.8 "Attach To", p. 8; "Tuck", p. 45).
  for (const attachment of inLeavingOrder(ctx.state, before.attachments)) discardWithLeavingHost(ctx, attachment);
  for (const tuckedId of [...mustInstance(ctx.state, outgoing).tucked]) {
    updateInstance(ctx, tuckedId, (i) => ({ ...i, faceup: true }));
    moveCard(ctx, tuckedId, discardZoneFor(ctx.state, tuckedId), "top");
  }

  // The exchange of locations: the new card in the old one's slot, the old card in the new one's set-aside place.
  const scheme: MainSchemeState = {
    instanceId: incoming,
    cardId: toCard,
    stageIndex: 0,
    completed: false,
    accelerationTokens: 0,
    ...(old.playArea !== undefined ? { playArea: old.playArea } : {}),
  };
  const central = ctx.state.mainScheme.instanceId === outgoing;
  ctx.state = {
    ...ctx.state,
    ...(central
      ? { mainScheme: scheme }
      : { extraMainSchemes: (ctx.state.extraMainSchemes ?? []).map((s) => (s.instanceId === outgoing ? scheme : s)) }),
    encounterSetAside: ctx.state.encounterSetAside.map((id) => (id === incoming ? outgoing : id)),
  };
  // The swapped-in card did not see what has already occurred (`relocateCard` does the same for a card moved into play).
  ctx.state = noteEnteredPlay(ctx.state, incoming);
  forgetOutgoing(ctx, outgoing);
  const outFaceup = before.faceup;
  updateInstance(ctx, outgoing, (i) => ({
    ...i,
    threat: 0,
    damage: 0,
    counters: {},
    faceup: incomingInstance.faceup,
    exhausted: false,
  }));
  updateInstance(ctx, incoming, (i) => ({ ...i, faceup: outFaceup, exhausted: false, threat: 0, counters: {} }));
  emit(ctx, {
    type: "mainSchemeSwapped",
    outgoing,
    incoming,
    cardIds: [fromCard, toCard],
    playArea: old.playArea ?? null,
    threat,
  });
  if (options.placePreviousThreat && threat > 0)
    pushEvents(ctx, [
      {
        kind: "placeThreat",
        schemeInstanceId: incoming,
        amount: threat,
        sourceInstanceId: options.sourceInstanceId ?? null,
      },
    ]);
  return "swapped";
}

/**
 * The old scheme is a new copy of its card out of play (RRG 1.8 "Leaves Play", p. 26): its ability uses go, and each
 * lasting effect naming it by instance stops naming it, ending when it named nothing else.
 */
function forgetOutgoing(ctx: Ctx, outgoing: InstanceId): void {
  const prefix = `${outgoing}:`;
  if (Object.keys(ctx.state.abilityUses).some((key) => key.startsWith(prefix)))
    ctx.state = {
      ...ctx.state,
      abilityUses: Object.fromEntries(Object.entries(ctx.state.abilityUses).filter(([key]) => !key.startsWith(prefix))),
    };
  for (const effect of [...ctx.state.lastingEffects]) {
    const targets = "targets" in effect ? effect.targets : null;
    if (!targets?.includes(outgoing)) continue;
    const rest = targets.filter((id) => id !== outgoing);
    if (rest.length === 0) {
      endLastingEffect(ctx, effect.id, "targetLeftPlay");
      continue;
    }
    ctx.state = {
      ...ctx.state,
      lastingEffects: ctx.state.lastingEffects.map((e) => (e.id === effect.id ? { ...e, targets: rest } : e)),
    };
  }
}
