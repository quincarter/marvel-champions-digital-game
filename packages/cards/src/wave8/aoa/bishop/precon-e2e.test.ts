import {
  validateDeck,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { AOA_STARTER_DECKS, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  applyOk,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play as playCard,
  playerOf,
  settle,
  toHero,
  use,
} from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { stackSetAsideBehindBoost, withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS } from "../../index.js";
import { wave8Scenario, wave8StarterDeckSetup } from "../../setup.js";
import { ENERGY_ABSORPTION_MOMENT } from "./identity.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Bishop's precon (`bishop-leadership`, MC45 p. 22: 40 cards) through the real engine and the real
 * wave 8 scripts, played by the card-name-agnostic greedy driver (`../../../testing/driver.ts`) one command at a time,
 * so every state is checked against the invariants below. Scenarios: Unus the Untouched (the wave's own first
 * scenario, `wave8Scenario("unus")`, standard, one player) and Core's Rhino (standard, no modular set, built by
 * `coreScenario` with Bishop's seat swapped in). Unus is swingy for a one-player precon: the seeded games here are lost
 * in rounds 3 to 6 (Hunting Gene Traitors and Dystopian Nightmare), which is still long enough to see Energy Absorption
 * fire 3 to 4 times per game, so the Unus games assert mechanics, never the outcome. Rhino gives the longer games.
 *
 * Invariants checked after every command:
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices" never a soft lock): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card the deck started with is still somewhere (RRG "Owner", p. 31);
 * - hands refill at the end of the player turn, up to the hand size of the form showing (RRG "Hand Size", Appendix II
 *   "Player Phase" step, p. 51);
 * - the alter-ego Bishop is never offered as a defender, a hero form identity only (RRG "Defend", p. 14: only a hero
 *   or an ally can defend; an alter-ego identity is neither);
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Targeted checks (the `seen` tally; the last test asserts each was seen at least once, naturally or in a staged
 * state, as the test says):
 * - Energy Absorption (45001a, MC45 p. 22 and the card): after he takes damage from an attack, that many cards leave the
 *   top of his deck for his discard pile, each resource card among them goes to his hand, and the moment
 *   "energyAbsorption" is raised once; never offered when the attack was fully stopped (`taken` 0) or in alter-ego form.
 * - Temporally Displaced (45001b): after he changes to the alter-ego form, one TEMPORAL card of his discard pile goes
 *   to his hand (none when there is none).
 * - Energy Conversion (45009): a resource card of his discard pile is shuffled into his deck, and he takes at most 3
 *   damage from that attack.
 *
 * Portal Through Time (45027) is registered (its Forced Interrupt gives surge to the first TEMPORAL card revealed each
 * phase while it is in play); the only path to it is Bantam or Trevor Fitzroy finding it. Not asserted here: its own
 * module's tests stage it.
 */

const BISHOP = { starterDeckId: "bishop-leadership" } as const;
const ABSORPTION = "45001a.energy-absorption";
const DISPLACED = "45001b.temporally-displaced";
const CONVERSION = "45009";
const RIFLE = "45004.bishops-rifle-action";
const UNIFORM = "45005.bishops-uniform-response";
const NEMESIS = ["45025", "45026", "45028", "45029"];

/** Which targeted checks were observed, and where. */
const seen = {
  absorption: [] as string[],
  absorptionResourceToHand: [] as string[],
  absorptionNonResourceStays: [] as string[],
  absorptionMoment: [] as string[],
  absorptionNotOffered: [] as string[],
  displaced: [] as string[],
  displacedMoved: [] as string[],
  displacedEmpty: [] as string[],
  toughStopped: [] as string[],
  conversion: [] as string[],
  conversionCapped: [] as string[],
  alterEgoSchemedAgainst: [] as string[],
  handRefill: [] as string[],
  nemesis: [] as string[],
  blastPlayed: [] as string[],
  blastPaidWithResource: [] as string[],
  blastReadied: [] as string[],
  authorityPlayed: [] as string[],
  authorityDrew: [] as string[],
  authorityNoDraw: [] as string[],
  rifle: [] as string[],
  uniform: [] as string[],
  superCharged: [] as string[],
  stunnedCanceled: [] as string[],
  confusedCanceled: [] as string[],
};

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
  readonly label: string;
}

const typeOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const isTemporal = (s: GameState, id: InstanceId) =>
  (s.cardPool[s.instances[id]!.cardId] as unknown as { traits: readonly string[] }).traits.includes("TEMPORAL");

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

/** Throws a descriptive error on the first broken invariant of `state`. */
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
    if (labels.length > 1) fail(`${id} (${nameOf(s, id as InstanceId)}) is in two zones: ${labels.join(", ")}`);
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${nameOf(s, id as InstanceId)} (${id}) is in no zone`);
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard"] as const)
      for (const id of p[zone]) {
        const dealt = dealtTo.get(id);
        if (dealt !== undefined && dealt !== p.playerId)
          fail(`${nameOf(s, id)} (${id}, dealt to ${dealt}) is in ${p.playerId}'s ${zone}`);
        if (zone !== "hand" && dealt === undefined)
          fail(`${nameOf(s, id)} (${id}) is in ${p.playerId}'s ${zone} but no deck started with it`);
      }
  // Alter-ego Bishop is never offered as a defender (RRG p. 14).
  if (choice?.prompt.kind === "declareDefender") {
    for (const p of s.players) {
      if (p.identity.form === "alterEgo" && choice.options.some((o) => o.optionId === p.identity.instanceId))
        fail(`the alter-ego identity of ${p.playerId} was offered as a defender`);
    }
  }
}

/** Bishop's playerId (the only seat). */
const bishopOf = (s: GameState) => s.players[0]!;

interface PlayRecord {
  readonly here: string;
  /** Resource cards in his discard pile when Energy Conversion was played. */
  readonly available: number;
  readonly events: GameEvent[];
}

/** Watches events, one command at a time, for the targeted checks and the per-round rules. */
class Observer {
  /** The damage Bishop took in the latest attack that dealt damage to him (the `taken` of the resolved dealDamage). */
  private lastTaken = 0;
  private conversion: PlayRecord | null = null;
  private displaced: { here: string; available: number; moved: number } | null = null;
  private lastRound = 0;
  /** Super-Charged's +ATK once its interrupt resolved, waiting for the basic attack's damage. */
  private superCharged: { here: string; counters: number } | null = null;
  /** A Concussive Blast / Command Authority played in the current command, with how it was paid. */
  private signature: {
    code: string;
    here: string;
    paid: boolean;
    exhaustedBefore: boolean;
    resourcesInHand: number;
    events: GameEvent[];
  } | null = null;
  /** Energy Absorption resolutions, offers, and attack damage actually taken (at least 1) seen by this observer. */
  absorptions = 0;
  offers = 0;
  damaged = 0;
  toughPrevented = 0;
  constructor(readonly label: string) {}

  observe(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    if (this.lastRound === 0) this.lastRound = before.round;
    const player = bishopOf(after);
    const pid = player.playerId;
    const identity = player.identity.instanceId;
    const here = `${this.label} round ${before.round} ${command.type}`;
    const formBefore = before.players[0]!.identity.form;
    const absorptionOfferedBefore = !!before.pendingChoice?.options.some((o) => o.optionId.endsWith(ABSORPTION));

    for (const e of events) {
      if (this.conversion) this.conversion.events.push(e);
      if (this.signature && e.type !== "cardPlayed") this.signature.events.push(e);
      switch (e.type) {
        case "triggerEvent": {
          const ev = e.event as unknown as Record<string, unknown>;
          // Damage Bishop takes from an attack, as dealt after defense, prevention and tough.
          if (
            e.phase === "resolved" &&
            ev.kind === "dealDamage" &&
            ev.fromAttack === true &&
            ev.targetInstanceId === identity &&
            typeof ev.taken === "number"
          ) {
            this.lastTaken = ev.taken;
            if (ev.taken >= 1) this.damaged++;
            if (this.conversion) {
              expect(ev.taken, `${here}: Energy Conversion caps the damage taken at 3`).toBeLessThanOrEqual(3);
              seen.conversionCapped.push(here);
            }
          }
          if (
            this.superCharged &&
            e.phase === "initiated" &&
            ev.kind === "dealDamage" &&
            ev.fromAttack === true &&
            ev.sourceInstanceId === identity
          ) {
            // +2 ATK per charge counter, at most +8 (card text, 45006); Bishop's printed ATK is the base.
            const hero = after.cardPool[after.instances[identity]!.cardId] as unknown as HeroIdentityCard;
            const bonus = Math.min(8, 2 * this.superCharged.counters);
            expect(ev.amount, `${here}: basic attack with ${this.superCharged.counters} charge counters`).toBe(
              hero.hero.atk + bonus,
            );
            seen.superCharged.push(`${this.superCharged.here} counters=${this.superCharged.counters}`);
            this.superCharged = null;
          }
          if (e.phase === "resolved" && ev.kind === "enemyAttack") {
            if (this.conversion) this.finishConversion(after, pid);
            // (Not reachable with the precon's enemies: they scheme against an alter-ego. Were an attack to land on
            // him anyway, it is undefended.)
            if (ev.targetInstanceId === identity && formBefore === "alterEgo")
              expect((ev.results as { undefended?: number }).undefended, `${here}: alter-ego attack undefended`).toBe(
                1,
              );
          }
          break;
        }
        case "enemyActivated":
          // RRG 1.8 Appendix II, "Enemy Activations" (pp. 51-52): an enemy attacks a hero and schemes against an alter-ego.
          if (e.playerId === pid && formBefore === "alterEgo") {
            expect(
              e.activation,
              `${here}: ${nameOf(after, e.enemyInstanceId)} activates against alter-ego Bishop`,
            ).toBe("scheme");
            seen.alterEgoSchemedAgainst.push(here);
          }
          break;
        case "damagePrevented":
          if (e.targetInstanceId === identity && e.reason === "tough") {
            this.toughPrevented++;
            seen.toughStopped.push(here);
          }
          break;
        case "cardPlayed":
          if (["45007", "45008"].includes(String(e.cardId)) && e.playerId === pid && command.type === "playCard") {
            // "Paid for this event with a resource card" (Q28 = A): a resource card's resource went toward a cost of
            // at least 1 (docs/phase7-wave8.md section 3.51).
            const paid =
              e.resourcesPaid >= 1 &&
              command.payment.some((p) => "fromHand" in p && typeOf(before, p.fromHand) === "resource");
            this.signature = {
              code: String(e.cardId),
              here,
              paid,
              exhaustedBefore: before.instances[identity]!.exhausted,
              resourcesInHand: 0,
              events: [],
            };
          }
          if (String(e.cardId) === CONVERSION && e.playerId === pid) {
            const discardResources = before.players[0]!.discard.filter((id) => typeOf(before, id) === "resource");
            // (The driver may play both copies in one window: the first shuffles every resource card, the second
            // finds none, so the record keeps the first play's count for the whole attack.)
            this.conversion ??= { here, events: [], available: discardResources.length };
            seen.conversion.push(here);
          }
          break;
        case "encounterCardRevealed":
          if (NEMESIS.includes(String(e.cardId))) seen.nemesis.push(`${here} ${String(e.cardId)}`);
          break;
        case "abilityResolved":
          if (String(e.abilityId) === ABSORPTION) {
            this.absorptions++;
            expect(formBefore, `${here}: Energy Absorption is printed on the hero face`).toBe("hero");
            this.checkAbsorption(before, after, events, here, identity, pid);
          }
          if (String(e.abilityId) === RIFLE) {
            this.signature = {
              code: "45004",
              here,
              paid: false,
              exhaustedBefore: before.instances[identity]!.exhausted,
              resourcesInHand: before.players[0]!.hand.filter((id) => typeOf(before, id) === "resource").length,
              events: [],
            };
          }
          if (String(e.abilityId) === "45006.super-charged-interrupt") {
            // The counters on the upgrade as it was discarded as the cost (the command's before state still has them).
            this.superCharged = { here, counters: before.instances[e.instanceId]?.counters.charge ?? 0 };
          }
          if (String(e.abilityId) === UNIFORM) {
            const resources = after.players[0]!.hand.filter((id) => typeOf(after, id) === "resource").length;
            const damageBefore = before.instances[identity]!.damage;
            if (!events.some((x) => x.type === "damageDealt"))
              expect(after.instances[identity]!.damage, `${here}: Bishop's Uniform heals ${resources}`).toBe(
                Math.max(0, damageBefore - resources),
              );
            seen.uniform.push(`${here} resources=${resources}`);
          }
          if (String(e.abilityId) === DISPLACED) {
            const available = before.players[0]!.discard.filter((id) => isTemporal(before, id)).length;
            this.displaced = { here, available, moved: 0 };
            seen.displaced.push(here);
          }
          break;
        case "cardMoved":
          if (
            this.displaced &&
            e.from.kind === "discard" &&
            e.to.kind === "hand" &&
            (e.to as { playerId?: PlayerId }).playerId === pid
          ) {
            expect(isTemporal(after, e.instanceId), `${here}: Temporally Displaced returns a TEMPORAL card`).toBe(true);
            this.displaced.moved++;
          }
          break;
        case "roundStarted":
          expect(e.round - this.lastRound, "rounds advance one at a time").toBe(1);
          this.lastRound = e.round;
          break;
        default:
      }
    }
    // (The target prompt of the hero action is answered in a later command: the card is judged once nothing is pending.)
    if (this.signature && !after.pendingChoice) {
      const s = this.signature;
      const attack = this.triggers(s.events).find((x) => x.kind === "attack" && x.phase === "initiated");
      const thwart = this.triggers(s.events).find((x) => x.kind === "thwart" && x.phase === "initiated");
      const exhausted = after.instances[identity]!.exhausted;
      const removed = (status: string) =>
        s.events.some((x) => x.type === "statusRemoved" && x.instanceId === identity && x.status === status);
      if (s.code === "45007") {
        if (removed("stunned")) {
          // RRG 1.8 "Labeled Ability" (p. 26): a stunned identity's (attack) ability is canceled entirely, costs
          // excepted, so there is no attack and no ready.
          expect(attack, `${s.here}: stunned Concussive Blast attacks`).toBeUndefined();
          expect(exhausted, `${s.here}: stunned Concussive Blast readies`).toBe(s.exhaustedBefore);
          seen.stunnedCanceled.push(s.here);
        } else {
          // Concussive Blast: attack 6, then ready him only if paid with a resource card (card text, Q28 = A).
          expect(attack?.amount, `${s.here}: Concussive Blast`).toBe(6);
          expect(exhausted, `${s.here}: Concussive Blast paid=${s.paid}`).toBe(s.paid ? false : s.exhaustedBefore);
          seen.blastPlayed.push(s.here);
          if (s.paid) seen.blastPaidWithResource.push(s.here);
          if (s.paid && s.exhaustedBefore) seen.blastReadied.push(s.here);
        }
      } else if (s.code === "45008") {
        const drawn = s.events.filter((x) => x.type === "cardDrawn" && x.playerId === pid).length;
        if (removed("confused")) {
          expect(thwart, `${s.here}: confused Command Authority thwarts`).toBeUndefined();
          expect(drawn, `${s.here}: confused Command Authority draws`).toBe(0);
          seen.confusedCanceled.push(s.here);
        } else {
          // Command Authority: thwart 3, then draw 1 only if paid with a resource card.
          expect(thwart?.amount, `${s.here}: Command Authority`).toBe(3);
          expect(drawn, `${s.here}: Command Authority paid=${s.paid}`).toBe(s.paid ? 1 : 0);
          seen.authorityPlayed.push(s.here);
          (s.paid ? seen.authorityDrew : seen.authorityNoDraw).push(s.here);
        }
      } else {
        // Bishop's Rifle: an attack of 1 per resource card in hand as it resolves (0 in hand: an attack for 0).
        if (removed("stunned")) {
          expect(attack, `${s.here}: stunned Rifle attacks`).toBeUndefined();
          seen.stunnedCanceled.push(s.here);
        } else {
          const resources = s.resourcesInHand;
          if (resources > 0)
            expect(attack?.amount, `${s.here}: Rifle with ${resources} resource cards`).toBe(resources);
          seen.rifle.push(`${s.here} resources=${resources}`);
        }
      }
      this.signature = null;
    }
    if (this.displaced && !after.pendingChoice) {
      expect(
        this.displaced.moved,
        `${this.displaced.here}: Temporally Displaced with ${this.displaced.available} TEMPORAL`,
      ).toBe(this.displaced.available > 0 ? 1 : 0);
      if (this.displaced.moved === 1) seen.displacedMoved.push(this.displaced.here);
      else seen.displacedEmpty.push(this.displaced.here);
      this.displaced = null;
    }
    // Energy Absorption is offered only after damage was taken (`taken` at least 1) and only in hero form.
    const offeredNow =
      !!after.pendingChoice?.options.some((o) => o.optionId.endsWith(ABSORPTION)) && !absorptionOfferedBefore;
    if (offeredNow) {
      this.offers++;
      expect(
        this.lastTaken,
        `${here}: Energy Absorption offered after the attack dealt nothing`,
      ).toBeGreaterThanOrEqual(1);
      expect(after.players[0]!.identity.form, `${here}: offered in alter-ego form`).toBe("hero");
    }
    // A fully stopped attack on a hero-form Bishop offers nothing.
    if (
      events.some(
        (e) =>
          e.type === "triggerEvent" &&
          e.phase === "resolved" &&
          (e.event as unknown as Record<string, unknown>).kind === "dealDamage" &&
          (e.event as unknown as Record<string, unknown>).targetInstanceId === identity &&
          (e.event as unknown as Record<string, unknown>).fromAttack === true &&
          (e.event as unknown as Record<string, unknown>).taken === 0,
      ) &&
      !offeredNow
    )
      seen.absorptionNotOffered.push(here);
    // Hands refill at the end of the player turn.
    if (
      command.type === "endTurn" &&
      !after.outcome &&
      after.step.phase === "villain" &&
      !events.some((e) => e.type === "cardMoved" && e.from.kind === "hand" && e.to.kind !== "hand")
    ) {
      const p = after.players[0]!;
      const card = after.cardPool[after.instances[p.identity.instanceId]!.cardId] as unknown as HeroIdentityCard;
      const handSize = (p.identity.form === "hero" ? card.hero : card.alterEgo).handSize;
      expect(p.hand.length, `${here}: hand after the end of turn (hand size ${handSize})`).toBeGreaterThanOrEqual(
        handSize,
      );
      seen.handRefill.push(here);
    }
  }

  private triggers(events: readonly GameEvent[]): Record<string, unknown>[] {
    return events.flatMap((e): Record<string, unknown>[] =>
      e.type === "triggerEvent" ? [{ ...(e.event as unknown as Record<string, unknown>), phase: e.phase }] : [],
    );
  }

  private finishConversion(after: GameState, pid: PlayerId): void {
    const record = this.conversion!;
    this.conversion = null;
    const moves = record.events.filter(
      (e) =>
        e.type === "cardMoved" &&
        e.from.kind === "discard" &&
        e.to.kind === "deck" &&
        (e.to as { playerId?: PlayerId }).playerId === pid,
    );
    // "Shuffle each resource card in your discard pile into your deck" (45009): all of them, and nothing else.
    expect(moves.length, `${record.here}: resource cards shuffled into the deck`).toBe(record.available);
    for (const m of moves)
      if (m.type === "cardMoved")
        expect(after.cardPool[m.cardId]!.type, `${record.here}: Energy Conversion shuffles resource cards`).toBe(
          "resource",
        );
  }

  private checkAbsorption(
    before: GameState,
    after: GameState,
    events: readonly GameEvent[],
    here: string,
    identity: InstanceId,
    pid: PlayerId,
  ): void {
    const discarded = events.filter(
      (e): e is Extract<GameEvent, { type: "cardDiscardedFromDeck" }> =>
        e.type === "cardDiscardedFromDeck" && e.by === identity,
    );
    const taken = this.lastTaken;
    expect(taken, `${here}: Energy Absorption resolved with no damage taken`).toBeGreaterThanOrEqual(1);
    const deckBefore = before.players[0]!.deck.length;
    // "That many cards": the damage he took (RRG p. 33: a deck of fewer resets at the card that empties it).
    if (deckBefore >= taken)
      expect(discarded, `${here}: cards discarded for ${taken} damage taken`).toHaveLength(taken);
    else expect(discarded.length, `${here}: short deck`).toBeGreaterThanOrEqual(deckBefore);
    const toHand = events.filter(
      (e) =>
        e.type === "cardMoved" &&
        (e.from.kind === "discard" || e.from.kind === "deck") &&
        e.to.kind === "hand" &&
        (e.to as { playerId?: PlayerId }).playerId === pid,
    );
    const resourceCards = discarded.filter((e) => typeOf(after, e.instanceId) === "resource");
    // Exactly the resource cards among those discarded go to hand; the rest stay in the discard pile.
    expect(
      toHand.map((e) => (e.type === "cardMoved" ? e.instanceId : null)).sort(),
      `${here}: resource cards among the discarded go to hand`,
    ).toEqual(resourceCards.map((e) => e.instanceId).sort());
    // (RRG p. 33, "Deck Reset": when the discarding empties the deck the discard pile, the last card included, is
    // shuffled into a new deck, so a resource card that emptied it reaches his hand from the deck, not the discard
    // pile; no further cards are discarded from the new deck.)
    expect(
      events.filter((e) => e.type === "momentRaised" && e.name === ENERGY_ABSORPTION_MOMENT),
      `${here}: the moment is raised once`,
    ).toHaveLength(1);
    seen.absorption.push(`${here} taken=${taken} resources=${resourceCards.length}`);
    seen.absorptionMoment.push(here);
    if (resourceCards.length > 0) seen.absorptionResourceToHand.push(here);
    if (discarded.length > resourceCards.length) seen.absorptionNonResourceStays.push(here);
  }
}

function nextCommand(
  session: GameSession,
  turn: { key: string; n: number },
  script: ((s: GameState) => Command)[],
): Command {
  const s = session.state;
  if (!s.pendingChoice && !s.outcome && script.length > 0) return script.shift()!(s);
  if (!s.pendingChoice && s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  const [command] = playToOutcome(s, WAVE8_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

interface PlayOptions {
  readonly stopAtRound?: number;
  readonly maxCommands?: number;
  /** Commands issued first, one per step at which nothing is pending, before the driver takes over. */
  readonly script?: readonly ((s: GameState) => Command)[];
}

/** Plays `initial` to an outcome (or `stopAtRound`), checking every invariant after every command. */
function play(initial: GameState, observer: Observer, options: PlayOptions = {}): GameResult {
  const dealtTo = new Map<string, PlayerId>();
  for (const p of initial.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const)
      for (const id of p[zone]) if (initial.instances[id]!.ownerId === p.playerId) dealtTo.set(id, p.playerId);
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
    const result = sessionApply(session, command, WAVE8_DEPS);
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
  const replayed = replay(result.session.log, WAVE8_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

const start = (config: ReturnType<typeof wave8Scenario>): GameState => {
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
};

/** Unus the Untouched, standard, Bishop alone (the opening hand kept). */
const unus = (seed: number): GameState => start(wave8Scenario("unus", { players: [BISHOP], seed }));

/** Core's Rhino, standard, no modular set, with Bishop's precon seated (`coreScenario` takes a Core starter deck). */
const rhino = (seed: number): GameState =>
  start({
    ...coreScenario("rhino", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed,
      modularSetIds: [],
      cardPool: WAVE8_CARDS,
    }),
    players: [wave8StarterDeckSetup("bishop-leadership")],
  });

const endOfTurnCommand = (): Command => endTurn(P1);
const completedRounds = (r: GameResult) => r.session.state.round - 1;

describe("the printed deck", () => {
  const deck = AOA_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
  it("is 40 cards and legal against the wave 8 pool (MC45 p. 22; RRG 1.8 Appendix I)", () => {
    expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    expect(
      validateDeck({ identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards }, WAVE8_CARDS),
    ).toEqual({
      ok: true,
    });
  });
  it("seats as 40 cards in the opening zones with the nemesis set aside and the obligation out of the deck", () => {
    const s = unus(1);
    const p = playerOf(s, P1);
    // Opening hand 6 (alter-ego hand size) plus the deck is the printed 40 cards (identity, obligation and nemesis set
    // excluded: RRG Appendix II step 5).
    expect(p.hand.length + p.deck.length + p.discard.length + p.playArea.length).toBe(40);
    expect(p.hand).toHaveLength(6);
    expect(p.setAside.map((id) => codeOf(s, id)).sort()).toEqual(["45026", "45027", "45028", "45029", "45029"]);
  });
});

describe("Bishop precon, Unus the Untouched, standard, one player", () => {
  it.each([1, 2, 3, 4, 5, 6])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const observer = new Observer(`unus#${seed}`);
    const result = play(unus(seed), observer);
    expect(result.session.state.outcome).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Bishop precon, Rhino, standard, one player", () => {
  it.each([1, 2, 3, 4])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const observer = new Observer(`rhino#${seed}`);
    const result = play(rhino(seed), observer);
    expect(result.session.state.outcome).not.toBeNull();
    expect(completedRounds(result)).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Staged: Energy Absorption's edges and the alter-ego form (Rhino, seed 1)", () => {
  const endOfTurn = (): Command => endTurn(P1);

  // Enemies scheme against an alter-ego identity (RRG 1.8 Appendix II "Enemy Activations") and an alter-ego identity is
  // no defender (RRG 1.8 "Defend", p. 14), so he never gets a defender prompt (`checkState`); Energy Absorption is
  // printed on the hero face and is never offered.
  it("alter-ego Bishop is schemed against, never attacked, and is offered no Energy Absorption", () => {
    const s = rhino(1);
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const observer = new Observer("staged-alter-ego");
    const result = play(s, observer, { stopAtRound: 2, script: [endOfTurn] });
    expect(seen.alterEgoSchemedAgainst.some((x) => x.startsWith("staged-alter-ego"))).toBe(true);
    expect(inst(result.session.state, identityOf(result.session.state)).damage).toBe(0);
    expect(observer.offers).toBe(0);
    expectReplays(result);
  });

  // The ability reads the damage taken after prevention and a tough status card (identity.ts): a fully stopped attack
  // takes nothing and offers nothing. RRG 1.8 "Tough" (p. 44): all of the damage is prevented and the status card is
  // discarded instead. Rhino's first attack is stopped; a later attack in the same villain phase (Gamma Slam) is not,
  // and only that one offers Energy Absorption.
  it("an attack stopped by a tough status card offers nothing; the next attack that deals damage does", () => {
    let s = withForm(rhino(1), { heroForm: 0 }, P1);
    const id = identityOf(s);
    s = patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 1 } });
    const observer = new Observer("staged-tough");
    const result = play(s, observer, { stopAtRound: 2, script: [endOfTurn] });
    expect(inst(result.session.state, id).statuses.tough).toBe(0);
    expect(observer.toughPrevented).toBe(1);
    expect(observer.damaged).toBeGreaterThanOrEqual(1);
    expect(observer.offers).toBe(observer.damaged);
    expectReplays(result);
  });

  // Temporally Displaced (45001b): "nothing happens with none there" (identity.ts); the first-turn discard pile is empty.
  it("changing to alter-ego with no TEMPORAL card in the discard pile returns nothing", () => {
    const s = withForm(rhino(1), { heroForm: 0 }, P1);
    expect(playerOf(s, P1).discard).toHaveLength(0);
    const handBefore = playerOf(s, P1).hand.length;
    const { state } = applyOk(s, toHero(P1), WAVE8_DEPS);
    const done = settle(state, firstLegal, undefined, WAVE8_DEPS);
    expect(playerOf(done, P1).identity.form).toBe("alterEgo");
    expect(playerOf(done, P1).hand).toHaveLength(handBefore);
    seen.displacedEmpty.push("staged-displaced-empty");
  });
});

describe("Staged: Super-Charged charged by three resource cards, then a basic attack (Rhino, seed 1)", () => {
  // Card text (45006): Action, discard a resource card from hand: 1 charge counter per resource icon on it. Hero
  // Interrupt on a basic attack: discard it for +2 ATK per counter, to a maximum of +8. Stored Energy, Energy and Genius
  // print 2 icons each (6 counters, so the cap of +8 binds).
  it("six charge counters give +8 ATK, not +12", () => {
    let s = withForm(rhino(1), { heroForm: 0 }, P1);
    s = moveToHand(s, P1, "45006", "45010", "45022", "45023").state;
    const upgrade = (state: GameState): InstanceId =>
      Object.values(state.instances).find((i) => i.cardId === "45006" && i.attachedTo !== null)!.instanceId;
    const handCard = (state: GameState, code: string): InstanceId =>
      playerOf(state, P1).hand.find((id) => codeOf(state, id) === code)!;
    const charge =
      (code: string) =>
      (state: GameState): Command => {
        const up = upgrade(state);
        return use(P1, up, "45006.super-charged-action", [], { discard: [handCard(state, code)] });
      };
    const observer = new Observer("staged-super-charged");
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [
        (state) => playCard(P1, handCard(state, "45006"), [], { attachToInstanceId: identityOf(state) }),
        charge("45010"),
        charge("45022"),
        charge("45023"),
        (state) => ({
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identityOf(state),
          targetInstanceId: state.villains[0]!.instanceId,
        }),
      ],
    });
    expect(seen.superCharged.some((x) => x === "staged-super-charged round 1 resolveChoice counters=6")).toBe(true);
    expectReplays(result);
  });
});

describe("Staged: a confused Bishop's Command Authority is canceled (RRG 1.8 'Labeled Ability', p. 26)", () => {
  it("removes the confused status, thwarts nothing and draws nothing", () => {
    let s = withForm(rhino(1), { heroForm: 0 }, P1);
    s = moveToHand(s, P1, "45008", "45010", "45022").state;
    const id = identityOf(s);
    s = patchInstance(s, id, { statuses: { ...inst(s, id).statuses, confused: 1 } });
    const result = play(s, new Observer("staged-confused"), {
      stopAtRound: 2,
      script: [
        (state) => {
          const card = playerOf(state, P1).hand.find((h) => codeOf(state, h) === "45008")!;
          const pay = playerOf(state, P1).hand.filter((h) => ["45010", "45022"].includes(codeOf(state, h)));
          return playCard(P1, card, pay);
        },
        endOfTurnCommand,
      ],
    });
    expect(inst(result.session.state, id).statuses.confused).toBe(0);
    expect(seen.confusedCanceled.some((x) => x.startsWith("staged-confused"))).toBe(true);
    expectReplays(result);
  });
});

describe("Staged: the nemesis cards and the obligation reveal and resolve under every invariant", () => {
  it.each(["45026", "45028", "45029"])("nemesis card %s is revealed in a Rhino game", (code) => {
    const s = stackSetAsideBehindBoost(rhino(1), code);
    const observer = new Observer(`staged-${code}`);
    const result = play(s, observer, { stopAtRound: 3 });
    expect(seen.nemesis.some((x) => x.startsWith(`staged-${code}`) && x.endsWith(code))).toBe(true);
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
