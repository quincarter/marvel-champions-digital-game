import {
  after,
  cards,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  giveTough,
  moveCards,
  ofIdentitySetTitled,
  query,
  response,
  setup,
  shuffleDeck,
  statusLimit,
  yourIdentity,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Colossus / Piotr Rasputin (32001a/b, MC32 p. 22): docs/phase7-wave6.md §2.1, §3.5-§3.7. His obligation (Homesick,
 * 32025) and nemesis set (Juggernaut, 32026-32029) are scripted separately (`obligation-nemesis.ts`, not started);
 * his signature kit (32002-32024 range) is `events.ts` / `support-upgrades-allies.ts`, not started.
 *
 * - **Colossus (hero, 32001a)**: "Colossus can have 1 additional tough status card." `statusLimit("tough", 2, ...)`
 *   (§3.7): the base one plus one. Each tough card still prevents one damage event on its own; piercing discards
 *   them all. "Steel Skin - Response: After you change to this form, give Colossus a tough status card."
 * - **Piotr Rasputin (alter-ego, 32001b)**: "Setup: Search your deck for a copy of Organic Steel and add it to your
 *   hand." The search is of the deck only, as printed (setup resolves after the opening draw, so a copy already in the
 *   opening hand is simply not in the deck), then the deck is shuffled. "Aspiring Artist - Response: After you
 *   change to this form, shuffle a Colossus card from your discard pile into your deck": "a Colossus card" is a card
 *   of his identity-specific set (RRG 1.8 "Identity-Specific Card", p. 23), not a card named Colossus.
 *
 * His Q5 reading (docs/phase7-wave6.md §4.1): several tough cards discarded by one step (piercing, Homesick) announce
 * one `statusDiscarded` each in one shared response window; the identity has no such response itself (Iron Will and
 * Organic Steel do, in `support-upgrades-allies.ts`).
 */
export const COLOSSUS_IDENTITY = defineAbilities({
  "32001a.colossus-constant": constant(statusLimit("tough", 2, { self: true })),
  "32001a.colossus-constant-2": response(after.youChangeForm(), giveTough(yourIdentity)),

  "32001b.setup": setup(
    chooseCards("found", zone("deck", you, { filter: query("upgrade", { name: "Organic Steel" }) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
  "32001b.piotr-rasputin-constant": response(
    after.youChangeForm(),
    chooseCards(
      "found",
      zone("discard", you, {
        filter: query(["ally", "event", "upgrade", "support"], { ...ofIdentitySetTitled("Colossus") }),
      }),
      // "Shuffle a Colossus card": a card is required, so with none in the discard pile the response is not offered at
      // all (RRG 1.8 "Choose (Game Element)", p. 12, and "Target", p. 42: an ability that requires a choice with no
      // valid candidate cannot be initiated), instead of being offered to do nothing.
      {
        min: 1,
        max: 1,
      },
    ),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),
});
