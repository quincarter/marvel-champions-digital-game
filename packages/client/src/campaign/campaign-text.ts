/**
 * A campaign box's words in the player's language: the box's name, its tagline and Cover pitch, and an issue's billed
 * title and villain. English comes from the content (`SAGA_VOLUMES`, `stories/*.ts`); Spanish from `campaign-copy-es.ts`
 * and the official product names in `i18n/es.ts`. A box or issue with no Spanish entry reads in English, never blank.
 */
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import { t, type MessageKey } from "../i18n/translate.js";
import { CAMPAIGN_COPY_ES, ISSUE_COPY_ES, VILLAIN_ES } from "./campaign-copy-es.js";

/** The catalog key of each base box's official name (`unlock.name.*`). A pack campaign names itself. */
const NAME_KEY: Readonly<Record<string, MessageKey>> = {
  trors: "unlock.name.trors",
  gmw: "unlock.name.gmw",
  mts: "unlock.name.mts",
  sm: "unlock.name.sm",
  mut_gen: "unlock.name.mutgen",
  mojo: "unlock.name.mojo",
  next_evol: "unlock.name.next",
  aoa: "unlock.name.aoa",
  aos: "unlock.name.aos",
  fne: "unlock.name.fne",
  shadowland: "unlock.name.shadowland",
};

/** A campaign's name: the official Spanish product name for a base box, else `english` as given (a pack's own). */
export function campaignNameIn(campaignId: string, english: string, lang: CardLanguage = artLanguageNow()): string {
  const key = NAME_KEY[campaignId];
  return lang === "en" || key === undefined ? english : t(key, undefined, lang);
}

/** A box's tagline, or `english` where there is no Spanish. */
export function taglineIn(campaignId: string, english: string, lang: CardLanguage = artLanguageNow()): string {
  return lang === "en" ? english : (CAMPAIGN_COPY_ES[campaignId]?.tagline ?? english);
}

/** A box's Cover pitch, or `english` where there is no Spanish. */
export function blurbIn(campaignId: string, english: string, lang: CardLanguage = artLanguageNow()): string {
  return lang === "en" ? english : (CAMPAIGN_COPY_ES[campaignId]?.blurb ?? english);
}

/** An issue's title as billed. */
export function issueTitleIn(
  campaignId: string,
  nodeId: string,
  english: string,
  lang: CardLanguage = artLanguageNow(),
): string {
  return lang === "en" ? english : (ISSUE_COPY_ES[`${campaignId}/${nodeId}`]?.title ?? english);
}

/** An issue's billed villain. */
export function villainIn(english: string, lang: CardLanguage = artLanguageNow()): string {
  return lang === "en" ? english : (VILLAIN_ES[english] ?? english);
}

/** The count word a fallback tagline says ("five"), two to six; a larger count is its digits. */
export function issueWordIn(count: number, lang: CardLanguage = artLanguageNow()): string {
  switch (count) {
    case 2:
      return t("campaign.issueWord.2", undefined, lang);
    case 3:
      return t("campaign.issueWord.3", undefined, lang);
    case 4:
      return t("campaign.issueWord.4", undefined, lang);
    case 5:
      return t("campaign.issueWord.5", undefined, lang);
    case 6:
      return t("campaign.issueWord.6", undefined, lang);
    default:
      return String(count);
  }
}

/** A shelf volume's name: a pack campaign names itself, a base box takes its official Spanish name. */
export function volumeNameIn(
  volume: { readonly campaignId: string; readonly name: string; readonly custom?: unknown },
  lang: CardLanguage = artLanguageNow(),
): string {
  return volume.custom ? volume.name : campaignNameIn(volume.campaignId, volume.name, lang);
}
