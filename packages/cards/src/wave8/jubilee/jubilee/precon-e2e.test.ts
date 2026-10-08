import { JUBILEE_STARTER_DECKS, WAVE8_CARDS as CONTENT_CARDS } from "@mc/content";
import {
  cardsInPlay,
  characterProfile,
  iconsInPlay,
  createGame,
  handSize,
  replay,
  sessionApply,
  startSession,
  traitsOf,
  type Command,
  type GameEvent,
  type GameSession,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
  type ResourcePool,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario, encounterCardsOf, modularSetupCardIds } from "../../../core/setup.js";
import { playToOutcome } from "../../../testing/driver.js";
import {
  P1,
  P2,
  firstLegal,
  moveToHand,
  play as playCmd,
  playerOf,
  resourceAbility,
  settle,
  use,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS, WAVE8_DEPS, wave8Scenario, wave8StarterDeckSetup } from "../../index.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * Whole games with Jubilee's precon (`jubilee-justice`, cards 47002-47022, 40 cards) through the real engine and the
 * real wave 8 scripts, played by the card-name-agnostic greedy driver (`../../../testing/driver.ts`) one command at a
 * time, so every state is checked against the invariants below and an observer reads the events for her signature
 * mechanics (the `seen` tally; the last test asserts each was seen).
 *
 * Scenarios: Core's Rhino with Arcade (her pack's modular set) added to the deck, the way a hero pack's own modular set
 * is played at a Core scenario. `coreScenario` only accepts the playable pool's modular sets (the wave is not joined to
 * the playable pool), so Arcade's cards are appended to the built `encounterDeck` with the two helpers the builder uses
 * (`encounterCardsOf`, `modularSetupCardIds`). Second, games through `wave8Scenario("unus")` (the new builder), which
 * does not include Arcade, so those check the builder, her obligation and the nemesis set. Two-player rounds pair her
 * with Spider-Man's Core deck (Cell Phone lets another player's hero make a basic attack or thwart).
 *
 * Invariants checked after every command:
 * - no engine error on a command the driver chose from legal candidates (`sessionApply` reports it);
 * - no prompt without an answer (RRG 1.8 "Choices"): `minSelections` fits the options offered;
 * - the game never rests between steps with nothing pending outside a player turn (RRG Appendix II, pp. 51-52);
 * - no card instance sits in two zones; every card a deck started with is still somewhere;
 * - a `declareWildTypes` choice (owner ruling Q33 = B, docs/phase7-wave8.md section 4.1) is only ever asked of the
 *   player who paid, is answered with a legal declaration, and is followed by an unskipped `wildTypesDeclared`;
 * - the session log replays to the identical final state (the engine's determinism contract).
 *
 * Mechanics read from events: the resource-type events (Firecracker 47007: 4 attack damage, a stun only when 2 or more
 * types paid; Flash of Light 47008: 3 threat, a confuse only when 2 or more types paid; Blinding Flash 47006: at most one
 * stun and one confuse per type paid, not an attack; Grand Finale 47009: one attack, owner rulings Q46 to Q50; Three
 * Steps Ahead 47015: at most 2 threat per type paid; Multitalented 47021, Husk 47012), Jubilee's Coat and Sunglasses
 * responses (47004, 47005), Wolverine (47002), Shopping Spree (47003), Disguise, Waylay, Unlikely Duo, Synch, Cell
 * Phone (47019: `chooseBasicPower` and its target are asked of the player Cell Phone chose, Q40), "Like, totally!"
 * (47001a), Mall Rat (47001b), the declare-wilds prompt asked and skipped, Grounded (47023: a forced change to alter-ego
 * form, a paid change to hero form, removed when she plays one of her identity's events), Nanny (47024: the "Lost"
 * Child search only when the attacked player controls an ally), the hazard extra deal (RRG 1.8 "Hazard Icon", p. 21)
 * and ready-and-draw at the end of the player phase (RRG 1.8 "Player Phase").
 *
 * Generation X (47016): an X-MEN character's basic thwart against it removes at least its THW + 1. Mutant Mayhem
 * 47028 is not in this deck. Chamber 47011 is registered and proven in `../aspect-basic.test.ts`; these games assert
 * nothing card-specific about him.
 */

const DECK_ID = "jubilee-justice";
const JUBILEE = { starterDeckId: DECK_ID } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const GROUNDED = "47023";
const LOST_CHILD = "47027";
const NEMESIS_CARDS = ["47024", "47025", "47026", "47027"];
const ARCADE_CARDS = ["47030", "47031", "47032", "47033", "47034"];

/** The printed decklist, transcribed in docs/phase7-wave8-handoff.md ("Jubilee Hero Pack"): card number -> [title, copies]. */
const PRINTED_DECK: Record<string, readonly [string, number]> = {
  "47002": ["Wolverine", 1],
  "47003": ["Shopping Spree", 1],
  "47004": ["Jubilee's Coat", 1],
  "47005": ["Jubilee's Sunglasses", 1],
  "47006": ["Blinding Flash", 1],
  "47007": ["Firecracker", 3],
  "47008": ["Flash of Light", 3],
  "47009": ["Grand Finale", 1],
  "47010": ["Plasmoid Energy", 3],
  "47011": ["Chamber", 1],
  "47012": ["Husk", 1],
  "47013": ["Disguise", 3],
  "47014": ["Waylay", 3],
  "47015": ["Three Steps Ahead", 3],
  "47016": ["Generation X", 1],
  "47017": ["The Power of Justice", 2],
  "47018": ["Synch", 1],
  "47019": ["Cell Phone", 3],
  "47020": ["X-Gene", 3],
  "47021": ["Multitalented", 3],
  "47022": ["Unlikely Duo", 1],
};

const seen = {
  wildsAsked: [] as string[],
  generationXThwart: [] as string[],
  wildsSkipped: [] as string[],
  blindingFlash: [] as string[],
  firecracker: [] as string[],
  firecrackerStun: [] as string[],
  flashOfLight: [] as string[],
  flashOfLightConfuse: [] as string[],
  grandFinale: [] as string[],
  threeStepsAhead: [] as string[],
  multitalented: [] as string[],
  husk: [] as string[],
  coatResponse: [] as string[],
  sunglassesResponse: [] as string[],
  wolverine: [] as string[],
  shoppingSpree: [] as string[],
  disguise: [] as string[],
  waylay: [] as string[],
  unlikelyDuo: [] as string[],
  synch: [] as string[],
  cellPhone: [] as string[],
  cellPhoneOtherPlayer: [] as string[],
  chooseBasicPowerTarget: [] as string[],
  likeTotally: [] as string[],
  mallRat: [] as string[],
  groundedRevealed: [] as string[],
  groundedForcedAlterEgo: [] as string[],
  groundedPaidChange: [] as string[],
  groundedRemoved: [] as string[],
  nannyResponse: [] as string[],
  lostChildRevealed: [] as string[],
  hazardExtraDeal: [] as string[],
  hazardAuditSkipped: [] as string[],
  endOfPlayerPhaseReadyAndDraw: [] as string[],
  arcade: [] as string[],
  nemesisCard: [] as string[],
  unusGame: [] as string[],
};

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const GENERATION_X = "47016";
const cardType = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.type;
const cardName = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;

/** Different types in a paid pool (a wild left wild counts as its own type, docs/phase7-wave8.md section 3.70). */
const typesIn = (pool: ResourcePool): number =>
  (["energy", "mental", "physical", "wild"] as const).filter((t) => (pool[t] ?? 0) > 0).length;

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
  for (const [id, owner] of dealtTo)
    if (!zones.has(id) && s.instances[id]!.attachedTo === null)
      fail(`${owner}'s ${cardName(s, id as InstanceId)} (${id}) is in no zone`);
}

/** The driver's choice, except that a prompt it cannot answer is reported. */
function nextCommand(session: GameSession, turn: { key: string; n: number }): Command {
  const s = session.state;
  if (!s.pendingChoice && s.step.phase === "player" && s.step.kind === "turn") {
    const key = `${s.round}:${s.step.activePlayerId}`;
    if (turn.key !== key) Object.assign(turn, { key, n: 0 });
    if (++turn.n > 40) return { type: "endTurn", playerId: s.step.activePlayerId };
  }
  const [command] = playToOutcome(s, WAVE8_DEPS, { maxCommands: 1 }).session.log.commands;
  if (!command) throw new Error("the driver issued no command");
  return command;
}

const trigger = (e: GameEvent): Record<string, unknown> | null =>
  e.type === "triggerEvent" ? ({ ...(e.event as unknown as Record<string, unknown>), phase: e.phase } as never) : null;

/**
 * The events of the abilities this file reads: an ability's `abilityResolved` opens its effects, which can run on past
 * prompts into later commands (an attack's target, a card to return). The observer therefore collects every event since
 * the last time nothing was pending (a "window") and reads each ability's events from its `abilityResolved` up to the
 * next ability of another card (a Response to it, such as Waylay's attack) or of the same ability, or the next step change.
 */
function segmentFrom(events: readonly GameEvent[], from: number): GameEvent[] {
  const opener = events[from] as Extract<GameEvent, { type: "abilityResolved" }>;
  let cut = events.length;
  for (let i = from + 1; i < events.length; i++) {
    const e = events[i]!;
    if (
      (e.type === "abilityResolved" && (e.abilityId === opener.abilityId || e.instanceId !== opener.instanceId)) ||
      e.type === "stepChanged" ||
      e.type === "turnStarted" ||
      e.type === "turnEnded"
    ) {
      cut = i;
      break;
    }
  }
  return events.slice(from, cut);
}

/** A window's events in a line, for failure messages. */
const kinds = (seg: readonly GameEvent[]): string =>
  seg
    .map((e) =>
      e.type === "triggerEvent"
        ? `${e.phase}:${(e.event as { kind: string }).kind}`
        : e.type === "abilityResolved"
          ? `ABILITY(${e.abilityId})`
          : e.type,
    )
    .join(" ");

const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** What paid for the card `instanceId` when it was played: the settled `paidAs`, or the player's declaration. */
function paidPool(events: readonly GameEvent[], instanceId: InstanceId): ResourcePool | null {
  const played = ofType(events, "cardPlayed").find((e) => e.instanceId === instanceId);
  if (played?.paidAs) return played.paidAs;
  const declared = ofType(events, "wildTypesDeclared").find((e) => e.instanceId === instanceId && !e.abilityId);
  return declared?.paidAs ?? null;
}

class Observer {
  constructor(readonly label: string) {}

  private window: GameEvent[] = [];
  private windowBefore: GameState | null = null;
  private windowCommand: Command | null = null;

  observe(commandBefore: GameState, after: GameState, commandEvents: readonly GameEvent[], command: Command): void {
    if (this.windowBefore === null) {
      this.windowBefore = commandBefore;
      this.windowCommand = command;
    }
    this.window.push(...commandEvents);
    this.perCommand(commandBefore, after, commandEvents, command);
    if (!after.pendingChoice || after.outcome) {
      this.perWindow(this.windowBefore, after, this.window, this.windowCommand!);
      this.window = [];
      this.windowBefore = null;
      this.windowCommand = null;
    }
  }

  /** Abilities, read over a whole window (see `segmentFrom`). */
  private perWindow(before: GameState, after: GameState, events: readonly GameEvent[], first: Command): void {
    const here = `${this.label} round ${before.round} ${first.type}`;
    const each = (
      match: (id: string) => boolean,
      check: (seg: GameEvent[], opener: Extract<GameEvent, { type: "abilityResolved" }>) => void,
    ) =>
      events.forEach((e, i) => {
        if (e.type === "abilityResolved" && match(String(e.abilityId))) check(segmentFrom(events, i), e);
      });
    const is =
      (...refs: string[]) =>
      (id: string) =>
        refs.includes(id);
    const attacksIn = (seg: readonly GameEvent[]) =>
      seg.map(trigger).filter((t) => t?.kind === "attack" && t.phase === "initiated");
    const thwartsIn = (seg: readonly GameEvent[]) =>
      seg.map(trigger).filter((t) => t?.kind === "thwart" && t.phase === "initiated");
    const given = (seg: readonly GameEvent[], status: "stunned" | "confused") =>
      ofType(seg, "statusGiven").filter((e) => e.status === status).length;
    const removed = (seg: readonly GameEvent[]) => ofType(seg, "threatRemoved").reduce((n, e) => n + e.amount, 0);

    // Blinding Flash (47006): X enemies chosen, X the types that paid; each stunned then confused; not an attack.
    each(is("47006.blinding-flash-action"), (seg, opener) => {
      const types = typesIn(paidPool(events, opener.instanceId) ?? ({} as ResourcePool));
      expect(attacksIn(seg), `${here}: Blinding Flash is not an attack`).toHaveLength(0);
      expect(given(seg, "stunned"), `${here}: at most one stun per type paid`).toBeLessThanOrEqual(types);
      expect(given(seg, "confused"), `${here}: at most one confuse per type paid`).toBeLessThanOrEqual(types);
      seen.blindingFlash.push(here);
    });

    // Firecracker (47007a/b/c): one attack of 4; the stun only when 2 or more different types paid.
    each(is("47007a.firecracker-action", "47007b.firecracker-action", "47007c.firecracker-action"), (seg, opener) => {
      const attacks = attacksIn(seg);
      const types = typesIn(paidPool(events, opener.instanceId) ?? ({} as ResourcePool));
      expect(attacks.length, `${here}: Firecracker is one attack`).toBe(1);
      expect(attacks[0]!.amount, `${here}: 4 damage`).toBe(4);
      if (given(seg, "stunned") > 0) {
        expect(types, `${here}: the stun needs 2 different types`).toBeGreaterThanOrEqual(2);
        seen.firecrackerStun.push(here);
      }
      seen.firecracker.push(here);
    });

    // Flash of Light (47008a/b/c): a thwart of 3; the confuse only when 2 or more different types paid.
    each(
      is("47008a.flash-of-light-action", "47008b.flash-of-light-action", "47008c.flash-of-light-action"),
      (seg, opener) => {
        const thwarts = thwartsIn(seg);
        const types = typesIn(paidPool(events, opener.instanceId) ?? ({} as ResourcePool));
        expect(thwarts.length, `${here}: Flash of Light is at most one thwart: ${kinds(seg)}`).toBeLessThanOrEqual(1);
        for (const t of thwarts) expect(t!.amount, `${here}: 3 threat`).toBe(3);
        expect(attacksIn(seg), `${here}: Flash of Light is not an attack: ${kinds(seg)}`).toHaveLength(0);
        if (given(seg, "confused") > 0) {
          expect(types, `${here}: the confuse needs 2 different types`).toBeGreaterThanOrEqual(2);
          seen.flashOfLightConfuse.push(here);
        }
        seen.flashOfLight.push(here);
      },
    );

    // Grand Finale (47009): one attack, however many instances of damage (owner rulings Q46 to Q50).
    each(is("47009.grand-finale-action"), (seg) => {
      expect(attacksIn(seg).length, `${here}: Grand Finale is one attack: ${kinds(seg)}`).toBe(1);
      seen.grandFinale.push(here);
    });

    // Three Steps Ahead (47015): 2 threat per different type paid, at most four instances.
    each(is("47015.three-steps-ahead-action"), (seg, opener) => {
      const types = typesIn(paidPool(events, opener.instanceId) ?? ({} as ResourcePool));
      expect(removed(seg), `${here}: at most 2 threat per type paid`).toBeLessThanOrEqual(2 * Math.min(types, 4));
      seen.threeStepsAhead.push(here);
    });

    // Multitalented (47021): [physical] 2 damage, [mental] 2 threat, [energy] heal 2, each only if that type paid.
    each(is("47021.multitalented-constant"), (seg, opener) => {
      const pool = paidPool(events, opener.instanceId) ?? ({} as ResourcePool);
      if (!(pool.physical > 0))
        expect(ofType(seg, "damageDealt"), `${here}: no physical paid: ${kinds(seg)}`).toHaveLength(0);
      if (!(pool.mental > 0)) expect(removed(seg), `${here}: no mental paid`).toBe(0);
      if (!(pool.energy > 0)) expect(ofType(seg, "damageHealed"), `${here}: no energy paid`).toHaveLength(0);
      seen.multitalented.push(here);
    });

    each(is("47012.husk-interrupt"), () => seen.husk.push(here));

    // Jubilee's Coat / Sunglasses Responses: the threat removed / the attack made equals the types that paid.
    each(is("47004.jubilees-coat-response"), (seg) => {
      expect(thwartsIn(seg).length, `${here}: one thwart`).toBeLessThanOrEqual(1);
      seen.coatResponse.push(here);
    });
    each(is("47005.jubilees-sunglasses-response"), (seg) => {
      const attacks = attacksIn(seg);
      expect(attacks.length, `${here}: one attack`).toBeLessThanOrEqual(1);
      for (const a of attacks) expect(a!.amount as number, `${here}: at least 1 damage`).toBeGreaterThanOrEqual(1);
      seen.sunglassesResponse.push(here);
    });

    // Wolverine: his attacks gain piercing (a keyword on the attack), his Response heals 3 after she changes form.
    each(is("47002.wolverine-response"), (seg, opener) => {
      expect(ofType(seg, "damageHealed").every((e) => e.targetInstanceId === opener.instanceId)).toBe(true);
      seen.wolverine.push(here);
    });

    each(is("47003.shopping-spree-action"), () => seen.shoppingSpree.push(here));
    each(is("47013.disguise-action"), (seg) => {
      expect(thwartsIn(seg).length).toBeLessThanOrEqual(1);
      seen.disguise.push(here);
    });
    each(is("47014.waylay-response"), () => seen.waylay.push(here));
    each(is("47022.unlikely-duo-action"), (seg) => {
      expect(attacksIn(seg).length, `${here}: Unlikely Duo is one attack`).toBeLessThanOrEqual(1);
      seen.unlikelyDuo.push(here);
    });
    each(is("47018.synch-interrupt"), () => seen.synch.push(here));
    each(is("47001b.mall-rat"), () => seen.mallRat.push(here));

    // Cell Phone (47019): the chosen player makes a basic attack or thwart.
    each(is("47019.cell-phone-action"), (seg, opener) => {
      const powers = ofType(seg, "basicPowerInstructed");
      expect(powers.length, `${here}: at most one basic power`).toBeLessThanOrEqual(1);
      for (const p of powers) if (p.playerId !== opener.controllerId) seen.cellPhoneOtherPlayer.push(here);
      seen.cellPhone.push(here);
    });

    // Grounded (47023): revealed in hero form, a forced change to alter-ego form; the Response removes it from the game.
    each(is("47023.when-revealed"), (seg) => {
      seen.groundedRevealed.push(here);
      const changes = ofType(seg, "formChanged");
      if (changes.length > 0) {
        expect(changes[0]!.to, `${here}: forced to alter-ego`).toBe("alterEgo");
        expect(changes[0]!.byEffect).toBe(true);
        seen.groundedForcedAlterEgo.push(here);
      }
    });
    each(is("47023.grounded-response"), (seg) => {
      expect(
        ofType(seg, "cardMoved").some((e) => (e.cardId as string) === GROUNDED && e.to.kind === "removedFromGame"),
        `${here}: Grounded leaves the game`,
      ).toBe(true);
      seen.groundedRemoved.push(here);
    });

    // Nanny (47024): the "Lost" Child search only when the attacked player controls an ally.
    each(is("47024.nanny-forced-response"), (seg) => {
      const lost = ofType(seg, "encounterCardRevealed").filter((e) => (e.cardId as string) === LOST_CHILD);
      if (lost.length > 0)
        expect(
          before.players.some((p) => p.playArea.some((id) => cardType(before, id) === "ally")),
          `${here}: a "Lost" Child is only found when the attacked player controls an ally`,
        ).toBe(true);
      seen.nannyResponse.push(here);
    });
  }

  /** Step-bound checks, read per command. */
  private perCommand(before: GameState, after: GameState, events: readonly GameEvent[], command: Command): void {
    const here = `${this.label} round ${before.round} ${command.type}`;

    // Resource-type prompts (Q33 = B): asked of the payer, answered legally, followed by an unskipped declaration.
    const choice = after.pendingChoice;
    if (choice?.prompt.kind === "declareWildTypes") seen.wildsAsked.push(here);
    if (choice?.prompt.kind === "chooseBasicPowerTarget") seen.chooseBasicPowerTarget.push(here);
    if (before.pendingChoice?.prompt.kind === "declareWildTypes") {
      const declared = ofType(events, "wildTypesDeclared");
      expect(declared.length, `${here}: the declaration is logged`).toBeGreaterThanOrEqual(1);
      expect(declared[0]!.skipped, `${here}: a declared prompt is not a skipped one`).toBe(false);
      expect(declared[0]!.playerId, `${here}: asked of the payer`).toBe(before.pendingChoice.playerId);
    }
    for (const e of ofType(events, "wildTypesDeclared")) if (e.skipped) seen.wildsSkipped.push(here);

    // Generation X (47016): an X-MEN character's basic thwart against it removes at least its THW + 1 (or all of it).
    if (
      command.type === "basicThwart" &&
      !command.divide &&
      !command.useAtk &&
      codeOf(before, command.schemeInstanceId) === GENERATION_X &&
      traitsOf(before, command.thwarterInstanceId, WAVE8_DEPS).map(String).includes("X-MEN") &&
      before.instances[command.thwarterInstanceId]!.statuses.confused === 0
    ) {
      const had = before.instances[command.schemeInstanceId]!.threat;
      const left = cardsInPlay(after).includes(command.schemeInstanceId)
        ? after.instances[command.schemeInstanceId]!.threat
        : 0;
      const thw = characterProfile(before, command.thwarterInstanceId, WAVE8_DEPS)!.thw;
      expect(had - left, `${here}: Generation X gives the thwarting X-MEN character +1 THW`).toBeGreaterThanOrEqual(
        Math.min(had, thw + 1),
      );
      seen.generationXThwart.push(here);
    }

    // "Like, totally!" (47001a): her hero resource ability, one [wild], exhausting her, used to pay for a card.
    if (
      command.type === "playCard" &&
      command.payment.some((p) => "ability" in p && String(p.ability.abilityId) === "47001a.like-totally")
    ) {
      expect(
        ofType(events, "cardExhausted").some(
          (e) => e.instanceId === playerOf(before, command.playerId).identity.instanceId,
        ),
        `${here}: Like, totally! exhausts her`,
      ).toBe(true);
      seen.likeTotally.push(here);
    }

    // A paid change to hero form under Grounded (47023, section 3.63): the cost is two resources of the same type.
    if (command.type === "changeForm" && (command.payment?.length ?? 0) > 0) {
      const formChanged = ofType(events, "formChanged");
      expect(formChanged.length, `${here}: a paid change changes form`).toBe(1);
      expect(
        playerOf(before, command.playerId).playArea.some((id) => codeOf(before, id) === GROUNDED),
        `${here}: a payment is only taken with Grounded in play`,
      ).toBe(true);
      seen.groundedPaidChange.push(here);
    }

    // Villain phase step 3: one card to each player, plus one to the first player per hazard icon in play (RRG p. 21, 47).
    const dealStep = events.findIndex(
      (e) => e.type === "stepChanged" && e.to.phase === "villain" && e.to.kind === "dealEncounterCards",
    );
    if (dealStep >= 0) {
      const end = events.findIndex(
        (e, i) => i > dealStep && e.type === "stepChanged" && e.to.kind === "revealEncounterCards",
      );
      const slice = events.slice(dealStep, end < 0 ? events.length : end);
      const dealtTo = (p: PlayerId) =>
        slice.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === p).length;
      // Icons in play at that moment: this command's start. A scheme or enemy that enters play earlier in the same command
      // would make that stale, so those commands are not audited (their count is `hazardAuditSkipped`).
      const preDeal = events.slice(0, dealStep);
      const stale = preDeal.some(
        (e) =>
          e.type === "encounterCardRevealed" ||
          e.type === "cardDiscardedFromPlay" ||
          (e.type === "cardMoved" &&
            (e.to.kind === "villainArea" || e.to.kind === "playArea" || e.to.kind === "attachment")),
      );
      const hazards = iconsInPlay(before, WAVE8_DEPS, "hazard");
      const dealt = slice.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter").length;
      // RRG 1.8 "Hazard Icon" (p. 21): one card each, then one additional card per hazard icon, "in player order (first
      // additional card to the first player, the second to the second player, etc.)", not one card per player.
      const order = before.players.filter((pl) => !pl.eliminated);
      const start = Math.max(
        0,
        order.findIndex((pl) => pl.playerId === before.firstPlayerId),
      );
      const expected = new Map(order.map((pl) => [pl.playerId, 1]));
      for (let i = 0; i < hazards; i++) {
        const pl = order[(start + i) % order.length]!;
        expected.set(pl.playerId, expected.get(pl.playerId)! + 1);
      }
      if (stale) seen.hazardAuditSkipped.push(here);
      else if (dealt > 0) {
        for (const pl of order)
          expect(dealtTo(pl.playerId), `${here}: cards dealt to ${pl.playerId} with ${hazards} hazard icons`).toBe(
            expected.get(pl.playerId),
          );
      }
      if (hazards > 0) seen.hazardExtraDeal.push(`${here} hazards=${hazards}`);
    }

    // End of the player phase, after every player has taken a turn: each player draws up to hand size and readies each
    // exhausted card (RRG 1.8 "Player Phase", Appendix II step 1 "Player Phase"; the hand check is "Hand Size", p. 21).
    const leftPlayerPhase = events.some(
      (e) => e.type === "stepChanged" && e.from.phase === "player" && e.to.phase === "villain",
    );
    if (leftPlayerPhase && !after.outcome) {
      for (const p of before.players.filter((pl) => !pl.eliminated)) {
        const size = handSize(before, p.playerId, WAVE8_DEPS);
        const drawn = events.filter((e) => e.type === "cardDrawn" && e.playerId === p.playerId).length;
        const wantedDraw = Math.max(0, size - p.hand.length);
        if (p.deck.length + p.discard.length >= wantedDraw)
          expect(
            drawn,
            `${here}: ${p.playerId} draws from ${p.hand.length} to hand size ${size}`,
          ).toBeGreaterThanOrEqual(wantedDraw);
        if (before.instances[p.identity.instanceId]!.exhausted)
          expect(
            events.some((e) => e.type === "cardReadied" && e.instanceId === p.identity.instanceId),
            `${here}: ${p.playerId}'s exhausted identity readies`,
          ).toBe(true);
      }
      seen.endOfPlayerPhaseReadyAndDraw.push(here);
    }

    for (const e of events) {
      if (e.type === "encounterCardRevealed") {
        const code = String(e.cardId);
        if (ARCADE_CARDS.includes(code)) seen.arcade.push(`${here} ${code}`);
        if (NEMESIS_CARDS.includes(code)) seen.nemesisCard.push(`${here} ${code}`);
        if (code === LOST_CHILD) seen.lostChildRevealed.push(`${here} ${code}`);
      }
    }
  }
}

interface GameResult {
  readonly session: GameSession;
  readonly commands: number;
}

function play(
  initial: GameState,
  observer: Observer,
  options: {
    stopAtRound?: number;
    maxCommands?: number;
    script?: readonly ((s: GameState) => Command)[];
    /** An answer to a pending choice the driver would otherwise answer with its default (null: leave it to the driver). */
    answer?: (s: GameState) => readonly string[] | null;
  } = {},
): GameResult {
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
    if (commands >= maxCommands) throw new Error(`no outcome after ${maxCommands} commands`);
    const before = session.state;
    const choice = session.state.pendingChoice;
    const answered = choice ? options.answer?.(session.state) : null;
    const command: Command =
      choice && answered
        ? { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: answered }
        : !choice && script.length > 0
          ? script.shift()!(session.state)
          : nextCommand(session, turn);
    const result = sessionApply(session, command, WAVE8_DEPS);
    if (!result.ok)
      throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    commands++;
    observer.observe(before, session.state, result.events, command);
    checkState(session.state, dealtTo, `${observer.label} command ${commands} ${JSON.stringify(command)}`);
  }
  return { session, commands };
}

function expectReplays(result: GameResult): void {
  const replayed = replay(result.session.log, WAVE8_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

function started(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}

/** Rhino (Core, standard) with Arcade's cards appended to the encounter deck. `seats` default to Jubilee alone. */
function rhinoArcade(
  seed: number,
  seats: readonly { starterDeckId: string }[] = [JUBILEE],
  arcade = true,
): GameSetupConfig {
  const base = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  });
  return {
    ...base,
    players: seats.map((seat) => wave8StarterDeckSetup(seat.starterDeckId)),
    encounterDeck: [
      ...(base.encounterDeck ?? []),
      ...(arcade ? encounterCardsOf(["arcade"], WAVE8_CARDS) : []),
      ...(arcade ? modularSetupCardIds(["arcade"], WAVE8_CARDS) : []),
    ],
  };
}

describe("Jubilee's printed deck", () => {
  const deck = JUBILEE_STARTER_DECKS.find((d) => d.id === DECK_ID)!;
  it("matches the printed decklist card for card, title and quantity (a/b/c versions folded into one title)", () => {
    const actual: Record<string, [string, number]> = {};
    for (const c of deck.cards) {
      const code = (c.cardId as string).replace(/[abc]$/, "");
      const name = CONTENT_CARDS.find((card) => card.id === c.cardId)!.name;
      actual[code] = [name, (actual[code]?.[1] ?? 0) + c.quantity];
    }
    expect(actual).toEqual(PRINTED_DECK);
  });
  it("is 40 cards and legal at setup (requireLegalDecks)", () => {
    expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(40);
    const config = rhinoArcade(1);
    expect(config.requireLegalDecks).toBe(true);
    const created = createGame(config, WAVE8_DEPS);
    expect(created.ok ? "ok" : created.error.message).toBe("ok");
    if (created.ok) {
      const p = created.state.players[0]!;
      expect(p.hand.length + p.deck.length + p.discard.length).toBe(40);
    }
  });
  it("her hero hand size is 5", () => {
    const s = withForm(started(rhinoArcade(1)), { heroForm: 0 }, P1);
    expect(handSize(s, P1, WAVE8_DEPS)).toBe(5);
  });
});

describe("Jubilee precon vs Rhino with Arcade, one player", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i plays to an outcome with every invariant intact", (seed) => {
    const start = started(rhinoArcade(seed));
    const result = play(start, new Observer(`rhino+arcade#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    expect(result.session.state.round).toBeGreaterThanOrEqual(3);
    expectReplays(result);
  });
});

describe("Jubilee and Spider-Man, two players, Rhino with Arcade", () => {
  it.each([1, 2, 3, 4])("seed %i plays three full rounds with every invariant intact", (seed) => {
    const start = started(rhinoArcade(seed, [SPIDER_MAN, JUBILEE]));
    const result = play(start, new Observer(`rhino+arcade#${seed}+spidey`), { stopAtRound: 4 });
    expect(result.session.state.round).toBeGreaterThanOrEqual(2);
    expectReplays(result);
  });
});

describe("Games through the wave 8 builder: Unus (Age of Apocalypse)", () => {
  it.each([1, 2, 3, 4])("seed %i: Jubilee plays to an outcome under every invariant", (seed) => {
    const start = started(wave8Scenario("unus", { players: [JUBILEE], seed }));
    expect(start.players[0]!.hand.length).toBeGreaterThan(0);
    const result = play(start, new Observer(`unus#${seed}`));
    expect(result.session.state.outcome).not.toBeNull();
    seen.unusGame.push(`unus#${seed}`);
    expectReplays(result);
  });
  it.each([1, 2])("seed %i: Jubilee and Spider-Man play three rounds of Unus", (seed) => {
    const start = started(wave8Scenario("unus", { players: [SPIDER_MAN, JUBILEE], seed }));
    const result = play(start, new Observer(`unus#${seed}+spidey`), { stopAtRound: 4 });
    expectReplays(result);
  });
});

/** The hand replaced by exactly these cards (by code); the old hand goes to the bottom of the deck. */
function stageHand(state: GameState, codes: readonly string[], p: PlayerId = P1): GameState {
  const cleared: GameState = {
    ...state,
    players: state.players.map((pl) => (pl.playerId === p ? { ...pl, hand: [], deck: [...pl.deck, ...pl.hand] } : pl)),
  };
  return moveToHand(cleared, p, ...codes).state;
}
const inHand = (s: GameState, code: string, nth = 0, p: PlayerId = P1): InstanceId =>
  playerOf(s, p).hand.filter((id) => codeOf(s, id) === code)[nth]!;
const inPlay = (s: GameState, code: string): InstanceId => cardsInPlay(s).find((id) => codeOf(s, id) === code)!;
const identityOf = (s: GameState, p: PlayerId = P1): InstanceId => playerOf(s, p).identity.instanceId;

describe("Staged: the cards the greedy driver rarely reaches, played through the same observer", () => {
  it("Cell Phone's player choice, Wolverine, Husk's Interrupt and the Response to a change of form (two players)", () => {
    let s = started(rhinoArcade(1, [JUBILEE, SPIDER_MAN], false));
    // Both heroes in hero form: Cell Phone's player choice only lists a player who can make a basic power.
    s = withForm(withForm(s, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    s = stageHand(s, [
      "47019",
      "47002",
      "47012",
      "47022",
      "47010a",
      "47010b",
      "47010c",
      "47017",
      "47017",
      "47013",
      "47013",
      "47013",
    ]);
    const villain = s.villains[0]!.instanceId;
    const observer = new Observer("staged-cell-phone#1");
    const result = play(s, observer, {
      stopAtRound: 3,
      // Cell Phone: "Action: choose a player" — Jubilee chooses Spider-Man; the basic power prompts are his.
      answer: (st) => {
        const choice = st.pendingChoice!;
        if (choice.prompt.kind !== "choosePlayer") return null;
        return choice.options.some((o) => o.optionId === P2) ? [P2] : null;
      },
      script: [
        (st) => playCmd(P1, inHand(st, "47019"), [inHand(st, "47010a")]),
        (st) => use(P1, inPlay(st, "47019"), "47019.cell-phone-action"),
        (st) => playCmd(P1, inHand(st, "47002"), [inHand(st, "47010b"), inHand(st, "47010c")]),
        (st) => playCmd(P1, inHand(st, "47012"), [inHand(st, "47017", 0), inHand(st, "47017", 1)]),
        // Unlikely Duo (Team-Up Wolverine, so after he is in play): confuse an enemy, then one attack of 4.
        (st) => playCmd(P1, inHand(st, "47022"), [inHand(st, "47013", 0), inHand(st, "47013", 1)]),
        (st) => ({
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: inPlay(st, "47012"),
          targetInstanceId: villain,
        }),
        // Wolverine's Response: after she changes to alter-ego form, heal 3 from him.
        () => ({ type: "changeForm", playerId: P1 }),
      ],
    });
    expect(seen.cellPhoneOtherPlayer.some((x) => x.startsWith("staged-cell-phone"))).toBe(true);
    expect(seen.wolverine.some((x) => x.startsWith("staged-cell-phone"))).toBe(true);
    expect(seen.husk.some((x) => x.startsWith("staged-cell-phone"))).toBe(true);
    expect(seen.unlikelyDuo.some((x) => x.startsWith("staged-cell-phone"))).toBe(true);
    expectReplays(result);
  });

  it("a wild whose declaration cannot change the reading is skipped; Like, totally! pays (one player)", () => {
    let s = started(rhinoArcade(1, [JUBILEE], false));
    s = withForm(s, { heroForm: 0 }, P1);
    s = stageHand(s, ["47008a", "47010a", "47020", "47013"]);
    const observer = new Observer("staged-wilds#1");
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [
        // Flash of Light (cost 2) paid with [energy][mental] and a [wild]: two different types whatever the wild is declared.
        (st) => playCmd(P1, inHand(st, "47008a"), [inHand(st, "47010a"), inHand(st, "47020")]),
        (st) =>
          playCmd(P1, inHand(st, "47013"), [], {
            abilities: [resourceAbility(identityOf(st), "47001a.like-totally")],
          }),
      ],
    });
    expect(seen.wildsSkipped.some((x) => x.startsWith("staged-wilds"))).toBe(true);
    expect(seen.likeTotally.some((x) => x.startsWith("staged-wilds"))).toBe(true);
    expectReplays(result);
  });

  it("Mall Rat puts Shopping Spree into play and its Alter-Ego Action removes 1 threat (one player)", () => {
    const s = started(rhinoArcade(1, [JUBILEE], false));
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    const observer = new Observer("staged-spree#1");
    const result = play(s, observer, {
      stopAtRound: 2,
      script: [
        (st) => use(P1, identityOf(st), "47001b.mall-rat"),
        (st) => use(P1, inPlay(st, "47003"), "47003.shopping-spree-action"),
      ],
    });
    expect(seen.shoppingSpree.some((x) => x.startsWith("staged-spree"))).toBe(true);
    expectReplays(result);
  });
});

describe("Targeted checks seen across the games", () => {
  it("every targeted check was seen at least once", () => {
    const counts = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.length]));
    console.info(JSON.stringify(counts));
    const missing = Object.entries(counts)
      .filter(([, n]) => n === 0)
      .map(([k]) => k);
    expect(missing, `never seen: ${missing.join(", ")}`).toEqual([]);
  });
});
