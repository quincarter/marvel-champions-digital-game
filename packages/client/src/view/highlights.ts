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

import type { ActionRef, EngineErrorCode, InstanceId, LegalActions, PlayerId } from "@mc/engine";

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
  readonly options: readonly { readonly optionId: string; readonly label: string; readonly instanceId: InstanceId | null }[];
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
  if (actions.kind !== "turn") return EMPTY;

  const playable = new Set<InstanceId>();
  const unplayable = new Map<InstanceId, IllegalReason>();
  const usableAbilities = new Set<InstanceId>();
  const anyTarget = new Set<InstanceId>();
  const blocked = new Map<InstanceId, string>();

  for (const entry of actions.legal) {
    if (entry.action.kind === "playCard") playable.add(entry.action.instanceId);
    if (entry.action.kind === "useAbility") usableAbilities.add(entry.action.instanceId);
    for (const target of entry.targets) anyTarget.add(target);
    for (const target of entry.blockedTargets) blocked.set(target.instanceId, target.message);
  }
  for (const entry of actions.illegal) {
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
    const legal = actions.legal.find((entry) => entry.action.kind === kind);
    if (legal) {
      return { action, enabled: true, reason: null, code: null, targets: legal.targets };
    }
    const illegal = actions.illegal.find((entry) => entry.action.kind === kind);
    return {
      action,
      enabled: false,
      reason: illegal?.message ?? "not available right now",
      code: illegal?.reason ?? null,
      targets: [],
    };
  });

  return { yourTurn: true, playable, unplayable, usableAbilities, anyTarget, blocked, basics, openChoice: null };
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
