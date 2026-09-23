import { activeEncounterDeck } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents, revealFromEncounterDeck, stageNemesisCardForReveal } from "../../testing/staging.js";
import { WAVE3_DEPS } from "../index.js";
import { startWave3Game } from "../testing.js";
import { gamoraScenario } from "./support.js";

const gamoraVsRhino = (seed = 1) => startWave3Game(gamoraScenario("rhino", { seed }));

/** Picks the offered option whose label starts with `prefix`; declines/first-legals everything else. Mirrors
 * `../gmw/groot-obligation-nemesis.test.ts`'s own `pickingLabelStartingWith`. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Gamora's obligation (Unfulfilled Destiny, 18024)", () => {
  it("(18024.obligation): exhausting your alter-ego removes it from the game, leaving your hand untouched", () => {
    const staged = stackEncounterDeck(gamoraVsRhino(), "01186", "18024");
    const handBefore = playerOf(staged, P1).hand.length;
    const revealed = settle(
      runWith(WAVE3_DEPS, staged, endTurn()),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    const [obligation] = instancesOf(revealed, "18024");
    expect(revealed.removedFromGame).toContain(obligation);
    expect(playerOf(revealed, P1).hand.length).toBe(handBefore);
  });

  it("(18024.obligation): choosing and discarding 2 events from hand discards the obligation instead", () => {
    const staged = stackEncounterDeck(gamoraVsRhino(), "01186", "18024");
    const handBefore = playerOf(staged, P1).hand.length;
    const revealed = settle(
      runWith(WAVE3_DEPS, staged, endTurn()),
      pickingLabelStartingWith("Choose and discard 2 events"),
      undefined,
      WAVE3_DEPS,
    );
    const [obligation] = instancesOf(revealed, "18024");
    // Discarded to the encounter discard pile (the obligation's own destination), not removed from the game.
    expect(revealed.removedFromGame).not.toContain(obligation);
    expect(playerOf(revealed, P1).hand.length).toBe(handBefore - 2);
  });
});

describe("Gamora's nemesis set (Sibling Rivalry, Nebula, In a Bind, Waylay)", () => {
  it("Sibling Rivalry (18025.sibling-rivalry-constant): players other than Gamora cannot remove threat from it; Gamora can", () => {
    // A real two-player game (Gamora and Groot), with Sibling Rivalry put into play directly by state surgery —
    // the villain phase's own reveal-and-deal machinery is a multi-round, multi-activation affair to drive
    // deterministically in a two-player game, and the `threatCannotBeRemoved` rule under test doesn't care how
    // the card arrived in play, only how real removal commands treat it once there. Its own reveal (When
    // Revealed, entering play at its printed threat) is exercised solo by the sibling test below.
    const start = startWave3Game(
      gamoraScenario("rhino", { seed: 7, extraPlayers: [{ starterDeckId: "groot-protection" }] }),
    );
    const schemeId = "sibling-rivalry-test" as import("@mc/engine").InstanceId;
    const revealed = {
      ...start,
      villainArea: [...start.villainArea, schemeId],
      instances: {
        ...start.instances,
        [schemeId]: {
          instanceId: schemeId,
          cardId: "18025" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 4,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    const scheme = schemeId;
    const threatBefore = inst(revealed, scheme).threat;
    expect(threatBefore).toBe(4);

    // P1 (Gamora) is the active player at game start. She removes threat from Sibling Rivalry with Set the Pace
    // (18005): succeeds.
    const heroP1 = runWith(WAVE3_DEPS, revealed, toHero(P1));
    const givenGamora = moveToHand(heroP1, P1, "18005");
    const [gamoraCard] = givenGamora.ids;
    const p1Attempt = settle(
      runWith(WAVE3_DEPS, givenGamora.state, play(P1, gamoraCard!, [])),
      pickingLabelStartingWith("Sibling Rivalry"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(p1Attempt, scheme).threat).toBe(threatBefore - 1);

    // P1 ends their turn; P2 (Groot) tries "I am Groot" (16003, a (thwart) ability targeting any scheme) on the
    // same side scheme next: blocked.
    const p2Turn = runWith(WAVE3_DEPS, p1Attempt, endTurn(P1), toHero(P2));
    const givenGroot = moveToHand(p2Turn, P2, "16003");
    const [grootCard] = givenGroot.ids;
    const p2Attempt = settle(
      runWith(WAVE3_DEPS, givenGroot.state, play(P2, grootCard!, payWith(givenGroot.state, P2, 3, [grootCard!]))),
      pickingLabelStartingWith("Sibling Rivalry"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(p2Attempt, scheme).threat).toBe(threatBefore - 1);
  });

  it("Sibling Rivalry (18025.sibling-rivalry-forced-response): after the villain phase begins, deal 1 facedown encounter card to Gamora", () => {
    // The dealt card is revealed and resolved automatically with no player choice in between (the whole villain
    // phase can complete inside a single `endTurn` command with no `settle` checkpoint to inspect along the way),
    // so — as with Waylay's own surge above — `driveEvents`'s event log is the direct proof: a `cardMoved` into
    // P1's `dealtEncounter` beyond the one every villain phase deals every player normally.
    const start = gamoraVsRhino(1);
    const schemeId = "sibling-rivalry-forced-response-test" as import("@mc/engine").InstanceId;
    const withScheme = {
      ...start,
      villainArea: [...start.villainArea, schemeId],
      instances: {
        ...start.instances,
        [schemeId]: {
          instanceId: schemeId,
          cardId: "18025" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "activeEncounterDeck" },
          faceup: true,
          exhausted: false,
          damage: 0,
          threat: 4,
          statuses: { stunned: 0, confused: 0, tough: 0 },
          counters: {},
          attachedTo: null,
          attachments: [],
          boostCards: [],
          tucked: [],
          facedownAs: null,
          engagedWith: null,
          flipped: false,
        } as never,
      },
    };
    const dealtToP1Count = (events: readonly import("@mc/engine").GameEvent[]) =>
      events.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.to.playerId === P1).length;
    const { events } = driveEvents(WAVE3_DEPS, withScheme, endTurn());

    // Baseline: the same round, without Sibling Rivalry. Rhino's own modular set (Bomb Scare) prints hazard
    // icons that also deal extra cards, and Sibling Rivalry's own extra dealt card shifts every later draw's
    // position — which can change how many *further* hazard-triggered deals cascade downstream — so the fair,
    // deterministic claim is "at least the one guaranteed extra deal", not an exact total.
    const { events: baselineEvents } = driveEvents(WAVE3_DEPS, start, endTurn());
    expect(dealtToP1Count(events)).toBeGreaterThanOrEqual(dealtToP1Count(baselineEvents) + 1);
  });

  it("Nebula nemesis minion (18026.nebula-forced-interrupt): when this minion would enter play, discard the Nebula ally from play", () => {
    const hero = runWith(WAVE3_DEPS, gamoraVsRhino(2), toHero());
    const givenAlly = moveToHand(hero, P1, "18002");
    const [nebulaAllyId] = givenAlly.ids;
    const withAlly = settle(
      runWith(WAVE3_DEPS, givenAlly.state, play(P1, nebulaAllyId!, payWith(givenAlly.state, P1, 2, [nebulaAllyId!]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(withAlly, P1).playArea).toContain(nebulaAllyId);
    const { state: withMinion } = revealFromEncounterDeck(WAVE3_DEPS, withAlly, "18026", firstLegal, 1);
    // The nemesis minion is now in play; the ally it discarded is not.
    expect(instancesOf(withMinion, "18026").some((id) => playerOf(withMinion, P1).playArea.includes(id))).toBe(true);
    expect(playerOf(withMinion, P1).playArea).not.toContain(nebulaAllyId);
    expect(playerOf(withMinion, P1).discard).toContain(nebulaAllyId);
  });

  it("In a Bind (18027.in-a-bind-constant, 18027.in-a-bind-action): blanks Gamora's printed text box (except traits); Hero Action discards an attack event, takes 1 damage, discards itself", () => {
    const start = gamoraVsRhino(3);
    const { state: attached } = revealFromEncounterDeck(WAVE3_DEPS, start, "18027", firstLegal);
    const identity = identityOf(attached);
    expect(inst(attached, identity).attachments.length).toBeGreaterThan(0);
    // Finesse (18001a) no longer fires while In a Bind blanks Gamora's text box: playing an attack event doesn't
    // offer its response at all.
    const hero = runWith(WAVE3_DEPS, attached, toHero());
    const staged = patchInstance(hero, hero.mainScheme.instanceId, { threat: 3 });
    const givenAttack = moveToHand(staged, P1, "18003");
    const [attackId] = givenAttack.ids;
    const afterAttack = settle(
      runWith(WAVE3_DEPS, givenAttack.state, play(P1, attackId!, [])),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(mainThreat(afterAttack)).toBe(3); // Finesse's removal never happened

    // Hero Action: choose and discard an attack event from hand, take 1 damage → discard In a Bind.
    const inBindId = inst(afterAttack, identity).attachments[0]!;
    const givenSecondAttack = moveToHand(afterAttack, P1, "18014");
    const [secondAttackId] = givenSecondAttack.ids;
    const damageBefore = inst(givenSecondAttack.state, identity).damage;
    const discarded = settle(
      runWith(
        WAVE3_DEPS,
        givenSecondAttack.state,
        use(P1, inBindId, "18027.in-a-bind-action", [], { discard: [secondAttackId!] }),
      ),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(discarded, identity).damage).toBe(damageBefore + 1);
    expect(playerOf(discarded, P1).discard).toContain(secondAttackId);
    expect(inst(discarded, identity).attachments).not.toContain(inBindId);
  });

  it("Waylay (18028.when-revealed): When Revealed, stun and confuse Gamora; not-yet-stunned reveal gains no surge", () => {
    const start = gamoraVsRhino(4);
    const identity = identityOf(start);
    const discardBefore = activeEncounterDeck(start).discard.length;
    const { state: first } = revealFromEncounterDeck(WAVE3_DEPS, start, "18028", firstLegal);
    expect(inst(first, identity).statuses.stunned).toBeGreaterThan(0);
    expect(inst(first, identity).statuses.confused).toBeGreaterThan(0);
    // Not already stunned/confused going in, so no surge: exactly the 1-filler + 1-Waylay baseline is consumed.
    expect(activeEncounterDeck(first).discard.length).toBe(discardBefore + 2);
  });

  it("Waylay (18028.when-revealed): gains surge when Gamora is already stunned or confused", () => {
    const start = gamoraVsRhino(4);
    const identity = identityOf(start);
    const alreadyStunned = patchInstance(start, identity, {
      statuses: { stunned: 1, confused: 0, tough: 0 },
    });
    const staged = stageNemesisCardForReveal(alreadyStunned, "18028", P1, 1);
    // `driveEvents` (unlike `revealFromEncounterDeck`, which only reports the resulting state) also collects the
    // engine's own event log, so "did surge actually trigger" is read directly off `surgeTriggered` rather than
    // inferred from how much of the encounter deck one villain phase happens to consume.
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
  });

  /**
   * rules-qa-engineer wave 3 pass (docs/phase7-wave3-qa.md has the full report). Printed text: "When Revealed:
   * Stun and confuse Gamora. If Gamora is already stunned or confused, this card gains surge." The card names
   * "Gamora" explicitly — not "you" — so RRG 1.8 "You, Your" (p. 49) doesn't apply: this is a named-character
   * effect, the same shape Sibling Rivalry's own Forced Response in this file already reads correctly via
   * `GAMORA_PLAYER` (`ownerOf(named("Gamora"))`, `gamora-obligation-nemesis.ts`).
   *
   * **Finding: `18028.when-revealed` stuns/confuses `yourIdentity` (`identityOf(you)`) instead — "you" being
   * whoever reveals the card, per RRG 1.8 "You, Your" (p. 49)'s own default for an encounter card ("'you' refers
   * to whoever the ability text concerns", normally the revealer for a step-three reveal). In solo play the
   * revealer is always Gamora, so every existing test above (solo only) can't see the difference. In a 2-player
   * game where the *other* player reveals Waylay, this test shows the wrong identity gets stunned and confused.**
   *
   * Severity: wrong result, not a crash — but it means the printed nemesis treachery's whole point (punishing the
   * Gamora player specifically) silently stops working the moment Gamora isn't the one who happens to reveal it,
   * in any 2+ player game. Owner: `ability-scripting-engineer` (`gam/gamora-obligation-nemesis.ts`, `18028.when-
   * revealed`) — the fix is presumably swapping `yourIdentity` for the same `GAMORA_PLAYER`-derived identity ref
   * `18025.sibling-rivalry-constant`/`-forced-response` already use in this same file.
   */
  it.fails("Waylay (18028.when-revealed): stuns and confuses Gamora even when a different player reveals it (docs/phase7-wave3-qa.md; RRG 1.8 p. 49)", () => {
    const start = startWave3Game(
      gamoraScenario("rhino", { seed: 4, extraPlayers: [{ starterDeckId: "groot-protection" }] }),
    );
    const gamoraIdentity = identityOf(start, P1);
    const otherIdentity = identityOf(start, P2);
    const { state: revealed } = revealFromEncounterDeck(WAVE3_DEPS, start, "18028", firstLegal, 1, P2);
    expect(inst(revealed, gamoraIdentity).statuses.stunned).toBeGreaterThan(0);
    expect(inst(revealed, gamoraIdentity).statuses.confused).toBeGreaterThan(0);
    expect(inst(revealed, otherIdentity).statuses.stunned).toBe(0);
    expect(inst(revealed, otherIdentity).statuses.confused).toBe(0);
  });
});
