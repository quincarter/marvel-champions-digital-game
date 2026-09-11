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
export type { PlayRestrictions } from "./player-cards.js";
export type { HeroIdentityCard, HeroFace, AlterEgoFace } from "./identity.js";
export type {
  EncounterCard,
  MinionCard,
  AttachmentCard,
  TreacheryCard,
  ObligationCard,
  EnvironmentCard,
} from "./encounter-cards.js";
export type { AttachmentHost, AttachmentHostKind, PrintedStatModifiers } from "./attachment-host.js";
export { ATTACHMENT_HOST_KINDS } from "./attachment-host.js";
export type { MainSchemeCard, MainSchemeStage, MainSchemeASide, SideSchemeCard, SchemeIcon } from "./schemes.js";
export type { VillainCard, VillainSide, VillainStage } from "./villain.js";

import type { PlayerCard } from "./player-cards.js";
import type { HeroIdentityCard } from "./identity.js";
import type { EncounterCard } from "./encounter-cards.js";
import type { MainSchemeCard, SideSchemeCard } from "./schemes.js";
import type { VillainCard } from "./villain.js";

export type AnyCard = PlayerCard | HeroIdentityCard | EncounterCard | MainSchemeCard | SideSchemeCard | VillainCard;
