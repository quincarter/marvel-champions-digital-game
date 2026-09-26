import { activeEncounterDeck, canAttack, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  picking,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE4_DEPS } from "../index.js";
import { playFromHand, startWave4Game } from "../testing.js";
import { spectrumScenario } from "./support.js";

/**
 * Real-game tests for the Enchantress modular set (`enchantress.ts`, `mts` 21177–21179, docs/phase7-wave4.md §2.2),
 * seated onto the Ebony Maw scenario via `modularSetIds` — the same "test a modular set standalone" precedent
 * `children-of-thanos.test.ts` and `wave3/ron/kree-fanatic.test.ts` use. Unlike Valkyrie's own nemesis-set version
 * of these same three card names (`valk/valkyrie-obligation-nemesis.test.ts`), Enchantress here is a plain
 * recommended modular set — its cards sit in the shared encounter deck from the start, not a hero's own
 * set-aside pile, so these tests reveal from the encounter deck directly rather than via `revealFromEncounterDeck`
 * (which only works for a nemesis-set card staged set aside).
 */
const game = (seed: number) => startWave4Game(spectrumScenario("ebony-maw", { seed, modularSetIds: ["enchantress"] }));

/** Stacks `code` on top of the encounter deck (with `fillers` Advance treacheries ahead of it to soak the
 * villain's own unconditional boost draw) and ends the turn, revealing it for real — `ebony-maw.test.ts`'s own
 * `revealTopEncounterCard`, copied here since it is file-local everywhere it is used in this pack. */
function revealTopEncounterCard(
  state: GameState,
  code: string,
  pick = firstLegal,
  fillers = 1,
): { readonly state: GameState; readonly id: InstanceId } {
  const staged = stackEncounterDeck(state, ...Array.from({ length: fillers }, () => "01186"), code);
  const revealed = settle(runWith(WAVE4_DEPS, staged, endTurn(P1)), pick, undefined, WAVE4_DEPS);
  const id = instancesOf(revealed, code).find(
    (candidate) =>
      revealed.players.some((p) => p.playArea.includes(candidate)) || revealed.villainArea.includes(candidate),
  )!;
  return { state: revealed, id };
}

describe("Enchantress (minion, 21177)", () => {
  it("21177.when-revealed: searches for Seduced and attaches it to your identity", () => {
    const hero = settle(runWith(WAVE4_DEPS, game(4), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state } = revealTopEncounterCard(hero, "21177", picking("Seduced"));
    const identity = identityOf(state, P1);
    expect(inst(state, identity).attachments.some((a) => state.instances[a]?.cardId === ("21179" as never))).toBe(true);
  });
});

describe("Beguiled (attachment, 21178)", () => {
  it("21178.beguiled-constant: treats the attached ally as an Enthralled minion, SCH = printed THW; 21178.when-revealed engages its controller", () => {
    const hero = settle(runWith(WAVE4_DEPS, game(5), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const { state: withAlly, id: ally } = playFromHand(hero, "21011", 5);
    const { state } = revealTopEncounterCard(withAlly, "21178", firstLegal);
    const treated = inst(state, ally).treatedAs;
    expect(treated?.kind).toBe("minion");
    expect(treated?.traits).toContain("ENTHRALLED");
    expect(inst(state, ally).engagedWith).toBe(P1);
  });
});

describe("Seduced (attachment, 21179)", () => {
  it("21179.seduced-constant, -action: attached to your identity, you cannot attack; spending resources discards it", () => {
    const hero = settle(runWith(WAVE4_DEPS, game(6), toHero(P1)), firstLegal, undefined, WAVE4_DEPS);
    const identity = identityOf(hero, P1);
    const seduced = instancesOf(hero, "21179")[0]!;
    const attached: GameState = {
      ...hero,
      instances: {
        ...hero.instances,
        [seduced]: { ...hero.instances[seduced]!, attachedTo: identity, faceup: true, controllerId: P1 },
        [identity]: { ...hero.instances[identity]!, attachments: [...hero.instances[identity]!.attachments, seduced] },
      },
    };
    const villain = attached.villains[0]!.instanceId;
    expect(canAttack(attached, identity, villain, WAVE4_DEPS)).toBe(false);
    const alterEgo = withForm(attached, "alterEgo");
    // Energy (21023) and Genius (21024), the two basic [energy]/[mental] resource cards, cover Seduced's own cost.
    const given = moveToHand(alterEgo, P1, "21023", "21024");
    const state = settle(
      runWith(
        WAVE4_DEPS,
        given.state,
        use(
          P1,
          seduced,
          "21179.seduced-action",
          given.ids.map((fromHand) => ({ fromHand })),
        ),
      ),
      picking(seduced),
      undefined,
      WAVE4_DEPS,
    );
    // Seduced is an encounter card: "discard" sends it to the encounter deck's own discard pile.
    expect(activeEncounterDeck(state).discard).toContain(seduced);
    expect(inst(state, seduced).attachedTo).toBeNull();
  });
});
