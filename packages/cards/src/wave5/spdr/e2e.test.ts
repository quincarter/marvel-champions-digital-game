import { cardId } from "@mc/content";
import {
  cardsInPlay,
  createGame,
  currentName,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario } from "./support.js";

/**
 * A real game test for SP//dr's own real precon (`spdr-protection`, `packages/content/src/data/spdr/
 * starterDecks.ts`) against Rhino (a Core scenario, seated with the wave 5 pool — `spdrScenario`'s own `wave5Scenario`
 * fallback, docs/phase7-wave5.md §5). Modeled on `../spiderham/e2e.test.ts` (itself modeled on `../ironheart/
 * e2e.test.ts`): one game played entirely by the card-name-agnostic greedy driver to a real outcome, one
 * hand-scripted game that deliberately drives SP//dr's own signature interactions, and one 2-player game against
 * another wave 5 hero (Nova). Every scripted step is driven through `sessionApply` (never bare
 * `applyCommand`/state surgery once the session has started), so its own log always replays to the same final
 * state.
 *
 * Spider-Man Noir's own Response (31015.spider-man-noir-response), Aunt May & Uncle Ben (31007) and Bombshell's
 * own divided-attack constant (31031.bombshell-constant) were all still being finalized by other work in this
 * worktree partway through writing this file; all three landed before this file's own commit, so none of them is
 * excluded for a script gap. The scripted game below still doesn't play Spider-Man Noir or Aunt May & Uncle Ben
 * (neither is needed to exercise SP//dr's own separated-identity mechanics, and `cross-hero.test.ts` already covers
 * Spider-Man Noir's own Response), and Bombshell isn't a player card at all (an Iron Spider's Sinister Syndicate
 * modular-set minion, not part of any hero's own deck).
 *
 * **The scripted game's own separated-identity/Sync Ratio economy, entirely through real triggered play.** Every
 * genuine data/state edit (staging the hand, presetting a counter/attachment on the SP//dr Suit support as if some
 * earlier ability had placed them, staging M.O.R.B.I.U.S. already engaged with 1 damage on him, stacking the
 * encounter deck) happens before `startSession` (`../ironheart/e2e.test.ts`'s own docblock precedent), so `replay`
 * reproduces the whole game including this setup — every step below is a real, logged command:
 *
 * - Round 1 (alter-ego, the default opening form): Maintenance (31002.maintenance) exhausts the SP//dr Suit support
 *   and draws 2. Host Spider (31010, an Interface upgrade) enters play. Unshakable (31024) is played, paid entirely
 *   from hand — one resource generated, with the engaged M.O.R.B.I.U.S. (31027, SP//dr's nemesis minion, staged
 *   already engaged with 1 damage) dealing **no** damage back, since the engaged player is in alter-ego form (§4.1
 *   Q24). The round's one voluntary form change then flips to hero form: the counter and the attachment preset on
 *   the SP//dr Suit support move to the identity (§4.1 Q38), and the identity itself comes out of the flip
 *   *exhausted* (Q37: ready state follows the physical card, so the support's own exhausted state — set by
 *   Maintenance's own cost — carries over to the hero-form identity, `identity.ts`'s own module docblock). Rapid
 *   Deployment (31005) is paid partly with a Sync Ratio resource (exhausting the identity's own attached "SP//dr"
 *   upgrade side, itself an Interface upgrade in hero form) for its own doubled effect (6 threat removed instead of
 *   3). Web-Trap (31006), paid entirely from hand, deals 5 damage to M.O.R.B.I.U.S. — now in hero form, the same
 *   payment's own 2 generated resources deal 2 damage back to the identity through M.O.R.B.I.U.S.'s own Forced
 *   Response (Q24's other branch) — and, with the 1 damage staged on him, exactly defeats M.O.R.B.I.U.S. before the
 *   round ends. Ending the round reveals Inherited Burden (31025, the obligation): its own "discard 1 Interface
 *   upgrade you control" branch discards Host Spider (the identity's own attached Interface upgrade — the payment
 *   trace for Rapid Deployment above — is a legal alternative target, but is not the one picked here).
 * - Round 2: the round's one voluntary form change flips back to alter-ego. The counter and attachment that moved
 *   onto the identity in Round 1 stay with the identity (only the *support's own* counters/attachments move on a
 *   flip; nothing moves them back off the identity later), confirming the transition is a one-time handoff onto
 *   whichever physical card currently *is* the identity, not a per-form inventory that resets each flip.
 */

const SEED = 2026;
const SCRIPTED_SEED = 1;
const spdrVsRhino = (seed = SEED) => startWave5Game(spdrScenario("rhino", { seed }));

const ADVANCE = "01186";

/** `sessionApply`, throwing on an illegal command — every scripted step in this file goes through this, never bare
 * `applyCommand`/state surgery, so the resulting session log always replays deterministically. */
function step(session: GameSession, command: Command, pick: Picker = firstLegal): GameSession {
  const result = sessionApply(session, command, WAVE5_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return settleSession(result.session, pick);
}

/** Resolves every pending choice left by the last command with `pick`, each one its own logged `resolveChoice`. */
function settleSession(session: GameSession, pick: Picker): GameSession {
  let current = session;
  for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (stuck on ${current.state.pendingChoice.prompt.kind})`);
    const choice = current.state.pendingChoice;
    const result = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current.state),
      },
      WAVE5_DEPS,
    );
    if (!result.ok) throw new Error(`resolveChoice rejected: ${result.error.code}: ${result.error.message}`);
    current = result.session;
  }
  return current;
}

/** Accepts the named optional response/interrupt (by ability id); declines a `declareDefender` prompt outright;
 * pays a `payForCard` step with its own first N options; declines everything else. `../spiderham/e2e.test.ts`'s
 * own `accepting()`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "payForCard") return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Picks `target` at a `chooseTarget` prompt; otherwise behaves like `accepting()`. */
const targeting =
  (target: InstanceId, ...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTarget") return [target];
    return accepting(...wanted)(state);
  };

/** Moves a still-set-aside nemesis-set card straight into `P1`'s own play area, engaged — the shape a real
 * `revealCard` reveal actually leaves a minion in (`enterPlayOnReveal`, `packages/engine/src/resolve/reveal.ts`:
 * `case "minion": moveCard(ctx, id, { kind: "playArea", playerId })`, not `villainArea`). `obligation-nemesis.test.ts`'s
 * own `nemesisCardInPlay` precedent puts it in `villainArea` instead — harmless for that file's own tests (none of
 * them defeat him), but `checkDefeats`'s own ally/minion sweep (`packages/engine/src/resolve/defeat.ts`) only scans
 * `player.playArea`, so a minion staged into `villainArea` this way is never eligible to be swept for defeat at all.
 * This copy fixes that (this file's own scripted game does defeat him), rather than reproducing the same
 * mis-staging into a second file. */
function nemesisCardInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, P1);
  const wanted = cardId(code);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} set aside for P1`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: P1 },
      },
    },
  };
}

/** Attaches `attachmentId` (already in P1's hand, via `moveToHand`) to `hostId` directly (state surgery, not
 * `attachCard`) — `../spdr/allies.test.ts`'s own `attachFacedown` shape, minus the facedown flag (the instance
 * stays face-up), plus removing it from the hand array `moveToHand` left it in: `locateCard` (`packages/engine/src/
 * query.ts`) checks a player's own hand *before* `instance.attachedTo`, so a card structurally "attached" here but
 * still listed in hand would still `moveCard` as if it were being played from hand the next time something moves
 * it (Round 1's own flip to hero form below) — this is the real state a `playCard`/`attachCard` would have left it
 * in, not a shortcut that reads right but replays wrong. */
function attachDirectly(state: GameState, attachmentId: InstanceId, hostId: InstanceId): GameState {
  const withoutHand: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== attachmentId) } : p,
    ),
  };
  const withCard = patchInstance(withoutHand, attachmentId, { attachedTo: hostId });
  const host = inst(withCard, hostId);
  return patchInstance(withCard, hostId, { attachments: [...host.attachments, attachmentId] });
}

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

test("Rhino (standard), solo: SP//dr", () => {
  const config = spdrScenario("rhino", { seed: SEED });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard) — SP//dr: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (standard), solo: SP//dr — a scripted playthrough of her own kit", () => {
  // Every genuine data/state edit (module docblock) happens before `startSession` — every later step below is a
  // real, logged command.
  const base = spdrVsRhino(SCRIPTED_SEED);
  const identity = identityOf(base, P1);
  const suitId = playerOf(base, P1).identity.separatedCardInstanceId!;

  // M.O.R.B.I.U.S. (31027), already engaged with P1 and carrying 1 damage — so a single Web-Trap (5 damage) exactly
  // defeats him in Round 1 below, without ever letting him take a natural villain-phase activation of his own
  // (module docblock: this test never runs a villain phase with him still in play).
  const { state: withMorbius, id: morbius } = nemesisCardInPlay(base, "31027");
  const morbiusStaged = patchInstance(withMorbius, morbius, { damage: 1 });

  // A counter and a face-up attachment preset on the SP//dr Suit support — "as if some earlier ability had placed
  // them" (`identity.test.ts`'s own precedent for the counter half of this) — so Round 1's own flip to hero form
  // below has something real to hand over per §4.1 Q38.
  const counterStaged = patchInstance(morbiusStaged, suitId, { counters: { ammo: 2 } });
  // Forcefield Generator (31019): not otherwise played in this test, so its one instance here can't collide with
  // `moveToHand`'s own "not already claimed by this call" bookkeeping (`harness.ts`'s own `moveToHand`, which only
  // dedupes within a single call) the way reusing 31024 for both the attachment and the real Unshakable play did.
  const { state: withSpare, ids: spareIds } = moveToHand(counterStaged, P1, "31019");
  const [attachmentId] = spareIds as [InstanceId];
  const attachStaged = attachDirectly(withSpare, attachmentId, suitId);

  // Host Spider (Interface upgrade), Unshakable, Rapid Deployment and Web-Trap — the four cards this scripted game
  // actually plays — plus plenty of cost-irrelevant filler so every payment below has enough spare hand cards.
  const { state: handStaged, ids: stagedIds } = moveToHand(
    attachStaged,
    P1,
    "31010",
    "31024",
    "31005",
    "31006",
    "31016",
    "31016",
    "31016",
    "31017",
    "31017",
    "31017",
    "31023",
    "31023",
    "31023",
  );
  const [hostSpider, unshakable, rapidDeployment, webTrap, ...fillers] = stagedIds;
  const nextFiller = (() => {
    let i = 0;
    return () => fillers[i++]!;
  })();

  const mainScheme = handStaged.mainScheme.instanceId;
  const threatStaged = patchInstance(handStaged, mainScheme, { threat: 10 });

  // Round 1's own villain phase reveal — Inherited Burden (31025), SP//dr's obligation.
  const initial = stackEncounterDeck(threatStaged, ADVANCE, "31025");

  let session = startSession(initial);

  // Round 1 (alter-ego, the default opening form). Maintenance: exhaust the SP//dr Suit support, draw 2.
  session = step(session, use(P1, identity, "31002.maintenance"));
  expect(inst(session.state, suitId).exhausted).toBe(true);

  // Host Spider (31010, cost 3, Interface): an upgrade — enters play attached to the identity (no `attachesTo` of
  // its own, `support-upgrades.ts`'s own module docblock: it reads `YOUR_IDENTITY` directly), ready.
  session = step(session, play(P1, hostSpider!, [nextFiller(), nextFiller(), nextFiller()]));
  expect(cardsInPlay(session.state)).toContain(hostSpider);
  expect(inst(session.state, identity).attachments).toContain(hostSpider);
  expect(inst(session.state, hostSpider!).exhausted).toBe(false);

  // Unshakable (31024, cost 1), paid entirely from hand: 1 resource generated. M.O.R.B.I.U.S. is engaged, but the
  // engaged player (P1) is in alter-ego form — his own Forced Response deals no damage back (§4.1 Q24).
  const identityDamageBefore = inst(session.state, identity).damage;
  session = step(session, play(P1, unshakable!, [nextFiller()]));
  expect(cardsInPlay(session.state)).toContain(unshakable);
  expect(inst(session.state, identity).damage).toBe(identityDamageBefore); // unchanged: still alter-ego.
  expect(inst(session.state, morbius).damage).toBe(1); // unchanged: Unshakable never targets him.

  // Round 1's one voluntary form change: to hero form. Per §4.1 Q38, the counter and the attachment preset on the
  // SP//dr Suit support move onto the identity.
  session = step(session, toHero(P1));
  expect(currentName(session.state, identity)).toBe("SP//dr Suit");
  expect(inst(session.state, identity).counters.ammo).toBe(2);
  expect(inst(session.state, suitId).counters.ammo ?? 0).toBe(0);
  expect(inst(session.state, identity).attachments).toContain(attachmentId);
  expect(inst(session.state, suitId).attachments).not.toContain(attachmentId);
  expect(inst(session.state, attachmentId).attachedTo).toBe(identity);
  // §4.1 Q37: ready state follows the physical card — Maintenance's own cost exhausted the physical SP//dr Suit,
  // which is now the identity, so the identity comes out of this flip exhausted (`identity.ts`'s own module
  // docblock: "this leaves the *hero* form exhausted on the next flip").
  expect(inst(session.state, identity).exhausted).toBe(true);
  // The physical Peni Parker card (now the attached "SP//dr" upgrade side, same instance as `suitId`) carries over
  // her own prior ready state instead.
  expect(inst(session.state, suitId).exhausted).toBe(false);

  // Rapid Deployment (31005, cost 2), paid with 1 Sync Ratio resource (exhausting the identity's own attached
  // "SP//dr" upgrade side, an Interface upgrade in hero form) plus 1 hand card: the doubled effect fires, removing
  // 6 threat instead of 3 — Sync Ratio's own bonus (`identity.ts`'s own module docblock names this exact card).
  const threatBefore = inst(session.state, mainScheme).threat;
  session = step(
    session,
    play(P1, rapidDeployment!, [nextFiller()], {
      abilities: [
        {
          ability: {
            instanceId: identity,
            abilityId: "31001a.sync-ratio" as never,
            costChoices: { exhausted: [suitId] },
          },
        },
      ],
    }),
  );
  expect(inst(session.state, suitId).exhausted).toBe(true); // Sync Ratio's own cost.
  expect(inst(session.state, mainScheme).threat).toBe(threatBefore - 6);

  // Web-Trap (31006, cost 2), paid entirely from hand: 2 resources generated. Now in hero form, M.O.R.B.I.U.S.'s
  // own Forced Response deals that same amount back to the identity (§4.1 Q24's other branch) — and Web-Trap's own
  // effect deals 5 damage to M.O.R.B.I.U.S. himself, exactly defeating him (1 staged + 5 = his printed 6 HP).
  const identityDamageBeforeWebTrap = inst(session.state, identity).damage;
  session = step(
    session,
    play(P1, webTrap!, [nextFiller(), nextFiller()]),
    targeting(morbius, "31006.web-trap-action"),
  );
  expect(inst(session.state, identity).damage).toBe(identityDamageBeforeWebTrap + 2); // M.O.R.B.I.U.S.'s own damage.
  expect(cardsInPlay(session.state)).not.toContain(morbius); // defeated: exactly 6 damage on his printed 6 HP.

  // End Round 1: the villain phase's own reveal resolves Inherited Burden (31025). Its own "discard 1 Interface
  // upgrade you control" branch discards Host Spider.
  const endRound1Pick: Picker = (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseTarget") return [hostSpider!];
    const stay = choice.options.find((o) => o.label === "Stay in hero form");
    if (stay) return [stay.optionId];
    const discardBranch = choice.options.find((o) => o.label.startsWith("Choose and discard"));
    if (discardBranch) return [discardBranch.optionId];
    return firstLegal(state);
  };
  session = step(session, endTurn(P1), endRound1Pick);
  expect(session.state.round).toBe(2);
  expect(session.state.players[0]!.discard).toContain(hostSpider);
  expect(cardsInPlay(session.state)).not.toContain(hostSpider);
  expect(currentName(session.state, identity)).toBe("SP//dr Suit"); // "Stay in hero form" was picked.

  // Round 2's one voluntary form change: back to alter-ego. Only the support's *own* counters/attachments move on
  // a flip — the ones that moved onto the identity in Round 1 stay with the identity; nothing moves them back off.
  session = step(session, toHero(P1));
  expect(currentName(session.state, identity)).toBe("Peni Parker");
  expect(inst(session.state, identity).counters.ammo).toBe(2);
  expect(inst(session.state, identity).attachments).toContain(attachmentId);

  assertReplays(session);
});

test("Rhino (expert), solo: SP//dr", () => {
  // `wave5Scenario` falls through to `coreScenario` for a scenario with no `sm` entry (`rhino`, module docblock
  // above); `coreScenario`'s own `difficulty: "expert"` option (RRG 1.8 "Expert Mode", p. 29) is exactly
  // `../nova/e2e.test.ts`'s own "Rhino (expert), solo: Nova" precedent (itself modeled on `wave4/hood/e2e.test.ts`'s
  // own "(expert)" test) — the wave definition of done's own "one expert game … to an outcome, replay deep-equal"
  // requirement, missing for this pack until now. SP//dr has no scenario-specific expert wrinkle of her own, so
  // this only needs the plain `difficulty` option, played to a real outcome by the same card-name-agnostic greedy
  // driver as the standard game above — including her own separated-identity/Sync Ratio machinery, since the
  // driver plays every legal action generically, not just the ones the hand-scripted game above exercises.
  const config = spdrScenario("rhino", { seed: SEED, difficulty: "expert" });
  expect(config.difficulty).toBe("expert");
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (expert) — SP//dr: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("2-player, standard: SP//dr + Nova vs Rhino", () => {
  const config = spdrScenario("rhino", { seed: SEED, extraPlayers: [{ starterDeckId: "nova-aggression" }] });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  console.info(
    `[wave5 e2e] Rhino (standard, 2p) — SP//dr + Nova: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
