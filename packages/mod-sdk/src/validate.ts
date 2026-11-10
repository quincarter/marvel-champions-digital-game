import { PLAYABLE_DEPS, validateDefinition } from "@mc/cards";
import {
  PACK_KINDS,
  PACK_SCHEMA_VERSION,
  PLAYABLE_CARDS,
  customCardPrefix,
  isPackId,
  isSafePackPath,
  type AnyCard,
  type PackManifest,
  type StarterDeck,
} from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { SUPPORTED_DSL_FEATURES, dslFeatures } from "./features.js";
import { PACK_ABILITY_ID } from "./define.js";
import { sha256Hex } from "./sha256.js";

/** One problem `validatePack` found: where (a manifest field, a file path, a card code) and what. */
export interface PackIssue {
  readonly path: string;
  readonly message: string;
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
}

/** What a pack is checked against: the base game's abilities and card codes, and the DSL features the client has. */
export interface ValidateOptions {
  readonly baseAbilities?: AbilityRegistry;
  readonly baseCardCodes?: ReadonlySet<string>;
  readonly supportedFeatures?: readonly string[];
}

export const REQUIRED_PACK_FILES: readonly string[] = ["CREDITS.md", "PERMISSION.md"];

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CARD_NUMBER = /^\d+[a-z]?$/;
const SHA256 = /^[0-9a-f]{64}$/;

let defaultBaseCodes: ReadonlySet<string> | undefined;
const baseCodes = (): ReadonlySet<string> => (defaultBaseCodes ??= new Set(PLAYABLE_CARDS.map((card) => card.id)));

/** Checks a pack against docs/custom-content-packs.md §11.2. An empty list means the pack is valid. */
export function validatePack(input: PackInput, options: ValidateOptions = {}): readonly PackIssue[] {
  const issues: PackIssue[] = [];
  const add = (path: string, message: string): void => void issues.push({ path, message });
  const baseAbilities = options.baseAbilities ?? PLAYABLE_DEPS.abilities;
  const baseCardCodes = options.baseCardCodes ?? baseCodes();
  const supported = new Set(options.supportedFeatures ?? SUPPORTED_DSL_FEATURES);
  const { manifest } = input;

  checkManifestFields(manifest, add);
  const prefix = customCardPrefix(String(manifest.id));

  // Cards: custom codes under the pack's prefix, none twice.
  const packCodes = new Set<string>();
  for (const card of input.cards) {
    const code = String(card.id);
    if (!code.startsWith(prefix)) add(`cards/${code}`, `card code must start with "${prefix}"`);
    else if (!CARD_NUMBER.test(code.slice(prefix.length)))
      add(`cards/${code}`, `card code must be "${prefix}<number>" with an optional face letter, e.g. "${prefix}01a"`);
    if (packCodes.has(code)) add(`cards/${code}`, "card code is used by two cards");
    packCodes.add(code);
  }
  const knownCard = (code: string): boolean => packCodes.has(code) || baseCardCodes.has(code);
  for (const card of input.cards) {
    const code = String(card.id);
    if (card.type === "hero_identity" && !knownCard(String(card.obligationCardId)))
      add(`cards/${code}`, `obligationCardId "${card.obligationCardId}" is in neither the pack nor the base game`);
    if (card.otherFaceId !== undefined && !knownCard(String(card.otherFaceId)))
      add(`cards/${code}`, `otherFaceId "${card.otherFaceId}" is in neither the pack nor the base game`);
  }

  // Abilities: well-formed ids, each passing the base DSL's own checks, none shadowing the base game's.
  for (const [id, definition] of Object.entries(input.abilities)) {
    if (!PACK_ABILITY_ID.test(id) || !id.startsWith(prefix))
      add(`abilities/${id}`, `ability id must be "${prefix}<card number>.<slug>"`);
    if (id in baseAbilities) add(`abilities/${id}`, "ability id is already defined by the base game");
    for (const problem of validateDefinition(definition)) add(`abilities/${id}`, problem);
  }
  for (const card of input.cards) {
    for (const ref of abilityRefsOf(card)) {
      if (!(ref in input.abilities) && !(ref in baseAbilities))
        add(`cards/${card.id}`, `ability "${ref}" is defined by neither the pack nor the base game`);
    }
  }

  // DSL features: the pack's own, all known to the client, and the manifest declares exactly them.
  const features = dslFeatures(input.abilities);
  for (const feature of features) {
    if (!supported.has(feature)) add("abilities", `uses DSL feature "${feature}", which this game version lacks`);
  }
  const declared = manifest.requires?.dslFeatures;
  if (Array.isArray(declared)) {
    if (declared.join("\n") !== features.join("\n"))
      add("pack.json requires.dslFeatures", `must list exactly the features the abilities use: ${features.join(", ")}`);
  }

  checkFiles(input, add);

  // Decks: every card exists in the pack or the base pool.
  for (const deck of input.decks ?? []) {
    if (!knownCard(String(deck.identityCardId)))
      add(`decks/${deck.id}`, `identity "${deck.identityCardId}" is in neither the pack nor the base game`);
    for (const entry of deck.cards) {
      if (!knownCard(String(entry.cardId)))
        add(`decks/${deck.id}`, `card "${entry.cardId}" is in neither the pack nor the base game`);
      if (!Number.isInteger(entry.quantity) || entry.quantity < 1)
        add(`decks/${deck.id}`, `card "${entry.cardId}" needs a whole quantity of at least 1`);
    }
  }
  return issues;
}

function checkManifestFields(manifest: PackManifest, add: (path: string, message: string) => void): void {
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
  if (typeof requires !== "object" || requires === null) {
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
  if (typeof contents !== "object" || contents === null || typeof contents.cards !== "string")
    add(at("contents.cards"), "must name the cards file");
  if (!Array.isArray(manifest.files)) add(at("files"), "must be a list");
  if (typeof manifest.totalBytes !== "number" || !Number.isInteger(manifest.totalBytes) || manifest.totalBytes < 0)
    add(at("totalBytes"), "must be a whole number");
}

function checkFiles(input: PackInput, add: (path: string, message: string) => void): void {
  const { manifest, files } = input;
  if (!Array.isArray(manifest.files)) return;
  const listed = new Set<string>();
  let total = 0;
  for (const entry of manifest.files) {
    const path = String(entry.path);
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
    const bytes = files.get(path);
    if (!bytes) {
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
    if (!files.has(required)) add(required, "required file is missing");
    else if (files.get(required)!.length === 0) add(required, "required file is empty");
  }
  const contents = manifest.contents;
  for (const [role, path] of Object.entries(contents ?? {})) {
    if (typeof path === "string" && !listed.has(path))
      add(`pack.json contents.${role}`, `"${path}" is not a listed file`);
  }
  for (const [role, byCard] of Object.entries(manifest.pictures ?? {})) {
    for (const [code, path] of Object.entries(byCard)) {
      if (!listed.has(path)) add(`pack.json pictures.${role}.${code}`, `"${path}" is not a listed file`);
    }
  }
}

/** Every ability id a card record names, on any face. */
function abilityRefsOf(value: unknown): readonly string[] {
  const refs: string[] = [];
  const visit = (node: unknown, key: string): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key);
    } else if (typeof node === "object" && node !== null) {
      const record = node as Record<string, unknown>;
      if (key === "abilities" && typeof record.id === "string") refs.push(record.id);
      for (const [childKey, child] of Object.entries(record)) visit(child, childKey);
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
  return {
    manifest,
    files,
    cards: list(manifest.contents.cards) ?? [],
    abilities: abilities as AbilityRegistry,
    ...(decks ? { decks } : {}),
    ...(scenarios ? { scenarios } : {}),
  };
}
