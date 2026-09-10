export const CONTENT_VERSION = "0.0.0";

/**
 * Schema version for the card data shape itself (independent of how many
 * cards/cycles have been ingested). Bump when a breaking shape change lands.
 */
export const SCHEMA_VERSION = "0.1.0";

export * from "./schema/index.js";
