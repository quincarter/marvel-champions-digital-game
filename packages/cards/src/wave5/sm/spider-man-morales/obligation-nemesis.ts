import {
  addAccelerationToken,
  anyOf,
  anyOfCards,
  attacksGainKeywords,
  cards,
  choosePlayer,
  chosenPlayer,
  constant,
  defineAbilities,
  enemyAttack,
  firstPlayer,
  giveTough,
  identityOf,
  ifThen,
  isAlterEgo,
  isAttached,
  made,
  moveCards,
  named,
  not,
  remainingHpOf,
  self,
  superlativePlayer,
  surge,
  thatPlayer,
  valueEquals,
  varAtLeast,
  varOf,
  whenRevealed,
} from "../../../dsl/index.js";
import { obligation } from "../../../core/obligations.js";

/**
 * Keeping Secrets (27056), Spider-Man (Miles Morales)'s obligation, and his nemesis set: Tracking Prey (27057, side
 * scheme), Prowler (27058, nemesis minion), Razor Claws (27059, attachment), Slice and Dice ×2 (27060, treachery).
 *
 * **Keeping Secrets** fits the shared `obligation()` shape (`core/obligations.ts`) exactly: "Give to the Miles
 * Morales player. You may flip to alter-ego form. Choose: • Exhaust Miles Morales → remove Keeping Secrets from the
 * game. • Discard Ganke Lee and Jefferson Davis from play. If neither was discarded this way, this card gains
 * surge. Discard this obligation." Both named supports (27035/27036) are printed in his own precon
 * (`packages/content/src/data/sm/starterDecks.ts`), so `named(...)` — "the card in play with this exact printed
 * name" — finds either only if it is actually in play; `anyOfCards` pools both names for one `moveCards` (the
 * `nebula-obligation-nemesis.ts` "if no upgrade was discarded this way" precedent, `moved.count` read afterward).
 *
 * **Tracking Prey** and **Prowler**'s own "if you are in alter-ego form" When Revealed abilities are independent,
 * self-contained checks — no shared helper needed.
 *
 * **Razor Claws** attaches at the schema level (`attachesTo: { kind: "minionWithHighestPrintedHp" }`, resolved by
 * the engine's own reveal handling before this card's own When Revealed runs), matching Experimental Injection's
 * own docblock precedent (`ghost-spider/obligation-nemesis.ts`): only the "if you cannot, gains surge" check
 * (`isAttached(self)`) and "[star] Attached minion's attacks gain piercing" (`attacksGainKeywords` with
 * `attacker: { hostOfSelf: true }`, the `war-machine`/`ransacked-armory` precedent) are scripted.
 *
 * **Slice and Dice**'s "the player with the fewest remaining hit points (even if that player is in alter-ego
 * form)" is `choosePlayer` + `superlativePlayer("lowest", remainingHpOf(identityOf(thatPlayer)))`, the exact `Kree
 * Fanatic` (`wave3/ron/kree-fanatic.ts`) precedent — an `identity` query/ref matches whichever face is up, so
 * reading hit points off `identityOf(thatPlayer)` already covers a player in alter-ego form without a separate
 * check. The printed text's own "If that attack defeats a character **or not** attack was made this way" is read
 * as "or **no** attack was made this way" (the standard "if no attack was made this way, gains surge" shape every
 * other enemy-attack treachery in this pool uses, e.g. Ghost-Spider's In Cold Blood) — a transcription typo, not a
 * distinct rule. "Defeats a character" reads the same `enemyAttack` `bind`'s `.defeated` var `attack`'s own bind
 * already exposes for a player-initiated attack (Stealth Strike, `bkw/pack-cards.ts` 08013; Hard Knocks, `drax/
 * drax-kit.ts` 19016) — `reportResults` (`packages/engine/src/resolve/event.ts`) copies every var an event frame
 * collected (including one a nested defeat wrote there via `addFrameVars`) into `<bind>.<key>` when it finishes,
 * with no difference between a player's own `attack` event and an `enemyAttack` event on this path.
 */
export const SPIDER_MAN_MORALES_OBLIGATION_NEMESIS = defineAbilities({
  // Keeping Secrets — Give to the Miles Morales player. You may flip to alter-ego form. Choose:
  // • Exhaust Miles Morales → remove Keeping Secrets from the game.
  // • Discard Ganke Lee and Jefferson Davis from play. If neither was discarded this way, this card gains surge.
  //   Discard this obligation.
  "27056.obligation": obligation("Miles Morales", {
    label: "Discard Ganke Lee and Jefferson Davis from play",
    effects: [
      moveCards(anyOfCards(cards(named("Ganke Lee")), cards(named("Jefferson Davis"))), "discard", "moved"),
      ifThen(valueEquals(varOf("moved.count"), 0), surge()),
    ],
  }),

  // Tracking Prey — When Revealed: If you are in alter-ego form, place 1 acceleration token here.
  "27057.when-revealed": whenRevealed(ifThen(isAlterEgo(), addAccelerationToken(self))),

  // Prowler (nemesis minion) — Stalwart (data). When Revealed: If you are in alter-ego form, give Prowler a tough
  // status card.
  "27058.when-revealed": whenRevealed(ifThen(isAlterEgo(), giveTough(self))),

  // Razor Claws — Attach to the minion with the highest printed hit points (schema-level `attachesTo`). If you
  // cannot, this card gains surge.
  "27059.razor-claws-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Razor Claws — [star] Attached minion's attacks gain piercing.
  "27059.razor-claws-constant-2": constant(attacksGainKeywords(["piercing"], { attacker: { hostOfSelf: true } })),

  // Slice and Dice — When Revealed: Prowler attacks the player with the fewest remaining hit points (even if that
  // player is in alter-ego form). If that attack defeats a character or no attack was made this way, this card
  // gains surge (module docblock: "or not attack" read as "or no attack").
  "27060.when-revealed": whenRevealed(
    choosePlayer("fewest", firstPlayer, {
      among: superlativePlayer("lowest", remainingHpOf(identityOf(thatPlayer))),
    }),
    enemyAttack(named("Prowler"), { against: chosenPlayer("fewest"), bind: "slice" }),
    ifThen(anyOf(not(made("slice")), varAtLeast("slice.defeated")), surge()),
  ),
});
