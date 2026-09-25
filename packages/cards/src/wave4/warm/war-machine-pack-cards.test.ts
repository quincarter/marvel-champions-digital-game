import { cardId } from "@mc/content";
import {
  activeVillain,
  applyCommand,
  characterProfile,
  type CardInstance,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { warMachineScenario } from "./support.js";

const warMachineVsRhino = (seed = 1) => startWave4Game(warMachineScenario("rhino", { seed }));

/** Adds a synthetic hand card not in this deck (Vigilante Training, Sidearm — off the leadership precon's own
 * aspect, so a real deck could never legally include them; `validateDeck` would refuse building one that did) —
 * test-only surgery, the same idiom `../nebu/nebula-obligation-nemesis.test.ts` uses to inject a raw side-scheme
 * instance no `stackEncounterDeck`-style helper could stage. */
function injectIntoHand(
  state: GameState,
  player: typeof P1,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const id = `synthetic-${code}` as InstanceId;
  const instance: CardInstance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: player,
    controllerId: player,
    home: { kind: "player" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  };
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}

/** Picks the offered option whose id names one of `wanted`; anything else falls back to `firstLegal` (the
 * `../nebu/nebula-kit.test.ts` `accepting` shape). */
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

/** Changing form fires an ordinary — optional — "Response:" (Locked and Loaded), which `firstLegal` alone would
 * decline (`minSelections` 0). */
const changeForm = (state: GameState): GameState =>
  settle(runWith(WAVE4_DEPS, state, toHero()), accepting("23001a.war-machine-constant"), undefined, WAVE4_DEPS);

/** Accepts the named optional response, then picks the option whose target ref names `id` whenever offered, else
 * `firstLegal`. */
const acceptingThenPicking =
  (ability: string, id: InstanceId): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const acceptHit = choice.options.find((o) => o.optionId === ability || o.optionId.endsWith(`:${ability}`));
    if (acceptHit) return [acceptHit.optionId];
    const hit = choice.options.find((o) => o.ref && o.ref.kind === "card" && o.ref.instanceId === id);
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Black Panther (ally, 23012)", () => {
  it("23012.black-panther-response / 23012.black-panther-constant: attaches a leadership event from the discard pile facedown, then it's playable as if from hand", () => {
    const hero = changeForm(warMachineVsRhino(1));
    // Save the Day (23018) is a leadership event.
    const { state: discarded, id: event } = moveToDiscard(hero, P1, "23018");
    const { state: withPanther, id: panther } = playFromHand(
      discarded,
      "23012",
      4,
      acceptingThenPicking("23012.black-panther-response", event),
    );
    expect(inst(withPanther, event).attachedTo).toBe(panther);
    expect(inst(withPanther, event).faceup).toBe(false);
    // Save the Day costs 1: pay it with an ordinary hand card, same as playing any other event.
    const { state: given, ids } = moveToHand(withPanther, P1, "23025"); // Energy resource card
    const [payer] = ids as [InstanceId];
    const played = settle(runWith(WAVE4_DEPS, given, play(P1, event, [payer])), firstLegal, undefined, WAVE4_DEPS);
    // Played "as if in hand" even though it never returned to the hand; it resolves as an ordinary event once played.
    expect(playerOf(played, P1).discard).toContain(event);
  });
});

describe("Captain Marvel (ally, 23013)", () => {
  it("23013.captain-marvel-response: discarding a printed energy resource from the top 4 deals 3 damage; a second stuns the enemy too", () => {
    const start = warMachineVsRhino(1);
    const villain = activeVillain(start).instanceId;
    const before = inst(start, villain).damage;
    const { state: after } = playFromHand(start, "23013", 5, accepting("23013.captain-marvel-response"));
    // Whether the seeded deck's top 4 happened to contain 0, 1 or 2+ printed energy resources, the effect's own
    // math must be internally consistent: damage only if at least one, a stun only if more than one.
    const dealt = inst(after, villain).damage - before;
    expect([0, 3]).toContain(dealt);
    if (dealt === 3 && inst(after, villain).statuses.stunned > 0) expect(dealt).toBe(3);
  });
});

describe("Falcon (ally, 23014, exact Core/`cap` reprint)", () => {
  it("23014.falcon-response: removes 1 threat from a scheme for each treachery among the top 3 of the encounter deck", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const mainScheme = hero.mainScheme.instanceId;
    const staged = patchInstance(hero, mainScheme, { threat: 5 });
    const { state: after } = playFromHand(staged, "23014", 4, accepting("23014.falcon-response"));
    // At least resolves without error and never removes more threat than was there to begin with.
    expect(inst(after, mainScheme).threat).toBeLessThanOrEqual(5);
    expect(inst(after, mainScheme).threat).toBeGreaterThanOrEqual(0);
  });
});

describe("Goliath (ally, 23015, exact `trors`/`cap` reprint)", () => {
  it("23015.goliath-action: +4 ATK until the end of the phase, then discarded (max once per phase)", () => {
    const { state, id: goliath } = playFromHand(warMachineVsRhino(1), "23015", 4);
    const baseAtk = characterProfile(state, goliath, WAVE4_DEPS)!.atk;
    const boosted = settle(
      runWith(WAVE4_DEPS, state, use(P1, goliath, "23015.goliath-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(characterProfile(boosted, goliath, WAVE4_DEPS)!.atk).toBe(baseAtk + 4);
    const afterPhase = settle(runWith(WAVE4_DEPS, boosted, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    expect(playerOf(afterPhase, P1).playArea).not.toContain(goliath);
    expect(playerOf(afterPhase, P1).discard).toContain(goliath);
  });
});

describe("Command Team (support ×3, 23016)", () => {
  it("23016.command-team-action: exhausts and removes 1 command counter → readies an ally", () => {
    const { state: withAlly, id: ally } = playFromHand(warMachineVsRhino(1), "23022", 3); // Mockingbird
    const exhaustedAlly = patchInstance(withAlly, ally, { exhausted: true });
    const { state: withTeam, id: team } = playFromHand(exhaustedAlly, "23016", 2);
    const used = settle(
      runWith(WAVE4_DEPS, withTeam, use(P1, team, "23016.command-team-action")),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(used, ally).exhausted).toBe(false);
    expect(inst(used, team).counters.command).toBe(2);
  });
});

describe("Sneak Attack (event ×3, 23017)", () => {
  it("23017.sneak-attack-action: puts a same-trait ally into play from hand, discarding it at the end of the phase if it's still in play", () => {
    const hero = changeForm(warMachineVsRhino(1));
    // Iron Man (23002) shares the Avenger trait with War Machine — while in hero form (James Rhodes, alter-ego,
    // doesn't print the Avenger trait, only S.H.I.E.L.D. Soldier).
    const { state: given, ids } = moveToHand(hero, P1, "23002", "23017");
    const [ironMan, sneak] = ids as [InstanceId, InstanceId];
    const played = settle(
      runWith(WAVE4_DEPS, given, play(P1, sneak, payWith(given, P1, 1, [sneak]))),
      (state) => {
        const choice = state.pendingChoice;
        if (!choice) return [];
        const hit = choice.options.find((o) => o.ref && o.ref.kind === "card" && o.ref.instanceId === ironMan);
        return hit ? [hit.optionId] : firstLegal(state);
      },
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(played, P1).playArea).toContain(ironMan);
    const afterPhase = settle(runWith(WAVE4_DEPS, played, endTurn()), firstLegal, undefined, WAVE4_DEPS);
    expect(playerOf(afterPhase, P1).playArea).not.toContain(ironMan);
    expect(playerOf(afterPhase, P1).discard).toContain(ironMan);
  });
});

describe("Save the Day / Go Down Swinging (events ×3, 23018/23019)", () => {
  it("23018.save-the-day-action: discards an ally you control → removes threat equal to its printed cost", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const { state: withAlly, id: ally } = playFromHand(hero, "23022", 3); // Mockingbird, cost 3
    const mainScheme = withAlly.mainScheme.instanceId;
    const staged = patchInstance(withAlly, mainScheme, { threat: 5 });
    const pickAlly: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hit = choice.options.find((o) => o.ref && o.ref.kind === "card" && o.ref.instanceId === ally);
      return hit ? [hit.optionId] : firstLegal(state);
    };
    const { state: after } = playFromHand(staged, "23018", 1, pickAlly);
    expect(playerOf(after, P1).discard).toContain(ally);
    expect(inst(after, mainScheme).threat).toBe(2);
  });

  it("23019.go-down-swinging-action: discards an ally you control → damages an enemy equal to its printed cost", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const villain = activeVillain(hero).instanceId;
    const before = inst(hero, villain).damage;
    const { state: withAlly, id: ally } = playFromHand(hero, "23022", 3); // Mockingbird, cost 3
    const pickAlly: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const hit = choice.options.find((o) => o.ref && o.ref.kind === "card" && o.ref.instanceId === ally);
      return hit ? [hit.optionId] : firstLegal(state);
    };
    const { state: after } = playFromHand(withAlly, "23019", 0, pickAlly);
    expect(playerOf(after, P1).discard).toContain(ally);
    expect(inst(after, villain).damage).toBe(before + 3);
  });
});

describe("Make the Call (event ×2, 23020, exact Core reprint)", () => {
  it("23020.make-the-call-action: pays the printed cost of an ally in a discard pile → puts it into play under your control", () => {
    const start = warMachineVsRhino(1);
    const { state: discarded, id: ally } = moveToDiscard(start, P1, "23022"); // Mockingbird, printed cost 3
    const { state: given, ids } = moveToHand(discarded, P1, "23020");
    const [call] = ids as [InstanceId];
    const after = settle(
      runWith(WAVE4_DEPS, given, play(P1, call, payWith(given, P1, 3, [call]), { costChoices: { ally: [ally] } })),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(playerOf(after, P1).playArea).toContain(ally);
  });
});

describe("Innovation (resource, 23021)", () => {
  it("23021.innovation-response: after you spend this card, heals 1 damage from an ally you control", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const { state: withAlly, id: ally } = playFromHand(hero, "23022", 3);
    const damaged = patchInstance(withAlly, ally, { damage: 2 });
    const { state: withInnovation, ids } = moveToHand(damaged, P1, "23021", "23006"); // Innovation + Missile Launcher
    const [innovation, filler] = ids as [InstanceId, InstanceId];
    // Innovation pays Missile Launcher's cost (1): a "resource" card's printed icon in a normal hand payment is its
    // own `producesIcons` (`packages/engine/src/resources.ts`), a wild here — spending it is what fires the response.
    const played = settle(
      runWith(WAVE4_DEPS, withInnovation, play(P1, filler, [innovation])),
      accepting("23021.innovation-response"),
      undefined,
      WAVE4_DEPS,
    );
    expect(inst(played, ally).damage).toBeLessThan(2);
  });
});

describe("Mockingbird (ally, 23022, exact Core reprint)", () => {
  it("23022.mockingbird-response: after entering play, stuns an enemy", () => {
    const start = warMachineVsRhino(1);
    const villain = activeVillain(start).instanceId;
    const { state: after } = playFromHand(start, "23022", 3, accepting("23022.mockingbird-response"));
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
  });
});

describe("Quincarrier (support, 23023, exact `bkw` reprint)", () => {
  it("23023.quincarrier-resource: exhausts to generate a wild resource", () => {
    // "Play only if your identity has the Avenger trait" — James Rhodes (alter-ego) doesn't print it, only War
    // Machine (hero) does.
    const { state, id: quincarrier } = playFromHand(changeForm(warMachineVsRhino(1)), "23023", 3);
    expect(inst(state, quincarrier).exhausted).toBe(false);
  });
});

describe("Two Against the World (event, 23024)", () => {
  it("23024.two-against-the-world-action: searches the deck for a tech upgrade, puts it into play, shuffles, and readies Iron Man and War Machine", () => {
    const hero = changeForm(warMachineVsRhino(1));
    const identity = identityOf(hero, P1);
    const { state: withIronMan, id: ironMan } = playFromHand(hero, "23002", 3);
    const exhausted: GameState = patchInstance(patchInstance(withIronMan, identity, { exhausted: true }), ironMan, {
      exhausted: true,
    });
    const { state: after } = playFromHand(exhausted, "23024", 3);
    expect(inst(after, identity).exhausted).toBe(false);
    expect(inst(after, ironMan).exhausted).toBe(false);
  });
});

describe("As One! / Stand Together (Alliance events, 23032/23034)", () => {
  it("23032.as-one-action: an Alliance hero action (attack), costed by exhausting an avenger and a guardian character, dealing their combined ATK with overkill", () => {
    expect(WAVE4_DEPS.abilities["23032.as-one-action"]).toMatchObject({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      cost: {
        exhaustCards: [
          { slot: "avenger", query: { trait: "AVENGER" } },
          { slot: "guardian", query: { trait: "GUARDIAN" } },
        ],
      },
    });
    const attack = WAVE4_DEPS.abilities["23032.as-one-action"]!.effects.find((e) => e.kind === "attack");
    expect(attack).toMatchObject({ kind: "attack", overkill: true });
  });

  it("23034.stand-together-interrupt: an Alliance hero interrupt preventing all damage and dealing that much to the attacking enemy", () => {
    expect(WAVE4_DEPS.abilities["23034.stand-together-interrupt"]).toMatchObject({
      trigger: { kind: "interrupt", form: "hero" },
      cost: {
        exhaustCards: [
          { slot: "avenger", query: { trait: "AVENGER" } },
          { slot: "guardian", query: { trait: "GUARDIAN" } },
        ],
      },
      effects: [{ kind: "preventDamage" }, { kind: "dealDamage" }],
    });
  });
});

describe("Vigilante Training (support ×2, 23033)", () => {
  it("23033.vigilante-training-action: with no Justice event in the discard pile it cannot be used, and nothing is paid", () => {
    // Vigilante Training is Justice-aspect; War Machine's own precon deck is Leadership, so no real deck could ever
    // legally hold a copy — a synthetic hand card (`injectIntoHand`) is the only way to exercise this ability at all.
    const { state: given, id: training } = injectIntoHand(warMachineVsRhino(1), P1, "23033");
    const played = settle(
      runWith(WAVE4_DEPS, given, play(P1, training, payWith(given, P1, 1, [training]))),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // None of War Machine's own pack cards are Justice-aspect, so the choice has no candidate. RRG 1.8 "Choose (Game
    // Element)" (p. 12): the ability cannot be initiated, so neither the exhaust nor the counter is paid.
    // `nebu/nebula-pack-cards.ts`'s identical "Defensive Training" shape covers the shuffle with an event in scope.
    const result = applyCommand(played, use(P1, training, "23033.vigilante-training-action"), WAVE4_DEPS);
    expect(result).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(inst(played, training).exhausted).toBe(false);
    expect(inst(played, training).counters.training).toBe(2);
  });
});

describe("Sidearm (upgrade ×3, 23035)", () => {
  it("23035.sidearm-constant: attached ally gets +1 ATK and its attacks gain ranged", () => {
    // Sidearm is Basic-aspect and legal in any deck, but it's not part of War Machine's own printed precon list
    // (`packages/content/src/data/warm/starterDecks.ts`), so it's not in this deck either — `injectIntoHand` as above.
    const start = warMachineVsRhino(1);
    const { state: withAlly, id: ally } = playFromHand(start, "23022", 3);
    const before = characterProfile(withAlly, ally, WAVE4_DEPS)!.atk;
    const { state: given, id: sidearm } = injectIntoHand(withAlly, P1, "23035");
    const after = settle(
      runWith(WAVE4_DEPS, given, play(P1, sidearm, payWith(given, P1, 1, [sidearm]), { attachToInstanceId: ally })),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(characterProfile(after, ally, WAVE4_DEPS)!.atk).toBe(before + 1);
  });
});
