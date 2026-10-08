/**
 * What the board highlights, read straight off the engine's `legalActions`.
 *
 * The client never decides legality. Every set here is built from a
 * `LegalActions` the engine produced, and every "why not" string is the
 * engine's own message, which is what the design's "Why illegal?" affordance
 * shows (PLAN.md Phase 4). The design rule this serves is "dim, don't hide":
 * an illegal card stays exactly where it is at `ink.illegal`, because the
 * board must not reflow while the player's hand is already moving.
 */

import type {
  ActionRef,
  EngineErrorCode,
  ExclusionCode,
  InstanceId,
  LegalAction,
  LegalActions,
  PlayerId,
} from "@mc/engine";

/** The five buttons in the design's action bar. */
export type BasicAction = "attack" | "thwart" | "recover" | "changeForm" | "endTurn";

export interface BasicButtonState {
  readonly action: BasicAction;
  readonly enabled: boolean;
  /** The engine's reason, for the "Why illegal?" line. Null when enabled. */
  readonly reason: string | null;
  readonly code: EngineErrorCode | null;
  /** Legal targets, so tapping the button enters target-select mode. */
  readonly targets: readonly InstanceId[];
}

/** Why something can't be done, in the engine's own words plus its code. */
export interface IllegalReason {
  readonly code: EngineErrorCode;
  readonly message: string;
}

export interface Highlights {
  /** True while this seat may act at all. */
  readonly yourTurn: boolean;
  /** Hand cards playable right now — solid, full-ink. */
  readonly playable: ReadonlySet<InstanceId>;
  /** Hand cards present but illegal this instant — dimmed, not hidden. */
  readonly unplayable: ReadonlyMap<InstanceId, IllegalReason>;
  /** In-play cards with a usable action or resource ability. */
  readonly usableAbilities: ReadonlySet<InstanceId>;
  /** Every card any legal action could be aimed at, for the targeting pulse. */
  readonly anyTarget: ReadonlySet<InstanceId>;
  /** Targets that exist but are blocked right now, e.g. the villain behind a Guard minion. */
  readonly blocked: ReadonlyMap<InstanceId, string>;
  readonly basics: readonly BasicButtonState[];
  /** Set when the engine is waiting on a decision instead of an action. */
  readonly openChoice: OpenChoice | null;
}

export interface OpenChoice {
  readonly playerId: PlayerId;
  readonly promptKind: string;
  readonly soleDecider: boolean;
  /** Whose decision it is by rule; anything but "player" is made for the encounter side. */
  readonly authority: "player" | "firstPlayerTargets" | "firstPlayerOrders";
  readonly minSelections: number;
  readonly maxSelections: number;
  readonly ordered: boolean;
  readonly options: readonly {
    readonly optionId: string;
    readonly label: string;
    readonly instanceId: InstanceId | null;
  }[];
}

/** A `LegalAction` narrowed to the `useAbility` case, so callers can read `abilityId` directly. */
export type UsableAbilityAction = LegalAction & { readonly action: Extract<ActionRef, { kind: "useAbility" }> };

/**
 * Every usable action ability on one card, in the order `legalActions`
 * produced them. `Highlights.usableAbilities` only says a card has at least
 * one; the board's ability control and the Inspect sheet's picker both need
 * to know *which* and *how many*, so this is the one place that reads
 * `LegalActions.legal` for that instead of each scene re-filtering it.
 */
export function abilityActionsFor(actions: LegalActions, instanceId: InstanceId): readonly UsableAbilityAction[] {
  return legalEntriesOf(actions).filter(
    (entry): entry is UsableAbilityAction =>
      entry.action.kind === "useAbility" && entry.action.instanceId === instanceId,
  );
}

/**
 * The legal entries a seat may act on right now: its own turn's, or, during another player's turn, the Actions the
 * engine lists under `notYourTurn` (RRG 1.8 "Player Turn", pp. 34-35; docs/phase7-wave7.md §4.1). Empty otherwise.
 */
export function legalEntriesOf(actions: LegalActions): readonly LegalAction[] {
  return actions.kind === "turn" || actions.kind === "notYourTurn" ? actions.legal : [];
}

/** True when a seat that is not the active player has an Action to offer (an Action ability or an Action event). */
export function hasOffTurnAction(actions: LegalActions): boolean {
  return actions.kind === "notYourTurn" && actions.legal.length > 0;
}

const BASIC_ORDER: readonly BasicAction[] = ["attack", "thwart", "recover", "changeForm", "endTurn"];

/** The `ActionRef` kind each action-bar button corresponds to. */
const BASIC_KIND: Record<BasicAction, ActionRef["kind"]> = {
  attack: "basicAttack",
  thwart: "basicThwart",
  recover: "basicRecover",
  changeForm: "changeForm",
  endTurn: "endTurn",
};

export function highlights(actions: LegalActions): Highlights {
  if (actions.kind === "choice") {
    const { choice } = actions;
    return {
      ...EMPTY,
      openChoice: {
        playerId: choice.playerId,
        promptKind: choice.prompt.kind,
        soleDecider: choice.soleDecider,
        authority: choice.authority,
        minSelections: choice.minSelections,
        maxSelections: choice.maxSelections,
        ordered: choice.ordered,
        options: choice.options.map((option) => ({
          optionId: option.optionId,
          label: option.label,
          instanceId: option.ref.kind === "card" ? option.ref.instanceId : null,
        })),
      },
    };
  }
  if (actions.kind !== "turn" && !hasOffTurnAction(actions)) return EMPTY;
  const offTurn = actions.kind !== "turn";

  const playable = new Set<InstanceId>();
  const unplayable = new Map<InstanceId, IllegalReason>();
  const usableAbilities = new Set<InstanceId>();
  const anyTarget = new Set<InstanceId>();
  const blocked = new Map<InstanceId, string>();

  const illegalEntries = actions.kind === "turn" || actions.kind === "notYourTurn" ? actions.illegal : [];
  for (const entry of legalEntriesOf(actions)) {
    if (entry.action.kind === "playCard") playable.add(entry.action.instanceId);
    if (entry.action.kind === "useAbility") usableAbilities.add(entry.action.instanceId);
    for (const target of entry.targets) anyTarget.add(target);
    for (const target of entry.blockedTargets) blocked.set(target.instanceId, target.message);
  }
  for (const entry of illegalEntries) {
    if (entry.action.kind === "playCard") {
      unplayable.set(entry.action.instanceId, { code: entry.reason, message: entry.message });
    }
    for (const target of entry.blockedTargets) {
      // A target legal for one action wins over a block from another.
      if (!anyTarget.has(target.instanceId)) blocked.set(target.instanceId, target.message);
    }
  }

  const basics = BASIC_ORDER.map((action): BasicButtonState => {
    const kind = BASIC_KIND[action];
    if (offTurn) {
      // Basic powers, changing form and ending the turn are the active player's alone.
      return { action, enabled: false, reason: "their turn", code: null, targets: [] };
    }
    const legal = legalEntriesOf(actions).find((entry) => entry.action.kind === kind);
    if (legal) {
      return { action, enabled: true, reason: null, code: null, targets: legal.targets };
    }
    const illegal = illegalEntries.find((entry) => entry.action.kind === kind);
    return {
      action,
      enabled: false,
      reason: basicReasonWording(action, illegal?.reason ?? null, illegal?.message ?? null),
      code: illegal?.reason ?? null,
      targets: [],
    };
  });

  return { yourTurn: !offTurn, playable, unplayable, usableAbilities, anyTarget, blocked, basics, openChoice: null };
}

/**
 * "Why not the others?" wording for `choiceExclusions`' bare `ExclusionCode`s (docs/phase4-screen-gaps.md §2 "S5.6").
 *
 * `why-not.ts`'s own doc comment is explicit that these are clause names, not player-facing copy — unlike
 * `EngineError.message` (what `LegalAction.blockedTargets` already carries for a basic attack/thwart or an ability,
 * shown verbatim rather than through this table), the engine has no wording for a query clause. So this is the one
 * small table the design asks for, kept beside the rest of the board's "why not" reading. `view/targeting-panel.ts`
 * is the only caller today; nothing yet opens a `chooseTarget` through the board's own target-select mode (that
 * still runs through the generic pending-choice sheet, `scenes/choice.ts`), but the table is written and tested
 * against the engine's full `ExclusionCode` union so whichever screen wires that up next has nothing left to word.
 */
const EXCLUSION_WORDING: Record<ExclusionCode, string> = {
  unknownCard: "not a real card",
  wrongSelf: "wrong card for this effect",
  wrongCategory: "not the right kind of card",
  notFriendly: "not controlled by any player",
  wrongController: "controlled by the wrong player",
  notIdentityExtension: "not that hero or one of their events, resources or upgrades",
  notEngagedWithYou: "not engaged with you",
  notEngaged: "not engaged with anyone",
  missingTrait: "missing the required trait",
  statComparisonFailed: "its stat doesn't meet the requirement",
  hasExcludedTrait: "has an excluded trait",
  missingKeyword: "missing the required keyword",
  hasExcludedKeyword: "has an excluded keyword",
  matchesNoAlternative: "not any of the allowed kinds of card",
  wrongName: "not the named card",
  wrongPrintedId: "not the exact printed card",
  wrongFacedown: "wrong face up or down",
  wrongForm: "not that kind of form card",
  noSuchAbility: "has no such ability",
  wrongStarIcon: "wrong star icon in the boost area",
  wrongUnique: "wrong unique icon",
  notHostOfSelf: "isn't hosting this card",
  notAttachedToHost: "not attached to the right host",
  missingAttachment: "doesn't have the right attachment",
  cannotHaveAttached: "can't have that card attached",
  cannotAttachTo: "can't be attached there",
  cannotEnterPlay: "a matching unique card is in play",
  cannotFlip: "can't be flipped",
  wrongOwner: "not owned by you",
  missingPrintedResource: "doesn't print the needed resource",
  wrongAspect: "wrong aspect",
  exhausted: "already exhausted",
  ready: "not exhausted",
  noThreat: "has no threat on it",
  hasThreat: "already has threat on it",
  missingCounter: "has no counter of that kind on it",
  notDamaged: "undamaged",
  damaged: "already damaged",
  missingStatus: "doesn't have the needed status",
  hasStatus: "already carries that status",
  noStatusRoom: "can't take that status card",
  printedHpTooHigh: "printed HP is too high",
  printedCostTooHigh: "printed cost is too high",
  printedCostTooLow: "printed cost is too low",
  cannotBeAttacked: "can't be attacked right now",
  nothingToAttack: "has no other enemy it can attack",
  alreadyChosen: "already chosen for this cost",
  notInSlot: "not one of the cards already picked",
  wrongSignatureSideScheme: "not this villain's signature side scheme",
  notEngagedWithPlayer: "not engaged with the right player",
  notInPlayArea: "not in that player's play area",
  wrongIdentitySet: "not from this identity's set",
  notNemesisMinion: "not this player's nemesis minion",
  notObligation: "not this player's obligation",
  notNemesisSideScheme: "not this player's nemesis side scheme",
  notNemesisSet: "not from this player's nemesis set",
  noSharedTrait: "shares no trait with that card",
  wrongClassification: "not the same classification (identity-specific, aspect or basic)",
  wrongEncounterSet: "not from that encounter set",
  notInCampaignLog: "not recorded in the campaign log",
  otherGameArea: "in another game area",
  notInPlay: "not in play",
  alterEgoForm: "in alter-ego form",
  notHeroOrAlly: "not a hero or ally",
  defenderAlreadyDeclared: "someone else already declared as defender",
  anotherPlayerDefending: "another player is defending this attack",
  anotherPlayerUsedDefense: "another player already used a defense card for this attack",
  cannotDefend: "cannot defend",
  cannotRemoveThreat: "this card can't remove threat from it",
  mustDefendWithAlly: "a ready ally must defend instead",
  deckTopPlayLimitUsed: "top card already played this phase",
};

/** `EXCLUSION_WORDING`, defaulting honestly rather than throwing on a code this table hasn't been kept in sync with. */
export function exclusionWording(code: ExclusionCode): string {
  return EXCLUSION_WORDING[code] ?? "not a legal target";
}

/**
 * Test-only: the full set of codes `EXCLUSION_WORDING` is keyed on (`Object.keys` loses nothing — the type checker
 * already rejects a `Record<ExclusionCode, string>` missing one), plus `exclusionWording` itself, so
 * `targeting-panel.test.ts` can assert every real code gets a real entry rather than the honest-default fallback,
 * without hand-copying the `ExclusionCode` union into a second file.
 */
export const EXCLUSION_TEST_ONLY = {
  codes: Object.keys(EXCLUSION_WORDING) as readonly ExclusionCode[],
  wording: exclusionWording,
};

/**
 * The "Why illegal?" line for a basic button. The engine's message is kept as it is, except for a change of form it
 * refuses for want of its additional cost (`RuleSpec formChangeCost`, wave 8 §3.63): that message names every card
 * that adds the cost and the engine's own shortfall, which is a paragraph, so the button says it in a few words and
 * Inspect on the cost's card has the rest.
 */
export function basicReasonWording(action: BasicAction, code: string | null, message: string | null): string {
  if (action === "changeForm" && code === "insufficient_resources") return "can't pay the extra cost to change form";
  return message ?? "not available right now";
}

const EMPTY: Highlights = {
  yourTurn: false,
  playable: new Set(),
  unplayable: new Map(),
  usableAbilities: new Set(),
  anyTarget: new Set(),
  blocked: new Map(),
  basics: BASIC_ORDER.map((action) => ({
    action,
    enabled: false,
    reason: "wait for your turn",
    code: null,
    targets: [],
  })),
  openChoice: null,
};
