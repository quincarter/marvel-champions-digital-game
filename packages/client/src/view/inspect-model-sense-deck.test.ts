/**
 * Daredevil's Sense deck top card in Inspect (#782, reported from play): "Action: Play the top card of the Sense deck
 * as if it were in your hand (paying its cost)." (60001a Superhuman Senses) is printed on the identity, and the Sense
 * deck's top card is where a player reaches to play it. The top card's sheet offers that Action as "Play it", used on
 * the identity, so its payment and host choice run as they do from the identity's own sheet.
 */
import { legalActions, type GameState, type InstanceId, type LegalActions, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { nextTurn } from "../store/dev-game-steps.js";
import { startDevSenseHeroGame } from "../store/dev-sense-game.js";
import { SessionStore } from "../store/session-store.js";
import { inspectModel } from "./inspect-model.js";

const ACTION = "60001a.superhuman-senses";
let store: SessionStore;
let game: GameState;
let me: PlayerId;
let legal: LegalActions;

const senseDeck = (state: GameState): readonly InstanceId[] => state.players[0]!.separateDecks["Sense"]!.deck;

beforeAll(async () => {
  store = new SessionStore(new LocalEngineHost());
  // Daredevil alone, on his hero face: Superhuman Senses is a hero-face Action.
  await startDevSenseHeroGame(store);
  game = store.state.game!;
  me = game.players[0]!.playerId;
  legal = store.state.legal!.actions;
}, 120_000);

describe("the Sense deck's top card offers Superhuman Senses", () => {
  test("its sheet has a Play it button that is the identity's Action, and says it is playable", () => {
    const top = senseDeck(game)[0]!;
    const model = inspectModel(game, top, legal, me, POOL_DEPS);
    expect(model.abilities[0]).toMatchObject({
      abilityId: ACTION,
      sourceInstanceId: game.players[0]!.identity.instanceId,
    });
    expect(model.abilities[0]!.label).toMatch(/^Play it \(/);
    expect(model.status.playable).toBe(true);
  });

  test("only the top card: the second card of the deck offers nothing", () => {
    const second = senseDeck(game)[1]!;
    expect(inspectModel(game, second, legal, me, POOL_DEPS).abilities).toEqual([]);
  });

  test("not while the engine does not list the Action as legal", () => {
    const alterEgo: LegalActions =
      legal.kind === "turn"
        ? {
            ...legal,
            legal: legal.legal.filter(
              (entry) => !(entry.action.kind === "useAbility" && entry.action.abilityId === ACTION),
            ),
          }
        : legal;
    expect(inspectModel(game, senseDeck(game)[0]!, alterEgo, me, POOL_DEPS).abilities).toEqual([]);
  });

  test("not on another seat's view, and not while a decision is open", () => {
    const top = senseDeck(game)[0]!;
    expect(inspectModel(game, top, legal, "someone-else" as PlayerId, POOL_DEPS).abilities).toEqual([]);
    const choice = { kind: "choice", choice: {} } as unknown as LegalActions;
    expect(inspectModel(game, top, choice, me, POOL_DEPS).abilities).toEqual([]);
  });

  test("with nothing to pay for the top card, the sheet says why instead of offering nothing", () => {
    const broke: GameState = { ...game, players: game.players.map((p, at) => (at === 0 ? { ...p, hand: [] } : p)) };
    const model = inspectModel(broke, senseDeck(broke)[0]!, legalActions(broke, me, POOL_DEPS), me, POOL_DEPS);
    expect(model.abilities).toEqual([]);
    expect(model.status.playable).toBe(false);
    expect(model.status.message).toMatch(/Superhuman Senses: /);
  });

  test("on Matt Murdock's face the top card says the Action is on the hero side", async () => {
    const aeStore = new SessionStore(new LocalEngineHost());
    await aeStore.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "fne-daredevil-justice" }],
      seed: 3,
    });
    await nextTurn(aeStore);
    const ae = aeStore.state.game!;
    expect(ae.players[0]!.identity.form).toBe("alterEgo");
    const model = inspectModel(ae, senseDeck(ae)[0]!, aeStore.state.legal!.actions, me, POOL_DEPS);
    expect(model.abilities).toEqual([]);
    expect(model.status).toMatchObject({ playable: false });
    expect(model.status.message).toBe(
      "Daredevil's Superhuman Senses plays this card from the hero side: flip to Daredevil to play it.",
    );
  });

  test("using it from the top card's button plays that card: it leaves the Sense deck for play", async () => {
    const top = senseDeck(game)[0]!;
    const use = inspectModel(game, top, legal, me, POOL_DEPS).abilities[0]!;
    const entry = (legal.kind === "turn" ? legal.legal : []).find(
      (candidate) =>
        candidate.action.kind === "useAbility" &&
        candidate.action.instanceId === use.sourceInstanceId &&
        candidate.action.abilityId === use.abilityId,
    )!;
    await store.dispatch(entry.example);
    for (let guard = 0; guard < 6 && store.state.legal?.actions.kind === "choice"; guard++) {
      const choice = store.state.legal.actions.choice;
      await store.resolveChoice(choice.options.slice(0, Math.max(1, choice.minSelections)).map((o) => o.optionId));
    }
    const after = store.state.game!;
    expect(senseDeck(after)).not.toContain(top);
    expect(after.instances[top]!.attachedTo).toBeDefined();
  });
});
