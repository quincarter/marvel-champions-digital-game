import { characterProfile, hasKeyword, keywordTotal, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, instancesOf, P1, playerOf } from "../../testing/harness.js";
import { WAVE4_DEPS } from "../testing.js";
import {
  attachedTo,
  cleanGame,
  damageDealt,
  deckId,
  encounterCardInVillainArea,
  eventsFrom,
  minionEngagedWith,
  patchInstance,
  playerCardInPlay,
  revealedCodes,
  villainId,
  villainPhaseWith,
  withHand,
} from "./testing.js";

/**
 * Real-game tests for the refs The Hood's modules left unscripted until docs/phase7-wave4.md §3.52–§3.59, each staged
 * in a villain phase with exact numbers. The Hood (I) has ATK 1; Upper Hand (24013) is the one-icon boost filler and
 * Established Dominance (24007) a quiet card (it only attaches to P1).
 *
 * Ref -> covering test:
 *  24014.beast-mode-forced-interrupt       -> "Beast Mode ..."
 *  24016.mandrill-constant                 -> "Mandrill ..."
 *  24023.when-revealed / 24023.boost       -> "Out for Blood ..."
 *  24024.controller-forced-interrupt       -> "Controller ..."
 *  24025.when-revealed (its "exhausted this way") -> "Corruptor ..."
 *  24037.flamethrower-constant / -2        -> "Flamethrower ..."
 *  24038.holoshield-generator-constant     -> "Holoshield Generator ..."
 *  24039.jetpack-constant / 24040.tech-gauntlets-constant -> "Jetpack / Tech Gauntlets ..."
 *  24042.when-revealed                     -> "Crime Pays ..."
 *  24047.boost                             -> "White Rabbit ..."
 *  24055.when-revealed                     -> "Feisty Heist ..."
 *  24059.when-revealed / 24059.boost       -> "Citywide Crisis ..."
 *  24061.when-revealed / 24061.secret-lair-constant / -2 -> "Secret Lair ..."
 */

const BOOST = "24013";
const QUIET = "24007";
const hero = (state: GameState) => identityOf(state, P1);
const inPlayOf = (state: GameState, code: string) =>
  instancesOf(state, code).filter(
    (id) =>
      state.villainArea.includes(id) ||
      state.players.some((p) => p.playArea.includes(id)) ||
      state.instances[id]!.attachedTo !== null,
  );

describe("Beast Mode (24014)", () => {
  const withBeastMode = () => encounterCardInVillainArea(cleanGame({ fold: ["beasty_boys"] }), "24014").state;

  it("24014.beast-mode-forced-interrupt: a stunned hero attacked by The Hood takes 1 more (ATK 1 + 1 boost + 1)", () => {
    const stunned = patchInstance(withBeastMode(), hero(withBeastMode()), {
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const { events } = villainPhaseWith(stunned, [BOOST, QUIET]);
    expect(events.filter((e) => e.type === "damageIncreased")).toEqual([
      { type: "damageIncreased", targetInstanceId: hero(stunned), amount: 1 },
    ]);
    expect(damageDealt(eventsFrom(events, villainId(stunned)))).toEqual([[hero(stunned), 3]]);
  });

  it("24014.beast-mode-forced-interrupt: a hero with no status takes the attack as is", () => {
    const base = withBeastMode();
    const { events } = villainPhaseWith(base, [BOOST, QUIET]);
    expect(events.some((e) => e.type === "damageIncreased")).toBe(false);
    expect(damageDealt(eventsFrom(events, villainId(base)))).toEqual([[hero(base), 2]]);
  });

  it("24014.beast-mode-forced-interrupt: with steady (Warehouse District), one stun card is not stunned", () => {
    const base = cleanGame({ fold: ["beasty_boys", "streets_of_mayhem"] });
    const staged = encounterCardInVillainArea(encounterCardInVillainArea(base, "24014").state, "24063").state;
    const stunned = patchInstance(staged, hero(staged), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { events } = villainPhaseWith(stunned, [BOOST, QUIET]);
    expect(events.some((e) => e.type === "damageIncreased")).toBe(false);
    expect(damageDealt(eventsFrom(events, villainId(stunned)))).toEqual([[hero(stunned), 2]]);
  });
});

describe("Mandrill (24016)", () => {
  it("24016.mandrill-constant: retaliate X, X the confused characters in play (friendly or enemy)", () => {
    const base = cleanGame({ fold: ["beasty_boys"] });
    const mandrill = minionEngagedWith(base, "24016", P1);
    expect(hasKeyword(mandrill.state, mandrill.id, "retaliate", WAVE4_DEPS)).toBe(false);
    const confused = (state: GameState, id: InstanceId) =>
      patchInstance(state, id, { statuses: { ...state.instances[id]!.statuses, confused: 1 } });
    const one = confused(mandrill.state, hero(mandrill.state));
    expect(keywordTotal(one, mandrill.id, "retaliate", WAVE4_DEPS)).toBe(1);
    const two = confused(one, villainId(one));
    expect(keywordTotal(two, mandrill.id, "retaliate", WAVE4_DEPS)).toBe(2);
  });
});

describe("Out for Blood (24023)", () => {
  /** Black Cat (2 hit points) at 1 remaining beside Spider-Man (10). */
  const withCat = () => {
    const base = cleanGame({ fold: ["crossfire_crew"] });
    const cat = playerCardInPlay(base, "01002");
    return { state: patchInstance(cat.state, cat.id, { damage: 1 }), cat: cat.id };
  };

  it("24023.when-revealed: 1 damage defeats Black Cat, so it repeats onto Spider-Man, who survives, and stops", () => {
    const { state, cat } = withCat();
    const { state: after, events, staged } = villainPhaseWith(state, [BOOST, "24023"]);
    const card = staged.encounterDecks[deckId(staged)]!.deck[1]!;
    expect(damageDealt(eventsFrom(events, card))).toEqual([
      [cat, 1],
      [hero(state), 1],
    ]);
    expect(playerOf(after, P1).discard).toContain(cat);
  });

  it("24023.boost: as The Hood's boost card it resolves its own When Revealed", () => {
    const { state, cat } = withCat();
    const { events, staged } = villainPhaseWith(state, ["24023", QUIET]);
    const card = staged.encounterDecks[deckId(staged)]!.deck[0]!;
    expect(damageDealt(eventsFrom(events, card))).toEqual([
      [cat, 1],
      [hero(state), 1],
    ]);
  });
});

describe("Corruptor (24025)", () => {
  it("24025.when-revealed: only an ally exhausted this way places threat (one ready, one already exhausted: 1)", () => {
    const base = cleanGame({ fold: ["crossfire_crew"] });
    const cat = playerCardInPlay(base, "01002");
    const dd = playerCardInPlay(cat.state, "01058");
    // Daredevil defends The Hood's attack (exhausting him) before Corruptor is revealed; Black Cat is still ready.
    const { state, events } = villainPhaseWith(dd.state, [BOOST, "24025"], { defenders: [dd.id] });
    const corruptor = inPlayOf(state, "24025")[0]!;
    const placed = eventsFrom(events, corruptor).flatMap((e) => (e.type === "threatPlaced" ? [e.amount] : []));
    expect(placed).toEqual([1]);
    expect(state.instances[cat.id]!.exhausted).toBe(true);
  });
});

describe("Controller (24024)", () => {
  it("24024.controller-forced-interrupt: undefended, Controller's ATK 1 plus Spider-Man's ATK 2 is 3 damage", () => {
    const base = cleanGame({ fold: ["crossfire_crew"] });
    const controller = minionEngagedWith(base, "24024", P1);
    const { events } = villainPhaseWith(controller.state, [BOOST, QUIET]);
    expect(events.filter((e) => e.type === "damageIncreased")).toEqual([
      { type: "damageIncreased", targetInstanceId: hero(base), amount: 2 },
    ]);
    expect(damageDealt(eventsFrom(events, controller.id))).toEqual([[hero(base), 3]]);
  });

  it("24024.controller-forced-interrupt: defended by Daredevil (ATK 2), the increase is Daredevil's ATK", () => {
    const base = cleanGame({ fold: ["crossfire_crew"] });
    const dd = playerCardInPlay(base, "01058");
    const controller = minionEngagedWith(dd.state, "24024", P1);
    const { events } = villainPhaseWith(controller.state, [BOOST, QUIET], { defenders: ["decline", dd.id] });
    expect(damageDealt(eventsFrom(events, controller.id))).toEqual([[dd.id, 3]]);
  });
});

describe("Ransacked Armory attach fallbacks (24037-24040)", () => {
  it("24037.flamethrower-constant-2: the attached minion's attack is indirect damage P1 assigns (Armored Guard ATK 1 + 3)", () => {
    const base = cleanGame({ fold: ["ransacked_armory"] });
    const guard = minionEngagedWith(base, "24041", P1);
    const armed = attachedTo(guard.state, "24037", guard.id);
    const cat = playerCardInPlay(armed.state, "01002");
    const prompts: number[] = [];
    const { state: after } = villainPhaseWith(cat.state, [BOOST, QUIET], {
      pick: (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "assignIndirectDamage") prompts.push(choice.prompt.amount);
        return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      },
    });
    expect(prompts).toEqual([4]);
    const taken = after.instances[hero(after)]!.damage + (after.instances[cat.id]?.damage ?? 0);
    // The Hood's own 2 on Spider-Man, then the Guard's 4 indirect between Spider-Man and Black Cat (defeated at 2).
    expect(taken + (playerOf(after, P1).discard.includes(cat.id) ? 2 : 0)).toBe(2 + 4);
  });

  it("24037.flamethrower-constant: with no minion in play, it finds one in the encounter deck, which enters engaged with P1, and attaches to it", () => {
    const base = cleanGame({ fold: ["ransacked_armory"] });
    const { state } = villainPhaseWith(base, [BOOST, "24037"]);
    const flamethrower = inPlayOf(state, "24037")[0]!;
    const host = state.instances[flamethrower]!.attachedTo!;
    expect(state.instances[host]!.engagedWith).toBe(P1);
    expect(playerOf(state, P1).playArea).toContain(host);
  });

  it("24038.holoshield-generator-constant: the same search, and the found host gets +4 hit points", () => {
    const base = cleanGame({ fold: ["ransacked_armory"] });
    const { state } = villainPhaseWith(base, [BOOST, "24038"]);
    const holo = inPlayOf(state, "24038")[0]!;
    const host = state.instances[holo]!.attachedTo!;
    const printed = state.cardPool[state.instances[host]!.cardId]!;
    expect(characterProfile(state, host, WAVE4_DEPS)!.maxHp).toBe(("hp" in printed ? printed.hp : 0) + 4);
  });

  it("24039.jetpack-constant / 24040.tech-gauntlets-constant: with no minion in play each is discarded and surges", () => {
    for (const code of ["24039", "24040"]) {
      const base = cleanGame({ fold: ["ransacked_armory"] });
      const { events } = villainPhaseWith(base, [BOOST, code, QUIET]);
      expect(revealedCodes(events)).toEqual([code, QUIET]);
    }
  });

  it("24039.jetpack-constant: with a minion in play it attaches and does not surge", () => {
    const base = cleanGame({ fold: ["ransacked_armory"] });
    const guard = minionEngagedWith(base, "24041", P1);
    const { state, events } = villainPhaseWith(guard.state, [BOOST, "24039", QUIET]);
    expect(revealedCodes(events)).toEqual(["24039"]);
    expect(state.instances[inPlayOf(state, "24039")[0]!]!.attachedTo).toBe(guard.id);
  });
});

describe("Crime Pays (24042)", () => {
  it("24042.when-revealed: a Criminal minion from the encounter deck enters play engaged with P1; no surge", () => {
    const base = cleanGame({ fold: ["sinister_syndicate"] });
    const { state, events } = villainPhaseWith(base, [BOOST, "24042", QUIET]);
    expect(revealedCodes(events)).toEqual(["24042"]);
    const engaged = playerOf(state, P1).playArea.filter(
      (id) => state.cardPool[state.instances[id]!.cardId]!.type === "minion",
    );
    expect(engaged).toHaveLength(1);
    const minion = state.cardPool[state.instances[engaged[0]!]!.cardId]!;
    expect("traits" in minion ? minion.traits : []).toContain("CRIMINAL");
  });

  it("24042.when-revealed: with no Criminal minion left in the deck nothing enters and it surges", () => {
    const base = cleanGame({ fold: ["sinister_syndicate"] });
    const id = deckId(base);
    const pile = base.encounterDecks[id]!;
    const isCriminalMinion = (i: InstanceId) => {
      const card = base.cardPool[base.instances[i]!.cardId]!;
      return card.type === "minion" && card.traits.includes("CRIMINAL" as never);
    };
    const noCriminals: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [id]: {
          deck: pile.deck.filter((i) => !isCriminalMinion(i)),
          discard: [...pile.discard, ...pile.deck.filter(isCriminalMinion)],
        },
      },
    };
    const { state, events } = villainPhaseWith(noCriminals, [BOOST, "24042", QUIET]);
    // The search shuffles the deck, so the surge card is whatever is on top then.
    expect(revealedCodes(events)).toHaveLength(2);
    expect(revealedCodes(events)[0]).toBe("24042");
    expect(
      playerOf(state, P1).playArea.some((i) => state.cardPool[state.instances[i]!.cardId]!.type === "minion"),
    ).toBe(false);
  });
});

describe("White Rabbit (24047)", () => {
  it("24047.boost: P1 discards exactly one card, an identity-specific (Spider-Man) one", () => {
    // Web-Shooter (01008) is a Spider-Man card; Energy, Genius, Strength (01088-01090) and Helicarrier (01092) are not.
    // A full hand of 5 (Spider-Man's hand size), so the end of the player phase draws nothing.
    const base = withHand(cleanGame({ fold: ["sinister_syndicate"] }), ["01088", "01092", "01008", "01089", "01090"]);
    const { state } = villainPhaseWith(base, ["24047", QUIET]);
    expect(playerOf(state, P1).discard.map((i) => state.instances[i]!.cardId as string)).toEqual(["01008"]);
  });
});

describe("Feisty Heist (24055)", () => {
  it("24055.when-revealed: discards the highest-cost card from P1's hand (Avengers Mansion, cost 4)", () => {
    // A full hand of 5, so the end of the player phase draws nothing.
    const base = withHand(cleanGame({ fold: ["state_of_emergency"] }), ["01006", "01091", "01092", "01088", "01089"]);
    const { state } = villainPhaseWith(base, [BOOST, "24055"]);
    expect(playerOf(state, P1).discard.map((i) => state.instances[i]!.cardId as string)).toEqual(["01091"]);
    expect(playerOf(state, P1).hand).toHaveLength(4);
  });

  it("24055.when-revealed: a tie discards exactly one of the tied cards", () => {
    // Helicarrier (3) and Swinging Web Kick (3) tie; Aunt May (1) stays.
    const base = withHand(cleanGame({ fold: ["state_of_emergency"] }), ["01006", "01092", "01005", "01088", "01089"]);
    const { state } = villainPhaseWith(base, [BOOST, "24055"]);
    const discarded = playerOf(state, P1).discard.map((i) => state.instances[i]!.cardId as string);
    expect(discarded).toHaveLength(1);
    expect(["01092", "01005"]).toContain(discarded[0]);
  });
});

describe("Citywide Crisis (24059)", () => {
  it("24059.when-revealed: Disaster at the Docks' When Revealed resolves again (3 damage to Spider-Man), so no threat", () => {
    const base = cleanGame({ fold: ["state_of_emergency"] });
    const docks = encounterCardInVillainArea(base, "24056", 3);
    const { state, events, staged } = villainPhaseWith(docks.state, [BOOST, "24059"]);
    expect(damageDealt(eventsFrom(events, docks.id))).toEqual([[hero(base), 3]]);
    expect(state.instances[docks.id]!.threat).toBe(3);
    const card = staged.encounterDecks[deckId(staged)]!.deck[1]!;
    expect(eventsFrom(events, card).some((e) => e.type === "threatPlaced")).toBe(false);
    expect(revealedCodes(events)).toEqual(["24059"]);
  });

  // §4 Q23 (user decision 2026-09-25): only printed When Revealed abilities are resolved and counted.
  it("24059.when-revealed: the Docks' printed ability resolves and counts; Beast Mode (no When Revealed) adds nothing", () => {
    const base = cleanGame({ fold: ["state_of_emergency", "beasty_boys"] });
    const docks = encounterCardInVillainArea(base, "24056", 3);
    const beastMode = encounterCardInVillainArea(docks.state, "24014", 4);
    const { state, events, staged } = villainPhaseWith(beastMode.state, [BOOST, "24059"]);
    const card = staged.encounterDecks[deckId(staged)]!.deck[1]!;
    expect(damageDealt(eventsFrom(events, docks.id))).toEqual([[hero(base), 3]]);
    expect(eventsFrom(events, card).some((e) => e.type === "threatPlaced")).toBe(false);
    expect(state.instances[docks.id]!.threat).toBe(3);
    expect(state.instances[beastMode.id]!.threat).toBe(4);
    expect(revealedCodes(events)).toEqual(["24059"]);
  });

  it("24059.when-revealed: with no When Revealed on the side schemes in play, 2 threat on each scheme", () => {
    const base = cleanGame({ fold: ["state_of_emergency"] });
    const ambition = encounterCardInVillainArea(base, "24011", 4); // Unbridled Ambition: hinder only.
    const { events, staged } = villainPhaseWith(ambition.state, [BOOST, "24059"]);
    const card = staged.encounterDecks[deckId(staged)]!.deck[1]!;
    const placed = eventsFrom(events, card).flatMap((e) =>
      e.type === "threatPlaced" ? [[e.schemeInstanceId, e.amount]] : [],
    );
    expect(placed).toEqual([
      [base.mainScheme.instanceId, 2],
      [ambition.id, 2],
    ]);
  });

  it("24059.boost: as The Hood's boost card it resolves its own When Revealed (the Docks deal 3 again)", () => {
    const base = cleanGame({ fold: ["state_of_emergency"] });
    const docks = encounterCardInVillainArea(base, "24056", 3);
    const { events } = villainPhaseWith(docks.state, ["24059", QUIET]);
    expect(damageDealt(eventsFrom(events, docks.id))).toEqual([[hero(base), 3]]);
  });
});

describe("Secret Lair (24061)", () => {
  const streets = ["streets_of_mayhem", "sinister_syndicate"];

  it("24061.when-revealed: discards each other Setting environment in play (Back-Alley Enclave)", () => {
    const base = cleanGame({ fold: streets });
    const enclave = encounterCardInVillainArea(base, "24060");
    const { state } = villainPhaseWith(enclave.state, [BOOST, "24061", QUIET]);
    expect(state.villainArea).not.toContain(enclave.id);
    expect(inPlayOf(state, "24061")).toHaveLength(1);
  });

  it("24061.secret-lair-constant: each enemy is an acceleration icon: step one places 2 more with The Hood and a minion", () => {
    const stepOne = (state: GameState) => {
      const { events } = villainPhaseWith(state, [BOOST, QUIET]);
      const placed = events.find(
        (e) =>
          e.type === "threatPlaced" &&
          e.sourceInstanceId === null &&
          e.schemeInstanceId === state.mainScheme.instanceId,
      );
      return placed?.type === "threatPlaced" ? placed.amount : -1;
    };
    const base = minionEngagedWith(cleanGame({ fold: streets }), "24043", P1).state; // Beetle.
    const lair = encounterCardInVillainArea(base, "24061").state;
    expect(stepOne(lair) - stepOne(base)).toBe(2);
  });

  it("24061.secret-lair-constant-2: each hero and ally gets +1 THW", () => {
    const base = cleanGame({ fold: streets });
    const before = characterProfile(base, hero(base), WAVE4_DEPS)!.thw;
    const lair = encounterCardInVillainArea(base, "24061").state;
    expect(characterProfile(lair, hero(lair), WAVE4_DEPS)!.thw).toBe(before + 1);
  });
});
