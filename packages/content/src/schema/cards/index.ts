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
export type { HeroIdentityCard, HeroFace, AlterEgoFace } from "./identity.js";
export type {
  EncounterCard,
  MinionCard,
  AttachmentCard,
  AttachmentTarget,
  TreacheryCard,
  ObligationCard,
  EnvironmentCard,
} from "./encounter-cards.js";
export type { MainSchemeCard, MainSchemeStage, SideSchemeCard, SchemeIcon } from "./schemes.js";
export type { VillainCard, VillainSide, VillainStage } from "./villain.js";

import type { PlayerCard } from "./player-cards.js";
import type { HeroIdentityCard } from "./identity.js";
import type { EncounterCard } from "./encounter-cards.js";
import type { MainSchemeCard, SideSchemeCard } from "./schemes.js";
import type { VillainCard } from "./villain.js";

export type AnyCard = PlayerCard | HeroIdentityCard | EncounterCard | MainSchemeCard | SideSchemeCard | VillainCard;
