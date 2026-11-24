/**
 * The `?screen=board&fixture=repurpose` dev jump (`scenes/boot-dev-jump.ts`): a real solo Thanos game with Iron Man in hero
 * form, a row of Tech upgrades in play and Repurpose (31016) in hand, so its "Discard a Tech upgrade you control" cost
 * offers more cards than a phone's pick panel shows at once (the cards must scroll there; reported on an iPhone from
 * Discord). Played forward through the store with the engine's own commands, never a state edit.
 */
import type { GameState, InstanceId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, copies, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const REPURPOSE = "31016";
/**
 * Iron Man's Tech upgrades (Arc Reactor, Mark V Armor, Mark V Helmet, Powered Gauntlets, Rocket Boots) and SP//dr's
 * protection ones (Energy Barrier, Forcefield Generator). Iron Man's hand grows with each Tech upgrade he wears.
 */
const TECH = new Set(["01035", "01036", "01037", "01038", "01039", "31018", "31019"]);
/** How many Tech upgrades the game plays before it stops. */
export const REPURPOSE_TECH_WANTED = 7;

/** Iron Man's own cards (his identity set). */
const IRON_MAN = ["01030", ...copies("01031", 3), ...copies("01032", 2), "01033", "01034", "01035", "01036", "01037"];
/**
 * A legal 40-card protection deck: Iron Man's set, Repurpose and SP//dr's protection Tech upgrades, the core basic cards
 * and a few of Black Panther's protection cards.
 */
const DECK = [
  ...IRON_MAN,
  ...copies("01038", 2),
  ...copies("01039", 2),
  ...copies(REPURPOSE, 3),
  ...copies("31018", 3),
  ...copies("31019", 3),
  ...["01083", "01084", "01085", "01086", "01087", "01088", "01089", "01090", "01091", "01092", "01093"],
  ...copies("01077", 2),
  ...copies("01078", 2),
  "01079",
];

/** The cheap Tech upgrades first, each hand holding cards to pay for them, and Repurpose on top. */
export const REPURPOSE_CONFIG: SessionConfig = {
  scenarioId: "thanos",
  difficulty: "standard",
  players: [{ identityCardId: "01029a", deck: DECK, aspects: ["protection"] }],
  seed: 1,
  stack: {
    players: {
      0: ids(
        REPURPOSE,
        "01039",
        "01037",
        "01083",
        "01084",
        "01085",
        "01038",
        "01086",
        "01039",
        "01087",
        "01088",
        "01089",
        "01035",
        "01090",
        "01038",
        "01091",
        "01092",
        "01093",
        "31018",
        "01077",
        "01078",
        "31018",
        "01077",
        "01078",
      ),
    },
  },
};

/** The Tech upgrades in play: the play area's, and every one attached to a card (Iron Man wears his). */
export function techInPlay(game: GameState): readonly InstanceId[] {
  const me = game.players[0];
  if (!me) return [];
  const found: InstanceId[] = [];
  const visit = (id: InstanceId): void => {
    if (TECH.has(codeOf(game, id))) found.push(id);
    for (const child of game.instances[id]?.attachments ?? []) visit(child);
  };
  for (const id of [me.identity.instanceId, ...me.playArea]) visit(id);
  return found;
}

export async function startRepurposeGame(store: SessionStore): Promise<void> {
  await store.start(REPURPOSE_CONFIG);
  for (let step = 0; step < 120; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const repurposes = me.hand.filter((id) => codeOf(game, id) === REPURPOSE);
    if (me.identity.form === "hero" && techInPlay(game).length >= REPURPOSE_TECH_WANTED && repurposes.length > 0)
      return;
    let played = false;
    for (const entry of turn.legal) {
      const action = entry.action;
      if (action.kind !== "playCard" || entry.example.type !== "playCard") continue;
      if (!TECH.has(codeOf(game, action.instanceId))) continue;
      // Pay with what is neither a Tech upgrade nor the one Repurpose kept for the end.
      const others = me.hand.filter(
        (id) => id !== action.instanceId && id !== repurposes[0] && !TECH.has(codeOf(game, id)),
      );
      for (let count = 0; count <= others.length && !played; count++) {
        await store.dispatch({ ...entry.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
        if (!store.state.error) played = true;
      }
      if (played) break;
    }
    if (played) continue;
    // Recover in alter ego and thwart in hero form whenever he can, so neither the villain's attacks nor the main scheme end
    // the game first, and change form once a turn.
    const rest = turn.legal.find((entry) => entry.action.kind === "basicRecover");
    if (rest && (game.instances[me.identity.instanceId]?.damage ?? 0) > 0) {
      await store.dispatch(rest.example);
      continue;
    }
    const thwart = turn.legal.find((entry) => entry.action.kind === "basicThwart");
    if (thwart) {
      await store.dispatch(thwart.example);
      continue;
    }
    const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
    const ready = techInPlay(game).length >= REPURPOSE_TECH_WANTED && repurposes.length > 0;
    if (flip && (me.identity.form === "alterEgo" || !ready)) {
      await store.dispatch(flip.example);
      continue;
    }
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
