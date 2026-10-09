/**
 * A real game stopped on Spider-Man's hero turn against Rhino with Surveillance Team in play and two side schemes
 * holding different threat (Crowd Control at 1 after a thwart, Breakin' & Takin' above it), for
 * `e2e/threat-popup.spec.ts` and the screenshots of the "choose a target" sheet's threat and hit point bars. Played
 * forward through the store with the engine's own example commands, never a state edit.
 */
import { CORE_STARTER_DECKS } from "@mc/content";
import { cardsInPlay } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

const SPIDER_MAN_DECK = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === "core-spider-man-justice")!;
export const SURVEILLANCE_TEAM = "01064";
export const CROWD_CONTROL = "01108";
export const BREAKIN_AND_TAKIN = "01107";
const BOOST_FILLER = "01110";

export function threatPopupConfig(): SessionConfig {
  const deck = SPIDER_MAN_DECK.cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string));
  return {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ identityCardId: SPIDER_MAN_DECK.identityCardId as string, deck, aspects: ["justice" as const] }],
    seed: 3,
    // The first villain phase deals the first encounter card, the second round's the next.
    stack: {
      players: { 0: ids("01083", "01084", "01085", "01086", "01087", SURVEILLANCE_TEAM) },
      encounter: ids(BOOST_FILLER, CROWD_CONTROL, BOOST_FILLER, BREAKIN_AND_TAKIN),
    },
  };
}

/** Plays forward to the hero turn with Surveillance Team in play and ready, both side schemes out, one thwarted. */
export async function startThreatPopupGame(store: SessionStore): Promise<void> {
  await store.start(threatPopupConfig());
  for (let step = 0; step < 40; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const inPlay = (code: string): boolean => cardsInPlay(game).some((id) => codeOf(game, id) === code);
    const held = me.hand.some((id) => codeOf(game, id) === SURVEILLANCE_TEAM);
    const ready = inPlay(SURVEILLANCE_TEAM);
    const schemes = inPlay(CROWD_CONTROL) && inPlay(BREAKIN_AND_TAKIN);
    if (me.identity.form === "alterEgo" && (held || ready)) {
      const flip = turn.legal.find((e) => e.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    if (me.identity.form !== "alterEgo" && held && !ready && schemes) {
      const play = turn.legal.find(
        (e) => e.action.kind === "playCard" && codeOf(game, e.action.instanceId) === SURVEILLANCE_TEAM,
      );
      const filler = me.hand.filter((id) => codeOf(game, id) !== SURVEILLANCE_TEAM);
      if (play?.example.type === "playCard" && filler.length >= 2) {
        await store.dispatch({ ...play.example, payment: filler.slice(0, 2).map((fromHand) => ({ fromHand })) });
        continue;
      }
    }
    if (ready && schemes && me.identity.form !== "alterEgo") {
      const thwart = turn.legal.find((e) => e.action.kind === "basicThwart");
      const crowd = game.instances;
      const target = cardsInPlay(game).find((id) => codeOf(game, id) === CROWD_CONTROL);
      if (thwart && target && (crowd[target]?.threat ?? 0) > 1 && thwart.example.type === "basicThwart") {
        await store.dispatch({ ...thwart.example, schemeInstanceId: target });
        continue;
      }
      return;
    }
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}

export const DAREDEVIL = "01058";
export const HYDRA_BOMBER = "01110";

export function enemyPopupConfig(): SessionConfig {
  const base = threatPopupConfig();
  return {
    ...base,
    stack: {
      players: { 0: ids("01083", "01084", "01085", "01086", "01087", DAREDEVIL) },
      // The first card is Rhino's boost in round 1; the second is dealt to Spider-Man in round 2's villain phase.
      encounter: ids(CROWD_CONTROL, HYDRA_BOMBER),
    },
  };
}

/**
 * Plays forward to Spider-Man's hero turn with Daredevil in play and ready and a Hydra Bomber out beside Rhino, so a
 * thwart by Daredevil ("after Daredevil thwarts, deal 1 damage to an enemy") asks which enemy.
 */
export async function startEnemyPopupGame(store: SessionStore): Promise<void> {
  await store.start(enemyPopupConfig());
  for (let step = 0; step < 40; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const inPlay = (code: string): boolean => cardsInPlay(game).some((id) => codeOf(game, id) === code);
    const held = me.hand.some((id) => codeOf(game, id) === DAREDEVIL);
    if (me.identity.form === "alterEgo" && (held || inPlay(DAREDEVIL))) {
      const flip = turn.legal.find((e) => e.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    if (me.identity.form !== "alterEgo" && inPlay(HYDRA_BOMBER)) {
      if (inPlay(DAREDEVIL)) return;
      const play = turn.legal.find(
        (e) => e.action.kind === "playCard" && codeOf(game, e.action.instanceId) === DAREDEVIL,
      );
      const filler = me.hand.filter((id) => codeOf(game, id) !== DAREDEVIL);
      if (play?.example.type === "playCard" && filler.length >= 4) {
        await store.dispatch({ ...play.example, payment: filler.slice(0, 4).map((fromHand) => ({ fromHand })) });
        continue;
      }
    }
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
