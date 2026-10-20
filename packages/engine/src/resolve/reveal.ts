/** Revealing encounter cards and placing them (attachment hosts included). */

import { placeAttachment } from "./imminent-attach.js";
import { displayNameOf } from "../visibility.js";
import type { AbilityId, AnyCard, AttachmentHost } from "@mc/content";
import {
  type Ctx,
  emit,
  findFrame,
  moveCard,
  popFrame,
  pushFrames,
  requestChoice,
  setFrame,
  updateInstance,
} from "../ctx.js";
import {
  applyToughness,
  dealEncounterCardOrAnnounce,
  dealEncounterCardTo,
  encounterDealAwaitingInterrupt,
} from "../effects.js";
import { type FrameId, type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import {
  cardOf,
  discardZoneFor,
  getInstance,
  locateCard,
  mustCardOf,
  areaOfPlayer,
  mainSchemeFor,
  cardBackOf,
} from "../query.js";
import { activeAbilityRefs, cardsInPlay, enemyTeamDecider, traitGrantReach, type EffectContext } from "../select.js";
import type { RevealKeyword, RevealSource, StackFrame } from "../stack.js";
import type { ZoneId } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { entersRevealersPlayArea, firstRevealGainsSurge, whenRevealedRepeats } from "../rules.js";
import { encounterTargetSelector, simultaneousOrderer } from "../villain/authority.js";
import { EngineInvariantError } from "../errors.js";
import { matchingCardInPlay } from "../unique.js";
import { attachmentHostCandidates } from "../attachment-hosts.js";
import { attachCard } from "./attach.js";
import { engagedEvent } from "./apply-effect.js";
import {
  engageInPlayMinion,
  engagementOf,
  enterPlay,
  playerSideSchemeEntersPlay,
  quickstrikeAttack,
  quickstrikeFrame,
  schemeEntryThreat,
  teamworkFrame,
  teamworkWouldActivate,
} from "./enter-play.js";
import { asksTraitGrants, hasCandidates, heard } from "./triggers.js";
import { pushWindow } from "./window.js";
import { markPreThenUnresolved } from "./then.js";
import { hasPerPlayerMainSchemes, mainSchemesFor } from "../per-player-main-schemes.js";
import { base, eventFrame, type Frame, gameAbilityFrames, gameAbilityIds, pushEvent } from "./frames.js";

/**
 * `preThenOf`: the effects frame whose pre-"then" text this reveal is (`revealCard`; RRG 1.8 "'Then'", p. 44).
 *
 * `source` (docs/phase7-wave6.md §3.64, §4 Q35): where the reveal was initiated. By default a card dealt facedown
 * straight off an encounter deck (`CardInstance.dealtFromEncounterDeck`: villain phase step 4, "reveal the top
 * card of the encounter deck") is `encounterDeck` and anything else `elsewhere`; `revealCard` (a search, a scenario
 * deck, the set-aside area, a discard pile) passes `elsewhere` itself.
 */
export const revealFrame = (
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  preThenOf?: FrameId,
  source?: RevealSource,
): Frame<"reveal"> => ({
  ...base(ctx),
  kind: "reveal",
  instanceId: id,
  playerId,
  whenRevealedCancelled: false,
  effectsCancelled: false,
  surgeGained: false,
  revealedFrom: locateCard(ctx.state, id) ?? null,
  source: source ?? (getInstance(ctx.state, id)?.dealtFromEncounterDeck === true ? "encounterDeck" : "elsewhere"),
  ...(preThenOf ? { preThenOf } : {}),
  stage: "faceup",
});

/**
 * A villain's new face, revealed where it is (its flip, a change of form, its next stage; FAQ "Dial M for Mojo (#35)",
 * RRG 1.8 p. 64; docs/phase7-wave6.md §3.65, §4.1 Q36): the full reveal procedure, "when revealed" windows, incite,
 * When Revealed, peril and surge included, resolved by the first player as the villain's When Revealed always was.
 * Every other flip (an environment's, a main scheme stage's) is not a reveal, unless its card text says "flip … and
 * reveal" (`flipCard.reveal`, docs/phase7-wave7.md §3.14, §3.34): then the new face of that encounter card is revealed
 * the same way, by `playerId`, the player resolving the flip. Its `source` is `elsewhere`: it is revealed, but not
 * from the encounter deck (ruling Jan 26, 2026 (4) answer 2).
 */
export const revealNewFaceFrame = (
  ctx: Ctx,
  id: InstanceId,
  playerId: PlayerId = ctx.state.firstPlayerId,
): StackFrame => ({
  ...revealFrame(ctx, playerId, id, undefined, "elsewhere"),
  newFace: true,
});

/**
 * RRG 1.8 "Incite X" (p. 22): "When Revealed: place X threat on the main scheme" — printed or granted ("Each other
 * encounter card gains incite 1", Dial M for Mojo). `scheme` is the main scheme it lands on; none, or no incite, none.
 */
export function inciteFrames(ctx: Ctx, id: InstanceId, scheme: InstanceId | undefined): readonly StackFrame[] {
  const incite = keywordTotal(ctx.state, id, "incite", ctx.deps);
  if (incite <= 0 || !scheme) return [];
  return [eventFrame(ctx, { kind: "placeThreat", schemeInstanceId: scheme, amount: incite, sourceInstanceId: id })];
}

/**
 * The reveal in progress of `revealing` is replaced by the reveal of `withIds` (`EffectSpec revealCard.instead`,
 * docs/phase7-wave9.md §3.41; RRG 1.8 "Replacement Effect", p. 36). Only while that reveal waits in its "when
 * revealed" window (stage `enterPlay`: faceup, nothing resolved yet) and only once its card has left the place the
 * reveal found it: a card still there would be left faceup among the dealt encounter cards with no reveal to resolve
 * it. The frame goes to `done`, so the card stays wherever the replacing ability put it, and its record leaves
 * `revealedThisRound`: "the first card revealed each round" is the card revealed instead. False when there is nothing
 * to replace; the caller reveals the other cards only when true.
 */
export function replaceRevealInProgress(
  ctx: Ctx,
  revealing: InstanceId | null,
  withIds: readonly InstanceId[],
): boolean {
  const reveal = ctx.state.stack.find(
    (f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === revealing && f.stage === "enterPlay",
  );
  if (!reveal || withIds.length === 0 || withIds.includes(reveal.instanceId)) return false;
  if (sameZone(locateCard(ctx.state, reveal.instanceId), reveal.revealedFrom)) return false;
  const history = ctx.state.revealedThisRound ?? [];
  // Its own record is the latest one for this card and player.
  const at = history.map((r) => r.instanceId === reveal.instanceId && r.playerId === reveal.playerId).lastIndexOf(true);
  if (at >= 0) ctx.state = { ...ctx.state, revealedThisRound: history.filter((_, index) => index !== at) };
  setFrame(ctx, { ...reveal, stage: "done" });
  releaseHeld(ctx, reveal.frameId);
  emit(ctx, {
    type: "revealReplaced",
    instanceId: reveal.instanceId,
    withInstanceIds: withIds,
    playerId: reveal.playerId,
  });
  return true;
}

// Host legality is a read of the state alone (`attachment-hosts.ts`); re-exported for the resolution steps that use it.
export { attachmentHostCandidates, putIntoPlayHostCandidates, upgradeHostCandidates } from "../attachment-hosts.js";

const sameZone = (a: ZoneId | null | undefined, b: ZoneId | null | undefined): boolean =>
  a !== undefined && a !== null && b !== undefined && b !== null && JSON.stringify(a) === JSON.stringify(b);

export function pushRevealFrame(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  pushFrames(ctx, [revealFrame(ctx, playerId, id)]);
}

/**
 * Card types the reveal procedure has no step for (RRG 1.8 "Reveal", p. 38, step 2 names only encounter card types; an
 * ownerless player card brought in by an encounter effect is this engine's extension). Revealed, such a card would
 * enter play nowhere and stay where it was: from a player's dealt encounter cards, villain phase step 4 would then
 * reveal it again forever. Reaching one is a content or engine bug (a set-aside identity shuffled into the encounter
 * deck), so the reveal fails loudly, naming the card, instead of inventing a rule for it.
 */
const UNREVEALABLE: ReadonlySet<string> = new Set([
  "hero_identity",
  "resource",
  "player_side_scheme",
  "villain",
  "main_scheme",
  "evidence",
]);

/**
 * The unique rule's answer for an encounter card being revealed (RRG 1.8 "Unique Icon", pp. 45-46; the `uniqueCheck`
 * stage quotes it). With a matching card in play the card is turned away: logged `uniqueEntryBlocked`, discarded, its
 * reveal ended with nothing more of it resolving, and the player revealing it dealt a facedown encounter card. Returns
 * whether it was; false leaves everything as it was for the reveal to go on.
 */
function turnedAwayByUniqueRule(ctx: Ctx, frame: Frame<"reveal">, card: AnyCard): boolean {
  const blocker = matchingCardInPlay(ctx.state, card, new Set([frame.instanceId]), frame.playerId, ctx.deps);
  if (!blocker) return false;
  emit(ctx, {
    type: "uniqueEntryBlocked",
    instanceId: frame.instanceId,
    cardId: card.id,
    matchedInstanceId: blocker,
    disposition: "discarded",
  });
  markPreThenUnresolved(ctx, frame.preThenOf, "revealCancelled", frame.instanceId);
  moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
  setFrame(ctx, { ...frame, stage: "done" });
  // "… the player revealing it is dealt a facedown encounter card": a deal, not a reveal (the owner's decisions,
  // docs/phase7-wave9.md §4.1 Q38 = A after Q22 = B; RRG 1.8 "Deal, Deal an Encounter Card", p. 15: "This card is
  // not revealed at this time"). Like a surge's card (`resolveSurge`) it waits facedown among the player's dealt
  // encounter cards: in step three or four of the villain phase it is revealed in that same step four, after the
  // cards already waiting; anywhere else, at the next one. Announced as every deal is, and open to a "would be
  // dealt an encounter card" interrupt. Before Q38 this engine revealed it at once.
  dealEncounterCardOrAnnounce(ctx, frame.playerId, "uniqueRule", frame.instanceId);
  // Its reveal is over: what else it held opens now, the responses to its own entering play aside ("any effects of it
  // entering play are ignored").
  releaseHeld(ctx, frame.frameId, frame.instanceId);
  return true;
}

export function executeRevealFrame(ctx: Ctx, frame: Frame<"reveal">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  switch (frame.stage) {
    case "faceup": {
      if (UNREVEALABLE.has(card.type) && !frame.newFace) {
        const from = frame.revealedFrom ? JSON.stringify(frame.revealedFrom) : "nowhere";
        throw new EngineInvariantError(
          `cannot reveal ${card.id} (${card.type}, instance ${frame.instanceId}, from ${from}): not an encounter card`,
        );
      }
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, faceup: true }));
      emit(ctx, {
        type: "encounterCardRevealed",
        instanceId: frame.instanceId,
        cardId: card.id,
        playerId: frame.playerId,
      });
      // "The first … revealed each round gains surge" is read as the card is revealed, against the reveals before it
      // (docs/phase7-wave3.md §3.8); then this reveal joins the round's history.
      const surges = firstRevealGainsSurge(ctx.state, ctx.deps, frame.instanceId, frame.playerId);
      ctx.state = {
        ...ctx.state,
        revealedThisRound: [
          ...(ctx.state.revealedThisRound ?? []),
          { instanceId: frame.instanceId, playerId: frame.playerId, phase: ctx.state.step.phase },
        ],
      };
      if (surges) emit(ctx, { type: "surgeGranted", instanceId: frame.instanceId, playerId: frame.playerId });
      setFrame(ctx, { ...frame, stage: "enterPlay", ...(surges ? { surgeGained: true } : {}) });
      // The card is faceup and about to resolve: cancel effects interrupt here
      // (FFG ruling: Black Widow triggers after the flip, before its effects).
      pushEvent(ctx, {
        kind: "encounterCardRevealing",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
        ...revealedFrom(frame),
      });
      return;
    }
    case "enterPlay": {
      if (frame.newFace) {
        // Already in play: nothing enters play, and a cancelled new face is not discarded (RRG 1.8 "Cancel", p. 13,
        // discards a card that was being revealed *into* play).
        if (frame.effectsCancelled) markPreThenUnresolved(ctx, frame.preThenOf, "revealCancelled", frame.instanceId);
        setFrame(ctx, { ...frame, answer: null, stage: frame.effectsCancelled ? "finish" : "whenRevealed" });
        return;
      }
      if (frame.foundInPlay) {
        revealWhereFound(ctx, frame);
        return;
      }
      if (card.type === "obligation" && !frame.effectsCancelled) {
        // RRG "Obligation": give it to the player whose identity it belongs to; that player reveals it.
        const linked = Object.values(ctx.state.cardPool).some(
          (c) => c.type === "hero_identity" && c.obligationCardId === card.id,
        );
        const owner = ctx.state.players.find((p) => {
          const identity = cardOf(ctx.state, p.identity.instanceId);
          return identity?.type === "hero_identity" && identity.obligationCardId === card.id;
        });
        if (linked && (!owner || owner.eliminated)) {
          // Can't be given: ignore its ability, remove it from the game, reveal another card.
          moveCard(ctx, frame.instanceId, { kind: "removedFromGame" });
          setFrame(ctx, { ...frame, stage: "done" });
          const next = dealEncounterCardTo(ctx, frame.playerId, null);
          if (next) pushFrames(ctx, [revealFrame(ctx, frame.playerId, next)]);
          releaseHeld(ctx, frame.frameId);
          return;
        }
        const revealer = owner && linked ? owner.playerId : frame.playerId;
        setFrame(ctx, { ...frame, playerId: revealer, answer: null, stage: "whenRevealed" });
        enterPlayOnReveal(ctx, frame.instanceId, revealer);
        return;
      }
      if (frame.effectsCancelled) {
        // "Reveal that minion, then …": a reveal whose effects were cancelled did not fully resolve (RRG 1.8 "'Then'",
        // p. 44; "Resolve", p. 37: an ability all of whose effects are cancelled is not considered to have resolved).
        markPreThenUnresolved(ctx, frame.preThenOf, "revealCancelled", frame.instanceId);
        // RRG "Cancel": a canceled card is still revealed; it is discarded and nothing else happens.
        if (getInstance(ctx.state, frame.instanceId))
          moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
        setFrame(ctx, { ...frame, stage: "finish" });
        return;
      }
      // A unique attachment is checked before it is placed anywhere: turned away, it never attaches, so nothing hears a
      // `cardAttached` and none of its attach instruction, `cannotAttach` or When Revealed abilities resolves (RRG 1.8
      // "Unique Icon", pp. 45-46; docs/phase7-wave10.md §3.8). Unlike a minion, it has no enter-play window of its own
      // in which to clear the match first (`uniqueCheck`).
      if (card.type === "attachment" && turnedAwayByUniqueRule(ctx, frame, card)) return;
      const attachesTo = card.type === "attachment" ? card.attachesTo : undefined;
      // "If [a card] is in play, attach to [one host]. Otherwise, attach to [another]." is the card's attach
      // instruction, resolved here where a data host would be applied (RRG 1.8 "Reveal", p. 38, step 2). It is not a
      // When Revealed ability, so `whenRevealedCancelled` does not stop it (docs/phase7-wave7.md §3.35).
      const instruction =
        card.type === "attachment" && attachesTo === undefined
          ? gameAbilityFrames(ctx, frame.instanceId, ["attachInstruction"], null, undefined, frame.playerId)
          : [];
      if (instruction.length > 0) {
        setFrame(ctx, { ...frame, answer: null, stage: "attachInstruction", attachInstructed: true });
        pushFrames(ctx, instruction);
        return;
      }
      if (card.type === "attachment" && attachesTo === undefined) {
        // RRG 1.8 "Reveal" (p. 38) step 2: no "attach to" text, so it is placed in front of the revealing player (not
        // in play); its own When Revealed attaches it (ruling, Feb 20, 2026 (4)), settled at `settleAttach`.
      } else if (attachesTo && attachesTo.kind !== "villain") {
        const resolved = resolveAttachmentTarget(ctx, frame, attachesTo);
        if (!resolved) return;
      } else if (!enterPlayHeld(ctx, frame)) {
        enterPlayOnReveal(ctx, frame.instanceId, frame.playerId);
      }
      // A minion's `cardEntersPlay` frame (its engagement interrupts and enter-play keywords, toughness included)
      // resolves first, then its When Revealed like any other card's. Whom it engaged is recorded for the keywords
      // that answer the engagement once the reveal is done (`keywords`). A held minion engaged nobody.
      const engaged = card.type === "minion" ? getInstance(ctx.state, frame.instanceId)?.engagedWith : undefined;
      // A unique minion, side scheme or environment is checked once its enter-play window has resolved (below). An
      // attachment was checked above, before it attached. An obligation or a treachery does not enter play this way.
      const checksUnique = card.type === "minion" || card.type === "side_scheme" || card.type === "environment";
      setFrame(ctx, {
        ...frame,
        answer: null,
        stage: checksUnique ? "uniqueCheck" : "whenRevealed",
        ...(engaged ? { engagedPlayerId: engaged } : {}),
      });
      return;
    }
    case "uniqueCheck": {
      /*
       * RRG 1.8 "Unique Icon" (pp. 45-46): "A non-villain card in an out-of-play state that matches a card in play cannot
       * enter play. If the out-of-play card is a non-villain encounter card, it is discarded and any effects of it entering
       * play are ignored. If it was being revealed, any effects of it being revealed are ignored and the player revealing
       * it is dealt a facedown encounter card." A villain in play still blocks (FFG's Ronan the Accuser ruling): the Kree
       * Fanatic minion revealed at Ronan the Accuser's own scenario (owner, Q-M1). Putting a card into play by an effect is
       * `admitUniqueEntry`; this is the reveal's own entry.
       *
       * Read after the card's enter-play window, because the card is already in its zone while its own interrupts run
       * (`enterPlay`): a card whose "when this enters play, discard the matching card" interrupt (the Nebula nemesis
       * minion, 18026) clears the match itself and is let in.
       */
      if (!turnedAwayByUniqueRule(ctx, frame, card))
        setFrame(ctx, { ...frame, stage: frame.afterUnique ?? "whenRevealed" });
      return;
    }
    case "quickstrike": {
      /*
       * Legacy stage, kept so a game saved under the old order still loads. Until the owner's answer 30B (2026-10-12)
       * quickstrike and teamwork resolved here, before the When Revealed (ruling, Feb 28, 2026 (4) answer 2). They now
       * resolve once the reveal's steps are done (`keywords`), as RRG 1.8 "Quickstrike" (p. 36) and "Teamwork
       * (Trait)" (p. 43) say. A frame saved here had not resolved them yet: it records whom the minion engaged and
       * goes on to its When Revealed.
       */
      const { afterUnique: _legacy, ...rest } = frame;
      const engaged = frame.effectsCancelled ? undefined : getInstance(ctx.state, frame.instanceId)?.engagedWith;
      setFrame(ctx, { ...rest, stage: "whenRevealed", ...(engaged ? { engagedPlayerId: engaged } : {}) });
      return;
    }
    case "attachInstruction": {
      // The card's attach instruction has resolved. Attached, it enters play now, before its When Revealed abilities.
      if (getInstance(ctx.state, frame.instanceId)?.attachedTo) {
        enterPlay(ctx, frame.instanceId, frame.playerId);
        setFrame(ctx, { ...frame, stage: "whenRevealed" });
        return;
      }
      if (!getInstance(ctx.state, frame.instanceId)) {
        setFrame(ctx, { ...frame, stage: "whenRevealed" });
        return;
      }
      // No legal host: as a data host with none (`resolveAttachmentTarget`), its own `cannotAttach` abilities replace
      // the discard of RRG 1.8 "Attach To" (p. 8).
      const fallback = gameAbilityFrames(ctx, frame.instanceId, ["cannotAttach"], null, undefined, frame.playerId);
      if (fallback.length > 0) {
        setFrame(ctx, { ...frame, stage: "cannotAttach" });
        pushFrames(ctx, fallback);
        return;
      }
      moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
      setFrame(ctx, { ...frame, stage: "whenRevealed" });
      return;
    }
    case "cannotAttach": {
      // The card's `cannotAttach` abilities have resolved: attached by them, it enters play now; otherwise RRG 1.8
      // "Attach To" (p. 8)'s discard applies after all.
      if (getInstance(ctx.state, frame.instanceId)?.attachedTo) enterPlay(ctx, frame.instanceId, frame.playerId);
      else if (getInstance(ctx.state, frame.instanceId))
        moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
      setFrame(ctx, { ...frame, stage: "whenRevealed" });
      return;
    }
    case "whenRevealed": {
      // A new face is already attached where it was (`newFace`): nothing to settle.
      // Nor for a card its attach instruction already placed (`attachInstructed`).
      // Nor for an attachment found in play: it stays on its host (`foundInPlay`, docs/phase7-wave8.md §4.1 Q17).
      const selfAttaching =
        !frame.newFace &&
        !frame.foundInPlay &&
        !frame.attachInstructed &&
        card.type === "attachment" &&
        card.attachesTo === undefined;
      const next = selfAttaching ? "settleAttach" : "surge";
      // Incite and surge are "When Revealed" effects too (RRG "Incite X", "Surge"); surge resolves at `surge` unless
      // the players order it before a printed ability (`whenRevealedOrder`).
      if (frame.whenRevealedCancelled) {
        setFrame(ctx, { ...frame, answer: null, stage: next });
        return;
      }
      const revealed: TriggerEvent = {
        kind: "cardRevealed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
        ...revealedFrom(frame),
      };
      // RRG "Incite X" is itself a "When Revealed: place X threat on the main scheme". Its "the main scheme" is the
      // revealing player's area's, when the players are split (§3.1).
      // With a main scheme per player, the incite card's play area decides (MC60 p. 13): a minion engaged with or a
      // treachery revealed by that player, that player's; a side scheme or environment in no play area, every one
      // (docs/phase7-wave11-scenarios.md §S3.1).
      const inciteSchemes = hasPerPlayerMainSchemes(ctx.state)
        ? mainSchemesFor(ctx.state, { selfInstanceId: frame.instanceId, controllerId: frame.playerId })
        : [mainSchemeFor(ctx.state, areaOfPlayer(ctx.state, frame.playerId))?.instanceId];
      const order = whenRevealedOrder(ctx, frame, inciteSchemes);
      if (order === null) return;
      // Surge ordered last resolves where it always does, at `surge` (after a self-attaching attachment's settle, and
      // with any surge the printed text gains); ordered before a printed ability, it resolves in its place here.
      const inPass = order[order.length - 1] === SURGE_STEP ? order.slice(0, -1) : order;
      const surgeHere = inPass.includes(SURGE_STEP);
      // "Resolve each 'When Revealed' ability that you reveal 1 additional time" (Media Coverage). Incite and surge are
      // among them (RRG 1.8 "Incite X", p. 24; "Surge", p. 42), so each pass resolves them all again, in the order the
      // players chose; a surge left to the `surge` stage repeats there.
      const times = whenRevealedTimes(ctx, frame.playerId);
      const frames: StackFrame[] = [];
      for (let i = 0; i < times; i++) {
        for (const step of inPass) {
          if (step === INCITE_STEP)
            for (const scheme of inciteSchemes) frames.push(...inciteFrames(ctx, frame.instanceId, scheme));
          else if (step === SURGE_STEP)
            frames.push(
              eventFrame(ctx, { kind: "surgeResolving", instanceId: frame.instanceId, playerId: frame.playerId }),
            );
          else {
            const refs = activeAbilityRefs(ctx.state, frame.instanceId, ctx.deps).filter((ref) => ref.id === step);
            frames.push(...gameAbilityFrames(ctx, frame.instanceId, ["whenRevealed"], revealed, refs, frame.playerId));
          }
        }
      }
      setFrame(ctx, {
        ...frame,
        answer: null,
        stage: next,
        ...(frames.length > 0 ? { abilityResolved: true as const } : {}),
        ...(surgeHere ? { surgeResolved: true as const } : {}),
      });
      pushFrames(ctx, frames);
      return;
    }
    case "settleAttach": {
      // Its When Revealed attached it: it enters play now. Otherwise `finish` discards it.
      setFrame(ctx, { ...frame, stage: "surge" });
      if (getInstance(ctx.state, frame.instanceId)?.attachedTo) enterPlay(ctx, frame.instanceId, frame.playerId);
      return;
    }
    case "surge":
      resolveSurgeKeyword(ctx, frame);
      return;
    case "finish": {
      // A revealed player event (a Cosmic Entity whose effects left it where it was) is discarded like a treachery,
      // to its encounter discard pile (docs/phase7-wave4.md §3.14).
      // Only a card still where its reveal found it (docs/phase7-wave4.md §3.45): a treachery whose When Revealed
      // removed it from the game or shuffled it back into the encounter deck stays where it went.
      const here = locateCard(ctx.state, frame.instanceId);
      const unmoved =
        frame.revealedFrom === undefined ? here?.kind === "dealtEncounter" : sameZone(here, frame.revealedFrom);
      // A self-attaching attachment (no "attach to" text) its When Revealed did not attach cannot stay in front of
      // the player (RRG 1.8 "Attach To", p. 8: "If such a card cannot remain in its prior state or game area, discard
      // it"); attached, it has moved, so it is never `unmoved`.
      const discards =
        card.type === "treachery" ||
        card.type === "event" ||
        (card.type === "attachment" && card.attachesTo === undefined);
      // A new face revealed in play stays in play (`newFace`), and so does a card found in play (`foundInPlay`).
      if (discards && unmoved && !frame.newFace && !frame.foundInPlay && getInstance(ctx.state, frame.instanceId)) {
        // An attachment that found no host is discarded, and said to be: for a Labor card that is the answer of RRG 1.8
        // FAQ "Labor Cards" (p. 65), "That Labor card is discarded", and the move below then ends on the bottom of the
        // Labor deck (`noDiscardPileDeckFor`; docs/phase7-wave10-hero-packs.md H3.3, owner's question 3 = B).
        if (card.type === "attachment") {
          emit(ctx, {
            type: "revealedCardDiscarded",
            instanceId: frame.instanceId,
            cardId: card.id,
            playerId: frame.playerId,
            reason: "notAttached",
          });
        }
        // Its home deck's discard (docs/phase7-wave1.md §4.3, proposed; see `discardZoneFor`).
        moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
      }
      // Steps 1 to 4 are done (RRG 1.8 "Reveal", p. 38): the engagement keywords come next, in this same step.
      const finished: Frame<"reveal"> = { ...frame, stage: "keywords" };
      setFrame(ctx, finished);
      stepRevealKeywords(ctx, finished);
      return;
    }
    case "keywords":
      stepRevealKeywords(ctx, frame);
      return;
    case "responses":
      announceRevealFinished(ctx, frame, card);
      return;
    case "done":
      popFrame(ctx);
      return;
  }
}

/**
 * Whether `keyword` answers this reveal's engagement now. Read as the keyword resolves, never as the minion engaged
 * (the owner's answer to open point 3 of docs/phase7-wave10-q30-impact.md = A): the minion must still be in play, so
 * a When Revealed that removed it from play leaves nothing to resolve, and a keyword it gained or lost while its When
 * Revealed resolved is read as it stands. An enemy that "cannot activate" is stopped where every activation is, as
 * its event initiates (`executeEventFrame`).
 *
 * The two keywords part ways when the When Revealed moved the minion to another player (the owner's answers 36B and
 * 37A, 2026-10-12):
 * - Quickstrike answers one engagement: "After a minion with the quickstrike keyword engages a player whose identity
 *   is in hero form, that minion attacks that player" (RRG 1.8 p. 36). The reveal's engagement was with
 *   `engagedPlayerId`; a minion no longer engaged with that player has nothing left to answer here, and its new
 *   engagement had its own quickstrike where it was made (`engagedInPlayFrames`).
 * - Teamwork names no engagement, only where the minion stands as it resolves: "the minion that just entered play
 *   activates against the player it is engaged with" (RRG 1.8 "Teamwork (Trait)", p. 43). So it still resolves, against
 *   whichever player the minion is engaged with now (`teamworkActivation` reads `engagedWith` as it resolves), and
 *   not at all when it is engaged with nobody. It needs the minion to have entered play engaged by this reveal
 *   (`engagedPlayerId`) and not to have been found in play (`foundInPlay`, p. 19: "not considered to be entering
 *   play").
 */
function revealKeywordApplies(ctx: Ctx, frame: Frame<"reveal">, keyword: RevealKeyword): boolean {
  if (frame.effectsCancelled || frame.newFace || frame.engagedPlayerId === undefined) return false;
  const id = frame.instanceId;
  if (!cardsInPlay(ctx.state).includes(id)) return false;
  const engagedWith = getInstance(ctx.state, id)?.engagedWith;
  if (keyword === "quickstrike") return engagedWith === frame.engagedPlayerId && quickstrikeAttack(ctx, id) !== null;
  return engagedWith != null && !frame.foundInPlay && hasKeyword(ctx.state, id, "teamwork", ctx.deps);
}

/** The frame that resolves `keyword` for this reveal, or null when it no longer applies (`revealKeywordApplies`). */
function revealKeywordFrame(ctx: Ctx, frame: Frame<"reveal">, keyword: RevealKeyword): StackFrame | null {
  if (!revealKeywordApplies(ctx, frame, keyword)) return null;
  if (keyword === "teamwork") return teamworkFrame(ctx, frame.instanceId);
  return quickstrikeFrame(ctx, frame.instanceId);
}

const REVEAL_KEYWORDS: readonly RevealKeyword[] = ["quickstrike", "teamwork"];
const REVEAL_KEYWORD_LABELS: Readonly<Record<RevealKeyword, string>> = {
  quickstrike: "Quickstrike",
  teamwork: "Teamwork",
};

/**
 * The `keywords` stage: the keywords that answer a revealed minion's engagement, resolved once every step of its
 * reveal is done and before any response to the reveal (the owner's answers 30B and 32B, 2026-10-12).
 *
 * RRG 1.8 "Quickstrike" (p. 36): "If a minion with the quickstrike keyword is being revealed, the quickstrike keyword
 * resolves after any 'When Revealed' abilities on that minion are resolved." "Teamwork (Trait)" (p. 43) has the same
 * sentence. "Reveal" (p. 38): "Responses (both forced and non-forced) to any step of the revealing of an encounter
 * card are not resolved until after all steps of the reveal process have been completed"; both keywords are forced
 * responses to the engagement of step 2, and keywords have timing priority over the Response abilities that share
 * their trigger (FAQ "Widow's Bite (#10)", p. 60). This supersedes ruling Feb 28, 2026 (4) answer 2 ("Quickstrike
 * resolves first, followed by When Revealed") for a minion being revealed, by the owner's decision; that ruling still
 * describes a minion put into play or engaged without a reveal, where nothing stands between the engagement and the
 * keyword (`putIntoPlay`, `engagedInPlayFrames`).
 *
 * One keyword at a time: each is read as it resolves (`revealKeywordApplies`), so the second sees what the first
 * did. A minion with both, where both would do something now, asks the first player which resolves first (answer 34B;
 * RRG 1.8 "Forced", p. 20: "If two or more forced abilities would initiate at the same moment, the first player
 * determines the order"). With teamwork's condition unmet there is nothing to order: quickstrike resolves, then
 * teamwork checks its condition as it always does (`resolveTeamwork`).
 * A minion its When Revealed moved to another player has only teamwork live here (`revealKeywordApplies`), so nobody
 * is asked (answer 37A): teamwork activates it against its new player.
 *
 * Toughness held by this reveal comes first (`placeHeldToughness`).
 */
function stepRevealKeywords(ctx: Ctx, held: Frame<"reveal">): void {
  const frame = placeHeldToughness(ctx, held);
  const { keywordOrder, ...bare } = frame;
  let order = keywordOrder;
  if (order === undefined) {
    const live = REVEAL_KEYWORDS.filter((keyword) => revealKeywordApplies(ctx, frame, keyword));
    if (live.length === 2 && teamworkWouldActivate(ctx, frame.instanceId)) {
      if (!frame.answer) {
        requestChoice(ctx, {
          playerId: simultaneousOrderer(ctx.state),
          authority: "firstPlayerOrders",
          prompt: { kind: "orderKeywords", instanceId: frame.instanceId },
          options: live.map((keyword) => ({
            optionId: keyword,
            label: REVEAL_KEYWORD_LABELS[keyword],
            ref: { kind: "card", instanceId: frame.instanceId } as const,
          })),
          minSelections: live.length,
          maxSelections: live.length,
          frameId: frame.frameId,
          ordered: true,
        });
        return;
      }
      order = frame.answer.filter(
        (picked): picked is RevealKeyword => picked === "quickstrike" || picked === "teamwork",
      );
    } else order = live;
  }
  const [next, ...rest] = order;
  const after: Frame<"reveal"> =
    rest.length > 0
      ? { ...bare, answer: null, stage: "keywords", keywordOrder: rest }
      : { ...bare, answer: null, stage: "responses" };
  setFrame(ctx, after);
  if (next === undefined) {
    // Neither applies: the responses follow in this same step, as they did before the keywords had a stage.
    announceRevealFinished(ctx, after, mustCardOf(ctx.state, frame.instanceId));
    return;
  }
  const resolving = revealKeywordFrame(ctx, frame, next);
  if (resolving) pushFrames(ctx, [resolving]);
}

/**
 * `cardRevealed.from` / `encounterCardRevealing.from`: present only for a reveal that began at an encounter deck
 * (docs/phase7-wave11-scenarios.md §S3.10, §S7 E22).
 */
const revealedFrom = (frame: Frame<"reveal">): { readonly from?: "encounterDeck" } =>
  frame.source === "encounterDeck" ? { from: "encounterDeck" } : {};

/** The `responses` stage: everything that answers a finished reveal is announced. */
function announceRevealFinished(ctx: Ctx, frame: Frame<"reveal">, card: AnyCard): void {
  const { heldResponses: held = [], ...rest } = frame;
  setFrame(ctx, { ...rest, stage: "done" });
  // RRG "Reveal": responses to any step wait until every step has completed.
  // What the card's own text grants now that every step is done (docs/phase7-wave10.md §3.16), when asked.
  const granted = asksTraitGrants(ctx.deps) ? traitGrantReach(ctx.state, ctx.deps, frame.instanceId) : {};
  const events: TriggerEvent[] = [
    {
      kind: "cardRevealed",
      instanceId: frame.instanceId,
      playerId: frame.playerId,
      ...(Object.keys(granted).length > 0 ? { grantedTo: granted } : {}),
      ...revealedFrom(frame),
    },
  ];
  // "After you resolve a treachery" (`encounterCardResolved`): a treachery or event one or more of whose abilities
  // resolved, surge included (RRG 1.8 "Resolve", p. 37; FAQ "Spider-Man Noir (#15)", p. 63; the `surge` stage marks
  // `abilityResolved` for a live surge).
  const resolved = !frame.effectsCancelled && frame.abilityResolved === true;
  if (resolved && (card.type === "treachery" || card.type === "event")) {
    const where = locateCard(ctx.state, frame.instanceId)?.kind ?? null;
    const done: TriggerEvent = {
      kind: "encounterCardResolved",
      instanceId: frame.instanceId,
      playerId: frame.playerId,
      to: where,
    };
    if (heard(ctx.state, ctx.deps, done)) events.push(done);
  }
  // A revealed minion's quickstrike and teamwork have resolved (`keywords`). It engaged its player; announced after
  // its keywords (ruling, Jan 17, 2026 (3) answer 2; RRG 1.8 FAQ "Widow's Bite (#10)", p. 60).
  // A new face did not engage by its reveal (`flipToOtherFace` announces a flip that did).
  // A minion found in play engaged only if it was not already engaged with the revealing player (RRG 1.8 "Find",
  // p. 19; `engagedByReveal`).
  const engaged = frame.foundInPlay ? frame.engagedByReveal === true : !frame.newFace;
  if (!frame.effectsCancelled && engaged && card.type === "minion") events.push(...engagedEvent(ctx, frame.instanceId));
  const frames: StackFrame[] = events.map((event) => eventFrame(ctx, event));
  // Every response window triggered while the card was being revealed waited for the end of the reveal
  // (`heldResponses`; RRG 1.8 "Reveal", p. 38; owner decision 2026-10-16, audit finding 18, generalising answers 32B
  // and 35B): they share the window of the `cardRevealed` announcement, the first (answer 39A), forced ones first.
  const [announcement] = frames;
  if (announcement?.kind === "event" && held.length > 0) frames[0] = { ...announcement, joinedResponses: held };
  pushFrames(ctx, frames);
}

/** The order steps of reveal step 3 that are keywords; every other step is a printed ability's id. */
const INCITE_STEP = "incite";
const SURGE_STEP = "surge";

/**
 * The order in which reveal step 3 resolves the card's When Revealed abilities: its incite, each printed (or gained)
 * When Revealed ability by id, and its surge. Null when the first player has just been asked.
 *
 * FFG ruling, September 22, 2026 (clarifying RRG 1.8 "Surge", p. 42, and "Reveal", p. 38, step 3): "Surge, Incite, and
 * 'When Revealed' abilities each share the same timing, which allows players to resolve them in any order." Abilities
 * with the same timing that would resolve simultaneously are ordered by the first player (RRG 1.8 "Simultaneous
 * Resolution", p. 40; "Forced", p. 20: "regardless of who controls the cards bearing those abilities"), so the first
 * player is asked (`orderWhenRevealed`), as for a minion's quickstrike and teamwork (`orderKeywords`). Owner decision
 * 2026-10-20 (docs/phase7-wave11-scenarios.md §S7 E37).
 *
 * Asked only when a printed ability shares step 3 with incite or surge. Engine call where no official source answers:
 * incite and surge alone are not asked about, since neither reads what the other does (threat on the main scheme, a
 * facedown card dealt and queued), and several printed abilities with no keyword keep their printed order, as every
 * card's own same-timing abilities do in this engine. Unasked, the order is incite, the printed abilities, surge (the
 * order of the card's text box), the order the players are offered first.
 */
function whenRevealedOrder(
  ctx: Ctx,
  frame: Frame<"reveal">,
  inciteSchemes: readonly (InstanceId | undefined)[],
): readonly string[] | null {
  // One step per ability id: a pass resolves every slot carrying that id at its step (a card given the same ability
  // twice resolves it twice there), so an id offered twice would resolve its slots twice over.
  const printed = [...new Set(gameAbilityIds(ctx, frame.instanceId, ["whenRevealed"]))];
  const incite = keywordTotal(ctx.state, frame.instanceId, "incite", ctx.deps);
  const incites = incite > 0 && inciteSchemes.some((scheme) => scheme !== undefined);
  const surges =
    !frame.effectsCancelled && (frame.surgeGained || hasKeyword(ctx.state, frame.instanceId, "surge", ctx.deps));
  const offered = [...(incites ? [INCITE_STEP] : []), ...printed, ...(surges ? [SURGE_STEP] : [])];
  if (printed.length === 0 || offered.length === printed.length) return offered;
  if (frame.answer) {
    const picked = frame.answer.filter((step) => offered.includes(step));
    return picked.length === offered.length ? picked : offered;
  }
  const self = { kind: "card", instanceId: frame.instanceId } as const;
  requestChoice(ctx, {
    playerId: simultaneousOrderer(ctx.state),
    authority: "firstPlayerOrders",
    prompt: { kind: "orderWhenRevealed", instanceId: frame.instanceId },
    options: offered.map((step) =>
      step === INCITE_STEP
        ? { optionId: step, label: `Incite ${incite}`, ref: self }
        : step === SURGE_STEP
          ? { optionId: step, label: "Surge", ref: self }
          : {
              optionId: step,
              label: "When Revealed",
              ref: { kind: "ability", instanceId: frame.instanceId, abilityId: step as AbilityId },
            },
    ),
    minSelections: offered.length,
    maxSelections: offered.length,
    frameId: frame.frameId,
    ordered: true,
  });
  return null;
}

/**
 * The `surge` stage, the last of reveal step 3: the surge keyword, printed or gained, resolves as the When Revealed
 * ability it is, after the incite and the card's printed When Revealed abilities (so a "this card gains surge" they
 * resolved counts), and its card is dealt now, facedown. Revealing that card is a separate, later operation: it waits
 * in the player's queue of dealt encounter cards (`resolveSurge`, docs/phase7-wave9.md §4.1 Q22).
 *
 * RRG 1.8 "Surge" (p. 42): "The surge keyword is equivalent to the following triggered ability: 'When Revealed: Deal
 * yourself 1 facedown encounter card.' Complete the process of resolving the original card, as well as any response
 * abilities that are triggered by that card being revealed, before revealing the additional card." "Reveal" (p. 38)
 * step 3: "Resolve each 'When Revealed' ability on that card (including those provided by keywords)". So the deal is
 * part of step 3, and the responses to the reveal, which wait for every step (`heldResponses`), come after it: a
 * response that looks at, reorders or discards the top of the encounter deck can no longer change which card the
 * surge dealt (owner decision 2026-10-16, audit finding 16; before it, this engine dealt the card after the responses
 * to the reveal).
 *
 * Engine call where no official source answers: step 3 gives no order among a card's When Revealed abilities; the
 * surge comes last, after the incite and the printed ones (and after a self-attaching attachment's settle), so that
 * surge gained by the printed text ("If no enemy activated this way, this card gains surge") is dealt the same way.
 *
 * Each surge is on its own frame (`TriggerEvent surgeResolving`), where "when the surge keyword … would be resolved"
 * (Espionage) has its window. A cancelled When Revealed cancels it too (ruling Aug 3, 2026 (3): "Surge is treated as a
 * When Revealed ability and can be cancelled"). "Resolve each 'When Revealed' ability that you reveal 1 additional
 * time" (Media Coverage) resolves it again: one more card dealt, each surge on its own frame with its own window.
 */
function resolveSurgeKeyword(ctx: Ctx, frame: Frame<"reveal">): void {
  // A surge the players ordered before a printed When Revealed ability has already resolved (`whenRevealedOrder`).
  const live = !frame.effectsCancelled && !frame.whenRevealedCancelled && !frame.surgeResolved;
  const surges = live && (frame.surgeGained || hasKeyword(ctx.state, frame.instanceId, "surge", ctx.deps));
  setFrame(ctx, { ...frame, stage: "finish", ...(surges ? { abilityResolved: true as const } : {}) });
  if (!surges) return;
  const frames: StackFrame[] = [];
  for (let i = 0; i < whenRevealedTimes(ctx, frame.playerId); i++)
    frames.push(eventFrame(ctx, { kind: "surgeResolving", instanceId: frame.instanceId, playerId: frame.playerId }));
  pushFrames(ctx, frames);
}

/**
 * The tough status cards this reveal held (`Frame<"reveal">.heldToughness`): each character that entered play with
 * toughness while the card was being revealed, and is still in play, is given one now that every step of the reveal
 * is done. Toughness is "Forced Response: After this character enters play, give it a tough status card" (RRG 1.8
 * "Toughness", p. 45), held like every response to a step of the reveal (RRG 1.8 "Reveal", p. 38; owner decision
 * 2026-10-16, audit finding 18, superseding answer 33A). Returns the frame as it now stands.
 *
 * Engine call where no official source answers: it resolves first in the end-of-reveal window, before a revealed
 * minion's quickstrike and teamwork. All three are forced responses to step 2, so RRG 1.8 "Forced" (p. 20) would have
 * the first player order them; keywords have timing priority over Response abilities (FAQ "Widow's Bite (#10)",
 * p. 60), and toughness is a keyword with nothing to choose, so it is placed first rather than asked.
 */
function placeHeldToughness(ctx: Ctx, frame: Frame<"reveal">): Frame<"reveal"> {
  const { heldToughness: held, ...rest } = frame;
  if (held === undefined) return frame;
  setFrame(ctx, rest);
  for (const id of held) if (cardsInPlay(ctx.state).includes(id)) applyToughness(ctx, id);
  return rest;
}

/**
 * A reveal that ended before its last step (turned away by the unique rule, an obligation removed from the game, a
 * reveal replaced): the tough status cards and response windows it held are released now, in one window as at a
 * finished reveal's end (`announceRevealFinished`). `ignoring`: the turned-away card, whose own entering play is
 * ignored (RRG 1.8 "Unique Icon", pp. 45-46: "any effects of it entering play are ignored").
 */
function releaseHeld(ctx: Ctx, frameId: FrameId, ignoring?: InstanceId): void {
  const found = findFrame(ctx.state, frameId);
  if (found?.kind !== "reveal") return;
  const { heldResponses: held = [], ...rest } = placeHeldToughness(ctx, found);
  if (held.length === 0) return;
  setFrame(ctx, rest);
  const events = held.filter((e) => !(e.kind === "cardEntersPlay" && e.instanceId === ignoring));
  const last = events[events.length - 1];
  if (last && events.some((event) => hasCandidates(ctx.state, ctx.deps, event, "response")))
    pushWindow(ctx, last, "response", null, events.slice(0, -1));
}

/**
 * How many times each When Revealed ability `playerId` reveals resolves: once, plus each "resolve each 'When
 * Revealed' ability that you reveal 1 additional time" (Media Coverage) in play for them (`RuleSpec
 * repeatWhenRevealed`). Read as the abilities resolve, the incite and printed ones at the `whenRevealed` stage and the
 * surge at the `surge` stage (`resolveSurgeKeyword`).
 */
const whenRevealedTimes = (ctx: Ctx, playerId: PlayerId): number =>
  1 + whenRevealedRepeats(ctx.state, ctx.deps, playerId);

/**
 * The placement step of a minion revealed "and attach[ed] … here" (`EffectSpec revealCard.heldBy`, `Frame<"reveal">
 * .heldBy`; the owner's decision, docs/phase7-wave9.md §4.1 Q26 = B): it enters play held by that card
 * (`attachCard`, `isHeldMinion`) instead of engaged with the revealing player, and its entering play is announced for
 * that player as any revealed card's is, so its enter-play keywords resolve (toughness; RRG 1.8 "Enters Play", p. 18).
 * RRG 1.8 "Reveal" (p. 38) step 2 has a minion enter play "engaged with the player who revealed it"; the card's own
 * "attach … here" replaces that placement only (the Golden Rules, p. 4), and steps 3 and 4 follow as written.
 *
 * It engages no player, so everything the rules hang on an engagement has nothing to answer: `engagementOf` is null
 * (no `minionEngaged` interrupt in its enter-play window, no "after you engage" response at `finish`),
 * `quickstrikeAttack` is null (RRG 1.8 "Quickstrike", p. 36: "After a minion with the quickstrike keyword engages a
 * player whose identity is in hero form, that minion attacks that player") and so is `teamworkFrame` (p. 43).
 *
 * False, with nothing done, for a reveal with no `heldBy`, a card that is not a minion, and a minion that cannot be
 * attached there (the host left play, or cannot have it attached): the caller then places it as any revealed card.
 */
function enterPlayHeld(ctx: Ctx, frame: Frame<"reveal">): boolean {
  if (frame.heldBy === undefined || mustCardOf(ctx.state, frame.instanceId).type !== "minion") return false;
  if (!attachCard(ctx, frame.instanceId, frame.heldBy, false, true)) return false;
  enterPlay(ctx, frame.instanceId, frame.playerId);
  return true;
}

/**
 * The placement step of a card found faceup in play and revealed ("find X and reveal it"; docs/phase7-wave8.md §3.1).
 *
 * RRG 1.8 "Find" (p. 19): "If a player is instructed to 'find and reveal' a minion that is already in play, that player
 * engages that minion and resolves any keywords and/or triggered abilities that resolve as a result of that minion
 * being revealed (such as that minion's 'When Revealed' ability). That minion retains all attached cards and tokens on
 * it. That minion is not considered to be entering play. That minion is considered to engage that player unless it was
 * already engaged with that player." So the minion moves to the revealing player's play area as it is, with no
 * `cardEntersPlay` (no enter-play keywords, no unique check, no teamwork); having engaged, its quickstrike resolves
 * where a revealed minion's does, after its When Revealed (RRG 1.8 "Quickstrike", p. 36; the `keywords` stage), and
 * "after you engage" responses wait for the end of the reveal. Interrupts to the engagement get their
 * window here (RRG 1.8 "Engage", p. 18), as an in-play minion's do (`engagementFrame`).
 *
 * Ruling, June 25, 2026 (5): "Finding and revealing an attachment already in play triggers its When Revealed abilities
 * and keywords." The RRG gives the minion its one move, the engagement; nothing moves any other card, so an attachment
 * stays on its host, another player's included (the owner's decision, §4.1 Q17), and a side scheme keeps the threat it
 * has: its starting threat and hinder are placed as it enters play (RRG 1.8 "Hinder X", p. 22), and it did not.
 *
 * A reveal whose effects were cancelled does nothing here: like a new face (`newFace`), the card was not being revealed
 * into play, so RRG 1.8 "Cancel" (p. 13) has nothing to discard, and the minion does not engage.
 */
function revealWhereFound(ctx: Ctx, frame: Frame<"reveal">): void {
  if (frame.effectsCancelled) {
    markPreThenUnresolved(ctx, frame.preThenOf, "revealCancelled", frame.instanceId);
    setFrame(ctx, { ...frame, answer: null, stage: "finish" });
    return;
  }
  const engaged = engageInPlayMinion(ctx, frame.instanceId, frame.playerId);
  emit(ctx, {
    type: "revealedInPlay",
    instanceId: frame.instanceId,
    cardId: mustCardOf(ctx.state, frame.instanceId).id,
    playerId: frame.playerId,
    engaged,
  });
  if (!engaged) {
    setFrame(ctx, { ...frame, answer: null, stage: "whenRevealed" });
    return;
  }
  setFrame(ctx, {
    ...frame,
    answer: null,
    stage: "whenRevealed",
    engagedByReveal: true,
    engagedPlayerId: frame.playerId,
  });
  const engaging = engagementOf(ctx.state, frame.instanceId);
  if (engaging && hasCandidates(ctx.state, ctx.deps, engaging, "interrupt"))
    pushWindow(ctx, engaging, "interrupt", null);
}

/**
 * The surge keyword of `instanceId`, resolved by `playerId` on its own frame (`TriggerEvent surgeResolving`): deals
 * that player a facedown encounter card from the top of the encounter deck, and reveals nothing.
 *
 * RRG 1.8 "Surge" (p. 42): "When an encounter card with this keyword is revealed, the player resolving the card deals
 * themself a facedown encounter card from the top of the encounter deck. The surge keyword is equivalent to the
 * following triggered ability: 'When Revealed: Deal yourself 1 facedown encounter card.' Complete the process of
 * resolving the original card, as well as any response abilities that are triggered by that card being revealed,
 * before revealing the additional card." So it is a deal (`EncounterDealSource surge`; the owner's decision,
 * docs/phase7-wave9.md §4.1 Q19: "Surge deals an additional facedown encounter card, satisfying … 'after a player is
 * dealt an encounter card' … The response occurs when that card is dealt, not when it is subsequently revealed"),
 * announced like every other deal (`announceEncounterCardsDealt`), and one "when a player would be dealt an encounter
 * card" can interrupt (docs/phase7-wave9.md §3.45): replaced, no card is dealt.
 *
 * The card is an ordinary dealt facedown encounter card of that player from then on (the owner's decision, §4.1 Q22:
 * "Dealing a facedown encounter card is not revealing it. This should apply outside the villain phase as well."). RRG
 * 1.8 "Deal, Deal an Encounter Card" (p. 15): "This card is not revealed at this time. This card is added to the queue
 * of cards that player resolves during the villain phase. If a player is dealt an encounter card during step three or
 * four of the villain phase, the extra encounter card is added to the queue of cards that are being dealt and revealed
 * in those same steps." So a surge in step three or four is revealed in that same step four, after the cards that
 * player already had waiting ("one card at a time in the order in which they were dealt … until no dealt encounter
 * cards remain", "Villain Phase" step 4, p. 47; `executeRevealEncounterCards`), a chain of surges one card at a time
 * the same way; a surge anywhere else (the player phase, steps one and two, setup) leaves its card facedown until the
 * next step four. Before Q22 this engine revealed the card at once, in or out of the villain phase.
 */
export function resolveSurge(ctx: Ctx, instanceId: InstanceId, playerId: PlayerId): void {
  const waiting = encounterDealAwaitingInterrupt(ctx, playerId, "surge", instanceId);
  if (waiting) pushEvent(ctx, waiting);
  else dealSurgeCard(ctx, instanceId, playerId);
}

/** Deals the surge keyword's card to `playerId` now (`resolveSurge`); it waits facedown. Null with no card to deal. */
function dealSurgeCard(ctx: Ctx, instanceId: InstanceId, playerId: PlayerId): InstanceId | null {
  const next = dealEncounterCardTo(ctx, playerId, "surge");
  if (next) emit(ctx, { type: "surgeTriggered", instanceId, playerId });
  return next;
}

/**
 * An `encounterCardBeingDealt` whose interrupts have resolved (docs/phase7-wave9.md §3.45): the top card of the
 * encounter deck is dealt now, as every deal is (`dealEncounterCardTo`, so `encounterCardDealt` follows when an
 * ability listens), the surge keyword's card included (`resolveSurge`).
 */
export function applyEncounterCardBeingDealt(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "encounterCardBeingDealt" }>,
): void {
  if (event.source === "surge" && event.sourceInstanceId !== null)
    dealSurgeCard(ctx, event.sourceInstanceId, event.playerId);
  else dealEncounterCardTo(ctx, event.playerId, event.source);
}

/**
 * A card entering play where its type goes, with what it enters play with: the placement step of a reveal, and the
 * whole of an entry with no reveal (`putIntoPlay`, the setup steps), which therefore resolves no When Revealed, surge
 * or incite (RRG 1.8 "When Revealed Abilities", p. 48: an encounter card "put into play without being revealed" does
 * not trigger its When Revealed).
 */
export function enterPlayOnReveal(ctx: Ctx, id: InstanceId, playerId: PlayerId): void {
  const card = mustCardOf(ctx.state, id);
  let entered = false;
  switch (card.type) {
    case "minion":
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: playerId, controllerId: null }));
      entered = true;
      break;
    case "side_scheme":
      moveCard(ctx, id, { kind: "villainArea" });
      // With separate game areas, a side scheme enters the revealing player's area (docs/phase7-wave2.md §3.1).
      assignToArea(ctx, id, playerId);
      entered = true;
      // RRG 1.8 "Hinder X" (p. 22): "enters play with X threat on it", "in addition to any threat it normally enters
      // play with, such as a side scheme's starting threat" — one placement, however the scheme entered play
      // (docs/phase7-wave3.md §3.3).
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId: id,
        amount: schemeEntryThreat(ctx, id),
        sourceInstanceId: null,
        entering: true,
      });
      break;
    case "environment":
      // "They place that card in front of them in their play area" (Spell environments; docs/phase7-wave4.md §3.16).
      if (entersRevealersPlayArea(ctx.state, ctx.deps, id)) {
        moveCard(ctx, id, { kind: "playArea", playerId });
        updateInstance(ctx, id, (i) => ({ ...i, controllerId: null }));
      } else moveCard(ctx, id, { kind: "villainArea" });
      entered = true;
      break;
    case "attachment": {
      // Setup-keyword attachments enter play without a reveal frame, so there is
      // no choice point: the first legal host in stable order is used.
      const context: EffectContext = {
        selfInstanceId: id,
        controllerId: playerId,
        event: null,
        bindings: {},
        deps: ctx.deps,
      };
      // A card with no "attach to" text has no host here: only its own When Revealed attaches it (RRG 1.8 "Reveal",
      // p. 38), so entering play any other way discards it (RRG 1.8 "Attach To", p. 8).
      const [host] = card.attachesTo ? attachmentHostCandidates(ctx.state, card.attachesTo, context) : [];
      if (!host) {
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
        break;
      }
      // Attached and announced now, or after a "would be attached" interrupt (docs/phase7-wave9.md §3.49).
      placeAttachment(ctx, id, host, playerId);
      break;
    }
    case "obligation":
      moveCard(ctx, id, { kind: "playArea", playerId });
      entered = true;
      break;
    /**
     * A player-typed support with no owner (`putIntoPlay`'s own "encounter cards other than minions" reading also
     * catches an ownerless player card, docs/phase7-wave3.md's `gmw` Milano, 16142: "Permanent. Setup." — a
     * `specificTo: { kind: "scenario" }` support nobody's deck ever holds). It needs a play area to sit in like any
     * other card; `playerId` is only its initial home; `RuleSpec controlledByFirstPlayer` (already declared by its
     * own constant ability) reassigns control on the very next state-trigger sweep if that isn't the first player.
     * An ownerless ally or upgrade is the same case: MC21's campaign puts Cosmo (21180b) and Odin (21139a) "into play
     * under the first player's control" (MC21 p. 17, p. 25) from the set-aside cards, where nobody owns them.
     *
     * The player it enters play under also becomes its owner, as `takeIntoHand` does: RRG 1.8 "Ownership and
     * Control" (p. 31), "When a player takes control of a campaign-specific or scenario-specific player card …, that
     * player becomes the owner of that card until the game ends or another player takes control of that card." So it
     * leaves play to that player's discard pile, not the encounter discard pile. MC27's Venom (190), Helicarrier and
     * Symbiote Suit, brought in from outside the game by a campaign (`CampaignOp` `setAsideCards`), read the same way.
     *
     * A card with an encounter back (`BaseCard.cardBack`: Longshot, `mojo` 39071, revealed from the encounter deck)
     * changes control only: the same rule's "with a player card back" leaves the scenario its owner, so it keeps its
     * encounter home and leaves play to the encounter discard pile, from where it can be revealed again
     * (docs/phase7-wave6.md §3.71, §4 Q41). A campaign that makes such a card a player's for the game gives it an owner
     * before it gets here (`moveCards.assignOwnerTo`, §4 Q14), and an owned card keeps its owner.
     */
    case "support":
    case "ally":
    case "upgrade":
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({ ...i, controllerId: playerId }));
      if (getInstance(ctx.state, id)?.ownerId === null && cardBackOf(card) === "player") {
        updateInstance(ctx, id, (i) => ({ ...i, ownerId: playerId, home: { kind: "player" } }));
        emit(ctx, { type: "ownershipChanged", instanceId: id, playerId });
      }
      entered = true;
      break;
    // One nobody owns, put into play by the scenario: no player controls it (docs/phase7-wave7.md §4.1 Q24). It is
    // never revealed (`UNREVEALABLE`); it gets here from `putIntoPlay` and the setup steps.
    case "player_side_scheme":
      playerSideSchemeEntersPlay(ctx, id, null);
      break;
    default:
      break;
  }
  if (entered) enterPlay(ctx, id, playerId);
}

/** Makes a side scheme part of `playerId`'s game area, when the players are split. */
export function assignToArea(ctx: Ctx, id: InstanceId, playerId: PlayerId): void {
  const area = areaOfPlayer(ctx.state, playerId);
  if (!area || area.sideSchemeIds.includes(id)) return;
  ctx.state = {
    ...ctx.state,
    gameAreas: ctx.state.gameAreas.map((a) =>
      a.areaId === area.areaId
        ? { ...a, sideSchemeIds: [...a.sideSchemeIds, id] }
        : { ...a, sideSchemeIds: a.sideSchemeIds.filter((s) => s !== id) },
    ),
  };
}

/** Returns false while a target choice is pending. */
function resolveAttachmentTarget(ctx: Ctx, frame: Frame<"reveal">, attachesTo: AttachmentHost): boolean {
  const context: EffectContext = {
    selfInstanceId: frame.instanceId,
    controllerId: frame.playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  const legal = attachmentHostCandidates(ctx.state, attachesTo, context);
  if (legal.length === 0) {
    // "If you cannot, …": the card's own `cannotAttach` abilities replace the discard; the `cannotAttach` stage then
    // settles where the card ended up.
    const fallback = gameAbilityFrames(ctx, frame.instanceId, ["cannotAttach"], null, undefined, frame.playerId);
    if (fallback.length > 0) {
      setFrame(ctx, { ...frame, answer: null, stage: "cannotAttach" });
      pushFrames(ctx, fallback);
      return false;
    }
    // RRG "Attach To": a card that cannot legally attach and cannot stay where it was is discarded.
    moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
    return true;
  }
  if (frame.answer) {
    const [picked] = frame.answer;
    const host = picked ? asInstanceId(picked) : legal[0];
    if (!host) return true;
    placeAttachment(ctx, frame.instanceId, host, frame.playerId);
    return true;
  }
  if (legal.length === 1) {
    const host = legal[0] as InstanceId;
    placeAttachment(ctx, frame.instanceId, host, frame.playerId);
    return true;
  }
  // RRG "First Player": an encounter card with several eligible targets — the
  // first player selects (not the revealing player).
  // A host the card's text leaves to "the enemy team" (`AttachmentCard.hostChosenBy`; MC56 p. 6) is asked of that
  // team's decider with the `enemyTeam` authority, as a scripted `chooser: enemyTeamDecider` choice is. The legal hosts
  // are the same either way. A reveal read for no team has no such decider and falls back to the first player's rule.
  const card = cardOf(ctx.state, frame.instanceId);
  const enemyTeam = card?.type === "attachment" && card.hostChosenBy === "enemyTeam";
  const decider = enemyTeam ? enemyTeamDecider(ctx.state, context) : null;
  requestChoice(ctx, {
    playerId: decider ?? encounterTargetSelector(ctx.state),
    authority: decider ? "enemyTeam" : "firstPlayerTargets",
    prompt: { kind: "chooseAttachmentTarget", instanceId: frame.instanceId },
    options: legal.map((id) => ({
      optionId: id,
      label: displayNameOf(ctx.state, id),
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
  return false;
}
