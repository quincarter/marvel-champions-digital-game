export type { CardType, BaseCard } from "./base.js";
export type {
  PlayerCard,
  AllyCard,
  EventCard,
  SupportCard,
  UpgradeCard,
  ResourceCard,
  PlayerSideSchemeCard,
} from "./player-cards.js";
export type { PlayRestrictions, SpecialCost, SpecificSet } from "./player-cards.js";
export type {
  HeroIdentityCard,
  HeroFace,
  AlterEgoFace,
  IdentityDeckbuilding,
  IdentitySeparateDeck,
  OffAspectPackage,
  SeparatedIdentity,
} from "./identity.js";
export type {
  CardFlipSide,
  EncounterCard,
  EncounterCardFlipSide,
  MinionCard,
  AttachmentCard,
  TreacheryCard,
  ObligationCard,
  EnvironmentCard,
} from "./encounter-cards.js";
export type {
  AttachmentHost,
  AttachmentHostCategory,
  AttachmentHostKind,
  HostMeasure,
  HostQualifiers,
  PrintedStatModifiers,
  SuperlativeHostPool,
} from "./attachment-host.js";
export { ATTACHMENT_HOST_CATEGORIES, ATTACHMENT_HOST_KINDS, HOST_MEASURES, SUPERLATIVE_HOST_POOLS } from "./attachment-host.js";
export type {
  MainSchemeCard,
  MainSchemeStage,
  MainSchemeASide,
  MainSchemeThreatField,
  SideSchemeCard,
  SchemeIcon,
} from "./schemes.js";
export type { VillainCard, VillainDashStat, VillainSide, VillainSideLetter, VillainStage } from "./villain.js";
export type { EvidenceCard, EvidenceKind } from "./evidence.js";
export { EVIDENCE_KINDS } from "./evidence.js";

import type { PlayerCard } from "./player-cards.js";
import type { HeroIdentityCard } from "./identity.js";
import type { EncounterCard } from "./encounter-cards.js";
import type { MainSchemeCard, SideSchemeCard } from "./schemes.js";
import type { VillainCard } from "./villain.js";
import type { EvidenceCard } from "./evidence.js";

export type AnyCard = PlayerCard | HeroIdentityCard | EncounterCard | MainSchemeCard | SideSchemeCard | VillainCard | EvidenceCard;
