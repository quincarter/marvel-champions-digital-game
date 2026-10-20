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
  satisfies,
  statusActive,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type LegalActions,
  type PaymentSource,
  type PlayerId,
  type ResourcePool,
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
export type WastedPayView = Pick<PaymentView, "paid" | "required" | "requirement" | "overpaid" | "spent" | "spendable">;

const poolTotal = (pool: ResourcePool): number => pool.physical + pool.mental + pool.energy + pool.wild;

/**
 * What spending a source gives up, lowest first. The warning only ever suggests a source from a lower rung than the
 * card it replaces, and the cheapest one it finds, so it never trades a card for one just as good to keep (issue #299:
 * the suggestion used to be whichever other card came first in the hand).
 *
 * - `free`: a resource ability on a card in play that costs nothing else (Pepper Potts, Peter Parker's Scientist): no
 *   card leaves the hand.
 * - `spare`: a card that is there to be spent — a resource card (RRG 1.8 "Resource Card", p. 37) — or one that can
 *   never be played while its unique twin is in play (RRG 1.8 "Unique", p. 46), and a resource ability whose own cost
 *   takes something (damage, threat).
 * - `idle`: a card with no legal play right now (Relentless Assault with no minion to hit, Spider-Tracer with no
 *   minion to attach to): it may be wanted later, but it does nothing this round (the owner on #299).
 * - `keeper`: a card the player could play right now.
 */
type SpendRung = 0 | 1 | 2 | 3;
const FREE: SpendRung = 0;
const SPARE: SpendRung = 1;
const IDLE: SpendRung = 2;
const KEEPER: SpendRung = 3;

/** The hand card a source discards, or null for a resource ability on a card that stays in play. */
const cardSpentBy = (source: PaymentSource): InstanceId | null =>
  source.kind === "handCard" || source.spendsHandCard ? source.instanceId : null;

function spendRungOf(state: GameState, legal: () => LegalActions, source: PaymentSource): SpendRung {
  const card = cardSpentBy(source);
  if (card === null) return source.costSelection ? SPARE : FREE;
  if (cardOf(state, card)?.type === "resource") return SPARE;
  if (isDuplicateUnique(legal(), card)) return SPARE;
  return isGenuinelyPlayableNow(legal(), card) ? KEEPER : IDLE;
}

/**
 * Whether `instanceId` (a hand card) has a legal, affordable play *right now*, in the legal actions for the state as
 * it stood before this payment opened — `legalActions`' own `playCard` evaluation already resolves a target and a
 * working payment for it (`evaluatePlay`, `packages/engine/src/legal.ts`), so this is never re-derived here. A card
 * with no legal target (Spider-Tracer with no minion in play) or the wrong form for its play restriction reports
 * `illegal` there instead, and is not "genuinely playable" for this hint's purposes.
 */
function isGenuinelyPlayableNow(legal: LegalActions, instanceId: InstanceId): boolean {
  if (legal.kind !== "turn") return false;
  return legal.legal.some((entry) => entry.action.kind === "playCard" && entry.action.instanceId === instanceId);
}

/** A hand card the engine refuses only because a copy of its unique card is already in play. */
function isDuplicateUnique(legal: LegalActions, instanceId: InstanceId): boolean {
  if (legal.kind !== "turn") return false;
  return legal.illegal.some(
    (entry) =>
      entry.action.kind === "playCard" &&
      entry.action.instanceId === instanceId &&
      entry.reason === "duplicate_unique_card",
  );
}

/** Every subset of `items`, smallest first, so the fewest sources kept beside a swap are tried first. */
function subsetsOf<T>(items: readonly T[]): readonly (readonly T[])[] {
  const all: T[][] = [[]];
  for (const item of items) for (const subset of [...all]) all.push([...subset, item]);
  return all.sort((a, b) => a.length - b.length);
}

const RESOURCE_TYPES = ["physical", "mental", "energy", "wild"] as const;

/** The resources a set of sources generates together. */
const sumPools = (sources: readonly PaymentSource[]): ResourcePool => {
  const pool = { physical: 0, mental: 0, energy: 0, wild: 0 };
  for (const source of sources) for (const type of RESOURCE_TYPES) pool[type] += source.pool[type];
  return pool;
};

/**
 * Confirming a payment that overpays, or that spends a card worth keeping when something cheaper to lose pays the
 * same cost (§5.2).
 *
 * The swap is only ever suggested when it is a real improvement (issue #299, where the suggestion was whichever card
 * came first and could leave the cost unpaid by type):
 *
 * - The spent card is a `keeper`, a legal, affordable play right now — not merely "not a bare resource card", which
 *   flagged cards with no target (Spider-Tracer with no minion in play) and made the warning ping-pong between two
 *   cards (Aunt May paid with Spider-Tracer vs. with For Justice!, each suggesting the other).
 * - The suggestion is on a lower rung (`SpendRung`), and the lowest one that works: a resource ability before a
 *   resource card, a resource card before a card with no play this round, then the engine's own order. The warning
 *   says which rung it is, so the suggestion never reads as a random card.
 * - The swap pays the cost exactly, by type ("1 energy" needs an energy or a wild, `satisfies`) — a suggestion that
 *   overpays or can't pay would only trade this warning for another or for a refusal. The other picks may stay
 *   beside it, or drop out when the suggestion covers their share too (a double resource card in place of two cards).
 *
 * A "spend up to N" cost is the player's own choice of how much to spend, so it is never second-guessed here.
 */
export function wastedPayHint(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  payment: WastedPayView,
  given?: LegalActions,
): Hint | null {
  const { paid, required, requirement, overpaid, spent, spendable } = payment;
  // The host's own list for this seat when the caller has it (computed off the main thread, issue #258); listing them
  // again here took over a second on a slow tablet. Listed at most once otherwise.
  let listed = given;
  const legal = () => (listed ??= legalActions(state, playerId, deps));

  // What the picks pay beyond the cost. An overpay-only source (Mr. Hollywood) is there to overpay, so it isn't
  // counted against the player.
  const overpayOnly = poolTotal(sumPools([...spent.values()].filter((source) => source.overpayOnly)));
  const excess = overpaid - overpayOnly;
  if (excess > 0) {
    return {
      key: "wastedPay",
      title: "This pays more than needed",
      body: `The [[cost|cost]] is ${required}, and this payment adds up to ${paid}.`,
      facts: { paid, required, overpay: excess },
      safeAction: { label: "Change payment" },
      anywayAction: { label: "Confirm payment" },
    };
  }
  // A "spend up to N" cost, or a selection the engine has yet to accept: nothing to compare a swap against.
  if (paid !== required) return null;

  const picks = [...spent.values()].filter((source) => !source.overpayOnly);
  // One card is spent once: another way of spending a picked card is no alternative to it.
  const pickedCards = new Set(picks.map(cardSpentBy));
  const alternatives = [...spendable.values()]
    .filter((alt) => !alt.overpayOnly && (cardSpentBy(alt) === null || !pickedCards.has(cardSpentBy(alt))))
    .map((alt) => ({ alt, rung: spendRungOf(state, legal, alt) }))
    .filter(({ rung }) => rung < KEEPER)
    .sort((a, b) => a.rung - b.rung);
  if (alternatives.length === 0) return null;

  const keepers = picks.filter((source) => spendRungOf(state, legal, source) === KEEPER);
  for (const source of keepers) {
    const others = picks.filter((other) => other !== source);
    for (const { alt, rung } of alternatives) {
      const kept = subsetsOf(others).find((subset) => {
        const pool = sumPools([...subset, alt]);
        return poolTotal(pool) === required && satisfies(pool, requirement);
      });
      if (kept) return wastedCardHint(state, source, alt, rung, kept.length === 0, paid, required);
    }
  }
  return null;
}

function wastedCardHint(
  state: GameState,
  spent: PaymentSource,
  alt: PaymentSource,
  rung: SpendRung,
  alone: boolean,
  paid: number,
  required: number,
): Hint {
  const spentName = cardName(state, spent.instanceId);
  const altName = cardName(state, alt.instanceId);
  const why =
    rung === FREE
      ? `${altName} pays without spending a card`
      : rung === IDLE
        ? `${altName} has no play right now`
        : cardOf(state, alt.instanceId)?.type === "resource"
          ? `${altName} is a resource card`
          : alt.kind === "resourceAbility" && cardSpentBy(alt) === null
            ? `${altName} can pay`
            : `${altName} can't be played while its unique copy is in play`;
  const covers = alone ? "and alone could cover the [[cost|cost]] instead" : "and could pay that share instead";
  return {
    key: "wastedPay",
    title: "This spends a card you could keep",
    body: `${spentName} could be played right now, but it is spent for [[resource|resources]] here. ${why}, ${covers}.`,
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
  /** `playerId`'s legal actions in `state`, when the caller already has them (the host's prefetched list). */
  readonly legal?: LegalActions;
}

/**
 * Every hint that fires for `trigger`, most relevant first, with silenced keys and an "off" guide level already
 * filtered out. Empty means "let the command through with no warning."
 */
export function hintsFor(context: HintContext, prefs: GuidePrefs): readonly Hint[] {
  if (prefs.level === "off") return [];
  const { state, deps, playerId, trigger, legal } = context;

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
        : [wastedPayHint(state, deps, playerId, trigger.payment, legal)];

  return candidates.filter((hint): hint is Hint => hint !== null && !prefs.silencedWarnings.includes(hint.key));
}
