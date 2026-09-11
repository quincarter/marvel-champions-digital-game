import type {
  AllyCard,
  AnyCard,
  AttachmentCard,
  AttachmentHost,
  HeroIdentityCard,
  MainSchemeCard,
  MinionCard,
  PlayerCard,
  SideSchemeCard,
  TreacheryCard,
  UpgradeCard,
  VillainCard,
} from "./cards/index.js";
import { ATTACHMENT_HOST_KINDS } from "./cards/attachment-host.js";
import type { AbilityReference } from "./abilities.js";
import type { Scenario, StarterDeck } from "./sets.js";

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const ok: ValidationResult = { valid: true, errors: [] };
const fail = (...errors: string[]): ValidationResult => ({ valid: false, errors });
const result = (errors: readonly string[]): ValidationResult => (errors.length === 0 ? ok : fail(...errors));

function isCardText(value: unknown): value is { printed: string; current: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.printed === "string" && v.printed.length > 0 && typeof v.current === "string" && v.current.length > 0;
}

/** Empty strings allowed: some printed cards have no rules text at all (Energy Absorption, Rhino I, Usurp the Throne). */
function isCardTextAllowEmpty(value: unknown): value is { printed: string; current: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.printed === "string" && typeof v.current === "string";
}

const isPrintedStat = (value: unknown): boolean =>
  value === null || value === "X" || (typeof value === "number" && Number.isFinite(value) && value >= 0);

function isScalingValue(value: unknown): value is { base: number; perPlayer: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.base === "number" && typeof v.perPlayer === "number";
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Every `AbilityReference` needs an id; the dropped `trigger` field is rejected so stale data is caught. */
function abilityRefErrors(refs: unknown, label: string): string[] {
  if (!Array.isArray(refs)) return [`${label} abilities must be an array`];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs as readonly AbilityReference[]) {
    if (!ref || !isNonEmptyString(ref.id)) {
      errors.push(`${label} has an ability reference without an id`);
      continue;
    }
    if (seen.has(ref.id)) errors.push(`${label} references ability ${ref.id} twice`);
    seen.add(ref.id);
    if ("trigger" in ref) errors.push(`${label} ability ${ref.id} has a 'trigger' field (dropped in Phase 2)`);
    if (ref.label !== undefined && !isNonEmptyString(ref.label)) errors.push(`${label} ability ${ref.id} label is empty`);
  }
  return errors;
}

function keywordListErrors(keywords: unknown, label: string): string[] {
  if (!Array.isArray(keywords)) return [`${label} keywords must be an array`];
  const errors: string[] = [];
  for (const k of keywords as readonly { name?: unknown; count?: unknown; value?: unknown }[]) {
    if (!k || !isNonEmptyString(k.name)) errors.push(`${label} has a keyword without a name`);
    if (k?.name === "uses" && (!isNonNegativeNumber(k.count) || (k.count as number) < 1)) {
      errors.push("uses keyword must have a count >= 1");
    }
    if (
      (k?.name === "retaliate" || k?.name === "incite" || k?.name === "hinder" || k?.name === "victory") &&
      !isNonNegativeNumber(k.value)
    ) {
      errors.push(`${label} keyword ${String(k.name)} needs a numeric value`);
    }
  }
  return errors;
}

export function validateAttachmentHost(host: unknown, label: string): string[] {
  if (typeof host !== "object" || host === null) return [`${label} attachesTo must be an AttachmentHost object`];
  const h = host as Partial<AttachmentHost> & Record<string, unknown>;
  if (!ATTACHMENT_HOST_KINDS.includes(h.kind as AttachmentHost["kind"])) {
    return [`${label} attachesTo.kind '${String(h.kind)}' is not a known host kind`];
  }
  if (h.kind === "namedCard" && !isNonEmptyString(h.name)) return [`${label} namedCard host needs a name`];
  if (
    h.kind === "minionWithHighestPrintedHp" &&
    h.withoutAttachmentNamed !== undefined &&
    !isNonEmptyString(h.withoutAttachmentNamed)
  ) {
    return [`${label} withoutAttachmentNamed must be a non-empty string when present`];
  }
  return [];
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

/** Fields every player-deck card shares: text, keywords, abilities, deck limit, play restrictions. */
function playerCommonErrors(card: PlayerCard): string[] {
  const errors: string[] = [];
  // Resource cards can be printed with no text box (Energy Absorption, Vibranium).
  const textOk = card.type === "resource" ? isCardTextAllowEmpty(card.text) : isCardText(card.text);
  if (!textOk) errors.push(`${card.type} text must have non-empty printed and current strings`);
  errors.push(...keywordListErrors(card.keywords, card.type));
  errors.push(...abilityRefErrors(card.abilities, card.type));
  if (!isPositiveInteger(card.deckLimit)) errors.push(`${card.type} deckLimit must be a positive integer`);
  const r = card.playRestrictions;
  if (r !== undefined) {
    if (typeof r !== "object" || r === null) errors.push("playRestrictions must be an object");
    else {
      if (r.maxPerPlayer !== undefined && !isPositiveInteger(r.maxPerPlayer)) {
        errors.push("playRestrictions.maxPerPlayer must be a positive integer");
      }
      if (r.maxPerHost !== undefined && !isPositiveInteger(r.maxPerHost)) {
        errors.push("playRestrictions.maxPerHost must be a positive integer");
      }
      if (r.form !== undefined && r.form !== "hero" && r.form !== "alterEgo") {
        errors.push("playRestrictions.form must be 'hero' or 'alterEgo'");
      }
      if (r.anyPlayerControl !== undefined && typeof r.anyPlayerControl !== "boolean") {
        errors.push("playRestrictions.anyPlayerControl must be a boolean");
      }
    }
  }
  if ("cost" in card && !isNonNegativeNumber(card.cost)) errors.push(`${card.type} cost must be a non-negative number`);
  return errors;
}

export function validateAllyCard(card: AllyCard): ValidationResult {
  const errors = [...baseErrors(card), ...playerCommonErrors(card)];
  if (!isPrintedStat(card.atk)) errors.push("ally atk must be a non-negative number, \"X\", or null (printed —)");
  if (!isPrintedStat(card.thw)) errors.push("ally thw must be a non-negative number, \"X\", or null (printed —)");
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("ally hp must be a positive number");
  if (
    !card.consequentialDamage ||
    !isNonNegativeNumber(card.consequentialDamage.attack) ||
    !isNonNegativeNumber(card.consequentialDamage.thwart)
  ) {
    errors.push("ally consequentialDamage must have non-negative attack and thwart values");
  }
  return result(errors);
}

export function validateUpgradeCard(card: UpgradeCard): ValidationResult {
  const errors = [...baseErrors(card), ...playerCommonErrors(card)];
  if (card.attachesTo !== undefined) errors.push(...validateAttachmentHost(card.attachesTo, "upgrade"));
  return result(errors);
}

export function validateHeroIdentityCard(card: HeroIdentityCard): ValidationResult {
  const errors = baseErrors(card);
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("identity hp must be a positive number");
  if ("keywords" in card) errors.push("identity keywords live on each face, not on the card (Phase 2)");
  if (!isNonEmptyString(card.obligationCardId)) errors.push("identity must reference its obligationCardId");
  if (!isNonEmptyString(card.nemesisEncounterSetId)) errors.push("identity must reference its nemesisEncounterSetId");
  if (!card.hero) errors.push("missing hero face");
  else {
    if (!card.hero.faceName) errors.push("hero face missing faceName");
    if (!isCardText(card.hero.text)) errors.push("hero face text must have non-empty printed and current strings");
    if (!isNonNegativeNumber(card.hero.handSize) || card.hero.handSize < 1) {
      errors.push("hero handSize must be a positive number");
    }
    errors.push(...keywordListErrors(card.hero.keywords, "hero face"));
    errors.push(...abilityRefErrors(card.hero.abilities, "hero face"));
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
    errors.push(...keywordListErrors(card.alterEgo.keywords, "alterEgo face"));
    errors.push(...abilityRefErrors(card.alterEgo.abilities, "alterEgo face"));
  }
  return result(errors);
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
        // A villain stage can be printed with no text (Rhino I).
        if (!isCardTextAllowEmpty(stage.text)) errors.push(`${label} text must have printed and current strings`);
        errors.push(...keywordListErrors(stage.keywords, label));
        errors.push(...abilityRefErrors(stage.abilities, label));
      });
    }
  }
  return result(errors);
}

function encounterCommonErrors(
  card: { boostIcons: number; keywords: unknown; abilities: unknown; text: unknown },
  label: string,
): string[] {
  return [
    ...boostErrors(card, label),
    ...keywordListErrors(card.keywords, label),
    ...abilityRefErrors(card.abilities, label),
    ...(isCardText(card.text) ? [] : [`${label} text must have non-empty printed and current strings`]),
  ];
}

export function validateMinionCard(card: MinionCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...boostErrors(card, "minion"));
  errors.push(...keywordListErrors(card.keywords, "minion"));
  errors.push(...abilityRefErrors(card.abilities, "minion"));
  if (!isPrintedStat(card.atk)) errors.push("minion atk must be a non-negative number, \"X\", or null (printed —)");
  if (!isPrintedStat(card.sch)) errors.push("minion sch must be a non-negative number, \"X\", or null (printed —)");
  if (!isNonNegativeNumber(card.hp) || card.hp < 1) errors.push("minion hp must be a positive number");
  return result(errors);
}

export function validateAttachmentCard(card: AttachmentCard): ValidationResult {
  const errors = [...baseErrors(card), ...encounterCommonErrors(card, "attachment")];
  errors.push(...validateAttachmentHost(card.attachesTo, "attachment"));
  const mods = card.statModifiers;
  if (mods !== undefined) {
    if (typeof mods !== "object" || mods === null) errors.push("attachment statModifiers must be an object");
    else {
      for (const [key, value] of Object.entries(mods)) {
        if (!["atk", "sch", "thw", "hp"].includes(key)) errors.push(`attachment statModifiers.${key} is not a stat`);
        else if (typeof value !== "number" || !Number.isFinite(value)) {
          errors.push(`attachment statModifiers.${key} must be a number`);
        }
      }
    }
  }
  return result(errors);
}

export function validateMainSchemeCard(card: MainSchemeCard): ValidationResult {
  const errors = baseErrors(card);
  if (!card.stages || card.stages.length === 0) {
    errors.push("main scheme must have at least one stage");
  } else {
    for (const stage of card.stages) {
      const label = `main scheme stage ${stage.stageNumber}${stage.stageLetter ?? ""}`;
      if (stage.name !== undefined && (typeof stage.name !== "string" || stage.name.trim().length === 0)) {
        errors.push(`${label} name must be a non-empty string when present`);
      }
      if (!isScalingValue(stage.startingThreat)) errors.push(`${label} startingThreat must be a ScalingValue`);
      if (!isScalingValue(stage.targetThreat)) errors.push(`${label} targetThreat must be a ScalingValue`);
      if (!isScalingValue(stage.acceleration)) errors.push(`${label} acceleration must be a ScalingValue`);
      if (!isCardText(stage.text)) errors.push(`${label} text must have printed and current strings`);
      errors.push(...abilityRefErrors(stage.abilities, label));
      if (!stage.aSide || typeof stage.aSide !== "object") errors.push(`${label} is missing its aSide`);
      else {
        if (!isCardText(stage.aSide.text)) errors.push(`${label} aSide text must have printed and current strings`);
        errors.push(...abilityRefErrors(stage.aSide.abilities, `${label} aSide`));
      }
    }
  }
  return result(errors);
}

export function validateSideSchemeCard(card: SideSchemeCard): ValidationResult {
  const errors = baseErrors(card);
  // A side scheme can be printed with no text (Usurp the Throne): the allowance is local to this type.
  errors.push(
    ...encounterCommonErrors({ ...card, text: isCardTextAllowEmpty(card.text) ? { printed: "-", current: "-" } : card.text }, "side scheme"),
  );
  if (!isScalingValue(card.startingThreat)) errors.push("side scheme startingThreat must be a ScalingValue");
  return result(errors);
}

export function validateTreacheryCard(card: TreacheryCard): ValidationResult {
  const errors = baseErrors(card);
  errors.push(...encounterCommonErrors(card, "treachery"));
  if (card.keywords.some((k) => k.name === "surge") && card.abilities.length === 0) {
    errors.push("treachery with surge should reference at least one ability (when_revealed expected)");
  }
  return result(errors);
}

/** Dispatches to the type-specific validator. */
export function validateCard(card: AnyCard): ValidationResult {
  switch (card.type) {
    case "ally":
      return validateAllyCard(card);
    case "upgrade":
      return validateUpgradeCard(card);
    case "event":
    case "support":
    case "resource":
    case "player_side_scheme":
      return result([...baseErrors(card), ...playerCommonErrors(card)]);
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
      return validateAttachmentCard(card);
    case "obligation":
    case "environment":
      return result([...baseErrors(card), ...encounterCommonErrors(card, card.type)]);
  }
}

const isStageRange = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => isPositiveInteger(n)) &&
  (value[0] as number) <= (value[1] as number);

export function validateScenario(scenario: Scenario): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmptyString(scenario.id)) errors.push("scenario missing id");
  if (!isNonEmptyString(scenario.name)) errors.push("scenario missing name");
  if (!isNonEmptyString(scenario.villainCardId)) errors.push("scenario missing villainCardId");
  if (!isNonEmptyString(scenario.mainSchemeCardId)) errors.push("scenario missing mainSchemeCardId");
  for (const key of ["encounterSetIds", "recommendedModularSetIds", "standardEncounterSetIds", "expertEncounterSetIds"] as const) {
    if (!Array.isArray(scenario[key])) errors.push(`scenario ${key} must be an array`);
  }
  if (!scenario.villainStages || !isStageRange(scenario.villainStages.standard) || !isStageRange(scenario.villainStages.expert)) {
    errors.push("scenario villainStages.standard/expert must be [first, last] stage numerals");
  }
  return result(errors);
}

export function validateStarterDeck(deck: StarterDeck): ValidationResult {
  const errors: string[] = [];
  if (!isNonEmptyString(deck.id)) errors.push("starter deck missing id");
  if (!isNonEmptyString(deck.name)) errors.push("starter deck missing name");
  if (!isNonEmptyString(deck.identityCardId)) errors.push("starter deck missing identityCardId");
  if (!Array.isArray(deck.aspects)) errors.push("starter deck aspects must be an array");
  if (!Array.isArray(deck.cards) || deck.cards.length === 0) errors.push("starter deck must list its cards");
  else {
    const seen = new Set<string>();
    for (const entry of deck.cards) {
      if (!isNonEmptyString(entry.cardId)) errors.push("starter deck entry missing cardId");
      else if (seen.has(entry.cardId)) errors.push(`starter deck lists ${entry.cardId} twice`);
      else seen.add(entry.cardId);
      if (!isPositiveInteger(entry.quantity)) errors.push(`starter deck quantity for ${entry.cardId} must be >= 1`);
    }
  }
  if (!deck.provenance || typeof deck.provenance.verified !== "boolean" || !Array.isArray(deck.provenance.sources)) {
    errors.push("starter deck provenance must say whether the list is verified and cite sources");
  } else if (deck.provenance.verified && deck.provenance.sources.length === 0) {
    errors.push("a verified starter deck must cite at least one source");
  }
  return result(errors);
}
