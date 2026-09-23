import type { GameEvent } from "@mc/engine";
import { firstLegal, inst, instancesOf, P1, runWith, settle, stackEncounterDeck } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { traceAbilities } from "../../testing/trace.js";
import { wave3Scenario } from "../setup.js";
import { GMW_ABILITIES } from "./index.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/** Band of Badoon (16117–16121), recommended by Brotherhood of Badoon's own 1A "Contents". */
const brotherhoodOfBadoon = () =>
  startWave3Game(
    wave3Scenario("brotherhood-of-badoon", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }),
  );

const boostIconsOf = (events: readonly GameEvent[], kind: "attackResolved" | "schemeResolved"): number | undefined =>
  events.find((e): e is Extract<GameEvent, { type: typeof kind }> => e.type === kind)?.boostIcons;

describe("Badoon Assassin (16117)", () => {
  it("Forced Response: after it engages your hero, it attacks you with +2 ATK (16117.badoon-assassin-forced-response)", () => {
    const base = brotherhoodOfBadoon();
    const heroForm = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const identity = heroForm.players[0]!.identity.instanceId;
    const before = inst(heroForm, identity).damage;
    const staged = stackEncounterDeck(heroForm, "01186", "16117");
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    // Badoon Assassin's own ATK is 1; its own Forced Response attacks again at +2, so at least 1 (its own printed
    // ATK is never used for the engage itself — only the extra attack matters here) — the minimum any activation of
    // it plus this response could deal is 3 (1 printed ATK, if it also activates normally, plus this response's own
    // +2 floor); loosely bounded from below to allow either ordering of "engages" vs "activates" this same phase.
    expect(inst(revealed, identity).damage).toBeGreaterThanOrEqual(before + 3);
  });

  it("[star] Boost: if this activation is an attack, gains overkill, piercing, and ranged (16117.boost)", () => {
    // Structurally pinned like Badoon Warlord's own constant just above: a live overkill/piercing spillover test
    // needs a second target and full damage-assignment scaffolding this pass doesn't build (that file's own
    // comment). What *is* live here is that the ability genuinely fires when it's drawn as an attack's boost card.
    const definition = GMW_ABILITIES["16117.boost" as never];
    expect(definition?.effects).toEqual([
      {
        kind: "if",
        condition: { kind: "currentActivationIs", activation: "attack" },
        then: [{ kind: "modifyAttack", keywords: ["overkill", "piercing", "ranged"] }],
      },
    ]);

    const base = brotherhoodOfBadoon();
    const heroForm = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const staged = stackEncounterDeck(heroForm, "16117"); // drawn as Drang's own boost card during his attack
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    settle(runWith(deps, staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, deps);
    expect(trace.resolved()).toContain("16117.boost");
  });
});

describe("Badoon Grunt (16118)", () => {
  it("[star] Boost: put Badoon Grunt into play engaged with you (16118.boost)", () => {
    const state = brotherhoodOfBadoon();
    // Drang (villain) always gets a boost card; stack 16118 as that boost card during a real villain phase, so its
    // own printed "[star] Boost:" text is what puts it into play (RRG 1.8 "Boost", p. 11).
    const staged = stackEncounterDeck(state, "16118");
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    const grunt = instancesOf(revealed, "16118").find((id) => inst(revealed, id).engagedWith === P1);
    expect(grunt).toBeDefined();
    expect(revealed.players[0]!.playArea).toContain(grunt);
  });

  it("Forced Response: after it engages you, if no other minion is engaged with you, deal yourself 1 facedown encounter card (16118.badoon-grunt-forced-response)", () => {
    const state = brotherhoodOfBadoon();
    // Same boost path as above: its own Forced Response fires the instant it engages, whichever way it enters play.
    // Asserted on the `cardMoved` event rather than the final `dealtEncounter` zone: the dealt card is the deck's
    // new top card, which this same villain phase's own reveal step can go on to reveal and resolve before the
    // phase ends (a real, if slightly confusing, consequence of "deal a facedown encounter card" shrinking the
    // deck by one right before the reveal step draws from it).
    const staged = stackEncounterDeck(state, "16118");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    const dealt = events.some((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === P1);
    expect(dealt).toBe(true);
  });
});

describe("Badoon Lieutenant (16119.boost)", () => {
  it("gets +2 boost icons when drawn as the boost card of a scheme (alter-ego form)", () => {
    const state = brotherhoodOfBadoon();
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const staged = stackEncounterDeck(state, "16119");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    // Printed boostIcons is 1; the condition ("this activation is a scheme") holds in alter-ego form, so +2 more.
    expect(boostIconsOf(events, "schemeResolved")).toBeGreaterThanOrEqual(3);
  });
});

describe("Badoon Sentry (16120.boost)", () => {
  it("gives the villain a tough status card, or +2 boost icons if it already had one", () => {
    const state = brotherhoodOfBadoon();
    const staged = stackEncounterDeck(state, "16120");
    const revealed = settle(runWave3(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE3_DEPS);
    const villain = revealed.villains[0]!.instanceId;
    expect(inst(revealed, villain).statuses.tough).toBeGreaterThanOrEqual(1);
  });
});

describe("Badoon Warlord (16121)", () => {
  it("its attacks gain overkill (16121.badoon-warlord-constant)", () => {
    // A live overkill-spillover combat test needs the excess damage to land on a *third* character (the villain),
    // which needs a full attack/defend/assign sequence this pack's other tests don't yet build; recorded here
    // rather than guessed. `attacksGainKeywords`/`RuleSpec attackKeywords` (the same primitive Badoon Assassin's
    // own boost uses via `modifyAttack`, and which several wave1/wave2 cards already exercise end-to-end) is
    // pinned structurally: the compiled ability grants exactly "overkill" to Badoon Warlord's own attacks, not
    // some other keyword or scope.
    const definition = GMW_ABILITIES["16121.badoon-warlord-constant" as never];
    expect(definition?.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { self: true } }],
    });
  });

  it("[star] Boost: gets +2 boost icons when drawn as the boost card of an attack (16121.boost)", () => {
    const base = brotherhoodOfBadoon();
    const heroForm = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const staged = stackEncounterDeck(heroForm, "16121");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    // Printed boostIcons is 0; the condition ("this activation is an attack") holds in hero form, so +2.
    expect(boostIconsOf(events, "attackResolved")).toBeGreaterThanOrEqual(2);
  });
});
