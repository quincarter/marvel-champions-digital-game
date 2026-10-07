import {
  applyCommand,
  cardsMatch,
  createGame,
  hasKeyword,
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
import { P1, P2, firstLegal, moveToHand, patchInstance, playerOf, settle, use } from "../../testing/harness.js";
import { moveToDiscard, stackSetAsideBehindBoost, withForm } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Psylocke's precon (`psylocke-justice`, cards 41001-41024) through the real engine and the real
 * wave 7 scripts, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) one command at a time, so
 * that every state is checked against the invariants below:
 *
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices" are never a soft lock): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, "Villain Phase",
 *   pp. 51-52), and rounds advance by exactly one;
 * - the player side scheme limit is one for one or two starting players (RRG 1.8 "Player Side Scheme Limit", p. 34);
 * - no card instance sits in two zones; every card a player's deck started with is still somewhere; cards stay in
 *   their owner's zones (RRG 1.8 "Owner", "Controller", p. 31);
 * - no two unique cards under one table "match" (RRG 1.8 "Unique Icon", p. 45): Psylocke's identity never sits beside
 *   the Psylocke ally of Angel's deck, nor Angel's identity beside Psylocke's Angel ally;
 * - no player controls more restricted cards than the restricted limit while no prompt is open (RRG 1.8 "Restricted",
 *   p. 38; docs/phase7-wave7.md §4.2 Q38: a Psi-Katana shows the restricted keyword, a Psi-Knife does not);
 * - the first player token passes to the next seat at the end of each round (RRG 1.8 "First Player", p. 20);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Deviations from the driver, both about policy and not about the rules: Hope Summers is never declared a defender
 * (Stryfe: "If Hope Summers is defeated, you lose"; nor is a Morlock in Morlock Siege, whose main scheme loses the
 * game when no Morlock ally is in play), and a turn is ended after 40 commands (the driver's own per-turn cap resets
 * because it is asked for one command at a time).
 *
 * Targeted checks (the `seen` tally; the last test asserts each was seen at least once, naturally or in a staged
 * state, as the test says): the Setup blades, Psi-Energy Control flips (the value follows the new face), a blade's
 * resource as its showing face's type, Betsy Braddock's shuffle, the events' scaling with Knives and Katanas, Body
 * Swapped, the nemesis cards, Lay the Trap.
 */

const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const ANGEL = { starterDeckId: "angel-protection" } as const;
const HOPE_SUMMERS = "40130";
const BLADE = "41002a"; // the Psi-Knife face; the Psi-Katana face is the instance flipped
const CONTROL = "41001a.star-psi-energy-control";
const BETSY_ACTION = "41001b.betsy-braddock-action";
const BODY_SWAPPED = "41025";
const NEMESIS = ["41026", "41027", "41028", "41029"];
const LAY_THE_TRAP = "41016";

type Seat = typeof PSYLOCKE | typeof ANGEL;

/** Which targeted checks were observed, and where. */
const seen = {
  setupBlades: [] as string[],
  controlFlip: [] as string[],
  controlFlipAttackToKatana: [] as string[],
  controlFlipThwart: [] as string[],
  controlFlipAttack: [] as string[],
  katanaPiercing: [] as string[],
  bodySwappedFlipPrompt: [] as string[],
  noControlUnderBodySwapped: [] as string[],
  layTheTrapDamage: [] as string[],
  soaringHearts: [] as string[],
  knifeResource: [] as string[],
  katanaResource: [] as string[],
  betsyShuffle: [] as string[],
  mentalDetection: [] as string[],
  flurry: [] as string[],
  psionicRedirect: [] as string[],
  telepathicSuggestion: [] as string[],
  bodySwapped: [] as string[],
  nemesis: [] as string[],
  layTheTrapPlayed: [] as string[],
  layTheTrapDefeated: [] as string[],
  katanaRestricted: [] as string[],
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
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${cardName(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && zone !== "playArea" && dealt === undefined)
          fail(`${cardName(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  }
  // Unique Icon (RRG p. 45): no two matching unique cards in play at once, across the whole table.
  // (An eliminated player's cards have left the game: Angel's defeated identity does not block the Angel ally.)
  const table = s.players.filter((p) => !p.eliminated).flatMap((p) => inPlayOf(s, p.playerId));
  for (let i = 0; i < table.length; i++)
    for (let j = i + 1; j < table.length; j++) {
      const a = s.cardPool[s.instances[table[i]!]!.cardId]!;
      const b = s.cardPool[s.instances[table[j]!]!.cardId]!;
      if (cardsMatch(a, b))
        fail(
          `unique cards ${a.name} (${table[i]} ${a.id}, ctrl ${s.instances[table[i]!]!.controllerId}) and ${b.name} (${table[j]} ${b.id}, ctrl ${s.instances[table[j]!]!.controllerId}) match and are both in play (forms ${JSON.stringify(s.players.map((p) => [p.playerId, p.identity.form, p.identity.heroFormIndex]))})`,
        );
    }
  // Restricted (RRG p. 38, Q38): at most the limit, except while a prompt (the discard down) is open.
  if (!choice)
    for (const p of s.players) {
      const standing = restrictedStanding(s, WAVE7_DEPS, p.playerId);
      if (standing.held.length > standing.limit)
        fail(`${p.playerId} controls ${standing.held.length} restricted cards, the limit is ${standing.limit}`);
    }
  // A blade shows the restricted keyword on its Psi-Katana face only (Q38).
  for (const id of Object.keys(s.instances) as InstanceId[]) {
    if (codeOf(s, id) !== BLADE || s.instances[id]!.attachedTo === null) continue;
    const restricted = hasKeyword(s, id, "restricted", WAVE7_DEPS);
    if (restricted !== s.instances[id]!.flipped)
      fail(`blade ${id} ${s.instances[id]!.flipped ? "(Katana)" : "(Knife)"} restricted=${restricted}`);
  }
}

/**
 * The driver's own answer, except that Hope Summers and a Morlock never defend, and that when Hope Summers herself is
 * the attacked character a hero (identity or ally) that can defend does (Stryfe and Mister Sinister: "If Hope Summers
 * is defeated, you lose"; the driver's greedy "no defense" would lose round 1).
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

const bladesOf = (s: GameState, playerId: PlayerId): InstanceId[] =>
  inPlayOf(s, playerId).filter((id) => codeOf(s, id) === BLADE);
const psylockeOf = (s: GameState) => s.players.find((p) => codeOf(s, p.identity.instanceId).startsWith("41001"));
const katanasUp = (s: GameState, playerId: PlayerId) => bladesOf(s, playerId).filter((b) => s.instances[b]!.flipped);

interface Pending {
  /** Her identity's basic power in progress (a Psi-Energy Control window), or null. */
  power: string | null;
  /** Psi-Energy Control resolved in this window and its flip has not happened yet. */
  controlResolved: boolean;
  controlFlip: "toKatana" | "toKnife" | null;
  /** All her blades show the Psi-Katana under Body Swapped: Control has nothing to flip and must not be offered. */
  expectNoControl: boolean;
}
const NO_POWER: Pending = { power: null, controlResolved: false, controlFlip: null, expectNoControl: false };

interface PlayRecord {
  readonly code: string;
  readonly here: string;
  readonly events: GameEvent[];
}

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  readonly firstPlayerByRound = new Map<number, PlayerId | "eliminated">();
  readonly turnOrder = new Map<number, PlayerId[]>();
  /** Her identity's basic attacks and thwarts, as they resolved (for the staged tests' exact numbers). */
  readonly basicAttacks: { damage: number; katanas: number; flip: Pending["controlFlip"]; piercing: boolean }[] = [];
  readonly basicThwarts: { amount: number; knives: number; flip: Pending["controlFlip"] }[] = [];
  readonly mentalDetections: { amount: number; knives: number; drawn: number; katanas: number }[] = [];
  readonly flurries: { knives: number; katanas: number; katanaDamage: number; confusedAtEnd: boolean }[] = [];
  private lastRound = 0;
  private pending: Pending = NO_POWER;
  /** Each blade's face (true: Psi-Katana) as the events so far in this command left it. */
  private faces = new Map<InstanceId, boolean>();
  private bodySwappedAt: string | null = null;
  private betsy: { exhaustedBefore: number; here: string } | null = null;
  private readonly plays = new Map<InstanceId, PlayRecord>();
  constructor(readonly label: string) {}

  private knives = () => [...this.faces.values()].filter((f) => !f).length;
  private katanas = () => [...this.faces.values()].filter((f) => f).length;

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const psy = psylockeOf(after);
    const pid = psy?.playerId;
    const identity = psy?.identity.instanceId;
    const here = `${this.label} round ${before.round} ${command.type}`;
    this.faces = new Map(pid ? bladesOf(before, pid).map((id) => [id, before.instances[id]!.flipped]) : []);
    const bodySwapped = this.bodySwappedActive(before, pid);
    if (command.type === "useAbility" && String(command.abilityId) === BETSY_ACTION && pid) {
      expect(before.players.find((p) => p.playerId === pid)!.identity.form, `${here}: Betsy's action form`).toBe(
        "alterEgo",
      );
      this.betsy = {
        exhaustedBefore: bladesOf(before, pid).filter((b) => before.instances[b]!.exhausted).length,
        here,
      };
    }
    // Body Swapped with only Psi-Katanas left: her basic power is used and Control (nothing it may flip) is never offered.
    const basic =
      (command.type === "basicThwart" && command.thwarterInstanceId === identity) ||
      (command.type === "basicAttack" && command.attackerInstanceId === identity);
    if (basic && bodySwapped && [...this.faces.values()].length > 0 && [...this.faces.values()].every((f) => f)) {
      expect(
        events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === CONTROL) ||
          after.pendingChoice?.options.some((o) => o.optionId.includes(CONTROL)),
        `${here}: Psi-Energy Control offered or resolved with only Psi-Katanas under Body Swapped`,
      ).toBeFalsy();
      seen.noControlUnderBodySwapped.push(here);
    }
    for (const e of events) {
      for (const play of this.plays.values()) play.events.push(e);
      switch (e.type) {
        case "resourcesGenerated": {
          const code = String(e.abilityId);
          if (!/^41002[ab]\./.test(code)) break;
          // A blade pays as the type its showing face prints: [mental] (Knife) or [physical] (Katana).
          const katana = this.faces.get(e.instanceId)!;
          expect(code, `${here}: blade ${e.instanceId} face`).toBe(
            katana ? "41002b.psi-katana-resource" : "41002a.psi-knife-resource",
          );
          expect(e.pool, here).toEqual({ physical: katana ? 1 : 0, mental: katana ? 0 : 1, energy: 0, wild: 0 });
          expect(e.amount).toBe(1);
          (katana ? seen.katanaResource : seen.knifeResource).push(here);
          break;
        }
        case "abilityResolved": {
          const id = String(e.abilityId);
          if (id === CONTROL) {
            expect(this.pending.power, `${here}: Psi-Energy Control outside a basic power`).not.toBeNull();
            expect(
              this.pending.expectNoControl,
              `${here}: Control resolved with only Psi-Katanas under Body Swapped`,
            ).toBe(false);
            this.pending.controlResolved = true;
          }
          if (id === "41025.when-revealed") this.bodySwappedAt = here;
          if (id === "41016.when-defeated") expect(e.controllerId, `${here}: Lay the Trap's controller`).toBe(pid);
          break;
        }
        case "cardFlipped": {
          const previous = this.faces.get(e.instanceId);
          if (previous === undefined) break;
          // "You cannot flip your Psi-Katana upgrades" (Body Swapped): a Katana never flips while it is in play.
          expect(bodySwapped && previous, `${here}: ${e.instanceId} was a Psi-Katana flipped under Body Swapped`).toBe(
            false,
          );
          this.faces.set(e.instanceId, e.flipped);
          if (this.pending.controlResolved && this.pending.controlFlip === null) {
            this.pending.controlFlip = e.flipped ? "toKatana" : "toKnife";
            seen.controlFlip.push(here);
            this.pending.controlResolved = false;
          }
          break;
        }
        case "triggerEvent": {
          const ev = e.event as unknown as Record<string, unknown>;
          this.onTrigger(before, after, ev, e.phase, here, identity, pid, events, bodySwapped);
          break;
        }
        case "cardMoved": {
          if (this.betsy && e.from.kind === "discard" && e.to.kind === "deck" && e.to.playerId === pid) {
            const traits = (after.cardPool[e.cardId] as unknown as { traits: readonly string[] }).traits;
            expect(traits, `${this.betsy.here}: Betsy shuffled ${e.cardId}`).toContain("PSIONIC");
            expect(playerOf(after, pid!).deck, `${here}: shuffled card is in her deck`).toContain(e.instanceId);
            expect(
              bladesOf(after, pid!).filter((b) => after.instances[b]!.exhausted).length,
              `${here}: Betsy's cost exhausted a blade`,
            ).toBeGreaterThanOrEqual(this.betsy.exhaustedBefore + 1);
            seen.betsyShuffle.push(this.betsy.here);
            this.betsy = null;
          }
          break;
        }
        case "encounterCardRevealed":
          if (NEMESIS.includes(String(e.cardId))) seen.nemesis.push(`${here} ${String(e.cardId)}`);
          break;
        case "cardPlayed":
          if (String(e.cardId) === LAY_THE_TRAP) seen.layTheTrapPlayed.push(here);
          if (String(e.cardId) === "41007") seen.telepathicSuggestion.push(here);
          if (["41004", "41005", "41006"].includes(String(e.cardId)) && e.playerId === pid)
            this.plays.set(e.instanceId, { code: String(e.cardId), here, events: [] });
          break;
        case "schemeDefeated":
          if (String(e.cardId) === LAY_THE_TRAP) seen.layTheTrapDefeated.push(here);
          break;
        case "turnStarted":
          this.turnOrder.set(after.round, [...(this.turnOrder.get(after.round) ?? []), e.playerId]);
          break;
        default:
      }
    }
    // A prompt that offers a blade to flip never names a Psi-Katana while Body Swapped forbids it, and never offers
    // Psi-Energy Control when every blade is one.
    const choice = after.pendingChoice;
    if (choice && pid && this.bodySwappedActive(after, pid)) {
      const flipPrompt = choice.prompt.kind === "chooseCards" && ["blade", "flip"].includes(String(choice.prompt.slot));
      if (flipPrompt) {
        for (const option of choice.options) {
          const face = after.instances[option.optionId as InstanceId]?.flipped;
          if (face !== undefined)
            expect(face, `${here}: Body Swapped offered Psi-Katana ${option.optionId} to flip`).toBe(false);
        }
        seen.bodySwappedFlipPrompt.push(here);
      }
      if (
        choice.prompt.kind === "chooseTriggers" &&
        choice.options.some((o) => o.optionId.includes(CONTROL)) &&
        bladesOf(after, pid).every((b) => after.instances[b]!.flipped)
      )
        throw new Error(`${here}: Psi-Energy Control offered with only Psi-Katanas under Body Swapped`);
    }
    // Body Swapped's effect (Q43): every PSI-ENERGY upgrade she controls is a Psi-Katana, and exhausted.
    if (this.bodySwappedAt && pid && !after.pendingChoice) {
      const player = after.players.find((p) => p.playerId === pid)!;
      if (!player.eliminated) {
        const blades = bladesOf(after, pid);
        expect(blades.length, `${this.bodySwappedAt}: blades after Body Swapped`).toBe(2);
        for (const b of blades) {
          expect(after.instances[b]!.flipped, `${this.bodySwappedAt}: ${b} flipped`).toBe(true);
          expect(after.instances[b]!.exhausted, `${this.bodySwappedAt}: ${b} exhausted`).toBe(true);
        }
        seen.bodySwapped.push(this.bodySwappedAt);
      }
      this.bodySwappedAt = null;
    }
    if (after.round !== this.lastRound) {
      expect(after.round - this.lastRound).toBe(1); // the villain phase always completes into exactly the next round
      this.firstPlayerByRound.set(
        after.round,
        after.players.some((p) => p.eliminated) ? "eliminated" : after.firstPlayerId,
      );
      this.lastRound = after.round;
    }
    // Katana faces are counted as restricted (checked in `checkState`); note that one was seen.
    if (pid && katanasUp(after, pid).length > 0) seen.katanaRestricted.push(here);
  }

  private onTrigger(
    before: GameState,
    after: GameState,
    ev: Record<string, unknown>,
    phase: string,
    here: string,
    identity: InstanceId | undefined,
    pid: PlayerId | undefined,
    events: readonly GameEvent[],
    bodySwapped: boolean,
  ): void {
    if (ev.kind === "basicPowerUsing" && phase === "initiated" && ev.characterInstanceId === identity) {
      const noControl = bodySwapped && pid !== undefined && [...this.faces.values()].every((f) => f);
      this.pending = { ...NO_POWER, power: String(ev.power), expectNoControl: noControl };
    }
    if (ev.kind === "basicPowerUsed" && ev.characterInstanceId === identity) {
      this.pending = NO_POWER;
    }
    // Her basic thwart: THW 1, +1 per Psi-Knife showing when it resolves (the Knife's constant; the Katana gives ATK).
    if (phase === "resolved" && ev.kind === "thwart" && ev.basic === true && ev.thwarterInstanceId === identity) {
      if (typeof ev.amount === "number") {
        expect(ev.amount, `${here}: basic thwart with ${this.knives()} Knives showing`).toBe(1 + this.knives());
        this.basicThwarts.push({ amount: ev.amount, knives: this.knives(), flip: this.pending.controlFlip });
        if (this.pending.controlFlip) {
          seen.controlFlipThwart.push(`${here} ${this.pending.controlFlip}`);
        }
      }
    }
    // Her damage from an attack: a basic attack has piercing exactly while a Psi-Katana shows, an event's never.
    if (
      ev.kind === "dealDamage" &&
      phase === "initiated" &&
      ev.fromAttack === true &&
      ev.sourceInstanceId === identity
    ) {
      const basic = ev.viaInstanceId === null || ev.viaInstanceId === undefined;
      const piercing = ev.piercing === true;
      if (basic) {
        expect(piercing, `${here}: basic attack piercing with ${this.katanas()} Katanas showing`).toBe(
          this.katanas() > 0,
        );
        if (piercing) seen.katanaPiercing.push(here);
      } else {
        expect(piercing, `${here}: an event's attack does not gain piercing`).toBe(false);
      }
    }
    if (phase === "resolved" && ev.kind === "attack" && ev.basic === true && ev.attackerInstanceId === identity) {
      const results = ev.results as { damage?: number } | undefined;
      this.basicAttacks.push({
        damage: results?.damage ?? -1,
        katanas: this.katanas(),
        flip: this.pending.controlFlip,
        piercing: this.katanas() > 0,
      });
      if (this.pending.controlFlip === "toKatana") seen.controlFlipAttackToKatana.push(here);
      if (this.pending.controlFlip) seen.controlFlipAttack.push(here);
    }
    // Lay the Trap: 5 damage per hero to the villain, dealt by the player who defeated it.
    const source = ev.sourceInstanceId as InstanceId | undefined;
    if (
      ev.kind === "dealDamage" &&
      phase === "initiated" &&
      source &&
      before.instances[source]?.cardId === LAY_THE_TRAP
    ) {
      expect(ev.amount, `${here}: Lay the Trap's damage`).toBe(5 * after.players.length);
      expect(
        after.villains.some((v) => v.instanceId === ev.targetInstanceId),
        `${here}: Lay the Trap hits the villain`,
      ).toBe(true);
      seen.layTheTrapDamage.push(`${here} ${String(ev.amount)}`);
    }
    if (ev.kind === "cardPlayed" && phase === "resolved") {
      const play = this.plays.get(ev.instanceId as InstanceId);
      if (play) {
        this.plays.delete(ev.instanceId as InstanceId);
        this.checkPlay(after, play, identity!, pid!);
      }
    }
    void events;
  }

  /** The precon events' numbers against the blades showing as each resolved (RRG "For Each", p. 20; card text). */
  private checkPlay(after: GameState, play: PlayRecord, identity: InstanceId, pid: PlayerId): void {
    const triggers = play.events.flatMap((e): Record<string, unknown>[] =>
      e.type === "triggerEvent" ? [{ ...(e.event as unknown as Record<string, unknown>), phase: e.phase }] : [],
    );
    const knives = this.knives();
    const katanas = this.katanas();
    if (play.code === "41005") {
      // Mental Detection: "Thwart 1 + 2 per Psi-Knife you control" (one thwart; additional is part of it), then each Katana draws 1.
      const thwart = triggers.find((t) => t.kind === "thwart" && t.phase === "initiated");
      expect(thwart?.amount, `${play.here}: Mental Detection with ${knives} Knives`).toBe(1 + 2 * knives);
      const drawn = play.events.filter((e) => e.type === "cardDrawn" && e.playerId === pid).length;
      expect(drawn, `${play.here}: Mental Detection draws with ${katanas} Katanas`).toBeLessThanOrEqual(katanas);
      this.mentalDetections.push({ amount: Number(thwart?.amount), knives, drawn, katanas });
      seen.mentalDetection.push(`${play.here} knives=${knives} katanas=${katanas} drew=${drawn}`);
    }
    if (play.code === "41004") {
      // Flurry of Blades: attack 2; per Knife confuse a chosen enemy; per Katana 2 damage (not an attack) to a chosen enemy.
      const attack = triggers.find((t) => t.kind === "attack" && t.phase === "initiated");
      expect(attack?.amount, `${play.here}: Flurry's attack`).toBe(2);
      const katanaDamage = triggers.filter(
        (t) => t.kind === "dealDamage" && t.phase === "initiated" && t.fromAttack === false && t.amount === 2,
      ).length;
      expect(katanaDamage, `${play.here}: Flurry's damage with ${katanas} Katanas`).toBeLessThanOrEqual(katanas);
      const target = attack?.targetInstanceId as InstanceId;
      const confusedAtEnd = (after.instances[target]?.statuses.confused ?? 0) > 0;
      this.flurries.push({ knives, katanas, katanaDamage, confusedAtEnd });
      seen.flurry.push(`${play.here} knives=${knives} katanas=${katanas}`);
    }
    if (play.code === "41006") {
      // Psionic Redirect: prevent 2 + 2 per Katana (the attack's own damage caps what is prevented); a Knife confuses the attacker.
      const prevented = play.events.reduce((n, e) => n + (e.type === "damagePrevented" ? e.amount : 0), 0);
      expect(prevented, `${play.here}: Psionic Redirect with ${katanas} Katanas`).toBeLessThanOrEqual(2 + 2 * katanas);
      const defended = triggers.find((t) => t.kind === "defended");
      const enemy = defended?.enemyInstanceId as InstanceId | undefined;
      // (An enemy that cannot take the status, a Stalwart one, stays as it is.) The status card given is read from the
      // play's own events as well as the state after the command: the same command can go on to spend it, when a later
      // attack by that enemy is replaced with a scheme (Hope's Captor) and the confused status card is discarded for it.
      const confusedByPlay = play.events.some(
        (e) => e.type === "statusGiven" && e.instanceId === enemy && e.status === "confused",
      );
      if (enemy && knives > 0 && after.instances[enemy] && !hasKeyword(after, enemy, "stalwart", WAVE7_DEPS))
        expect(
          confusedByPlay || after.instances[enemy]!.statuses.confused > 0,
          `${play.here}: Redirect with ${knives} Knives confuses`,
        ).toBe(true);
      seen.psionicRedirect.push(`${play.here} katanas=${katanas} prevented=${prevented}`);
    }
    void identity;
  }

  private bodySwappedActive(s: GameState, pid: PlayerId | undefined): boolean {
    if (!pid) return false;
    return playerOf(s, pid).playArea.some((id) => codeOf(s, id) === BODY_SWAPPED);
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
  let session = startSession(initial);
  const turn = { key: "", n: 0 };
  const script = [...(options.script ?? [])];
  const maxCommands = options.maxCommands ?? 2500;
  let commands = 0;
  while (!session.state.outcome && (options.stopAtRound === undefined || session.state.round < options.stopAtRound)) {
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

/** Setup with the opening hands kept, plus the targeted setup check (the two Psi-Knives). */
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
  noteSetupBlades(started, label);
  return started;
}

/**
 * Psionic Manifestation (41001b), Setup: both permanent PSI-ENERGY upgrades (41002, Psi-Knife face up) are put into
 * play attached to her identity, ready, before the first turn (RRG "Permanent", p. 32).
 */
function noteSetupBlades(s: GameState, label: string): void {
  const psy = psylockeOf(s);
  if (!psy) return;
  const attached = s.instances[psy.identity.instanceId]!.attachments.filter((id) => codeOf(s, id) === BLADE);
  expect(attached, `${label}: blades attached to her identity`).toHaveLength(2);
  for (const id of attached) {
    expect(s.instances[id]!.flipped, "Knife face up").toBe(false);
    expect(s.instances[id]!.attachedTo).toBe(psy.identity.instanceId);
    expect(s.instances[id]!.ownerId).toBe(psy.playerId);
    expect(s.instances[id]!.exhausted).toBe(false);
    expect(psy.deck.includes(id) || psy.hand.includes(id) || psy.discard.includes(id)).toBe(false);
  }
  // Exactly two blades exist in the whole game for her (the precon has 2 copies; there are no others in her deck).
  expect(Object.values(s.instances).filter((i) => i.cardId === BLADE && i.ownerId === psy.playerId)).toHaveLength(2);
  seen.setupBlades.push(label);
}

const completedRounds = (r: GameResult) => r.session.state.round - 1;

describe("Psylocke precon, Stryfe, standard, one player", () => {
  it.each([1, 2, 3, 4, 5])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const start = newGame("stryfe", [PSYLOCKE], seed);
    // Appendix II step 11: the setup keyword puts Hope Summers into play under the first player.
    const first = playerOf(start, start.firstPlayerId);
    expect(first.playArea.filter((id) => codeOf(start, id) === HOPE_SUMMERS)).toHaveLength(1);
    const result = play(start, new Observer(`stryfe#${seed}`));
    // A loss is legitimate (the greedy driver), but the game must have been played: at least 3 full rounds.
    expect(result.session.state.outcome).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
    expectReplays(result);
  });
});

describe("Psylocke precon, Morlock Siege and Mister Sinister, one player", () => {
  it.each([
    ["morlock-siege", 1],
    ["morlock-siege", 2],
    ["mister-sinister", 3],
    ["mister-sinister", 6],
  ] as const)("%s seed %i plays three full rounds", (scenario, seed) => {
    const result = play(newGame(scenario, [PSYLOCKE], seed), new Observer(`${scenario}#${seed}`), { stopAtRound: 4 });
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

describe("Psylocke and Angel, two players", () => {
  it.each([
    ["on-the-run", 2],
    ["on-the-run", 5],
    ["juggernaut", 6],
  ] as const)("%s seed %i plays three full rounds", (scenario, seed) => {
    const observer = new Observer(`${scenario}#${seed}+angel`);
    const start = newGame(scenario, [PSYLOCKE, ANGEL], seed);
    const result = play(start, observer, { stopAtRound: 4 });
    expect(completedRounds(result)).toBeGreaterThanOrEqual(3);
    // (Juggernaut's game loses a player in round 3, so the token only has to pass once visibly there.)
    expectTokenPasses(start, observer, result, scenario === "on-the-run" ? 2 : 1);
    expectReplays(result);
  });
});

/** A Stryfe game with her identity in hero form, `knives` Psi-Knives (the first ones) and the rest Psi-Katanas showing. */
function staged(knives: number, ...inHand: string[]): GameState {
  let s = newGame("stryfe", [PSYLOCKE], 1, `staged`);
  s = withForm(s, { heroForm: 0 }, P1);
  bladesOf(s, P1).forEach((id, index) => {
    s = patchInstance(s, id, { flipped: index >= knives });
  });
  if (inHand.length > 0) s = moveToHand(s, P1, ...inHand).state;
  return s;
}

/** Plays `code` from hand paying with other hand cards (the printed icons counted) until its printed cost is met. */
const playEvent =
  (code: string, who: PlayerId = P1) =>
  (state: GameState): Command => {
    const hand = playerOf(state, who).hand;
    const id = hand.find((h) => codeOf(state, h) === code)!;
    const cost = (state.cardPool[code] as unknown as { cost: number }).cost;
    const payment: { fromHand: InstanceId }[] = [];
    let paid = 0;
    for (const h of hand) {
      if (paid >= cost) break;
      if (h === id) continue;
      const icons = (state.cardPool[codeOf(state, h)] as unknown as { resourceIcons?: Record<string, number> })
        .resourceIcons;
      payment.push({ fromHand: h });
      paid += Object.values(icons ?? {}).reduce((a, b) => a + b, 0);
    }
    return { type: "playCard", playerId: who, cardInstanceId: id, payment, attachToInstanceId: null };
  };

const basicAttackOnVillain = (state: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: playerOf(state, P1).identity.instanceId,
  targetInstanceId: state.villains[0]!.instanceId,
});
/** Stryfe's crisis side scheme blocks thwarting the main scheme, so the basic thwart goes at that side scheme. */
const basicThwartSideScheme = (state: GameState): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: playerOf(state, P1).identity.instanceId,
  schemeInstanceId: state.villainArea.find((id) => cardType(state, id) === "side_scheme")!,
});

describe("Staged: Psi-Energy Control flips a blade and the value follows the new face", () => {
  // The driver accepts Control and flips the first blade offered (the first Psi-Knife, else the first Psi-Katana).
  // Psylocke ATK 1, THW 1; a Knife face gives +1 THW, a Katana face +1 ATK and piercing on her basic attacks (41002a/b).
  it.each([
    [2, "toKatana", 1, 2],
    [1, "toKatana", 2, 3],
    [0, "toKnife", 1, 2],
  ] as const)(
    "basic attack with %i Knives showing: flip %s leaves %i Katanas, ATK %i",
    (knives, flip, katanas, damage) => {
      const observer = new Observer(`staged-attack-${knives}`);
      const result = play(staged(knives), observer, { stopAtRound: 2, script: [basicAttackOnVillain] });
      expect(observer.basicAttacks[0]).toEqual({ damage, katanas, flip, piercing: true });
      expectReplays(result);
    },
  );

  it.each([
    [2, "toKatana", 1, 2],
    [1, "toKatana", 0, 1],
    [0, "toKnife", 1, 2],
  ] as const)("basic thwart with %i Knives showing: flip %s leaves %i Knives, THW %i", (knives, flip, left, amount) => {
    const observer = new Observer(`staged-thwart-${knives}`);
    const result = play(staged(knives), observer, { stopAtRound: 2, script: [basicThwartSideScheme] });
    expect(observer.basicThwarts[0]).toEqual({ amount, knives: left, flip });
    expectReplays(result);
  });

  // RRG 1.8 "Piercing" (p. 32): a piercing attack discards each tough status card before damage is dealt, so the
  // damage goes through; without piercing a tough status prevents it. The Katana gives her basic attack piercing.
  it("a piercing basic attack (Control flips to the Psi-Katana) deals its damage to a tough villain", () => {
    let s = staged(2);
    const villain = s.villains[0]!.instanceId;
    s = patchInstance(s, villain, { statuses: { ...s.instances[villain]!.statuses, tough: 1 } });
    const observer = new Observer("staged-piercing");
    const result = play(s, observer, { stopAtRound: 2, script: [basicAttackOnVillain] });
    expect(observer.basicAttacks[0]).toEqual({ damage: 2, katanas: 1, flip: "toKatana", piercing: true });
    expect(result.session.state.instances[villain]!.statuses.tough).toBe(0);
    expectReplays(result);
  });
});

describe("Staged: her events scale with the blades showing", () => {
  it.each([
    [2, 5, 0],
    [1, 3, 1],
    [0, 1, 2],
  ] as const)("Mental Detection with %i Knives: thwart %i, draws %i", (knives, amount, drawn) => {
    const observer = new Observer(`staged-md-${knives}`);
    const result = play(staged(knives, "41005"), observer, { stopAtRound: 2, script: [playEvent("41005")] });
    expect(observer.mentalDetections[0]).toEqual({ amount, knives, drawn, katanas: 2 - knives });
    expectReplays(result);
  });

  it.each([
    [2, 0, true],
    [1, 1, true],
    [0, 2, false],
  ] as const)(
    "Flurry of Blades with %i Knives: %i Katana damage events, confused: %s",
    (knives, katanaDamage, confused) => {
      const observer = new Observer(`staged-fb-${knives}`);
      const result = play(staged(knives, "41004"), observer, { stopAtRound: 2, script: [playEvent("41004")] });
      expect(observer.flurries[0]).toEqual({ knives, katanas: 2 - knives, katanaDamage, confusedAtEnd: confused });
      expectReplays(result);
    },
  );
});

describe("Staged: Betsy Braddock's Action shuffles a PSIONIC card from her discard pile into her deck", () => {
  it("exhausts a blade and moves exactly one PSIONIC card from discard to deck", () => {
    // Alter-ego form (as setup leaves it), a PSIONIC event in the discard pile.
    let s = newGame("stryfe", [PSYLOCKE], 1, "staged-betsy");
    s = moveToDiscard(s, P1, "41004").state;
    const identity = playerOf(s, P1).identity.instanceId;
    const observer = new Observer("staged-betsy");
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [(state) => use(P1, identity, BETSY_ACTION, [], { exhausted: [bladesOf(state, P1)[0]!] })],
    });
    expect(seen.betsyShuffle.some((x) => x.startsWith("staged-betsy"))).toBe(true);
    expectReplays(result);
  });
});

describe("Staged: nemesis cards and the obligation", () => {
  it.each(NEMESIS)("nemesis card %s is revealed and resolves under every invariant", (code) => {
    const s = stackSetAsideBehindBoost(newGame("stryfe", [PSYLOCKE], 1, `staged-${code}`), code);
    const observer = new Observer(`staged-${code}`);
    const result = play(s, observer, { stopAtRound: 3 });
    expect(
      seen.nemesis.some((x) => x.startsWith(`staged-${code}`) && x.endsWith(code)),
      `${code} revealed`,
    ).toBe(true);
    expectReplays(result);
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

describe("Staged: Body Swapped (obligation 41025)", () => {
  // Setup surgery only: the obligation is moved to the top of the encounter deck (behind the villain's boost card),
  // so it is revealed in the first villain phase, and she starts in hero form with both Psi-Knives showing.
  it("flips and exhausts both blades, forbids flipping a Psi-Katana, and Control is not offered with only Katanas", () => {
    let s = encounterBehindBoost(staged(2), BODY_SWAPPED);
    s = patchInstance(s, s.mainScheme.instanceId, { threat: 0 }); // keeps the greedy driver alive past round 3
    const observer = new Observer("staged-body-swapped");
    const result = play(s, observer, { stopAtRound: 5 });
    expect(seen.bodySwapped.some((x) => x.startsWith("staged-body-swapped"))).toBe(true);
    expect(
      seen.noControlUnderBodySwapped.length,
      "a basic power used with only Psi-Katanas under Body Swapped",
    ).toBeGreaterThan(0);
    expectReplays(result);
  });
});

describe("Lay the Trap (41016) entering play and being defeated, in games whose seeds produce it", () => {
  // Seeds picked because the greedy driver plays Lay the Trap and then defeats it with a basic thwart: 5 damage per hero
  // to the villain by the player who defeated it (card text); one hero: 5, two heroes: 10; a tough villain prevents it.
  it.each([
    ["mister-sinister", [PSYLOCKE], 1],
    ["on-the-run", [PSYLOCKE, ANGEL], 1],
    ["juggernaut", [PSYLOCKE, ANGEL], 1],
  ] as const)("%s with %j, seed %i", (scenario, seats, seed) => {
    const result = play(newGame(scenario, seats, seed), new Observer(`trap-${scenario}#${seed}`));
    expect(seen.layTheTrapDefeated.some((x) => x.startsWith(`trap-${scenario}#${seed}`))).toBe(true);
    expectReplays(result);
  });
});

describe("Unique cards across the two seats (RRG 1.8 'Unique Icon', p. 45)", () => {
  const twoSeats = (first = 0) => newGame("on-the-run", [PSYLOCKE, ANGEL], 2, "unique", first);
  it("Psylocke's Angel ally cannot be played beside Angel's identity", () => {
    const s0 = twoSeats();
    const { state, ids } = moveToHand(s0, P1, "41003");
    const result = applyCommand(state, playEvent("41003")(state), WAVE7_DEPS);
    expect(ids).toHaveLength(1);
    expect(result.ok ? "played" : result.error.code).toBe("duplicate_unique_card");
  });
  it("Angel's Psylocke ally cannot be played beside Psylocke's identity", () => {
    const s0 = twoSeats(1);
    const { state } = moveToHand(s0, P2, "42002");
    const result = applyCommand(state, playEvent("42002", P2)(state), WAVE7_DEPS);
    expect(result.ok ? "played" : result.error.code).toBe("duplicate_unique_card");
  });
});

describe("Soaring Hearts (Team-Up: Angel and Psylocke)", () => {
  /** Two seats, both hero identities exhausted, Soaring Hearts in Psylocke's hand. `angelForm`: Angel's form. */
  const table = (angelForm: "hero" | "alterEgo"): GameState => {
    let s = newGame("on-the-run", [PSYLOCKE, ANGEL], 2, "staged-soaring", 0);
    s = withForm(s, { heroForm: 0 }, P1);
    if (angelForm === "hero") s = withForm(s, { heroForm: 0 }, P2);
    s = moveToHand(s, P1, "41020").state;
    const angel = playerOf(s, P2).identity.instanceId;
    const psylocke = playerOf(s, P1).identity.instanceId;
    return patchInstance(patchInstance(s, angel, { exhausted: true }), psylocke, { exhausted: true });
  };

  it("cannot be played without Angel in play (RRG 1.8 'Team-Up', p. 43)", () => {
    const s = staged(2, "41020");
    const result = applyCommand(s, playEvent("41020")(s), WAVE7_DEPS);
    expect(result.ok ? "played" : result.error.code).toBe("no_valid_target");
  });

  // RRG 1.8 "Identity" (p. 23): a card that refers to a hero or alter-ego by title refers only to the identity with that
  // title, not the other side of the card; Angel in alter-ego form is Warren Worthington III (docs/phase7-wave7.md Q37).
  it("is not playable while Angel's identity shows his alter-ego side", () => {
    const s = table("alterEgo");
    const result = applyCommand(s, playEvent("41020")(s), WAVE7_DEPS);
    expect(result.ok ? "played" : result.error.code).toBe("no_valid_target");
  });

  it("with Angel in hero form, readies Psylocke and Angel", () => {
    const s = table("hero");
    const angel = playerOf(s, P2).identity.instanceId;
    const psylocke = playerOf(s, P1).identity.instanceId;
    const played = applyCommand(s, playEvent("41020")(s), WAVE7_DEPS);
    expect(played.ok ? "played" : `${played.error.code}: ${played.error.message}`).toBe("played");
    if (!played.ok) return;
    const done = settle(played.state, firstLegal, undefined, WAVE7_DEPS);
    expect(done.instances[angel]!.exhausted).toBe(false);
    expect(done.instances[psylocke]!.exhausted).toBe(false);
    seen.soaringHearts.push("staged");
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
