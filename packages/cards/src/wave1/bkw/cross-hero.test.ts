import { PLAYABLE_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  applyCommand,
  characterProfile,
  cardsInPlay,
  createGame,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS, playableScenario } from "../../playable/index.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { forceMinionIntoPlay } from "../thor/testing.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, "Cards in another hero's deck"): every Black Widow
 * pack (`bkw`, 08001a-08033) aspect/basic player card that has an ability script — every one whose own `aspect` is
 * not `hero:08001a` (an identity-specific card, RRG 1.8 "Identity-Specific Card", p. 23, only a Black Widow deck
 * could hold) — played through the engine from a Core hero's own precon instead of Black Widow's.
 *
 * Covered (11): 08011 Agent Coulson, 08012 Quake, 08013 Stealth Strike, 08017 Counterintelligence, 08018 Spycraft
 * (refused: no Spy character), 08023 Quincarrier (refused in alter-ego, works in hero form), 08024 Target Acquired,
 * 08030 Counterattack, 08031 Rapid Response, 08032 Defensive Stance, 08033 Espionage (refused: no Spy character).
 * Skipped: 08014 The Power of Justice, 08015 Interrogation Room,
 * 08016 Surveillance Team and 08019 Nick Fury (verbatim Core reprints aliased in `../reprints.ts`); 08020-08022
 * Energy/Genius/Strength print no ability (`abilities: []`); 08025-08029 are the obligation/nemesis/encounter cards,
 * not player aspect cards.
 *
 * Seats: justice and basic in Spider-Man/Justice, leadership in Captain Marvel/Leadership, aggression in
 * She-Hulk/Aggression, protection in Black Panther/Protection (`CORE_HERO_FOR_ASPECT`).
 */

const buildScenario = (players: readonly PlayerSetup[]) =>
  playableScenario("rhino", { seed: 11, players: players as never });

const BY_ID = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [c.id as string, c]));
const cardOf = (state: GameState, id: InstanceId): AnyCard => BY_ID.get(state.instances[id]!.cardId as string)!;

const SPIDER_MAN = "core-spider-man-justice";
const CAP_MARVEL = "core-captain-marvel-leadership";
const SHE_HULK = "core-she-hulk-aggression";
const BLACK_PANTHER = "core-black-panther-protection";

/** A neutral boost card (0 icons, no boost ability), soaking the villain's own activation boost draw. */
const ADVANCE = "01186";

const toHeroFirst = (state: GameState): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, toHero(P1)), firstLegal, undefined, PLAYABLE_DEPS);

/** Accepts the named optional response/interrupt (by ability id suffix) or picks a listed instance id; declines the rest. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

function openHandFor(
  code: string,
  coreHero: string,
  options: { readonly alterEgo?: boolean; readonly extraDeck?: readonly string[] } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const seat = buildCrossHeroDeck(PLAYABLE_CARDS, coreHero, code);
  const seated: PlayerSetup = options.extraDeck
    ? { ...seat, deck: [...seat.deck, ...options.extraDeck.map((c) => cardId(c))] }
    : seat;
  const created = createGame(buildScenario([seated]), PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
  const ready = options.alterEgo ? opening : toHeroFirst(opening);
  const { state, ids } = moveToHand(ready, P1, code);
  return { state, id: ids[0]! };
}

/** Moves `n` non-resource cards (never `exclude`) from P1's hand/deck into hand and returns their ids (payment). */
function filler(
  state: GameState,
  n: number,
  exclude: readonly InstanceId[] = [],
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, P1);
  const codes: string[] = [];
  const seen = new Set<InstanceId>(exclude);
  for (const id of [...owner.hand, ...owner.deck]) {
    if (codes.length >= n) break;
    const card = cardOf(state, id);
    if (seen.has(id) || card.type === "resource") continue;
    seen.add(id);
    codes.push(card.id as string);
  }
  if (codes.length < n) throw new Error(`only ${codes.length} filler cards found`);
  const probe = moveToHand(state, P1, ...codes);
  return { state: probe.state, ids: probe.ids.filter((id) => !exclude.includes(id)) };
}

const playCard = (
  state: GameState,
  id: InstanceId,
  payment: readonly InstanceId[],
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
): GameState =>
  settle(
    runWith(PLAYABLE_DEPS, state, play(P1, id, payment, attachTo ? { attachToInstanceId: attachTo } : {})),
    pick,
    undefined,
    PLAYABLE_DEPS,
  );

/** Plays `id` paying its printed cost from other cards. */
function playPaid(
  state: GameState,
  id: InstanceId,
  pick: Picker = firstLegal,
  attachTo?: InstanceId,
  keep: readonly InstanceId[] = [],
): GameState {
  const cost = (cardOf(state, id) as { cost?: number }).cost ?? 0;
  const pay = filler(state, cost, [id, ...keep]);
  return playCard(pay.state, id, pay.ids, pick, attachTo);
}

const withMinion = (state: GameState, code: string): { state: GameState; minion: InstanceId } => {
  const minion = instancesOf(state, code)[0]!;
  return { state: forceMinionIntoPlay(state, minion, P1), minion };
};

/** Runs P1's end of turn through the villain phase until the next player turn begins. */
const throughVillainPhase = (state: GameState, pick: Picker): GameState =>
  settle(runWith(PLAYABLE_DEPS, state, endTurn()), pick, (s) => s.step.kind === "turn", PLAYABLE_DEPS);

describe("Black Widow's justice cards, from Spider-Man (Justice)'s own deck", () => {
  it("08011.agent-coulson-response: after he enters play, searches deck and discard for a Preparation card into hand", () => {
    // Counterintelligence (08017) is the Preparation card; Core has none, so it is seated as an extra deck card.
    const { state: opened, id: coulson } = openHandFor("08011", SPIDER_MAN, { extraDeck: ["08017"] });
    const [prep] = instancesOf(opened, "08017") as [InstanceId];
    const deckState = opened;
    expect(playerOf(deckState, P1).hand).not.toContain(prep);
    const pick: Picker = (st) => {
      const choice = st.pendingChoice;
      if (!choice) return [];
      if (choice.options.some((o) => o.optionId === prep)) return [prep];
      return accepting("08011.agent-coulson-response")(st);
    };
    const after = playPaid(deckState, coulson, pick);
    expect(cardsInPlay(after)).toContain(coulson);
    expect(playerOf(after, P1).hand).toContain(prep);
    expect(playerOf(after, P1).deck).not.toContain(prep);
  });

  it("08012.quake-response: after a minion schemes, exhausts Quake to deal 2 damage to that minion", () => {
    const { state: opened, id: quake } = openHandFor("08012", SPIDER_MAN, { alterEgo: true });
    const inPlay = playPaid(opened, quake);
    const { state: engaged, minion } = withMinion(inPlay, "01101"); // alter-ego: the minion schemes in the villain phase
    const stacked = stackEncounterDeck(engaged, ADVANCE, ADVANCE, "01104");
    const before = inst(stacked, minion).damage;
    const after = throughVillainPhase(stacked, accepting("08012.quake-response"));
    expect(inst(after, quake).exhausted).toBe(true);
    expect(inst(after, minion).damage).toBe(before + 2);
  });

  it("08013.stealth-strike-action: deals 4 damage to an enemy; defeating it removes 2 threat from a scheme", () => {
    const { state: opened, id: strike } = openHandFor("08013", SPIDER_MAN);
    const { state: engaged, minion } = withMinion(opened, "01102"); // Sandman, 4 HP: exactly lethal
    const scheme = engaged.mainScheme.instanceId;
    const threatened = patchInstance(engaged, scheme, { threat: 5 });
    const target: Picker = (st) =>
      st.pendingChoice?.options.some((o) => o.optionId === minion) ? [minion] : firstLegal(st);
    const after = playPaid(threatened, strike, target);
    expect(cardsInPlay(after)).not.toContain(minion);
    expect(inst(after, scheme).threat).toBe(3);

    // Not defeated (the villain survives 4 damage): no threat is removed.
    const villain = threatened.villains[0]!.instanceId;
    const hit = playPaid(threatened, strike, (st) =>
      st.pendingChoice?.options.some((o) => o.optionId === villain) ? [villain] : firstLegal(st),
    );
    expect(inst(hit, villain).damage).toBe(inst(threatened, villain).damage + 4);
    expect(inst(hit, scheme).threat).toBe(5);
  });

  it("08017.counterintelligence-interrupt: prevents 3 threat that would be placed on the main scheme, once", () => {
    const { state: opened, id: ci } = openHandFor("08017", SPIDER_MAN);
    const inPlay = playPaid(opened, ci);
    const before = mainThreat(inPlay);
    // The Break-In's 1 acceleration threat is fully prevented; Counterintelligence is gone for Rhino's scheme (+1).
    const stacked = stackEncounterDeck(inPlay, ADVANCE, ADVANCE, "01104");
    const after = throughVillainPhase(stacked, accepting("08017.counterintelligence-interrupt"));
    expect(playerOf(after, P1).discard).toContain(ci);
    expect(mainThreat(after)).toBe(before + 1);
  });

  it("08018.spycraft: refused from a deck with no Spy character ('Play only if you control a Spy character')", () => {
    const { state, id } = openHandFor("08018", SPIDER_MAN);
    const pay = filler(state, 1, [id]);
    const refused = applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS);
    expect(refused.ok).toBe(false);
  });
});

describe("Black Widow's basic cards, from a Core hero's own deck", () => {
  it("08023.quincarrier-resource: refused in alter-ego (no Avenger trait); in hero form its resource pays a card", () => {
    const { state: alter, id: carrier } = openHandFor("08023", SPIDER_MAN, { alterEgo: true, extraDeck: ["08024"] });
    const pay = filler(alter, 3, [carrier]);
    expect(applyCommand(pay.state, play(P1, carrier, pay.ids), PLAYABLE_DEPS).ok).toBe(false);

    const { state: opened, id } = openHandFor("08023", SPIDER_MAN, { extraDeck: ["08024"] });
    const inPlay = playPaid(opened, id);
    expect(cardsInPlay(inPlay)).toContain(id);
    const given = moveToHand(inPlay, P1, "08024"); // Target Acquired, cost 1
    const [ta] = given.ids as readonly [InstanceId];
    const identity = identityOf(given.state);
    const after = settle(
      runWith(
        PLAYABLE_DEPS,
        given.state,
        play(P1, ta, [], {
          attachToInstanceId: identity,
          abilities: [resourceAbility(id, "08023.quincarrier-resource")],
        }),
      ),
      firstLegal,
      undefined,
      PLAYABLE_DEPS,
    );
    expect(inst(after, ta).attachedTo).toBe(identity);
    expect(inst(after, id).exhausted).toBe(true);
  });

  it("08024.target-acquired-response: after a boost card is turned faceup, discards to cancel its boost ability", () => {
    // Caught Off Guard (01188) boost: "If the villain is making an undefended attack, choose and discard an upgrade."
    const { state: opened, id: ta } = openHandFor("08024", SPIDER_MAN, { extraDeck: [] });
    const identity = identityOf(opened);
    const withWeb = moveToHand(opened, P1, "01008"); // Web-Shooter: the canary upgrade
    const [web] = withWeb.ids as readonly [InstanceId];
    const webIn = playPaid(withWeb.state, web, firstLegal, identity);
    const armed = playPaid(webIn, ta, firstLegal, identity);
    expect(inst(armed, web).attachedTo).toBe(identity);
    const stacked = stackEncounterDeck(armed, "01188", ADVANCE, "01104");
    const after = throughVillainPhase(stacked, accepting("08024.target-acquired-response"));
    expect(playerOf(after, P1).discard).toContain(ta);
    expect(inst(after, web).attachedTo).toBe(identity); // the boost's upgrade discard was cancelled
  });
});

describe("Black Widow's aggression card, from She-Hulk (Aggression)'s own deck", () => {
  it("08030.counterattack-response: after your hero takes damage from an enemy attack, deals that much damage back", () => {
    const { state: opened, id: counter } = openHandFor("08030", SHE_HULK);
    const identity = identityOf(opened);
    const armed = playPaid(opened, counter, firstLegal, identity);
    const villain = armed.villains[0]!.instanceId;
    const hpBefore = inst(armed, identity).damage;
    const villainBefore = inst(armed, villain).damage;
    const stacked = stackEncounterDeck(armed, ADVANCE, ADVANCE, "01104");
    const after = throughVillainPhase(stacked, accepting("08030.counterattack-response"));
    const taken = inst(after, identity).damage - hpBefore;
    expect(taken).toBeGreaterThan(0);
    expect(playerOf(after, P1).discard).toContain(counter);
    expect(inst(after, villain).damage).toBe(villainBefore + taken);
  });
});

describe("Black Widow's leadership card, from Captain Marvel (Leadership)'s own deck", () => {
  it("08031.rapid-response-response: after your ally is defeated, puts it back into play with 1 damage", () => {
    const { state: opened, id: rapid } = openHandFor("08031", CAP_MARVEL);
    const owner = playerOf(opened, P1);
    const allyId = [...owner.hand, ...owner.deck].find((id) => {
      const card = cardOf(opened, id);
      return card.type === "ally" && card.cost <= 3;
    });
    if (!allyId) throw new Error("no cheap ally in the Captain Marvel deck");
    const allyCode = cardOf(opened, allyId).id as string;
    const given = moveToHand(opened, P1, allyCode);
    const [ally] = given.ids as readonly [InstanceId];
    const identity = identityOf(given.state);
    const rapidIn = playPaid(given.state, rapid, firstLegal, identity, [ally]);
    const allyIn = playPaid(rapidIn, ally, firstLegal, undefined, [rapid]);
    expect(cardsInPlay(allyIn)).toContain(ally);
    const hp = characterProfile(allyIn, ally, PLAYABLE_DEPS)!.maxHp;
    const primed = patchInstance(allyIn, ally, { damage: Math.max(0, hp - 1) });
    const stacked = stackEncounterDeck(primed, ADVANCE, ADVANCE, "01104");
    const defend: Picker = (st) => {
      const choice = st.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") {
        const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally);
        return hit ? [hit.optionId] : ["decline"];
      }
      return accepting("08031.rapid-response-response")(st);
    };
    const after = throughVillainPhase(stacked, defend);
    expect(playerOf(after, P1).discard).toContain(rapid);
    expect(cardsInPlay(after)).toContain(ally);
    expect(inst(after, ally).damage).toBe(1);
  });
});

describe("Black Widow's protection card, from Black Panther (Protection)'s own deck", () => {
  it("08032.defensive-stance-interrupt: when your hero would take damage, prevents 3 of it", () => {
    const { state: opened, id: stance } = openHandFor("08032", BLACK_PANTHER);
    const identity = identityOf(opened);
    const armed = playPaid(opened, stance, firstLegal, identity);
    const stacked = stackEncounterDeck(armed, ADVANCE, ADVANCE, "01104");

    const control = throughVillainPhase(stacked, firstLegal);
    expect(inst(control, identity).damage).toBeGreaterThan(0); // Rhino's attack hurts without the interrupt

    const after = throughVillainPhase(stacked, accepting("08032.defensive-stance-interrupt"));
    expect(playerOf(after, P1).discard).toContain(stance);
    expect(inst(after, identity).damage).toBe(0);
  });
});

describe("Black Widow's Spy-gated basic card, from a Core hero's own deck", () => {
  it("08033.espionage: refused from a deck with no Spy character ('Play only if you control a Spy character')", () => {
    const { state, id } = openHandFor("08033", SPIDER_MAN);
    const pay = filler(state, 1, [id]);
    expect(applyCommand(pay.state, play(P1, id, pay.ids), PLAYABLE_DEPS).ok).toBe(false);
  });
});
