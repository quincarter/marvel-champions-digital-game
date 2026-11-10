/**
 * The published bundle's half of `registerMarvelCdbNormalizer`: in this repo the importer imports the content
 * package's normalizer from disk when it first runs, but a bundle has no `packages/content/scripts` folder, so the
 * bundle's `import` and `bin` entries import the normalizer statically and hand it over before anything runs.
 */
import { normalizePack } from "../../content/scripts/marvelcdb/normalize.ts";
import { registerMarvelCdbNormalizer, type NormalizePack } from "../src/import-marvelcdb.ts";

registerMarvelCdbNormalizer(normalizePack as unknown as NormalizePack);
