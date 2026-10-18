import { activeEncounterDeck, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
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
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { minionEngaged, pooled } from "../../testing/wave10-engine-qa-bench.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

// Real wave 2 content: the Scarlet Witch (Justice) precon against Rhino, standard, solo. Wanda starts in alter-ego.
const scwVsRhino = () =>
  startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 }));

/**
 * Accepts the named optional responses/interrupts (a trigger's option id is `<instance>:<ability>`) and picks the
 * named targets; declines everything else (`docs/phase7-wave2-scripting.md` §5's `accepting` convention).
 */
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

/** A `chooseOption` prompt's own option ids are index-based, never the label — match by label text instead. */
const pickingLabel =
  (label: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseOption") {
      const option = choice.options.find((o) => o.label === label);
      if (option) return [option.optionId];
    }
    return firstLegal(state);
  };

describe("Scarlet Witch kit", () => {
  it("Chaos Control: replaces a boost-step count with a freshly discarded card's own icons (Limit once per phase)", () => {
    // Rhino I ATK 2. Boost card dealt for the attack (Advance, 01186, 0 icons); the very next encounter card
    // (Hydra Mercenary, 01101, 1 icon, "Rhino's own set") is what Chaos Control discards-and-counts instead.
    const hero = runWave2(scwVsRhino(), toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const stacked = stackEncounterDeck(hero, "01186", "01101");

    const after = settle(runWave2(stacked, endTurn()), accepting("15001a.chaos-control"), undefined, WAVE2_DEPS);
    // Printed ATK 2 + the replaced count's 1 icon = 3, not 2 + 0 (declined defense: undefended).
    expect(inst(after, identity).damage).toBe(damageBefore + 3);
  });

  it("Superpowered Siblings: discards 2 and draws 2, or 3 if Quicksilver is in play (limit once per round)", () => {
    const start = scwVsRhino(); // alter-ego already
    const handBefore = playerOf(start, P1).hand.length;
    const [d1, d2] = playerOf(start, P1).hand as readonly InstanceId[];
    const withoutQuicksilver = settle(
      runWave2(start, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(start),
        abilityId: "15001b.superpowered-siblings" as never,
        payment: [],
        costChoices: { discard: [d1!, d2!] },
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(withoutQuicksilver, P1).hand.length).toBe(handBefore); // -2 discarded, +2 drawn: net 0.

    const { state: withQuicksilver } = playFromHand(scwVsRhino(), "15002", 4);
    const handBeforeQ = playerOf(withQuicksilver, P1).hand.length;
    const [q1, q2] = playerOf(withQuicksilver, P1).hand as readonly InstanceId[];
    const withSiblings = settle(
      runWave2(withQuicksilver, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: identityOf(withQuicksilver),
        abilityId: "15001b.superpowered-siblings" as never,
        payment: [],
        costChoices: { discard: [q1!, q2!] },
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(withSiblings, P1).hand.length).toBe(handBeforeQ + 1); // -2 discarded, +3 drawn: net +1.
  });

  it("Quicksilver (ally): Action, ready him (limit once per phase)", () => {
    const { state } = playFromHand(scwVsRhino(), "15002", 4);
    const quicksilver = instancesOf(state, "15002")[0]!;
    const exhausted = {
      ...state,
      instances: { ...state.instances, [quicksilver]: { ...state.instances[quicksilver]!, exhausted: true } },
    };
    const readied = settle(
      runWave2(exhausted, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: quicksilver,
        abilityId: "15002.quicksilver-action" as never,
        payment: [],
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(readied, quicksilver).exhausted).toBe(false);
  });

  it("Chaos Magic: plays a card from hand ignoring its cost, then discards cards from the encounter deck equal to that card's printed cost", () => {
    const given = moveToHand(runWave2(scwVsRhino(), toHero()), P1, "15003", "15008"); // Chaos Magic + Magic Shield (cost 1)
    const [chaosMagic, magicShield] = given.ids as [InstanceId, InstanceId];
    const pickMagicShield: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseCards") {
        const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === magicShield);
        if (option) return [option.optionId];
      }
      return firstLegal(state);
    };
    const stacked = stackEncounterDeck(given.state, "01186"); // the one card Chaos Magic discards for Magic Shield's cost 1
    const handBefore = playerOf(stacked, P1).hand.length;
    const discardBefore = activeEncounterDeck(stacked).discard.length;
    const played = settle(runWave2(stacked, play(P1, chaosMagic, [])), pickMagicShield, undefined, WAVE2_DEPS);
    expect(playerOf(played, P1).hand.length).toBe(handBefore - 2); // Chaos Magic + Magic Shield left hand; nothing paid.
    expect(cardsInPlay(played)).toContain(magicShield);
    expect(activeEncounterDeck(played).discard.length).toBe(discardBefore + 1); // Magic Shield's printed cost is 1.
  });

  /**
   * Spider-Tracer (01007, cost 1, "Attach to a minion.") relabeled onto a deck card by surgery, so Chaos Magic's hand
   * holds an upgrade that names its own host (docs/phase7-wave11.md §3.2 broadened the ignore-cost play to such
   * upgrades: RRG 1.8 "Attach To", p. 8, and "Ignore", p. 23). `minions` Hydra Mercenaries (01101) engaged with P1.
   */
  const chaosWithTracer = (minions: number) => {
    const given = moveToHand(runWave2(scwVsRhino(), toHero()), P1, "15003");
    const spare = playerOf(given.state, P1).deck[0]!;
    const tracer = pooled(given.state, "01007");
    let state: GameState = patchInstance(tracer.state, spare, { cardId: tracer.cardId });
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: [...p.hand, spare], deck: p.deck.filter((i) => i !== spare) } : p,
      ),
    };
    const engaged: InstanceId[] = [];
    for (let n = 0; n < minions; n += 1) {
      const placed = minionEngaged(state, "01101");
      state = placed.state;
      engaged.push(placed.id);
    }
    return { state, chaosMagic: given.ids[0]!, tracer: spare, engaged };
  };

  it("Chaos Magic on an upgrade that attaches to a minion: the player picks between two engaged minions, then the encounter deck discards its cost", () => {
    const { state, chaosMagic, tracer, engaged } = chaosWithTracer(2);
    const second = engaged[1]!;
    const stacked = stackEncounterDeck(state, "01186");
    const top = activeEncounterDeck(stacked).deck[0]!;
    const hostsOffered: InstanceId[][] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      const ids = (choice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));
      if (choice?.prompt.kind === "chooseCards" && ids.includes(tracer))
        return [choice.options[ids.indexOf(tracer)]!.optionId];
      if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "playFromHandHost") {
        hostsOffered.push(ids);
        return [choice.options[ids.indexOf(second)]!.optionId];
      }
      return firstLegal(s);
    };
    const discardBefore = activeEncounterDeck(stacked).discard.length;
    const played = settle(runWave2(stacked, play(P1, chaosMagic, [])), pick, undefined, WAVE2_DEPS);
    expect(hostsOffered).toEqual([engaged]);
    expect(inst(played, second).attachments).toContain(tracer);
    expect(inst(played, engaged[0]!).attachments).not.toContain(tracer);
    // Spider-Tracer's printed cost is 1: one encounter card discarded, the top one.
    expect(activeEncounterDeck(played).discard).toHaveLength(discardBefore + 1);
    expect(activeEncounterDeck(played).discard).toContain(top);
  });

  it("Chaos Magic does not offer an upgrade that attaches to a minion while no minion is in play", () => {
    const { state, chaosMagic, tracer } = chaosWithTracer(0);
    const offered: InstanceId[][] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "playFromHand")
        offered.push(choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : [])));
      return firstLegal(s);
    };
    const played = settle(runWave2(state, play(P1, chaosMagic, [])), pick, undefined, WAVE2_DEPS);
    expect(offered.length).toBeGreaterThan(0);
    for (const cards of offered) expect(cards).not.toContain(tracer);
    expect(playerOf(played, P1).hand).toContain(tracer);
  });

  it("Hex Bolt: discards the top 3 cards, resolving a different bulleted ability per discarded card's own boost icons", () => {
    // Advance (01186, 0 icons) -> deal 2 damage to an enemy; Caught Off Guard (01188, 1 icon) -> remove 2 threat
    // from a scheme; Shadow of the Past (01190, 2 icons) -> draw 1 card. All three are Standard set cards, always
    // in a solo Core scenario's own deck regardless of villain.
    const hero = runWave2(scwVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    // Threat starts at 0 at the very start of the game, so "remove 2 threat" would have nothing to remove — place
    // 5 first so the removal is observable.
    const withNoDamage = {
      ...hero,
      instances: {
        ...hero.instances,
        [villain]: { ...hero.instances[villain]!, damage: 0 },
        [hero.mainScheme.instanceId]: { ...hero.instances[hero.mainScheme.instanceId]!, threat: 5 },
      },
    };
    const threatBefore = mainThreat(withNoDamage);
    const handBefore = playerOf(withNoDamage, P1).hand.length;
    const { state } = playFromHand(stackEncounterDeck(withNoDamage, "01186", "01188", "01190"), "15004", 2);
    expect(inst(state, villain).damage).toBe(2); // the 0-icon card's own "deal 2 damage to an enemy"
    expect(mainThreat(state)).toBe(threatBefore - 2); // the 1-icon card's "remove 2 threat"
    // +1 Hex Bolt dealt to hand, -1 played, -2 paid for it, +1 drawn (the 2-icon card's own "draw 1 card"): net -1.
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 1);
  });

  it("Hex Bolt: 3+ boost icons places a status card on a character", () => {
    // No card in Rhino's own solo pool naturally carries 3+ boost icons — a card pool patch (the same documented
    // technique `toafk/kang-encounter-set.test.ts` uses for its own 11021 test) stands in for a real 3-icon card,
    // stacked alongside two guaranteed-0-icon fillers (each also triggers "deal 2 damage to an enemy", harmless).
    const hero = runWave2(scwVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    const patched = { ...hero, cardPool: { ...hero.cardPool, "01186": { ...hero.cardPool["01186"]!, boostIcons: 3 } } };
    const identity = identityOf(patched);
    const { state } = playFromHand(stackEncounterDeck(patched, "01104", "01105", "01186"), "15004", 2);
    // "Advance" (01186) is now patched to 3 icons; "Hard to Keep Down" (01104) and the unnamed filler (01105) are
    // both genuinely 0 icons, each dealing 2 damage to the villain, so a status card landed on *some* character.
    expect(inst(state, villain).damage).toBe(4);
    const gotStatus = inst(state, identity).statuses.stunned > 0 || inst(state, villain).statuses.stunned > 0;
    expect(gotStatus).toBe(true);
  });

  // docs/phase7-wave2.md §4 Q8: a card effect's own count of boost icons on an encounter card opens the same "would
  // be counted" window an activation's boost step does (`countBoostIcons`).
  const hexBoltSetup = () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    const cleared = {
      ...hero,
      instances: {
        ...hero.instances,
        [villain]: { ...hero.instances[villain]!, damage: 0 },
        [hero.mainScheme.instanceId]: { ...hero.instances[hero.mainScheme.instanceId]!, threat: 5 },
      },
    };
    // Hex Bolt discards Advance (01186, 0 icons), Caught Off Guard (01188, 1) and Shadow of the Past (01190, 2);
    // Hydra Mercenary (01101, 1 icon) is the next card down, the one Chaos Control would discard.
    return { state: stackEncounterDeck(cleared, "01186", "01188", "01190", "01101"), villain };
  };

  it("Chaos Control: replaces one card's count in Hex Bolt, so that card resolves the bullet of the card counted instead", () => {
    const { state: start, villain } = hexBoltSetup();
    const threatBefore = mainThreat(start);
    const discardBefore = activeEncounterDeck(start).discard.length;
    const { state } = playFromHand(start, "15004", 2, accepting("15001a.chaos-control"));
    // Advance's count (0 icons: "deal 2 damage to an enemy") is replaced by Hydra Mercenary's 1 icon: "remove 2
    // threat from a scheme", as Caught Off Guard's own bullet is. Limit once per phase: the other two count as printed.
    expect(inst(state, villain).damage).toBe(0);
    expect(mainThreat(state)).toBe(threatBefore - 4);
    // Hex Bolt's 3 cards plus the one Chaos Control discarded.
    expect(activeEncounterDeck(state).discard.length).toBe(discardBefore + 4);
  });

  it("Chaos Control: declined, Hex Bolt counts each discarded card's own icons and discards nothing more", () => {
    const { state: start, villain } = hexBoltSetup();
    const threatBefore = mainThreat(start);
    const discardBefore = activeEncounterDeck(start).discard.length;
    const { state } = playFromHand(start, "15004", 2);
    expect(inst(state, villain).damage).toBe(2);
    expect(mainThreat(state)).toBe(threatBefore - 2);
    expect(activeEncounterDeck(state).discard.length).toBe(discardBefore + 3);
  });

  it("Chaos Control: replaces one of Molecular Decay's two counts", () => {
    const { state: start, villain } = hexBoltSetup();
    // Advance (0) and Caught Off Guard (1) are discarded; Chaos Control then discards Shadow of the Past (2 icons)
    // and counts it instead of Advance: 5 + 2 + 1 = 8, not 5 + 0 + 1.
    const { state } = playFromHand(start, "15005", 3, accepting("enemy", "15001a.chaos-control"));
    expect(inst(state, villain).damage).toBe(8);
  });

  it("Molecular Decay: deals 5 damage to an enemy, plus 1 more for each boost icon among 2 discarded cards", () => {
    const hero = runWave2(scwVsRhino(), toHero());
    const villain = hero.villains[0]!.instanceId;
    const withNoDamage = {
      ...hero,
      instances: { ...hero.instances, [villain]: { ...hero.instances[villain]!, damage: 0 } },
    };
    // Advance (01186, 0) + Caught Off Guard (01188, 1): 5 + 0 + 1 = 6.
    const { state } = playFromHand(stackEncounterDeck(withNoDamage, "01186", "01188"), "15005", 3, accepting("enemy"));
    expect(inst(state, villain).damage).toBe(6);
  });

  it("Warp Reality: cancels a revealed encounter card's effects and discards it, plus more equal to its own boost icons", () => {
    // Advance (01186, 0 icons) as Rhino's own boost card for its attack; Caught Off Guard (01188, 1 icon) as the
    // very next card — the player's own dealt encounter card for this villain phase — which Warp Reality's
    // interrupt cancels and discards, then discards Shadow of the Past (01190, 1 more, its own icon count).
    const given = moveToHand(runWave2(scwVsRhino(), toHero()), P1, "15006");
    const stacked = stackEncounterDeck(given.state, "01186", "01188", "01190");
    const discardBefore = activeEncounterDeck(stacked).discard.length;
    const acceptAndPay: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
      return accepting("15006.warp-reality-interrupt")(state);
    };
    const after = settle(runWave2(stacked, endTurn()), acceptAndPay, undefined, WAVE2_DEPS);
    const discard = activeEncounterDeck(after).discard;
    expect(discard.length).toBeGreaterThanOrEqual(discardBefore + 2); // Caught Off Guard itself, plus 1 more (its own icon count).
  });

  it("Agatha Harkness: looks at the top 3, keeps 1, places the other 2 on the bottom of the deck (any order)", () => {
    const { state, id: agatha } = playFromHand(scwVsRhino(), "15007", 1);
    const deckBefore = playerOf(state, P1).deck;
    const top3 = deckBefore.slice(0, 3);
    const handBefore = playerOf(state, P1).hand.length;
    const used = settle(
      runWave2(state, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: agatha,
        abilityId: "15007.agatha-harkness-action" as never,
        payment: [],
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(used, P1).hand.length).toBe(handBefore + 1); // 1 of the 3 added to hand
    const deckAfter = playerOf(used, P1).deck;
    const bottom2 = deckAfter.slice(-2);
    // The other 2 of the original top 3 ended up on the bottom (in some order); none of the 3 is still on top.
    expect(bottom2.every((id) => top3.includes(id))).toBe(true);
    expect(top3.some((id) => deckAfter.slice(0, deckAfter.length - 2).includes(id))).toBe(false);
  });

  it("Magic Shield: Hero Interrupt, discard it to prevent 3 damage to a friendly character", () => {
    const { state: withShield, id: shield } = playFromHand(runWave2(scwVsRhino(), toHero()), "15008", 1);
    const villain = withShield.villains[0]!.instanceId;
    const identity = identityOf(withShield);
    const stacked = stackEncounterDeck(withShield, "01186");
    const damageBefore = inst(stacked, identity).damage;
    const villainDamageBefore = inst(stacked, villain).damage;
    const undefended = settle(
      runWave2(stacked, endTurn()),
      accepting("15008.magic-shield-interrupt"),
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(undefended, identity).damage).toBe(damageBefore); // fully prevented (Rhino's 2 ATK < the 3 prevented)
    expect(playerOf(undefended, P1).discard).toContain(shield);
    expect(inst(undefended, villain).damage).toBe(villainDamageBefore);
  });

  it("Scarlet Witch's Crest: exhaust it to increase or decrease a boost count by 1", () => {
    const { state: withCrest } = playFromHand(runWave2(scwVsRhino(), toHero()), "15009", 2);
    const identity = identityOf(withCrest);
    const withNoDamage = {
      ...withCrest,
      instances: { ...withCrest.instances, [identity]: { ...withCrest.instances[identity]!, damage: 0 } },
    };
    // Hydra Mercenary (01101, 1 icon) as the boost card; Crest increases the count by 1, so the attack deals
    // Rhino's ATK 2 + (1 + 1) = 4 undefended, instead of 2 + 1 = 3.
    const stacked = stackEncounterDeck(withNoDamage, "01101");
    const acceptAndIncrease: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption") return pickingLabel("Increase by 1")(state);
      return accepting("15009.scarlet-witchs-crest-interrupt")(state);
    };
    const after = settle(runWave2(stacked, endTurn()), acceptAndIncrease, undefined, WAVE2_DEPS);
    expect(inst(after, identity).damage).toBe(4);
  });
});

// FFG ruling #106 (post-RRG 1.5, Oct 26, 2023): "you can choose which order to resolve the cards discarded by
// Hex Bolt". Each discarded card's line counts its own boost icons as its turn comes; Chaos Control's once-per-phase
// replacement lands on whichever card the player resolves first, which makes the order observable.
describe("Hex Bolt: the player orders the discarded cards", () => {
  it("offers the three discarded cards and resolves the one chosen first", () => {
    const hero = runWave2(
      startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "scw-justice" }], seed: 2026 })),
      toHero(),
    );
    const villain = hero.villains[0]!.instanceId;
    identityOf(hero);
    const cleared = {
      ...hero,
      instances: {
        ...hero.instances,
        [villain]: { ...hero.instances[villain]!, damage: 0 },
        [hero.mainScheme.instanceId]: { ...hero.instances[hero.mainScheme.instanceId]!, threat: 5 },
      },
    };
    // Advance (0 icons), Caught Off Guard (1), Shadow of the Past (2); Hydra Mercenary (1) is what Chaos Control takes.
    const start = stackEncounterDeck(cleared, "01186", "01188", "01190", "01101");
    const threatBefore = mainThreat(start);
    const handBefore = playerOf(start, P1).hand.length;
    const discardBefore = activeEncounterDeck(start).discard.length;
    let offered = 0;
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      const shadow = choice.options.find((o) => state.instances[o.optionId as InstanceId]?.cardId === "01190");
      if (shadow && choice.options.length === 3) {
        offered = choice.options.length;
        return [shadow.optionId];
      }
      const cc = choice.options.find((o) => o.optionId.endsWith(":15001a.chaos-control"));
      return cc ? [cc.optionId] : firstLegal(state);
    };
    const { state } = playFromHand(start, "15004", 2, pick);
    expect(offered).toBe(3);
    // Shadow of the Past resolved first, so Chaos Control counted Hydra Mercenary (1 icon) for it: remove 2 threat, no
    // draw. Then Advance (deal 2 damage) and Caught Off Guard (remove 2 threat) count as printed.
    expect(inst(state, villain).damage).toBe(2);
    expect(mainThreat(state)).toBe(threatBefore - 4);
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 2); // +1 dealt, -1 played, -2 paid, no card drawn
    expect(activeEncounterDeck(state).discard.length).toBe(discardBefore + 4);
  });
});
