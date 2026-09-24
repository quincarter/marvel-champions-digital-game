/**
 * The package's public surface, for tests and tooling. The app itself boots
 * from `main.ts`; nothing imports the client as a library at runtime.
 */

export const CLIENT_VERSION = "0.6.0";

export type { EngineHost, EngineUpdate, SessionConfig } from "./engine/host.js";
export { LocalEngineHost } from "./engine/local-host.js";
export { WorkerEngineHost } from "./engine/worker-host.js";
export { SessionStore, type SessionState } from "./store/session-store.js";
export { boardModel, type BoardModel } from "./view/board-model.js";
export { highlights, type Highlights } from "./view/highlights.js";
export { appendEvents, emptyLog, type LogLine, type LogState } from "./view/log-lines.js";
export { appendWalkthrough, emptyWalkthrough, type Walkthrough } from "./view/villain-walkthrough.js";
export { boardLayout, formFactorFor, type BoardLayout } from "./view/layout.js";
