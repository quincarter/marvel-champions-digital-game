import {
  applyCommand,
  cardsMatch,
  characterProfile,
  createGame,
  printedResources,
  replay,
  restrictedStanding,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, firstLegal, moveToHand, patchInstance, playerOf, settle, use } from "../../testing/harness.js";
import { stackSetAsideBehindBoost, withDamage, withForm } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 60_000 });

/**
 * Whole games with Deadpool's precon (`deadpool-pool`, cards 44001-44031) through the real engine and the real wave 7
 * scripts, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) one command at a time, so that
 * every state is checked against the invariants below:
 *
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered. Two prompts have no
 *   option list by design and are answered from a per-game policy that is recorded: `reportFact` `minutesAway` (Break
 *   Time 44046: one decimal-digit string) and `talkedThisPhase` (The Merc with the Mouth 44032: yes or no);
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52), and
 *   rounds advance by exactly one;
 * - every instance sits in exactly one zone; every card a player's deck started with is still somewhere and still
 *   owned by that player (RRG 1.8 "Owner", "Controller", p. 31; a card another player takes with Plot Convenience 44050
 *   stays its owner's); a card fetched from the collection by Armed to the Teeth 44009 is a NEW instance owned by the
 *   searcher, so the instance count grows by exactly one per fetch (RRG 1.8 "Search", p. 39); cards in a player's
 *   deck or discard pile are that player's;
 * - no two unique cards match across the table (RRG 1.8 "Unique Icon", p. 45): Cable's identity never sits beside
 *   the Cable ally of Deadpool's deck;
 * - the restricted limit holds while no prompt is open (RRG 1.8 "Restricted", p. 38); Laser Swords 44055 weighs 2;
 * - the first player token passes to the next seat at the end of each round (RRG 1.8 "First Player", p. 20);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Deviations from the driver, all policy and not rules: Hope Summers is never declared a defender (Stryfe: "If Hope
 * Summers is defeated, you lose"), nor a Morlock in Morlock Siege (its main scheme loses the game with no Morlock ally
 * in play), a hero defends when Hope is the target, and a turn is ended after 40 commands.
 *
 * Deadpool's rules the observer checks wherever a game reaches them (the `seen` tally; the last test asserts each was
 * seen at least once, naturally or staged, as each test says): the Dreadpool set at setup (Deadpool insert, RRG 1.8
 * FAQ p. 64), his regeneration (44001a: damage leaves 1 remaining hit point, change to Wade Wilson, +1 acceleration
 * token) and Wade being eliminated at 0, Crisis of Infinite Deadpools, the chosen amount of Maximum Effort and "Yoo-Hoo!",
 * the computed yield of Self cards and Montage, Cable's stats following the tokens (cap +3), This Card is Fire, The Merc
 * with the Mouth, Git Gud with and without the previous-game fact, Armed to the Teeth, Involuntary Procedures and
 * Tabula Rasa 16.
 */

const DEADPOOL = { starterDeckId: "deadpool-pool" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
type Seat = typeof DEADPOOL | typeof CABLE;

const HOPE_SUMMERS = "40130";
const REGEN = "44001a.the-regeneratin-degenerate";
const CRISIS = "44037";
const DREADPOOL_MINION = "44038";
const DEADLY_DEEDS = "44039";
const DREADPOOL_SET = ["44037", "44038", "44039", "44040", "44041", "44041", "44042"];
const MERC = "44032";
const MAX_EFFORT = "44004";
const YOO_HOO = "44006";
const CABLE_ALLY = "44002";
const IP = "44034";
const TABULA = "44035";
const GIT_GUD = "44028";
const ARMED = "44009";
const LASER_SWORDS = "44055";
const PLOT = "44050";
const MONTAGE = "44007";
const SELF_CARDS = ["44025", "44026", "44027"];
const FIRE = "44012";

/** Which targeted checks were observed, and where. */
const seen = {
  dreadpoolSetupOne: [] as string[],
  dreadpoolSetupTwo: [] as string[],
  noDreadpoolWithoutPool: [] as string[],
  regeneration: [] as string[],
  wadeEliminated: [] as string[],
  crisisRevealed: [] as string[],
  crisisCancelled: [] as string[],
  maxEffortZero: [] as string[],
  maxEffortPositive: [] as string[],
  yooHooZero: [] as string[],
  yooHooPositive: [] as string[],
  selfCard: [] as string[],
  montage: [] as string[],
  cableAllyStats: [] as string[],
  cableAllyCap: [] as string[],
  thisCardIsFire: [] as string[],
  mercInPlay: [] as string[],
  mercAlliesExhausted: [] as string[],
  mercAskedOnce: [] as string[],
  mercYes: [] as string[],
  mercNo: [] as string[],
  mercOtherPlayerRefused: [] as string[],
  gitGudReduced: [] as string[],
  gitGudFull: [] as string[],
  armedSearch: [] as string[],
  armedSwap: [] as string[],
  involuntaryProcedures: [] as string[],
  involuntaryLethal: [] as string[],
  tabulaRasa: [] as string[],
  twoPlayerTokenPasses: [] as string[],
  plotConvenience: [] as string[],
};

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
}

const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const PLAYER_CARD_TYPES: readonly string[] = ["ally", "event", "resource", "support", "upgrade", "player_side_scheme"];
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const deadpoolOf = (s: GameState) => s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("44001"));
const allOfCode = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);

/** Every list an instance can be in, labeled; attachments, tucked and boost cards are listed under their host. */
function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [name, d] of Object.entries(s.scenarioDecks)) {
    const deck = d as { deck?: readonly InstanceId[]; discard?: readonly InstanceId[] };
    for (const id of deck.deck ?? []) add(id, `scenarioDeck.${name}`);
    for (const id of deck.discard ?? []) add(id, `scenarioDeck.${name}.discard`);
  }
  for (const [name, ids] of Object.entries(s.scenarioAreas ?? {})) for (const id of ids) add(id, `area.${name}`);
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const a of instance.attachments) add(a, `attachedTo.${id}`);
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  // A villain stage and the main scheme are in play without being in a zone list (`villains` is a roster that keeps
  // defeated villains, tucked or removed ones included, so it is not itself a zone).
  for (const v of s.villains) if (!index.has(v.instanceId)) add(v.instanceId, "villain");
  if (!index.has(s.mainScheme.instanceId)) add(s.mainScheme.instanceId, "mainScheme");
  return index;
}

/** Cards a player controls that are in play: the identity, the play area and everything attached to those. */
function inPlayOf(s: GameState, playerId: PlayerId): InstanceId[] {
  const player = s.players.find((p) => p.playerId === playerId)!;
  const roots = [player.identity.instanceId, ...player.playArea];
  return roots.flatMap((id) => [id, ...(s.instances[id]!.attachments as readonly InstanceId[])]);
}

interface Ledger {
  /** Every card a player's deck started with, to that player. */
  readonly dealtTo: Map<string, PlayerId>;
  /** The instance count at setup. */
  readonly initialCount: number;
  /** `cardAddedFromCollection` events so far (each adds exactly one instance). */
  fetches: number;
}

/**
 * Throws a descriptive error on the first broken invariant of `state`. Ownership of the deck's own cards is read from
 * setup (`dealtTo`), because encounter cards change owner when a rule says so.
 */
function checkState(s: GameState, ledger: Ledger, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    // `reportFact` with a whole-number answer has no options by design: it takes one decimal-digit string.
    const numberReport = choice.prompt.kind === "reportFact" && choice.prompt.answer === "wholeNumber";
    if (!numberReport && choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${cardName(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  for (const id of Object.keys(s.instances))
    if (!zones.has(id)) fail(`${id} (${cardName(s, id as InstanceId)}) is in no zone`);
  for (const id of zones.keys()) if (!s.instances[id]) fail(`${id} is in a zone but is no instance`);
  // Cards are conserved: only a collection fetch (Armed to the Teeth) makes a new instance, one per fetch.
  const count = Object.keys(s.instances).length;
  if (count !== ledger.initialCount + ledger.fetches)
    fail(`${count} instances, expected ${ledger.initialCount} + ${ledger.fetches} collection fetches`);
  for (const [id, owner] of ledger.dealtTo)
    if (s.instances[id]!.ownerId !== owner)
      fail(`${cardName(s, id as InstanceId)} (${id}) dealt to ${owner} is owned by ${s.instances[id]!.ownerId}`);
  for (const p of s.players) {
    for (const zone of ["deck", "discard"] as const)
      for (const id of p[zone]) {
        const owner = s.instances[id]!.ownerId;
        if (owner !== p.playerId) fail(`${cardName(s, id)} (${id}, owned by ${owner}) is in ${p.playerId}'s ${zone}`);
      }
  }
  // Unique Icon (RRG p. 45): no two matching unique cards in play at once, across the whole table.
  const table = s.players.filter((p) => !p.eliminated).flatMap((p) => inPlayOf(s, p.playerId));
  for (let i = 0; i < table.length; i++)
    for (let j = i + 1; j < table.length; j++) {
      const a = s.cardPool[s.instances[table[i]!]!.cardId]!;
      const b = s.cardPool[s.instances[table[j]!]!.cardId]!;
      if (cardsMatch(a, b))
        fail(`unique cards ${a.name} (${table[i]}) and ${b.name} (${table[j]}) match and are both in play`);
    }
  // Restricted (RRG p. 38): at most the limit (Laser Swords weighs 2), except while a prompt (the discard down) is open.
  if (!choice)
    for (const p of s.players) {
      const standing = restrictedStanding(s, WAVE7_DEPS, p.playerId);
      if (standing.load > standing.limit)
        fail(`${p.playerId} carries ${standing.load} restricted weight, the limit is ${standing.limit}`);
    }
}

/**
 * The driver's own answer, except that Hope Summers and a Morlock never defend, and that when Hope Summers herself is
 * the attacked character a hero that can defend does; and the per-game policy answers for the prompts the driver does
 * not know: `chooseNumber` (Maximum Effort / "Yoo-Hoo!"), `reportFact`.
 */
function ownAnswer(s: GameState, choice: PendingChoice, policy: Policy): readonly string[] | null {
  const prompt = choice.prompt;
  if (prompt.kind === "reportFact") {
    if (prompt.fact === "minutesAway") {
      const answer = String(policy.minutes[policy.asked.minutes++ % policy.minutes.length]);
      policy.answers.push(`minutesAway=${answer}`);
      return [answer];
    }
    const answer = policy.talked[policy.asked.talked++ % policy.talked.length]!;
    policy.answers.push(`talkedThisPhase=${answer}`);
    return [answer];
  }
  if (prompt.kind === "chooseNumber") {
    const pick = policy.numbers[policy.asked.numbers++ % policy.numbers.length]!;
    const amount =
      pick === "min" ? prompt.min : pick === "max" ? prompt.max : Math.min(prompt.max, Math.max(prompt.min, pick));
    policy.answers.push(`chooseNumber=${amount} of ${prompt.min}..${prompt.max}`);
    return [String(amount)];
  }
  if (prompt.kind === "chooseTriggers" && policy.metaOn) {
    const event = (prompt as unknown as { event?: { instanceId?: InstanceId } }).event;
    const revealed = event?.instanceId && s.instances[event.instanceId] ? codeOf(s, event.instanceId) : "";
    const take = choice.options
      .map((o) => o.optionId)
      .filter((id) => !id.includes("44005.metaknowledge") || policy.metaOn!.includes(revealed));
    if (take.length >= choice.minSelections) return take.slice(0, choice.maxSelections);
  }
  if (prompt.kind === "searchCollection" && policy.search && choice.options.some((o) => o.optionId === policy.search))
    return [policy.search];
  if (policy.prefer && ["chooseOption", "chooseCards", "chooseTarget"].includes(prompt.kind)) {
    for (const want of policy.prefer) {
      const hit = choice.options.find(
        (o) => o.label.includes(want) || (s.instances[o.optionId as InstanceId]?.cardId as string | undefined) === want,
      );
      if (hit) return [hit.optionId];
    }
  }
  if (prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const target = prompt.attack.targetCharacterInstanceId;
  const allies = ids.filter(
    (id) =>
      id !== "decline" &&
      cardType(s, id as InstanceId) === "ally" &&
      codeOf(s, id as InstanceId) !== HOPE_SUMMERS &&
      cardName(s, id as InstanceId) !== "Morlock",
  );
  if (allies[0]) return [allies[0]];
  if (codeOf(s, target) === HOPE_SUMMERS) {
    const hero = ids.find((id) => id !== "decline" && cardType(s, id as InstanceId) === "hero_identity");
    if (hero) return [hero];
  }
  return ids.includes("decline") ? ["decline"] : null;
}

/** The per-game answers to prompts the driver cannot answer (recorded in `answers`). */
interface Policy {
  /** Answers of `talkedThisPhase`, cycled. */
  talked: readonly ("yes" | "no")[];
  /** Answers of `minutesAway`, cycled. */
  minutes: readonly number[];
  /** `chooseNumber` picks, cycled: "min", "max" or a fixed number (clamped). */
  numbers: readonly ("min" | "max" | number)[];
  readonly asked: { talked: number; minutes: number; numbers: number };
  readonly answers: string[];
  /** `searchCollection`: the card code to take when it is offered, else the first option. */
  search?: string;
  /** `chooseOption` / `chooseCards` / `chooseTarget`: label substrings (or card codes) preferred, in order. */
  prefer?: readonly string[];
  /**
   * When set, Metaknowledge (44005, which the driver would play on any revealed encounter card) is accepted only when the
   * revealed card is one of these codes, so a staged reveal is not cancelled by accident.
   */
  metaOn?: readonly string[];
}
const policyOf = (
  talked: Policy["talked"] = ["yes"],
  numbers: Policy["numbers"] = ["min", 2, "max", 1],
  minutes: Policy["minutes"] = [0, 3, 7],
  extra: { search?: string; prefer?: readonly string[]; metaOn?: readonly string[] } = {},
): Policy => ({ talked, numbers, minutes, asked: { talked: 0, minutes: 0, numbers: 0 }, answers: [], ...extra });

const mercOf = (s: GameState): { id: InstanceId; holder: PlayerId } | null => {
  for (const p of s.players) {
    const id = p.playArea.find((i) => codeOf(s, i) === MERC);
    if (id) return { id, holder: p.playerId };
  }
  return null;
};
const attachedCodes = (s: GameState, host: InstanceId): string[] =>
  s.instances[host]!.attachments.map((a) => codeOf(s, a));

/** The yield one card in hand makes when spent, by the card text of Self Confidence / Control / Preservation and Montage. */
function expectedYield(
  s: GameState,
  id: InstanceId,
  playerId: PlayerId,
): Record<"physical" | "mental" | "energy" | "wild", number> {
  const printed = printedResources(s.cardPool[s.instances[id]!.cardId]!);
  const code = codeOf(s, id);
  const damage = s.instances[playerOf(s, playerId).identity.instanceId]!.damage;
  const factor = SELF_CARDS.includes(code) ? (damage === 0 ? 3 : damage <= 4 ? 2 : 1) : 1;
  const extraWild = code === MONTAGE ? Math.min(s.mainScheme.accelerationTokens, 3) : 0;
  return {
    physical: printed.physical * factor,
    mental: printed.mental * factor,
    energy: printed.energy * factor,
    wild: printed.wild * factor + extraWild,
  };
}

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  readonly firstPlayerByRound = new Map<number, PlayerId | "eliminated">();
  readonly turnOrder = new Map<number, PlayerId[]>();
  readonly regenerations: string[] = [];
  /** The yield of each Self card or Montage spent, as the engine counted it, with what it depended on. */
  /** Cable ally's stats in every state it was in play: the tokens and the stats then. */
  readonly cable: { tokens: number; thw: number; atk: number }[] = [];
  readonly yields: { code: string; damage: number; tokens: number; paid: number; cards: number }[] = [];
  /** Rounds in which the talked question was asked, with how often. */
  readonly talkedAsked = new Map<number, number>();
  private lastRound = 0;
  private ragePlayedRound = -1;
  constructor(
    readonly label: string,
    readonly ledger: Ledger,
    initialRound = 0,
  ) {
    this.lastRound = initialRound;
  }

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const dp = deadpoolOf(after);
    const here = `${this.label} round ${before.round} ${command.type}`;
    const ids = events.map((e) => e.type);
    void ids;
    let form = dp ? playerOf(before, dp.playerId).identity.form : null;
    const dpIdentity = dp?.identity.instanceId;
    const tabula = dpIdentity !== undefined && attachedCodes(before, dpIdentity).includes(TABULA);
    const gitGudBefore = allOfCode(before, GIT_GUD).some(
      (g) => before.instances[g]!.attachedTo !== null && before.instances[g]!.faceup,
    );
    const gitGudAfter = allOfCode(after, GIT_GUD).some(
      (g) => after.instances[g]!.attachedTo !== null && after.instances[g]!.faceup,
    );
    for (const e of events) {
      switch (e.type) {
        case "cardAddedFromCollection": {
          this.ledger.fetches++;
          const added = after.instances[e.instanceId]!;
          expect(added.ownerId, `${here}: collection card owner`).toBe(e.ownerId);
          expect(Object.keys(before.instances), `${here}: the fetched instance is new`).not.toContain(e.instanceId);
          // Armed to the Teeth: a facedown attachment of the searcher's own copy, owned by the searcher.
          const host = added.attachedTo;
          expect(host && codeOf(after, host), `${here}: the fetched card is attached to Armed to the Teeth`).toBe(
            ARMED,
          );
          expect(added.faceup, `${here}: the fetched card is facedown`).toBe(false);
          expect(after.instances[host!]!.controllerId, `${here}: Armed to the Teeth's controller searched`).toBe(
            e.ownerId,
          );
          expect(
            (after.cardPool[e.cardId] as unknown as { traits: readonly string[] }).traits,
            `${here}: the fetched card is a WEAPON`,
          ).toContain("WEAPON");
          seen.armedSearch.push(`${here} ${String(e.cardId)}`);
          break;
        }
        case "formChanged":
          if (dp && e.playerId === dp.playerId) form = e.to;
          break;
        case "playerEliminated": {
          if (dp && e.playerId === dp.playerId) {
            // He is only eliminated as Wade Wilson (his hero face replaces the defeat), or with Tabula Rasa 16 blanking it.
            expect(form === "alterEgo" || tabula, `${here}: Deadpool eliminated in ${form} form`).toBe(true);
            // Git Gud (44028) would have replaced any player's defeat while it stays in play.
            expect(gitGudBefore && gitGudAfter, `${here}: eliminated with Git Gud in play`).toBe(false);
            seen.wadeEliminated.push(here);
            if (tabula && form === "hero") seen.tabulaRasa.push(here);
          }
          break;
        }
        case "cardPlayed":
          if (String(e.cardId) === "44020") this.ragePlayedRound = before.round;
          this.checkPlay(before, after, events, command, e, here);
          break;
        case "cardsSwapped": {
          // Armed to the Teeth's Action (RRG 1.8 "'Swap'", p. 42): the facedown card and a WEAPON upgrade in play
          // trade places. Different titles, so one leaves play and the other enters it.
          const armed = this.armedAction;
          if (!armed) break;
          this.armedAction = null;
          // Same title (the fetched Laser Swords against an in-play Laser Swords): neither card enters or leaves play
          // (RRG 1.8 "Swap", p. 42); otherwise one leaves and the other enters.
          const sameTitle = cardName(after, e.outgoing) === cardName(after, e.incoming);
          expect(e.how, `${here}: the swap`).toBe(sameTitle ? "sameTitle" : "leftAndEntered");
          if (sameTitle) {
            // The instances keep their places and exchange cards (events.ts `cardsSwapped`): the in-play instance stays
            // faceup where it was, the other stays facedown under Armed to the Teeth.
            expect(
              after.instances[e.incoming]!.attachedTo,
              `${here}: the facedown instance stays under Armed to the Teeth`,
            ).toBe(armed);
            expect(after.instances[e.incoming]!.faceup, `${here}: it stays facedown`).toBe(false);
            expect(after.instances[e.outgoing]!.faceup, `${here}: the in-play instance stays faceup`).toBe(true);
          } else {
            expect(
              after.instances[e.outgoing]!.attachedTo,
              `${here}: the weapon goes facedown under Armed to the Teeth`,
            ).toBe(armed);
            expect(after.instances[e.outgoing]!.faceup, `${here}: facedown`).toBe(false);
            expect(after.instances[e.incoming]!.faceup, `${here}: the fetched weapon is now faceup`).toBe(true);
          }
          expect(after.instances[armed]!.exhausted, `${here}: Armed to the Teeth exhausts`).toBe(true);
          seen.armedSwap.push(here);
          break;
        }
        case "abilityResolved":
          if (String(e.abilityId) === "44009.armed-to-the-teeth-action") this.armedAction = e.instanceId;
          break;
        default:
      }
    }
    this.checkRegeneration(before, after, events, dp, tabula, here);
    this.checkCrisis(before, after, events, here);
    this.checkChosenAmount(before, events, here);
    this.checkFire(before, after, events, dp, here);
    this.checkInvoluntary(before, after, events, dp, here);
    this.checkMerc(before, after, command, here);
    this.checkCable(after, here);
    if (after.round !== this.lastRound) {
      expect(after.round - this.lastRound).toBe(1); // the villain phase always completes into exactly the next round
      this.firstPlayerByRound.set(
        after.round,
        after.players.some((p) => p.eliminated) ? "eliminated" : after.firstPlayerId,
      );
      this.lastRound = after.round;
    }
    for (const e of events)
      if (e.type === "turnStarted")
        this.turnOrder.set(after.round, [...(this.turnOrder.get(after.round) ?? []), e.playerId]);
  }

  /** Regeneration: damage leaves 1 remaining hit point, form is Wade, tokens +1 (exact); Tabula Rasa 16 blanks it. */
  private checkRegeneration(
    before: GameState,
    after: GameState,
    events: readonly GameEvent[],
    dp: GameState["players"][number] | undefined,
    tabula: boolean,
    here: string,
  ): void {
    const regens = events.filter((e) => e.type === "abilityResolved" && String(e.abilityId) === REGEN).length;
    const tokensAdded = events.filter((e) => e.type === "accelerationTokenAdded").length;
    expect(after.mainScheme.accelerationTokens - before.mainScheme.accelerationTokens, `${here}: token count`).toBe(
      tokensAdded,
    );
    if (tabula) expect(regens, `${here}: regeneration under Tabula Rasa 16`).toBe(0);
    if (regens === 0 || !dp) return;
    const profile = characterProfile(before, dp.identity.instanceId, WAVE7_DEPS)!;
    // Each resolution of his forced interrupt is followed, in the log, by its three replacement steps (another
    // replacement of a later defeat in the same command, Git Gud's, sets the dial too, so the steps are read in order).
    events.forEach((e, at) => {
      if (e.type !== "abilityResolved" || String(e.abilityId) !== REGEN) return;
      const rest = events.slice(at + 1);
      const set = rest.find((x) => x.type === "hitPointsSet" && x.instanceId === dp.identity.instanceId);
      expect(
        set?.type === "hitPointsSet" ? set.remaining : -1,
        `${here}: remaining hit points after regeneration`,
      ).toBe(1);
      expect(set?.type === "hitPointsSet" ? set.damage : -1, `${here}: damage after regeneration`).toBe(
        profile.maxHp - 1,
      );
      const form = rest.findIndex((x) => x.type === "formChanged" && x.playerId === dp.playerId && x.to === "alterEgo");
      expect(form, `${here}: regeneration changes to Wade Wilson`).toBeGreaterThanOrEqual(0);
      const token = rest.findIndex((x) => x.type === "accelerationTokenAdded");
      expect(token, `${here}: regeneration adds an acceleration token`).toBeGreaterThanOrEqual(0);
      expect(
        rest.findIndex((x) => x.type === "hitPointsSet"),
        `${here}: dial before form`,
      ).toBeLessThan(form);
    });
    this.regenerations.push(here);
    seen.regeneration.push(here);
  }

  private crisisPending: {
    reveals: string[];
    asideBefore: string[];
    crisis: InstanceId;
    here: string;
    cancelled: boolean;
  } | null = null;
  /**
   * Crisis of Infinite Deadpools: the minion and then the side scheme of the set are revealed, the four other cards are
   * shuffled into the encounter deck and Crisis is removed from the game. Judged when the game next rests with no
   * prompt open (revealing a card can open one).
   */
  private checkCrisis(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const reveals = events.flatMap((e) => (e.type === "encounterCardRevealed" ? [String(e.cardId)] : []));
    const crisis = events.find((e) => e.type === "encounterCardRevealed" && String(e.cardId) === CRISIS);
    if (crisis && crisis.type === "encounterCardRevealed" && !this.crisisPending) {
      const asideBefore = before.encounterSetAside
        .map((id) => codeOf(before, id))
        .filter((c) => DREADPOOL_SET.includes(c))
        .sort();
      this.crisisPending = { reveals: [], asideBefore, crisis: crisis.instanceId, here, cancelled: false };
    }
    const pending = this.crisisPending;
    if (!pending) return;
    pending.reveals.push(...reveals);
    if (events.some((e) => e.type === "revealCancelled" && e.instanceId === pending.crisis)) pending.cancelled = true;
    // Dreadpool engages the first player as he enters play.
    for (const e of events)
      if (
        e.type === "encounterCardRevealed" &&
        String(e.cardId) === DREADPOOL_MINION &&
        after.villainArea.includes(e.instanceId)
      )
        expect(after.instances[e.instanceId]!.engagedWith, `${here}: Dreadpool engages the first player`).toBe(
          after.firstPlayerId,
        );
    if (after.pendingChoice) return;
    this.crisisPending = null;
    if (pending.cancelled) {
      // Metaknowledge cancelled all its effects: the set stays aside and Crisis is discarded, not removed from the game.
      expect(
        after.encounterSetAside
          .map((id) => codeOf(after, id))
          .filter((c) => DREADPOOL_SET.includes(c))
          .sort(),
        `${pending.here}: a cancelled Crisis leaves the set aside`,
      ).toEqual(pending.asideBefore);
      expect(after.removedFromGame, `${pending.here}: a cancelled Crisis is not removed from the game`).not.toContain(
        pending.crisis,
      );
      seen.crisisCancelled.push(pending.here);
      return;
    }
    expect(pending.asideBefore, `${pending.here}: set aside before Crisis`).toEqual([
      "44038",
      "44039",
      "44040",
      "44041",
      "44041",
      "44042",
    ]);
    expect(pending.reveals, `${pending.here}: Crisis reveals the minion, then the side scheme`).toEqual(
      expect.arrayContaining([CRISIS, DREADPOOL_MINION, DEADLY_DEEDS]),
    );
    expect(pending.reveals.indexOf(DREADPOOL_MINION), `${pending.here}: minion before side scheme`).toBeLessThan(
      pending.reveals.indexOf(DEADLY_DEEDS),
    );
    expect(
      after.encounterSetAside.map((id) => codeOf(after, id)).filter((c) => DREADPOOL_SET.includes(c)),
      `${pending.here}: nothing of the set stays aside`,
    ).toEqual([]);
    expect(after.removedFromGame, `${pending.here}: Crisis removed from the game`).toContain(pending.crisis);
    // The other four (Anti-Regeneration Ray, both 'Pool-ized, Metacidal Tendencies) were shuffled into the encounter deck
    // (they may have been dealt or discarded since, but they left the set-aside area and none is still facedown aside).
    for (const c of ["44040", "44041", "44042"])
      expect(allOfCode(after, c).length, `${pending.here}: ${c} exists`).toBeGreaterThan(0);
    seen.crisisRevealed.push(pending.here);
  }

  /** Maximum Effort / "Yoo-Hoo!": the chosen amount is the damage taken as the cost and the amount dealt or removed. */
  private checkChosenAmount(before: GameState, events: readonly GameEvent[], here: string): void {
    // The number is chosen at one prompt and the cost settles in the command that answers it (the same one, or a
    // later one when taking all of his hit points opens the order of two defeat replacements).
    for (const e of events)
      if (e.type === "numberChosen" && e.bind === "costDamageChoice") this.chosenAmount = e.amount;
    const settled = events.filter((e) => e.type === "costDamageSettled");
    for (const e of settled) {
      if (e.type !== "costDamageSettled" || e.instanceId === null) continue;
      const code = codeOf(before, e.instanceId);
      if (code !== MAX_EFFORT && code !== YOO_HOO) continue;
      expect(this.chosenAmount, `${here}: chosen amount`).toBe(e.amount);
      const removed = events
        .filter((x) => x.type === "threatRemoved" && x.sourceInstanceId === e.instanceId)
        .reduce((n, x) => n + (x.type === "threatRemoved" ? x.amount : 0), 0);
      expect(removed, `${here}: "Yoo-Hoo!" removes at most the chosen amount`).toBeLessThanOrEqual(e.amount);
      expect(e.taken, `${here}: damage taken as the cost`).toBe(e.amount);
      const tag =
        code === MAX_EFFORT
          ? e.amount === 0
            ? seen.maxEffortZero
            : seen.maxEffortPositive
          : e.amount === 0
            ? seen.yooHooZero
            : seen.yooHooPositive;
      if (code === MAX_EFFORT && e.amount > 0) {
        const hit = events.find(
          (x) =>
            x.type === "damageDealt" &&
            x.sourceInstanceId === e.instanceId &&
            x.targetInstanceId !== deadpoolOf(before)?.identity.instanceId,
        );
        // The enemy may prevent it (Toughness, a tough status); otherwise it takes exactly the chosen amount.
        if (hit && hit.type === "damageDealt") expect(hit.amount, `${here}: Maximum Effort damage`).toBe(e.amount);
      }
      tag.push(`${here} ${e.amount}`);
    }
  }

  private chosenAmount = -1;
  private armedAction: InstanceId | null = null;
  private fireOwed = 0;
  /**
   * This Card is Fire: 1 damage per copy still in hand when its controller's turn ends. Two copies' forced responses
   * are ordered by a prompt, so what is owed is settled when the game next rests with no prompt open.
   */
  private checkFire(
    before: GameState,
    after: GameState,
    events: readonly GameEvent[],
    dp: GameState["players"][number] | undefined,
    here: string,
  ): void {
    if (!dp) return;
    const fires = new Set(allOfCode(before, FIRE));
    const hits = events.filter(
      (e) =>
        e.type === "damageDealt" &&
        e.targetInstanceId === dp.identity.instanceId &&
        e.sourceInstanceId !== null &&
        fires.has(e.sourceInstanceId),
    );
    for (const h of hits) if (h.type === "damageDealt") expect(h.amount, `${here}: Fire damage`).toBe(1);
    const ended = events.some((e) => e.type === "turnEnded" && e.playerId === dp.playerId);
    const inHand = ended ? playerOf(before, dp.playerId).hand.filter((id) => fires.has(id)).length : 0;
    // A damage prevention aimed at him (Telekinetic Force Field 40012, another player's interrupt) settles one owed hit:
    // the forced response still resolved, the damage was prevented (RRG 1.8 "Prevent", p. 35).
    const prevented = events.filter(
      (e) => e.type === "damagePrevented" && e.targetInstanceId === dp.identity.instanceId,
    ).length;
    this.fireOwed += inHand - hits.length - Math.min(prevented, Math.max(0, this.fireOwed + inHand - hits.length));
    if (inHand > 0) seen.thisCardIsFire.push(`${here} x${inHand}`);
    if (!after.pendingChoice) {
      expect(this.fireOwed, `${here}: This Card is Fire owes ${this.fireOwed} damage`).toBe(0);
      this.fireOwed = 0;
    }
  }

  private ipOwed = 0;
  /**
   * Involuntary Procedures: 1 threat for each time Deadpool (his hero face) takes damage, the lethal hit included. The
   * forced response comes after the damage, so a hit that opens a prompt (the order of two interrupts) is settled when
   * the game next rests with no prompt open.
   */
  private checkInvoluntary(
    before: GameState,
    after: GameState,
    events: readonly GameEvent[],
    dp: GameState["players"][number] | undefined,
    here: string,
  ): void {
    if (!dp) return;
    const ip = before.villainArea.find((id) => codeOf(before, id) === IP);
    if (!ip) {
      this.ipOwed = 0;
      return;
    }
    let form = playerOf(before, dp.playerId).identity.form;
    let hits = 0;
    let lethal = false;
    for (const e of events) {
      if (e.type === "formChanged" && e.playerId === dp.playerId) form = e.to;
      if (
        e.type === "damageDealt" &&
        e.targetInstanceId === dp.identity.instanceId &&
        e.amount > 0 &&
        form === "hero"
      ) {
        hits++;
        const profile = characterProfile(before, dp.identity.instanceId, WAVE7_DEPS)!;
        if (e.amount >= profile.maxHp - before.instances[dp.identity.instanceId]!.damage) lethal = true;
      }
    }
    const placed = events.filter(
      (e) => e.type === "threatPlaced" && e.schemeInstanceId === ip && e.sourceInstanceId === ip,
    );
    this.ipOwed += hits - placed.length;
    if (hits > 0) {
      seen.involuntaryProcedures.push(`${here} x${hits}`);
      if (lethal) seen.involuntaryLethal.push(here);
    }
    if (!after.pendingChoice) {
      // (A lethal hit that eliminates him, Tabula Rasa 16 having blanked the regeneration, ends with his cards leaving
      // the game, so the response is not asserted there; the regenerated lethal hit is.)
      if (after.villainArea.includes(ip) && !after.players.find((p) => p.playerId === dp.playerId)!.eliminated)
        expect(this.ipOwed, `${here}: Involuntary Procedures owes threat for ${this.ipOwed} hits`).toBeLessThanOrEqual(
          0,
        );
      this.ipOwed = 0;
    }
  }

  /** The Merc with the Mouth: allies kept exhausted, the talked question once per phase, yes keeps it and no discards it. */
  private checkMerc(before: GameState, after: GameState, command: Command, here: string): void {
    const merc = mercOf(after);
    if (merc) {
      seen.mercInPlay.push(here);
      if (!after.pendingChoice) {
        const allies = playerOf(after, merc.holder).playArea.filter((id) => cardType(after, id) === "ally");
        for (const a of allies)
          expect(after.instances[a]!.exhausted, `${here}: ${cardName(after, a)} with the Merc in play`).toBe(true);
        if (allies.length > 0) seen.mercAlliesExhausted.push(here);
      }
    }
    const asked = after.pendingChoice;
    if (
      asked &&
      asked.prompt.kind === "reportFact" &&
      asked.prompt.fact === "talkedThisPhase" &&
      before.pendingChoice?.choiceId !== asked.choiceId
    ) {
      expect(asked.playerId, `${here}: the Merc's question goes to the Wade Wilson player`).toBe(merc?.holder);
      this.talkedAsked.set(after.round, (this.talkedAsked.get(after.round) ?? 0) + 1);
      expect(this.talkedAsked.get(after.round), `${here}: the talked question once per player phase`).toBe(1);
      seen.mercAskedOnce.push(here);
    }
    const answering = before.pendingChoice;
    if (
      answering &&
      answering.prompt.kind === "reportFact" &&
      answering.prompt.fact === "talkedThisPhase" &&
      command.type === "resolveChoice"
    ) {
      const mercBefore = mercOf(before);
      const answer = command.selectedOptionIds[0];
      // (The villain phase that follows may eliminate the player in the same command, and the cards leave play.)
      if (after.players.some((p) => p.eliminated)) return;
      if (mercBefore && answer === "yes") {
        expect(mercOf(after)?.id, `${here}: talked yes keeps the Merc`).toBe(mercBefore.id);
        seen.mercYes.push(here);
      }
      if (mercBefore && answer === "no") {
        expect(mercOf(after), `${here}: talked no discards the Merc`).toBeNull();
        expect(encounterPiles(after), `${here}: the Merc is in the encounter discard pile`).toContain(mercBefore.id);
        seen.mercNo.push(here);
      }
    }
  }

  /** Cable ally (44002): +1 THW and +1 ATK per acceleration token, to +3. */
  private checkCable(after: GameState, here: string): void {
    for (const p of after.players)
      for (const id of p.playArea) {
        if (codeOf(after, id) !== CABLE_ALLY) continue;
        const profile = characterProfile(after, id, WAVE7_DEPS)!;
        const bonus = Math.min(after.mainScheme.accelerationTokens, 3);
        const rage = this.ragePlayedRound === after.round ? 1 : 0; // Get Rage-y: +1 ATK until the end of the phase
        expect(profile.thw, `${here}: Cable's THW with ${after.mainScheme.accelerationTokens} tokens`).toBe(1 + bonus);
        expect(
          [2 + bonus, 2 + bonus + rage],
          `${here}: Cable's ATK with ${after.mainScheme.accelerationTokens} tokens`,
        ).toContain(profile.atk);
        this.cable.push({ tokens: after.mainScheme.accelerationTokens, thw: profile.thw, atk: profile.atk });
        seen.cableAllyStats.push(`${here} tokens=${after.mainScheme.accelerationTokens}`);
        if (after.mainScheme.accelerationTokens >= 3)
          seen.cableAllyCap.push(`${here} tokens=${after.mainScheme.accelerationTokens} atk=${profile.atk}`);
      }
  }

  /** A card played: the exact yield of what paid for it, Git Gud's cost, Armed to the Teeth's search. */
  private checkPlay(
    before: GameState,
    after: GameState,
    events: readonly GameEvent[],
    command: Command,
    e: Extract<GameEvent, { type: "cardPlayed" }>,
    here: string,
  ): void {
    if (command.type === "playCard" && command.cardInstanceId === e.instanceId) {
      const fromHand = command.payment.flatMap((p) => ("fromHand" in p ? [p.fromHand] : []));
      const onlyDeadpool = fromHand.every((id) => codeOf(before, id).startsWith("44"));
      if (fromHand.length === command.payment.length && fromHand.length > 0 && onlyDeadpool) {
        const total = { physical: 0, mental: 0, energy: 0, wild: 0 };
        for (const id of fromHand) {
          const y = expectedYield(before, id, e.playerId);
          for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += y[k];
          const code = codeOf(before, id);
          if (SELF_CARDS.includes(code) || code === MONTAGE)
            this.yields.push({
              code,
              damage: before.instances[playerOf(before, e.playerId).identity.instanceId]!.damage,
              tokens: before.mainScheme.accelerationTokens,
              paid: Object.values(e.paid).reduce((a, b) => a + b, 0),
              cards: fromHand.length,
            });
          if (SELF_CARDS.includes(code))
            seen.selfCard.push(
              `${here} ${code} damage=${before.instances[playerOf(before, e.playerId).identity.instanceId]!.damage} yield=${JSON.stringify(y)}`,
            );
          if (code === MONTAGE)
            seen.montage.push(`${here} tokens=${before.mainScheme.accelerationTokens} yield=${y.wild}`);
        }
        expect(
          e.paid,
          `${here}: resources the payment generated (cards ${fromHand.map((i) => codeOf(before, i)).join(",")})`,
        ).toEqual(total);
      }
    }
    if (String(e.cardId) === GIT_GUD && command.type === "playCard") {
      // "Reduce the cost to play Git Gud by 2 if you did not win your previous game" (spec Q48: an absent fact means
      // not won). The driver pays the printed cost whatever it is (and a stage can add to it: Stryfe 2A, "Increase the
      // resource cost to play each player card by 1"), so the same play is probed with nothing paid under each value of
      // the fact: what is asked for differs by exactly 2.
      const won = playerOf(after, e.playerId).outsideFacts?.wonPreviousGame === true;
      const need = (fact: boolean): number => {
        const flipped = {
          ...before,
          players: before.players.map((p) =>
            p.playerId === e.playerId ? { ...p, outsideFacts: fact ? { wonPreviousGame: true } : {} } : p,
          ),
        };
        const probe = applyCommand(flipped, { ...command, payment: [] }, WAVE7_DEPS);
        if (probe.ok) return 0;
        const match = /Needs (\d+) resource/.exec(probe.error.message);
        if (!match) throw new Error(`${here}: Git Gud probe failed: ${probe.error.code} ${probe.error.message}`);
        return Number(match[1]);
      };
      const full = need(true);
      const reduced = need(false);
      expect(full - reduced, `${here}: Git Gud asks for ${full} with the fact present and ${reduced} without`).toBe(
        Math.min(2, full),
      );
      expect(full, `${here}: Git Gud's full cost`).toBeGreaterThanOrEqual(2);
      expect(e.resourcesPaid, `${here}: Git Gud paid`).toBeGreaterThanOrEqual(won ? full : reduced);
      (won ? seen.gitGudFull : seen.gitGudReduced).push(`${here} full=${full} reduced=${reduced}`);
    }
  }
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
  policy: Policy,
): Command {
  const s = session.state;
  const choice = s.pendingChoice;
  if (!choice && !s.outcome && script.length > 0) return script.shift()!(s);
  if (choice) {
    const own = ownAnswer(s, choice, policy);
    if (own)
      return { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: own };
  } else if (s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  const [command] = playToOutcome(s, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

interface PlayOptions {
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  readonly script?: readonly ((s: GameState) => Command)[];
  readonly policy?: Policy;
  /** Stop as soon as the script is spent and no prompt is pending. */
  readonly stopAfterScript?: boolean;
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(
  initial: GameState,
  label: string,
  options: PlayOptions = {},
): GameResult & { readonly observer: Observer; readonly policy: Policy } {
  const dealtTo = new Map<string, PlayerId>();
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardType(initial, id as InstanceId)))
      dealtTo.set(id, instance.ownerId);
  const ledger: Ledger = { dealtTo, initialCount: Object.keys(initial.instances).length, fetches: 0 };
  const observer = new Observer(label, ledger, initial.round);
  const policy = options.policy ?? policyOf();
  checkState(initial, ledger, "start");
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const maxCommands = options.maxCommands ?? 3000;
  let commands = 0;
  const scripted = script.length > 0;
  while (
    !session.state.outcome &&
    (options.stopAtRound === undefined || session.state.round < options.stopAtRound) &&
    !(options.stopAfterScript && scripted && script.length === 0 && !session.state.pendingChoice)
  ) {
    if (commands >= maxCommands)
      throw new Error(`no outcome after ${maxCommands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn, script, policy);
    const result = sessionApply(session, command, WAVE7_DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, ledger, `${label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands, label, observer, policy };
}

/** The log replays to a deep-equal final state (and the replay itself reports no error). */
function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

interface NewGameOptions {
  readonly firstPlayerIndex?: number;
  readonly outsideFacts?: readonly ({ readonly wonPreviousGame?: boolean } | undefined)[];
}

/** Setup with the opening hands kept, plus the targeted setup check (the Dreadpool set). */
function newGame(
  scenario: string,
  players: readonly Seat[],
  seed: number,
  label = `${scenario}#${seed}`,
  options: NewGameOptions = {},
): GameState {
  const config = wave7Scenario(scenario, {
    players,
    seed,
    modularSetIds: [],
    ...(options.firstPlayerIndex === undefined ? {} : { firstPlayerIndex: options.firstPlayerIndex }),
  });
  const seated = options.outsideFacts
    ? {
        ...config,
        players: config.players.map((p, i) =>
          options.outsideFacts![i] ? { ...p, outsideFacts: options.outsideFacts![i] } : p,
        ),
      }
    : config;
  const created = createGame(seated, WAVE7_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const started = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  noteDreadpoolSetup(started, players, label);
  return started;
}

const encounterPiles = (s: GameState) => Object.values(s.encounterDecks).flatMap((p) => [...p.deck, ...p.discard]);

/**
 * The 'Pool aspect brings the Dreadpool set in (Deadpool insert; RRG 1.8 FAQ p. 64): one Crisis of Infinite Deadpools
 * in the encounter deck and the other six cards set aside, whatever the player count; a game with no 'Pool deck has
 * none of the set anywhere.
 */
function noteDreadpoolSetup(s: GameState, players: readonly Seat[], label: string): void {
  const dreadpool = (Object.keys(s.instances) as InstanceId[]).filter((id) => DREADPOOL_SET.includes(codeOf(s, id)));
  if (!players.some((p) => p.starterDeckId === "deadpool-pool")) {
    expect(dreadpool, `${label}: Dreadpool cards in a game with no 'Pool deck`).toEqual([]);
    seen.noDreadpoolWithoutPool.push(label);
    return;
  }
  expect(dreadpool, `${label}: seven Dreadpool cards`).toHaveLength(7);
  const inDeck = encounterPiles(s).filter((id) => DREADPOOL_SET.includes(codeOf(s, id)));
  expect(
    inDeck.map((id) => codeOf(s, id)),
    `${label}: Dreadpool cards in the encounter deck`,
  ).toEqual([CRISIS]);
  expect(
    s.encounterSetAside
      .map((id) => codeOf(s, id))
      .filter((c) => DREADPOOL_SET.includes(c))
      .sort(),
    `${label}: set aside`,
  ).toEqual(["44038", "44039", "44040", "44041", "44041", "44042"]);
  (players.length === 1 ? seen.dreadpoolSetupOne : seen.dreadpoolSetupTwo).push(label);
}

const completedRounds = (r: GameResult) => r.session.state.round - 1;

// ---------------------------------------------------------------------------
// Scripted commands (state surgery and scripted plays go through the same `play` loop and the same invariants)
// ---------------------------------------------------------------------------

const identityIdOf = (s: GameState, who: PlayerId = P1) => playerOf(s, who).identity.instanceId;
const withTokens = (s: GameState, accelerationTokens: number): GameState => ({
  ...s,
  mainScheme: { ...s.mainScheme, accelerationTokens },
});
const handIdOf = (s: GameState, who: PlayerId, code: string, not: readonly InstanceId[] = []): InstanceId => {
  const id = playerOf(s, who).hand.find((h) => codeOf(s, h) === code && !not.includes(h));
  if (!id) throw new Error(`${who} has no ${code} in hand`);
  return id;
};

/**
 * `who` plays `code` from hand. `pay`: the codes of hand cards to pay with (the whole payment), or a number of
 * resources to cover from the other hand cards' printed icons, in hand order.
 */
const playScript =
  (code: string, options: { who?: PlayerId; pay?: number | readonly string[]; attach?: boolean } = {}) =>
  (state: GameState): Command => {
    const who = options.who ?? P1;
    const id = handIdOf(state, who, code);
    const pay: InstanceId[] = [];
    if (Array.isArray(options.pay)) for (const c of options.pay) pay.push(handIdOf(state, who, c, [id, ...pay]));
    else {
      const need = (options.pay as number | undefined) ?? (state.cardPool[code] as unknown as { cost: number }).cost;
      let got = 0;
      for (const h of playerOf(state, who).hand) {
        if (got >= need) break;
        if (h === id) continue;
        const icons = (state.cardPool[codeOf(state, h)] as unknown as { resourceIcons?: Record<string, number> })
          .resourceIcons;
        pay.push(h);
        got += Object.values(icons ?? {}).reduce((a, b) => a + b, 0);
      }
    }
    return {
      type: "playCard",
      playerId: who,
      cardInstanceId: id,
      payment: pay.map((fromHand) => ({ fromHand })),
      attachToInstanceId: options.attach ? identityIdOf(state, who) : null,
    };
  };
const endTurnScript =
  (who: PlayerId = P1) =>
  (): Command => ({ type: "endTurn", playerId: who });

/** An ally of `player` in their play area, ready, by surgery (no cost, no enter-play). */
function allyInPlay(state: GameState, player: PlayerId, code: string): GameState {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const s = patchInstance(given.state, id, { faceup: true, controllerId: player, exhausted: false });
  return {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
}

let conjured = 9100;
/** A support of `player`'s (not in the starter deck), cloned from one of their own cards, in their play area, by surgery. */
function conjureInPlay(state: GameState, player: PlayerId, code: string): GameState {
  const owner = playerOf(state, player);
  const template = state.instances[owner.deck[0]!]!;
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...template,
    instanceId: id,
    cardId: code as never,
    exhausted: false,
    flipped: false,
    attachments: [],
    counters: {},
    faceup: true,
    controllerId: player,
    ownerId: player,
  };
  return {
    ...state,
    instances: { ...state.instances, [id]: instance },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
}

/** The Merc with the Mouth, from the encounter deck, in `holder`'s play area (it stays there once revealed), by surgery. */
function mercIntoPlay(state: GameState, holder: PlayerId): GameState {
  const id = allOfCode(state, MERC)[0]!;
  return {
    ...state,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([key, pile]) => [
        key,
        { ...pile, deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      ]),
    ),
    players: state.players.map((p) => (p.playerId === holder ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: null } },
  };
}

/** The encounter deck with the first `code` card moved second from the top, so the villain's boost card does not eat it. */
function encounterBehindBoost(state: GameState, code: string, boosts = 1): GameState {
  const [deckId, pile] = Object.entries(state.encounterDecks).find(([, d]) =>
    d.deck.some((id) => codeOf(state, id) === code),
  )!;
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  const rest = pile.deck.filter((i) => i !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, boosts), id, ...rest.slice(boosts)] },
    },
  };
}

describe("Setup: the Dreadpool set rides with the 'Pool deck", () => {
  it("one player, two players, and a game with no 'Pool deck", () => {
    newGame("stryfe", [DEADPOOL], 1, "setup-one");
    newGame("on-the-run", [DEADPOOL, CABLE], 1, "setup-two");
    newGame("stryfe", [CABLE], 1, "setup-none");
    newGame("morlock-siege", [CABLE], 1, "setup-none-morlock");
    expect(seen.dreadpoolSetupOne.length).toBeGreaterThan(0);
    expect(seen.dreadpoolSetupTwo.length).toBeGreaterThan(0);
    expect(seen.noDreadpoolWithoutPool.length).toBeGreaterThan(1);
  });
});

/**
 * Seeds picked from a scan of 30-100 seeds each: the greedy driver loses most Stryfe and Juggernaut games in one to
 * three rounds (the main scheme accelerates and a regenerating Deadpool pays for it), so these are the seeds that
 * last, plus a few short ones that end in each way. `rounds` is the minimum completed rounds the game must reach.
 */
describe("Deadpool precon, one player, Stryfe and Juggernaut, standard", () => {
  it.each([
    ["stryfe", 8, 4, 6, ["yes", "no"]],
    ["stryfe", 24, 4, 6, ["yes"]],
    ["stryfe", 22, 3, undefined, ["no", "yes"]],
    ["stryfe", 29, 3, undefined, ["yes"]],
    ["stryfe", 46, 4, undefined, ["yes", "no"]],
    ["stryfe", 48, 3, undefined, ["yes"]],
    ["stryfe", 17, 2, undefined, ["yes"]],
    ["juggernaut", 8, 5, undefined, ["yes", "no"]],
    ["juggernaut", 16, 4, undefined, ["yes"]],
    ["juggernaut", 19, 3, undefined, ["no", "yes"]],
  ] as const)(
    "%s seed %i plays at least %i rounds, to an outcome or round %s",
    (scenario, seed, rounds, stop, talked) => {
      const policy = policyOf(talked as unknown as Policy["talked"]);
      const result = play(newGame(scenario, [DEADPOOL], seed), `${scenario}#${seed}`, {
        policy,
        ...(stop === undefined ? {} : { stopAtRound: stop }),
      });
      if (stop === undefined) expect(result.session.state.outcome, "played to an outcome").not.toBeNull();
      expect(completedRounds(result)).toBeGreaterThanOrEqual(rounds);
      expectReplays(result);
    },
  );
});

describe("Deadpool precon, Morlock Siege and Mister Sinister, one player", () => {
  it.each([
    ["morlock-siege", 5, 5],
    ["morlock-siege", 24, 5],
    ["mister-sinister", 6, 5],
    ["mister-sinister", 26, 5],
  ] as const)("%s seed %i plays at least three full rounds", (scenario, seed, stop) => {
    const result = play(newGame(scenario, [DEADPOOL], seed), `${scenario}#${seed}`, { stopAtRound: stop });
    expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
    expectReplays(result);
  });
});

/** The first player token passes to the next seat each round (RRG 1.8 "First Player", p. 20), while nobody is eliminated. */
function expectTokenPasses(start: GameState, observer: Observer, result: GameResult, minPasses: number): void {
  const order = start.players.map((p) => p.playerId);
  let passes = 0;
  for (let round = 2; round <= completedRounds(result) + 1; round++) {
    const previous = observer.firstPlayerByRound.get(round - 1);
    const current = observer.firstPlayerByRound.get(round);
    if (previous === undefined || current === undefined || previous === "eliminated" || current === "eliminated")
      continue;
    expect(current, `first player of round ${round}`).toBe(order[(order.indexOf(previous) + 1) % order.length]);
    passes++;
  }
  expect(
    passes,
    `rounds in which the token visibly passed ${JSON.stringify([...observer.firstPlayerByRound])}`,
  ).toBeGreaterThanOrEqual(minPasses);
  for (const [round, players] of observer.turnOrder) {
    const first = observer.firstPlayerByRound.get(round);
    if (round > 1 && first !== "eliminated" && first !== undefined)
      expect(players[0], `round ${round} starts with the first player`).toBe(first);
  }
  seen.twoPlayerTokenPasses.push(result.label);
}

/**
 * Seeds from a scan of 70 seeds per seat order: the greedy driver usually loses On the Run to its main scheme in one or
 * two rounds, so these are the ones that reach round 4. `passes` is the number of visible first-player-token passes: two
 * with both players alive through three rounds; one where a player is eliminated in round 3 (the token passes once while
 * both remain, and not at all after that, RRG 1.8 "First Player", p. 20).
 */
describe("Deadpool and Cable, two players, On the Run, three full rounds", () => {
  it.each([
    [[DEADPOOL, CABLE], 70, 2],
    [[CABLE, DEADPOOL], 47, 2],
    [[DEADPOOL, CABLE], 17, 1],
  ] as const)("%# seats %j seed %i", (seats, seed, passes) => {
    const label = `on-the-run#${seed}+${seats.map((s) => s.starterDeckId.split("-")[0]).join("+")}`;
    const start = newGame("on-the-run", seats, seed, label);
    const result = play(start, label, { stopAtRound: 4, policy: policyOf(["yes", "no"]), maxCommands: 600 });
    expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
    expectTokenPasses(start, result.observer, result, passes);
    expectReplays(result);
  });
});

describe("Staged: Git Gud with the previous-game fact absent and present", () => {
  // Spec Q48: an absent fact means not won, so the cost is reduced by 2; `outsideFacts` at setup says it was won. The
  // observer probes the same play under both values of the fact and asks that the cost differ by exactly 2.
  it.each([
    [false, undefined],
    [true, { wonPreviousGame: true }],
  ] as const)("won the previous game: %s", (won, fact) => {
    const label = `gitgud-${won}`;
    let s = newGame("stryfe", [DEADPOOL], 1, label, { outsideFacts: [fact] });
    s = moveToHand(s, P1, GIT_GUD).state;
    const result = play(s, label, {
      stopAtRound: 2,
      script: [playScript(GIT_GUD, { pay: won ? 2 : [], attach: true })],
    });
    expect((won ? seen.gitGudFull : seen.gitGudReduced).some((x) => x.startsWith(label))).toBe(true);
    expect(playerOf(result.session.state, P1).outsideFacts?.wonPreviousGame === true).toBe(won);
    expectReplays(result);
  });
});

describe("Staged: Armed to the Teeth searches the collection and swaps", () => {
  it("fetches Laser Swords as a NEW instance owned by the searcher, then swaps it with Deadpool's Katana", () => {
    let s = newGame("stryfe", [DEADPOOL], 1, "armed");
    s = moveToHand(s, P1, ARMED, "44010").state;
    s = withForm(s, { heroForm: 0 }, P1);
    const before = Object.keys(s.instances).length;
    const result = play(s, "armed", {
      stopAtRound: 2,
      policy: policyOf(["yes"], undefined, undefined, { search: LASER_SWORDS }),
      script: [
        playScript(ARMED, { attach: true, pay: 2 }),
        playScript("44010", { attach: true, pay: 2 }),
        (state) => {
          const armed = allOfCode(state, ARMED)[0]!;
          return {
            type: "useAbility",
            playerId: P1,
            cardInstanceId: armed,
            abilityId: "44009.armed-to-the-teeth-action" as never,
            payment: [],
          };
        },
      ],
    });
    expect(Object.keys(result.session.state.instances).length, "exactly one instance was added").toBe(before + 1);
    expect(result.observer.ledger.fetches).toBe(1);
    expect(seen.armedSearch.some((x) => x.startsWith("armed") && x.endsWith(LASER_SWORDS))).toBe(true);
    expect(seen.armedSwap.some((x) => x.startsWith("armed"))).toBe(true);
    const final = result.session.state;
    const swords = allOfCode(final, LASER_SWORDS);
    expect(swords).toHaveLength(1);
    expect(final.instances[swords[0]!]!.ownerId).toBe(P1);
    expect(final.instances[swords[0]!]!.attachedTo, "Laser Swords is in play on his identity").toBe(
      identityIdOf(final),
    );
    expectReplays(result);
  });
});

describe("Staged: Cable ally's stats follow the acceleration tokens (cap +3)", () => {
  it.each([
    [0, 1, 2],
    [2, 3, 4],
    [3, 4, 5],
    [5, 4, 5],
  ] as const)("%i tokens: THW %i, ATK %i", (tokens, thw, atk) => {
    const label = `cable-ally-${tokens}`;
    let s = withTokens(newGame("stryfe", [DEADPOOL], 1, label), tokens);
    s = moveToHand(s, P1, CABLE_ALLY).state;
    s = withForm(s, { heroForm: 0 }, P1);
    // Stryfe's main scheme takes no threat in this staged round (no villain-phase threat reaches the target).
    const result = play(s, label, { stopAtRound: 2, script: [playScript(CABLE_ALLY, { pay: 3 })] });
    const first = result.observer.cable[0];
    expect(first, "Cable was in play in some state").toBeDefined();
    expect(first).toEqual({ tokens, thw, atk });
    if (tokens >= 3) expect(seen.cableAllyCap.some((x) => x.startsWith(label))).toBe(true);
    expectReplays(result);
  });
});

describe("Staged: Self cards and Montage generate their computed yield when spent", () => {
  // Yoo-Hoo! (cost 1) is paid with one Self card or Montage in hand, in hero form, with `damage` on Deadpool and `tokens`
  // on the main scheme. A Self card is printed with one icon: triple with no damage, double with 1-4, else single
  // (card text: "less than 5 damage"; "no damage"). Montage: 1 + one wild per token, to 3 additional (card text).
  it.each([
    ["44025", 0, 0, 3],
    ["44025", 4, 0, 2],
    ["44025", 5, 0, 1],
    ["44026", 1, 0, 2],
    ["44027", 0, 0, 3],
    ["44027", 7, 0, 1],
    [MONTAGE, 0, 0, 1],
    [MONTAGE, 0, 2, 3],
    [MONTAGE, 0, 3, 4],
    [MONTAGE, 0, 5, 4],
  ] as const)("%s with %i damage and %i tokens yields %i", (code, damage, tokens, yielded) => {
    const label = `yield-${code}-${damage}-${tokens}`;
    let s = withTokens(newGame("stryfe", [DEADPOOL], 1, label), tokens);
    s = moveToHand(s, P1, YOO_HOO, code).state;
    s = withDamage(withForm(s, { heroForm: 0 }, P1), identityIdOf(s), damage);
    const result = play(s, label, {
      stopAtRound: 2,
      policy: policyOf(["yes"], ["min"]),
      script: [playScript(YOO_HOO, { pay: [code] })],
    });
    expect(result.observer.yields).toEqual([{ code, damage, tokens, paid: yielded, cards: 1 }]);
    expectReplays(result);
  });
});

describe('Staged: Maximum Effort and "Yoo-Hoo!" pay a chosen amount, up to all his remaining hit points', () => {
  it.each([
    [MAX_EFFORT, "min", 0],
    [MAX_EFFORT, 3, 3],
    [MAX_EFFORT, "max", 6],
    [YOO_HOO, "min", 0],
    [YOO_HOO, 4, 4],
    [YOO_HOO, "max", 6],
  ] as const)("%s choosing %s takes %i damage", (code, pick, amount) => {
    const label = `chosen-${code}-${pick}`;
    let s = newGame("stryfe", [DEADPOOL], 1, label);
    s = moveToHand(s, P1, code).state;
    s = withDamage(withForm(s, { heroForm: 0 }, P1), identityIdOf(s), 3); // 6 remaining
    const result = play(s, label, {
      stopAtRound: 2,
      policy: policyOf(["yes"], [pick]),
      script: [playScript(code, { pay: code === YOO_HOO ? 1 : 0 })],
    });
    const tag =
      code === MAX_EFFORT
        ? amount === 0
          ? seen.maxEffortZero
          : seen.maxEffortPositive
        : amount === 0
          ? seen.yooHooZero
          : seen.yooHooPositive;
    expect(
      tag.some((x) => x.startsWith(label) && x.endsWith(` ${amount}`)),
      `${code} paid ${amount}`,
    ).toBe(true);
    // Taking all 6 would defeat him: his own forced interrupt replaces it (he stays in the game as Wade Wilson).
    if (amount === 6) expect(seen.regeneration.some((x) => x.startsWith(label))).toBe(true);
    expect(result.session.state.players[0]!.eliminated).toBe(false);
    expectReplays(result);
  });
});

describe("Staged: Tabula Rasa 16 blanks his regeneration, so a lethal hit eliminates him", () => {
  it("attached by its own reveal, then Maximum Effort for all his hit points: eliminated, no regeneration", () => {
    const label = "tabula";
    const stacked = stackSetAsideBehindBoost(newGame("stryfe", [DEADPOOL], 1, label), TABULA);
    const revealed = play(stacked, label, { stopAtRound: 2 });
    let s = revealed.session.state;
    const identity = identityIdOf(s);
    expect(
      s.instances[identity]!.attachments.map((a) => codeOf(s, a)),
      "Tabula Rasa 16 attached by its reveal",
    ).toContain(TABULA);
    s = moveToHand(s, P1, MAX_EFFORT).state;
    s = withDamage(withForm(s, { heroForm: 0 }, P1), identity, 8); // 1 remaining
    const result = play(s, label + "-lethal", {
      policy: policyOf(["yes"], ["max"]),
      script: [playScript(MAX_EFFORT, { pay: 0 })],
      stopAfterScript: true,
    });
    expect(result.session.state.players[0]!.eliminated, "Deadpool is eliminated").toBe(true);
    expect(seen.tabulaRasa.some((x) => x.startsWith(label + "-lethal"))).toBe(true);
    expect(result.observer.regenerations).toEqual([]);
    expect(result.session.state.outcome).toMatchObject({ result: "loss", reason: "allPlayersDefeated" });
    expectReplays(result);
  });

  it("without it, the same hit regenerates: 1 hit point left as Wade Wilson, +1 token (control)", () => {
    const label = "no-tabula-lethal";
    let s = newGame("stryfe", [DEADPOOL], 1, label);
    s = moveToHand(s, P1, MAX_EFFORT).state;
    s = withDamage(withForm(s, { heroForm: 0 }, P1), identityIdOf(s), 8);
    const tokens = s.mainScheme.accelerationTokens;
    const result = play(s, label, {
      policy: policyOf(["yes"], ["max"]),
      script: [playScript(MAX_EFFORT, { pay: 0 })],
      stopAfterScript: true,
    });
    const final = result.session.state;
    expect(final.players[0]!.eliminated).toBe(false);
    expect(final.players[0]!.identity.form).toBe("alterEgo");
    expect(final.instances[identityIdOf(final)]!.damage).toBe(8);
    expect(final.mainScheme.accelerationTokens).toBe(tokens + 1);
    expect(result.observer.regenerations).toHaveLength(1);
    expectReplays(result);
  });
});

describe("Staged: Involuntary Procedures places threat when he takes damage, the lethal hit included", () => {
  it("1 threat for a 2-damage cost, and 1 more for the regenerated lethal hit; none for Wade Wilson", () => {
    const label = "ip";
    const stacked = stackSetAsideBehindBoost(newGame("stryfe", [DEADPOOL], 1, label), IP);
    const revealed = play(stacked, label, { stopAtRound: 2 });
    let s = revealed.session.state;
    const ip = s.villainArea.find((id) => codeOf(s, id) === IP);
    expect(ip, "Involuntary Procedures was revealed into the villain area").toBeDefined();
    const start = s.instances[ip!]!.threat;
    s = moveToHand(s, P1, MAX_EFFORT, MAX_EFFORT).state;
    s = withDamage(withForm(s, { heroForm: 0 }, P1), identityIdOf(s), 3); // 6 remaining
    const result = play(s, label + "-hits", {
      policy: policyOf(["yes"], [2, "max"]),
      script: [playScript(MAX_EFFORT, { pay: 0 }), playScript(MAX_EFFORT, { pay: 0 })],
      stopAfterScript: true,
    });
    const final = result.session.state;
    expect(final.instances[ip!]!.threat - start, "threat placed on Involuntary Procedures").toBe(2);
    expect(final.players[0]!.identity.form).toBe("alterEgo");
    expect(seen.involuntaryLethal.some((x) => x.startsWith(label + "-hits"))).toBe(true);
    // As Wade Wilson (a different title, RRG 1.8 "Identity", p. 23) the damage places nothing.
    const wade = play(withDamage(final, identityIdOf(final), 0), label + "-wade", { stopAtRound: 2 });
    expect(wade.session.state.instances[ip!]?.threat ?? start).toBeGreaterThanOrEqual(start + 2);
    expectReplays(result);
  });
});

describe("Staged: Crisis of Infinite Deadpools revealed", () => {
  it.each([[[DEADPOOL]], [[DEADPOOL, CABLE]]] as const)(
    "%j: Dreadpool and Dreadful Deeds revealed, four cards shuffled in, Crisis removed",
    (seats) => {
      const label = `crisis-${seats.length}`;
      const s = encounterBehindBoost(newGame("stryfe", seats, 1, label), CRISIS, seats.length);
      const result = play(s, label, {
        stopAtRound: 2,
        policy: policyOf(["yes"], undefined, undefined, { metaOn: [] }),
      });
      expect(
        seen.crisisRevealed.some((x) => x.startsWith(label)),
        "Crisis revealed and judged by the observer",
      ).toBe(true);
      const final = result.session.state;
      const crisis = allOfCode(final, CRISIS);
      expect(crisis).toHaveLength(1);
      expect(final.removedFromGame).toContain(crisis[0]);
      expectReplays(result);
    },
  );
});

describe("Staged: Metaknowledge cancels Crisis of Infinite Deadpools", () => {
  it("a cancelled Crisis does nothing: the set stays aside and Crisis is discarded, not removed from the game", () => {
    const label = "crisis-cancelled";
    let s = newGame("stryfe", [DEADPOOL], 1, label);
    s = withForm(moveToHand(s, P1, "44005").state, { heroForm: 0 }, P1);
    s = encounterBehindBoost(s, CRISIS);
    // (The turn is ended at once: the driver would pay for its plays with Metaknowledge's icon.)
    const result = play(s, label, {
      stopAtRound: 2,
      script: [endTurnScript(P1)],
      policy: policyOf(["yes"], undefined, undefined, { metaOn: [CRISIS] }),
    });
    expect(seen.crisisCancelled.some((x) => x.startsWith(label))).toBe(true);
    const crisis = allOfCode(result.session.state, CRISIS)[0]!;
    expect(result.session.state.removedFromGame).not.toContain(crisis);
    expectReplays(result);
  });
});

describe("Staged: The Merc with the Mouth", () => {
  /** The obligation revealed in the first villain phase, with a ready ally already in play. */
  function mercGame(seats: readonly Seat[], label: string): GameState {
    let s = newGame(seats.length === 1 ? "stryfe" : "on-the-run", seats, 1, label);
    s = allyInPlay(s, P1, "44013"); // Dogpool: a ready ally in play when the Merc arrives
    s = withForm(s, { heroForm: 0 }, P1);
    return encounterBehindBoost(s, MERC);
  }

  it("exhausts allies already in play and keeps them exhausted; the question is asked once per phase: yes keeps it, no discards it", () => {
    const label = "merc-1p";
    const s = mercGame([DEADPOOL], label);
    const dogpool = allOfCode(s, "44013")[0]!;
    const policy = policyOf(["yes", "no"], undefined, undefined, { metaOn: [] });
    const result = play(s, label, { policy, stopAtRound: 5, script: [endTurnScript(P1)] });
    expect(seen.mercInPlay.some((x) => x.startsWith(label))).toBe(true);
    expect(seen.mercAlliesExhausted.some((x) => x.startsWith(label))).toBe(true);
    expect(seen.mercAskedOnce.some((x) => x.startsWith(label))).toBe(true);
    expect(seen.mercYes.some((x) => x.startsWith(label))).toBe(true);
    expect(seen.mercNo.some((x) => x.startsWith(label))).toBe(true);
    expect(
      policy.answers.filter((a) => a.startsWith("talkedThisPhase")),
      "recorded answers",
    ).toEqual(["talkedThisPhase=yes", "talkedThisPhase=no"]);
    // Once discarded, the Merc no longer holds Dogpool down: he readies at the next ready step.
    const final = result.session.state;
    expect(mercOf(final)).toBeNull();
    void dogpool;
    expectReplays(result);
  });

  it("two players: another player's player-card ability and event are refused during his turn, allowed without it", () => {
    const label = "merc-2p";
    let s = newGame("on-the-run", [DEADPOOL, CABLE], 1, label);
    s = conjureInPlay(s, P1, PLOT);
    const plot = allOfCode(s, PLOT)[0]!;
    expect(s.step.phase === "player" && s.step.kind === "turn" && s.step.activePlayerId, "his turn").toBe(P1);
    const abilityOffTurn = use(P2, plot, "44050.plot-convenience-action");
    // Another player's card (Cable's Frenemies, an Action event: 40026) in Cable's player's hand.
    s = moveToHand(s, P2, "40026").state;
    const eventOffTurn = playScript("40026", { who: P2, pay: 1 })(s);
    const control = (state: GameState, command: Command) => applyCommand(state, command, WAVE7_DEPS);
    // RRG 1.8 "Action" (off-turn use): a non-active player may use an Action ability during another player's turn.
    expect(control(s, abilityOffTurn).ok, "no Merc: Cable's player uses Plot Convenience off-turn").toBe(true);
    const merc = mercIntoPlay(s, P1);
    const refusedAbility = control(merc, abilityOffTurn);
    expect(refusedAbility.ok, "the Merc in play during his turn: the ability is refused").toBe(false);
    const eventFree = control(s, eventOffTurn);
    const eventMerc = control(merc, eventOffTurn);
    if (eventFree.ok) expect(eventMerc.ok, "the Merc in play during his turn: the Action event is refused").toBe(false);
    // The ban belongs to his turn alone: once Cable's player is the active one, the same ability works.
    const theirTurn = (state: GameState): GameState => ({
      ...state,
      step: { ...state.step, activePlayerId: P2 } as GameState["step"],
    });
    expect(control(theirTurn(merc), abilityOffTurn).ok, "on the other player's own turn it is allowed").toBe(true);
    seen.mercOtherPlayerRefused.push(label);
    const result = play(mercIntoPlay(withForm(s, { heroForm: 0 }, P1), P1), label, {
      stopAtRound: 3,
      policy: policyOf(["yes"]),
    });
    expect(completedRounds(result)).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Staged: Plot Convenience across two players keeps ownership", () => {
  it("a card taken from under it stays its owner's while in the other player's hand, and is spent into its owner's discard pile", () => {
    const label = "plot";
    let s = newGame("on-the-run", [DEADPOOL, CABLE], 1, label, { firstPlayerIndex: 0 });
    s = conjureInPlay(s, P1, PLOT);
    const plot = allOfCode(s, PLOT)[0]!;
    s = moveToHand(s, P1, "44017").state; // Barely a Scratch: one [mental] icon, a 'Pool aspect card
    s = moveToHand(s, P2, "40019").state; // Cable's Lock and Load: a player side scheme of cost 1
    const barely = handIdOf(s, P1, "44017");
    const policy = policyOf(["yes"], undefined, undefined, { prefer: ["Attach", "Barely"] });
    const action = "44050.plot-convenience-action";
    const shots: Record<string, GameState> = {};
    const result = play(s, label, {
      policy,
      stopAfterScript: true,
      script: [
        () => use(P1, plot, action), // round 1, P1: attach Barely a Scratch facedown
        endTurnScript(P1),
        endTurnScript(P2),
        (state) => {
          shots.attached = state;
          policy.prefer = ["Add 1 card", "Barely"];
          return use(P2, plot, action); // round 2: P2 takes the card into their own hand
        },
        (state) => {
          shots.taken = state;
          return playScript("40019", { who: P2, pay: ["44017"] })(state);
        },
        (state) => {
          shots.spent = state;
          return endTurnScript(
            state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : P2,
          )();
        },
      ],
    });
    const attached = shots.attached!;
    expect(attached.instances[barely]!.attachedTo, "round 1: it sits facedown under Plot Convenience").toBe(plot);
    expect(attached.instances[barely]!.faceup).toBe(false);
    expect(attached.round).toBe(2);
    expect(
      attached.step.phase === "player" && attached.step.kind === "turn" && attached.step.activePlayerId,
      "round 2 starts with the second seat",
    ).toBe(P2);
    const taken = shots.taken!;
    expect(playerOf(taken, P2).hand, "in Cable's player's hand").toContain(barely);
    expect(taken.instances[barely]!.ownerId, "still owned by Deadpool's player").toBe(P1);
    const spent = shots.spent!;
    expect(playerOf(spent, P1).discard, "spent: into its OWNER's discard pile").toContain(barely);
    expect(playerOf(spent, P2).discard).not.toContain(barely);
    expect(result.session.state.instances[barely]!.ownerId).toBe(P1);
    seen.plotConvenience.push(label);
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("every targeted check was seen at least once", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    const missing = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([k]) => k);
    expect(missing, `never seen: ${missing.join(", ")}`).toEqual([]);
  });
});
