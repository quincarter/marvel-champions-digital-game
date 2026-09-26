/**
 * docs/phase7-wave4.md §3.18: set-aside modular sets, "Standard Mode Only" / "Expert Mode Only" faces, and the steady
 * keyword granted by The Hood's cards — driven with The Hood's own emitted card data (`hood`), with synthetic ability
 * definitions standing in for the scripts (the scripting pass writes the real ones).
 *
 * Sources: Making Connections 1A (24004a): "Choose 7 modular encounter sets and set them aside (you may choose
 * randomly). Choose 1 of those sets at random, then shuffle it into the encounter deck."; Wheel of Genres (`mojo`
 * 39026a): "if there are no set-aside modular encounter sets remaining"; RRG 1.8 "Double-Sided Card" (p. 17): a card
 * with "Standard Mode Only" and "Expert Mode Only" sides "is put into play with the 'Expert Mode Only' side faceup if the
 * players are playing expert mode"; RRG 1.8 "Steady" (p. 41).
 */

import { HOOD_CARDS, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword, statusActive } from "./keywords.js";
import { activeEncounterDeckId, mustInstance } from "./query.js";
import { resolveValue } from "./select.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, giveCard, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, minionEngagedWith, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** Making Connections' shuffle-in, on a 0-cost event so a test can resolve it on demand. */
const CONNECT_ACTION = stubAbility(
  "connect.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "shuffleInSetAsideModularSet", bind: "set" }] }),
);
const CONNECT = stubEvent({ id: "connect", cost: 0, abilities: [CONNECT_ACTION.ref] });

/** Formidable Foe's two faces: "The villain gains steady." / "Each enemy gains steady." */
const FOE_STANDARD = stubAbility(
  "24049a.formidable-foe-constant",
  def({
    trigger: {
      kind: "constant",
      keywordGrants: [{ target: { categories: ["villain"] }, keyword: { name: "steady" } }],
    },
    effects: [],
  }),
);
const FOE_EXPERT = stubAbility(
  "24049b.formidable-foe-constant",
  def({
    trigger: { kind: "constant", keywordGrants: [{ target: { categories: ["enemy"] }, keyword: { name: "steady" } }] },
    effects: [],
  }),
);
/** The Hood's Mantle: "The Hood gains retaliate 1 and steady." */
const MANTLE = stubAbility(
  "24008.the-hoods-mantle-constant",
  def({
    trigger: {
      kind: "constant",
      keywordGrants: [
        { target: { hostOfSelf: true }, keyword: { name: "retaliate", value: 1 } },
        { target: { hostOfSelf: true }, keyword: { name: "steady" } },
      ],
    },
    effects: [],
  }),
);
const deps: EngineDeps = depsOf(CONNECT_ACTION, FOE_STANDARD, FOE_EXPERT, MANTLE);

const card = (id: string): AnyCard => {
  const found = HOOD_CARDS.find((c) => c.id === id);
  if (!found) throw new Error(`no hood card ${id}`);
  return found;
};
const FORMIDABLE_FOE = card("24049a");
const A_MINION = HOOD_CARDS.find((c) => c.type === "minion")!;
const HOODS_MANTLE = card("24008");
/** Every card of a `hood` modular set, one id per copy. */
const setCards = (setId: string): readonly CardId[] =>
  HOOD_CARDS.filter((c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(setId)).flatMap(
    (c) => copiesOf(c.id, c.quantityInSet),
  );
const HYDE = setCards("mister_hyde");
const ARMORY = setCards("ransacked_armory");
const WRECKING = setCards("wrecking_crew");

function game(config: Partial<GameSetupConfig> = {}): GameState {
  const result = createGame(
    {
      seed: 24,
      cards: [...DEFAULT_CARDS, ...HOOD_CARDS, BLANK, CONNECT],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copiesOf(BLANK.id, 20),
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, CONNECT.id, CONNECT.id] }],
      ...config,
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}
const SETS = [
  { encounterSetId: "mister_hyde", cardIds: HYDE },
  { encounterSetId: "ransacked_armory", cardIds: ARMORY },
  { encounterSetId: "wrecking_crew", cardIds: WRECKING },
];
const encounterDeck = (state: GameState): readonly InstanceId[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.deck;
const count = (state: GameState): number =>
  resolveValue(
    state,
    { kind: "setAsideModularSetCount" },
    { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps },
    deps,
  );
function connect(state: GameState) {
  const given = giveCard(state, P1, CONNECT.id);
  const driven = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
  return { state: driven.session.state, events: driven.events, session: driven.session };
}

describe("§3.18 set-aside modular encounter sets", () => {
  it("setup creates each set-aside set in the set-aside area, out of the encounter deck, and records it", () => {
    const state = game({ setAsideModularSets: SETS });
    expect(state.setAsideModularSets?.map((set) => set.encounterSetId)).toEqual([
      "mister_hyde",
      "ransacked_armory",
      "wrecking_crew",
    ]);
    const all = (state.setAsideModularSets ?? []).flatMap((set) => set.instanceIds);
    expect(all).toHaveLength(HYDE.length + ARMORY.length + WRECKING.length);
    for (const id of all) expect(state.encounterSetAside).toContain(id);
    expect(encounterDeck(state).some((id) => all.includes(id))).toBe(false);
    expect(count(state)).toBe(3);
  });

  it("'choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck' moves one whole set", () => {
    const before = game({ setAsideModularSets: SETS });
    const { state, events, session } = connect(before);
    const logged = events.find((e) => e.type === "setAsideModularSetShuffledIn");
    expect(logged?.type).toBe("setAsideModularSetShuffledIn");
    if (logged?.type !== "setAsideModularSetShuffledIn") return;
    const chosen = before.setAsideModularSets!.find((set) => set.encounterSetId === logged.encounterSetId)!;
    expect(logged.instanceIds).toEqual(chosen.instanceIds);
    for (const id of chosen.instanceIds) {
      expect(encounterDeck(state)).toContain(id);
      expect(state.encounterSetAside).not.toContain(id);
    }
    expect(state.setAsideModularSets?.map((set) => set.encounterSetId)).not.toContain(logged.encounterSetId);
    expect(count(state)).toBe(2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(state);
  });

  it("with none left, nothing happens and the count reads 0 (Wheel of Genres' 'no set-aside modular sets remaining')", () => {
    let state = game({ setAsideModularSets: [SETS[0]!] });
    state = connect(state).state;
    expect(count(state)).toBe(0);
    expect(state.setAsideModularSets).toEqual([]);
    const deckSize = encounterDeck(state).length;
    const again = connect(state);
    expect(encounterDeck(again.state)).toHaveLength(deckSize);
    expect(again.events.some((e) => e.type === "setAsideModularSetShuffledIn")).toBe(false);
  });

  it("a game that sets none aside is unchanged (no field) and reads 0", () => {
    const state = game();
    expect("setAsideModularSets" in state).toBe(false);
    expect(count(state)).toBe(0);
  });

  it("setup refuses a card that is not in the set it is set aside with", () => {
    const result = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, ...HOOD_CARDS, BLANK],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MAIN_SCHEME.id,
        encounterDeck: copiesOf(BLANK.id, 5),
        players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
        setAsideModularSets: [{ encounterSetId: "mister_hyde", cardIds: [ARMORY[0]!] }],
      },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("§3.18 'Standard Mode Only' / 'Expert Mode Only' faces (Formidable Foe, 24049a/b)", () => {
  const withFoe = (difficulty?: "standard" | "expert"): GameState =>
    game({
      encounterDeck: [FORMIDABLE_FOE.id, A_MINION.id, ...copiesOf(BLANK.id, 20)],
      ...(difficulty ? { difficulty } : {}),
    });
  const foeOf = (state: GameState): InstanceId =>
    state.villainArea.find((id) => state.instances[id]?.cardId === FORMIDABLE_FOE.id)!;

  it("standard mode: the Setup card enters play on its 'Standard Mode Only' face (the villain gains steady)", () => {
    const state = withFoe();
    const foe = foeOf(state);
    expect(mustInstance(state, foe).flipped).toBe(false);
    expect(state.scenarioRules.difficulty).toBeUndefined();
    const villain = state.villains[0]!.instanceId;
    expect(hasKeyword(state, villain, "steady", deps)).toBe(true);
    const minion = minionEngagedWith(state, A_MINION.id);
    expect(hasKeyword(minion.state, minion.id, "steady", deps)).toBe(false);
  });

  it("expert mode: it enters play on its 'Expert Mode Only' face (each enemy gains steady)", () => {
    const state = withFoe("expert");
    const foe = foeOf(state);
    expect(mustInstance(state, foe).flipped).toBe(true);
    expect(state.scenarioRules.difficulty).toBe("expert");
    expect(hasKeyword(state, state.villains[0]!.instanceId, "steady", deps)).toBe(true);
    const minion = minionEngagedWith(state, A_MINION.id);
    expect(hasKeyword(minion.state, minion.id, "steady", deps)).toBe(true);
  });
});

describe("§3.18 steady granted by The Hood's cards (RRG 1.8 'Steady', p. 41)", () => {
  it("The Hood's Mantle: one stunned card is held but does not stun the villain; the second does", () => {
    const base = game({ encounterDeck: [HOODS_MANTLE.id, ...copiesOf(BLANK.id, 20)] });
    const placed = encounterCardInVillainArea(base, HOODS_MANTLE.id);
    const villain = placed.state.villains[0]!.instanceId;
    const attached: GameState = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: villain },
        [villain]: { ...mustInstance(placed.state, villain), attachments: [placed.id] },
      },
    };
    expect(hasKeyword(attached, villain, "steady", deps)).toBe(true);
    const withStuns = (n: number): GameState => ({
      ...attached,
      instances: {
        ...attached.instances,
        [villain]: { ...mustInstance(attached, villain), statuses: { stunned: n, confused: 0, tough: 0 } },
      },
    });
    expect(statusActive(withStuns(1), villain, "stunned", deps)).toBe(false);
    expect(statusActive(withStuns(2), villain, "stunned", deps)).toBe(true);
    // Without the Mantle's grant, one card stuns.
    expect(statusActive(withStuns(1), villain, "stunned")).toBe(true);
  });
});
