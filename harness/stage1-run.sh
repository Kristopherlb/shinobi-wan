#!/usr/bin/env bash
# stage1-run.sh — Stage-1 executor: run the candidate CLI over staged
# manifest inputs. This is the ONLY place agent code executes during
# scoring. It sees inputs and its own checkout — never eval answers.
#
# Runs identically on the agent side (dev scoring), hub side, and inside
# the hub's no-network sandbox (the CLI is plan-only and needs no network
# after build; docker mounts the checkout read-only, which is sufficient).
#
# Usage: stage1-run.sh <checkout> <inputs-dir> <results-dir>
#   inputs-dir: <id>.yaml (manifest) + <id>.argv (one CLI arg per line,
#               first line is the subcommand)
#   results-dir: <id>.out (raw stdout) + <id>.exit (exit code)
set -uo pipefail   # no -e: one crashing case must not kill the batch

CHECKOUT="$(cd "${1:?usage: stage1-run.sh <checkout> <inputs> <results>}" && pwd)"
INPUTS="$(cd "${2:?}" && pwd)"
RESULTS="${3:?}"
mkdir -p "$RESULTS"
RESULTS="$(cd "$RESULTS" && pwd)"

# The built CLI resolves @pulumi/* from the adapter package under pnpm's
# strict layout; harmless if the candidate has fixed its packaging.
export NODE_PATH="$CHECKOUT/packages/adapters/aws/node_modules${NODE_PATH:+:$NODE_PATH}"
CLI="$CHECKOUT/packages/cli/dist/main.js"

run_one() {
  local y="$1" id argv=()
  id="$(basename "${y%.yaml}")"
  while IFS= read -r line; do argv+=("$line"); done < "$INPUTS/$id.argv"
  timeout "${STAGE1_CASE_TIMEOUT:-60}" \
    node "$CLI" "${argv[0]}" "$y" "${argv[@]:1}" \
    > "$RESULTS/$id.out" 2> "$RESULTS/$id.err"
  echo "$?" > "$RESULTS/$id.exit"
}
export -f run_one
export INPUTS RESULTS CLI NODE_PATH

cd "$CHECKOUT"
find "$INPUTS" -name '*.yaml' -print0 \
  | xargs -0 -P "${STAGE1_JOBS:-4}" -I{} bash -c 'run_one "$@"' _ {}
exit 0
