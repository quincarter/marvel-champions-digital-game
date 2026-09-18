/**
 * Serializes normalized records to human-diffable TypeScript modules.
 *
 * Output is typed against the real schema (`readonly AnyCard[]` etc.), so
 * `pnpm typecheck` checks every generated record. Branded ids are written as
 * calls to the schema's own helpers (`cardId("01001a")`, `trait("AVENGER")`),
 * chosen by the property key they sit under — the table below is the single
 * place that decides which strings are branded.
 *
 * Layout: one record per block, one property per line, except short objects
 * and arrays of primitives (ScalingValue, keyword instances, resource icons)
 * which stay on one line so a diff shows a changed number in context.
 */
export type BrandFn =
  | "cardId"
  | "abilityId"
  | "setCode"
  | "cycleId"
  | "encounterSetId"
  | "scenarioId"
  | "starterDeckId"
  | "imageRef"
  | "trait";

const KEY_BRANDS: Readonly<Record<string, BrandFn>> = {
  setCode: "setCode",
  cycleId: "cycleId",
  packCode: "setCode",
  packCodes: "setCode",
  encounterSetIds: "encounterSetId",
  nemesisEncounterSetId: "encounterSetId",
  recommendedModularSetIds: "encounterSetId",
  standardEncounterSetIds: "encounterSetId",
  expertEncounterSetIds: "encounterSetId",
  traits: "trait",
  sharedTrait: "trait",
  requiresIdentityTrait: "trait",
  requiresControlledCharacterTrait: "trait",
  // `HostQualifiers.trait`/`withoutTrait` (`AttachmentHost`'s `qualified`/`superlative` kinds, wave 2).
  trait: "trait",
  withoutTrait: "trait",
  // `SpecificSet.encounterSetId` (wave 2 scenario-/campaign-specific player cards) — singular, distinct from the
  // already-branded plural `encounterSetIds`.
  encounterSetId: "encounterSetId",
  obligationCardId: "cardId",
  villainCardId: "cardId",
  mainSchemeCardId: "cardId",
  identityCardId: "cardId",
  nemesisOfIdentityId: "cardId",
  signatureSideSchemeCardId: "cardId",
  cardId: "cardId",
  duplicateOfCardId: "cardId",
  scenarioIds: "scenarioId",
  image: "imageRef",
};

const INLINE_MAX = 100;

interface Ctx {
  readonly key?: string | undefined;
  readonly parentKey?: string | undefined;
  /** Brands for keys on the top-level record only (e.g. `id` → cardId, Pack `code` → setCode). */
  readonly rootBrands?: Readonly<Record<string, BrandFn>> | undefined;
}

const isPrimitive = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);
const keyLiteral = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));

function brandFor(ctx: Ctx): BrandFn | undefined {
  const { key, parentKey, rootBrands } = ctx;
  if (key === undefined) return undefined;
  if (key === "id" && parentKey === "abilities") return "abilityId";
  // `front`/`back` are image refs only inside a CardImages object.
  if (parentKey === "images" && (key === "front" || key === "back")) return "imageRef";
  return rootBrands?.[key] ?? (key === "id" ? undefined : KEY_BRANDS[key]);
}

function serialize(value: unknown, indent: string, ctx: Ctx): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    const b = brandFor(ctx);
    return b ? `${b}(${JSON.stringify(value)})` : JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // Array elements keep the array's key for branding; objects inside see it as their parent.
    const items = value.map((v) =>
      isPrimitive(v)
        ? serialize(v, inner, { key: ctx.key, parentKey: ctx.parentKey })
        : serialize(v, inner, { parentKey: ctx.key }),
    );
    const oneLine = `[${items.join(", ")}]`;
    if (!oneLine.includes("\n") && oneLine.length <= INLINE_MAX && value.every((v) => isPrimitive(v) || isSmallObject(v))) {
      return oneLine;
    }
    return `[\n${items.map((i) => `${inner}${i},`).join("\n")}\n${indent}]`;
  }
  if (typeof value === "object") {
    let entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    // Top-level records read `id`, then `type`, then everything else.
    if (ctx.rootBrands && !ctx.key && !ctx.parentKey && entries.some(([k]) => k === "type")) {
      const rank = (k: string) => (k === "id" ? 0 : k === "type" ? 1 : 2);
      entries = [...entries].sort(([a], [b]) => rank(a) - rank(b));
    }
    if (entries.length === 0) return "{}";
    const parts = entries.map(
      ([k, v]) =>
        `${keyLiteral(k)}: ${serialize(v, inner, { key: k, parentKey: ctx.parentKey ?? ctx.key, ...(ctx.rootBrands && !ctx.key && !ctx.parentKey ? { rootBrands: ctx.rootBrands } : {}) })}`,
    );
    const oneLine = `{ ${parts.join(", ")} }`;
    if (isSmallObject(value) && oneLine.length <= INLINE_MAX) return oneLine;
    return `{\n${parts.map((p) => `${inner}${p},`).join("\n")}\n${indent}}`;
  }
  throw new Error(`cannot serialize ${typeof value}`);
}

/** Objects whose values are all primitives or primitive arrays (and short) render inline. */
function isSmallObject(v: unknown): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v).every(
    (x) => x === undefined || (typeof x !== "string" && isPrimitive(x)) || (typeof x === "string" && x.length <= 40) || (Array.isArray(x) && x.every(isPrimitive) && x.length <= 3),
  );
}

export interface ExportSpec {
  readonly name: string;
  /** Type annotation, e.g. "readonly AnyCard[]". */
  readonly type: string;
  readonly value: unknown;
  readonly rootBrands: Readonly<Record<string, BrandFn>>;
  readonly doc?: string;
}

export interface ModuleSpec {
  readonly header: readonly string[];
  /** Type-only imports: module specifier → names. */
  readonly typeImports: Readonly<Record<string, readonly string[]>>;
  /** Where the brand helper functions are imported from. */
  readonly schemaSpecifier: string;
  readonly exports: readonly ExportSpec[];
}

export function emitModule(spec: ModuleSpec): string {
  const bodies = spec.exports.map((e) => {
    const value = Array.isArray(e.value)
      ? `[\n${e.value.map((v) => `  ${serialize(v, "  ", { rootBrands: e.rootBrands })},`).join("\n")}\n]`
      : serialize(e.value, "", { rootBrands: e.rootBrands });
    return `${e.doc ? `/** ${e.doc} */\n` : ""}export const ${e.name}: ${e.type} = ${value};\n`;
  });
  const body = bodies.join("\n");
  const helpers = (["abilityId", "cardId", "cycleId", "encounterSetId", "imageRef", "scenarioId", "setCode", "starterDeckId", "trait"] as const).filter(
    (h) => new RegExp(`\\b${h}\\(`).test(body),
  );
  const lines = [...spec.header.map((h) => `// ${h}`), ""];
  if (helpers.length > 0) lines.push(`import { ${helpers.join(", ")} } from "${spec.schemaSpecifier}";`);
  for (const [from, names] of Object.entries(spec.typeImports)) {
    if (names.length > 0) lines.push(`import type { ${[...names].sort().join(", ")} } from "${from}";`);
  }
  lines.push("", body);
  return lines.join("\n");
}
