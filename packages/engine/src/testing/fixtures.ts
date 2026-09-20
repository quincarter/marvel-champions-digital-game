import {
  cardId,
  cycleId,
  encounterSetId,
  flat,
  setCode,
  unerrataedText,
  type AbilityReference,
  type AllyCard,
  type Aspect,
  type ResourceIconCounts,
  type AttachmentCard,
  type AttachmentHost,
  type PrintedStatModifiers,
  type SupportCard,
  type EventCard,
  type HeroIdentityCard,
  type KeywordInstance,
  type MainSchemeCard,
  type MainSchemeStage,
  type MinionCard,
  type ObligationCard,
  type ResourceCard,
  type ScalingValue,
  type SchemeIcon,
  type SideSchemeCard,
  type TreacheryCard,
  type UpgradeCard,
  type EnvironmentCard,
  type VillainCard,
  type VillainSide,
  type VillainStage,
  type Trait,
} from "@mc/content";

const base = (id: string, name: string) => ({
  id: cardId(id),
  name,
  setCode: setCode("stub"),
  cycleId: cycleId("stub"),
  collectorNumber: id,
  quantityInSet: 1,
  unique: false,
});

const text = unerrataedText("");

export function stubIdentity(spec: {
  readonly id: string;
  readonly name?: string;
  readonly hp: number;
  readonly atk: number;
  readonly thw: number;
  readonly def: number;
  readonly rec: number;
  readonly heroHandSize: number;
  readonly alterEgoHandSize: number;
  readonly heroAbilities?: readonly AbilityReference[];
  readonly alterEgoAbilities?: readonly AbilityReference[];
  readonly heroKeywords?: readonly KeywordInstance[];
  readonly alterEgoKeywords?: readonly KeywordInstance[];
  readonly heroTraits?: readonly Trait[];
}): HeroIdentityCard {
  return {
    ...base(spec.id, spec.name ?? spec.id),
    type: "hero_identity",
    hp: spec.hp,
    obligationCardId: cardId(`${spec.id}-obligation`),
    nemesisEncounterSetId: encounterSetId(`${spec.id}-nemesis`),
    hero: {
      keywords: spec.heroKeywords ?? [],
      faceName: `${spec.name ?? spec.id} (hero)`,
      atk: spec.atk,
      thw: spec.thw,
      def: spec.def,
      handSize: spec.heroHandSize,
      text,
      abilities: spec.heroAbilities ?? [],
      traits: spec.heroTraits ?? [],
    },
    alterEgo: {
      faceName: `${spec.name ?? spec.id} (alter-ego)`,
      keywords: spec.alterEgoKeywords ?? [],
      rec: spec.rec,
      handSize: spec.alterEgoHandSize,
      text,
      abilities: spec.alterEgoAbilities ?? [],
      traits: [],
    },
  };
}

export function stubAlly(spec: {
  readonly id: string;
  readonly traits?: readonly Trait[];
  readonly cost: number;
  readonly atk: number | null;
  readonly thw: number | null;
  readonly hp: number;
  readonly resources?: number;
  readonly consequentialAttack?: number;
  readonly consequentialThwart?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
  readonly resourceIcons?: ResourceIconCounts;
  readonly aspect?: Aspect;
}): AllyCard {
  return {
    ...base(spec.id, spec.id),
    type: "ally",
    aspect: spec.aspect ?? "basic",
    deckLimit: 3,
    traits: spec.traits ?? [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: spec.resourceIcons ?? { wild: spec.resources ?? 0 },
    atk: spec.atk,
    thw: spec.thw,
    hp: spec.hp,
    consequentialDamage: {
      attack: spec.consequentialAttack ?? 1,
      thwart: spec.consequentialThwart ?? 1,
    },
  };
}

export function stubUpgrade(spec: {
  readonly id: string;
  readonly traits?: readonly Trait[];
  readonly cost: number;
  readonly resources?: number;
  readonly abilities?: readonly AbilityReference[];
  readonly keywords?: readonly KeywordInstance[];
  readonly counters?: Readonly<Record<string, number>>;
}): UpgradeCard {
  return {
    ...base(spec.id, spec.id),
    type: "upgrade",
    aspect: "basic",
    deckLimit: 3,
    traits: spec.traits ?? [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: { wild: spec.resources ?? 0 },
  };
}

export function stubEvent(spec: {
  readonly id: string;
  readonly cost: number;
  readonly resources?: number;
  readonly resourceIcons?: ResourceIconCounts;
  readonly aspect?: Aspect;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): EventCard {
  return {
    ...base(spec.id, spec.id),
    type: "event",
    aspect: spec.aspect ?? "basic",
    deckLimit: 3,
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: spec.resourceIcons ?? { wild: spec.resources ?? 0 },
  };
}

export function stubResource(spec: {
  readonly id: string;
  readonly icons: number;
  /** Typed printed resources; overrides `icons` (which are wild). */
  readonly produces?: ResourceIconCounts;
  readonly abilities?: readonly AbilityReference[];
}): ResourceCard {
  return {
    ...base(spec.id, spec.id),
    type: "resource",
    aspect: "basic",
    deckLimit: 3,
    traits: [],
    keywords: [],
    text,
    abilities: spec.abilities ?? [],
    producesIcons: spec.produces ?? { wild: spec.icons },
  };
}

export interface StubVillainStage {
  readonly hp: ScalingValue;
  readonly atk: number;
  readonly sch: number;
  /** Stats printed "—" (`VillainStage.dashedStats`). */
  readonly dashedStats?: readonly ("atk" | "sch")[];
  readonly traits?: readonly Trait[];
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}

const villainStages = (stages: readonly StubVillainStage[]): [VillainStage, ...VillainStage[]] => {
  const built = stages.map(
    (stage, index): VillainStage => ({
      stageNumber: index + 1,
      hp: stage.hp,
      atk: stage.atk,
      sch: stage.sch,
      ...(stage.dashedStats ? { dashedStats: stage.dashedStats } : {}),
      text,
      traits: stage.traits ?? [],
      keywords: stage.keywords ?? [],
      abilities: stage.abilities ?? [],
    }),
  );
  const [first, ...rest] = built;
  if (!first) throw new Error("stubVillain needs at least one stage");
  return [first, ...rest];
};

/**
 * A villain deck. `back` makes its stage cards double-sided: side B, with its own title and the same number of
 * stages (docs/phase7-wave1.md §1.3; Norman Osborn / Green Goblin).
 */
export function stubVillain(spec: {
  readonly id: string;
  /** Side A's title; defaults to the id. */
  readonly name?: string;
  readonly stages: readonly StubVillainStage[];
  readonly back?: { readonly name: string; readonly stages: readonly StubVillainStage[] };
  readonly startingSide?: "A" | "B";
}): VillainCard {
  const name = spec.name ?? spec.id;
  const front: VillainSide = { side: "A", name, stages: villainStages(spec.stages) };
  const sides: [VillainSide, ...VillainSide[]] = spec.back
    ? [front, { side: "B", name: spec.back.name, stages: villainStages(spec.back.stages) }]
    : [front];
  return {
    ...base(spec.id, name),
    type: "villain",
    encounterSetIds: [],
    sides,
    ...(spec.startingSide ? { startingSide: spec.startingSide } : {}),
  };
}

/** An environment; `flipSide` makes it double-sided (Criminal Enterprise / State of Madness). */
export function stubEnvironment(spec: {
  readonly id: string;
  readonly name?: string;
  readonly traits?: readonly Trait[];
  readonly boostIcons?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
  readonly flipSide?: {
    readonly name: string;
    readonly traits?: readonly Trait[];
    readonly keywords?: readonly KeywordInstance[];
    readonly abilities?: readonly AbilityReference[];
  };
}): EnvironmentCard {
  return {
    ...base(spec.id, spec.name ?? spec.id),
    type: "environment",
    encounterSetIds: [],
    boostIcons: spec.boostIcons ?? 0,
    traits: spec.traits ?? [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    ...(spec.flipSide
      ? {
          flipSide: {
            name: spec.flipSide.name,
            traits: spec.flipSide.traits ?? [],
            keywords: spec.flipSide.keywords ?? [],
            text,
            abilities: spec.flipSide.abilities ?? [],
          },
        }
      : {}),
  };
}

export function stubMainScheme(spec: {
  readonly id: string;
  readonly stages: readonly {
    readonly startingThreat: ScalingValue;
    readonly targetThreat: ScalingValue;
    readonly acceleration: ScalingValue;
    readonly icons?: readonly SchemeIcon[];
    readonly keywords?: readonly KeywordInstance[];
    readonly abilities?: readonly AbilityReference[];
    /** A-side abilities: stage 1's `Setup:` text, later stages' `When Revealed:` text. */
    readonly aSideAbilities?: readonly AbilityReference[];
  }[];
}): MainSchemeCard {
  const stages = spec.stages.map(
    (stage, index): MainSchemeStage => ({
      stageNumber: index + 1,
      startingThreat: stage.startingThreat,
      targetThreat: stage.targetThreat,
      acceleration: stage.acceleration,
      icons: stage.icons ?? [],
      text,
      traits: [],
      keywords: stage.keywords ?? [],
      abilities: stage.abilities ?? [],
      aSide: { text, abilities: stage.aSideAbilities ?? [] },
    }),
  );
  const [first, ...rest] = stages;
  if (!first) throw new Error("stubMainScheme needs at least one stage");
  return {
    ...base(spec.id, spec.id),
    type: "main_scheme",
    encounterSetIds: [],
    stages: [first, ...rest],
  };
}

export function stubMinion(spec: {
  readonly id: string;
  /** Encounter sets the card belongs to (a nemesis set, for setup tests). */
  readonly encounterSetIds?: readonly string[];
  readonly traits?: readonly Trait[];
  readonly atk: number | "X" | null;
  readonly sch: number | "X" | null;
  readonly hp: number;
  readonly boostIcons?: number;
  /** The boost area prints a star icon (★): a printed fact, separate from `boostIcons` (RRG 1.8 "Boost", p. 11). */
  readonly starIcon?: boolean;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
  /** The "(X's nemesis minion.)" parenthetical (RRG 1.8 "Nemesis Encounter Set", p. 30). */
  readonly nemesisMinion?: boolean;
}): MinionCard {
  return {
    ...base(spec.id, spec.id),
    type: "minion",
    encounterSetIds: (spec.encounterSetIds ?? []).map((id) => encounterSetId(id)),
    ...(spec.nemesisMinion === undefined ? {} : { nemesisMinion: spec.nemesisMinion }),
    boostIcons: spec.boostIcons ?? 1,
    ...(spec.starIcon === undefined ? {} : { starIcon: spec.starIcon }),
    traits: spec.traits ?? [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    atk: spec.atk,
    sch: spec.sch,
    hp: spec.hp,
  };
}

export function stubTreachery(spec: {
  readonly id: string;
  /** Encounter sets the card belongs to (a nemesis set, for setup tests). */
  readonly encounterSetIds?: readonly string[];
  readonly boostIcons?: number;
  /** The boost area prints a star icon (★): a printed fact, separate from `boostIcons` (RRG 1.8 "Boost", p. 11). */
  readonly starIcon?: boolean;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): TreacheryCard {
  return {
    ...base(spec.id, spec.id),
    type: "treachery",
    encounterSetIds: (spec.encounterSetIds ?? []).map((id) => encounterSetId(id)),
    boostIcons: spec.boostIcons ?? 1,
    ...(spec.starIcon === undefined ? {} : { starIcon: spec.starIcon }),
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
  };
}

export function stubSideScheme(spec: {
  readonly id: string;
  /** Encounter sets the card belongs to (a nemesis set, for setup tests). */
  readonly encounterSetIds?: readonly string[];
  readonly startingThreat: number;
  readonly icons?: readonly SchemeIcon[];
  readonly boostIcons?: number;
  /** The boost area prints a star icon (★): a printed fact, separate from `boostIcons` (RRG 1.8 "Boost", p. 11). */
  readonly starIcon?: boolean;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): SideSchemeCard {
  return {
    ...base(spec.id, spec.id),
    type: "side_scheme",
    encounterSetIds: (spec.encounterSetIds ?? []).map((id) => encounterSetId(id)),
    startingThreat: flat(spec.startingThreat),
    icons: spec.icons ?? [],
    boostIcons: spec.boostIcons ?? 1,
    ...(spec.starIcon === undefined ? {} : { starIcon: spec.starIcon }),
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
  };
}

export function stubSupport(spec: {
  readonly id: string;
  readonly traits?: readonly Trait[];
  readonly cost: number;
  readonly resources?: number;
  readonly resourceIcons?: ResourceIconCounts;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): SupportCard {
  return {
    ...base(spec.id, spec.id),
    type: "support",
    aspect: "basic",
    deckLimit: 3,
    traits: spec.traits ?? [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: spec.resourceIcons ?? { wild: spec.resources ?? 0 },
  };
}

export function stubAttachment(spec: {
  readonly id: string;
  readonly attachesTo: AttachmentHost;
  readonly name?: string;
  readonly statModifiers?: PrintedStatModifiers;
  readonly boostIcons?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): AttachmentCard {
  return {
    ...base(spec.id, spec.name ?? spec.id),
    type: "attachment",
    encounterSetIds: [],
    boostIcons: spec.boostIcons ?? 0,
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    attachesTo: spec.attachesTo,
    ...(spec.statModifiers ? { statModifiers: spec.statModifiers } : {}),
  };
}

export function stubObligation(spec: {
  readonly id: string;
  readonly boostIcons?: number;
  readonly abilities?: readonly AbilityReference[];
}): ObligationCard {
  return {
    ...base(spec.id, spec.id),
    type: "obligation",
    // Obligations reach the encounter deck through `HeroIdentityCard.obligationCardId`.
    encounterSetIds: [],
    boostIcons: spec.boostIcons ?? 2,
    traits: [],
    keywords: [],
    text,
    abilities: spec.abilities ?? [],
  };
}
