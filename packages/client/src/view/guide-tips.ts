/**
 * Guided mode's opportunistic tips (G10e part 1, `docs/guided-mode.md` §5.3): a short note the first time
 * something outside the five scripted lessons happens on the table, at the Full guide level only. Each tip is a
 * named, tested trigger over a `LessonObservation` (`view/lesson-model.ts` — the same `{ game, lastEvents,
 * perspectiveId }` shape the scripted lessons watch) and `GuidePrefs.seenTips`, so a controller can call this
 * alongside the lesson model with no extra state to thread through.
 *
 * **Two kinds, same as the parked prototype (`docs/guided-mode.md` §7, `cf134edf` `view/guide/game-tips.ts`):**
 *  - **Keyword and status tips come from the table's own glossary** (`rules-reference.ts`'s `rulesGlossaryOf`),
 *    generically — a new pack's keyword gets a tip for free, no copy added here. The three always-present
 *    table-state entries (exhausted, ready, facedown boost card) are excluded, same as the prototype: they would
 *    fire on the very first frame of every game, which teaches nothing.
 *  - **Situations** are read off live state and the most recent command's events: the first minion engaging, a
 *    side scheme or crisis icon in play, acceleration adding up, a boost card flipping, the villain advancing a
 *    stage, an obligation or nemesis card showing up, the first mulligan, the first Recover, hand size differing
 *    by form, and the first time an attack against you drew a card (a Spider-Sense-style interrupt, detected
 *    generically — see `drawOnAttackTip`).
 *
 * **No deps in the observation.** `LessonObservation` (deliberately) carries no `EngineDeps` — lesson predicates
 * never needed one. `tipsFor` takes its own `deps` parameter instead (G10e part 2), threaded straight through to
 * the queries that need one (`iconsInPlay`, `rulesGlossaryOf`) — the board's own mount
 * passes the session's real `EngineDeps` (`content/pool.ts`'s `POOL_DEPS`), so an ability-*granted* icon or
 * keyword counts here the same way it does everywhere else on the table, not just a printed one.
 *
 * **Never leaks hidden information** (`view/visibility.ts`'s rule, same as `view/guide-hints.ts`): nothing here
 * reads a facedown boost card's icons before it flips, or the encounter deck's order.
 *
 * **`tipsFor` is the one export a controller calls.** It returns at most one tip — the first not-yet-seen,
 * not-suppressed candidate, situations before the generic glossary catch-all, each family in the order this
 * module defines it — or an empty array when nothing new is showing, the level isn't "full", or there's no
 * perspective player yet.
 */
import type { HeroIdentityCard } from "@mc/content";
import {
  cardOf,
  getInstance,
  getPlayer,
  heroFacesOf,
  iconsInPlay,
  minionsEngagedWith,
  type CardInstance,
  type EngineDeps,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import type { GuidePrefs } from "../guide/guide-prefs.js";
import type { LessonObservation } from "./lesson-model.js";
import { rulesGlossaryOf } from "./rules-reference.js";

export interface Tip {
  readonly id: string;
  readonly title: string;
  /** `McTermText` markup (`[[id]]` / `[[id|label]]`, see `view/term-text-model.ts`). Links a glossary term where
   * one exists for the idea being taught — a couple of situations (the first mulligan) have no matching glossary
   * entry yet and are plain text; see that trigger's own comment. */
  readonly body: string;
}

const EXCLUDED_TABLE_STATE_IDS = new Set(["exhausted", "ready", "facedownBoostCard"]);

// ---------------------------------------------------------------------------
// Situations
// ---------------------------------------------------------------------------

function heroIdentityCardOf(state: LessonObservation["game"], playerId: PlayerId): HeroIdentityCard | undefined {
  const player = getPlayer(state, playerId);
  if (!player) return undefined;
  const card = cardOf(state, player.identity.instanceId);
  return card?.type === "hero_identity" ? card : undefined;
}

/** RRG 1.8 "Obligation" (p. 30): a drawn obligation goes straight to its owner's play area, not their hand. */
function obligationTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const revealed = lastEvents.some(
    (event) => event.type === "drawnObligationPlaced" && event.playerId === perspectiveId,
  );
  if (!revealed) return null;
  return {
    id: "situation:obligation",
    title: "An obligation entered play",
    body:
      "This is an obligation: an [[encounterCard|encounter card]] tied to your identity. It went straight into " +
      "your play area instead of your hand, and it usually stays there until something removes it.",
  };
}

/**
 * RRG 1.8 "Nemesis Encounter Set" (p. 30): cards written for one identity, shuffled into the encounter deck at
 * setup rather than a shared modular set. Detected by the revealed card's `encounterSetIds` matching the
 * perspective player's own identity (`HeroIdentityCard.nemesisEncounterSetId`) — the same match setup itself uses.
 */
function nemesisSetTip({ game, lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const identity = heroIdentityCardOf(game, perspectiveId);
  if (!identity) return null;
  const revealed = lastEvents.some((event) => {
    if (event.type !== "encounterCardRevealed") return false;
    const card = cardOf(game, event.instanceId);
    return (
      card !== undefined && "encounterSetIds" in card && card.encounterSetIds.includes(identity.nemesisEncounterSetId)
    );
  });
  if (!revealed) return null;
  return {
    id: "situation:nemesisSet",
    title: "Your nemesis set is in play",
    body:
      "This card is from your identity's own nemesis set: [[encounterCard|encounter cards]] written just for " +
      "your hero, shuffled into the encounter deck at setup alongside the villain's own.",
  };
}

/**
 * The first mulligan (RRG 1.8 Appendix II "Setup" step 15, p. 51): detected as leaving the setup mulligan step
 * (`stepChanged` with `from.kind === "mulligan"`) after the perspective player actually discarded at least one
 * card during it (`cardDiscardedFromHand`) — keeping a whole opening hand doesn't teach anything new. G10e part 2
 * added a `mulligan` glossary concept (`@mc/content`'s concept list, `docs/guided-mode.md` G3a) that this now links.
 */
function mulliganTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const leftMulligan = lastEvents.some(
    (event) => event.type === "stepChanged" && event.from.phase === "setup" && event.from.kind === "mulligan",
  );
  if (!leftMulligan) return null;
  const discardedMine = lastEvents.some(
    (event) => event.type === "cardDiscardedFromHand" && event.playerId === perspectiveId,
  );
  if (!discardedMine) return null;
  return {
    id: "situation:mulligan",
    title: "Mulligan",
    body:
      "At the start of the game you can take a [[mulligan|mulligan]]: discard any number of cards from your " +
      "opening hand and draw that many new ones, once, before play really begins.",
  };
}

function minionEngagedTip({ game, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  if (minionsEngagedWith(game, perspectiveId).length === 0) return null;
  return {
    id: "situation:minionEngaged",
    title: "A minion is engaged with you",
    body:
      "It stays with you until it's defeated, and it activates against you every [[villainPhase|villain phase]] " +
      "— attacking your hero, or scheming against your alter-ego.",
  };
}

function sideSchemeTip({ game }: LessonObservation): Tip | null {
  const inPlay = game.villainArea.some((id) => {
    const card = cardOf(game, id);
    return card?.type === "side_scheme" || card?.type === "player_side_scheme";
  });
  if (!inPlay) return null;
  return {
    id: "situation:sideScheme",
    title: "A side scheme is in play",
    body:
      "A [[sideScheme|side scheme]] is an extra objective next to the main scheme, with its own starting threat. " +
      "You don't have to clear it, but leaving it alone usually costs you.",
  };
}

/** RRG 1.8 "Crisis Icon" (p. 14): while any crisis icon is in play, player cards can't remove threat from the main scheme. */
function crisisTip({ game }: LessonObservation, deps: EngineDeps): Tip | null {
  if (iconsInPlay(game, deps, "crisis") <= 0) return null;
  return {
    id: "situation:crisis",
    title: "Crisis: the main scheme is locked",
    body:
      "While a crisis icon is in play, your cards can't remove [[threat|threat]] from the main scheme — clearing " +
      "whatever carries the icon comes first.",
  };
}

/**
 * Fires only once *extra* acceleration exists — `mainSchemeValue(game, "acceleration", deps)` is the main scheme's
 * own printed per-phase rate, which is nonzero on many schemes from the very first frame of the game and teaches
 * nothing on its own; the tip's own copy is about acceleration piling up *on top of* that printed rate, so the
 * trigger checks only `accelerationTokens` and any acceleration icon actually in play, not the printed value.
 */
function accelerationTip({ game }: LessonObservation, deps: EngineDeps): Tip | null {
  const extra = game.mainScheme.accelerationTokens + iconsInPlay(game, deps, "acceleration");
  if (extra <= 0) return null;
  return {
    id: "situation:acceleration",
    title: "Acceleration is adding up",
    body: "[[acceleration|Acceleration]] adds extra threat to the main scheme every villain phase, on top of its own printed rate.",
  };
}

function boostCardFlippedTip({ lastEvents }: LessonObservation): Tip | null {
  if (!lastEvents.some((event) => event.type === "boostCardFlipped")) return null;
  return {
    id: "situation:boostFlip",
    title: "A boost card flipped",
    body:
      "Enemies get a facedown [[boost|boost card]] the moment they activate. It turns face up during that " +
      "activation, adding its icons — sometimes its own effect too — to the total.",
  };
}

function villainStageAdvancedTip({ lastEvents }: LessonObservation): Tip | null {
  const revealed = lastEvents.some((event) => event.type === "villainStageRevealed");
  if (!revealed && !lastEvents.some((event) => event.type === "villainStageAdvanced")) return null;
  return {
    id: "situation:villainStageAdvanced",
    title: "The villain advanced a stage",
    body: revealed
      ? "Villains fight in stages. A card effect, such as a scheme, can reveal the next stage with no defeat, at full hit points."
      : "Villains fight in stages. Defeating one flips the villain to its next stage — often stronger — instead of ending the game.",
  };
}

function recoverTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const used = lastEvents.some(
    (event) =>
      event.type === "triggerEvent" &&
      event.event.kind === "basicPowerUsed" &&
      event.event.power === "recover" &&
      event.event.playerId === perspectiveId,
  );
  if (!used) return null;
  return {
    id: "situation:recover",
    title: "You recovered",
    body: "[[recover|Recovering]] is your alter-ego's basic power to heal damage, for the cost of exhausting your alter-ego.",
  };
}

function handSizeDiffersTip({ game, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const identity = heroIdentityCardOf(game, perspectiveId);
  if (!identity) return null;
  const heroSizes = heroFacesOf(identity).map((face) => face.handSize);
  if (heroSizes.every((size) => size === identity.alterEgo.handSize)) return null;
  return {
    id: "situation:handSizeDiffers",
    title: "Hand size differs by form",
    body: "Your [[handSize|hand size]] isn't the same in hero and alter-ego form — check the number on whichever side is face up.",
  };
}

/**
 * A Spider-Sense-style "draw a card when you're attacked" interrupt, detected generically rather than by naming
 * any specific card: the perspective player's own identity was an attack's target (`attackResolved`) and that
 * same command also drew them a card (`cardDrawn`). This can't tell *why* the draw happened — deps has no ability
 * registry to hand here (this module's own header) — so it's a heuristic, not a proof that the identity's own
 * interrupt fired; good enough for a once-ever tip that never reads hidden information.
 */
function drawOnAttackTip({ game, lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const player = getPlayer(game, perspectiveId);
  if (!player) return null;
  const heroId = player.identity.instanceId;
  const wasAttacked = lastEvents.some((event) => event.type === "attackResolved" && event.targetInstanceId === heroId);
  if (!wasAttacked) return null;
  const drewACard = lastEvents.some((event) => event.type === "cardDrawn" && event.playerId === perspectiveId);
  if (!drewACard) return null;
  return {
    id: "situation:drawOnAttack",
    title: "You drew a card from that attack",
    body: "Some heroes have an interrupt that draws them a card whenever they're attacked — a small edge for being ready for it.",
  };
}

// ---------------------------------------------------------------------------
// Wave 6: Mutant Genesis and MojoMania (guided mode section 3.14)
// ---------------------------------------------------------------------------

/** A printed id without its face letter: "34002a" and "34002b" are one physical card on the table. */
const baseCardId = (id: unknown): string => String(id).replace(/[ab]$/, "");

/** Every instance that counts as "on the table" for a wave 6 tip: identities, play areas, the villain area, the main scheme, and what is attached to any of those. */
function tableInstances(game: LessonObservation["game"]): readonly CardInstance[] {
  const roots: InstanceId[] = [
    ...game.players.flatMap((player) => [player.identity.instanceId, ...player.playArea]),
    ...game.villainArea,
    game.mainScheme.instanceId,
  ];
  const seen = new Set<InstanceId>(roots);
  for (const id of roots) for (const attached of getInstance(game, id)?.attachments ?? []) seen.add(attached);
  return [...seen].flatMap((id) => {
    const instance = getInstance(game, id);
    return instance ? [instance] : [];
  });
}

const tableHas = (game: LessonObservation["game"], printedIds: ReadonlySet<string>): boolean =>
  tableInstances(game).some((instance) => printedIds.has(baseCardId(instance.cardId)));

const SHOW_ENVIRONMENT_IDS = ["39035", "39041", "39047", "39053", "39060", "39066"];
const ROLE_UPGRADE_IDS = Array.from({ length: 20 }, (_, index) => String(32176 + index));
const FUTURE_PAST_IDS = ["32171", "32172", "32173", "32174", "32175"];
/** Counter types wave 6 introduced: steel (Colossus), power (Phoenix), charge (Gambit), magnet (Magneto), ratings (MaGog), teleport (Spiral). */
const WAVE_6_COUNTERS = new Set(["steel", "power", "charge", "magnet", "ratings", "teleport"]);

/** A tip that fires while one of `printedIds` is on the table, reading no hidden information (every card here is faceup in play). */
function onTableTip(tip: Tip, printedIds: readonly string[]): SituationTrigger {
  const ids = new Set(printedIds);
  return ({ game }) => (tableHas(game, ids) ? tip : null);
}

/** RRG 1.8 "Teamwork (Trait)" (p. 43); the order against When Revealed is the glossary entry's own flagged conflict. */
function teamworkTip({ lastEvents }: LessonObservation): Tip | null {
  const resolved = lastEvents.some((event) => event.type === "keywordResolved" && event.keyword === "teamwork");
  if (!resolved) return null;
  return {
    id: "situation:teamwork",
    title: "Teamwork: a minion activated",
    body:
      "A minion with [[teamwork|Teamwork]] just engaged you while another minion sharing its trait was in play, " +
      "so it activated against you right away.",
  };
}

/** Shadowcat's Solid and Phased are an additional form (RRG 1.8 "Form", p. 21), so a flip between them is an `additionalFormChanged`. */
function massFormTip({ lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const changed = lastEvents.some(
    (event) => event.type === "additionalFormChanged" && event.formType === "mass" && event.playerId === perspectiveId,
  );
  if (!changed) return null;
  return {
    id: "situation:massForm",
    title: "Mass form changed",
    body:
      "Solid and Phased are a [[form|form of their own]], beside hero and alter-ego. Changing between them doesn't " +
      "use your once-per-round form change, but it still counts as changing form for card effects.",
  };
}

function countersTip({ lastEvents }: LessonObservation): Tip | null {
  const placed = lastEvents.some((event) => event.type === "counterAdded" && WAVE_6_COUNTERS.has(event.counterType));
  if (!placed) return null;
  return {
    id: "situation:counters",
    title: "Counters on a card",
    body:
      "[[counters|Counters]] like this are kept on the card that names them. Cards read the number, and a cost " +
      "that removes counters can only be paid while enough are there.",
  };
}

/** Storm's four WEATHER supports are 36002-36005; a swap that names one of them is Weather Control or Weather Goddess. */
function weatherSwapTip({ lastEvents }: LessonObservation): Tip | null {
  const weather = new Set(["36002", "36003", "36004", "36005"]);
  const swapped = lastEvents.some(
    (event) => event.type === "cardsSwapped" && event.cardIds.some((id) => weather.has(baseCardId(id))),
  );
  if (!swapped) return null;
  return {
    id: "situation:weatherSwap",
    title: "You swapped the weather",
    body:
      "The [[weatherDeck|Weather deck]] swaps the Weather in play for one you chose, then resolves the new Weather's " +
      "Special. The old one goes back into the facedown deck.",
  };
}

function phoenixForceFlippedTip({ lastEvents }: LessonObservation): Tip | null {
  const flipped = lastEvents.some(
    (event) => event.type === "cardFlippedToOtherFace" && baseCardId(event.from) === "34002",
  );
  if (!flipped) return null;
  return {
    id: "situation:phoenixForce",
    title: "Phoenix Force flipped",
    body:
      "[[phoenixForce|Phoenix Force]] changes sides with its power counters: RESTRAINED turns UNLEASHED when the " +
      "last counter is removed, and back again at 4 or more.",
  };
}

/** Touched on any character other than its owner's own identity: attached to something. */
function touchedTip({ game }: LessonObservation): Tip | null {
  const attached = tableInstances(game).some(
    (instance) => baseCardId(instance.cardId) === "38002" && instance.attachedTo !== null,
  );
  if (!attached) return null;
  return {
    id: "situation:touched",
    title: "Touched is on a character",
    body:
      "[[touched|Touched]] gives Rogue that character's traits while it stays there, plus a bonus that depends on " +
      "whether it is a minion, villain, ally or hero.",
  };
}

/** Threat sitting on a card that is not a scheme (MojoMania's characters, Paparazzi). */
function threatOnCharacterTip({ game }: LessonObservation): Tip | null {
  const SCHEME_TYPES = new Set(["main_scheme", "side_scheme", "player_side_scheme"]);
  const found = tableInstances(game).some((instance) => {
    if (instance.threat <= 0) return false;
    const card = game.cardPool[instance.cardId as unknown as string];
    return card !== undefined && !SCHEME_TYPES.has(card.type);
  });
  if (!found) return null;
  return {
    id: "situation:threatOnCharacters",
    title: "Threat on a character",
    body:
      "This [[threatOnCharacters|threat]] sits on a character, not a scheme. It moves to the main scheme when that " +
      "character flips or leaves play.",
  };
}

const WAVE_6_ON_TABLE_TIPS: readonly SituationTrigger[] = [
  onTableTip(
    {
      id: "situation:tacticUpgrades",
      title: "A Temporary upgrade is on an enemy",
      body:
        "Cyclops's [[tacticUpgrades|Tactic upgrades]] on enemies are [[temporary|Temporary]]: they are discarded at " +
        "the end of the round, unless Field Commander is keeping the ones on minions.",
    },
    ["33005", "33006", "33007"],
  ),
  onTableTip(
    {
      id: "situation:robertKelly",
      title: "Robert Kelly",
      body:
        "[[robertKelly|Robert Kelly]] is in play. Keep him alive: if he leaves play the players lose, and once the " +
        "first player controls him he soaks the damage of undefended attacks.",
    },
    ["32066"],
  ),
  onTableTip(
    {
      id: "situation:wideawake",
      title: "Operation Zero Tolerance",
      body:
        "[[wideawake|Operation Zero Tolerance]] collects allies that enemy attacks defeat, facedown. Too many " +
        "under it and the players lose, so protect your allies.",
    },
    ["32104"],
  ),
  onTableTip(
    {
      id: "situation:mansionAttack",
      title: "Mansion Attack",
      body:
        "[[mansionAttack|Mansion Attack]] runs four villains one at a time, with shuffled main scheme stages. " +
        "Defeating a villain reveals the next, and three main schemes in the victory display lose the game.",
    },
    ["32125"],
  ),
  onTableTip(
    {
      id: "situation:futurePast",
      title: "A Future Past side scheme",
      body:
        "Defeating a [[futurePast|Future Past]] side scheme shuffles the top card of the Future Past deck into the " +
        "encounter deck, then flips the scheme to its helpful side.",
    },
    FUTURE_PAST_IDS,
  ),
  onTableTip(
    {
      id: "situation:roleUpgrade",
      title: "A role upgrade",
      body:
        "Your [[campaignRoles|role]] upgrades are one-use: playing the effect removes the card from the game and " +
        "from the campaign pool for good.",
    },
    ROLE_UPGRADE_IDS,
  ),
  onTableTip(
    {
      id: "situation:showDeck",
      title: "A SHOW environment",
      body:
        "A [[showDeck|SHOW]] is an environment from a genre set, and revealing one discards the other SETTING " +
        "environments. Spiral's extra SHOWs wait in a show deck you can't search.",
    },
    ["39015", ...SHOW_ENVIRONMENT_IDS],
  ),
  onTableTip(
    {
      id: "situation:wheelOfGenres",
      title: "The Wheel of Genres",
      body:
        "The [[wheelOfGenres|Wheel of Genres]] flips each time the encounter deck resets, and the next villain phase " +
        "brings in a new genre. If no set-aside genres remain at a reset, the players lose.",
    },
    ["39026"],
  ),
  onTableTip(
    {
      id: "situation:ratingsCounters",
      title: "Ratings counters",
      body:
        "Win the crowd with [[ratingsCounters|ratings counters]]: 10 per hero on The Challengers wins, 10 on The " +
        "Champion loses. Each crowd flips at 5 per hero.",
    },
    ["39003", "39004"],
  ),
  onTableTip(
    {
      id: "situation:longshot",
      title: "Longshot joined you",
      body:
        "[[longshot|Longshot]] is an ally that came out of the encounter deck. He fights for you, his attacks gain " +
        "[[piercing]], and he doesn't count against your ally limit.",
    },
    ["39071"],
  ),
];

// ---------------------------------------------------------------------------
// Wave 7: NeXt Evolution (guided mode section 3.14)
// ---------------------------------------------------------------------------

/** A player side scheme on the table: RRG 1.8 "Player Side Scheme" (p. 34). */
function playerSideSchemeTip({ game }: LessonObservation): Tip | null {
  const found = game.villainArea.some((id) => {
    const instance = getInstance(game, id);
    return instance !== undefined && game.cardPool[instance.cardId as unknown as string]?.type === "player_side_scheme";
  });
  if (!found) return null;
  return {
    id: "situation:playerSideScheme",
    title: "A player side scheme",
    body:
      "A [[playerSideScheme|player side scheme]] is a mission you play. Thwart it like any side scheme. Only one can " +
      "be in play with 1 or 2 players (two with 3 or 4), and a new one discards the old.",
  };
}

/** RRG 1.8 "Player Side Scheme Limit" (p. 34): the discard is not a defeat. */
function sideSchemeLimitTip({ lastEvents }: LessonObservation): Tip | null {
  if (!lastEvents.some((event) => event.type === "playerSideSchemeLimitDiscard")) return null;
  return {
    id: "situation:sideSchemeLimit",
    title: "Over the side scheme limit",
    body:
      "That player side scheme was discarded to stay at the [[playerSideScheme|limit]]. Being discarded this way " +
      "is not a defeat, so nothing triggers and it earns no Victory.",
  };
}

/** Team Investigation (40053) and Break Time (44046) print a per player cost. */
function perPlayerCostTip({ lastEvents }: LessonObservation): Tip | null {
  const played = lastEvents.some(
    (event) => event.type === "cardPlayed" && ["40053", "44046"].includes(baseCardId(event.cardId)),
  );
  if (!played) return null;
  return {
    id: "situation:perPlayerCost",
    title: "A cost that scales",
    body:
      "That card's [[perPlayerCost|cost is per player]]: the printed number times the players who started the " +
      "game. In a 2-player game, 2 per player is 4.",
  };
}

/** Dreadpool (44038) and Dreadful Deeds (44039) come from Crisis of Infinite Deadpools. */
const dreadpoolTip = onTableTip(
  {
    id: "situation:poolAspect",
    title: "The Dreadpool set",
    body:
      "The Dreadpool set is in the game because a player chose the [[poolAspect|'Pool aspect]]. Including 'Pool " +
      "cards from another aspect would not have brought it in.",
  },
  ["44038", "44039"],
);

/** The four Specialists (X-23's linked upgrades). */
const specialistsTip = onTableTip(
  {
    id: "situation:specialists",
    title: "A Specialist is in play",
    body:
      "[[specialists|Specialists]] are linked cards: set aside at the start, never in a deck, and brought out by " +
      "Specialized Training. Whoever controls one owns it.",
  },
  ["43034", "43035", "43036", "43037"],
);

/** A formChanged on a player whose identity is Angel (42001): the three-face fold. */
function threeFaceTip({ game, lastEvents, perspectiveId }: LessonObservation): Tip | null {
  if (!perspectiveId) return null;
  const player = getPlayer(game, perspectiveId);
  if (!player) return null;
  const isAngel = baseCardId(getInstance(game, player.identity.instanceId)?.cardId) === "42001";
  const changed = lastEvents.some((event) => event.type === "formChanged" && event.playerId === perspectiveId);
  if (!isAngel || !changed) return null;
  return {
    id: "situation:threeFaceIdentity",
    title: "A three-sided identity",
    body:
      "Angel has [[threeFaceIdentity|three faces]]: alter-ego, Angel and Archangel. Any switch between them is a " +
      "change of form, and cards that name a face read the one showing.",
  };
}

const psiBladesTip = onTableTip(
  {
    id: "situation:psiBlades",
    title: "Psi-Knife upgrades",
    body:
      "Psylocke's [[psiBlades|Psi-Knife]] upgrades are permanent and double-sided. Psi-Energy Control flips one when " +
      "you use a basic power, and the Psi-Katana side is restricted.",
  },
  ["41002"],
);

const hopeSummersTip = onTableTip(
  {
    id: "situation:hopeSummers",
    title: "Hope Summers",
    body:
      "[[hopeSummers|Hope Summers]] is controlled by the first player, so she changes hands with the first player " +
      "token. If she leaves play, the players lose.",
  },
  ["40130"],
);

const routedTip = onTableTip(
  {
    id: "situation:routed",
    title: "Routed",
    body:
      "Each villain you defeat goes under [[routed|Routed]], out of play, and the next one steps in. Three villains " +
      "under it wins the game.",
  },
  ["40081"],
);

/** The Superpower attachments (Flight, Super Strength, Telepathy) in play on a villain. */
const setupAttachmentsTip = onTableTip(
  {
    id: "situation:setupAttachments",
    title: "A Superpower attachment",
    body:
      "A Superpower is attached to the villain, by the Setup keyword or a stage's When Revealed. See " +
      "[[setupAttachments|Setup attachments]] for which scenario does which.",
  },
  ["40151", "40155", "40159"],
);

/** Every situation trigger takes `deps` even when it doesn't read one, so `tipsFor` can map over them uniformly. */
type SituationTrigger = (observation: LessonObservation, deps: EngineDeps) => Tip | null;

const SITUATION_TIPS: readonly SituationTrigger[] = [
  obligationTip,
  nemesisSetTip,
  mulliganTip,
  minionEngagedTip,
  sideSchemeTip,
  crisisTip,
  accelerationTip,
  boostCardFlippedTip,
  villainStageAdvancedTip,
  recoverTip,
  handSizeDiffersTip,
  drawOnAttackTip,
  teamworkTip,
  massFormTip,
  countersTip,
  weatherSwapTip,
  phoenixForceFlippedTip,
  touchedTip,
  threatOnCharacterTip,
  ...WAVE_6_ON_TABLE_TIPS,
  playerSideSchemeTip,
  sideSchemeLimitTip,
  perPlayerCostTip,
  dreadpoolTip,
  specialistsTip,
  threeFaceTip,
  psiBladesTip,
  hopeSummersTip,
  routedTip,
  setupAttachmentsTip,
];

// ---------------------------------------------------------------------------
// Keyword and status tips (generic, from the glossary)
// ---------------------------------------------------------------------------

function glossaryTips(game: LessonObservation["game"], deps: EngineDeps): readonly Tip[] {
  return rulesGlossaryOf(game, deps)
    .filter((entry) => !EXCLUDED_TABLE_STATE_IDS.has(entry.id))
    .map((entry) => ({
      id: `keyword:${entry.id}`,
      title: `New on the table: ${entry.displayName}`,
      body: `[[${entry.id}|${entry.displayName}]] — ${entry.definition}`,
    }));
}

// ---------------------------------------------------------------------------
// tipsFor
// ---------------------------------------------------------------------------

/**
 * Every tip fired for `observation`, filtered to `prefs.seenTips` and `suppress`, most-relevant first (situations,
 * in this module's own order, then the generic glossary catch-all, alphabetical by term) — but returns at most
 * one, since a guide surface shows one tip at a time (§5.3: "each is one line"). Empty at any level but "full", or
 * with no `perspectiveId` yet. `deps` should be the session's real `EngineDeps` (the board's own `POOL_DEPS`), not
 * `DEFAULT_DEPS`, so an ability-granted icon or keyword counts (this module's own header).
 */
export function tipsFor(
  observation: LessonObservation,
  deps: EngineDeps,
  prefs: GuidePrefs,
  suppress: readonly string[] = [],
): readonly Tip[] {
  if (prefs.level !== "full") return [];
  if (!observation.perspectiveId) return [];

  const candidates = [
    ...SITUATION_TIPS.map((trigger) => trigger(observation, deps)).filter((tip): tip is Tip => tip !== null),
    ...glossaryTips(observation.game, deps),
  ];

  const tip = candidates.find(
    (candidate) => !prefs.seenTips.includes(candidate.id) && !suppress.includes(candidate.id),
  );
  return tip ? [tip] : [];
}
