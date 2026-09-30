import { addCounters, countersAsResource, defineAbilities, on, response } from "../../dsl/index.js";

/**
 * Spider-Ham / Peter Porker (30001a/b, Spider-Ham Hero Pack p. 1): read directly off
 * `packages/content/src/data/spiderham/cards.ts` (no errata on RRG 1.8 pp. 67-68, no `spiderham.ts` curation
 * correction on either face). His signature events/support/upgrades/allies (30002-30023) are a separate module
 * (`support-upgrades-allies.ts`/`events.ts`, not yet built); his obligation ("I Really Want a Hot Dog!", 30024) and
 * nemesis set (Nefarious Trap/The Green Gobbler/Gobbler Glider/"Feast on This!" ×2, 30025-30028) and the pack's
 * modular encounter set (The Inheritors, 30029-30038 — note 30029, Warrior of the Great Web, is a `basic` aspect
 * player upgrade, not part of the modular set) are likewise separate (`obligation-nemesis.ts`/`inheritors.ts`, not
 * yet built).
 *
 * **Spider-Ham (hero, 30001a) — no named title on the first line**: "Each toon counter on Spider-Ham can be spent
 * as if it were a [wild] resource." `countersAsResource("toon")` is the primitive built for this exact card
 * (docs/phase7-wave5.md §3.25's own docblock in `dsl/abilities.ts` cites `spiderham` 30001a by id) — a `repeatable`
 * resource ability whose cost removes one toon counter per use, `spentAsIfResource: true` so it does not count as
 * "generating" toward M.O.R.B.I.U.S.-style triggers (§4.1 Q5, built f959030c). No `constant()` wrapper: `resource`
 * abilities are usable-in-payment by construction, the same bare shape every other `Resource:`/counters-as-resource
 * ability in this codebase uses.
 *
 * **Spider-Nonsense — Response** (still hero face): "After Spider-Ham takes any amount of damage, place 1 toon
 * counter on him." `on.damage("self", { taken: true })` is "after X takes damage" (`taken` requires the amount dealt
 * was ≥ 1, `dsl/abilities.ts`); `addCounters("toon", 1)` defaults its target to `self`. Bare `response` (not
 * `heroResponse`): an ability printed on the hero face is only ever registered while that face's abilities are
 * active, the same shape Nova's identically-structured "After you use one of Nova's basic powers" response uses
 * (`wave5/nova/identity.ts` 28001a) and Quicksilver's Super Speed / Ghost-Spider's Dizzying Reflexes before it — no
 * printed limit, so none here either.
 *
 * **Cartoon Power — Response** (alter-ego, 30001b): "After you make a basic recovery, place 1 toon counter on
 * Peter Porker." `on.basicPowerUsed("self")` has no way to filter to *which* basic power (`dsl/abilities.ts`'s own
 * docblock on `basicPowerUsed`), but Peter Porker's alter-ego face prints no ATK/THW/DEF stat at all — an
 * alter-ego identity with no printed value for a basic power cannot declare that power (RRG 1.8 "Basic Power," a
 * character needs the matching printed icon/value), so the *only* basic power reachable while this ability is even
 * active is recovery. That is the same reasoning Groot's Lashing Vines (`gmw` 16009, `wave3/gmw/groot-kit.ts`) uses
 * in the opposite direction — a Hero Response's own form gate excludes an alter-ego-only recovery from ever
 * reaching it. No printed limit on this response either.
 */

export const SPIDERHAM_IDENTITY = defineAbilities({
  "30001a.spider-ham-constant": countersAsResource("toon"),
  "30001a.spider-nonsense": response(on.damage("self", { taken: true }), addCounters("toon", 1)),
  "30001b.cartoon-power": response(on.basicPowerUsed("self"), addCounters("toon", 1)),
});
