/** Revealing encounter cards and placing them (attachment hosts included). */

import type { AttachmentHost } from "@mc/content";
import { type Ctx, emit, moveCard, popFrame, pushFrames, requestChoice, setFrame, updateInstance } from "../ctx.js";
import { dealEncounterCardTo } from "../effects.js";
import { type FrameId, type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import {
  activeVillainIdFor,
  villainOf,
  cardOf,
  characterProfile,
  currentName,
  discardZoneFor,
  getInstance,
  getPlayer,
  locateCard,
  mustCardOf,
  mustInstance,
  printedProfile,
  remainingHitPoints,
  startingThreatOf,
  undefeatedVillains,
  areaOfPlayer,
  mainSchemeFor,
  cardBackOf,
} from "../query.js";
import { cardsInPlay, contextArea, controllerOf, type EffectContext, selectTargets, traitsOf } from "../select.js";
import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import type { TargetQuery } from "../spec.js";
import type { RevealSource, StackFrame } from "../stack.js";
import type { GameState, ZoneId } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import {
  attachLimitFault,
  canHaveAttached,
  entersRevealersPlayArea,
  firstRevealGainsSurge,
  whenRevealedRepeats,
} from "../rules.js";
import { encounterTargetSelector } from "../villain/authority.js";
import { EngineInvariantError } from "../errors.js";
import { engagedEvent } from "./apply-effect.js";
import { enterPlay, quickstrikeAttack, teamworkFrame } from "./enter-play.js";
import { heard } from "./triggers.js";
import { markPreThenUnresolved } from "./then.js";
import { base, eventFrame, type Frame, gameAbilityFrames, pushEvent } from "./frames.js";

/**
 * `preThenOf`: the effects frame whose pre-"then" text this reveal is (`revealCard`; RRG 1.8 "'Then'", p. 44).
 *
 * `source` (docs/phase7-wave6.md §3.64, §4 Q35): where the reveal was initiated. By default a card dealt facedown
 * straight off an encounter deck (`CardInstance.dealtFromEncounterDeck`: villain phase step 4, surge, "reveal the top
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
 * Every other flip (an environment's, a main scheme stage's) is not a reveal.
 */
export const revealNewFaceFrame = (ctx: Ctx, id: InstanceId): StackFrame => ({
  ...revealFrame(ctx, ctx.state.firstPlayerId, id, undefined, "elsewhere"),
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

const sameZone = (a: ZoneId | null | undefined, b: ZoneId | null | undefined): boolean =>
  a !== undefined && a !== null && b !== undefined && b !== null && JSON.stringify(a) === JSON.stringify(b);

export function pushRevealFrame(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  pushFrames(ctx, [revealFrame(ctx, playerId, id)]);
}

const HOST_QUERIES: Partial<Record<AttachmentHost["kind"], TargetQuery>> = {
  sideScheme: { categories: ["sideScheme"] },
  scheme: { categories: ["scheme"] },
  hero: { categories: ["hero"] },
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  anyCharacter: { categories: ["character"] },
};

type QualifiedHost = Extract<AttachmentHost, { kind: "qualified" }>;
type SuperlativeHost = Extract<AttachmentHost, { kind: "superlative" }>;

/** The pool a `qualified` or `superlative` host ranks among; `friendlyCharacter` is narrowed by `isFriendly`. */
const POOL_QUERIES: Record<QualifiedHost["category"] | SuperlativeHost["among"], TargetQuery> = {
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  villain: { categories: ["villain"] },
  character: { categories: ["character"] },
  friendlyCharacter: { categories: ["character"] },
  sideScheme: { categories: ["sideScheme"] },
};

/** "The villain" for this context: the active villain, or the context's game area's (docs/phase7-wave2.md §3.1). */
function theVillain(state: GameState, context: EffectContext): readonly InstanceId[] {
  const id = activeVillainIdFor(state, contextArea(state, context));
  const villain = id ? villainOf(state, id) : undefined;
  return villain && !villain.defeated ? [villain.instanceId] : [];
}

/** RRG 1.8 "Friendly" (p. 21): "cards the players control". */
const isFriendly = (state: GameState, id: InstanceId): boolean => controllerOf(state, id) !== null;

const printedHpOf = (state: GameState, id: InstanceId): number => printedProfile(state, id)?.maxHp ?? 0;

/** What a `superlative` host ranks by (RRG 1.8 "Printed", p. 35, for the printed values). */
function hostMeasure(state: GameState, id: InstanceId, measure: SuperlativeHost["measure"], deps: EngineDeps): number {
  switch (measure) {
    case "printedHp":
      return printedHpOf(state, id);
    case "remainingHp":
      return remainingHitPoints(state, id, deps) ?? 0;
    case "printedAtk":
      return printedProfile(state, id)?.atk ?? 0;
    case "atk":
      return characterProfile(state, id, deps)?.atk ?? 0;
    case "thw":
      // "The ally with the lowest THW" (Possessed): the current value, like `atk`/`sch` beside it.
      return characterProfile(state, id, deps)?.thw ?? 0;
    case "sch":
      return characterProfile(state, id, deps)?.sch ?? 0;
    case "activationOrder": {
      // The Sinister Six's printed "Activation Order N" (`VillainCard.activationOrder`); `superlative` drops a villain
      // without one before ranking, so this 0 is never compared.
      const card = cardOf(state, id);
      return card?.type === "villain" ? (card.activationOrder ?? 0) : 0;
    }
    case "traitCount":
      // "The minion with the most traits" (Cyborg Tech): printed and gained traits (RRG 1.8 "Gains"), each counted once.
      return new Set(traitsOf(state, id, deps)).size;
    case "printedCost": {
      // "The ally with the highest cost" (Beguiled, 'Pool-ized): the printed cost (RRG 1.8 "Printed", p. 35). A card
      // in play has no other cost — cost modifiers change what a card costs to *play*. Cards with none are dropped
      // by `hasMeasure` before ranking, so this 0 is never compared.
      const card = cardOf(state, id);
      return card && "cost" in card && typeof card.cost === "number" ? card.cost : 0;
    }
  }
}

/** Whether a card has a value for this measure at all (a villain with no printed activation order has none). */
function hasMeasure(state: GameState, id: InstanceId, measure: SuperlativeHost["measure"]): boolean {
  const card = cardOf(state, id);
  if (measure === "printedCost") return card !== undefined && "cost" in card && typeof card.cost === "number";
  if (measure !== "activationOrder") return true;
  return card?.type === "villain" && card.activationOrder !== undefined;
}

/** "an X-MEN ally", "a non-ELITE minion", "without another Goblin Glider attached" (`HostQualifiers`). */
function passesQualifiers(
  state: GameState,
  id: InstanceId,
  host: QualifiedHost | SuperlativeHost,
  deps: EngineDeps,
  context: EffectContext,
): boolean {
  // "The ally you control" (Manipulated Mind): on an encounter card "you" is the revealing player, on a player card its
  // controller (RRG 1.8 "You, Your", p. 46) — the context's controller either way. Nobody to be "you" matches nothing.
  if (host.controlledBy === "you" && (!context.controllerId || controllerOf(state, id) !== context.controllerId))
    return false;
  if (host.trait && !traitsOf(state, id, deps).includes(host.trait)) return false;
  if (host.withoutTrait && traitsOf(state, id, deps).includes(host.withoutTrait)) return false;
  const barred = host.withoutAttachmentNamed;
  if (barred !== undefined && mustInstance(state, id).attachments.some((a) => currentName(state, a) === barred))
    return false;
  // "a non-permanent side scheme" (docs/phase7-wave2.md §6.5): printed or gained keywords.
  if (host.keyword !== undefined && !hasKeyword(state, id, host.keyword, deps)) return false;
  if (host.withoutKeyword !== undefined && hasKeyword(state, id, host.withoutKeyword, deps)) return false;
  // "a character with 'Spider' in its title" (Warrior of the Great Web): the title showing, not the subtitle beneath
  // it (RRG 1.8 "Subtitle", p. 41) — `currentName` is the same face `namedCard` compares against.
  if (host.titleContains !== undefined && !(currentName(state, id) ?? "").includes(host.titleContains)) return false;
  // "an enemy that X-23 or Honey Badger attacked this turn" (docs/phase7-wave2.md §11.3, §14): the attacks recorded
  // against this card this turn, matched by the title each attacker showed *when it attacked* (RRG 1.8 "Referential
  // Ability", p. 36), so a hero who attacked and then changed form still counts.
  if (host.attackedThisTurnBy !== undefined) {
    const attacks = state.attackedThisTurn[id] ?? [];
    const titles = host.attackedThisTurnBy;
    if (!attacks.some((attack) => titles.includes(attack.attackerTitle))) return false;
  }
  return true;
}

/**
 * Every legal host for an attachment right now, in stable order (docs/phase7-wave1.md §1.6, §3.14).
 *
 * RRG 1.8 "Attach To" (p. 8): "The 'attach to' phrase is checked for legality when the card would be attached", so
 * this is evaluated at that moment and never cached. An empty result means the card cannot attach and is discarded
 * by the caller — with no replacement card revealed (FAQ "Counterspell (#30)", p. 60: "Because it is unable to meet
 * its condition, simply discard it. (Do not reveal a new encounter card in its place.)").
 *
 * Several candidates are a choice for the first player on an encounter card (RRG 1.8 "First Player", p. 19); the
 * superlative kinds return every tied card for that reason.
 */
export function attachmentHostCandidates(
  state: GameState,
  host: AttachmentHost,
  context: EffectContext,
  { ignoreAttachLimits = false }: { readonly ignoreAttachLimits?: boolean } = {},
): readonly InstanceId[] {
  // "Odin cannot have cards attached" (`cannotHaveAttachments`, docs/phase7-wave4.md §3.8): never a legal host. A host
  // already at the card's own "Max 1 per ally" / "Max 1 TRAINING upgrade per ally" is not one either (wave 6 §3.28),
  // unless the caller reports that maximum itself (`legalActions` lists such a host as blocked, with its reason).
  const deps = context.deps ?? DEFAULT_DEPS;
  return rawHostCandidates(state, host, context).filter(
    (id) =>
      canHaveAttached(state, deps, id, context.selfInstanceId) &&
      (ignoreAttachLimits || attachLimitFault(state, deps, id, context.selfInstanceId) === null),
  );
}

function rawHostCandidates(state: GameState, host: AttachmentHost, context: EffectContext): readonly InstanceId[] {
  const deps = context.deps ?? DEFAULT_DEPS;
  switch (host.kind) {
    case "villain":
      // "Attach to the villain": the active villain (The Wrecking Crew insert, "The Active Villain"), the area's own
      // with separate game areas (docs/phase7-wave2.md §3.1).
      return theVillain(state, context);
    case "namedVillain":
      // "Attach to Wrecker": by the title showing, so a flipped villain is found under its current face's name.
      return undefeatedVillains(state)
        .filter((villain) => currentName(state, villain.instanceId) === host.name)
        .map((villain) => villain.instanceId);
    case "mainScheme": {
      // The main scheme of the revealing player's area when the players are split (docs/phase7-wave2.md §3.1).
      const scheme = mainSchemeFor(state, contextArea(state, context));
      return scheme ? [scheme.instanceId] : [];
    }
    case "villainSideScheme": {
      // "Attach to the active villain's side scheme" (Held Hostage), or a named villain's.
      const of = host.of;
      const villains =
        of === "activeVillain"
          ? undefeatedVillains(state).filter((villain) => villain.instanceId === state.activeVillainId)
          : undefeatedVillains(state).filter((villain) => currentName(state, villain.instanceId) === of.villainName);
      const inPlay = cardsInPlay(state);
      return villains.flatMap((villain) =>
        villain.signatureSideSchemeId && inPlay.includes(villain.signatureSideSchemeId)
          ? [villain.signatureSideSchemeId]
          : [],
      );
    }
    case "yourIdentity": {
      // RRG 1.8 "You, Your": on an encounter card, the player resolving it. An identity not in the named form is no
      // legal host, so the card is discarded (FAQ "Counterspell (#30)", p. 60).
      const playerId = context.controllerId;
      const player = playerId ? getPlayer(state, playerId) : undefined;
      if (!player || player.eliminated) return [];
      if (host.form !== undefined && player.identity.form !== host.form) return [];
      // "Attach to your identity if a copy of Targeted for Elimination is not attached to you" (docs/phase7-wave6.md
      // §1.3): checked by the title each attachment shows, as for the `qualified` host's qualifier.
      const barred = host.withoutAttachmentNamed;
      const identity = player.identity.instanceId;
      if (
        barred !== undefined &&
        mustInstance(state, identity).attachments.some((a) => currentName(state, a) === barred)
      )
        return [];
      return [identity];
    }
    case "friendlyCharacter":
      return selectTargets(state, { categories: ["character"] }, context).filter((id) => isFriendly(state, id));
    case "namedCard":
      return selectTargets(state, { name: host.name }, context);
    case "qualified": {
      const pool = selectTargets(state, POOL_QUERIES[host.category], context).filter(
        (id) => host.category !== "friendlyCharacter" || isFriendly(state, id),
      );
      return pool.filter((id) => passesQualifiers(state, id, host, deps, context));
    }
    case "minionWithHighestPrintedHp": {
      const minions = selectTargets(state, { categories: ["minion"] }, context).filter(
        (id) =>
          host.withoutAttachmentNamed === undefined ||
          !mustInstance(state, id).attachments.some((a) => currentName(state, a) === host.withoutAttachmentNamed),
      );
      const highest = Math.max(...minions.map((id) => printedHpOf(state, id)));
      return minions.filter((id) => printedHpOf(state, id) === highest);
    }
    case "superlative": {
      // "The enemy with the highest printed hit points and without another Goblin Glider attached."
      const pool = selectTargets(state, POOL_QUERIES[host.among], context)
        .filter((id) => host.among !== "friendlyCharacter" || isFriendly(state, id))
        .filter((id) => passesQualifiers(state, id, host, deps, context))
        .filter((id) => hasMeasure(state, id, host.measure));
      if (pool.length === 0) return [];
      const values = pool.map((id) => hostMeasure(state, id, host.measure, deps));
      const best = host.order === "highest" ? Math.max(...values) : Math.min(...values);
      return pool.filter((_, index) => values[index] === best);
    }
    case "ifAble": {
      // "Attach to Yellowjacket, if able. If you cannot, attach to the villain." (docs/phase7-wave2.md §1.7). The
      // fallback is only considered when the preferred host has no legal candidate at this moment (RRG 1.8 "Attach
      // To", p. 8).
      const preferred = attachmentHostCandidates(state, host.preferred, context);
      return preferred.length > 0 ? preferred : attachmentHostCandidates(state, host.otherwise, context);
    }
    case "anyOf": {
      // "Attach to an enemy or scheme." / "Attach to Greycrow or Harpoon." (docs/phase7-wave2.md §6.6): every host any
      // part names, each once, in the order listed.
      const all = host.hosts.flatMap((part) => attachmentHostCandidates(state, part, context));
      return [...new Set(all)];
    }
    case "leader": {
      // Cooperative play only (the Civil War rulebook, p. 6): "The leader in play is called 'the enemy leader.'", so the
      // enemy leader is the villain; "A card ability that refers to 'your leader' cannot be resolved." (competitive mode,
      // where a team has a leader of its own, is not built). Ruling, Jul 9, 2026 (3) answer 2.
      if (host.of === "yours") return [];
      return theVillain(state, context);
    }
    case "encounterCard":
      // "Attach to an encounter card in play." (Coordinated Effort): every in-play card on the encounter side,
      // whatever its type. RRG 1.8 "Encounter Card" (p. 18); an encounter card has no controller, which is the same
      // test `isFriendly` inverts.
      return selectTargets(state, {}, context).filter((id) => !isFriendly(state, id));
    case "nonActiveVillain":
      // "Attach to the villain who is not the active villain." (Direct Assault): several are a first-player choice.
      return undefeatedVillains(state)
        .filter((villain) => villain.instanceId !== state.activeVillainId)
        .map((villain) => villain.instanceId);
    default: {
      const query = HOST_QUERIES[host.kind];
      return query ? selectTargets(state, query, context) : [];
    }
  }
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
      pushEvent(ctx, { kind: "encounterCardRevealing", instanceId: frame.instanceId, playerId: frame.playerId });
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
          const next = dealEncounterCardTo(ctx, frame.playerId);
          if (next) pushFrames(ctx, [revealFrame(ctx, frame.playerId, next)]);
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
      const attachesTo = card.type === "attachment" ? card.attachesTo : undefined;
      if (card.type === "attachment" && attachesTo === undefined) {
        // RRG 1.8 "Reveal" (p. 38) step 2: no "attach to" text, so it is placed in front of the revealing player (not
        // in play); its own When Revealed attaches it (ruling, Feb 20, 2026 (4)), settled at `settleAttach`.
      } else if (attachesTo && attachesTo.kind !== "villain") {
        const resolved = resolveAttachmentTarget(ctx, frame, attachesTo);
        if (!resolved) return;
      } else {
        enterPlayOnReveal(ctx, frame.instanceId, frame.playerId);
      }
      // A minion's `cardEntersPlay` frame (its engagement interrupts and enter-play keywords) resolves first, then its
      // quickstrike stage (quickstrike, then teamwork).
      setFrame(ctx, { ...frame, answer: null, stage: card.type === "minion" ? "quickstrike" : "whenRevealed" });
      return;
    }
    case "quickstrike": {
      /*
       * Ruling, Feb 28, 2026 (4) answer 2: "A minion engages the player first, then resolves When Revealed. Because
       * Quickstrike triggers upon engagement, Quickstrike resolves first, followed by When Revealed."
       *
       * CONFLICT: RRG 1.8 "Quickstrike" (p. 36) says "If a minion with the quickstrike keyword is being revealed, the
       * quickstrike keyword resolves after any 'When Revealed' abilities on that minion are resolved", and "Reveal"
       * (p. 38) holds responses to any reveal step until every step is done. The ruling is FFG's later word, so it
       * wins for quickstrike only. "After you engage a minion" responses (Widow's Bite, Have at Thee) still wait for
       * the end of the reveal (`finish`): the ruling moves the keyword, which has timing priority over them (RRG 1.8
       * FAQ "Widow's Bite"; ruling, Jan 17, 2026 (3) answer 2), so they keep their place after it.
       *
       * Teamwork (trait) has the same RRG wording (p. 43: "resolves after any 'When Revealed' abilities") and no ruling
       * of its own. The user ruled it the quickstrike way (docs/phase7-wave6.md §4.1 Q2): it also triggers upon
       * engagement, so it resolves here, after quickstrike and before the When Revealed. Its condition is checked as it
       * resolves (`resolveTeamwork`).
       */
      setFrame(ctx, { ...frame, stage: "whenRevealed" });
      if (frame.effectsCancelled) return;
      const quickstrike = quickstrikeAttack(ctx.state, frame.instanceId);
      const teamwork = teamworkFrame(ctx, frame.instanceId);
      const keywords = [...(quickstrike ? [eventFrame(ctx, quickstrike)] : []), ...(teamwork ? [teamwork] : [])];
      if (keywords.length > 0) pushFrames(ctx, keywords);
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
      const selfAttaching = card.type === "attachment" && card.attachesTo === undefined;
      const next = selfAttaching ? "settleAttach" : "finish";
      setFrame(ctx, { ...frame, stage: next });
      // Incite and surge are "When Revealed" effects too (RRG "Incite X", "Surge").
      if (frame.whenRevealedCancelled) return;
      const revealed: TriggerEvent = {
        kind: "cardRevealed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
      };
      // RRG "Incite X" is itself a "When Revealed: place X threat on the main scheme". Its "the main scheme" is the
      // revealing player's area's, when the players are split (§3.1).
      const inciteScheme = mainSchemeFor(ctx.state, areaOfPlayer(ctx.state, frame.playerId))?.instanceId;
      const frames: StackFrame[] = [...inciteFrames(ctx, frame.instanceId, inciteScheme)];
      // "Resolve each 'When Revealed' ability that you reveal 1 additional time" (Media Coverage).
      const times = 1 + whenRevealedRepeats(ctx.state, ctx.deps, frame.playerId);
      for (let i = 0; i < times; i++) {
        frames.push(...gameAbilityFrames(ctx, frame.instanceId, ["whenRevealed"], revealed, undefined, frame.playerId));
      }
      if (frames.length > 0) setFrame(ctx, { ...frame, stage: next, abilityResolved: true });
      pushFrames(ctx, frames);
      return;
    }
    case "settleAttach": {
      // Its When Revealed attached it: it enters play now. Otherwise `finish` discards it.
      setFrame(ctx, { ...frame, stage: "finish" });
      if (getInstance(ctx.state, frame.instanceId)?.attachedTo) enterPlay(ctx, frame.instanceId, frame.playerId);
      return;
    }
    case "finish": {
      setFrame(ctx, { ...frame, stage: "done" });
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
      if (discards && unmoved && getInstance(ctx.state, frame.instanceId)) {
        // Its home deck's discard (docs/phase7-wave1.md §4.3, proposed; see `discardZoneFor`).
        moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
      }
      // RRG "Reveal": responses to any step wait until every step has completed.
      const events: TriggerEvent[] = [{ kind: "cardRevealed", instanceId: frame.instanceId, playerId: frame.playerId }];
      const surgeLive = !frame.effectsCancelled && !frame.whenRevealedCancelled;
      const surges = surgeLive && (frame.surgeGained || hasKeyword(ctx.state, frame.instanceId, "surge", ctx.deps));
      // "After you resolve a treachery" (`encounterCardResolved`): a treachery or event one or more of whose abilities
      // resolved, surge included (RRG 1.8 "Resolve", p. 37; FAQ "Spider-Man Noir (#15)", p. 63).
      const resolved = !frame.effectsCancelled && (frame.abilityResolved === true || surges);
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
      // A revealed minion's quickstrike resolved at the `quickstrike` stage, before its When Revealed (ruling, Feb 28,
      // 2026 (4) answer 2). It engaged its player; announced after its keywords (ruling, Jan 17, 2026 (3) answer 2).
      if (!frame.effectsCancelled && card.type === "minion") events.push(...engagedEvent(ctx, frame.instanceId));
      const frames: StackFrame[] = events.map((event) => eventFrame(ctx, event));
      // RRG "Surge": the original card is fully resolved first, then the same
      // player reveals one more — so the extra reveal is queued last.
      if (surges) {
        const surge: TriggerEvent = { kind: "surgeResolving", instanceId: frame.instanceId, playerId: frame.playerId };
        if (heard(ctx.state, ctx.deps, surge)) {
          // "When the surge keyword … would be resolved" (Espionage): its windows first, then `resolveSurge`.
          frames.push(eventFrame(ctx, surge));
        } else {
          const next = dealEncounterCardTo(ctx, frame.playerId);
          if (next) {
            emit(ctx, { type: "surgeTriggered", instanceId: frame.instanceId, playerId: frame.playerId });
            frames.push(revealFrame(ctx, frame.playerId, next));
          }
        }
      }
      pushFrames(ctx, frames);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

/** RRG 1.8 "Surge" (p. 42): the player resolving the card deals themself another encounter card, then reveals it. */
export function resolveSurge(ctx: Ctx, instanceId: InstanceId, playerId: PlayerId): void {
  const next = dealEncounterCardTo(ctx, playerId);
  if (!next) return;
  emit(ctx, { type: "surgeTriggered", instanceId, playerId });
  pushFrames(ctx, [revealFrame(ctx, playerId, next)]);
}

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
        amount: startingThreatOf(ctx.state, id, ctx.deps) + keywordTotal(ctx.state, id, "hinder", ctx.deps),
        sourceInstanceId: null,
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
      moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
      entered = true;
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
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  if (legal.length === 1) {
    const host = legal[0] as InstanceId;
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  // RRG "First Player": an encounter card with several eligible targets — the
  // first player selects (not the revealing player).
  requestChoice(ctx, {
    playerId: encounterTargetSelector(ctx.state),
    authority: "firstPlayerTargets",
    prompt: { kind: "chooseAttachmentTarget", instanceId: frame.instanceId },
    options: legal.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
  return false;
}
