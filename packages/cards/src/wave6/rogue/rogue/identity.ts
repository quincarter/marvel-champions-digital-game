import { trait } from "@mc/content";
import {
  action,
  attacksGainKeywords,
  chooseTarget,
  constant,
  defineAbilities,
  findCard,
  forcedResponse,
  gainTraitsOfUntil,
  gainsKeyword,
  gainsTrait,
  chosen,
  host,
  on,
  oncePerRound,
  ownerOf,
  query,
  refMatches,
  self,
  setup,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

/** "Touched": the upgrade Rogue's identity and Touched's own text both name. */
const TOUCHED = query("upgrade", { name: "Touched" });
/**
 * Rogue herself, read from Touched: the identity of the card's *owner*. An upgrade attached to another player's card is
 * controlled by that player (RRG 1.8 p. 31, owner decision 2026-10-03), so "you" would be the host's controller; the
 * lines are about Rogue, who owns Touched.
 */
const ROGUE = query("identity", { controlledBy: ownerOf(self) });
const hostIs = (categories: Parameters<typeof query>[0]) => refMatches(host, query(categories));

const FIND_AND_SET_ASIDE = findCard(TOUCHED, "setAside", { owner: you });

/**
 * Rogue / Anna Marie (38001a/b) and her signature upgrade Touched (38002): docs/phase7-wave6.md §6.2, §3.48-§3.51,
 * §4 Q28.
 *
 * - **Setup (38001b)**, **Withdrawn (38001b)** and Rogue's **Forced Response (38001a)**: "find Touched and set it
 *   aside" wherever it is (RRG 1.8 errata p. 69; "Find", p. 19). Her response is printed on the hero face, so it only
 *   hears the player phase beginning in hero form.
 * - **Skin Contact (38001a)**: "Find Touched and attach it to another character. You gain each of the attached
 *   character's TRAITS until the end of the round." The grant ends at the earlier of the end of the round and Touched
 *   leaving that host (Q28, `whileAttached`).
 * - **Touched (38002)**: minion, Rogue's attacks gain overkill; villain, Rogue gains retaliate 1; ally, Rogue gains
 *   AERIAL; hero (a hero-form identity), Rogue gains stalwart. Each is read live from the host. Four refs, one line
 *   of text each.
 */
export const ROGUE_IDENTITY = defineAbilities({
  "38001b.setup": setup(FIND_AND_SET_ASIDE),
  "38001b.withdrawn": forcedResponse(on.youChangeForm(), FIND_AND_SET_ASIDE),
  "38001a.rogue-forced-response": forcedResponse(on.phaseBeginning("player"), FIND_AND_SET_ASIDE),

  "38001a.skin-contact": action(
    { limit: oncePerRound },
    chooseTarget("host", query("character", { excluding: yourIdentity })),
    findCard(TOUCHED, { attachTo: chosen("host") }, { owner: you, bind: "touched" }),
    gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound", { whileAttached: chosen("touched") }),
  ),

  "38002.touched-constant": constant(attacksGainKeywords(["overkill"], { attacker: ROGUE, while: hostIs("minion") })),
  "38002.touched-constant-2": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, ROGUE, { while: hostIs("villain") }),
  ),
  "38002.touched-constant-3": constant(gainsTrait(trait("AERIAL"), ROGUE, { while: hostIs("ally") })),
  "38002.touched-constant-4": constant(gainsKeyword({ name: "stalwart" }, ROGUE, { while: hostIs("hero") })),
});
