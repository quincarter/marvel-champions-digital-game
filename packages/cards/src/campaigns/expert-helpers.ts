/**
 * The four expert-campaign instructions every box prints in nearly the same words (docs/phase7-wave7.md §3.46): record
 * remaining hit points after a win (capped at the base value), set them at the next setup, and the paid heal that
 * lets a player restore their identity to full, which a defeated player must pay to rejoin (wave 6 §4.1 Q11). The
 * heal's price is the box's: an acceleration token on the main scheme (`healToFull`), a facedown encounter card
 * (`healWithFacedownCard`) or threat on a scheme the box names (`healForThreat`).
 *
 * First used by `next_evol.ts`. `mut_gen.ts`, `mts.ts` and `mojo.ts` still carry their own copies of the same shapes
 * and are not touched here.
 */
import type { CampaignInstruction, TargetRef } from "@mc/engine";
import { DEFAULT_CAMPAIGN_WINDOW } from "@mc/engine";
import {
  addAccelerationToken,
  campaignLogAtLeast,
  campaignLogValue,
  chooseOneBy,
  damageOn,
  dealEncounterCard,
  eachPlayer,
  forEachPlayer,
  heal,
  identityOf,
  ifThen,
  option,
  placeThreat,
  setRemainingHitPoints,
  thatPlayer,
} from "../dsl/index.js";

/** "Expert Campaign Only: Record each identity's remaining hit points in the campaign log." (capped at base, MC40 p. 7) */
export function hpRecord(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Expert Campaign Only: Record each identity's remaining hit points in the campaign log.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "record",
      writes: [{ field: "remainingHp", seat: "each", mode: "set", value: { kind: "remainingHitPointsCappedAtBase" } }],
    },
  };
}

/** "Expert Campaign Only: Set each player's hit points to their remaining hit point value recorded in the campaign log for the previous scenario." */
export function hpSet(id: string, citation: string): CampaignInstruction {
  return {
    id,
    text: "Expert Campaign Only: Set each player's hit points to their remaining hit point value recorded in the campaign log for the previous scenario.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          setRemainingHitPoints(campaignLogValue("remainingHp", { seat: thatPlayer }), identityOf(thatPlayer)),
        ),
      ],
    },
  };
}

/**
 * "Expert Campaign Only: Each player may place one acceleration token on the main scheme to heal their identity to its
 * full hit point value." A defeated player rejoins only by paying (MC40 p. 7), so an identity whose recorded hit
 * points are 0 (or none: a seat that sat out the Victory steps) is not offered "Decline".
 */
export function healToFull(id: string, citation: string): CampaignInstruction {
  const place = [addAccelerationToken()];
  const healFull = heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer));
  return {
    id,
    text: "Expert Campaign Only: Each player may place one acceleration token on the main scheme to heal their identity to its full hit point value.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          ifThen(
            campaignLogAtLeast("remainingHp", 1, { seat: thatPlayer }),
            chooseOneBy(
              thatPlayer,
              option("Heal to full · +1 acceleration token", ...place, healFull),
              option("Decline", []),
            ),
            [...place, healFull],
          ),
        ),
      ],
    },
  };
}

/**
 * "Expert Campaign Only: Each player may deal themself 1 facedown encounter card to heal their identity to its full hit
 * point value." Forced for a seat recorded at 0, as `healToFull`.
 */
export function healWithFacedownCard(id: string, citation: string): CampaignInstruction {
  const deal = dealEncounterCard(thatPlayer);
  const healFull = heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer));
  return {
    id,
    text: "Expert Campaign Only: Each player may deal themself 1 facedown encounter card to heal their identity to its full hit point value.",
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          ifThen(
            campaignLogAtLeast("remainingHp", 1, { seat: thatPlayer }),
            chooseOneBy(thatPlayer, option("Heal to full · +1 facedown card", deal, healFull), option("Decline", [])),
            [deal, healFull],
          ),
        ),
      ],
    },
  };
}

/**
 * "Expert Campaign Only: Each player may place 3 threat on the [MISSION] side scheme to heal their identity to its
 * full hit point value." (MC45 pp. 12, 14, 16, 20; docs/phase7-wave8.md §2.16.) The price is `threat` on `scheme`,
 * flat and once for each player who heals: with two players healing, the scheme gains twice the amount. `scheme` must
 * be able to reach the card (the mission is in a closed area, and a ref that names the area reaches it). `schemeName`
 * is how the printed sentence names the scheme. Forced for a seat recorded at 0 or with no record (a seat that sat out
 * the Victory steps "can rejoin their teammates by placing 3 threat on that scenario's [MISSION] side scheme", MC45
 * p. 20), as `healToFull`.
 */
export function healForThreat(
  id: string,
  citation: string,
  threat: number,
  scheme: TargetRef,
  schemeName: string,
): CampaignInstruction {
  const pay = placeThreat(threat, scheme);
  const healFull = heal(damageOn(identityOf(thatPlayer)), identityOf(thatPlayer));
  return {
    id,
    text: `Expert Campaign Only: Each player may place ${threat} threat on the ${schemeName} to heal their identity to its full hit point value.`,
    citation,
    whenModes: { expertCampaign: true },
    step: {
      kind: "inGame",
      window: DEFAULT_CAMPAIGN_WINDOW,
      effects: [
        forEachPlayer(
          eachPlayer,
          ifThen(
            campaignLogAtLeast("remainingHp", 1, { seat: thatPlayer }),
            chooseOneBy(thatPlayer, option(`Heal to full · +${threat} threat`, pay, healFull), option("Decline", [])),
            [pay, healFull],
          ),
        ),
      ],
    },
  };
}
