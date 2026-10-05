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

echo "e2e gate: running the Playwright suite on $(git rev-parse --short "$sha") (a few minutes)..."
if pnpm --filter @mc/client e2e; then
  echo "$key" >> "$stamps"
  echo "e2e gate: passed."
else
  echo "e2e gate: the suite failed; nothing was pushed. Fix it, or rerun with 'pnpm e2e:verify'." >&2
  exit 1
fi
