/**
 * The `?screen=board&fixture=combat-sense` dev jump (`scenes/boot-dev-jump.ts`): a solo Rhino game with the Mod Store's
 * Spider-Punisher (`spider-punisher-tw`, installed first) in hero form, two Weapon upgrades in play and Enhanced Combat
 * Sense in hand on round 2, so paying for it shows one tile per upgrade its star exhausts (issue #966). Played forward through the
 * store with the engine's own commands, never a state edit; the upgrades are paid for with the other cards in hand.
 * Without the pack installed it starts nothing.
 */
import { cardsInPlay } from "@mc/engine";
import { loadedPacks } from "../packs/pack-registry.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

const PACK = "spider-punisher-tw";
const P = `x.${PACK}.`;
const COMBAT_SENSE = `${P}02`;
/** EMP Rounds (cost 1) and Armor-Piercing Rounds (cost 2): Tech Weapon upgrades. */
const UPGRADES: Record<string, number> = { [`${P}09`]: 1, [`${P}08`]: 2 };
/** The cards that pay for the upgrades: never Combat Sense or another upgrade. */
const FILLERS = ["20022", "08031", "01071"];

export async function startCombatSenseGame(store: SessionStore): Promise<void> {
  const packs = loadedPacks().filter((pack) => pack.id === PACK);
  const deck = packs[0]?.decks[0];
  if (!deck) return;
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: deck.id as string }],
    seed: 3,
    packs,
    stack: { players: { 0: ids(`${P}09`, `${P}08`, COMBAT_SENSE, ...FILLERS) } },
  });
  for (let step = 0; step < 20; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    if (me.identity.form === "alterEgo") {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (!flip) return;
      await store.dispatch(flip.example);
      continue;
    }
    const live = new Set(cardsInPlay(game));
    const placed = [...live].filter((id) => codeOf(game, id) in UPGRADES).length;
    // The upgrades's payments empty the hand: the next round draws it back up, with both upgrades ready.
    if (placed >= 2) {
      const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) return;
      if (game.round > 1) {
        await store.dispatch(end.example);
        await toCombatSenseWindow(store);
        return;
      }
      await store.dispatch(end.example);
      continue;
    }
    const play = turn.legal.find(
      (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) in UPGRADES,
    );
    if (!play || play.action.kind !== "playCard" || play.example.type !== "playCard") return;
    const cost = UPGRADES[codeOf(game, play.action.instanceId)]!;
    const payers = me.hand.filter((id) => FILLERS.includes(codeOf(game, id))).slice(0, cost);
    await store.dispatch({ ...play.example, payment: payers.map((fromHand) => ({ fromHand })) });
  }
}

/**
 * Ends on the window Enhanced Combat Sense's interrupt answers ("When an encounter card is revealed from the encounter
 * deck"), with its trigger picked, so the board asks for its payment. Every other choice takes its minimum.
 */
async function toCombatSenseWindow(store: SessionStore): Promise<void> {
  for (let step = 0; step < 40; step++) {
    const game = store.state.game;
    const actions = store.state.legal?.actions;
    if (!game || game.outcome || actions?.kind !== "choice") return;
    const { choice } = actions;
    const ours = choice.options.find((option) => JSON.stringify(option).includes(COMBAT_SENSE));
    if (ours) return;
    const picks =
      choice.prompt.kind === "discardDownToHandSize"
        ? choice.options.slice(choice.options.length - choice.minSelections)
        : choice.options.slice(0, choice.minSelections);
    await store.resolveChoice(picks.map((o) => o.optionId));
  }
}
