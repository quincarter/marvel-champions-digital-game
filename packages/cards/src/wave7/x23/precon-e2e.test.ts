import {
  activeEncounterDeckId,
  applyCommand,
  cardsMatch,
  characterProfile,
  createGame,
  playerSideSchemeLimit,
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
import {
  P1,
  P2,
  firstLegal,
  moveToHand,
  patchInstance,
  payWith,
  playerOf,
  settle,
  use,
} from "../../testing/harness.js";
import { moveToDiscard, stackSetAside, stackSetAsideBehindBoost, withForm } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE7_DEPS, wave7Scenario, wave7StarterDeckSetup } from "../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with X-23's precon (`x-23-aggression`, cards 43001-43040) through the real engine and the real wave 7
 * scripts, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) one command at a time, so that
 * every state is checked against the invariants below (the shape follows `../psylocke/precon-e2e.test.ts`):
 *
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered (no soft lock);
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, "Villain Phase",
 *   pp. 51-52), and rounds advance by exactly one;
 * - the player side scheme limit is one for one or two starting players (RRG 1.8 "Player Side Scheme Limit", p. 34);
 * - no card instance sits in two zones; every card a player's deck started with is still somewhere; cards in a hand,
 *   deck or discard pile belong to that player (RRG 1.8 "Owner", "Controller", p. 31);
 * - no two unique cards under one table "match" (RRG 1.8 "Unique Icon", p. 45), the player side schemes in the villain
 *   area included (two copies of Specialized Training 43021 are never in play at once);
 * - no player controls more restricted cards than the restricted limit while no prompt is open (RRG "Restricted", p. 38);
 * - the first player token passes to the next seat at the end of each round (RRG 1.8 "First Player", p. 20);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * X-23's own rules, asserted wherever a game reaches them (the `seen` tally; the last test asserts every check was
 * seen at least once, naturally or in a staged state, as each test says): Shhnk! puts X-23's Claws into play on her
 * identity (RRG "Permanent", p. 32); Living Weapon readies her after damage, once per phase; Honey Badger's response,
 * and none when the damage defeats her (RRG "Damage" steps 8-9, p. 14); the Claws' +2 ATK to the end of the round;
 * Laura Kinney's shuffle-and-draw; Sisterly Bond's live bonus; the side-scheme-in-victory-display restriction;
 * Specialized Training's set-aside Specialists (RRG "Linked (Card Title)", p. 27); Self-Isolation; the nemesis cards.
 *
 * Deviations from the driver, all about policy and not about the rules: Hope Summers is never declared a defender
 * (Stryfe: "If Hope Summers is defeated, you lose"; nor is a Morlock in Morlock Siege, whose main scheme loses the
 * game when no Morlock ally is in play); a hero defends when Hope is the target; a turn is ended after 40 commands.
 */

const X23 = { starterDeckId: "x-23-aggression" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
const DOMINO = { starterDeckId: "domino-justice" } as const;
const CABLE_PRECON = wave7StarterDeckSetup("cable-leadership");
const DOMINO_PRECON = wave7StarterDeckSetup("domino-justice");
/** Cable's and Domino's precons plus one Specialized Training (43021, basic): both decks hold it. */
const CABLE_TRAINING = {
  identityCardId: CABLE_PRECON.identityCardId as string,
  deck: [...CABLE_PRECON.deck.map((c) => c as string), "43021"],
  ...(CABLE_PRECON.aspects ? { aspects: CABLE_PRECON.aspects } : {}),
} as const;
const DOMINO_TRAINING = {
  identityCardId: DOMINO_PRECON.identityCardId as string,
  deck: [...DOMINO_PRECON.deck.map((c) => c as string), "43021"],
  ...(DOMINO_PRECON.aspects ? { aspects: DOMINO_PRECON.aspects } : {}),
} as const;
type Seat = typeof X23 | typeof CABLE | typeof DOMINO | typeof CABLE_TRAINING | typeof DOMINO_TRAINING;

const HOPE_SUMMERS = "40130";
const CLAWS = "43002";
const CLAWS_ACTION = "43002.x-23s-claws-action";
const BADGER = "43003";
const BOND = "43007";
const TRAINING = "43021";
const LIVING_WEAPON = "43001a.living-weapon";
const LAURA = "43001b.laura-kinney-action";
const HB_RESPONSE = "43003.honey-badger-response";
const TRAINING_ABILITY = "43021.when-defeated";
const OBLIGATION = "43028";
const SELF_ISOLATION_RESPONSE = "43028.self-isolation-response";
const SPECIALISTS = ["43034", "43035", "43036", "43037"];
const CRITICAL_HIT_RESPONSE = "43016.critical-hit-response";
const NEMESIS = ["43029", "43030", "43031", "43032", "43033"];

/** Which targeted checks were observed, and where. */
const seen = {
  setupClaws: [] as string[],
  livingWeapon: [] as string[],
  livingWeaponAfterClawsCost: [] as string[],
  livingWeaponOncePerPhase: [] as string[],
  clawsPlusTwoAtk: [] as string[],
  clawsEndsAtEndOfRound: [] as string[],
  lauraAction: [] as string[],
  honeyBadgerResponse: [] as string[],
  honeyBadgerDefeatedNoResponse: [] as string[],
  sisterlyBondThwart: [] as string[],
  sisterlyBondAttack: [] as string[],
  sisterlyBondWithClaws: [] as string[],
  sideSchemeRefused: [] as string[],
  sideSchemePlayable: [] as string[],
  specialistTaken: [] as string[],
  specialistNotOffered: [] as string[],
  twoSetsSetAside: [] as string[],
  selfIsolationTuck: [] as string[],
  selfIsolationRecovery: [] as string[],
  deathstrikeDefeated: [] as string[],
  cybermodsShuffle: [] as string[],
  nemesisRevealed: [] as string[],
  twoPlayerTokenPasses: [] as string[],
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
const inst = (s: GameState, id: InstanceId) => s.instances[id]!;

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
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/** Cards a player controls that are in play: the identity, the play area and everything attached to those. */
function inPlayOf(s: GameState, playerId: PlayerId): InstanceId[] {
  const player = s.players.find((p) => p.playerId === playerId)!;
  const roots = [player.identity.instanceId, ...player.playArea];
  return roots.flatMap((id) => [id, ...(s.instances[id]!.attachments as readonly InstanceId[])]);
}

/**
 * Throws a descriptive error on the first broken invariant of `state`. `dealtTo` maps every card a player's deck started
 * with to that player: encounter cards change owner when a rule says so ("ownershipChanged"), so ownership of the
 * deck's own cards is read from setup, not from `ownerId`.
 */
function checkState(s: GameState, dealtTo: ReadonlyMap<string, PlayerId>, where: string): void {
  const fail = (message: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${message}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length)
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} but offers ${choice.options.length}`);
    if (choice.minSelections > choice.maxSelections) fail(`${choice.prompt.kind}: min > max`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1) fail(`${id} (${cardName(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  const limit = playerSideSchemeLimit(s);
  const sideSchemes = s.villainArea.filter((id) => cardType(s, id) === "player_side_scheme");
  if (choice?.prompt.kind !== "discardOverPlayerSideSchemeLimit" && sideSchemes.length > limit)
    fail(`${sideSchemes.length} player side schemes in play, limit ${limit}`);
  // A unique player side scheme (Specialized Training, 43021) is never in play twice (RRG "Unique Icon", p. 45).
  for (let i = 0; i < sideSchemes.length; i++)
    for (let j = i + 1; j < sideSchemes.length; j++)
      if (codeOf(s, sideSchemes[i]!) === codeOf(s, sideSchemes[j]!) && s.cardPool[codeOf(s, sideSchemes[i]!)]!.unique)
        fail(`two copies of unique ${cardName(s, sideSchemes[i]!)} are in play`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${cardName(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        // A card nobody's deck started with (a Specialist taken from the set-aside area) belongs to its taker.
        if (zone !== "hand" && zone !== "playArea" && dealt === undefined && !SPECIALISTS.includes(codeOf(s, id)))
          fail(`${cardName(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
        if (SPECIALISTS.includes(codeOf(s, id)) && s.instances[id]!.ownerId !== p.playerId)
          fail(`${cardName(s, id)} (${id}) is in ${p.playerId}'s ${zone} but its owner is ${s.instances[id]!.ownerId}`);
      }
  }
  // A Specialist in play belongs to the player whose identity it is attached to (RRG "Linked", p. 27; card text).
  for (const p of s.players)
    for (const id of s.instances[p.identity.instanceId]!.attachments)
      if (SPECIALISTS.includes(codeOf(s, id)) && s.instances[id]!.ownerId !== p.playerId)
        fail(
          `${cardName(s, id)} (${id}) is attached to ${p.playerId}'s identity but owned by ${s.instances[id]!.ownerId}`,
        );
  // Unique Icon (RRG p. 45): no two matching unique cards in play at once, across the whole table.
  const table = s.players.filter((p) => !p.eliminated).flatMap((p) => inPlayOf(s, p.playerId));
  for (let i = 0; i < table.length; i++)
    for (let j = i + 1; j < table.length; j++) {
      const a = s.cardPool[s.instances[table[i]!]!.cardId]!;
      const b = s.cardPool[s.instances[table[j]!]!.cardId]!;
      if (cardsMatch(a, b))
        fail(
          `unique cards ${a.name} (${table[i]} ${a.id}, ctrl ${s.instances[table[i]!]!.controllerId}) and ${b.name} (${table[j]} ${b.id}, ctrl ${s.instances[table[j]!]!.controllerId}) match and are both in play`,
        );
    }
  // Play restrictions that bound what stays in play (card data `playRestrictions`): "Limit 1 per side scheme/enemy" is
  // `maxPerHost` (no more copies attached to one host), "Max N per player" is the copies a player has in play.
  for (const host of Object.values(s.instances)) {
    const byCode = new Map<string, number>();
    for (const a of host.attachments) byCode.set(codeOf(s, a), (byCode.get(codeOf(s, a)) ?? 0) + 1);
    for (const [code, n] of byCode) {
      const max = restrictionsOf(s, code)?.maxPerHost;
      if (max !== undefined && n > max)
        fail(`${n} copies of ${s.cardPool[code]!.name} (max ${max} per host) are attached to ${host.instanceId}`);
    }
  }
  for (const p of s.players) {
    const byCode = new Map<string, number>();
    for (const id of inPlayOf(s, p.playerId))
      if (s.instances[id]!.controllerId === p.playerId) byCode.set(codeOf(s, id), (byCode.get(codeOf(s, id)) ?? 0) + 1);
    for (const [code, n] of byCode) {
      const max = restrictionsOf(s, code)?.maxPerPlayer;
      if (max !== undefined && n > max)
        fail(`${p.playerId} has ${n} copies of ${s.cardPool[code]!.name} in play (max ${max} per player)`);
    }
  }
  // Restricted (RRG p. 38): at most the limit, except while a prompt (the discard down) is open.
  if (!choice)
    for (const p of s.players) {
      const standing = restrictedStanding(s, WAVE7_DEPS, p.playerId);
      if (standing.held.length > standing.limit)
        fail(`${p.playerId} controls ${standing.held.length} restricted cards, the limit is ${standing.limit}`);
    }
}

/**
 * The driver's own answer, except that Hope Summers and a Morlock never defend, and that when Hope Summers herself is
 * the attacked character a hero (identity or ally) that can defend does.
 */
function ownAnswer(s: GameState, choice: PendingChoice): readonly string[] | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const target = choice.prompt.attack.targetCharacterInstanceId;
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

interface Restrictions {
  readonly maxPerHost?: number;
  readonly maxPerPlayer?: number;
  readonly maxPerRound?: number;
  readonly maxPerPhase?: number;
  readonly form?: "hero" | "alterEgo";
  readonly requiresIdentityTrait?: string;
}
const restrictionsOf = (s: GameState, code: string): Restrictions | undefined =>
  (s.cardPool[code] as unknown as { playRestrictions?: Restrictions } | undefined)?.playRestrictions;

/** Every trait printed anywhere on a card (an identity card prints one set per side). */
function traitsOf(card: unknown): string[] {
  if (Array.isArray(card)) return card.flatMap(traitsOf);
  if (typeof card !== "object" || card === null) return [];
  return Object.entries(card).flatMap(([key, value]) =>
    key === "traits" && Array.isArray(value) ? value.map(String) : traitsOf(value),
  );
}

const x23Of = (s: GameState) => s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("43001"));
const atkOf = (s: GameState, id: InstanceId): number | null =>
  (characterProfile(s, id, WAVE7_DEPS) as { atk?: number | null } | undefined)?.atk ?? null;

/** One applied command with everything a staged test asserts against. */
interface Step {
  readonly command: Command;
  readonly before: GameState;
  readonly after: GameState;
  readonly events: readonly GameEvent[];
}

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  readonly firstPlayerByRound = new Map<number, PlayerId | "eliminated">();
  readonly turnOrder = new Map<number, PlayerId[]>();
  readonly steps: Step[] = [];
  private lastRound = 0;
  /** Living Weapon resolutions per `round:phase` (once per phase), and damage taken this phase with none to answer it. */
  private readonly lw = new Map<string, number>();
  private lwOwed: string | null = null;
  private readyOwed = false;
  private hbOwed = 0;
  private hbSeen = 0;
  private readonly defeated = new Set<InstanceId>();
  private readonly plays = new Map<string, number>();
  private training: GameState | null = null;
  private claws: { round: number; atkAfter: number; here: string } | null = null;
  constructor(readonly label: string) {}

  init(initial: GameState): void {
    this.lastRound = initial.round;
    this.firstPlayerByRound.set(initial.round, initial.firstPlayerId);
  }

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    this.steps.push({ command, before, after, events });
    const here = `${this.label} round ${before.round} ${command.type}`;
    const x = x23Of(after);
    const xBefore = x23Of(before);
    const xId = x?.identity.instanceId;
    let round = before.round;
    let phase = before.step.phase as string;
    let exhausted = xId ? (before.instances[xId]?.exhausted ?? false) : false;
    const heroForm = xBefore?.identity.form === "hero" && x?.identity.form === "hero" && command.type !== "changeForm";
    // Damage that is owed an answer: Living Weapon (once per phase), Honey Badger's response (every time).
    // (They persist across commands: a response is offered in a prompt and resolved by the next command.)
    const defeated = this.defeated;
    const clawsDamage = events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === CLAWS_ACTION);
    for (const e of events) {
      switch (e.type) {
        case "roundStarted":
          round = e.round;
          break;
        case "stepChanged":
          phase = e.to.phase;
          break;
        case "cardExhausted":
          if (e.instanceId === xId) exhausted = true;
          break;
        case "cardReadied":
          if (e.instanceId === xId) {
            exhausted = false;
            this.readyOwed = false;
          }
          break;
        case "characterDefeated":
          defeated.add(e.instanceId);
          break;
        case "damageDealt": {
          if (e.amount <= 0) break;
          if (e.targetInstanceId === xId && heroForm && !this.lwOwed && (this.lw.get(`${round}:${phase}`) ?? 0) === 0)
            this.lwOwed = `${round}:${phase}`;
          else if (e.targetInstanceId === xId && heroForm && (this.lw.get(`${round}:${phase}`) ?? 0) >= 1)
            seen.livingWeaponOncePerPhase.push(here);
          if (heroForm && codeOf(after, e.targetInstanceId) === BADGER && e.targetInstanceId in after.instances)
            this.hbOwed++;
          break;
        }
        case "abilityResolved": {
          const id = String(e.abilityId);
          if (id === LIVING_WEAPON) {
            const key = `${round}:${phase}`;
            const n = (this.lw.get(key) ?? 0) + 1;
            this.lw.set(key, n);
            expect(n, `${here}: Living Weapon twice in ${phase} phase of round ${round} (once per phase)`).toBe(1);
            // "Ready X-23": identity exhausted at the time must be readied by the end of this resolution.
            if (exhausted) this.readyOwed = true;
            seen.livingWeapon.push(here);
            if (clawsDamage) seen.livingWeaponAfterClawsCost.push(here);
            this.lwOwed = null;
          }
          if (id === HB_RESPONSE) {
            expect(defeated.has(e.instanceId), `${here}: Honey Badger responded after being defeated`).toBe(false);
            expect(heroForm, `${here}: Honey Badger's Hero Response outside hero form`).toBe(true);
            this.hbSeen++;
            if (exhausted) this.readyOwed = true;
            seen.honeyBadgerResponse.push(here);
          }
          if (id === LAURA) seen.lauraAction.push(here);
          break;
        }
        case "cardPlayed": {
          const r = restrictionsOf(after, String(e.cardId));
          const player = before.players.find((p) => p.playerId === e.playerId);
          if (r && player) {
            if (r.form) expect(player.identity.form, `${here}: ${e.cardId} needs ${r.form} form`).toBe(r.form);
            if (r.requiresIdentityTrait) {
              const traits = traitsOf(before.cardPool[String(player.identity.cardId)]);
              expect(traits, `${here}: ${e.cardId} needs an identity with ${r.requiresIdentityTrait}`).toContain(
                r.requiresIdentityTrait,
              );
            }
            const perRound = r.maxPerRound ?? r.maxPerPhase;
            if (perRound !== undefined) {
              const key = `${e.playerId}:${e.cardId}:${round}${r.maxPerPhase !== undefined ? ":" + phase : ""}`;
              const n = (this.plays.get(key) ?? 0) + 1;
              this.plays.set(key, n);
              expect(
                n,
                `${here}: ${e.cardId} played ${n} times (max ${perRound} per ${r.maxPerRound ? "round" : "phase"})`,
              ).toBeLessThanOrEqual(perRound);
            }
          }
          break;
        }
        case "cardMoved":
          break;
        case "encounterCardRevealed":
          if (NEMESIS.includes(String(e.cardId))) seen.nemesisRevealed.push(`${here} ${String(e.cardId)}`);
          break;
        case "turnStarted":
          this.turnOrder.set(after.round, [...(this.turnOrder.get(after.round) ?? []), e.playerId]);
          break;
        default:
      }
    }
    // Nothing is owed once no prompt is open: every response offered for the damage has been taken or the game is over.
    if (xId && !after.pendingChoice) {
      if (this.readyOwed && !after.outcome)
        expect(after.instances[xId]!.exhausted, `${here}: X-23 not readied by the response`).toBe(false);
      if (!after.outcome && !x!.eliminated) {
        if (this.lwOwed)
          throw new Error(
            `${here}: X-23 took damage in hero form (${this.lwOwed}) and Living Weapon was never offered/resolved`,
          );
        if (this.hbOwed > 0 && this.hbSeen === 0 && defeated.size === 0)
          throw new Error(`${here}: Honey Badger took damage in hero form and her response never resolved`);
      }
      this.readyOwed = false;
      this.lwOwed = null;
      this.hbOwed = 0;
      this.hbSeen = 0;
      this.defeated.clear();
    }
    // The Claws: +2 ATK until the end of the round (RRG "Lasting Effects"/card text).
    if (xId && x!.identity.form === "hero") {
      const used = events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === CLAWS_ACTION);
      const atk = atkOf(after, xId);
      if (used && atk !== null && xBefore) {
        this.claws = { round: after.round, atkAfter: atk, here };
        const base = atkOf(before, xId);
        // (A resolveChoice command can carry other changes, and paying the Claws' 2 damage can defeat her: the staged
        // tests assert the exact numbers.)
        if (base !== null && after.round === before.round && command.type === "useAbility" && !x!.eliminated) {
          // (>=: the Claws' own 2 damage can put a "Now I'm Mad" 43019 over the half-hit-points line, +1 more.)
          expect(atk, `${here}: Claws' ATK`).toBeGreaterThanOrEqual(base + 2);
          seen.clawsPlusTwoAtk.push(here);
        }
      } else if (this.claws && atk !== null) {
        if (after.round > this.claws.round && before.round === this.claws.round) {
          expect(atk, `${here}: Claws' bonus gone in the next round`).toBeLessThan(this.claws.atkAfter);
          seen.clawsEndsAtEndOfRound.push(here);
          this.claws = null;
        }
      }
    }
    this.checkTraining(before, after, events, here);
    this.checkSelfIsolation(before, after, events, here);
    if (after.round !== this.lastRound) {
      expect(after.round - this.lastRound).toBe(1); // the villain phase always completes into exactly the next round
      this.firstPlayerByRound.set(
        after.round,
        after.players.some((p) => p.eliminated) ? "eliminated" : after.firstPlayerId,
      );
      this.lastRound = after.round;
    }
  }
  /**
   * Specialized Training (43021): while a player picks, no Specialist matching one already in play is offered; when the
   * ability has resolved, each player holds one Specialist attached to their identity, as its owner and controller,
   * taken from the set-aside area (card text; RRG "Linked (Card Title)" p. 27, "Unique Icon" pp. 45-46).
   */
  private checkTraining(
    beforeAtCommand: GameState,
    after: GameState,
    events: readonly GameEvent[],
    here: string,
  ): void {
    let before = beforeAtCommand;
    const choice = after.pendingChoice;
    if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "taken") {
      const inPlay = after.players.flatMap((p) =>
        after.instances[p.identity.instanceId]!.attachments.filter((id) => SPECIALISTS.includes(codeOf(after, id))),
      );
      const codes = inPlay.map((id) => codeOf(after, id));
      for (const option of choice.options) {
        const id = option.optionId as InstanceId;
        expect(after.encounterSetAside, `${here}: ${id} is offered from the set-aside area`).toContain(id);
        expect(codes, `${here}: ${codeOf(after, id)} is offered while one is in play`).not.toContain(codeOf(after, id));
      }
      expect(choice.options.length, `${here}: the Specialists still to offer`).toBeGreaterThan(0);
      if (codes.length > 0) seen.specialistNotOffered.push(`${here} offered=${choice.options.length}`);
    }
    // The ability's own resolution is logged before its prompts (a player picks after it); judge it once none is open.
    if (!this.training && events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === TRAINING_ABILITY))
      this.training = before;
    if (this.training && !after.pendingChoice) {
      before = this.training;
      this.training = null;
      const taken: string[] = [];
      for (const p of after.players) {
        if (p.eliminated) continue;
        const own = after.instances[p.identity.instanceId]!.attachments.filter((id) =>
          SPECIALISTS.includes(codeOf(after, id)),
        );
        expect(own, `${here}: ${p.playerId}'s Specialists`).toHaveLength(1);
        const id = own[0]!;
        expect(inst(after, id).ownerId, `${here}: the taker owns the Specialist`).toBe(p.playerId);
        expect(inst(after, id).controllerId, `${here}: the taker controls the Specialist`).toBe(p.playerId);
        expect(inst(after, id).attachedTo).toBe(p.identity.instanceId);
        expect(after.encounterSetAside).not.toContain(id);
        expect(before.encounterSetAside, `${here}: it came from the set-aside area`).toContain(id);
        taken.push(codeOf(after, id));
        seen.specialistTaken.push(`${here} ${p.playerId} ${codeOf(after, id)}`);
      }
      expect(new Set(taken).size, `${here}: two matching unique Specialists in play: ${taken.join(",")}`).toBe(
        taken.length,
      );
    }
  }

  /** Self-Isolation (43028): Honey Badger is tucked facedown under it when revealed; the recovery response frees her. */
  private checkSelfIsolation(before: GameState, after: GameState, events: readonly GameEvent[], here: string): void {
    const x = x23Of(after);
    if (!x) return;
    for (const e of events) {
      if (e.type !== "abilityResolved") continue;
      const id = String(e.abilityId);
      if (id === "43028.self-isolation-constant") {
        const tucked = inst(after, e.instanceId).tucked;
        if (tucked.length > 0) {
          expect(
            tucked.map((t) => codeOf(after, t)),
            `${here}: what Self-Isolation tucks`,
          ).toEqual([BADGER]);
          expect(inst(after, tucked[0]!).faceup, `${here}: Honey Badger is tucked facedown`).toBe(false);
          expect(x.playArea, `${here}: the obligation stays in play`).toContain(e.instanceId);
          seen.selfIsolationTuck.push(here);
        }
      }
      if (id === SELF_ISOLATION_RESPONSE) {
        const tucked = before.instances[e.instanceId]?.tucked ?? [];
        for (const t of tucked) expect(x.discard, `${here}: freed Honey Badger is discarded`).toContain(t);
        expect(x.playArea, `${here}: the obligation is discarded`).not.toContain(e.instanceId);
        seen.selfIsolationRecovery.push(here);
      }
    }
  }
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
): Command {
  const s = session.state;
  const choice = s.pendingChoice;
  if (!choice && !s.outcome && script.length > 0) return script.shift()!(s);
  if (choice) {
    const own = ownAnswer(s, choice);
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
  /** Stop as soon as the script is used up and no prompt is open (staged tests). */
  readonly untilScriptDone?: boolean;
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(initial: GameState, observer: Observer, options: PlayOptions = {}): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
  for (const [id, instance] of Object.entries(initial.instances))
    if (instance.ownerId !== null && PLAYER_CARD_TYPES.includes(cardType(initial, id as InstanceId)))
      dealtTo.set(id, instance.ownerId);
  checkState(initial, dealtTo, "start");
  observer.init(initial);
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const maxCommands = options.maxCommands ?? 2500;
  let commands = 0;
  while (
    !session.state.outcome &&
    (options.stopAtRound === undefined || session.state.round < options.stopAtRound) &&
    !(options.untilScriptDone && script.length === 0 && !session.state.pendingChoice && commands > 0)
  ) {
    if (commands >= maxCommands)
      throw new Error(`no outcome after ${maxCommands} commands (round ${session.state.round})`);
    const before = session.state;
    const command = nextCommand(session, turn, script);
    const result = sessionApply(session, command, WAVE7_DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, dealtTo, `${observer.label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands, label: observer.label };
}

/** The log replays to a deep-equal final state (and the replay itself reports no error). */
function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

/** Setup with the opening hands kept, plus the targeted setup checks (the Claws, the linked Specialists). */
function newGame(
  scenario: string,
  players: readonly Seat[],
  seed: number,
  label = `${scenario}#${seed}`,
  firstPlayerIndex?: number,
): GameState {
  const created = createGame(
    wave7Scenario(scenario, {
      players,
      seed,
      modularSetIds: [],
      ...(firstPlayerIndex === undefined ? {} : { firstPlayerIndex }),
    }),
    WAVE7_DEPS,
  );
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const started = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  noteSetup(started, players, label);
  return started;
}

/**
 * Shhnk! (43001b), Setup: X-23's permanent Claws (43002) is put into play attached to her identity, ready, before the
 * first turn (RRG "Permanent", p. 32), and is in no deck. Every deck that holds Specialized Training (43021) has the
 * four Specialists set aside, ownerless, in the shared set-aside area (RRG "Linked (Card Title)", p. 27).
 */
function noteSetup(s: GameState, players: readonly Seat[], label: string): void {
  const x = x23Of(s);
  if (x) {
    const attached = s.instances[x.identity.instanceId]!.attachments.filter((id) => codeOf(s, id) === CLAWS);
    expect(attached, `${label}: Claws attached to her identity`).toHaveLength(1);
    const claws = attached[0]!;
    expect(inst(s, claws).attachedTo).toBe(x.identity.instanceId);
    expect(inst(s, claws).ownerId).toBe(x.playerId);
    expect(inst(s, claws).exhausted).toBe(false);
    expect(x.deck.includes(claws) || x.hand.includes(claws) || x.discard.includes(claws)).toBe(false);
    expect(Object.values(s.instances).filter((i) => i.cardId === CLAWS)).toHaveLength(1);
    seen.setupClaws.push(label);
  }
  const decksWithTraining = players.filter((p) => {
    const deck = "deck" in p ? (p.deck as readonly string[]) : wave7StarterDeckSetup(p.starterDeckId).deck;
    return deck.some((c) => String(c) === TRAINING);
  }).length;
  const aside = s.encounterSetAside.filter((id) => SPECIALISTS.includes(codeOf(s, id)));
  expect(aside, `${label}: set-aside Specialists`).toHaveLength(4 * decksWithTraining);
  for (const id of aside) expect(inst(s, id).ownerId, "set-aside Specialists have no owner").toBeNull();
  for (const code of SPECIALISTS) expect(aside.filter((id) => codeOf(s, id) === code)).toHaveLength(decksWithTraining);
  if (decksWithTraining === 2) seen.twoSetsSetAside.push(label);
}

const completedRounds = (r: GameResult) => r.session.state.round - 1;

/** Rounds a game must have completed: the greedy driver loses early on most seeds, so only some seeds last. */
describe("X-23 precon, Stryfe and Juggernaut, standard, one player", () => {
  // Seeds 1-3 and 5 end in a loss within two rounds (the driver neglects the main scheme or defends badly); seed 4 and
  // Juggernaut seed 1 last three or more rounds.
  it.each([
    ["stryfe", 1, 2],
    ["stryfe", 2, 2],
    ["stryfe", 3, 1],
    ["stryfe", 4, 3],
    ["stryfe", 5, 1],
    ["juggernaut", 1, 3],
    ["juggernaut", 5, 2],
  ] as const)("%s seed %i plays to an outcome with every invariant intact", (scenario, seed, minRounds) => {
    const start = newGame(scenario, [X23], seed);
    if (scenario === "stryfe") {
      // Appendix II step 11: the setup keyword puts Hope Summers into play under the first player.
      const first = playerOf(start, start.firstPlayerId);
      expect(first.playArea.filter((id) => codeOf(start, id) === HOPE_SUMMERS)).toHaveLength(1);
    }
    const result = play(
      start,
      new Observer(`${scenario}#${seed}`),
      scenario === "stryfe" && seed === 4 ? { stopAtRound: 6 } : {},
    );
    // A loss is legitimate (the greedy driver); stryfe#4 is still running at round 6 (a deliberate stop).
    if (!(scenario === "stryfe" && seed === 4)) expect(result.session.state.outcome).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(minRounds);
    expectReplays(result);
  });
});

describe("X-23 precon, Morlock Siege and Mister Sinister, one player", () => {
  it.each([
    ["morlock-siege", 3],
    ["morlock-siege", 6],
    ["mister-sinister", 4],
    ["mister-sinister", 5],
  ] as const)("%s seed %i plays three full rounds", (scenario, seed) => {
    const result = play(newGame(scenario, [X23], seed), new Observer(`${scenario}#${seed}`), { stopAtRound: 4 });
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

/** Cards stay in their owners' zones at the end (the per-command check enforces it all along). */
function expectOwnersKept(result: GameResult): void {
  const s = result.session.state;
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard"] as const)
      for (const id of p[zone])
        if (inst(s, id).ownerId !== null && PLAYER_CARD_TYPES.includes(cardType(s, id)))
          expect(inst(s, id).ownerId, `${cardName(s, id)} in ${p.playerId}'s ${zone}`).toBe(p.playerId);
}

describe("X-23 with another wave 7 hero, two players", () => {
  // (Seeds chosen so the game lasts three full rounds; Cable's games lose a player in round 3, so one visible pass.)
  it.each([
    ["on-the-run", [X23, CABLE], 1, 1],
    ["on-the-run", [CABLE, X23], 1, 1],
    ["on-the-run", [X23, DOMINO], 2, 2],
    ["on-the-run", [X23, DOMINO], 10, 2],
  ] as const)(
    "%s %# plays three full rounds, the token passes, cards stay with their owners",
    (scenario, seats, seed, passes) => {
      const observer = new Observer(`${scenario}#${seed}+${seats.map((s) => s.starterDeckId).join("+")}`);
      const start = newGame(scenario, seats, seed, observer.label);
      const result = play(start, observer, { stopAtRound: 4 });
      expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
      expectTokenPasses(start, observer, result, passes);
      expectOwnersKept(result);
      expectReplays(result);
    },
  );

  // Both decks hold Specialized Training 43021 (X-23's precon does; Cable's gets one): two sets of linked Specialists
  // are set aside (`noteSetup` asserts the eight, ownerless), and the game plays on under every invariant.
  it.each([
    [[X23, CABLE_TRAINING], 8],
    [[DOMINO_TRAINING, X23], 2],
  ] as const)(
    "both decks hold Specialized Training %#: eight Specialists set aside, three full rounds",
    (seats, seed) => {
      const observer = new Observer(`training#${seed}`);
      const start = newGame("on-the-run", seats, seed, observer.label);
      expect(start.encounterSetAside.filter((id) => SPECIALISTS.includes(codeOf(start, id)))).toHaveLength(8);
      const result = play(start, observer, { stopAtRound: 4 });
      expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
      expectTokenPasses(start, observer, result, 1);
      expectOwnersKept(result);
      expectReplays(result);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Staged states: the same engine, the same observer and invariants, a state set up by surgery (said in each test)
// so that a game need not reach the situation by chance. The real commands do the rest.
// ---------------------------------------------------------------------------------------------------------------

const identityId = (s: GameState, p: PlayerId = P1): InstanceId => playerOf(s, p).identity.instanceId;
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((id) => codeOf(s, id) === code);
const villainId = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const eventsOf = <T extends GameEvent["type"]>(o: Observer, type: T) =>
  o.steps.flatMap((st) => st.events).filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const abilityResolutions = (o: Observer, ability: string) =>
  eventsOf(o, "abilityResolved").filter((e) => String(e.abilityId) === ability);

/** A fresh Stryfe game, one X-23 player, in hero form (surgery: the form) with an untouched hand and deck. */
function heroState(label: string, seed = 1): GameState {
  return withForm(newGame("stryfe", [X23], seed, label), { heroForm: 0 }, P1);
}
/** Stryfe is not tough (a tough status would prevent the damage the numbers below count). */
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainId(s), { statuses: { ...inst(s, villainId(s)).statuses, tough: 0 } });
/** The villain area holds only the main scheme's own cards: no crisis side scheme blocks thwarting, main threat 10. */
const withoutSideSchemes = (s: GameState): GameState =>
  patchInstance(
    { ...s, villainArea: s.villainArea.filter((id) => cardType(s, id) !== "side_scheme") },
    s.mainScheme.instanceId,
    { threat: 10 },
  );
/** Surgery: `code` from the player's hand, deck or discard pile straight into their play area, ready. */
function allyInPlay(s: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const owner = playerOf(s, player);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => codeOf(s, i) === code)!;
  const moved: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((x) => x !== id),
            deck: p.deck.filter((x) => x !== id),
            discard: p.discard.filter((x) => x !== id),
            playArea: [...p.playArea, id],
          }
        : p,
    ),
  };
  return { state: patchInstance(moved, id, { exhausted: false }), id };
}

const useClaws = (s: GameState): Command => use(P1, idsOf(s, CLAWS)[0]!, CLAWS_ACTION);
const attackOn =
  (attacker: (s: GameState) => InstanceId, target: (s: GameState) => InstanceId) =>
  (s: GameState): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker(s),
    targetInstanceId: target(s),
  });
const thwartOn =
  (thwarter: (s: GameState) => InstanceId, scheme: (s: GameState) => InstanceId) =>
  (s: GameState): Command => ({
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: thwarter(s),
    schemeInstanceId: scheme(s),
  });
const endTurnP1 = (): Command => ({ type: "endTurn", playerId: P1 });

describe("Staged: X-23's Claws, Living Weapon and the +2 ATK to the end of the round", () => {
  // Surgery: her identity starts exhausted. The Claws' Action costs 2 damage (taken as a cost); Living Weapon answers
  // it ("after X-23 takes any amount of damage, ready X-23": cost damage is damage taken, RRG "Cost" p. 14).
  it("cost damage readies an exhausted X-23, and +2 ATK (1 -> 3) lasts the round and ends with it", () => {
    let s = heroState("staged-claws");
    const id = identityId(s);
    s = patchInstance(withoutTough(s), id, { exhausted: true });
    expect(atkOf(s, id)).toBe(1);
    const observer = new Observer("staged-claws");
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [useClaws, attackOn(identityId, villainId)],
    });
    const used = observer.steps.findIndex((st) =>
      st.events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === CLAWS_ACTION),
    );
    expect(used, "the Claws' Action resolved").toBeGreaterThanOrEqual(0);
    const cost = eventsOf(observer, "damageDealt").find((e) => e.targetInstanceId === id)!;
    expect(cost.amount, "the Claws' cost damage").toBe(2);
    // (Once in this player phase; the villain phase that follows may well hurt her and use it again.)
    expect(
      observer.steps
        .slice(0, used + 1)
        .flatMap((st) => st.events)
        .filter((e) => e.type === "abilityResolved" && String(e.abilityId) === LIVING_WEAPON),
      "Living Weapon answered the cost damage",
    ).toHaveLength(1);
    expect(
      eventsOf(observer, "cardReadied").some((e) => e.instanceId === id),
      "X-23 was readied",
    ).toBe(true);
    expect(atkOf(observer.steps[used]!.after, id), "ATK after the Claws").toBe(3);
    expect(inst(observer.steps[used]!.after, idsOf(s, CLAWS)[0]!).exhausted, "the Claws exhausted for the cost").toBe(
      true,
    );
    // The basic attack that followed (identity readied by Living Weapon) hit for 3.
    const hit = eventsOf(observer, "damageDealt").find(
      (e) => e.targetInstanceId === villainId(s) && e.sourceInstanceId === id,
    );
    expect(hit?.amount, "the basic attack with +2 ATK").toBe(3);
    // After the villain phase (round 2 has begun) the bonus is gone.
    expect(result.session.state.round).toBe(2);
    expect(atkOf(result.session.state, id), "ATK in the next round").toBe(1);
    seen.clawsPlusTwoAtk.push("staged-claws");
    seen.livingWeaponAfterClawsCost.push("staged-claws");
    seen.clawsEndsAtEndOfRound.push("staged-claws");
    expectReplays(result);
  });
});

describe("Staged: Laura Kinney's Action shuffles Honey Badger or Sisterly Bond from the discard pile and draws 1", () => {
  // Surgery: the card goes from her opening hand or deck to her discard pile (she starts the game in alter-ego form).
  it.each([BADGER, BOND])(
    "with %s in the discard pile: it is shuffled into the deck, 1 card drawn, once per round",
    (code) => {
      const moved = moveToDiscard(newGame("stryfe", [X23], 1, "staged-laura"), P1, code);
      const s = moved.state;
      const handBefore = playerOf(s, P1).hand.length;
      const action = (st: GameState): Command => use(P1, identityId(st), LAURA, [], { card: [moved.id] });
      const observer = new Observer(`staged-laura-${code}`);
      const result = play(s, observer, { script: [action], untilScriptDone: true });
      const events = observer.steps.flatMap((st) => st.events);
      const shuffled = events.filter((e) => e.type === "cardMoved" && e.instanceId === moved.id);
      expect(shuffled.some((e) => e.type === "cardMoved" && e.from.kind === "discard" && e.to.kind === "deck")).toBe(
        true,
      );
      expect(events.filter((e) => e.type === "cardDrawn" && e.playerId === P1)).toHaveLength(1);
      expect(events.some((e) => e.type === "deckShuffled")).toBe(true);
      const after = playerOf(result.session.state, P1);
      expect(after.hand).toHaveLength(handBefore + 1);
      expect(after.discard).not.toContain(moved.id);
      // Once per round (the engine refuses a second use this round).
      expect(applyCommand(result.session.state, action(result.session.state), WAVE7_DEPS).ok).toBe(false);
      seen.lauraAction.push(`staged-${code}`);
    },
  );

  it("with neither card in the discard pile the Action cannot be started", () => {
    const s = newGame("stryfe", [X23], 1, "staged-laura-none");
    expect(playerOf(s, P1).discard).toHaveLength(0);
    expect(applyCommand(s, use(P1, identityId(s), LAURA, [], { card: [] }), WAVE7_DEPS).ok).toBe(false);
  });
});

describe("Staged: X-23 acting on another player's turn", () => {
  // A player may use an Action ability during another player's turn (RRG "Action", p. 4; the task's rules in force). The
  // Claws' cost damage on P2's identity is answered by P2's Living Weapon, while P1 is the active player.
  it("P2's X-23 uses the Claws' Action during P1's turn; Living Weapon (her own response) readies her", () => {
    const base = newGame("stryfe", [CABLE, X23], 1, "staged-off-turn");
    expect(base.step.kind === "turn" && base.step.activePlayerId).toBe(P1);
    const s = patchInstance(withForm(base, { heroForm: 0 }, P2), identityId(base, P2), { exhausted: true });
    const claws = idsOf(s, CLAWS)[0]!;
    expect(inst(s, claws).ownerId).toBe(P2);
    const observer = new Observer("staged-off-turn");
    const result = play(s, observer, { script: [() => use(P2, claws, CLAWS_ACTION)], untilScriptDone: true });
    const after = result.session.state;
    expect(inst(after, identityId(after, P2)).damage).toBe(2);
    expect(inst(after, identityId(after, P2)).exhausted, "readied by Living Weapon").toBe(false);
    expect(abilityResolutions(observer, LIVING_WEAPON)).toHaveLength(1);
    expect(atkOf(after, identityId(after, P2))).toBe(3);
    expect(after.step.kind === "turn" && after.step.activePlayerId, "still P1's turn").toBe(P1);
  });
});

describe("Staged: Honey Badger's Hero Response readies X-23, and does not happen when the damage defeats her", () => {
  // Surgery: Honey Badger (2 hit points) in play, X-23 exhausted, hero form. Her basic attack deals her 1 consequential
  // damage (card data; RRG "Consequential Damage" p. 10).
  const stage = (badgerDamage: number) => {
    const placed = allyInPlay(heroState("staged-badger"), BADGER);
    const s = patchInstance(withoutTough(placed.state), placed.id, { damage: badgerDamage });
    return { state: patchInstance(s, identityId(s), { exhausted: true }), badger: placed.id };
  };
  it("survives with 1 damage: the response readies X-23", () => {
    const { state, badger } = stage(0);
    const observer = new Observer("staged-badger-live");
    const result = play(state, observer, {
      script: [attackOn(() => badger, villainId)],
      untilScriptDone: true,
    });
    expect(abilityResolutions(observer, HB_RESPONSE)).toHaveLength(1);
    expect(inst(result.session.state, badger).damage).toBe(1);
    expect(inst(result.session.state, identityId(state)).exhausted).toBe(false);
  });
  it("defeated by the damage (1 damage already): no response, X-23 stays exhausted (RRG 'Damage' step 8 before 9, p. 14)", () => {
    const { state, badger } = stage(1);
    const observer = new Observer("staged-badger-dead");
    const result = play(state, observer, {
      script: [attackOn(() => badger, villainId)],
      untilScriptDone: true,
    });
    expect(eventsOf(observer, "characterDefeated").some((e) => e.instanceId === badger)).toBe(true);
    expect(abilityResolutions(observer, HB_RESPONSE)).toHaveLength(0);
    expect(playerOf(result.session.state, P1).discard).toContain(badger);
    expect(inst(result.session.state, identityId(state)).exhausted).toBe(true);
    seen.honeyBadgerDefeatedNoResponse.push("staged-badger-dead");
  });
});

describe("Staged: Sisterly Bond adds X-23's matching power to Honey Badger's basic thwart and attack", () => {
  // Surgery: Honey Badger in play (ATK 1, THW 1), Sisterly Bond in hand, no tough status, no crisis side scheme, main
  // scheme at 10. X-23 (hero form): ATK 1, THW 2; the Claws' Action first (+2 ATK) shows the bonus is read live.
  const stage = () => {
    const placed = allyInPlay(heroState("staged-bond"), BADGER);
    const s = withoutSideSchemes(withoutTough(moveToHand(placed.state, P1, BOND).state));
    return { state: s, badger: placed.id };
  };
  it.each([
    ["attack", false, 2],
    ["attack", true, 4],
    ["thwart", false, 3],
    ["thwart", true, 3],
  ] as const)("Honey Badger's basic %s, Claws first: %s -> %i", (power, claws, expected) => {
    const { state, badger } = stage();
    const act =
      power === "attack"
        ? attackOn(() => badger, villainId)
        : thwartOn(
            () => badger,
            (s) => s.mainScheme.instanceId,
          );
    const observer = new Observer(`staged-bond-${power}-${claws}`);
    const result = play(state, observer, { script: claws ? [useClaws, act] : [act], untilScriptDone: true });
    expect(eventsOf(observer, "cardPlayed").filter((e) => String(e.cardId) === BOND)).toHaveLength(1);
    if (power === "attack") {
      const dealt = eventsOf(observer, "damageDealt")
        .filter((e) => e.sourceInstanceId === badger && e.targetInstanceId === villainId(state))
        .reduce((n, e) => n + e.amount, 0);
      expect(dealt, "damage to the villain").toBe(expected);
      seen.sisterlyBondAttack.push(`staged claws=${claws}`);
    } else {
      const removed = 10 - inst(result.session.state, state.mainScheme.instanceId).threat;
      expect(removed, "threat removed").toBe(expected);
      seen.sisterlyBondThwart.push(`staged claws=${claws}`);
    }
    if (claws) seen.sisterlyBondWithClaws.push(`staged ${power}`);
    expect(playerOf(result.session.state, P1).discard.some((i) => codeOf(result.session.state, i) === BOND)).toBe(true);
  });
});

describe("Staged: an event that needs a side scheme in the victory display (Critical Hit 43016)", () => {
  // Surgery: Critical Hit in hand; in the second case Stryfe's crisis side scheme sits in the victory display.
  const stage = (inVictoryDisplay: boolean) => {
    let s = withoutTough(moveToHand(heroState("staged-hit"), P1, "43016").state);
    const side = s.villainArea.filter((id) => cardType(s, id) === "side_scheme");
    expect(side.length).toBeGreaterThan(0);
    expect(s.victoryDisplay).toHaveLength(0);
    if (inVictoryDisplay)
      s = { ...s, villainArea: s.villainArea.filter((id) => id !== side[0]), victoryDisplay: [side[0]!] };
    return s;
  };
  it("not offered without one (RRG 'Play Restrictions', 'Window')", () => {
    const observer = new Observer("staged-hit-without");
    const result = play(stage(false), observer, { script: [attackOn(identityId, villainId)], untilScriptDone: true });
    const offered = eventsOf(observer, "windowOpened").flatMap((e) => e.candidates.map((c) => String(c.abilityId)));
    expect(offered).not.toContain(CRITICAL_HIT_RESPONSE);
    expect(eventsOf(observer, "cardPlayed").some((e) => String(e.cardId) === "43016")).toBe(false);
    expect(playerOf(result.session.state, P1).hand.some((i) => codeOf(result.session.state, i) === "43016")).toBe(true);
    seen.sideSchemeRefused.push("staged-hit-without");
  });
  it("offered with one, and played: the attacked enemy is stunned", () => {
    const observer = new Observer("staged-hit-with");
    const result = play(stage(true), observer, { script: [attackOn(identityId, villainId)], untilScriptDone: true });
    const offered = eventsOf(observer, "windowOpened").flatMap((e) => e.candidates.map((c) => String(c.abilityId)));
    expect(offered).toContain(CRITICAL_HIT_RESPONSE);
    expect(eventsOf(observer, "cardPlayed").some((e) => String(e.cardId) === "43016")).toBe(true);
    const villain = inst(result.session.state, villainId(result.session.state));
    expect(villain.statuses.stunned, "Stryfe stunned by Critical Hit").toBeGreaterThan(0);
    seen.sideSchemePlayable.push("staged-hit-with");
  });
});

describe("Staged: Specialized Training's linked Specialists (RRG 'Linked (Card Title)', p. 27)", () => {
  /**
   * The real play of Specialized Training from hand, then (surgery) its threat set to 1, then a real basic thwart that
   * defeats it. `seats`: X-23 first.
   */
  function trained(seats: readonly Seat[], label: string) {
    let s = newGame("stryfe", seats, 1, label);
    s = withForm(s, { heroForm: 0 }, P1);
    s = moveToHand(s, P1, TRAINING).state;
    const training = idsOf(s, TRAINING).find((id) => inst(s, id).ownerId === P1)!;
    const first = new Observer(`${label}-play`);
    const played = play(s, first, {
      script: [
        (st) => ({
          type: "playCard",
          playerId: P1,
          cardInstanceId: training,
          payment: payWith(st, P1, 1, [training]).map((fromHand) => ({ fromHand })),
          attachToInstanceId: null,
        }),
      ],
      untilScriptDone: true,
    });
    const mid = played.session.state;
    expect(mid.villainArea, "Specialized Training is in play").toContain(training);
    const lowered = patchInstance(mid, training, { threat: 1 });
    const second = new Observer(`${label}-defeat`);
    const done = play(lowered, second, {
      script: [thwartOn(identityId, () => training)],
      untilScriptDone: true,
    });
    return { second, done, training };
  }

  it("X-23 and Cable (both decks hold it): eight set aside, the first picker sees 8, the next 6 (the code in play is not offered), owners are the takers", () => {
    const { second, done } = trained([X23, CABLE_TRAINING], "staged-training-2");
    const s = done.session.state;
    const prompts = second.steps
      .map((st) => st.after.pendingChoice)
      .filter((c): c is PendingChoice => c?.prompt.kind === "chooseCards" && c.prompt.slot === "taken");
    expect(prompts.map((c) => c.options.length)).toEqual([8, 6]);
    expect(prompts.map((c) => c.playerId)).toEqual([P1, P2]);
    expect(s.encounterSetAside.filter((id) => SPECIALISTS.includes(codeOf(s, id)))).toHaveLength(6);
    for (const p of s.players) {
      const own = s.instances[p.identity.instanceId]!.attachments.filter((id) => SPECIALISTS.includes(codeOf(s, id)));
      expect(own, `${p.playerId}'s Specialist`).toHaveLength(1);
      expect(inst(s, own[0]!).ownerId).toBe(p.playerId);
    }
    expect(
      s.villainArea.some((id) => codeOf(s, id) === TRAINING),
      "the defeated side scheme left play",
    ).toBe(false);
    expectReplays(done);
  });

  it("one player: she takes one Specialist (the other three stay set aside)", () => {
    const { done, second } = trained([X23], "staged-training-1");
    const s = done.session.state;
    expect(s.encounterSetAside.filter((id) => SPECIALISTS.includes(codeOf(s, id)))).toHaveLength(3);
    expect(seen.specialistTaken.some((x) => x.includes("staged-training-1-defeat"))).toBe(true);
    expect(second.steps.length).toBeGreaterThan(0);
  });
});

/** `code` (an encounter card in a deck) moved to second from the top, so the villain's boost card does not eat it. */
function encounterBehindBoost(state: GameState, code: string): GameState {
  const [deckId, pile] = Object.entries(state.encounterDecks).find(([, d]) =>
    d.deck.some((id) => codeOf(state, id) === code),
  )!;
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  const rest = pile.deck.filter((i) => i !== id);
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [rest[0]!, id, ...rest.slice(1)] } },
  };
}

describe("Staged: her obligation Self-Isolation (43028)", () => {
  // Surgery: the obligation moved behind the villain's boost card, Honey Badger in hand, 3 damage on her alter-ego.
  // The script ends round 1 at once, so the obligation is revealed in that villain phase; in round 2 she recovers.
  it("tucks Honey Badger facedown under it; the basic recovery's response discards both", () => {
    let s = newGame("stryfe", [X23], 1, "staged-self-isolation");
    s = moveToHand(s, P1, BADGER).state;
    s = patchInstance(encounterBehindBoost(s, OBLIGATION), identityId(s), { damage: 3 });
    const badger = idsOf(s, BADGER)[0]!;
    const observer = new Observer("staged-self-isolation");
    const result = play(s, observer, {
      script: [endTurnP1, () => ({ type: "basicRecover", playerId: P1 })],
      untilScriptDone: true,
    });
    const revealed = abilityResolutions(observer, "43028.self-isolation-constant");
    expect(revealed).toHaveLength(1);
    const obligation = revealed[0]!.instanceId;
    expect(seen.selfIsolationTuck.some((x) => x.startsWith("staged-self-isolation"))).toBe(true);
    expect(abilityResolutions(observer, SELF_ISOLATION_RESPONSE)).toHaveLength(1);
    const end = playerOf(result.session.state, P1);
    expect(end.discard, "Honey Badger is freed to her owner's discard pile").toContain(badger);
    expect(end.playArea).not.toContain(obligation);
    expect(inst(result.session.state, obligation).tucked).toEqual([]);
    expect(seen.selfIsolationRecovery.some((x) => x.startsWith("staged-self-isolation"))).toBe(true);
  });
});

describe("Staged: nemesis cards (Lady Deathstrike, Cybermods) resolving, in two real stretches", () => {
  /** Reveals set-aside nemesis card `code` in round 1's villain phase (a real endTurn), then returns the round 2 state. */
  function revealed(code: string, label: string) {
    const s = stackSetAsideBehindBoost(newGame("stryfe", [X23], 1, label), code);
    const first = new Observer(`${label}-reveal`);
    const result = play(s, first, { stopAtRound: 2, script: [endTurnP1] });
    expect(result.session.state.outcome).toBeNull();
    return result;
  }

  it("Lady Deathstrike: defeated, the top encounter card is discarded and the defeating player takes 1 indirect damage per boost icon (3: In the Name of Vengeance)", () => {
    const stretch1 = revealed("43029", "staged-deathstrike");
    let s = stretch1.session.state;
    const lady = idsOf(s, "43029").find((id) => s.instances[id]!.faceup && !s.encounterSetAside.includes(id))!;
    expect(lady, "Lady Deathstrike was revealed").toBeDefined();
    // Surgery: 4 of her 5 hit points gone, X-23 in hero form and ready, the 3-icon card on top of the encounter deck.
    s = stackSetAside(patchInstance(withForm(s, { heroForm: 0 }, P1), lady, { damage: 4 }), "43030", P1);
    s = patchInstance(s, identityId(s), { exhausted: false });
    const top = s.encounterDecks[activeEncounterDeckId(s)]!.deck[0]!;
    const damageBefore = inst(s, identityId(s)).damage;
    const observer = new Observer("staged-deathstrike-defeat");
    const result = play(s, observer, { script: [attackOn(identityId, () => lady)], untilScriptDone: true });
    const after = result.session.state;
    expect(
      Object.values(after.encounterDecks).some((d) => d.discard.includes(top)),
      "top card discarded",
    ).toBe(true);
    expect(
      Object.values(after.encounterDecks).some((d) => d.discard.includes(lady)),
      "Lady is discarded",
    ).toBe(true);
    expect(inst(after, identityId(after)).damage - damageBefore, "indirect damage = 3 boost icons").toBe(3);
    seen.deathstrikeDefeated.push("staged-deathstrike-defeat");
    expectReplays(result);
  });

  it("Cybermods: with no Lady in play it attaches to a fetched minion; defeated, the minion is shuffled into the encounter deck, not discarded", () => {
    const stretch1 = revealed("43031", "staged-cybermods");
    let s = stretch1.session.state;
    const mods = idsOf(s, "43031")[0]!;
    const minion = s.instances[mods]!.attachedTo;
    expect(minion, "Cybermods is attached to a minion").not.toBeNull();
    expect(cardType(s, minion!)).toBe("minion");
    const hp = (characterProfile(s, minion!, WAVE7_DEPS) as { maxHp: number }).maxHp;
    // (Its tough status, from entering play, is removed too: it would prevent the killing blow.)
    s = patchInstance(withForm(s, { heroForm: 0 }, P1), minion!, {
      damage: hp - 1,
      statuses: { ...inst(s, minion!).statuses, tough: 0 },
    });
    s = patchInstance(s, identityId(s), { exhausted: false });
    const observer = new Observer("staged-cybermods-defeat");
    const result = play(s, observer, { script: [attackOn(identityId, () => minion!)], untilScriptDone: true });
    const after = result.session.state;
    expect(eventsOf(observer, "characterDefeated").some((e) => e.instanceId === minion)).toBe(true);
    expect(
      Object.values(after.encounterDecks).some((d) => d.deck.includes(minion!)),
      "shuffled into the deck",
    ).toBe(true);
    expect(
      Object.values(after.encounterDecks).some((d) => d.discard.includes(minion!)),
      "not discarded",
    ).toBe(false);
    seen.cybermodsShuffle.push("staged-cybermods-defeat");
    expectReplays(result);
  });

  it.each(["43030", "43032", "43033"])("nemesis card %s is revealed and resolves under every invariant", (code) => {
    const s = stackSetAsideBehindBoost(newGame("stryfe", [X23], 1, `staged-${code}`), code);
    const observer = new Observer(`staged-${code}`);
    const result = play(s, observer, { stopAtRound: 3 });
    expect(
      seen.nemesisRevealed.some((x) => x.startsWith(`staged-${code}`) && x.endsWith(code)),
      `${code} revealed`,
    ).toBe(true);
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
