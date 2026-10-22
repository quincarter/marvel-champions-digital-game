/**
 * Worker entry point: the fetch handler plus the Durable Object classes wrangler needs exported by name.
 */

import type { Env } from "./env.js";
import { handleRequest } from "./handler.js";

export { RateLimiter, SyncSpace, TransferRoom } from "./durable-objects.js";

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
