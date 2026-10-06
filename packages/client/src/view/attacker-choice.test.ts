import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { cardId } from "@mc/content";
import {
  activeVillain,
  cardOf,
  characterProfile,
  hasKeyword,
  instanceId,
  legalActions,
  type GameState,
  type InstanceId,
  type LastingEffect,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { assaultThwartSuffix, powerEntries, powerSources } from "./attacker-choice.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

/** Plays past setup and flips to hero, the same as `targeting-panel.test.ts`'s own fixture. */
async function intoTurn(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  return store.state.game!;
}

/** Moves the first ally in the player's hand or deck into play, ready, and stuns the hero when asked. */
function withAlly(state: GameState, stunHero: boolean): { state: GameState; ally: InstanceId } {
  const player = state.players[0]!;
  const ally = [...player.hand, ...player.deck].find((id) => cardOf(state, id)?.type === "ally");
  if (!ally) throw new Error("expected an ally in the Spider-Man deck");
  const hero = player.identity.instanceId;
  const heroInstance = state.instances[hero]!;
  return {
    ally,
    state: {
      ...state,
      players: [
        {
          ...player,
          hand: player.hand.filter((id) => id !== ally),
          deck: player.deck.filter((id) => id !== ally),
          playArea: [...player.playArea, ally],
        },
        ...state.players.slice(1),
      ],
      instances: {
        ...state.instances,
        [ally]: { ...state.instances[ally]!, exhausted: false },
        [hero]: stunHero ? { ...heroInstance, statuses: { ...heroInstance.statuses, stunned: 1 } } : heroInstance,
      },
    },
  };
}

describe("powerSources", () => {
  test("a stunned hero and a ready ally are both offered, the hero marked as cancelled by the stun", async () => {
    const { state, ally } = withAlly(await intoTurn(), true);
    const actions = legalActions(state, state.players[0]!.playerId, CORE_DEPS);
    const sources = powerSources(state, powerEntries(actions, "attack"), "attack", CORE_DEPS);

    const hero = state.players[0]!.identity.instanceId;
    expect(sources.map((source) => source.instanceId)).toEqual([hero, ally]);
    expect(sources[0]!.cancelledBy).toBe("stunned");
    expect(sources[0]!.note).toMatch(/Stunned/);
    expect(sources[1]!.cancelledBy).toBeNull();
    expect(sources[1]!.stat).toMatch(/^ATK \d/);
    const printed = cardOf(state, ally);
    if (printed?.type !== "ally") throw new Error("expected an ally");
    expect(sources[1]!.consequential).toBe(printed.consequentialDamage.attack);
  });

  test("with only the hero able to attack there is nothing to pick", async () => {
    const state = await intoTurn();
    const actions = legalActions(state, state.players[0]!.playerId, CORE_DEPS);
    const sources = powerSources(state, powerEntries(actions, "attack"), "attack", CORE_DEPS);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.cancelledBy).toBeNull();
    expect(sources[0]!.consequential).toBe(0);
  });
});

describe("powerSources against an assault scheme (RRG 1.8 p. 8)", () => {
  const TERRITORIAL_CONTROL = cardId("40087");

  /** A real wave 7 assault side scheme (Territorial Control) dropped into the villain area. */
  function withAssaultScheme(state: GameState): { state: GameState; scheme: InstanceId } {
    const scheme = instanceId("assault-test");
    return {
      scheme,
      state: {
        ...state,
        villainArea: [...state.villainArea, scheme],
        instances: {
          ...state.instances,
          [scheme]: {
            instanceId: scheme,
            cardId: TERRITORIAL_CONTROL,
            ownerId: null,
            controllerId: null,
            home: { kind: "encounterDeck", deckId: activeVillain(state).encounterDeckId },
            faceup: true,
            exhausted: false,
            damage: 0,
            threat: 4,
            statuses: { stunned: 0, confused: 0, tough: 0 },
            counters: {},
            attachedTo: null,
            attachments: [],
            boostCards: [],
            tucked: [],
            facedownAs: null,
            engagedWith: null,
            flipped: false,
          },
        },
      },
    };
  }

  test("the hero's preview reads ATK, labeled, and a normal scheme still reads THW", async () => {
    const base = await intoTurn();
    const hero = base.players[0]!.identity.instanceId;
    const profile = characterProfile(base, hero, POOL_DEPS)!;
    expect(profile.atk).not.toBe(profile.thw);
    const { state, scheme } = withAssaultScheme(base);
    const entry = powerEntries(legalActions(state, state.players[0]!.playerId, POOL_DEPS), "thwart")[0]!;
    expect(hasKeyword(state, scheme, "assault", POOL_DEPS)).toBe(true);

    const [assault] = powerSources(state, [entry], "thwart", POOL_DEPS, scheme);
    expect(assault!.stat).toBe(`ATK ${profile.atk}`);
    expect(assault!.why).toBe("ATK · assault");

    const [normal] = powerSources(state, [entry], "thwart", POOL_DEPS, state.mainScheme.instanceId);
    expect(normal!.stat).toBe(`THW ${profile.thw}`);
    expect(normal!.why).toBeNull();
  });

  test("an ATK modifier shows in the assault preview and a THW modifier does not", async () => {
    const { state, scheme } = withAssaultScheme(await intoTurn());
    const hero = state.players[0]!.identity.instanceId;
    const entry = powerEntries(legalActions(state, state.players[0]!.playerId, POOL_DEPS), "thwart")[0]!;
    const profile = characterProfile(state, hero, POOL_DEPS)!;
    const modifier = (stat: "atk" | "thw", amount: number): LastingEffect => ({
      id: `test-${stat}`,
      kind: "statModifier",
      stat,
      amount: { kind: "const", value: amount },
      targets: [hero],
      affects: null,
      scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
      duration: { kind: "endOfPhase" },
    });
    const boosted = { ...state, lastingEffects: [modifier("atk", 2)] };
    expect(powerSources(boosted, [entry], "thwart", POOL_DEPS, scheme)[0]!.stat).toBe(`ATK ${profile.atk + 2}`);
    const thwOnly = { ...state, lastingEffects: [modifier("thw", 2)] };
    expect(powerSources(thwOnly, [entry], "thwart", POOL_DEPS, scheme)[0]!.stat).toBe(`ATK ${profile.atk}`);
    expect(powerSources(thwOnly, [entry], "thwart", POOL_DEPS, state.mainScheme.instanceId)[0]!.stat).toBe(
      `THW ${profile.thw + 2}`,
    );
  });

  test("an ally takes the consequential damage under its ATK against assault, its THW column otherwise", async () => {
    const { state: withA, ally } = withAlly(await intoTurn(), false);
    const { state, scheme } = withAssaultScheme(withA);
    const card = cardOf(state, ally);
    if (card?.type !== "ally") throw new Error("expected an ally");
    const entries = powerEntries(legalActions(state, state.players[0]!.playerId, POOL_DEPS), "thwart");
    const entry = entries.find((e) => e.action.kind === "basicThwart" && e.action.instanceId === ally)!;
    const [assault] = powerSources(state, [entry], "thwart", POOL_DEPS, scheme);
    expect(assault!.consequential).toBe(card.consequentialDamage.attack);
    expect(assault!.stat).toBe(`ATK ${characterProfile(state, ally, POOL_DEPS)!.atk}`);
    const [normal] = powerSources(state, [entry], "thwart", POOL_DEPS, state.mainScheme.instanceId);
    expect(normal!.consequential).toBe(card.consequentialDamage.thwart);
  });
});

describe("powerSources before a scheme is chosen, assault side scheme (Keep Them Busy) and main scheme both in play", () => {
  const scheme = instanceId("assault-mixed");
  async function mixedTable(): Promise<GameState> {
    const base = await intoTurn();
    return {
      ...base,
      villainArea: [...base.villainArea, scheme],
      instances: {
        ...base.instances,
        [base.mainScheme.instanceId]: { ...base.instances[base.mainScheme.instanceId]!, threat: 3 },
        [scheme]: {
          ...base.instances[base.mainScheme.instanceId]!,
          instanceId: scheme,
          cardId: cardId("43018"),
          threat: 4,
        },
      },
    };
  }

  test("the hero shows both numbers when the targets mix assault and normal", async () => {
    const state = await mixedTable();
    const profile = characterProfile(state, state.players[0]!.identity.instanceId, POOL_DEPS)!;
    expect(profile.atk).not.toBe(profile.thw);
    const entry = powerEntries(legalActions(state, state.players[0]!.playerId, POOL_DEPS), "thwart")[0]!;
    expect(entry.targets).toContain(scheme);
    expect(entry.targets).toContain(state.mainScheme.instanceId);
    const [source] = powerSources(state, [entry], "thwart", POOL_DEPS);
    expect(source!.stat).toBe(`THW ${profile.thw} · ATK ${profile.atk}`);
    expect(source!.why).toBe("ATK vs assault");
  });

  test("an ally's note carries the second consequential column only when it differs", async () => {
    const { state: withA, ally } = withAlly(await mixedTable(), false);
    const card = cardOf(withA, ally);
    if (card?.type !== "ally") throw new Error("expected an ally");
    const entry = powerEntries(legalActions(withA, withA.players[0]!.playerId, POOL_DEPS), "thwart").find(
      (e) => e.action.kind === "basicThwart" && e.action.instanceId === ally,
    )!;
    const [source] = powerSources(withA, [entry], "thwart", POOL_DEPS);
    const { attack, thwart } = card.consequentialDamage;
    expect(source!.consequential).toBe(thwart);
    const base = thwart > 0 ? `Takes ${thwart} damage` : "No damage";
    expect(source!.shortNote).toBe(attack === thwart ? base : `${base} (${attack} vs assault)`);
  });

  test("a table with only normal schemes is unchanged and one with only assault targets reads ATK", async () => {
    const state = await mixedTable();
    const hero = state.players[0]!.identity.instanceId;
    const profile = characterProfile(state, hero, POOL_DEPS)!;
    const entry = powerEntries(legalActions(state, state.players[0]!.playerId, POOL_DEPS), "thwart")[0]!;
    const normalOnly = { ...entry, targets: [state.mainScheme.instanceId] };
    expect(powerSources(state, [normalOnly], "thwart", POOL_DEPS)[0]!.stat).toBe(`THW ${profile.thw}`);
    const assaultOnly = { ...entry, targets: [scheme] };
    expect(powerSources(state, [assaultOnly], "thwart", POOL_DEPS)[0]!.stat).toBe(`ATK ${profile.atk}`);
    expect(powerSources(state, [entry], "attack", POOL_DEPS)[0]!.stat).toMatch(/^ATK /);
  });

  test("the targeting panel's suffix reads the same way for each table", async () => {
    const state = await mixedTable();
    const hero = state.players[0]!.identity.instanceId;
    const profile = characterProfile(state, hero, POOL_DEPS)!;
    const entry = powerEntries(legalActions(state, state.players[0]!.playerId, POOL_DEPS), "thwart")[0]!;
    const suffixOf = (targets: readonly InstanceId[]) =>
      assaultThwartSuffix(powerSources(state, [{ ...entry, targets }], "thwart", POOL_DEPS)[0]!);
    expect(suffixOf(entry.targets)).toBe(`${profile.thw} · ATK ${profile.atk} vs assault`);
    expect(suffixOf([scheme])).toBe(`ATK ${profile.atk} · assault`);
    expect(suffixOf([state.mainScheme.instanceId])).toBeNull();
  });
});
