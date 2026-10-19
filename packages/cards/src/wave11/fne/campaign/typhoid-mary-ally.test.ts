import { PLAYABLE_CARDS, campaignId, cardId } from "@mc/content";
import type { PlayModes } from "@mc/content";
import {
  cardsInPlay,
  characterProfile,
  createGame,
  type CampaignGameInput,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/index.js";
import { chosen, encounterSetAside, firstPlayer, putIntoPlay, query, selectCards } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  inst,
  patchInstance,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  FNE_CAMPAIGN_TYPHOID_MARY_ALLY as REGISTRY,
  FNE_CAMPAIGN_TYPHOID_MARY_ALLY_SKIPPED as SKIPPED,
} from "./typhoid-mary-ally.js";

vi.setConfig({ testTimeout: 240_000 });

const MARY = "60210a";
const REFS = ["60210a.typhoid-mary-forced-response", "60210b.bloody-mary-forced-response"];
/** Maggia Enforcers, a plain minion; Exclusive Interview, a side scheme; Core "Advance", a blank boost card. */
const MINION = "60092";
const SIDE_SCHEME = "60157";
const BLANK = "01186";

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const mary = (s: GameState): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === MARY)!;
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const MODES: PlayModes = { campaign: { campaignId: campaignId("fne-test") } };

/**
 * MC60 p. 9 step 13: the campaign sets Typhoid Mary aside and puts her into play under a player. Setup is a keyword on
 * her, not a "Setup:" ability, so the instruction does not resolve one (`resolveSetup` off).
 */
function newGame(players = 1): GameState {
  const base = coreScenario("rhino", {
    players: SEATS.slice(0, players),
    seed: 1,
    modes: MODES,
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const campaign = {
    campaignId: campaignId("fne-test"),
    nodeId: "node",
    definitionVersion: "1",
    modes: MODES,
    log: { shared: {}, perSeat: [] },
    instructions: [
      {
        instructionId: "fne.mary",
        text: "mary",
        citation: "MC60 p. 9",
        window: "afterMulligans" as const,
        effects: [
          selectCards("mary", encounterSetAside(query("ally", { name: "Typhoid Mary" }))),
          putIntoPlay(chosen("mary"), firstPlayer),
        ],
      },
    ],
    removedFromCampaign: [],
    seats: base.players.map((p, index) => ({
      seatNumber: index + 1,
      identityCardId: p.identityCardId,
      deck: p.deck,
      aspects: p.aspects ?? [],
      grantedCardIds: [],
    })),
    seed: 99,
    setAsideCards: [data(MARY).id],
  } as CampaignGameInput;
  const created = createGame(
    {
      ...base,
      cards: [...(base.cards ?? []), ...WAVE11_CARDS],
      encounterDeck: [...base.encounterDeck, cardId(MINION), cardId(SIDE_SCHEME)],
      campaign,
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  let s = driveEventsPicking(WAVE11_DEPS, created.state, firstLegal).state;
  for (let n = 0; n < players; n++) s = withForm(s, { heroForm: 0 }, (["p1", "p2"] as const)[n] as PlayerId);
  return s;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));

/** Everyone ends their turn; the villain attacks each hero, each with a blank boost card, and each player is dealt `dealt` in seat order. */
function villainPhase(s: GameState, ...dealt: string[]): GameState {
  const players = s.players.map((p) => p.playerId);
  const stacked = stackEncounterDeck(s, ...players.map(() => BLANK), ...dealt);
  return driveEventsPicking(WAVE11_DEPS, stacked, declines, ...players.map((p) => endTurn(p))).state;
}
const faceUp = (s: GameState): "typhoid" | "bloody" => (inst(s, mary(s)).flipped ? "bloody" : "typhoid");

describe("registry", () => {
  it("registers both printed ref of the Typhoid Mary ally; nothing is skipped", () => {
    expect(abilityRefIds(data(MARY)).sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Typhoid Mary 60210", () => {
  it("is put into play by the campaign under the first player, once, on her Typhoid Mary face", () => {
    const s = newGame();
    const copies = cardsInPlay(s).filter((i) => codeOf(s, i) === MARY);
    expect(copies).toHaveLength(1);
    expect(inst(s, copies[0]!).controllerId).toBe(P1);
    expect(faceUp(s)).toBe("typhoid");
  });

  it("60210a.typhoid-mary-forced-response: after you reveal a minion, removes all damage from her and flips her", () => {
    const s = newGame();
    const hurt = patchInstance(s, mary(s), { damage: 2 });
    const after = villainPhase(hurt, MINION);
    expect(inst(after, mary(after)).damage).toBe(0);
    expect(faceUp(after)).toBe("bloody");
  });

  it("prints THW 2 / ATK 1 as Typhoid Mary and THW 1 / ATK 2 as Bloody Mary, 3 hit points on both (RRG 1.8 'Flip', p. 20)", () => {
    const s = newGame();
    expect(characterProfile(s, mary(s), WAVE11_DEPS)).toMatchObject({ thw: 2, atk: 1, maxHp: 3 });
    const after = villainPhase(s, MINION);
    expect(faceUp(after)).toBe("bloody");
    expect(characterProfile(after, mary(after), WAVE11_DEPS)).toMatchObject({ thw: 1, atk: 2, maxHp: 3 });
  });

  it("60210b.bloody-mary-forced-response: after you reveal a side scheme, removes all damage and flips her back", () => {
    const s = newGame();
    const bloody = patchInstance(s, mary(s), { flipped: true, damage: 1 });
    const after = villainPhase(bloody, SIDE_SCHEME);
    expect(inst(after, mary(after)).damage).toBe(0);
    expect(faceUp(after)).toBe("typhoid");
  });

  it("the flip keeps her status cards (RRG 'Flip', p. 20)", () => {
    const s = newGame();
    const stunned = patchInstance(s, mary(s), { statuses: { stunned: 1, confused: 0, tough: 0 }, damage: 1 });
    const after = villainPhase(stunned, MINION);
    expect(faceUp(after)).toBe("bloody");
    expect(inst(after, mary(after)).statuses.stunned).toBe(1);
  });

  it("does not flip for the other kind of card: a side scheme on her Typhoid face, a minion on her Bloody face", () => {
    const s = newGame();
    const typhoid = patchInstance(s, mary(s), { damage: 2 });
    const a = villainPhase(typhoid, SIDE_SCHEME);
    expect(faceUp(a)).toBe("typhoid");
    expect(inst(a, mary(a)).damage).toBe(2);
    const bloody = patchInstance(s, mary(s), { flipped: true, damage: 2 });
    const b = villainPhase(bloody, MINION);
    expect(faceUp(b)).toBe("bloody");
    expect(inst(b, mary(b)).damage).toBe(2);
  });

  it("does not trigger on a minion another player reveals (two players: she is under player 1)", () => {
    const s = newGame(2);
    const hurt = patchInstance(s, mary(s), { damage: 2 });
    const minionHolder = (st: GameState) =>
      (Object.keys(st.instances) as InstanceId[])
        .filter((i) => codeOf(st, i) === MINION)
        .map((i) => inst(st, i).engagedWith);
    // One blank boost per hero, then the deal in seat order: here the minion is player 1's.
    // Player 2 is dealt the minion: player 1's Mary does not flip.
    const theirs = villainPhase(hurt, SIDE_SCHEME, MINION);
    expect(minionHolder(theirs)).toEqual(["p2"]);
    expect(faceUp(theirs)).toBe("typhoid");
    expect(inst(theirs, mary(theirs)).damage).toBe(2);
    const mine = villainPhase(hurt, MINION, SIDE_SCHEME);
    expect(minionHolder(mine)).toEqual(["p1"]);
    expect(faceUp(mine)).toBe("bloody");
    expect(inst(mine, mary(mine)).damage).toBe(0);
  });
});
