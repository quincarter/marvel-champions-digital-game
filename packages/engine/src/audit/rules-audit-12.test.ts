/**
 * Rules audit chunk 12 (Glossary: PLAY, PUT INTO PLAY ... PLAYER'S PLAY AREA). Audit proofs only: each `it.fails`
 * marks a place the engine does something the RRG forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Play, Put into Play" (p. 32): "Cards with the text '[type] form only' can only be played or put into play by
 * a player whose identity is in the specified form." `playCard` enforces a printed `playRestrictions.form`
 * (`actions.ts`, `wrong_form`), but the `putIntoPlay` effect (`resolve/apply-effect.ts`) never reads it, so an effect
 * such as Superpower Training's "put it into play" puts a "Hero Form only" upgrade onto an alter-ego.
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { Command } from "../commands.js";
import { startSession } from "../engine.js";
import type { InstanceId } from "../ids.js";
import { mustInstance, mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubEvent, stubMinion, stubUpgrade } from "../testing/fixtures.js";
import { defaultPick, giveCard } from "../testing/scenario.js";
import { gameAtFirstTurn, P1 } from "../testing/wave3.js";

/** "Hero Form only." */
const RAGE = { ...stubUpgrade({ id: "rage-ish", cost: 1 }), playRestrictions: { form: "hero" as const } };
const FETCH_ABILITY = stubAbility("fetch-rage.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseCards",
      slot: "found",
      from: {
        kind: "zone",
        zone: ["deck", "discard", "hand"],
        player: { kind: "controller" },
        filter: { name: RAGE.name },
      },
      chooser: { kind: "controller" },
      min: 1,
      max: 1,
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
  ],
});
/** "Search your deck for a Hero Form only upgrade and put it into play." */
const FETCH = stubEvent({ id: "fetch-rage", cost: 0, abilities: [FETCH_ABILITY.ref] });
const BRUTE = stubMinion({ id: "brute", atk: 0, sch: 0, hp: 9 });
const deps: EngineDeps = depsOf(FETCH_ABILITY);

function runFetch(form: "hero" | "alterEgo"): { state: GameState; rage: InstanceId } {
  const base = gameAtFirstTurn({ cards: [RAGE, FETCH, BRUTE], deps, deck: [RAGE.id, FETCH.id], encounter: [BRUTE.id] });
  const posed: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form } })),
  };
  const seat = mustPlayer(posed, P1);
  const rage = [...seat.deck, ...seat.discard, ...seat.hand].find((i) => posed.instances[i]?.cardId === RAGE.id)!;
  const given = giveCard(posed, P1, FETCH.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session } = driveSession(startSession(given.state), deps, [command], (s) => {
    const options = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    return options.includes(rage) ? [rage] : defaultPick(s);
  });
  return { state: session.state, rage };
}

describe("a 'Hero Form only' upgrade put into play (RRG 1.8 'Play, Put into Play', p. 32)", () => {
  it("control: a hero-form player may put it into play", () => {
    const { state, rage } = runFetch("hero");
    expect(mustInstance(state, rage).attachedTo).toBe(mustPlayer(state, P1).identity.instanceId);
  });

  it("an alter-ego player cannot: it stays out of play", () => {
    const { state, rage } = runFetch("alterEgo");
    expect(mustInstance(state, rage).attachedTo).toBeNull();
  });
});

/**
 * RRG 1.8 "Ability" (p. 4): "Player card abilities cannot resolve during game setup, unless prefaced by a 'Setup'
 * timing trigger." A Setup-keyword player ally that enters play at setup (Appendix II step 11) with a Forced Response
 * "After this ally enters play, deal 3 damage to the villain" must not resolve it then; the engine has no setup gate on
 * triggered abilities, so the villain is damaged during setup. (Reachability: a player card with the setup keyword and
 * a response to something that happens in setup; no pool card was confirmed, so this is a rule proof, not a card bug.)
 */
import { flat } from "@mc/content";
import { stubAlly, stubVillain } from "../testing/fixtures.js";

const SETUP_RESPONSE = stubAbility("setup-scout.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }],
});
const SETUP_SCOUT = stubAlly({
  id: "setup-scout",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 2,
  keywords: [{ name: "setup" }],
  abilities: [SETUP_RESPONSE.ref],
});
const SOFT = stubVillain({ id: "soft-villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const setupDeps: EngineDeps = depsOf(SETUP_RESPONSE);

describe("a player card's response during game setup (RRG 1.8 'Ability', p. 4)", () => {
  it("a Setup-keyword ally's 'After this ally enters play' response does not resolve at setup", () => {
    const state = gameAtFirstTurn({
      cards: [SETUP_SCOUT, SOFT],
      deps: setupDeps,
      villain: SOFT,
      deck: [SETUP_SCOUT.id],
    });
    const scout = Object.values(state.instances).find((i) => i.cardId === SETUP_SCOUT.id)!;
    expect(mustPlayer(state, P1).playArea).toContain(scout.instanceId); // control: it did enter play at setup
    expect(state.instances[state.villains[0]!.instanceId]?.damage).toBe(0);
  });
});
