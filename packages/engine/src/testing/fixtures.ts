import {
  cardId,
  cycleId,
  flat,
  setCode,
  unerrataedText,
  type AbilityReference,
  type AllyCard,
  type AttachmentCard,
  type AttachmentTarget,
  type SupportCard,
  type EventCard,
  type HeroIdentityCard,
  type KeywordInstance,
  type MainSchemeCard,
  type MainSchemeStage,
  type MinionCard,
  type ResourceCard,
  type ScalingValue,
  type SchemeIcon,
  type SideSchemeCard,
  type TreacheryCard,
  type UpgradeCard,
  type VillainCard,
  type VillainStage,
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
}): HeroIdentityCard {
  return {
    ...base(spec.id, spec.name ?? spec.id),
    type: "hero_identity",
    hp: spec.hp,
    keywords: [],
    hero: {
      faceName: `${spec.name ?? spec.id} (hero)`,
      atk: spec.atk,
      thw: spec.thw,
      def: spec.def,
      handSize: spec.heroHandSize,
      text,
      abilities: spec.heroAbilities ?? [],
      traits: [],
    },
    alterEgo: {
      faceName: `${spec.name ?? spec.id} (alter-ego)`,
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
  readonly cost: number;
  readonly atk: number;
  readonly thw: number;
  readonly hp: number;
  readonly resources?: number;
  readonly consequentialAttack?: number;
  readonly consequentialThwart?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): AllyCard {
  return {
    ...base(spec.id, spec.id),
    type: "ally",
    aspect: "basic",
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: { wild: spec.resources ?? 0 },
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
    traits: [],
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
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): EventCard {
  return {
    ...base(spec.id, spec.id),
    type: "event",
    aspect: "basic",
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: { wild: spec.resources ?? 0 },
  };
}

export function stubResource(spec: { readonly id: string; readonly icons: number }): ResourceCard {
  return {
    ...base(spec.id, spec.id),
    type: "resource",
    aspect: "basic",
    traits: [],
    keywords: [],
    text,
    abilities: [],
    producesIcons: { wild: spec.icons },
  };
}

export function stubVillain(spec: {
  readonly id: string;
  readonly stages: readonly {
    readonly hp: ScalingValue;
    readonly atk: number;
    readonly sch: number;
    readonly keywords?: readonly KeywordInstance[];
    readonly abilities?: readonly AbilityReference[];
  }[];
}): VillainCard {
  const stages = spec.stages.map(
    (stage, index): VillainStage => ({
      stageNumber: index + 1,
      hp: stage.hp,
      atk: stage.atk,
      sch: stage.sch,
      text,
      traits: [],
      keywords: stage.keywords ?? [],
      abilities: stage.abilities ?? [],
    }),
  );
  const [first, ...rest] = stages;
  if (!first) throw new Error("stubVillain needs at least one stage");
  return {
    ...base(spec.id, spec.id),
    type: "villain",
    encounterSetIds: [],
    sides: [{ side: "A", name: spec.id, stages: [first, ...rest] }],
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
  readonly atk: number;
  readonly sch: number;
  readonly hp: number;
  readonly boostIcons?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): MinionCard {
  return {
    ...base(spec.id, spec.id),
    type: "minion",
    encounterSetIds: [],
    boostIcons: spec.boostIcons ?? 1,
    traits: [],
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
  readonly boostIcons?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): TreacheryCard {
  return {
    ...base(spec.id, spec.id),
    type: "treachery",
    encounterSetIds: [],
    boostIcons: spec.boostIcons ?? 1,
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
  };
}

export function stubSideScheme(spec: {
  readonly id: string;
  readonly startingThreat: number;
  readonly icons?: readonly SchemeIcon[];
  readonly boostIcons?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): SideSchemeCard {
  return {
    ...base(spec.id, spec.id),
    type: "side_scheme",
    encounterSetIds: [],
    startingThreat: flat(spec.startingThreat),
    icons: spec.icons ?? [],
    boostIcons: spec.boostIcons ?? 1,
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
  };
}

export function stubSupport(spec: {
  readonly id: string;
  readonly cost: number;
  readonly resources?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): SupportCard {
  return {
    ...base(spec.id, spec.id),
    type: "support",
    aspect: "basic",
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    cost: spec.cost,
    resourceIcons: { wild: spec.resources ?? 0 },
  };
}

export function stubAttachment(spec: {
  readonly id: string;
  readonly attachesTo: AttachmentTarget;
  readonly boostIcons?: number;
  readonly keywords?: readonly KeywordInstance[];
  readonly abilities?: readonly AbilityReference[];
}): AttachmentCard {
  return {
    ...base(spec.id, spec.id),
    type: "attachment",
    encounterSetIds: [],
    boostIcons: spec.boostIcons ?? 0,
    traits: [],
    keywords: spec.keywords ?? [],
    text,
    abilities: spec.abilities ?? [],
    attachesTo: spec.attachesTo,
  };
}
