import type {
  AllyCard,
  AnyCard,
  HeroIdentityCard,
  MainSchemeCard,
  MinionCard,
  SideSchemeCard,
  TreacheryCard,
  UpgradeCard,
  VillainCard,
} from "./cards/index.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ok: ValidationResult = { valid: true, errors: [] };
const fail = (...errors: string[]): ValidationResult => ({ valid: false, errors });

function isCardText(value: unknown): value is { printed: string; current: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.printed === "string" && v.printed.length > 0 && typeof v.current === "string" && v.current.length > 0;
}

function isScalingValue(value: unknown): value is { base: number; perPlayer: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.base === "number" && typeof v.perPlayer === "number";
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function baseErrors(card: AnyCard): string[] {
  const errors: string[] = [];
  if (!card.id) errors.push("missing id");
  if (!card.name || card.name.trim().length === 0) errors.push("missing name");
  if (!card.setCode) errors.push("missing setCode");
  if (!card.cycleId) errors.push("missing cycleId");
  if (!card.collectorNumber) errors.push("missing collectorNumber");
  if (!Number.isFinite(card.quantityInSet) || card.quantityInSet < 1) {
    errors.push("quantityInSet must be a positive number");
  }
  if (typeof card.unique !== "boolean") errors.push("missing/invalid unique flag");
  return errors;
}

function boostErrors(card: { boostIcons: number }, label: string): string[] {
  return isNonNegativeNumber(card.boostIcons) && card.boostIcons <= 3
    ? []
    : [`${label} boostIcons must be 0–3`];
}

export function validateAllyCard(card: AllyCard): ValidationResult {
  const errors = baseErrors(card);
  if (!isCardText(card.text)) errors.push("ally text must have non-empty printed and current strings");
  if (!isNonNegativeNumber(card.cost)) errors.push("ally cost must be a non-negative number");
  if (!isNonNegativeNumber(card.atk)) errors.push("ally atk must be a non-negative number");
  if (!isNonNegativeNumber(card.thw)) errors.push("ally thw must be a non-negative number");
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("ally hp must be a positive number");
  if (
    !card.consequentialDamage ||
    !isNonNegativeNumber(card.consequentialDamage.attack) ||
    !isNonNegativeNumber(card.consequentialDamage.thwart)
  ) {
    errors.push("ally consequentialDamage must have non-negative attack and thwart values");
  }
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateUpgradeCard(card: UpgradeCard): ValidationResult {
  const errors = baseErrors(card);
  if (!isCardText(card.text)) errors.push("upgrade text must have non-empty printed and current strings");
  if (!isNonNegativeNumber(card.cost)) errors.push("upgrade cost must be a non-negative number");
  for (const k of card.keywords) {
    if (k.name === "uses" && (!isNonNegativeNumber(k.count) || k.count < 1)) {
      errors.push("uses keyword must have a count >= 1");
    }
  }
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateHeroIdentityCard(card: HeroIdentityCard): ValidationResult {
  const errors = baseErrors(card);
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("identity hp must be a positive number");
  if (!card.hero) errors.push("missing hero face");
  else {
    if (!card.hero.faceName) errors.push("hero face missing faceName");
    if (!isCardText(card.hero.text)) errors.push("hero face text must have non-empty printed and current strings");
    if (!isNonNegativeNumber(card.hero.handSize) || card.hero.handSize < 1) {
      errors.push("hero handSize must be a positive number");
    }
  }
  if (!card.alterEgo) errors.push("missing alterEgo face");
  else {
    if (!card.alterEgo.faceName) errors.push("alterEgo face missing faceName");
    if (!isCardText(card.alterEgo.text)) {
      errors.push("alterEgo face text must have non-empty printed and current strings");
    }
    if (!isNonNegativeNumber(card.alterEgo.rec)) errors.push("alterEgo rec must be a non-negative number");
    if (!isNonNegativeNumber(card.alterEgo.handSize) || card.alterEgo.handSize < 1) {
      errors.push("alterEgo handSize must be a positive number");
    }
  }
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateVillainCard(card: VillainCard): ValidationResult {
  const errors = baseErrors(card);
  if (!card.sides || card.sides.length === 0) {
    errors.push("villain must have at least one side");
  } else {
    for (const side of card.sides) {
      if (!side.stages || side.stages.length === 0) {
        errors.push(`villain side ${side.side} must have at least one stage`);
        continue;
      }
      side.stages.forEach((stage, i) => {
        const label = `villain side ${side.side} stage ${stage.stageNumber}`;
        if (i > 0 && stage.stageNumber <= (side.stages[i - 1]?.stageNumber ?? 0)) {
          errors.push(`${label} must be numbered after the previous stage`);
        }
        if (!isScalingValue(stage.hp)) errors.push(`${label} hp must be a ScalingValue`);
        if (!isNonNegativeNumber(stage.atk)) errors.push(`${label} atk must be a non-negative number`);
        if (!isNonNegativeNumber(stage.sch)) errors.push(`${label} sch must be a non-negative number`);
        if (!isCardText(stage.text)) errors.push(`${label} text must have printed and current strings`);
      });
    }
  }
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateMinionCard(card: MinionCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...boostErrors(card, "minion"));
  if (!isNonNegativeNumber(card.atk)) errors.push("minion atk must be a non-negative number");
  if (!isNonNegativeNumber(card.sch)) errors.push("minion sch must be a non-negative number");
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("minion hp must be a positive number");
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateMainSchemeCard(card: MainSchemeCard): ValidationResult {
  const errors = baseErrors(card);
  if (!card.stages || card.stages.length === 0) {
    errors.push("main scheme must have at least one stage");
  } else {
    for (const stage of card.stages) {
      const label = `main scheme stage ${stage.stageNumber}${stage.stageLetter ?? ""}`;
      if (!isScalingValue(stage.startingThreat)) errors.push(`${label} startingThreat must be a ScalingValue`);
      if (!isScalingValue(stage.targetThreat)) errors.push(`${label} targetThreat must be a ScalingValue`);
      if (!isScalingValue(stage.acceleration)) errors.push(`${label} acceleration must be a ScalingValue`);
      if (!isCardText(stage.text)) errors.push(`${label} text must have printed and current strings`);
    }
  }
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateSideSchemeCard(card: SideSchemeCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...boostErrors(card, "side scheme"));
  if (!isScalingValue(card.startingThreat)) errors.push("side scheme startingThreat must be a ScalingValue");
  if (!isCardText(card.text)) errors.push("side scheme text must have non-empty printed and current strings");
  return errors.length === 0 ? ok : fail(...errors);
}

export function validateTreacheryCard(card: TreacheryCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...boostErrors(card, "treachery"));
  if (!isCardText(card.text)) errors.push("treachery text must have non-empty printed and current strings");
  if (card.keywords.some((k) => k.name === "surge") && card.abilities.length === 0) {
    errors.push("treachery with surge should reference at least one ability (when_revealed expected)");
  }
  return errors.length === 0 ? ok : fail(...errors);
}

/** Dispatches to the type-specific validator; card types without one get base-field checks only. */
export function validateCard(card: AnyCard): ValidationResult {
  switch (card.type) {
    case "ally":
      return validateAllyCard(card);
    case "upgrade":
      return validateUpgradeCard(card);
    case "hero_identity":
      return validateHeroIdentityCard(card);
    case "villain":
      return validateVillainCard(card);
    case "minion":
      return validateMinionCard(card);
    case "main_scheme":
      return validateMainSchemeCard(card);
    case "side_scheme":
      return validateSideSchemeCard(card);
    case "treachery":
      return validateTreacheryCard(card);
    case "attachment":
    case "obligation":
    case "environment": {
      const errors = [...baseErrors(card), ...boostErrors(card, card.type)];
      return errors.length === 0 ? ok : fail(...errors);
    }
    default: {
      const errors = baseErrors(card);
      return errors.length === 0 ? ok : fail(...errors);
    }
  }
}
