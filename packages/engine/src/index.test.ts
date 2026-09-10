import { ENGINE_VERSION } from "./index.js";

test("engine package resolves", () => {
  expect(ENGINE_VERSION).toBe("0.0.0");
});
