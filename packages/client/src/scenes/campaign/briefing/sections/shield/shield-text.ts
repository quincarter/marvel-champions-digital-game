/**
 * The case file's words: its labels, in the player's language. The numbers, flip note and hit-point lines are the box's own
 * story text and go through `sectionTextIn`.
 */
import { t, tPlural } from "../../../../../i18n/translate.js";
import type { ShieldBoardMember, ShieldBriefing } from "../../../../../view/campaign-shield-model.js";

/** "Means", "Motive" or "Opportunity": what an evidence card is the answer to. */
export const evidenceKindIn = (kind: string): string =>
  kind === "means" || kind === "motive" || kind === "opportunity" ? t(`briefing.shield.kind.${kind}`) : kind;

export const evidenceHeadingIn = (count: number): string => tPlural("briefing.shield.evidence", count);

export const openLineIn = (brief: Pick<ShieldBriefing, "rowsOpen" | "rowsTotal" | "sealedCount">): string =>
  t("briefing.shield.open", { open: brief.rowsOpen, total: brief.rowsTotal, sealed: brief.sealedCount });

/** "Hill: 4 open · Fury: 3 open": the member's name without its "Chief" title, and how many combinations name it. */
export const membersLineIn = (members: ShieldBriefing["members"]): string =>
  members
    .map((member) =>
      t("briefing.shield.memberOpen", { name: member.name.replace(/^Chief\s+/i, ""), count: member.open }),
    )
    .join(" · ");

export const boardHeadingIn = (after: number | null): string =>
  after === null ? t("briefing.shield.board.none") : t("briefing.shield.board.after", { number: after });

/** The words under a board member's picture: "ATTACHMENT · 2 secrets" or "3 secrets". */
export const boardCaptionIn = (member: ShieldBoardMember): string => {
  const secrets = tPlural("briefing.shield.secrets", member.secrets);
  return member.attachment ? `${t("briefing.shield.attachment")} · ${secrets}` : secrets;
};
