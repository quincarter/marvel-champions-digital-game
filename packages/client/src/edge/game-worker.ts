/**
 * The entry of the game's Cloudflare Worker (`wrangler.game.jsonc`). Only the default export: the Workers runtime reads
 * every named export of the entry module as an entrypoint, so the logic and its constants live in `game-routes.ts`.
 */
import { handleGameRequest, type GameWorkerEnv } from "./game-routes.js";

export default {
  fetch: (request: Request, env: GameWorkerEnv) => handleGameRequest(request, env),
};
