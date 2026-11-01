/**
 * Which Balanced scans a game shows, and the written text that matches them (issue #609). Pure: the session applies the
 * answer to `art-source.ts` when a game starts or resumes and clears it when the game ends.
 */
import { GMW_BALANCED_TOGGLES } from "@mc/cards";
import type { LogValue } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { balancedScanOf, type ArtSource } from "./art-source.js";
import { BALANCED_SCANS } from "./balanced-scans.js";

const flagOn = (value: LogValue | undefined): boolean => value?.kind === "flag" && value.value === true;

/**
 * The normal scans a game shows an edited version of: none for a Normal run or another campaign; in a Balanced Galaxy's
 * Most Wanted run, each always-on scan, and a toggle's scans only with that toggle on (the game's frozen log view holds
 * the toggles: `CampaignGameInput.log`).
 */
export function balancedScansOf(
  config: Pick<SessionConfig, "modes" | "campaign"> | null | undefined,
): ReadonlySet<string> {
  const campaign = config?.modes?.campaign;
  if (!campaign || campaign.campaignId !== "gmw" || campaign.balanced !== true) return new Set();
  const log = config?.campaign?.log;
  const toggleOn = (id: string): boolean => {
    const field = GMW_BALANCED_TOGGLES.find((toggle) => toggle.id === id)?.field;
    return field !== undefined && (flagOn(log?.hidden?.[field]) || flagOn(log?.shared[field]));
  };
  return new Set(
    BALANCED_SCANS.filter(
      (entry) =>
        entry.gate === "always" ||
        ("toggle" in entry.gate ? toggleOn(entry.gate.toggle) : !toggleOn(entry.gate.toggleOff)),
    ).map((entry) => entry.id),
  );
}

/**
 * The written text of each Balanced scan, read from the scans (English). Inspect shows it in place of the card's printed
 * text while the scan is the one on screen, so the two always agree. Icons are the data's own tokens
 * (`view/card-text-display.ts`). The flavor lines are left out: Inspect shows flavor from the card's own data.
 */
export const BALANCED_TEXT: Readonly<Record<string, string>> = {
  "16070":
    "Forced Interrupt: When a player card would be placed into a discard pile from play, put it faceup into The Collection instead.",
  "16071":
    "When Revealed: In player order, each player must choose to either put the top card of their deck faceup into The Collection or take 3 damage.\nForced Interrupt: When a player card would be placed into a discard pile from play, put it faceup into The Collection instead.",
  "16072":
    "When Revealed: Put the top card of each player's deck faceup into The Collection. Place 1 threat on the main scheme for each card in The Collection.\nForced Interrupt: When a player card would be placed into a discard pile from play, put it faceup into The Collection instead, then place 1 threat on the main scheme.",
  "16073a":
    'Contents: Collector (I) and Collector (II). (Collector (II) and Collector (III) instead for expert mode.) Infiltrate the Museum, Galactic Artifacts, Space Pirates, and Standard encounter sets. One modular encounter set (Menagerie Medley).\nSetup: Create "The Collection" game area (see insert for details). Put the top card of each player\'s deck faceup into The Collection.',
  "16073b":
    "Hero Action: Choose to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection (to its owner's discard pile). (Limit once per round per player.)\nIf an encounter card would remove a player card from the game, put that card faceup into The Collection instead.\nIf there are at least 5[per_hero] cards in The Collection or if this stage is completed, the players lose the game.",
  "16093":
    "Forced Interrupt: When the villain phase begins, place 1 evasion counter here.\nForced Response: After Nebula takes 3 or more damage from a single attack, remove 1 evasion counter from here. (Limit once per round.)\nShoot the Thrusters! — First Player Action: Exhaust the Milano and spend up to 2 resources of any type → remove 1 evasion counter from here for each resource spent this way.",
  "16106a":
    "Contents: Ronan the Accuser (I) and Ronan the Accuser (II). (Ronan the Accuser (II) and Ronan the Accuser (III) instead for expert mode.) Ronan the Accuser, Power Stone, Ship Command, and Standard encounter sets. One modular encounter set (Kree Militants).\nSetup: Put the Milano support into play and attach to it 1 Milano Mod upgrade with Unit Cost 6 and 2 with Unit Cost 4. Attach the Power Stone to the first player. Remove the Kree Command Ship from the game. If there are 2 or more players, shuffle Kree Supremacy into the encounter deck.",
  "16106a-nokree":
    "Contents: Ronan the Accuser (I) and Ronan the Accuser (II). (Ronan the Accuser (II) and Ronan the Accuser (III) instead for expert mode.) Ronan the Accuser, Power Stone, Ship Command, and Standard encounter sets. One modular encounter set (Kree Militants).\nSetup: Put the Milano support into play and attach to it 1 Milano Mod upgrade with Unit Cost 6 and 2 with Unit Cost 4. Attach the Power Stone to the first player. Remove the Kree Command Ship from the game.",
  "16106b": "First Player Action: Exhaust the Milano → remove 3 threat from this scheme.",
  "16107b":
    "While the Power Stone is attached to Ronan the Accuser, threat cannot be removed from this scheme.\nIf this stage is completed, the players lose the game.",
  "16142":
    "Permanent. Setup.\nThe first player controls the Milano.\nPiloting — Resource: Exhaust the Milano → generate a [star] resource for any player.\nUpgrades attached to the Milano are controlled by its controller and cannot be exhausted while the Milano is exhausted.",
};

/** The Balanced text for the picture on screen, or null when it is not a Balanced scan (use the card's own text). */
export function balancedTextOf(art: ArtSource | null): string | null {
  const scan = balancedScanOf(art);
  return scan === null ? null : (BALANCED_TEXT[scan] ?? null);
}

/**
 * Decides when the Balanced scans show: only while a game screen is up (a setup deal or the Board; a hand-off overlaps
 * two, so it counts them) and only the scans the current game's config names. The store's config outlives the screen
 * (Save & quit leaves it), so the config alone would leave the edited scans on for the card browser, the deck builder
 * and the next Normal run. `apply` is called only when the answer changes.
 */
export class BalancedArtGate {
  #screens = 0;
  #config: Parameters<typeof balancedScansOf>[0] = null;
  #key = "";

  constructor(private readonly apply: (scans: ReadonlySet<string>) => void) {}

  /** The current game's config (null with no game): call it on every store update. */
  setConfig(config: Parameters<typeof balancedScansOf>[0]): void {
    this.#config = config;
    this.#refresh();
  }

  /** A game screen opened. */
  enter(): void {
    this.#screens += 1;
    this.#refresh();
  }

  /** A game screen closed. */
  leave(): void {
    this.#screens = Math.max(0, this.#screens - 1);
    this.#refresh();
  }

  #refresh(): void {
    const scans = this.#screens > 0 ? balancedScansOf(this.#config) : new Set<string>();
    const key = [...scans].sort().join(",");
    if (key === this.#key) return;
    this.#key = key;
    this.apply(scans);
  }
}
