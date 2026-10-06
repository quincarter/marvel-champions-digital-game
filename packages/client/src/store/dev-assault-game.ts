/**
 * A real game stopped on the board with an assault scheme and the main scheme both there to thwart, for
 * `e2e/assault-thwart-preview.spec.ts` and the screenshots: She-Hulk (ATK and THW differ) with Keep Them Busy (43018,
 * Assault) in hand on his own turn in hero form, the main scheme already holding threat. Played forward through the
 * store with the engine's own example commands, never a state edit, so it replays like any saved game.
 */
import { CORE_STARTER_DECKS } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

const SHE_HULK_DECK = CORE_STARTER_DECKS.find((deck) => (deck.id as string) === "core-she-hulk-aggression")!;
const KEEP_THEM_BUSY = "43018";
const FILLER = "01054";

export function assaultSchemeConfig(): SessionConfig {
  const deck = SHE_HULK_DECK.cards.flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string));
  // One of the starter deck's Aggression resources makes room (Keep Them Busy is Aggression, so the deck stays legal).
  deck[deck.indexOf(FILLER)] = KEEP_THEM_BUSY;
  return {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ identityCardId: SHE_HULK_DECK.identityCardId as string, deck, aspects: ["aggression" as const] }],
    seed: 3,
    // The hand limit's discard takes the first card, so the card wanted sits last, behind five others.
    stack: { players: { 0: ids(FILLER, "01022", "01022", "01023", "01023", KEEP_THEM_BUSY) } },
  };
}

/** Plays forward to She-Hulk's turn in hero form holding Keep Them Busy with threat on the main scheme. */
export async function startAssaultSchemeGame(store: SessionStore): Promise<void> {
  await store.start(assaultSchemeConfig());
  for (let step = 0; step < 30; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const held = me.hand.some((id) => codeOf(game, id) === KEEP_THEM_BUSY);
    const mainThreat = game.instances[game.mainScheme.instanceId]?.threat ?? 0;
    if (me.identity.form !== "alterEgo" && held && mainThreat > 0) return;
    const flip =
      me.identity.form === "alterEgo" && held ? turn.legal.find((e) => e.action.kind === "changeForm") : null;
    const next = flip ?? turn.legal.find((e) => e.action.kind === "endTurn");
    if (!next) return;
    await store.dispatch(next.example);
  }
}
