import { trait } from "@mc/content";
import {
  addCounters,
  alterEgoResponse,
  chosen,
  constant,
  countersOn,
  defineAbilities,
  each,
  flipCard,
  gainsTrait,
  gets,
  heroResource,
  ifThen,
  on,
  oncePerPhase,
  putIntoPlayFromSetAside,
  named,
  query,
  removeCounter,
  self,
  forcedResponse,
  setup,
  valueAtLeast,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

const RESTRAINED = trait("RESTRAINED");
const UNLEASHED = trait("UNLEASHED");
const THIS_CARD = query("upgrade", { self: true });
/** Phoenix Force is attached to its controller's identity, so "Phoenix" is its host. */
const PHOENIX = { hostOfSelf: true } as const;
/** "Phoenix Force": the one you control (the cost refuses a ref naming none or several, wave 6 §3.85). */
const YOUR_PHOENIX_FORCE = each(query("upgrade", { name: "Phoenix Force", controller: "you" }));

/**
 * Phoenix / Jean Grey (34001a/b) and Phoenix Force (34002a/b, a two-sided permanent upgrade): docs/phase7-wave6.md
 * §6.1, §3.2, §3.74, §4.1 Q24, Q25. The rest of her kit (34003-34027), obligation (34028) and Dark Phoenix nemesis
 * set (34029-34032) are separate modules, not started.
 *
 * - **Psionic Bond (34001a)**: a hero resource whose cost removes a power counter from Phoenix Force, not from her
 *   identity (§3.85); unpayable with none there. Removing the last one flips Phoenix Force before the card it pays for.
 * - **Setup (34001b)**: Phoenix Force is permanent, so it was set aside before setup step 1 (RRG 1.8 "Permanent",
 *   p. 32) and is taken from there, Restrained side (its front) up, attached to her identity, with 4 power counters.
 * - **Jean Grey's star response** places a power counter after a basic recovery. Phoenix Force is not a form card:
 *   its two sides flip with `flipCard`, never the once-per-round form change.
 * - **Restrained (34002a)**: forced response, after the last power counter is removed, flip it. Rise from the Ashes
 *   removing every counter therefore flips it (Q24); with no counters nothing is removed and nothing flips.
 * - **Unleashed (34002b)**: forced response, after a power counter is placed here, if it now has 4 or more, flip it
 *   back to Restrained.
 */
export const PHOENIX_IDENTITY = defineAbilities({
  "34001a.psionic-bond": heroResource(
    { wild: 1 },
    { cost: removeCounter("power", 1, { from: YOUR_PHOENIX_FORCE }), limit: oncePerPhase },
  ),

  "34001b.setup": setup(
    putIntoPlayFromSetAside("force", query("upgrade", { name: "Phoenix Force" }), { attachTo: yourIdentity }),
    addCounters("power", 4, chosen("force")),
  ),
  "34001b.jean-grey-response": alterEgoResponse(
    { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } },
    addCounters("power", 1, named("Phoenix Force")),
  ),

  "34002a.phoenix-force-constant": constant(gainsTrait(RESTRAINED, YOUR_IDENTITY)),
  "34002a.phoenix-force-forced-response": forcedResponse(on.lastCounterRemoved("power"), flipCard(self)),

  "34002b.phoenix-force-constant": constant(gainsTrait(UNLEASHED, YOUR_IDENTITY)),
  "34002b.phoenix-force-constant-2": constant(gets("thw", -2, PHOENIX), gets("atk", 2, PHOENIX)),
  "34002b.phoenix-force-forced-response": forcedResponse(
    on.countersPlaced("power", THIS_CARD),
    ifThen(valueAtLeast(countersOn(self, "power"), 4), flipCard(self)),
  ),
});
