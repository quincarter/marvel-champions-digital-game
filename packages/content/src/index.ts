export const CONTENT_VERSION = "0.0.0";

/**
 * Schema version for the card data shape itself (independent of how many
 * cards/cycles have been ingested). Bump when a breaking shape change lands.
 */
export const SCHEMA_VERSION = "0.1.1";

export * from "./schema/index.js";
export * from "./data/index.js";
export * from "./import/index.js";
