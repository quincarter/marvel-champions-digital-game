import { PLAYABLE_DEPS, customScenarioProblems, validateDefinition } from "@mc/cards";
import {
  PACK_KINDS,
  PACK_SCHEMA_VERSION,
  PLAYABLE_CARDS,
  customCardPrefix,
  isLanguageTag,
  isPackId,
  isSafePackPath,
  parsePackCardImagePath,
  validateCard,
  validateEncounterSet,
  validateScenario,
  validateStarterDeck,
  type AnyCard,
  type EncounterSet,
  type PackManifest,
  type Scenario,
  type StarterDeck,
} from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { SUPPORTED_DSL_FEATURES, dslFeatures } from "./features.js";
import { PACK_ABILITY_ID } from "./define.js";
import { sha256Hex } from "./sha256.js";

/**
 * What kind of problem an issue is. Absent means a plain defect. `"unscripted-ability"` means the pack is otherwise
 * well formed but a card names an ability nobody has written yet: the normal state of a pack converted from card data
 * (`importMarvelCdbPack`) before its scripts exist. Tools list these apart from real defects (`splitIssues`).
 */
export type PackIssueCategory = "unscripted-ability";

/** One problem `validatePack` found: where (a manifest field, a file path, a card code) and what. */
export interface PackIssue {
  readonly path: string;
  readonly message: string;
  readonly category?: PackIssueCategory;
}

/** Whether an issue is only "this ability is not scripted yet". */
export const isUnscriptedAbilityIssue = (issue: PackIssue): boolean => issue.category === "unscripted-ability";

/** Splits issues into the unscripted-ability ones and every other (real) defect. */
export function splitIssues(issues: readonly PackIssue[]): {
  readonly unscripted: readonly PackIssue[];
  readonly defects: readonly PackIssue[];
} {
  return {
    unscripted: issues.filter(isUnscriptedAbilityIssue),
    defects: issues.filter((issue) => !isUnscriptedAbilityIssue(issue)),
  };
}

/** A pack held in memory: the manifest, every file by path (except `pack.json`) and the parsed data files. */
export interface PackInput {
  readonly manifest: PackManifest;
  /** Every file of the pack except `pack.json`, by its path inside the pack. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly cards: readonly AnyCard[];
  /** The pack's own abilities, keyed `x.<pack-id>.<card number>.<slug>`. */
  readonly abilities: AbilityRegistry;
  readonly decks?: readonly StarterDeck[];
  readonly scenarios?: readonly unknown[];
  /** The pack's own `EncounterSet` records (a nemesis set, a modular set, a scenario's own set): ids `<pack-id>-<name>`. */
  readonly encounterSets?: readonly EncounterSet[];
  /** The pack's campaigns, carried untouched: `validatePack` only checks the list (campaign packs are designed apart). */
  readonly campaigns?: readonly unknown[];
}

/** What a pack is checked against: the base game's abilities and card codes, and the DSL features the client has. */
export interface ValidateOptions {
  readonly baseAbilities?: AbilityRegistry;
  readonly baseCardCodes?: ReadonlySet<string>;
  readonly supportedFeatures?: readonly string[];
  /**
   * The card codes of the packs this one lists in `requires.packs`, so its decks and cards may name them. Without
   * it, only the pack's own cards and the base game's are known.
   */
  readonly requiredPackCards?: ReadonlySet<string>;
}

export const REQUIRED_PACK_FILES: readonly string[] = ["CREDITS.md", "PERMISSION.md"];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CARD_NUMBER = /^\d+[a-z]?$/;
const SHA256 = /^[0-9a-f]{64}$/;

let defaultBaseCodes: ReadonlySet<string> | undefined;
const baseCodes = (): ReadonlySet<string> => (defaultBaseCodes ??= new Set(PLAYABLE_CARDS.map((card) => card.id)));

type Add = (path: string, message: string, category?: PackIssueCategory) => void;
type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const has = (record: object, key: string): boolean => Object.hasOwn(record, key);
const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Checks a pack against docs/custom-content-packs.md §11.2. An empty list means the pack is valid. The input is
 * untrusted (a downloaded pack): it never throws on a malformed one, it reports it.
 */
export function validatePack(input: PackInput, options: ValidateOptions = {}): readonly PackIssue[] {
  const issues: PackIssue[] = [];
  const add: Add = (path, message, category) =>
    void issues.push(category ? { path, message, category } : { path, message });
  try {
    validateInto(input, options, add);
  } catch (error) {
    add("pack", `could not be checked: ${errorText(error)}`);
  }
  return issues;
}

function validateInto(input: PackInput, options: ValidateOptions, add: Add): void {
  if (!isObj(input) || !isObj(input.manifest)) {
    add("pack.json", "must be a JSON object");
    return;
  }
  const baseAbilities = options.baseAbilities ?? PLAYABLE_DEPS.abilities;
  const baseCardCodes = options.baseCardCodes ?? baseCodes();
  const supported = new Set(options.supportedFeatures ?? SUPPORTED_DSL_FEATURES);
  const { manifest } = input;

  checkManifestFields(manifest, add);
  const packId = typeof manifest.id === "string" ? manifest.id : "";
  const prefix = customCardPrefix(packId);

  // Cards: custom codes under the pack's prefix, none twice, each passing the content schema's own checks.
  const cards: Obj[] = [];
  if (!Array.isArray(input.cards)) add("data/cards.json", "must be a list of cards");
  else {
    input.cards.forEach((card, index) => {
      if (isObj(card)) cards.push(card);
      else add(`cards[${index}]`, "must be a card object");
    });
  }
  const packCodes = new Set<string>();
  for (const card of cards) {
    const code = typeof card.id === "string" ? card.id : "";
    const at = `cards/${code || "?"}`;
    if (code === "") add(at, "card needs an id");
    else if (!code.startsWith(prefix)) add(at, `card code must start with "${prefix}"`);
    else if (!CARD_NUMBER.test(code.slice(prefix.length)))
      add(at, `card code must be "${prefix}<number>" with an optional face letter, e.g. "${prefix}01a"`);
    if (packCodes.has(code)) add(at, "card code is used by two cards");
    packCodes.add(code);
    runContentCheck(at, () => validateCard(card as unknown as AnyCard), add);
  }
  const knownCard = (code: string): boolean =>
    packCodes.has(code) || baseCardCodes.has(code) || (options.requiredPackCards?.has(code) ?? false);
  for (const card of cards) {
    const at = `cards/${String(card.id)}`;
    if (card.type === "hero_identity" && !knownCard(String(card.obligationCardId)))
      add(at, `obligationCardId "${String(card.obligationCardId)}" is in neither the pack nor the base game`);
    if (card.otherFaceId !== undefined && !knownCard(String(card.otherFaceId)))
      add(at, `otherFaceId "${String(card.otherFaceId)}" is in neither the pack nor the base game`);
  }

  // The card numbers abilities may name: a double-sided card's other face (`01b` of card `01a`) shares its digits.
  const cardNumbers = new Set([...packCodes].map((code) => digitsOf(code.slice(prefix.length))));
  // Abilities: well-formed ids on one of the pack's cards, each passing the base DSL's own checks, none shadowing
  // the base game's.
  const abilities: AbilityRegistry = isObj(input.abilities) ? (input.abilities as AbilityRegistry) : {};
  if (input.abilities !== undefined && !isObj(input.abilities)) add("data/abilities.json", "must be a JSON object");
  for (const [id, definition] of Object.entries(abilities)) {
    const at = `abilities/${id}`;
    if (!PACK_ABILITY_ID.test(id) || !id.startsWith(prefix))
      add(at, `ability id must be "${prefix}<card number>.<slug>"`);
    else if (!cardNumbers.has(digitsOf(id.slice(prefix.length).split(".")[0]!)))
      add(at, "ability id names a card number the pack has no card for");
    if (has(baseAbilities, id)) add(at, "ability id is already defined by the base game");
    if (!isObj(definition)) {
      add(at, "must be an ability definition object");
      continue;
    }
    try {
      for (const problem of validateDefinition(definition as unknown as AbilityDefinition)) add(at, problem);
    } catch (error) {
      add(at, `could not be checked: ${errorText(error)}`);
    }
  }
  for (const card of cards) {
    for (const ref of abilityRefsOf(card)) {
      if (!has(abilities, ref) && !has(baseAbilities, ref))
        add(
          `cards/${String(card.id)}`,
          `ability "${ref}" is defined by neither the pack nor the base game (not scripted yet)`,
          "unscripted-ability",
        );
    }
  }

  // DSL features: the pack's own, all known to the client, and the manifest declares exactly them.
  const features = dslFeatures(abilities);
  for (const feature of features) {
    if (!supported.has(feature)) add("abilities", `uses DSL feature "${feature}", which this game version lacks`);
  }
  const declared = manifest.requires?.dslFeatures;
  if (Array.isArray(declared) && declared.join("\n") !== features.join("\n"))
    add("pack.json requires.dslFeatures", `must list exactly the features the abilities use: ${features.join(", ")}`);

  checkFiles(input, add);
  // A picture may be of any face of a pack card: `01b` is the back of card `01a`, which shares its number.
  const isPackFace = (code: string): boolean =>
    code.startsWith(prefix) &&
    CARD_NUMBER.test(code.slice(prefix.length)) &&
    cardNumbers.has(digitsOf(code.slice(prefix.length)));
  checkLanguagesAndArt(input, (code) => knownCard(code) || isPackFace(code), isPackFace, add);

  // Decks: unique ids under the pack's id, every card in the pack or the base pool, and the content schema's checks.
  const deckIds = new Set<string>();
  const decks = input.decks;
  if (decks !== undefined && !Array.isArray(decks)) add("data/decks.json", "must be a list of decks");
  for (const [index, deck] of (Array.isArray(decks) ? decks : []).entries()) {
    if (!isObj(deck)) {
      add(`decks[${index}]`, "must be a deck object");
      continue;
    }
    const id = typeof deck.id === "string" ? deck.id : "";
    const at = `decks/${id || index}`;
    if (!id.startsWith(`${packId}-`) || packId === "") add(at, `deck id must start with "${packId}-"`);
    if (deckIds.has(id)) add(at, "deck id is used by two decks");
    deckIds.add(id);
    runContentCheck(at, () => validateStarterDeck(deck as unknown as StarterDeck), add);
    if (!knownCard(String(deck.identityCardId)))
      add(at, `identity "${String(deck.identityCardId)}" is in neither the pack nor the base game`);
    for (const entry of Array.isArray(deck.cards) ? deck.cards : []) {
      if (!isObj(entry)) {
        add(at, "every deck line must be an object");
        continue;
      }
      if (!knownCard(String(entry.cardId)))
        add(at, `card "${String(entry.cardId)}" is in neither the pack nor the base game`);
      if (typeof entry.quantity !== "number" || !Number.isInteger(entry.quantity) || entry.quantity < 1)
        add(at, `card "${String(entry.cardId)}" needs a whole quantity of at least 1`);
    }
  }

  checkEncounterSets(input, cards, packId, add);
  checkScenarios(input, cards, packId, add);
  const campaigns: unknown = input.campaigns;
  if (campaigns !== undefined && !Array.isArray(campaigns)) add("data/campaigns.json", "must be a list of campaigns");
}

/**
 * The pack's encounter sets (docs/custom-content-packs.md section 5.1): ids under the pack's id, none twice, each
 * passing the content schema's checks and carrying no feature a pack set cannot use yet. Every encounter set id a card
 * of the pack names under the pack's id, and every identity's nemesis set, must be one of these.
 */
function checkEncounterSets(input: PackInput, cards: readonly Obj[], packId: string, add: Add): void {
  const sets = input.encounterSets;
  if (sets !== undefined && !Array.isArray(sets)) add("data/encounter-sets.json", "must be a list of encounter sets");
  const ids = new Set<string>();
  for (const [index, set] of (Array.isArray(sets) ? sets : []).entries()) {
    if (!isObj(set)) {
      add(`encounterSets[${index}]`, "must be an encounter set object");
      continue;
    }
    const id = typeof set.id === "string" ? set.id : "";
    const at = `encounterSets/${id || index}`;
    if (!id.startsWith(`${packId}-`) || packId === "") add(at, `encounter set id must start with "${packId}-"`);
    if (ids.has(id)) add(at, "encounter set id is used by two sets");
    ids.add(id);
    runContentCheck(at, () => validateEncounterSet(set as unknown as EncounterSet), add);
    if (!Array.isArray(set.packCodes)) add(at, "packCodes must be a list");
    for (const field of UNSUPPORTED_SET_FIELDS) {
      if (set[field] !== undefined) add(at, `"${field}" is not available to a pack's encounter set yet`);
    }
    const nemesisOf = cards.find((card) => card.type === "hero_identity" && card.nemesisEncounterSetId === id);
    if (set.nemesisOfIdentityId !== undefined) {
      const owner = cards.find((card) => card.id === set.nemesisOfIdentityId);
      if (!owner || owner.type !== "hero_identity")
        add(at, `nemesisOfIdentityId "${String(set.nemesisOfIdentityId)}" is not a hero identity of this pack`);
      else if (owner.nemesisEncounterSetId !== id)
        add(at, `the identity names "${String(owner.nemesisEncounterSetId)}" as its nemesis set, not this one`);
    } else if (nemesisOf) {
      add(
        at,
        `is ${String(nemesisOf.id)}'s nemesis set, so it needs nemesisOfIdentityId (or it is offered as a modular set)`,
      );
    }
  }
  const belongsToPack = (id: string): boolean => id === packId || id.startsWith(`${packId}-`);
  for (const card of cards) {
    const at = `cards/${String(card.id)}`;
    for (const id of Array.isArray(card.encounterSetIds) ? (card.encounterSetIds as unknown[]) : []) {
      if (typeof id === "string" && belongsToPack(id) && !ids.has(id))
        add(at, `encounter set "${id}" has no record in the pack's encounter sets`);
    }
    const nemesis = card.type === "hero_identity" ? card.nemesisEncounterSetId : undefined;
    if (typeof nemesis === "string" && belongsToPack(nemesis) && !ids.has(nemesis))
      add(at, `nemesis set "${nemesis}" has no record in the pack's encounter sets`);
  }
}

/** `EncounterSet` fields the generic pack path does not build yet. */
const UNSUPPORTED_SET_FIELDS: readonly string[] = [
  "campaignSpecific",
  "competitiveOnly",
  "side",
  "separateDecks",
  "singleVillainOnly",
  "extraModular",
  "autoIncluded",
];

/**
 * The pack's scenarios: the content schema's own checks, ids under the pack's id, and the villain, main scheme and
 * sets resolving to the pack or the base game, with only the fields a pack scenario may carry
 * (`customScenarioProblems`, the same check the game builds from).
 */
function checkScenarios(input: PackInput, cards: readonly Obj[], packId: string, add: Add): void {
  const scenarios = input.scenarios;
  if (scenarios !== undefined && !Array.isArray(scenarios)) add("data/scenarios.json", "must be a list of scenarios");
  const ids = new Set<string>();
  const checked: Scenario[] = [];
  for (const [index, scenario] of (Array.isArray(scenarios) ? scenarios : []).entries()) {
    if (!isObj(scenario)) {
      add(`scenarios[${index}]`, "must be a scenario object");
      continue;
    }
    const id = typeof scenario.id === "string" ? scenario.id : "";
    const at = `scenarios/${id || index}`;
    if (!id.startsWith(`${packId}-`) || packId === "") add(at, `scenario id must start with "${packId}-"`);
    if (ids.has(id)) add(at, "scenario id is used by two scenarios");
    ids.add(id);
    if (typeof scenario.packCode === "string" && scenario.packCode !== packId)
      add(at, `packCode must be the pack's id "${packId}"`);
    let problems = 0;
    runContentCheck(
      at,
      () => {
        const result = validateScenario(scenario as unknown as Scenario);
        problems = result.errors.length;
        return result;
      },
      add,
    );
    if (problems === 0) checked.push(scenario as unknown as Scenario);
  }
  // The references, checked as the game reads them: against the pack's own cards and sets, plus the base game's.
  const custom = {
    cards: cards as unknown as readonly AnyCard[],
    encounterSets: (Array.isArray(input.encounterSets) ? input.encounterSets : []).filter(
      isObj,
    ) as unknown as EncounterSet[],
    scenarios: checked,
  };
  for (const scenario of checked) {
    try {
      for (const problem of customScenarioProblems(scenario, custom)) add(`scenarios/${String(scenario.id)}`, problem);
    } catch (error) {
      add(`scenarios/${String(scenario.id)}`, `could not be checked: ${errorText(error)}`);
    }
  }
}

const digitsOf = (cardNumber: string): string => cardNumber.replace(/[a-z]$/, "");

/** Runs one of `@mc/content`'s validators and reports what it finds; a validator that throws on bad shape is an issue. */
function runContentCheck(path: string, check: () => { readonly errors: readonly string[] }, add: Add): void {
  try {
    for (const message of check().errors) add(path, message);
  } catch (error) {
    add(path, `could not be checked: ${errorText(error)}`);
  }
}

function checkManifestFields(manifest: PackManifest, add: Add): void {
  const at = (field: string): string => `pack.json ${field}`;
  if (manifest.schema !== PACK_SCHEMA_VERSION) add(at("schema"), `must be ${PACK_SCHEMA_VERSION}`);
  if (typeof manifest.id !== "string" || !isPackId(manifest.id))
    add(at("id"), "must be lowercase letters, digits and single dashes, at most 64 characters");
  if (typeof manifest.version !== "string" || !SEMVER.test(manifest.version)) add(at("version"), "must be semver");
  if (!PACK_KINDS.includes(manifest.kind)) add(at("kind"), `must be one of ${PACK_KINDS.join(", ")}`);
  for (const field of ["name", "description", "license"] as const) {
    if (typeof manifest[field] !== "string" || manifest[field].trim() === "")
      add(at(field), "must be a non-empty string");
  }
  if (
    !Array.isArray(manifest.authors) ||
    manifest.authors.length === 0 ||
    manifest.authors.some((a) => typeof a !== "string" || a.trim() === "")
  )
    add(at("authors"), "must list at least one author");
  const requires = manifest.requires;
  if (!isObj(requires)) {
    add(at("requires"), "is required");
  } else {
    if (typeof requires.app !== "string" || requires.app.trim() === "")
      add(at("requires.app"), "must be a semver range");
    if (!Array.isArray(requires.dslFeatures)) add(at("requires.dslFeatures"), "must be a list");
    if (!Array.isArray(requires.packs) || requires.packs.some((p) => typeof p !== "string" || !isPackId(p)))
      add(at("requires.packs"), "must be a list of pack ids");
    else if (requires.packs.includes(manifest.id)) add(at("requires.packs"), "a pack cannot require itself");
  }
  const contents = manifest.contents;
  if (!isObj(contents) || typeof contents.cards !== "string") add(at("contents.cards"), "must name the cards file");
  if (!Array.isArray(manifest.files)) add(at("files"), "must be a list");
  if (typeof manifest.totalBytes !== "number" || !Number.isInteger(manifest.totalBytes) || manifest.totalBytes < 0)
    add(at("totalBytes"), "must be a whole number");
  if (manifest.pictures !== undefined && !isObj(manifest.pictures)) add(at("pictures"), "must be an object");
  checkCredits(manifest, add);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The optional credit fields: permission, template credit and translators. */
function checkCredits(manifest: PackManifest, add: Add): void {
  const at = (field: string): string => `pack.json ${field}`;
  const text = (value: unknown): boolean => typeof value === "string" && value.trim() !== "";
  const permission: unknown = manifest.permission;
  if (permission !== undefined) {
    if (!isObj(permission)) add(at("permission"), "must be an object");
    else {
      if (!text(permission.by)) add(at("permission.by"), "must say who gave permission");
      if (permission.date !== undefined && (typeof permission.date !== "string" || !ISO_DATE.test(permission.date)))
        add(at("permission.date"), "must be YYYY-MM-DD");
      for (const field of ["evidence", "scope"] as const) {
        if (permission[field] !== undefined && !text(permission[field])) add(at(`permission.${field}`), "must be text");
      }
    }
  }
  if (manifest.templateCredit !== undefined && !text(manifest.templateCredit))
    add(at("templateCredit"), "must be text");
  const translators: unknown = manifest.translators;
  if (translators !== undefined) {
    if (!isObj(translators)) add(at("translators"), "must map language tags to names");
    else {
      for (const [lang, name] of Object.entries(translators)) {
        if (!isLanguageTag(lang) || !text(name)) add(at(`translators.${lang}`), "needs a language tag and a name");
      }
    }
  }
}

/**
 * `languages`, the per-language pictures under `cards/<lang>/<code>.webp` and `altArt`
 * (docs/custom-content-packs.md section 5.1): tags are legal, `base` is one of `available`, every picture is of one
 * of the pack's cards in an available language, and every alternate art names a card the game knows and a listed file.
 */
function checkLanguagesAndArt(
  input: PackInput,
  knownCard: (code: string) => boolean,
  isPackFace: (code: string) => boolean,
  add: Add,
): void {
  const { manifest } = input;
  const at = (field: string): string => `pack.json ${field}`;
  const languages: unknown = manifest.languages;
  let available: ReadonlySet<string> | undefined;
  if (languages !== undefined) {
    if (!isObj(languages)) add(at("languages"), "must be { base, available }");
    else {
      const list = languages.available;
      if (!Array.isArray(list) || list.length === 0 || list.some((l) => typeof l !== "string" || !isLanguageTag(l)))
        add(at("languages.available"), 'must list language tags such as "en"');
      else {
        available = new Set(list as string[]);
        if (available.size !== list.length) add(at("languages.available"), "lists a language twice");
        if (typeof languages.base !== "string" || !available.has(languages.base))
          add(at("languages.base"), "must be one of the available languages");
      }
      if (languages.text !== undefined && (typeof languages.text !== "string" || !isLanguageTag(languages.text)))
        add(at("languages.text"), "must be a language tag");
    }
  }
  const listed = new Set(
    Array.isArray(manifest.files)
      ? (manifest.files as unknown[]).flatMap((f) => (isObj(f) && typeof f.path === "string" ? [f.path] : []))
      : [],
  );
  for (const path of listed) {
    const picture = parsePackCardImagePath(path);
    if (!picture) continue;
    if (!available) add(path, 'card pictures need "languages" in pack.json');
    else if (!available.has(picture.lang)) add(path, `language "${picture.lang}" is not in languages.available`);
    if (!isPackFace(picture.code)) add(path, `"${picture.code}" is not a card of this pack`);
  }
  const altArt: unknown = manifest.altArt;
  if (altArt === undefined) return;
  if (!isObj(altArt)) {
    add(at("altArt"), "must map languages to card codes to file paths");
    return;
  }
  for (const [lang, byCode] of Object.entries(altArt)) {
    if (!isObj(byCode)) {
      add(at(`altArt.${lang}`), "must map card codes to file paths");
      continue;
    }
    if (!isLanguageTag(lang) || (available && !available.has(lang)))
      add(at(`altArt.${lang}`), "language is not in languages.available");
    for (const [code, path] of Object.entries(byCode)) {
      if (!knownCard(code)) add(at(`altArt.${lang}.${code}`), "is a card neither the pack nor the base game has");
      if (typeof path !== "string" || !listed.has(path))
        add(at(`altArt.${lang}.${code}`), `"${String(path)}" is not a listed file`);
    }
  }
}

function checkFiles(input: PackInput, add: Add): void {
  const { manifest, files } = input;
  if (!(files instanceof Map)) {
    add("files", "the pack's files must be a Map of path to bytes");
    return;
  }
  for (const [path, bytes] of files) {
    if (!(bytes instanceof Uint8Array)) add(String(path), "file content must be bytes");
  }
  if (!Array.isArray(manifest.files)) return;
  const listed = new Set<string>();
  let total = 0;
  for (const entry of manifest.files as unknown[]) {
    if (!isObj(entry) || typeof entry.path !== "string") {
      add("pack.json files", "every entry needs a string path");
      continue;
    }
    const path = entry.path;
    if (!isSafePackPath(path)) {
      add(path, "unsafe file path (must be relative, with / separators and no .. or empty parts)");
      continue;
    }
    if (path === "pack.json") add(path, "pack.json does not list itself");
    if (listed.has(path)) add(path, "listed twice");
    listed.add(path);
    if (typeof entry.sha256 !== "string" || !SHA256.test(entry.sha256)) {
      add(path, "sha256 must be 64 lowercase hex characters");
      continue;
    }
    if (typeof entry.bytes !== "number" || !Number.isInteger(entry.bytes) || entry.bytes < 0) {
      add(path, "bytes must be a whole number");
      continue;
    }
    const bytes = files.get(path);
    if (!(bytes instanceof Uint8Array)) {
      add(path, "listed in pack.json but missing from the pack");
      continue;
    }
    total += entry.bytes;
    if (bytes.length !== entry.bytes) add(path, `size is ${bytes.length} bytes, pack.json says ${entry.bytes}`);
    else if (sha256Hex(bytes) !== entry.sha256) add(path, "sha256 does not match pack.json");
  }
  for (const path of files.keys()) {
    if (!listed.has(path)) add(path, "in the pack but not listed in pack.json");
  }
  if (Number.isInteger(manifest.totalBytes) && manifest.totalBytes !== total)
    add("pack.json totalBytes", `is ${manifest.totalBytes}, the listed files add up to ${total}`);
  for (const required of REQUIRED_PACK_FILES) {
    const bytes = files.get(required);
    if (!(bytes instanceof Uint8Array)) add(required, "required file is missing");
    else if (bytes.length === 0) add(required, "required file is empty");
  }
  if (isObj(manifest.contents)) {
    for (const [role, path] of Object.entries(manifest.contents)) {
      if (typeof path === "string" && !listed.has(path))
        add(`pack.json contents.${role}`, `"${path}" is not a listed file`);
    }
  }
  if (isObj(manifest.pictures)) {
    for (const [role, byCard] of Object.entries(manifest.pictures)) {
      if (!isObj(byCard)) {
        add(`pack.json pictures.${role}`, "must map card codes to file paths");
        continue;
      }
      for (const [code, path] of Object.entries(byCard)) {
        if (typeof path !== "string" || !listed.has(path))
          add(`pack.json pictures.${role}.${code}`, `"${String(path)}" is not a listed file`);
      }
    }
  }
}

/** Every ability id a card record names, on any face. */
export function abilityRefsOf(value: unknown): readonly string[] {
  const refs: string[] = [];
  const visit = (node: unknown, key: string): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key);
    } else if (isObj(node)) {
      if (key === "abilities" && typeof node.id === "string") refs.push(node.id);
      for (const [childKey, child] of Object.entries(node)) visit(child, childKey);
    }
  };
  visit(value, "");
  return refs;
}

const decoder = new TextDecoder();

/**
 * Builds a `PackInput` from what a client holds after unzipping: `pack.json` parsed, and the files by path. Parses the
 * data files `contents` names. A file that is missing or not JSON is thrown as an `Error` naming it, so a caller can
 * show "this pack is damaged"; everything else is left to `validatePack`.
 */
export function readPackInput(manifest: PackManifest, files: ReadonlyMap<string, Uint8Array>): PackInput {
  const parse = (path: string | undefined): unknown => {
    if (path === undefined) return undefined;
    const bytes = files.get(path);
    if (!bytes) throw new Error(`${path}: missing from the pack`);
    try {
      return JSON.parse(decoder.decode(bytes));
    } catch {
      throw new Error(`${path}: not valid JSON`);
    }
  };
  const list = (path: string | undefined): readonly never[] | undefined => {
    const parsed = parse(path);
    if (parsed === undefined) return undefined;
    if (!Array.isArray(parsed)) throw new Error(`${path}: must be a JSON array`);
    return parsed as never[];
  };
  const abilities = parse(manifest.contents.abilities) ?? {};
  if (typeof abilities !== "object" || abilities === null || Array.isArray(abilities))
    throw new Error(`${manifest.contents.abilities}: must be a JSON object`);
  const decks = list(manifest.contents.decks);
  const scenarios = list(manifest.contents.scenarios);
  const encounterSets = list(manifest.contents.encounterSets);
  const campaigns = list(manifest.contents.campaigns);
  return {
    manifest,
    files,
    cards: list(manifest.contents.cards) ?? [],
    abilities: abilities as AbilityRegistry,
    ...(decks ? { decks } : {}),
    ...(scenarios ? { scenarios } : {}),
    ...(encounterSets ? { encounterSets } : {}),
    ...(campaigns ? { campaigns } : {}),
  };
}
