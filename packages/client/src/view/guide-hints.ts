/**
 * Guided mode's hint warnings (G9a, docs/guided-mode.md §5.2, §3.13): five named heuristics that catch a costly
 * mistake before it happens — a scheme about to complete, lethal damage about to come in, a scheme one or two
 * threat from completing, flipping into a scheme that completes unopposed, and a payment that spends more (or a
 * better card) than it needs to.
 *
 * Each heuristic is a pure function over engine queries only — `characterProfile`, `mainSchemeValue`, `iconsInPlay`,
 * `legalActions`, `schemePanel` — never its own arithmetic over hidden state. In particular nothing here reads a
 * facedown boost card or the encounter deck's order (`view/visibility.ts`'s rule): `schemeFinishHint` stops at "the
 * villain's own SCH plus what's already on the table", and `lethalHint` stops at the villain's and engaged minions'
 * own ATK against the best possible block, exactly as §5.2 specifies, so a boost card that hasn't been flipped never
 * moves the number a hint shows.
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
  hasKeyword,
  iconsInPlay,
  legalActions,
  mainSchemeCompletionLoses,
  mainSchemeValue,
  minionsEngagedWith,
  remainingHitPoints,
  statusActive,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PaymentSource,
  type PlayerId,
} from "@mc/engine";
import { thwartUsesAtk } from "./attacker-choice.js";
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
  const bestThwart = bestThwartOf(state, deps, playerId, panel.instanceId);
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

/** The best legal basic thwart's own THW (its ATK against an assault scheme) against the main scheme, or 0 when none is legal — shared by
 * `schemeFinishHint` and `schemeCloseHint`, whose safe actions both offer "Thwart first −N". */
function bestThwartOf(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  mainSchemeInstanceId: InstanceId,
): number {
  const legal = legalActions(state, playerId, deps);
  const thwartMatches =
    legal.kind === "turn"
      ? legal.legal.filter(
          (entry) => entry.action.kind === "basicThwart" && entry.targets.includes(mainSchemeInstanceId),
        )
      : [];
  return thwartMatches.reduce((max, entry) => {
    const action = entry.action;
    return action.kind === "basicThwart"
      ? Math.max(
          max,
          (thwartUsesAtk(state, deps, [mainSchemeInstanceId])
            ? characterProfile(state, action.instanceId, deps)?.atk
            : characterProfile(state, action.instanceId, deps)?.thw) ?? 0,
        )
      : max;
  }, 0);
}

// ---------------------------------------------------------------------------
// schemeCloseHint
// ---------------------------------------------------------------------------

/**
 * Ending the turn with the main scheme within 2 [[threat|threat]] of its target *after* next villain phase's
 * visible step-1 add (the same projection `schemeFinishHint` uses), but that add alone not enough to complete it
 * — 1 or 2 away lands here; `schemeFinishHint` already covers 0 or less, and the two never both fire for the same
 * state (`hintsFor`'s priority order stops at the first match). Encounter cards and boost stay unknown, so this
 * only ever says the scheme "could" finish, never that it will (§5.2/§3.13).
 */
export function schemeCloseHint(state: GameState, deps: EngineDeps, playerId: PlayerId): Hint | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;

  const panel = schemePanel(state, state.mainScheme.instanceId, deps, true);
  if (panel.target === null) return null;
  const remaining = panel.target - panel.threat;
  if (remaining <= 0) return null;

  const villain = activeVillain(state);
  const villainProfile = villain.defeated ? undefined : characterProfile(state, villain.instanceId, deps);
  const schAgainstAlterEgo = player.identity.form === "alterEgo" ? (villainProfile?.sch ?? 0) : 0;
  const projected = stepOneThreatOf(state, deps) + schAgainstAlterEgo;
  if (projected >= remaining) return null; // completes (or worse) — `schemeFinishHint`'s job, not this one's.

  const away = remaining - projected;
  if (away > 2) return null; // more than 2 away after the add: not "close" yet.

  const afterThreat = panel.threat + projected;
  const schemeName = cardName(state, panel.instanceId);
  const bestThwart = bestThwartOf(state, deps, playerId, panel.instanceId);
  const safeAction = !panel.crisis && bestThwart > 0 ? { label: `Thwart first −${bestThwart}` } : null;

  return {
    key: "schemeClose",
    title: "Close to losing",
    body:
      `[[mainScheme|${schemeName}]] will reach at least ${afterThreat} of ${panel.target} [[threat|threat]] in the ` +
      `next [[villainPhase|villain phase]]. An encounter card could finish it. Thwart now?`,
    facts: { threat: panel.threat, target: panel.target, projected, afterThreat, away },
    safeAction,
    anywayAction: { label: "End turn anyway" },
  };
}

// ---------------------------------------------------------------------------
// lethalHint
// ---------------------------------------------------------------------------

interface QueuedAttacker {
  readonly instanceId: InstanceId;
  readonly atk: number;
  readonly overkill: boolean;
}

/**
 * The visible attacks next villain phase would make against `playerId` — villain ATK plus each engaged minion's
 * ATK, boost never counted (§5.2) — largest first, skipping a stunned attacker (a stunned enemy doesn't activate,
 * RRG 1.8 "Stun", p. 41).
 */
function queuedAttacksAgainst(state: GameState, deps: EngineDeps, playerId: PlayerId): readonly QueuedAttacker[] {
  const villain = activeVillain(state);
  const attackers: QueuedAttacker[] = [];
  if (!villain.defeated && !statusActive(state, villain.instanceId, "stunned", deps)) {
    attackers.push({
      instanceId: villain.instanceId,
      atk: characterProfile(state, villain.instanceId, deps)?.atk ?? 0,
      overkill: hasKeyword(state, villain.instanceId, "overkill", deps),
    });
  }
  for (const id of minionsEngagedWith(state, playerId)) {
    if (statusActive(state, id, "stunned", deps)) continue;
    attackers.push({
      instanceId: id,
      atk: characterProfile(state, id, deps)?.atk ?? 0,
      overkill: hasKeyword(state, id, "overkill", deps),
    });
  }
  return [...attackers].sort((a, b) => b.atk - a.atk);
}

/**
 * The damage the hero still takes after the best possible block: every ally in play blocks one attack, largest
 * first (an ally with Overkill's attacker passes the excess over the ally's remaining HP to the hero, RRG 1.8
 * "Overkill", p. 31); the hero defends one remaining attack, reduced by DEF; anything left over hits unblocked. By
 * end of turn every hero and ally is ready (RRG 1.8 "End of Player Phase" step 3, p. 14 — simultaneous readying —
 * so a currently-exhausted hero or ally is not excluded here).
 */
function bestBlockDamage(
  state: GameState,
  deps: EngineDeps,
  attackers: readonly QueuedAttacker[],
  allies: readonly InstanceId[],
  heroDef: number,
): number {
  let heroDefended = false;
  let allyIndex = 0;
  let damage = 0;
  for (const attacker of attackers) {
    if (allyIndex < allies.length) {
      const allyId = allies[allyIndex]!;
      allyIndex++;
      if (attacker.overkill) {
        const allyHp = remainingHitPoints(state, allyId, deps) ?? 0;
        damage += Math.max(0, attacker.atk - allyHp);
      }
      continue; // a non-Overkill attacker is fully absorbed.
    }
    if (!heroDefended) {
      heroDefended = true;
      damage += Math.max(0, attacker.atk - heroDef);
      continue;
    }
    damage += attacker.atk; // unblocked.
  }
  return damage;
}

/**
 * Ending the turn in hero form, with the visible attacks next villain phase would make against this player —
 * villain ATK plus engaged minions' ATK, Overkill excess included, boost never counted — able to defeat the hero
 * even with the best possible block (§5.2). Everyone readies at end of turn (RRG 1.8 p. 14), so this checks the
 * best block available then, not whatever is currently exhausted.
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

  const attackers = queuedAttacksAgainst(state, deps, playerId);
  if (attackers.length === 0) return null;
  const totalAtk = attackers.reduce((sum, a) => sum + a.atk, 0);

  const allies = player.playArea.filter((id) => cardOf(state, id)?.type === "ally");
  const bestCaseDamage = bestBlockDamage(state, deps, attackers, allies, heroProfile.def);
  if (bestCaseDamage < currentHp) return null;

  const legal = legalActions(state, playerId, deps);
  const canFlip = legal.kind === "turn" && legal.legal.some((entry) => entry.action.kind === "changeForm");

  const heroName = cardName(state, heroId);
  const villain = activeVillain(state);
  const villainName = cardName(state, villain.instanceId);

  return {
    key: "lethal",
    title: "You could take lethal damage",
    body:
      `${heroName} is at ${currentHp} of ${heroProfile.maxHp} HP. Even with the best block, ${villainName}'s ATK` +
      `${attackers.length > 1 ? " plus engaged minions'" : ""} could deal ${bestCaseDamage} next ` +
      `[[villainPhase|villain phase]] — and a boost card could add more.`,
    facts: { currentHp, maxHp: heroProfile.maxHp, totalAtk, bestCaseDamage },
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
 * Whether `instanceId` (a hand card) has a legal, affordable play *right now*, in `state` as it stood before this
 * payment opened — `legalActions`' own `playCard` evaluation already resolves a target and a working payment for
 * it (`evaluatePlay`, `packages/engine/src/legal.ts`), so this is never re-derived here. A card with no legal
 * target (Spider-Tracer with no minion in play) or the wrong form for its play restriction reports `illegal`
 * there instead, and is not "genuinely playable" for this hint's purposes.
 */
function isGenuinelyPlayableNow(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  instanceId: InstanceId,
): boolean {
  const legal = legalActions(state, playerId, deps);
  if (legal.kind !== "turn") return false;
  return legal.legal.some((entry) => entry.action.kind === "playCard" && entry.action.instanceId === instanceId);
}

/**
 * Confirming a payment that overpays (`paid > required`), or that spends a card which is itself a legal,
 * affordable play right now — not merely "not a bare resource card", which flagged cards with no legal target or
 * the wrong form (Spider-Tracer with no minion in play) and made the warning ping-pong between two cards that
 * both looked "playable" by that looser test (Aunt May paid with Spider-Tracer vs. with For Justice!, each
 * suggesting the other) — while another still-spendable source that is *not itself* such a card alone would have
 * covered what's left of the cost (§5.2). If every covering alternative is itself a genuine play, swapping just
 * trades one flagged card for another, so this stays quiet rather than ping-ponging.
 */
export function wastedPayHint(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  payment: WastedPayView,
): Hint | null {
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
    if (!isGenuinelyPlayableNow(state, deps, playerId, source.instanceId)) continue;
    const withoutThis = paid - poolTotal(source.pool);
    const alt = [...spendable.values()].find(
      (other) =>
        withoutThis + poolTotal(other.pool) >= required &&
        !(other.kind === "handCard" && isGenuinelyPlayableNow(state, deps, playerId, other.instanceId)),
    );
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
          schemeCloseHint(state, deps, playerId),
          flipDangerHint(state, deps, playerId, "endTurn"),
        ]
      : trigger.kind === "flip"
        ? [flipDangerHint(state, deps, playerId, "flip")]
        : [wastedPayHint(state, deps, playerId, trigger.payment)];

  return candidates.filter((hint): hint is Hint => hint !== null && !prefs.silencedWarnings.includes(hint.key));
}
