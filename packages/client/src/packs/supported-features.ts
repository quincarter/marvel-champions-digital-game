/**
 * The ability-DSL features this client can run, checked against a pack's `requires.dslFeatures` (docs/custom-content-packs.md
 * §6). The SDK owns the list, so a pack author's `mc-pack validate` and this client agree by construction.
 */
export { SUPPORTED_DSL_FEATURES } from "@mc/mod-sdk";
