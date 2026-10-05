import { hasKeyword, keywordTotal, traitsOf, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, identityOf, inst, patchInstance, playerOf, use } from "../../testing/harness.js";
import { handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS } from "../index.js";
import { TELEPATHY } from "./telepathy.js";
import {
  SPIDER_MAN,
  TWO,
  type Seats,
  accepted,
  attackFor,
  attachmentOf,
  attachmentsOf,
  attacksBy,
  damageOn,
  deckNames,
  discardNames,
  drive,
  events,
  exhaustedOf,
  game,
  handOf,
  heroed,
  inPlayFromDeck,
  inPlayNames,
  nameOf,
  playerDiscardNames,
  round,
  setHand,
  villainId,
  type Run,
} from "./superpower-testing.js";

vi.setConfig({ testTimeout: 120_000 });

const traitNames = (s: GameState, id: Parameters<typeof traitsOf>[1]) => traitsOf(s, id, WAVE7_DEPS).map(String);
/** 3 upgrades, 2 events and a support: the largest group of one type is 3 (Stryfe's X). */
const UP3 = ["01007", "01007", "01008", "01004", "01005", "01063"] as const;
const juggernaut = (sets: readonly string[] = ["telepathy"], players: Seats = [SPIDER_MAN]) => game({ sets, players });
const stryfe = (sets: readonly string[] = ["telepathy"]) => game({ scenario: "stryfe", sets });
/** The obligations are dealt to the revealing player: a blank card follows so the round has something to reveal. */
const OBLIGATION_ROUND = { boostCards: ["01187"] } as const;

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(TELEPATHY).sort()).toEqual(
      [
        "40159.telepathy-constant",
        "40160.obligation",
        "40160.when-revealed",
        "40160.manufactured-drama-action",
        "40161.obligation",
        "40161.when-revealed",
        "40161.sowing-discord-action",
        "40162.when-revealed",
        "40162.boost",
      ].sort(),
    );
  });
});

describe("Telepathy as a modular set: Setup, Attach to the villain, Permanent", () => {
  it("Juggernaut: attached at setup; both obligations and both One Step Ahead are in the encounter deck", () => {
    const s = juggernaut();
    expect(attachmentsOf(s, villainId(s))).toContain("Telepathy");
    const deck = deckNames(s);
    expect(deck).not.toContain("Telepathy");
    expect(deck.filter((n) => n === "Manufactured Drama")).toHaveLength(1);
    expect(deck.filter((n) => n === "Sowing Discord")).toHaveLength(1);
    expect(deck.filter((n) => n === "One Step Ahead")).toHaveLength(2);
    expect(hasKeyword(s, attachmentOf(s, villainId(s), "Telepathy"), "permanent", WAVE7_DEPS)).toBe(true);
  });

  it("Stryfe: attached to Stryfe", () => {
    const s = stryfe();
    expect(attachmentsOf(s, villainId(s))).toEqual(["Telepathy"]);
  });
});

describe("40159.telepathy-constant: attached villain gains the PSIONIC trait and retaliate 1", () => {
  it("Juggernaut (BRUTE) gains PSIONIC; without the card he is not PSIONIC", () => {
    const s = juggernaut();
    expect(traitNames(s, villainId(s))).toEqual(expect.arrayContaining(["BRUTE", "PSIONIC"]));
    const without = juggernaut(["flight"]);
    expect(traitNames(without, villainId(without))).not.toContain("PSIONIC");
  });

  it("retaliate 1: keyword total 1 on Juggernaut, who has none of his own", () => {
    const s = juggernaut();
    expect(keywordTotal(s, villainId(s), "retaliate", WAVE7_DEPS)).toBe(1);
    const without = juggernaut(["flight"]);
    expect(keywordTotal(without, villainId(without), "retaliate", WAVE7_DEPS)).toBe(0);
  });

  it("retaliate 1 in play: after Spider-Man's basic attack (ATK 2) on Stryfe, Spider-Man takes 1 damage; control: 0", () => {
    const s = stryfe();
    const run = attackFor(s, villainId(s));
    expect(damageOn(run.state, villainId(run.state))).toBe(2);
    expect(damageOn(run.state, identityOf(run.state))).toBe(1);
    const control = stryfe(["flight"]);
    expect(damageOn(attackFor(control, villainId(control)).state, identityOf(control))).toBe(0);
  });

  it("stat box SCH +1: Juggernaut schemes for 1 + 1 = 2 (his ATK, 2 + 1 momentum, is unchanged)", () => {
    const scheme = round(juggernaut(), { boosts: 1 });
    expect(events(scheme.events, "schemeResolved")[0]!.baseSch).toBe(2);
    const attack = round(heroed(juggernaut()), { boosts: 1 });
    expect(attacksBy(attack.events, villainId(attack.state))[0]!.baseAtk).toBe(3);
  });
});

/** The first player's reveal of `code` in a round with a stacked boost card, in alter-ego form. */
const reveals = (s: GameState, code: string, extra: readonly string[] = []): Run =>
  round(s, { ...OBLIGATION_ROUND, reveals: [code, ...extra] });
const inPlay = (s: GameState, player = P1) => playerOf(s, player).playArea;
const supportsIn = (s: GameState, player = P1) =>
  inPlay(s, player).filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "support");

describe("Manufactured Drama (40160), an obligation", () => {
  const withSupport = (s: GameState, player = P1) => inPlayFromDeck(s, player, player === P1 ? "01063" : "01073");

  it("is revealed into the revealing player's play area; 40160.when-revealed exhausts each support they control (no surge)", () => {
    const { state, id } = withSupport(juggernaut());
    const run = reveals(state, "40160", ["01186"]);
    expect(inPlayNames(run.state, P1)).toContain("Manufactured Drama");
    expect(exhaustedOf(run.state, id)).toBe(true);
    // Only the card dealt: the one stacked after it is not revealed.
    expect(discardNames(run.state)).not.toContain("Advance");
  });

  it("40160.when-revealed: with no support the card gains surge and the next card is revealed", () => {
    const run = reveals(juggernaut(), "40160", ["01186"]);
    expect(discardNames(run.state)).toContain("Advance");
  });

  it("40160.when-revealed: Hope Summers is not a support, so she stays ready", () => {
    const { state } = withSupport(juggernaut());
    const run = reveals(state, "40160", ["01186"]);
    const hope = playerOf(run.state, P1).playArea.find((id) => nameOf(run.state, id) === "Hope Summers")!;
    expect(exhaustedOf(run.state, hope)).toBe(false);
  });

  it("40160.obligation: supports you control cannot ready: after a round's ready step the support is still exhausted; control: it is ready", () => {
    const { state, id } = withSupport(juggernaut());
    const revealed = reveals(state, "40160").state;
    expect(exhaustedOf(revealed, id)).toBe(true);
    const next = round(revealed, { boosts: 1, reveals: ["01186"] });
    expect(exhaustedOf(next.state, id)).toBe(true);
    const control = round(patchInstance(state, id, { exhausted: true }), { boosts: 1 });
    expect(exhaustedOf(control.state, id)).toBe(false);
  });

  it("2 players: only the revealing player's supports are affected (P2 reveals; P1's support stays ready, P2's is exhausted)", () => {
    const base = juggernaut(["telepathy"], TWO);
    const one = withSupport(base, P1);
    const two = withSupport(one.state, P2);
    const run = round(two.state, { boosts: 2, reveals: ["01186", "40160"] });
    expect(inPlayNames(run.state, P2)).toContain("Manufactured Drama");
    expect(exhaustedOf(run.state, one.id)).toBe(false);
    expect(exhaustedOf(run.state, two.id)).toBe(true);
  });

  /** Drama in P1's play area after its reveal, with two supports in play and a known deck top. */
  const dramaWithSupports = (): { state: GameState; drama: Parameters<typeof inst>[1] } => {
    const first = inPlayFromDeck(juggernaut(), P1, "01063");
    const second = inPlayFromDeck(first.state, P1, "01064");
    const revealed = reveals(second.state, "40160").state;
    return { state: revealed, drama: inPlay(revealed).find((id) => nameOf(revealed, id) === "Manufactured Drama")! };
  };

  it("40160.manufactured-drama-action: Alter-Ego Action, exhaust your identity and discard 1 card from the top of your deck per support (2) -> discard this card", () => {
    const { state, drama } = dramaWithSupports();
    expect(supportsIn(state)).toHaveLength(2);
    const ready = patchInstance(state, identityOf(state), { exhausted: false });
    const deckBefore = playerOf(ready, P1).deck;
    const run = drive(ready, {}, use(P1, drama, "40160.manufactured-drama-action"));
    expect(playerOf(run.state, P1).deck).toEqual(deckBefore.slice(2));
    expect(playerOf(run.state, P1).discard).toEqual(expect.arrayContaining(deckBefore.slice(0, 2)));
    expect(exhaustedOf(run.state, identityOf(run.state))).toBe(true);
    expect(inPlayNames(run.state, P1)).not.toContain("Manufactured Drama");
    expect(discardNames(run.state)).toContain("Manufactured Drama");
  });

  it("40160.manufactured-drama-action: not usable with an exhausted identity", () => {
    const { state, drama } = dramaWithSupports();
    const spent = patchInstance(state, identityOf(state), { exhausted: true });
    expect(accepted(spent, use(P1, drama, "40160.manufactured-drama-action"))).toBe(false);
  });
});

describe("Sowing Discord (40161), an obligation", () => {
  const withAlly = (s: GameState, player = P1) => inPlayFromDeck(s, player, player === P1 ? "01058" : "01067");

  it("40161.when-revealed: exhausts each ally you control (no surge)", () => {
    const { state, id } = withAlly(juggernaut());
    const run = reveals(state, "40161", ["01186"]);
    expect(inPlayNames(run.state, P1)).toContain("Sowing Discord");
    expect(exhaustedOf(run.state, id)).toBe(true);
    expect(discardNames(run.state)).not.toContain("Advance");
  });

  it("40161.when-revealed: Hope Summers is an ally the first player controls: she is exhausted by it, and a lone Hope counts (no surge)", () => {
    const run = reveals(juggernaut(), "40161", ["01186"]);
    const hope = playerOf(run.state, P1).playArea.find((id) => nameOf(run.state, id) === "Hope Summers")!;
    expect(exhaustedOf(run.state, hope)).toBe(true);
    expect(discardNames(run.state)).not.toContain("Advance");
  });

  it("40161.when-revealed, 2 players: P2 controls no ally (Hope Summers is the first player's), so P2's copy gains surge", () => {
    const run = round(juggernaut(["telepathy"], TWO), {
      boostCards: ["01187", "01187"],
      reveals: ["40162", "40161", "01186"],
    });
    expect(inPlayNames(run.state, P2)).toContain("Sowing Discord");
    expect(discardNames(run.state)).toContain("Advance");
  });

  it("40161.obligation: allies you control cannot ready; control: the ally readies", () => {
    const { state, id } = withAlly(juggernaut());
    const revealed = reveals(state, "40161").state;
    const next = round(revealed, { boosts: 1, reveals: ["01186"] });
    expect(exhaustedOf(next.state, id)).toBe(true);
    // The control's reveal is stacked too: this seed's shuffle otherwise deals Sowing Discord itself.
    const control = round(patchInstance(state, id, { exhausted: true }), { boosts: 1, reveals: ["01186"] });
    expect(inPlayNames(control.state, P1)).not.toContain("Sowing Discord");
    expect(exhaustedOf(control.state, id)).toBe(false);
  });

  it("2 players: P1's ally stays ready when P2 reveals it; P2's ally is exhausted", () => {
    const base = juggernaut(["telepathy"], TWO);
    const one = withAlly(base, P1);
    const two = withAlly(one.state, P2);
    const run = round(two.state, { boosts: 2, reveals: ["01186", "40161"] });
    expect(exhaustedOf(run.state, one.id)).toBe(false);
    expect(exhaustedOf(run.state, two.id)).toBe(true);
  });

  it("40161.sowing-discord-action: Alter-Ego Action, spend [mental][mental] -> discard this card", () => {
    const revealed = reveals(juggernaut(), "40161").state;
    const card = inPlay(revealed).find((id) => nameOf(revealed, id) === "Sowing Discord")!;
    const { state, ids } = handWith(revealed, P1, "mental", 2);
    const run = drive(
      state,
      {},
      use(
        P1,
        card,
        "40161.sowing-discord-action",
        ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inPlayNames(run.state, P1)).not.toContain("Sowing Discord");
    expect(discardNames(run.state)).toContain("Sowing Discord");
    expect(playerDiscardNames(run.state)).toHaveLength(2 + playerDiscardNames(state).length);
  });

  it("40161.sowing-discord-action: not usable with one [mental] resource", () => {
    const revealed = reveals(juggernaut(), "40161").state;
    const card = inPlay(revealed).find((id) => nameOf(revealed, id) === "Sowing Discord")!;
    const { state, ids } = handWith(revealed, P1, "mental", 1);
    expect(
      accepted(
        state,
        use(
          P1,
          card,
          "40161.sowing-discord-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
  });
});

describe("One Step Ahead (40162), a treachery", () => {
  /** The cards left in the first player's hand after a round that reveals `code`, from a hand of 6 held through the round. */
  const handAfter = (s: GameState, code: string) => handOf(reveals(setHand(s, P1, UP3), code).state).length;

  it("40162.when-revealed: discards 1 random card from your hand (6 -> 5; control, a blank reveal: 6)", () => {
    const s = juggernaut();
    expect(handAfter(s, "01186")).toBe(6);
    expect(handAfter(s, "40162")).toBe(5);
  });

  it("40162.when-revealed: 2 random cards instead if the villain has the AERIAL trait (Flight attached too: 6 -> 4)", () => {
    const s = juggernaut(["telepathy", "flight"]);
    expect(traitNames(s, villainId(s))).toContain("AERIAL");
    expect(handAfter(s, "40162")).toBe(4);
  });

  it("40162.when-revealed: the discarded cards go to the player's discard pile", () => {
    const s = setHand(juggernaut(), P1, UP3);
    const before = playerDiscardNames(s).length;
    const run = reveals(s, "40162");
    expect(playerDiscardNames(run.state)).toHaveLength(before + 1);
  });

  /** Stryfe (3 in hand = X 3, no overkill of his own) attacks a hero defended by Daredevil with 1 hit point left. */
  const defended = (boost: string): Run => {
    const { state, id } = inPlayFromDeck(setHand(heroed(stryfe()), P1, UP3), P1, "01058");
    return round(patchInstance(state, id, { damage: 2 }), { boostCards: [boost], plan: { defend: "Daredevil" } });
  };

  it("40162.boost: if the villain is attacking, this attack gains overkill: 3 + 1 icon = 4 against Daredevil's 1 hit point, 3 to the hero", () => {
    const run = defended("40162");
    expect(attacksBy(run.events, villainId(run.state))[0]!.baseAtk).toBe(3);
    expect(attacksBy(run.events, villainId(run.state))[0]!.boostIcons).toBe(1);
    expect(damageOn(run.state, identityOf(run.state))).toBe(3);
  });

  it("40162.boost, control: a blank boost card: no overkill, the hero takes nothing", () => {
    const run = defended("01186");
    expect(damageOn(run.state, identityOf(run.state))).toBe(0);
  });

  it("40162.boost: nothing on a scheme activation", () => {
    const run = round(stryfe(), { boostCards: ["40162"] });
    expect(events(run.events, "schemeResolved")[0]!.boostIcons).toBe(1);
  });
});
