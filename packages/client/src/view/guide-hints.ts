/**
 * Guided mode's hint warnings (G9a, docs/guided-mode.md §5.2): four named heuristics that catch a costly mistake
 * before it happens — a scheme about to complete, lethal damage about to come in, flipping into a scheme that
 * completes unopposed, and a payment that spends more (or a better card) than it needs to.
 *
 * Each heuristic is a pure function over engine queries only — `characterProfile`, `mainSchemeValue`, `iconsInPlay`,
 * `legalActions`, `schemePanel` — never its own arithmetic over hidden state. In particular nothing here reads a
 * facedown boost card or the encounter deck's order (`view/visibility.ts`'s rule): `schemeFinishHint` and
 * `lethalHint` both stop at "the villain's own ATK/SCH plus what's already on the table", exactly as §5.2 specifies,
 * so a boost card that hasn't been flipped never moves the number a hint shows.
 *
 * `hintsFor` is the one export a controller (G9b) calls: it picks which heuristics apply to the command about to
 * go out (`HintTrigger`), and drops anything the player has silenced or that the guide level says should stay
 * quiet (`GuidePrefs.level`, `docs/guided-mode.md` §3.6 — hints fire at "full" and "hints", never "off").
 */
import {
  activeVillain,
  cardOf,
  characterProfile,
  getPlayer,
  iconsInPlay,
  legalActions,
  mainSchemeCompletionLoses,
  mainSchemeValue,
  minionsEngagedWith,
  type EngineDeps,
  type GameState,
  type PaymentSource,
  type PlayerId,
} from "@mc/engine";
import { schemePanel } from "./board-model.js";
import { cardName } from "./names.js";
import type { PaymentView } from "./payment-model.js";
import type { GuidePrefs, SilencedWarningKey } from "../guide/guide-prefs.js";

export interface HintAction {
  readonly label: string;
}

export interface Hint {
  readonly key: SilencedWarningKey;
  readonly title: string;
  /** `McTermText` markup (`[[id]]` / `[[id|label]]`, see `view/term-text-model.ts`). Worded as a suggestion. */
  readonly body: string;
  readonly facts: Readonly<Record<string, number>>;
  /** The action offered first. Null when there is none this turn (e.g. no legal thwart, crisis blocking one). */
  readonly safeAction: HintAction | null;
  /** Always present: "do it anyway" is always an option — the guide only ever suggests. */
  readonly anywayAction: HintAction;
}

// ---------------------------------------------------------------------------
// schemeFinishHint
// ---------------------------------------------------------------------------

/** The threat the main scheme is about to gain next villain phase's step 1: acceleration + tokens + icons in play. */
function stepOneThreatOf(state: GameState, deps: EngineDeps): number {
  return (
    mainSchemeValue(state, "acceleration", deps) +
    state.mainScheme.accelerationTokens +
    iconsInPlay(state, deps, "acceleration")
  );
}

/**
 * Ending the turn, with the main scheme's threat plus the minimum visible threat next villain phase adds (step
 * one, plus the villain's SCH if the deciding player is in alter-ego) reaching its target (§5.2).
 *
 * A side scheme with the crisis icon stops player cards removing threat from the main scheme (RRG 1.8 p. 14), so
 * while one is in play this never offers "Thwart first" — thwarting the main scheme wouldn't do anything.
 */
export function schemeFinishHint(state: GameState, deps: EngineDeps, playerId: PlayerId): Hint | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;

  const panel = schemePanel(state, state.mainScheme.instanceId, deps, true);
  if (panel.target === null) return null;
  const remaining = panel.target - panel.threat;
  if (remaining <= 0) return null; // already at/over target — `mainSchemeCalloutOf`'s warning covers that moment.

  const villain = activeVillain(state);
  const villainProfile = villain.defeated ? undefined : characterProfile(state, villain.instanceId, deps);
  const schAgainstAlterEgo = player.identity.form === "alterEgo" ? (villainProfile?.sch ?? 0) : 0;
  const projected = stepOneThreatOf(state, deps) + schAgainstAlterEgo;
  if (projected < remaining) return null;

  const loses = mainSchemeCompletionLoses(state, state.mainScheme.instanceId);
  const legal = legalActions(state, playerId, deps);
  const thwartMatches =
    legal.kind === "turn"
      ? legal.legal.filter((entry) => entry.action.kind === "basicThwart" && entry.targets.includes(panel.instanceId))
      : [];
  const bestThwart = thwartMatches.reduce((max, entry) => {
    const action = entry.action;
    return action.kind === "basicThwart"
      ? Math.max(max, characterProfile(state, action.instanceId, deps)?.thw ?? 0)
      : max;
  }, 0);
  const safeAction = !panel.crisis && bestThwart > 0 ? { label: `Thwart first −${bestThwart}` } : null;

  return {
    key: "schemeFinish",
    title: "The scheme could complete",
    body:
      `[[mainScheme|The main scheme]] is at ${panel.threat} of ${panel.target} [[threat|threat]]. Next ` +
      `[[villainPhase|villain phase]] could add ${projected} more — enough to ${loses ? "lose the game" : "complete this stage"}.`,
    facts: { threat: panel.threat, target: panel.target, projected, remaining },
    safeAction,
    anywayAction: { label: "End turn anyway" },
  };
}

// ---------------------------------------------------------------------------
// lethalHint
// ---------------------------------------------------------------------------

/**
 * Ending the turn in hero form, with the visible attacks queued against the hero — villain ATK plus engaged
 * minions' ATK, boost never counted — able to defeat the hero, with no ready defender (the hero itself) or ally
 * to put in the way (§5.2).
 */
export function lethalHint(state: GameState, deps: EngineDeps, playerId: PlayerId): Hint | null {
  const player = getPlayer(state, playerId);
  if (!player || player.identity.form !== "hero") return null;

  const heroId = player.identity.instanceId;
  const heroInstance = state.instances[heroId];
  const heroProfile = characterProfile(state, heroId, deps);
  if (!heroInstance || !heroProfile) return null;
  const currentHp = heroProfile.maxHp - heroInstance.damage;
  if (currentHp <= 0) return null; // already defeated — not this warning's job.

  const villain = activeVillain(state);
  if (villain.defeated) return null;
  const villainAtk = characterProfile(state, villain.instanceId, deps)?.atk ?? 0;
  const engagedMinions = minionsEngagedWith(state, playerId);
  const minionAtk = engagedMinions.reduce((sum, id) => sum + (characterProfile(state, id, deps)?.atk ?? 0), 0);
  const totalAtk = villainAtk + minionAtk;
  if (totalAtk < currentHp) return null;

  const readyAlly = player.playArea.some((id) => {
    const card = cardOf(state, id);
    return card?.type === "ally" && state.instances[id]?.exhausted === false;
  });
  if (!heroInstance.exhausted || readyAlly) return null; // a defender is still available.

  const legal = legalActions(state, playerId, deps);
  const canFlip = legal.kind === "turn" && legal.legal.some((entry) => entry.action.kind === "changeForm");

  const heroName = cardName(state, heroId);
  const villainName = cardName(state, villain.instanceId);

  return {
    key: "lethal",
    title: "You could take lethal damage",
    body:
      `${heroName} is at ${currentHp} of ${heroProfile.maxHp} HP. ${villainName}'s ATK` +
      `${minionAtk > 0 ? " plus engaged minions'" : ""} could deal ${totalAtk} next [[villainPhase|villain phase]], ` +
      `with no ready [[defend|defender]].`,
    facts: { currentHp, maxHp: heroProfile.maxHp, villainAtk, minionAtk, totalAtk },
    safeAction: canFlip ? { label: "Flip to alter-ego" } : null,
    anywayAction: { label: "End turn anyway" },
  };
}

// ---------------------------------------------------------------------------
// flipDangerHint
// ---------------------------------------------------------------------------

/**
 * Flipping to alter-ego when the villain's SCH plus the step-1 threat would complete the scheme, or ending the
 * turn already in alter-ego with that same condition (§5.2). `trigger` picks which of those two moments this is,
 * for wording only — the underlying check is identical either way.
 */
export function flipDangerHint(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  trigger: "flip" | "endTurn",
): Hint | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  if (trigger === "flip" && player.identity.form !== "hero") return null;
  if (trigger === "endTurn" && player.identity.form !== "alterEgo") return null;

  const panel = schemePanel(state, state.mainScheme.instanceId, deps, true);
  if (panel.target === null) return null;
  const remaining = panel.target - panel.threat;
  if (remaining <= 0) return null;

  const villain = activeVillain(state);
  if (villain.defeated) return null;
  const villainSch = characterProfile(state, villain.instanceId, deps)?.sch ?? 0;
  const projected = stepOneThreatOf(state, deps) + villainSch;
  if (projected < remaining) return null;

  const loses = mainSchemeCompletionLoses(state, state.mainScheme.instanceId);
  const villainName = cardName(state, villain.instanceId);

  return {
    key: "flipDanger",
    title: "Alter-ego lets the scheme through",
    body:
      `In alter-ego form, ${villainName}'s SCH plus next [[villainPhase|villain phase]]'s threat could ` +
      `${loses ? "lose the game" : "complete this stage"}. [[mainScheme|The main scheme]] is at ${panel.threat} of ${panel.target}.`,
    facts: { threat: panel.threat, target: panel.target, projected, sch: villainSch },
    safeAction: { label: "Stay in hero form" },
    anywayAction: { label: trigger === "flip" ? "Flip anyway" : "End turn anyway" },
  };
}

// ---------------------------------------------------------------------------
// wastedPayHint
// ---------------------------------------------------------------------------

/** The `PaymentView` fields `wastedPayHint` reads — never the whole mode, so a test can build just these. */
export type WastedPayView = Pick<PaymentView, "paid" | "required" | "spent" | "spendable">;

const poolTotal = (pool: Readonly<Record<string, number>>): number =>
  Object.values(pool).reduce((sum, n) => sum + n, 0);

/**
 * Confirming a payment that overpays (`paid > required`), or that spends a card which is itself playable — a
 * card whose type is more than a bare resource — while another still-spendable source alone would have covered
 * what's left of the cost (§5.2).
 */
export function wastedPayHint(state: GameState, payment: WastedPayView): Hint | null {
  const { paid, required, spent, spendable } = payment;

  if (paid > required) {
    return {
      key: "wastedPay",
      title: "This pays more than needed",
      body: `The [[cost|cost]] is ${required}, and this payment adds up to ${paid}.`,
      facts: { paid, required, overpay: paid - required },
      safeAction: { label: "Change payment" },
      anywayAction: { label: "Confirm payment" },
    };
  }

  for (const source of spent.values()) {
    if (source.kind !== "handCard") continue;
    const card = cardOf(state, source.instanceId);
    if (!card || card.type === "resource") continue; // a bare resource card has nothing to "keep" instead.
    const withoutThis = paid - poolTotal(source.pool);
    const alt = [...spendable.values()].find((other) => withoutThis + poolTotal(other.pool) >= required);
    if (alt) return wastedCardHint(state, source, alt, paid, required);
  }

  return null;
}

function wastedCardHint(
  state: GameState,
  spent: PaymentSource,
  alt: PaymentSource,
  paid: number,
  required: number,
): Hint {
  const spentName = cardName(state, spent.instanceId);
  const altName = cardName(state, alt.instanceId);
  return {
    key: "wastedPay",
    title: "This spends a card you could keep",
    body: `${spentName} is spent for [[resource|resources]] here, but ${altName} alone could cover the [[cost|cost]] instead.`,
    facts: { paid, required },
    safeAction: { label: "Change payment" },
    anywayAction: { label: "Confirm payment" },
  };
}

// ---------------------------------------------------------------------------
// hintsFor
// ---------------------------------------------------------------------------

/** The command about to go out, and what it needs to check (G9b intercepts exactly these). */
export type HintTrigger =
  | { readonly kind: "endTurn" }
  | { readonly kind: "flip" }
  | { readonly kind: "confirmPayment"; readonly payment: WastedPayView };

export interface HintContext {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly playerId: PlayerId;
  readonly trigger: HintTrigger;
}

/**
 * Every hint that fires for `trigger`, most relevant first, with silenced keys and an "off" guide level already
 * filtered out. Empty means "let the command through with no warning."
 */
export function hintsFor(context: HintContext, prefs: GuidePrefs): readonly Hint[] {
  if (prefs.level === "off") return [];
  const { state, deps, playerId, trigger } = context;

  const candidates: (Hint | null)[] =
    trigger.kind === "endTurn"
      ? [
          schemeFinishHint(state, deps, playerId),
          lethalHint(state, deps, playerId),
          flipDangerHint(state, deps, playerId, "endTurn"),
        ]
      : trigger.kind === "flip"
        ? [flipDangerHint(state, deps, playerId, "flip")]
        : [wastedPayHint(state, trigger.payment)];

  return candidates.filter((hint): hint is Hint => hint !== null && !prefs.silencedWarnings.includes(hint.key));
}
