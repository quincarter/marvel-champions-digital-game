export const CONTENT_VERSION = "0.0.0";

/**
 * Schema version for the card data shape itself (independent of how many
 * cards/cycles have been ingested). Bump it by hand only when a breaking
 * card-data shape change lands. It is not the release version: the release
 * must never rewrite it (`.changie.yaml` replacements; `schema-version.test.ts`
 * checks this).
 */
export const SCHEMA_VERSION = "1.0.0";

export * from "./schema/index.js";
export * from "./data/index.js";
export * from "./import/index.js";
