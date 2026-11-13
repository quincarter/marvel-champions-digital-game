// node --test scripts/ (pnpm test:scripts). The conditional read-merge-write of the Mod Store's index.json.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { CONFLICT, awsCliStore, commandMerge, conditionalUpdate } from "./r2-conditional-update.mjs";

/** An in-memory object with S3's conditional-put semantics, and a hook to slip a rival write in before a put. */
function fakeStore(initial) {
  const state = { body: initial, version: initial == null ? 0 : 1, puts: [] };
  const etag = () => `"v${state.version}"`;
  return {
    state,
    beforePut: null,
    async get() {
      return state.body == null ? { body: null } : { body: state.body, etag: etag() };
    },
    async put(body, cond) {
      if (this.beforePut) await this.beforePut();
      state.puts.push(cond);
      if (cond.ifNoneMatch === "*" ? state.body != null : cond.ifMatch !== etag()) return CONFLICT;
      state.body = body;
      state.version++;
      return "ok";
    },
  };
}

/** Merges like the index upsert: adds one id to a JSON list, keeping what is there. */
const addId = (id) => async (body) => JSON.stringify([...(body ? JSON.parse(body) : []), id].sort());
const noSleep = { sleep: async () => {}, random: () => 0 };

describe("conditionalUpdate", () => {
  it("creates the object with If-None-Match when there is none", async () => {
    const store = fakeStore(null);
    const result = await conditionalUpdate({ get: store.get, put: store.put.bind(store), merge: addId("a") });
    assert.equal(result.attempts, 1);
    assert.deepEqual(store.state.puts, [{ ifNoneMatch: "*" }]);
    assert.equal(store.state.body, '["a"]');
  });

  it("writes with If-Match on the ETag it read", async () => {
    const store = fakeStore('["a"]');
    await conditionalUpdate({ get: store.get, put: store.put.bind(store), merge: addId("b") });
    assert.deepEqual(store.state.puts, [{ ifMatch: '"v1"' }]);
    assert.equal(store.state.body, '["a","b"]');
  });

  it("re-reads and re-merges after a rival write, so neither publisher's pack is lost", async () => {
    const store = fakeStore('["a"]');
    let rivals = 1;
    store.beforePut = async () => {
      if (rivals-- > 0) {
        store.state.body = JSON.stringify([...JSON.parse(store.state.body), "registry"].sort());
        store.state.version++;
      }
    };
    const delays = [];
    const result = await conditionalUpdate({
      get: store.get,
      put: store.put.bind(store),
      merge: addId("game"),
      sleep: async (ms) => delays.push(ms),
      random: () => 0,
    });
    assert.equal(result.attempts, 2);
    assert.deepEqual(JSON.parse(store.state.body), ["a", "game", "registry"]);
    assert.deepEqual(delays, [500]);
  });

  it("retries a create that lost to a rival create", async () => {
    const store = fakeStore(null);
    let rivals = 1;
    store.beforePut = async () => {
      if (rivals-- > 0) {
        store.state.body = '["registry"]';
        store.state.version = 1;
      }
    };
    await conditionalUpdate({ get: store.get, put: store.put.bind(store), merge: addId("game"), ...noSleep });
    assert.deepEqual(store.state.puts, [{ ifNoneMatch: "*" }, { ifMatch: '"v1"' }]);
    assert.deepEqual(JSON.parse(store.state.body), ["game", "registry"]);
  });

  it("backs off exponentially and gives up after the last attempt", async () => {
    const delays = [];
    await assert.rejects(
      conditionalUpdate({
        get: async () => ({ body: "[]", etag: '"x"' }),
        put: async () => CONFLICT,
        merge: addId("a"),
        attempts: 4,
        sleep: async (ms) => delays.push(ms),
        random: () => 0.5,
      }),
      /gave up after 4 attempts/,
    );
    assert.deepEqual(delays, [750, 1500, 3000]);
  });

  it("does not retry a failed merge or another put error", async () => {
    let gets = 0;
    const get = async () => (gets++, { body: null });
    await assert.rejects(
      conditionalUpdate({ get, put: async () => "ok", merge: async () => Promise.reject(new Error("bad")) }),
      /bad/,
    );
    await assert.rejects(
      conditionalUpdate({ get, put: async () => Promise.reject(new Error("denied")), merge: addId("a") }),
      /denied/,
    );
    assert.equal(gets, 2);
  });
});

describe("awsCliStore", () => {
  const temps = [];
  after(() => Promise.all(temps.map((dir) => fs.rm(dir, { recursive: true, force: true }))));
  const tempDir = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "r2-cas-test-"));
    temps.push(dir);
    return dir;
  };
  const opts = { endpoint: "https://acct.r2.example", bucket: "mc-packs", key: "index.json" };

  it("reads the body and ETag, and reports a missing object as none", async () => {
    const dir = await tempDir();
    const exec = async (_file, args) => {
      await fs.writeFile(args.at(-1), "{}");
      return { code: 0, stdout: JSON.stringify({ ETag: '"abc"' }), stderr: "" };
    };
    assert.deepEqual(await awsCliStore({ ...opts, dir, exec }).get(), { body: "{}", etag: '"abc"' });
    const missing = async () => ({ code: 254, stdout: "", stderr: "An error occurred (NoSuchKey) when calling" });
    assert.deepEqual(await awsCliStore({ ...opts, dir, exec: missing }).get(), { body: null });
    const denied = async () => ({ code: 254, stdout: "", stderr: "An error occurred (AccessDenied)" });
    await assert.rejects(awsCliStore({ ...opts, dir, exec: denied }).get(), /AccessDenied/);
  });

  it("puts with --if-match or --if-none-match and maps 412 and 409 to a conflict", async () => {
    const dir = await tempDir();
    const calls = [];
    let stderr = "";
    const exec = async (_file, args) => {
      calls.push(args);
      return stderr ? { code: 254, stdout: "", stderr } : { code: 0, stdout: "{}", stderr: "" };
    };
    const store = awsCliStore({ ...opts, dir, exec, cacheControl: "public, max-age=300" });
    assert.equal(await store.put("{}", { ifMatch: '"abc"' }), "ok");
    assert.deepEqual(calls[0].slice(-2), ["--if-match", '"abc"']);
    assert.ok(calls[0].includes("public, max-age=300"));
    assert.equal(await store.put("{}", { ifNoneMatch: "*" }), "ok");
    assert.deepEqual(calls[1].slice(-2), ["--if-none-match", "*"]);
    stderr = "An error occurred (PreconditionFailed) when calling the PutObject operation";
    assert.equal(await store.put("{}", { ifMatch: '"abc"' }), CONFLICT);
    stderr = "An error occurred (ConditionalRequestConflict) when calling the PutObject operation";
    assert.equal(await store.put("{}", { ifMatch: '"abc"' }), CONFLICT);
    stderr = "An error occurred (AccessDenied) when calling the PutObject operation";
    await assert.rejects(store.put("{}", { ifMatch: '"abc"' }), /AccessDenied/);
  });
});

describe("commandMerge", () => {
  it("passes the read body as {current}, or a missing path when there is none", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "r2-cas-merge-"));
    try {
      const seen = [];
      const exec = async (file, args) => {
        const current = args[1];
        seen.push(await fs.readFile(current, "utf8").catch(() => null));
        return { code: 0, stdout: `${file}:${args[0]}`, stderr: "" };
      };
      const merge = commandMerge(["node", "merge.mjs", "{current}"], dir, exec);
      assert.equal(await merge('{"packs":[]}'), "node:merge.mjs");
      assert.equal(await merge(null), "node:merge.mjs");
      assert.deepEqual(seen, ['{"packs":[]}', null]);
      const failing = commandMerge(["node", "x", "{current}"], dir, async () => ({ code: 1, stdout: "", stderr: "" }));
      await assert.rejects(failing(null), /exited with 1/);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
