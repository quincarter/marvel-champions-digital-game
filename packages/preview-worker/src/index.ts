/**
 * Worker entry point for the pull request previews (`https://pr-<n>.<domain>`); the logic is in handler.ts.
 */

import type { Env } from "./env.ts";
import { handleRequest } from "./handler.ts";

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleRequest(request, env),
};
