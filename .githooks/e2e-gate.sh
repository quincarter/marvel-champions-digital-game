#!/bin/sh
# The e2e gate: the Playwright suite (`packages/client/e2e/`) must have passed on exactly the code being pushed.
# It does not run in CI (the hosted runner's software WebGL made it slow and flaky: `.github/workflows/e2e.yml`
# is dispatch-only), so this is where it is required. Used by the pre-push hook and by `pnpm e2e:verify`.
#
#   sh .githooks/e2e-gate.sh <commit>
#
# A pass is remembered by the content of what the suite exercises (the `packages/` tree and `pnpm-lock.yaml` of the
# commit), in `<git common dir>/e2e-passed`, so pushing the same code again, from any worktree, does not run it twice.
set -e

sha="${1:-HEAD}"
root="$(git rev-parse --show-toplevel)"
key="$(git rev-parse "$sha:packages")-$(git rev-parse "$sha:pnpm-lock.yaml")"
stamps="$(git rev-parse --git-common-dir)/e2e-passed"

if [ -f "$stamps" ] && grep -q -x "$key" "$stamps"; then
  echo "e2e gate: already passed on this code."
  exit 0
fi

# The suite runs on the working tree, so it only vouches for the commit when the two match.
if ! git diff --quiet "$sha" -- packages pnpm-lock.yaml; then
  echo "e2e gate: the working tree differs from $sha under packages/ or pnpm-lock.yaml." >&2
  echo "Commit or set aside those changes so the suite tests what is being pushed, then push again." >&2
  exit 1
fi

# A port nobody is listening on: the config reuses a server it finds on its port outside CI, and a dev server left
# running by another checkout would have the suite test that checkout's code instead of this one.
port="$(node -e 'const s=require("net").createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})')"
report="$(mktemp -t e2e-gate.XXXXXX)"
trap 'rm -f "$report"' EXIT

echo "e2e gate: running the Playwright suite on $(git rev-parse --short "$sha"), port $port (a few minutes)..."
(cd "$root/packages/client" &&
  E2E_PORT="$port" PLAYWRIGHT_JSON_OUTPUT_NAME="$report" pnpm exec playwright test --reporter=list,json) || true

# The verdict is read from the report, not the exit code: every test that ran passed, and some did run.
if node -e '
  const fs = require("fs");
  let stats;
  try { stats = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).stats; } catch { process.exit(1); }
  const ok = stats && stats.expected > 0 && stats.unexpected === 0 && stats.flaky === 0;
  console.log(`e2e gate: ${stats.expected} passed, ${stats.unexpected} failed, ${stats.flaky} flaky, ${stats.skipped} skipped.`);
  process.exit(ok ? 0 : 1);
' "$report"; then
  echo "$key" >> "$stamps"
  echo "e2e gate: passed."
else
  echo "e2e gate: the suite did not pass; nothing was pushed. Fix it, then push again or run 'pnpm e2e:verify'." >&2
  exit 1
fi
