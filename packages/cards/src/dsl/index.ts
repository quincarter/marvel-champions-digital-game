/**
 * The ability DSL: authoring sugar over the engine's plain-data
 * `AbilityDefinition` vocabulary. It never interprets anything — every builder
 * returns engine JSON, and `defineAbilities` validates the result.
 */
export * from "./values.js";
export * from "./effects.js";
export * from "./abilities.js";
export * from "./validate.js";
