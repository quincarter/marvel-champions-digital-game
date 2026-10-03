import {
  allyLimitFor,
  applyCommand,
  activeEncounterDeck,
  cardsInPlay,
  hasKeyword,
  iconsInPlay,
  iconsOn,
  legalActions,
  playCostOf,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  alterEgoAction,
  chosen,
  constant,
  discard,
  each,
  encounterCards,
  exhaustThis,
  query,
  revealCard,
  selectCards,
  whenRevealed,
} from "../../dsl/index.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, moveToDiscard } from "../../testing/staging.js";
import { intoPlayArea } from "../mut_gen/magneto-testing.js";
import { SITCOM_ABILITIES } from "./sitcom.js";
import {
  FILLER_2,
  NO_BOOST,
  inEncounterPiles,
  playAreaOf,
  revealInVillainPhase,
  sitcomGame,
} from "./sitcom-testing.js";
import { withHand } from "./western-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const MOJO_IN_THE_MIDDLE = "39060";
const FAMILY_MATTERS = "39061";
const GROWING_PAINS = "39062";
const ODD_COUPLE = "39063";
const BREAKUP = "39064";
const WATCH_ME_PLAY = "39065";
const DIAL_M = "39035";
const AUNT_MAY = "01006";
const INTERROGATION_ROOM = "01063";
const SURVEILLANCE_TEAM = "01064";
const SUPERHUMAN_LAW_DIVISION = "01026";
const AVENGERS_MANSION = "01091";
const BLACK_CAT = "01002";
const SPIDER_TRACER = "01007";
const WEB_SHOOTER = "01008";
const TENACITY = "01093";
const HEROIC_INTUITION = "01065";
const FOCUSED_RAGE = "01027";
const JESSICA_JONES = "01059";
const DAREDEVIL = "01058";

const SPIDER_MAN = "core-spider-man-justice";
const SHE_HULK = "core-she-hulk-aggression";
const duo = { players: [{ starterDeckId: SPIDER_MAN }, { starterDeckId: SHE_HULK }] };

const hand = (state: GameState, player: PlayerId = P1) => playerOf(state, player).hand;

/** The instance of `code` in `player`'s play area. */
const obligationOf = (state: GameState, code: string, player: PlayerId = P1): InstanceId => {
  const id = playAreaOf(state, player).find((i) => inst(state, i).cardId === cardId(code));
  if (!id) throw new Error(`${code} is not in ${player}'s play area`);
  return id;
};
const inEncounterDiscard = (state: GameState, id: InstanceId) => activeEncounterDeck(state).discard.includes(id);

/** Alone, `code` is revealed in the villain phase; the game is back in the next round's player phase (alter-ego form). */
const withObligation = (code: string, options: Parameters<typeof sitcomGame>[0] = {}) => {
  const revealed = revealInVillainPhase(sitcomGame(options), code);
  return { ...revealed, id: obligationOf(revealed.state, code) };
};
/** A two-player game where P1 is dealt `forP1` and P2 `forP2` in the villain phase. */
const withObligations = (
  forP1: string,
  forP2: string,
  options: Parameters<typeof sitcomGame>[0] = duo,
  active: PlayerId = P1,
) => {
  const revealed = revealInVillainPhase(sitcomGame(options), [forP1, forP2]);
  return {
    ...revealed,
    state: asActive(revealed.state, active),
    p1: obligationOf(revealed.state, forP1, P1),
    p2: obligationOf(revealed.state, forP2, P2),
  };
};

/** Picks, in order, the option whose id is the string or whose label matches the pattern (one entry per prompt). */
const pickInOrder = (...wanted: readonly (string | RegExp)[]): Picker => {
  let next = 0;
  return (state) => {
    const choice = state.pendingChoice!;
    const want = wanted[next++];
    const option = choice.options.find((o) =>
      typeof want === "string" ? o.optionId === want : want !== undefined && want.test(o.label),
    );
    if (!option)
      throw new Error(`no option for ${String(want)} among ${choice.options.map((o) => o.label).join(" | ")}`);
    return [option.optionId];
  };
};
/** Takes Mojo in the Middle's response whenever it is offered, otherwise lets `otherwise` answer. */
const takingTheDraw =
  (otherwise: Picker = firstLegal): Picker =>
  (state) => {
    const response = state.pendingChoice?.options.find((o) => o.optionId.includes("mojo-in-the-middle-response"));
    return response ? [response.optionId] : otherwise(state);
  };
/** It is `player`'s turn: the other players' turns are ended first (the first player passes each round). */
const asActive = (state: GameState, player: PlayerId): GameState =>
  state.step.phase === "player" && state.step.kind === "turn" && state.step.activePlayerId !== player
    ? run(state, { type: "endTurn", playerId: state.step.activePlayerId })
    : state;
const settled = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, deps);
const useAbility = (
  state: GameState,
  player: PlayerId,
  id: InstanceId,
  ability: string,
  costChoices?: Parameters<typeof use>[4],
  pick: Picker = firstLegal,
) => settled(run(state, use(player, id, ability, [], costChoices)), pick);
const refused = (
  state: GameState,
  player: PlayerId,
  id: InstanceId,
  ability: string,
  costChoices?: Parameters<typeof use>[4],
) => !applyCommand(state, use(player, id, ability, [], costChoices), deps).ok;

/** Both cards of each pair as ids from `player`'s hand or deck, brought into play (state surgery, no cost). */
const inPlayFor = (state: GameState, player: PlayerId, ...codes: readonly string[]) => {
  let current = state;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const put = intoPlayArea(current, player, code);
    current = put.state;
    ids.push(put.id);
  }
  return { state: current, ids };
};
const exhausted = (state: GameState, id: InstanceId) => inst(state, id).exhausted;

describe("registry", () => {
  it("scripts every ability ref of the Sitcom set", () => {
    expect(Object.keys(SITCOM_ABILITIES).sort()).toEqual(
      [
        "39060.mojo-in-the-middle-constant",
        "39060.mojo-in-the-middle-response",
        "39060.when-revealed",
        "39061.family-matters-constant",
        "39061.family-matters-action",
        "39062.growing-pains-constant",
        "39062.growing-pains-action",
        "39063.the-odd-couple-constant",
        "39063.the-odd-couple-action",
        "39064.the-one-with-the-breakup-constant",
        "39064.the-one-with-the-breakup-action",
        "39065.obligation",
        "39065.watch-me-play-forced-interrupt",
        "39065.watch-me-play-action",
      ].sort(),
    );
  });

  it("the set's six cards are in the game from data", () => {
    const state = sitcomGame();
    for (const code of [MOJO_IN_THE_MIDDLE, FAMILY_MATTERS, GROWING_PAINS, ODD_COUPLE, BREAKUP, WATCH_ME_PLAY])
      expect(inEncounterPiles(state, code), code).toHaveLength(1);
  });
});

describe("Mojo in the Middle (39060)", () => {
  const withMojo = (state: GameState) => encounterCardInVillainArea(state, MOJO_IN_THE_MIDDLE);

  it("reveals from the encounter deck: enters play and gains surge (the next card is revealed too)", () => {
    const { state, events } = revealInVillainPhase(sitcomGame(), MOJO_IN_THE_MIDDLE, { after: [FILLER_2] });
    expect(state.villainArea.filter((i) => inst(state, i).cardId === cardId(MOJO_IN_THE_MIDDLE))).toHaveLength(1);
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual([MOJO_IN_THE_MIDDLE, FILLER_2]);
  });

  it("When Revealed: discards each other SETTING environment in play", () => {
    const base = sitcomGame({ modularSetIds: ["sitcom", "crime"] });
    const { state: staged, id: setting } = encounterCardInVillainArea(base, DIAL_M);
    const { state } = revealInVillainPhase(staged, MOJO_IN_THE_MIDDLE, { after: [FILLER_2] });
    expect(state.villainArea).not.toContain(setting);
    expect(inEncounterDiscard(state, setting)).toBe(true);
    expect(state.villainArea.filter((i) => inst(state, i).cardId === cardId(MOJO_IN_THE_MIDDLE))).toHaveLength(1);
  });

  it("does not surge when revealed by a search (insert p. 18: not 'revealed from the encounter deck')", () => {
    // Advance (01186) stands in for "search the encounter deck for Mojo in the Middle and reveal it".
    const searching: EngineDeps = {
      ...deps,
      abilities: {
        ...deps.abilities,
        "01186.when-revealed": whenRevealed(
          selectCards("found", encounterCards(["deck", "discard"], { name: "Mojo in the Middle" })),
          revealCard(chosen("found")),
        ),
      },
    };
    const { state, events } = revealInVillainPhase(sitcomGame(), "01186", {
      before: [NO_BOOST],
      after: ["01188"],
      deps: searching,
    });
    const revealed = of(events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(revealed).toEqual(["01186", MOJO_IN_THE_MIDDLE]);
    expect(state.villainArea.filter((i) => inst(state, i).cardId === cardId(MOJO_IN_THE_MIDDLE))).toHaveLength(1);
    expect(inEncounterPiles(state, "01188")).toHaveLength(1);
  });

  it("Each obligation gains 1 acceleration icon: one for each obligation in play, none for anything else", () => {
    const base = sitcomGame(duo);
    const accelerationIn = (state: GameState) => iconsInPlay(state, deps, "acceleration");
    const control = revealInVillainPhase(base, [FAMILY_MATTERS, GROWING_PAINS]).state;
    const { state: mojoBase } = withMojo(base);
    const mojoOnly = accelerationIn(mojoBase);
    expect(mojoOnly).toBe(accelerationIn(base));
    const revealed = revealInVillainPhase(mojoBase, [FAMILY_MATTERS, GROWING_PAINS]).state;
    for (const [code, player] of [
      [FAMILY_MATTERS, P1],
      [GROWING_PAINS, P2],
    ] as const) {
      expect(iconsOn(revealed, deps, obligationOf(revealed, code, player), "acceleration"), code).toBe(1);
      expect(iconsOn(control, deps, obligationOf(control, code, player), "acceleration"), `${code} control`).toBe(0);
    }
    // The villain's main scheme icons are unchanged by it: only the two obligations count.
    expect(accelerationIn(revealed) - accelerationIn(control)).toBe(2);
  });

  describe("Response: after a player discards an obligation, that player draws 1 card (§4.1 Q46: any discard)", () => {
    // The leaving obligation's `cardLeavesPlay` event names the player whose play area it left (`speakerId`: an obligation
    // has no controller), so `eventPlayer` ("that player") is that player and the response is offered to them.
    /** P1 holds Watch Me Play (confused, so its action can pay) and P2 The One with the Breakup; Mojo in the Middle is in play. */
    const staged = (withTheShow: boolean, active: PlayerId = P1) => {
      const dealt = withObligations(WATCH_ME_PLAY, BREAKUP, duo, active);
      const identity = identityOf(dealt.state, P1);
      const confused = patchInstance(dealt.state, identity, {
        statuses: { ...inst(dealt.state, identity).statuses, confused: 1 },
      });
      return { ...dealt, state: withTheShow ? withMojo(confused).state : confused };
    };
    const handSizes = (state: GameState) => [hand(state, P1).length, hand(state, P2).length] as const;

    it("the obligation's own Alter-Ego Action: the player whose it was draws 1 (and the other player does not)", () => {
      const control = staged(false);
      const mojo = staged(true);
      expect(handSizes(control.state)).toEqual(handSizes(mojo.state));
      const without = useAbility(control.state, P1, control.p1, "39065.watch-me-play-action");
      const withShow = useAbility(mojo.state, P1, mojo.p1, "39065.watch-me-play-action", undefined, takingTheDraw());
      expect(playAreaOf(withShow, P1)).not.toContain(mojo.p1);
      expect(inEncounterDiscard(withShow, mojo.p1)).toBe(true);
      expect(handSizes(withShow)).toEqual([handSizes(without)[0] + 1, handSizes(without)[1]]);
    });

    it("the second player's obligation: that player draws, not the first", () => {
      const control = staged(false, P2);
      const mojo = staged(true, P2);
      const cards = hand(mojo.state, P2).slice(0, 3);
      const action = "39064.the-one-with-the-breakup-action";
      const without = useAbility(control.state, P2, control.p2, action, { discard: cards }, pickInOrder(P2));
      const withShow = useAbility(mojo.state, P2, mojo.p2, action, { discard: cards }, takingTheDraw(pickInOrder(P2)));
      expect(inEncounterDiscard(withShow, mojo.p2)).toBe(true);
      expect(hand(withShow, P2).length).toBe(hand(without, P2).length + 1);
      expect(hand(withShow, P1).length).toBe(hand(without, P1).length);
    });

    it("another card's effect that discards the obligation counts too: its player draws, the card's controller does not", () => {
      // Aunt May's Alter-Ego Action is rewritten as "exhaust: discard The One with the Breakup" (P2's obligation).
      const discarding: EngineDeps = {
        ...deps,
        abilities: {
          ...deps.abilities,
          "01006.aunt-may-action": alterEgoAction(
            { cost: exhaustThis },
            discard(each(query("obligation", { name: "The One with the Breakup" }))),
          ),
        },
      };
      const go = (withTheShow: boolean, pick: Picker) => {
        const base = staged(withTheShow);
        const may = intoPlayArea(base.state, P1, AUNT_MAY);
        const after = settle(
          runWith(discarding, may.state, use(P1, may.id, "01006.aunt-may-action")),
          pick,
          undefined,
          discarding,
        );
        return { ...base, after };
      };
      const without = go(false, firstLegal);
      const withShow = go(true, takingTheDraw());
      expect(inEncounterDiscard(withShow.after, withShow.p2)).toBe(true);
      expect(playAreaOf(withShow.after, P1)).toContain(withShow.p1);
      expect(hand(withShow.after, P2).length).toBe(hand(without.after, P2).length + 1);
      expect(hand(withShow.after, P1).length).toBe(hand(without.after, P1).length);
    });

    it("draws nothing when no obligation is discarded", () => {
      const mojo = staged(true);
      const before = handSizes(mojo.state);
      const may = intoPlayArea(mojo.state, P1, AUNT_MAY);
      const after = useAbility(may.state, P1, may.id, "01006.aunt-may-action", undefined, takingTheDraw());
      expect(handSizes(after)).toEqual(before);
      expect(playAreaOf(after, P1)).toContain(mojo.p1);
    });
  });
});

describe("Family Matters (39061)", () => {
  it("is revealed into the revealing player's play area and stays there", () => {
    const { state, id, events } = withObligation(FAMILY_MATTERS);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId as string)).toEqual([FAMILY_MATTERS]);
    expect(playAreaOf(state, P1)).toContain(id);
    expect(inEncounterDiscard(state, id)).toBe(false);
    expect(cardsInPlay(state)).toContain(id);
  });

  it("is dealt to the player who reveals it: the second player's obligation sits in their play area", () => {
    const { state, p1, p2 } = withObligations(GROWING_PAINS, FAMILY_MATTERS);
    expect(playAreaOf(state, P1)).toContain(p1);
    expect(playAreaOf(state, P2)).toContain(p2);
    expect(playAreaOf(state, P1)).not.toContain(p2);
  });

  // An obligation's "you" is the player whose play area holds it (RRG 1.8 "Obligation", p. 30), for a blank rule too.
  it("the printed text box of each support you control is blank: Aunt May's Alter-Ego Action does nothing", () => {
    const damaged = (state: GameState) => patchInstance(state, identityOf(state, P1), { damage: 4 });
    const { state, id } = withObligation(FAMILY_MATTERS);
    expect(playAreaOf(state, P1)).toContain(id);
    const may = intoPlayArea(damaged(state), P1, AUNT_MAY);
    expect(refused(may.state, P1, may.id, "01006.aunt-may-action")).toBe(true);
    // Control: without the obligation the same support heals 4.
    const control = intoPlayArea(damaged(sitcomGame()), P1, AUNT_MAY);
    const healed = useAbility(control.state, P1, control.id, "01006.aunt-may-action");
    expect(inst(healed, identityOf(healed, P1)).damage).toBe(0);
  });

  it("only the supports of the player who holds it: the other player's support keeps its text", () => {
    const { state } = withObligations(GROWING_PAINS, FAMILY_MATTERS);
    const damaged = patchInstance(state, identityOf(state, P1), { damage: 4 });
    const may = intoPlayArea(damaged, P1, AUNT_MAY);
    const healed = useAbility(may.state, P1, may.id, "01006.aunt-may-action");
    expect(inst(healed, identityOf(healed, P1)).damage).toBe(0);
  });

  describe("Alter-Ego Action: exhaust your identity and each support you control → discard this obligation", () => {
    const ACTION = "39061.family-matters-action";
    /** Whether `legalActions` offers `player` the obligation's action. */
    const offered = (state: GameState, id: InstanceId, player: PlayerId = P1): boolean => {
      const legal = legalActions(state, player, deps);
      return (
        legal.kind === "turn" && legal.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === id)
      );
    };

    it("exhausts the identity and every support you control, and the obligation is discarded", () => {
      const { state, id } = withObligation(FAMILY_MATTERS);
      const { state: staged, ids } = inPlayFor(state, P1, AUNT_MAY, INTERROGATION_ROOM, SURVEILLANCE_TEAM);
      const upgrade = intoPlayArea(staged, P1, SPIDER_TRACER);
      expect(offered(upgrade.state, id)).toBe(true);
      const after = useAbility(upgrade.state, P1, id, ACTION);
      expect(ids.map((support) => exhausted(after, support))).toEqual([true, true, true]);
      expect(exhausted(after, identityOf(after, P1))).toBe(true);
      expect(exhausted(after, upgrade.id)).toBe(false); // an upgrade is not a support
      expect(playAreaOf(after, P1)).not.toContain(id);
      expect(inEncounterDiscard(after, id)).toBe(true);
    });

    it("with no support in play the identity alone pays", () => {
      const { state, id } = withObligation(FAMILY_MATTERS);
      expect(offered(state, id)).toBe(true);
      const after = useAbility(state, P1, id, ACTION);
      expect(exhausted(after, identityOf(after, P1))).toBe(true);
      expect(inEncounterDiscard(after, id)).toBe(true);
    });

    it("one exhausted support makes it unavailable: the ready ones are not exhausted for it (RRG 1.8 p. 24)", () => {
      const { state, id } = withObligation(FAMILY_MATTERS);
      const { state: staged, ids } = inPlayFor(state, P1, AUNT_MAY, INTERROGATION_ROOM);
      const blocked = patchInstance(staged, ids[1]!, { exhausted: true });
      expect(offered(blocked, id)).toBe(false);
      expect(refused(blocked, P1, id, ACTION)).toBe(true);
      // Naming only the ready support is not "each support you control".
      expect(refused(blocked, P1, id, ACTION, { exhausted: [ids[0]!] })).toBe(true);
      expect(exhausted(blocked, ids[0]!)).toBe(false);
      expect(playAreaOf(blocked, P1)).toContain(id);
    });

    it("a support that entered play after the obligation is part of the cost", () => {
      const { state, id } = withObligation(FAMILY_MATTERS);
      const first = intoPlayArea(state, P1, AUNT_MAY);
      const later = intoPlayArea(first.state, P1, SURVEILLANCE_TEAM);
      const after = useAbility(later.state, P1, id, ACTION);
      expect([first.id, later.id].map((support) => exhausted(after, support))).toEqual([true, true]);
      // Entering exhausted, it would instead keep the obligation in play.
      expect(refused(patchInstance(later.state, later.id, { exhausted: true }), P1, id, ACTION)).toBe(true);
    });

    it("another player's supports are not exhausted, and their exhausted support does not stop it", () => {
      const dealt = withObligations(FAMILY_MATTERS, GROWING_PAINS);
      const mine = intoPlayArea(dealt.state, P1, AUNT_MAY);
      const theirs = inPlayFor(mine.state, P2, SUPERHUMAN_LAW_DIVISION, AVENGERS_MANSION);
      const [ready, tired] = theirs.ids as [InstanceId, InstanceId];
      const before = patchInstance(theirs.state, tired, { exhausted: true });
      expect(offered(before, dealt.p1)).toBe(true);
      const after = useAbility(before, P1, dealt.p1, ACTION);
      expect(exhausted(after, mine.id)).toBe(true);
      expect(exhausted(after, ready)).toBe(false);
      expect(exhausted(after, identityOf(after, P2))).toBe(false);
      expect(inEncounterDiscard(after, dealt.p1)).toBe(true);
    });

    it("needs your identity ready, and is not usable in hero form", () => {
      const { state, id } = withObligation(FAMILY_MATTERS);
      const may = intoPlayArea(state, P1, AUNT_MAY);
      const tired = patchInstance(may.state, identityOf(may.state, P1), { exhausted: true });
      expect(refused(tired, P1, id, ACTION)).toBe(true);
      expect(exhausted(tired, may.id)).toBe(false);
      expect(refused(run(may.state, toHero(P1)), P1, id, ACTION)).toBe(true);
    });

    it("once it is discarded the supports have their text boxes back", () => {
      const { state, id } = withObligation(FAMILY_MATTERS);
      const may = intoPlayArea(patchInstance(state, identityOf(state, P1), { damage: 4 }), P1, AUNT_MAY);
      const after = useAbility(may.state, P1, id, ACTION);
      // Aunt May was exhausted to pay; readied (state surgery), her own Alter-Ego Action works again.
      const readied = patchInstance(after, may.id, { exhausted: false });
      const healed = useAbility(readied, P1, may.id, "01006.aunt-may-action");
      expect(inst(healed, identityOf(healed, P1)).damage).toBe(0);
    });
  });
});

describe("Growing Pains (39062)", () => {
  const ACTION = "39062.growing-pains-action";

  it("is revealed into the revealing player's play area and stays there", () => {
    const { state, id } = withObligation(GROWING_PAINS);
    expect(playAreaOf(state, P1)).toContain(id);
    expect(inEncounterDiscard(state, id)).toBe(false);
  });

  it("increases the cost to play each of your upgrades by 2, and only your upgrades", () => {
    const { state } = withObligations(GROWING_PAINS, WATCH_ME_PLAY);
    const mine = moveToHand(state, P1, SPIDER_TRACER, BLACK_CAT);
    const [tracer, cat] = mine.ids as [InstanceId, InstanceId];
    const theirs = moveToHand(mine.state, P2, FOCUSED_RAGE);
    const [rage] = theirs.ids as [InstanceId];
    const control = sitcomGame(duo);
    const controlMine = moveToHand(control, P1, SPIDER_TRACER, BLACK_CAT);
    expect(playCostOf(controlMine.state, P1, controlMine.ids[0]!, deps)!.current).toBe(1);
    expect(playCostOf(theirs.state, P1, tracer, deps)!.current).toBe(3);
    expect(playCostOf(theirs.state, P1, cat, deps)!.current).toBe(2);
    expect(playCostOf(theirs.state, P2, rage, deps)!.current).toBe(3);
  });

  /** P1 has Growing Pains with `inPlay` upgrades in play, `inDiscard` in the discard pile and `inHand` in hand. */
  const staged = (inPlay: readonly string[], inDiscard: readonly string[], inHand: readonly string[]) => {
    const base = withObligation(GROWING_PAINS);
    const put = inPlayFor(base.state, P1, ...inPlay);
    let state = put.state;
    const discards = inDiscard.map((code) => {
      const moved = moveToDiscard(state, P1, code);
      state = moved.state;
      return moved.id;
    });
    const given = moveToHand(state, P1, ...inHand);
    return { obligation: base.id, state: given.state, inPlay: put.ids, discards, inHand: given.ids };
  };
  const upgradesIn = (state: GameState, zone: "discard" | "play") =>
    (zone === "discard" ? playerOf(state, P1).discard : playAreaOf(state, P1)).filter(
      (i) => state.cardPool[inst(state, i).cardId]?.type === "upgrade",
    );

  it("Alter-Ego Action: discards an upgrade you control; one more in the discard pile than in play discards this obligation", () => {
    const s = staged([SPIDER_TRACER], [], []);
    const after = useAbility(s.state, P1, s.obligation, ACTION, undefined, pickInOrder(/you control/, s.inPlay[0]!));
    expect(upgradesIn(after, "play")).toEqual([]);
    expect(upgradesIn(after, "discard")).toEqual(s.inPlay);
    expect(playAreaOf(after, P1)).not.toContain(s.obligation);
    expect(inEncounterDiscard(after, s.obligation)).toBe(true);
  });

  it("an equal number in the discard pile and in play keeps the obligation", () => {
    const s = staged([SPIDER_TRACER, WEB_SHOOTER], [], []);
    const after = useAbility(s.state, P1, s.obligation, ACTION, undefined, pickInOrder(/you control/, s.inPlay[0]!));
    expect(upgradesIn(after, "play")).toEqual([s.inPlay[1]]);
    expect(upgradesIn(after, "discard")).toEqual([s.inPlay[0]]);
    expect(playAreaOf(after, P1)).toContain(s.obligation);
    expect(inEncounterDiscard(after, s.obligation)).toBe(false);
  });

  it("discarding an upgrade from your hand works too, and counts toward the discard pile", () => {
    const s = staged([], [], [TENACITY]);
    const after = useAbility(s.state, P1, s.obligation, ACTION, undefined, pickInOrder(s.inHand[0]!));
    expect(hand(after, P1)).not.toContain(s.inHand[0]);
    expect(playerOf(after, P1).discard).toContain(s.inHand[0]);
    expect(inEncounterDiscard(after, s.obligation)).toBe(true);
  });

  it("upgrades already in the discard pile count: 3 there against 1 left in play discards it", () => {
    const s = staged([SPIDER_TRACER, WEB_SHOOTER], [TENACITY, HEROIC_INTUITION], []);
    const after = useAbility(s.state, P1, s.obligation, ACTION, undefined, pickInOrder(/you control/, s.inPlay[0]!));
    expect(upgradesIn(after, "discard")).toHaveLength(3);
    expect(upgradesIn(after, "play")).toHaveLength(1);
    expect(inEncounterDiscard(after, s.obligation)).toBe(true);
  });

  it("costs nothing to use (no arrow), and is not usable in hero form", () => {
    const s = staged([SPIDER_TRACER], [], []);
    expect(refused(s.state, P1, s.obligation, ACTION)).toBe(false);
    const hero = run(s.state, toHero(P1));
    expect(refused(hero, P1, s.obligation, ACTION)).toBe(true);
  });
});

describe("The Odd Couple (39063)", () => {
  const ACTION = "39063.the-odd-couple-action";

  it("is revealed into the revealing player's play area and stays there", () => {
    const { state, id } = withObligation(ODD_COUPLE);
    expect(playAreaOf(state, P1)).toContain(id);
    expect(inEncounterDiscard(state, id)).toBe(false);
  });

  // The reduction speaks to the player whose play area holds the obligation (RRG 1.8 "Obligation", p. 30).
  it("reduces your ally limit by 2, and only yours", () => {
    const { state } = withObligations(ODD_COUPLE, GROWING_PAINS);
    expect(allyLimitFor(state, deps, P1)).toBe(1);
    expect(allyLimitFor(state, deps, P2)).toBe(3);
    expect(allyLimitFor(sitcomGame(), deps, P1)).toBe(3);
  });

  /** An ally in play with the hero, one in the discard pile, and the obligation. */
  const staged = () => {
    const base = withObligation(ODD_COUPLE);
    const put = inPlayFor(base.state, P1, BLACK_CAT);
    const toDiscard = moveToDiscard(put.state, P1, DAREDEVIL);
    return { obligation: base.id, state: toDiscard.state, cat: put.ids[0]!, buried: toDiscard.id };
  };

  it("Alter-Ego Action: exhaust 2 characters you control, shuffle an ally from your discard pile into your deck, discard it", () => {
    const s = staged();
    const identity = identityOf(s.state, P1);
    const after = useAbility(s.state, P1, s.obligation, ACTION, { exhausted: [identity, s.cat] });
    expect(exhausted(after, identity)).toBe(true);
    expect(exhausted(after, s.cat)).toBe(true);
    expect(playerOf(after, P1).discard).not.toContain(s.buried);
    expect(playerOf(after, P1).deck).toContain(s.buried);
    expect(playAreaOf(after, P1)).not.toContain(s.obligation);
    expect(inEncounterDiscard(after, s.obligation)).toBe(true);
  });

  it("exhausts exactly the 2 characters chosen: a third stays ready", () => {
    // Its own constant leaves room for one ally, so a third character needs the reduction switched off here.
    const unlimited: EngineDeps = {
      ...deps,
      abilities: { ...deps.abilities, "39063.the-odd-couple-constant": constant({}) },
    };
    const s = staged();
    const second = inPlayFor(s.state, P1, JESSICA_JONES);
    const identity = identityOf(second.state, P1);
    const costChoices = { exhausted: [s.cat, second.ids[0]!] };
    const used = runWith(unlimited, second.state, use(P1, s.obligation, ACTION, [], costChoices));
    const after = settle(used, firstLegal, undefined, unlimited);
    expect(exhausted(after, s.cat)).toBe(true);
    expect(exhausted(after, second.ids[0]!)).toBe(true);
    expect(exhausted(after, identity)).toBe(false);
  });

  // RRG 1.8 "Ally Limit" (p. 7): over the limit, a player "must immediately choose and discard" down to it.
  it("a second ally is over the reduced limit: its player discards down to 1 before anything else", () => {
    const s = staged();
    const second = inPlayFor(s.state, P1, JESSICA_JONES);
    const identity = identityOf(second.state, P1);
    const used = run(second.state, use(P1, s.obligation, ACTION, [], { exhausted: [identity, s.cat] }));
    expect(used.pendingChoice?.playerId).toBe(P1);
    expect(used.pendingChoice?.prompt).toEqual({ kind: "discardOverAllyLimit", limit: 1 });
    expect(used.pendingChoice?.options.map((o) => o.optionId).sort()).toEqual([s.cat, second.ids[0]!].sort());
    const discarded = run(used, {
      type: "resolveChoice",
      playerId: P1,
      choiceId: used.pendingChoice!.choiceId,
      selectedOptionIds: [second.ids[0]!],
    });
    expect(playAreaOf(discarded, P1)).toContain(s.cat);
    expect(playAreaOf(discarded, P1)).not.toContain(second.ids[0]!);
    expect(playerOf(discarded, P1).discard).toContain(second.ids[0]!);
  });

  it("the other player's allies are not counted against it: three of theirs stay", () => {
    const { state } = withObligations(ODD_COUPLE, GROWING_PAINS);
    const theirs = inPlayFor(state, P2, "01020", "01051", "01083");
    const ended = run(theirs.state, { type: "endTurn", playerId: P1 });
    expect(ended.pendingChoice?.prompt.kind).not.toBe("discardOverAllyLimit");
    for (const id of theirs.ids) expect(playAreaOf(ended, P2)).toContain(id);
  });

  it("cannot be used with fewer than 2 characters to exhaust", () => {
    const base = withObligation(ODD_COUPLE);
    expect(refused(base.state, P1, base.id, ACTION, { exhausted: [identityOf(base.state, P1)] })).toBe(true);
    expect(refused(base.state, P1, base.id, ACTION)).toBe(true);
  });

  it("is not usable in hero form", () => {
    const s = staged();
    const hero = run(s.state, toHero(P1));
    expect(refused(hero, P1, s.obligation, ACTION, { exhausted: [identityOf(hero, P1), s.cat] })).toBe(true);
  });

  it("with no ally in the discard pile it is still discarded", () => {
    const base = withObligation(ODD_COUPLE);
    const put = inPlayFor(base.state, P1, BLACK_CAT);
    const after = useAbility(put.state, P1, base.id, ACTION, { exhausted: [identityOf(put.state, P1), put.ids[0]!] });
    expect(inEncounterDiscard(after, base.id)).toBe(true);
  });
});

describe("The One with the Breakup (39064)", () => {
  const ACTION = "39064.the-one-with-the-breakup-action";

  it("is revealed into the revealing player's play area and stays there", () => {
    const { state, id } = withObligation(BREAKUP);
    expect(playAreaOf(state, P1)).toContain(id);
    expect(inEncounterDiscard(state, id)).toBe(false);
  });

  it("Each encounter card gains peril: the villain, the main scheme and the obligation itself, not a hero card", () => {
    const control = sitcomGame();
    const { state, id } = withObligation(BREAKUP);
    const villain = state.activeVillainId!;
    expect(hasKeyword(control, control.activeVillainId!, "peril", deps)).toBe(false);
    expect(hasKeyword(state, villain, "peril", deps)).toBe(true);
    expect(hasKeyword(state, state.mainScheme.instanceId, "peril", deps)).toBe(true);
    expect(hasKeyword(state, id, "peril", deps)).toBe(true);
    expect(hasKeyword(state, identityOf(state, P1), "peril", deps)).toBe(false);
  });

  it("a card revealed while it is in play has peril", () => {
    const { state } = withObligation(BREAKUP);
    const next = revealInVillainPhase(state, WATCH_ME_PLAY, { before: [FILLER_2] });
    const watch = obligationOf(next.state, WATCH_ME_PLAY);
    expect(hasKeyword(next.state, watch, "peril", deps)).toBe(true);
  });

  /** P1 has the obligation; both players hold 5 cards, so there are 3 to discard. */
  const staged = () => {
    const dealt = withObligations(BREAKUP, GROWING_PAINS);
    const state = [P1, P2].reduce((s, player) => withHand(s, player, hand(s, player).slice(0, 5)), dealt.state);
    return { ...dealt, state };
  };

  it("Alter-Ego Action: discard 3 cards from your hand and choose a player: that player draws 1, and you discard it", () => {
    const s = staged();
    const cards = hand(s.state, P1).slice(0, 3);
    const after = useAbility(s.state, P1, s.p1, ACTION, { discard: cards }, pickInOrder(`${P2}`));
    for (const c of cards) expect(playerOf(after, P1).discard).toContain(c);
    expect(hand(after, P1)).toHaveLength(2);
    expect(hand(after, P2)).toHaveLength(6);
    expect(inEncounterDiscard(after, s.p1)).toBe(true);
    expect(playAreaOf(after, P1)).not.toContain(s.p1);
  });

  it("you may choose yourself to draw the 1 card", () => {
    const s = staged();
    const cards = hand(s.state, P1).slice(0, 3);
    const after = useAbility(s.state, P1, s.p1, ACTION, { discard: cards }, pickInOrder(`${P1}`));
    expect(hand(after, P1)).toHaveLength(3);
    expect(hand(after, P2)).toHaveLength(5);
  });

  it("needs 3 cards in hand to pay, and is not usable in hero form", () => {
    const s = staged();
    const two = withHand(s.state, P1, hand(s.state, P1).slice(0, 2));
    expect(refused(two, P1, s.p1, ACTION, { discard: hand(two, P1) })).toBe(true);
    const hero = run(s.state, toHero(P1));
    expect(refused(hero, P1, s.p1, ACTION, { discard: hand(hero, P1).slice(0, 3) })).toBe(true);
  });
});

describe("Watch Me Play (39065)", () => {
  const ACTION = "39065.watch-me-play-action";
  const confusedIdentity = (state: GameState, player: PlayerId = P1) =>
    patchInstance(state, identityOf(state, player), {
      statuses: { ...inst(state, identityOf(state, player)).statuses, confused: 1 },
    });

  it("is revealed into the revealing player's play area and stays there, with incite 3 and peril", () => {
    const { state, id, events } = withObligation(WATCH_ME_PLAY);
    expect(playAreaOf(state, P1)).toContain(id);
    expect(inEncounterDiscard(state, id)).toBe(false);
    expect(hasKeyword(state, id, "incite", deps)).toBe(true);
    expect(hasKeyword(state, id, "peril", deps)).toBe(true);
    // Incite 3: 3 threat from this card on the main scheme as it is revealed.
    expect(
      of(events, "threatPlaced")
        .filter((e) => e.sourceInstanceId === id)
        .map((e) => e.amount),
    ).toEqual([3]);
  });

  it("incite is exactly 3 more threat than the same villain phase with another obligation", () => {
    const watch = withObligation(WATCH_ME_PLAY).state.mainScheme.instanceId;
    const control = withObligation(GROWING_PAINS);
    const treated = withObligation(WATCH_ME_PLAY);
    expect(inst(treated.state, watch).threat - inst(control.state, watch).threat).toBe(3);
  });

  it("'When you look up a rule, you are confused' has no game effect (§4.1 Q45): nothing makes you confused", () => {
    const { state } = withObligation(WATCH_ME_PLAY);
    expect(inst(state, identityOf(state, P1)).statuses.confused).toBe(0);
    expect(SITCOM_ABILITIES["39065.watch-me-play-forced-interrupt"]!.trigger).toEqual({ kind: "constant" });
  });

  it("Alter-Ego Action: exhaust your identity and discard a confused status card from it, discard this obligation", () => {
    const { state, id } = withObligation(WATCH_ME_PLAY);
    const identity = identityOf(state, P1);
    const after = useAbility(confusedIdentity(state), P1, id, ACTION);
    expect(exhausted(after, identity)).toBe(true);
    expect(inst(after, identity).statuses.confused).toBe(0);
    expect(playAreaOf(after, P1)).not.toContain(id);
    expect(inEncounterDiscard(after, id)).toBe(true);
  });

  it("needs a confused status card on your identity", () => {
    const { state, id } = withObligation(WATCH_ME_PLAY);
    expect(refused(state, P1, id, ACTION)).toBe(true);
  });

  it("needs your identity ready to exhaust", () => {
    const { state, id } = withObligation(WATCH_ME_PLAY);
    const tired = patchInstance(confusedIdentity(state), identityOf(state, P1), { exhausted: true });
    expect(refused(tired, P1, id, ACTION)).toBe(true);
  });

  it("is not usable in hero form", () => {
    const { state, id } = withObligation(WATCH_ME_PLAY);
    const hero = run(confusedIdentity(state), toHero(P1));
    expect(refused(hero, P1, id, ACTION)).toBe(true);
  });
});
