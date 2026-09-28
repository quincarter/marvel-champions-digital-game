import { trait } from "@mc/content";
import type { TargetQuery } from "@mc/engine";
import {
  addCounters,
  after,
  allOf,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  draw,
  eventAmount,
  eventTarget,
  exists,
  ifThen,
  interrupt,
  lookAt,
  moveCards,
  on,
  option,
  playOnlyIf,
  query,
  refMatches,
  removeThreat,
  response,
  self,
  valueAtLeast,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const WEB_WARRIOR = trait("WEB-WARRIOR");

/**
 * "A Web-Warrior card you control": every category a printed Web-Warrior trait can carry in this box's own pool
 * (his identity Spider-Ham prints no such trait, but Lady Spider, Spider-Man/Pavitr, Scarlet Spider, SP//dr, and
 * the basic support Web of Life and Destiny (30023) all do) — the `sm/ghost-spider` precedent's own
 * `A_WEB_WARRIOR_CARD` shape (`categories: ["identity", "ally", "upgrade", "support"]`), scoped to this module.
 */
const A_WEB_WARRIOR_CARD: TargetQuery = {
  categories: ["identity", "ally", "upgrade", "support"],
  trait: WEB_WARRIOR,
  controller: "you",
};

/**
 * Spider-Ham's own non-signature allies (`spiderham` 30002, 30012, 30013, 30020, 30021; Spider-Ham Hero Pack p. 1,
 * 3-4): Captain Americat (30002), Lady Spider (30012), Spider-Man / Pavitr Prabhakar (30013), Scarlet Spider
 * (30020), SP//dr (30021). Read directly off `packages/content/src/data/spiderham/cards.ts` (no errata on RRG 1.8
 * pp. 67-68, confirmed against each card's own scan, `assets/card-art/bundles/cards/<id>.png`).
 *
 * **Captain Americat (30002)** — "Response: After Captain Americat enters play, give someone a high five. Place 1
 * toon counter on your identity and shuffle 1 Spider-Ham card from your discard pile into your deck." "Give someone
 * a high five" is a purely social/narrative instruction with no game-state effect — the same "unscripted flavor
 * direction" reasoning `events.ts`'s own docblock already gives for this exact clause (30004/30005). "1 Spider-Ham
 * card" reads as this player's own identity-specific set (`identitySetOf: you`, RRG 1.8 "Identity-Specific Card",
 * p. 23) rather than a literal name match: no other card in this box is printed with the bare name "Spider-Ham"
 * (only the identity's hero face carries that title; every ally here has its own name), the Quicksilver/Nova
 * "shuffle N [Hero] cards from your discard pile into your deck" precedent (`wave2/qsv/kit.ts` 14007, `wave5/nova/
 * support-upgrades-allies.ts` 28008) for exactly this shape, not the "several differently-typed cards share one
 * printed name" reading Miles Morales's own alter-ego response needs (`wave5/sm/spider-man-morales/identity.ts`
 * 27030b). `min: 0, max: 1` is forgiving when the discard pile holds no such card (the same War Machine/Miles
 * Morales "shuffle 1 named card" idiom), so a missing copy leaves the toon counter placed instead of failing the
 * whole Response.
 *
 * **Lady Spider (30012)** — "[star] Response: After Lady Spider thwarts and removes threat from a scheme, if you
 * control another Web-Warrior card, remove an equal amount of threat from a different scheme." The printed
 * "[star]" is the card's own unique-icon glyph (Agent 13's own precedent, `wave5/ironheart/allies.ts` module
 * docblock), not a keyword — scripted as a plain `response`. `on.thwarts("self")` is the trigger; `eventAmount`
 * *should* read the thwart's own removal amount (RRG 1.8 "Thwart", p. 44), the same way Museum Ship's Interrupt
 * reads a damage event's amount (`wave3/gmw/museum.ts`) — gated `valueAtLeast(eventAmount, 1)` so a thwart that
 * removed no threat (0 THW, confused) never opens the "different scheme" choice, matching "thwarts **and removes
 * threat**". **In practice, for her own basic thwart, `eventAmount` currently always reads 0 — a known engine gap,
 * this ability's own inline comment below** (a basic thwart's `TriggerEvent` carries no resolved amount at all).
 * "If you control another Web-Warrior card" is `exists` on `A_WEB_WARRIOR_CARD` with `self: false` (Lady Spider
 * herself does not count as "another"; unaffected by the gap, since it never reaches the amount check at all when
 * false). "A different scheme" excludes the just-thwarted scheme via `TargetQuery.excluding: eventTarget`
 * (`packages/engine/src/spec.ts`'s own worked example is exactly this shape), not `excludeSlots` (that excludes a
 * *chosen slot* from earlier in the same ability, the wrong tool for excluding an externally-triggered event's own
 * target).
 *
 * **Spider-Man / Pavitr Prabhakar (ally, 30013)** — "Response: After Spider-Man enters play, remove 1 threat from
 * a scheme for each Web-Warrior card you control (including Spider-Man)." By the time this Response resolves he is
 * already in play, so `countOf(A_WEB_WARRIOR_CARD)` (no `self: false`) counts him automatically — the same reading
 * the printed parenthetical spells out, needing no extra term. A different card from `sm`'s own hero identity
 * "Spider-Man" (Miles Morales, 27030a/b) and its allies of the same name (27011, 27017, 27049): this module's own
 * ability id namespace (`30013.…`) never collides with theirs.
 *
 * **Scarlet Spider (30020)** — "Play only if you control a Web-Warrior card.\nInterrupt: When you would reveal an
 * encounter card, name a card type, then look at that card. If that card is of the named type, deal 1 damage to
 * Scarlet Spider and draw 1 card." `playOnlyIf(exists(A_WEB_WARRIOR_CARD))` is the Ghost-Spider/Vivian precedent
 * (`wave5/sm/ghost-spider/support-upgrades-allies.ts` 27017, `wave5/ironheart/allies.ts` 29024's own module note)
 * verbatim. `{ ...on.encounterCardRevealed(), playerIn: you }` is Spider-Ham's own "I Don't Think So!" precedent
 * (`events.ts` 30005) for "when **you** reveal a card" — the interrupt window fires before the card resolves, the
 * literal "would reveal" moment (RRG 1.8 "Reveal"). "Name a card type, then look at that card" is Cosmo's own
 * blind-guess-then-look shape (`wave4/nebu/nebula-pack-cards.ts` 22020, copied from `stld` 17020): one `chooseOne`
 * option per encounter card type (the same five Cosmo's own "the encounter deck" branch offers — minion, side
 * scheme, attachment, treachery, obligation), the naming happening *before* any effect reveals the card's actual
 * type, so it is a genuine guess, not an informed choice. `lookAt(cards(eventTarget))` is the printed "look at that
 * card" itself (RRG 1.8 "Look, Looked-At", p. 27) — the card being revealed, not a fresh draw off the top of a
 * deck, so `eventTarget` (not `topOfDeck`/`encounterCards`) is both what's looked at and what `refMatches` compares
 * against the named option's own category, with `anywhere: true` since the card is not "in play" while its reveal
 * is still pending (`refMatches`'s own docblock, Gamora 18001b's precedent).
 *
 * **SP//dr (ally, 30021)** — "Play only if you control a Web-Warrior card.\nWhen Defeated: Add SP//dr to your hand
 * if she was defeated by taking excess consequential damage." The play restriction is the same `playOnlyIf`
 * constant as Scarlet Spider above. **The When Defeated half is a known engine gap, left unscripted**: a
 * `characterDefeated` `TriggerEvent` (`packages/engine/src/trigger-events.ts`) carries `fromAttack` (was the
 * defeating damage an attack's) and `excessDamage` (read by `ValueSpec defeatExcessDamage`,
 * `packages/cards/src/dsl/values.ts`), but nothing records whether the defeating damage was specifically an ally's
 * *consequential* damage (`dealDamage.consequential`, set by `pushConsequentialDamage`,
 * `packages/engine/src/actions.ts`) — `DefeatHint` (`packages/engine/src/resolve/defeat.ts`) has no `consequential`
 * field to thread that flag from the damage event through `checkDefeats`'s sweep into the `characterDefeated` event
 * a `whenDefeated` ability reads. Building "if she was defeated by taking excess consequential damage" faithfully
 * needs that field added to `DefeatHint`/`characterDefeated` (threaded from `pushConsequentialDamage`'s own
 * `dealDamage` call, `packages/engine/src/actions.ts` ~L2796) and a `ValueSpec`/`Predicate` alongside
 * `defeatExcessDamage`/`defeatedWithExcessDamage` to read it — a `game-rules-architect` primitive, not something
 * this module can approximate without silently misreading an ordinary attack/treachery defeat as a consequential
 * one. `30021.when-defeated` is intentionally **not** registered here pending that primitive (`allies.test.ts` pins
 * the gap with a documented `it.skip`).
 */
export const SPIDERHAM_ALLIES = defineAbilities({
  "30002.captain-americat-response": response(
    after.entersPlay("self"),
    addCounters("toon", 1, yourIdentity),
    chooseCards("found", zone("discard", you, { filter: { identitySetOf: you } }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  // **Known engine gap** (module docblock): a *basic* thwart's own "thwart" `TriggerEvent` never carries the
  // resolved amount removed (`packages/engine/src/actions.ts`'s basic-thwart command handler pushes `{ kind:
  // "thwart", ... }` with no `amount` field at all — only its "divided"/multi-scheme branch, and a "(thwart)"-
  // labeled ability's own `thwart` `EffectSpec` (`packages/engine/src/resolve/apply-effect.ts`'s `case "thwart"`),
  // set one). `applyPlayerThwart` still resolves the *actual* removal correctly (`event.amount ?? thwarter.thw`),
  // but that resolved number is never written back onto the event object a later response reads — so `eventAmount`
  // here reads 0 for the overwhelmingly common case (her own basic thwart), even though the thwart itself worked.
  // The nested `removeThreat` event `applyPlayerThwart` pushes *does* carry the real amount, but listening for it
  // sourced by Lady Spider herself is unsafe: this same ability's own `removeThreat` effect on "a different scheme"
  // is *also* a `removeThreat` event sourced by her, so that pattern re-triggers on its own effect (confirmed:
  // draining both schemes to 0 through repeated self-triggering instead of moving threat once). Needs an engine
  // primitive — either the basic-thwart event carrying its resolved amount, or an `EventPattern` way to require a
  // `removeThreat`'s immediate parent frame be a `thwart` (excluding one raised by an ability's own effect) — not
  // a per-card workaround. Implemented to the letter of the printed trigger below; `allies.test.ts` documents which
  // half is currently unverifiable and why.
  "30012.lady-spider-response": response(
    on.thwarts("self"),
    ifThen(allOf(valueAtLeast(eventAmount, 1), exists({ ...A_WEB_WARRIOR_CARD, self: false })), [
      chooseTarget("scheme", query("scheme", { excluding: eventTarget })),
      removeThreat(eventAmount, chosen("scheme")),
    ]),
  ),

  "30013.spider-man-response": response(
    after.entersPlay("self"),
    chooseTarget("scheme", query("scheme")),
    removeThreat(countOf(A_WEB_WARRIOR_CARD), chosen("scheme")),
  ),

  "30020.scarlet-spider-constant": constant(playOnlyIf(exists(A_WEB_WARRIOR_CARD))),
  "30020.scarlet-spider-interrupt": interrupt(
    { ...on.encounterCardRevealed(), playerIn: you },
    chooseOne(
      ...(["minion", "sideScheme", "attachment", "treachery", "obligation"] as const).map((category) =>
        option(
          category,
          lookAt(cards(eventTarget)),
          ifThen(refMatches(eventTarget, query(category), { anywhere: true }), [dealDamage(1, self), draw(1)]),
        ),
      ),
    ),
  ),

  "30021.sp-dr-constant": constant(playOnlyIf(exists(A_WEB_WARRIOR_CARD))),
  // "When Defeated: Add SP//dr to your hand if she was defeated by taking excess consequential damage." — known
  // engine gap (module docblock): no `characterDefeated`/`DefeatHint` field records that the defeating damage was
  // specifically consequential. Intentionally unregistered pending that primitive.
});
