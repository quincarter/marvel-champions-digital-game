/**
 * The words the Saga shelf (`scenes/campaign/saga.ts`) says for one volume: a tile's status chip, the featured card's
 * status line, its sentence and footnote, its buttons' labels and what each one does. Pure over a `SagaVolumeRow`, in
 * the player's language (`t`), so the scene only lays them out and wires a press to its action.
 */
import { t, tPlural } from "../i18n/translate.js";
import type { SagaVolumeRow } from "./campaign-saga-model.js";

/** The grid tile's own status chip: the honest "not in this build yet" only when it is what is true. */
export function gridChipOf(row: SagaVolumeRow): string {
  switch (row.status) {
    case "done":
      return t("saga.chip.complete");
    case "live":
      return row.issueNumber !== null
        ? t("campaign.issueOf", { number: row.issueNumber, total: row.totalIssues })
        : t("saga.chip.inProgress");
    case "fresh":
      return row.lost ? t("saga.chip.lost", { number: row.lost.issueNumber }) : t("saga.chip.open");
    case "sealed":
    default:
      return row.unlocked && !row.hasDefinition ? (row.lockReason ?? t("saga.chip.sealed")) : t("saga.chip.sealed");
  }
}

export interface FeaturedCopy {
  /** The status word in the card's first line ("In progress"), before the box code. */
  readonly status: string;
  /** The right end of that line. */
  readonly right: string;
  /** The sentence under the name (and the pips). */
  readonly sub: string;
  readonly hasPips: boolean;
  /** The footnote under the second button row; "" for none. */
  readonly foot: string;
}

/** The featured card's copy for one volume, by status. */
export function featuredCopyOf(row: SagaVolumeRow): FeaturedCopy {
  const n = row.volume.number;
  switch (row.status) {
    case "done":
      return {
        status: t("saga.status.complete"),
        right: t("saga.right.standardExpert", {
          standard: row.wonStandard ? "✓" : "○",
          expert: row.wonExpert ? "✓" : "○",
        }),
        // An adjusted win finishes the volume but opens nothing (issue #869): say why the next one is still sealed.
        sub:
          tPlural("saga.sub.rosterIssues", row.totalIssues, { roster: row.rosterNames.join(" · ") }) +
          (row.adjustedWinKeepsNextSealed ? `\n${t("saga.sub.adjustedKeepsSealed", { next: n + 1 })}` : ""),
        hasPips: true,
        foot: `${row.packNote ? `${row.packNote} ` : ""}${t("saga.foot.done")}`,
      };
    case "live":
      return {
        status: t("saga.status.inProgress"),
        right:
          row.issueNumber !== null ? t("campaign.issueOf", { number: row.issueNumber, total: row.totalIssues }) : "",
        sub: row.rosterNames.join(" · "),
        hasPips: true,
        foot: `${row.packNote ? `${row.packNote} ` : ""}${t("saga.foot.live")}`,
      };
    case "fresh":
      return {
        status: row.lost ? t("saga.status.lost") : t("saga.status.open"),
        right: row.lost ? t("saga.right.lostAt", { number: row.lost.issueNumber }) : t("saga.right.notStarted"),
        sub: row.lost ? t("saga.sub.lost") : row.volume.custom ? t("saga.sub.openCustom") : t("saga.sub.open"),
        hasPips: false,
        foot: "",
      };
    case "sealed":
    default:
      return {
        status: t("saga.status.sealed"),
        right: "",
        sub: !row.hasDefinition
          ? row.unlocked
            ? t("saga.sub.sealed.notBuilt", { number: n })
            : t("saga.sub.sealed.winPrevious", { previous: n - 1 })
          : row.previousWonAdjustedOnly
            ? t("saga.sub.sealed.adjusted", { previous: n - 1 })
            : row.lockReason
              ? t("saga.sub.sealed.reason", { reason: row.lockReason })
              : t("saga.sub.sealed.default", { previous: n - 1 }),
        hasPips: false,
        foot: "",
      };
  }
}

/** What the featured volume's big button does when pressed. */
export type SagaCtaAction = "continue" | "reread" | "start" | "unlock" | "none";

export interface SagaCta {
  readonly label: string;
  readonly enabled: boolean;
  /** Why a disabled button is disabled (its tooltip). */
  readonly reason?: string;
  readonly action: SagaCtaAction;
}

/** The big button's label and state: `unlockPoints` is what unlocking a sealed, playable box costs now. */
export function ctaOf(row: SagaVolumeRow, unlockPoints: number): SagaCta {
  switch (row.status) {
    case "live":
      return {
        label: t("saga.cta.continue"),
        enabled: row.canResume,
        ...(row.incompatibleReason ? { reason: row.incompatibleReason } : {}),
        action: "continue",
      };
    case "done":
      return { label: t("saga.cta.reread"), enabled: row.hasDefinition, action: "reread" };
    case "fresh":
      return {
        label: row.volume.custom
          ? t("saga.cta.startCampaign")
          : t("saga.cta.startVolume", { number: row.volume.number }),
        enabled: true,
        action: "start",
      };
    case "sealed":
    default:
      // A box this build can play opens here and now with champion points, out of the Saga's order; one it cannot play
      // stays honestly locked.
      if (!row.hasDefinition)
        return {
          label: t("saga.cta.locked"),
          enabled: false,
          reason: row.lockReason ?? t("saga.chip.sealed"),
          action: "none",
        };
      return { label: t("saga.cta.unlock", { points: unlockPoints }), enabled: true, action: "unlock" };
  }
}

export type SagaAltAction = "dossier" | "reread" | "startOver" | "newRun" | "expertRun";

export interface SagaAlt {
  readonly action: SagaAltAction;
  readonly label: string;
  readonly enabled: boolean;
}

/** The two smaller buttons under the big one, by status. `confirming`: Start over is waiting for its second tap. */
export function altsOf(row: SagaVolumeRow, confirming: boolean): readonly SagaAlt[] {
  if (row.status === "fresh" && row.lost) {
    return [
      { action: "dossier", label: t("saga.alt.dossier"), enabled: row.hasDefinition },
      { action: "reread", label: t("saga.cta.reread"), enabled: row.hasDefinition },
    ];
  }
  if (row.status === "live") {
    return [
      { action: "dossier", label: t("saga.alt.dossier"), enabled: row.hasDefinition },
      { action: "startOver", label: confirming ? t("saga.alt.confirm") : t("saga.alt.startOver"), enabled: true },
    ];
  }
  if (row.status === "done") {
    const alts: SagaAlt[] = [{ action: "newRun", label: t("saga.alt.newRun"), enabled: true }];
    if (row.wonStandard) alts.push({ action: "expertRun", label: t("saga.alt.expertRun"), enabled: true });
    return alts;
  }
  return [];
}
