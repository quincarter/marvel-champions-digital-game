import { trait } from "@mc/content";
import type { CardSelector, EffectSpec, PlayerRef, TargetRef, ValueSpec } from "@mc/engine";
import { amount, you, type Amount } from "../../dsl/index.js";

/**
 * Small helpers local to the Thor (`thor`) pack, composing engine primitives that landed without DSL sugar of
 * their own (docs/phase7-wave1-scripting.md "Reprints" / "the rule: missing primitive"). None of these are new
 * engine primitives — every `kind` here is already a landed `EffectSpec`/`ValueSpec` (see docs/phase7-wave1.md
 * §3.13's write-up, which names the exact Thor cards each was added for) — they just don't have a `dsl/effects.ts`
 * or `dsl/values.ts` wrapper yet, and that file is shared (never edited by a pack agent).
 */

export const ASGARD = trait("Asgard");

/**
 * "Engage that enemy" (Get Over Here!, 06014). RRG 1.8 "Engage" (p. 18). Engine primitive `EffectSpec.engage`
 * (`packages/engine/src/spec.ts`); no `dsl/effects.ts` wrapper yet.
 */
export const engage = (minion: TargetRef, player: PlayerRef = you): EffectSpec => ({ kind: "engage", minion, player });

/**
 * "Put the others back in any order" (Heimdall, 06020). RRG 1.8 "Deck" (p. 15). Engine primitive
 * `EffectSpec.reorderCards` (`packages/engine/src/spec.ts`); no `dsl/effects.ts` wrapper yet.
 */
export const reorderCards = (cardsSel: CardSelector, chooser: PlayerRef = you): EffectSpec => ({
  kind: "reorderCards",
  cards: cardsSel,
  chooser,
  to: "encounterDeckTop",
});

/**
 * "For each different card type discarded this way" (Trickster, 06030). Engine primitive `ValueSpec.distinctCardTypes`
 * (`packages/engine/src/spec.ts`, named for this exact card); no `dsl/values.ts` wrapper yet.
 */
export const distinctCardTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "distinctCardTypes", cards: cardsRef });

/**
 * "This damage ignores tough status card[s]" (Lightning Strike, 06006, errata RRG 1.8 p. 65). Engine primitive
 * `EffectSpec.dealDamage.ignoreTough` (`packages/engine/src/spec.ts`, named for this exact card); `dsl/effects.ts`'s
 * `dealDamage` doesn't expose `ignoreTough` yet, so this builds the same plain-data shape directly.
 */
export const dealDamageIgnoringTough = (n: Amount, target: TargetRef): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: amount(n),
  ignoreTough: true,
});
