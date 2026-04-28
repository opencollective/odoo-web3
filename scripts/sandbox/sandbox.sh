#!/usr/bin/env bash
# Run a command inside a bwrap sandbox:
#   * filesystem: RW access to the project dir only, RO access to system libs/binaries
#   * network:    routed through a filtering HTTP(S) proxy that allows only a
#                 fixed domain allowlist (see sandbox-proxy.py)
#
# Usage:
#   scripts/sandbox/sandbox.sh                 # opens an interactive shell
#   scripts/sandbox/sandbox.sh bun dev         # runs a command inside the sandbox
#
# Limitations:
#   * Enforcement relies on HTTP(S)_PROXY env vars being honored. Clients that
#     ignore them and open raw sockets to non-allowlisted IPs are NOT blocked
#     (the sandbox shares the host network namespace so the proxy stays reachable).
#     For strict egress control use netns + nftables; this wrapper prioritizes
#     simplicity and covers well-behaved HTTP/HTTPS clients (bun, curl, node, etc.).
#   * Loopback on the host is reachable from inside the sandbox. Don't run the
#     sandbox next to sensitive local services bound to 127.0.0.1.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

PROXY_HOST="127.0.0.1"
PROXY_PORT="8888"
PROXY_URL="http://${PROXY_HOST}:${PROXY_PORT}"

PROXY_LOG="$(mktemp -t sandbox-proxy.XXXXXX.log)"
PROXY_PID=""

cleanup() {
    if [[ -n "$PROXY_PID" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
        kill "$PROXY_PID" 2>/dev/null || true
        wait "$PROXY_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

if ss -Hltn "sport = :${PROXY_PORT}" 2>/dev/null | grep -q LISTEN; then
    echo "sandbox: port ${PROXY_PORT} is already in use — refusing to start" >&2
    exit 1
fi

python3 "$SCRIPT_DIR/sandbox-proxy.py" >"$PROXY_LOG" 2>&1 &
PROXY_PID=$!

for _ in $(seq 1 50); do
    if ss -Hltn "sport = :${PROXY_PORT}" 2>/dev/null | grep -q LISTEN; then
        break
    fi
    sleep 0.1
done
if ! ss -Hltn "sport = :${PROXY_PORT}" 2>/dev/null | grep -q LISTEN; then
    echo "sandbox: proxy failed to start. Log:" >&2
    cat "$PROXY_LOG" >&2 || true
    exit 1
fi

echo "sandbox: proxy pid=$PROXY_PID, log=$PROXY_LOG"

BWRAP_ARGS=(
    --die-with-parent
    --new-session
    --unshare-pid
    --unshare-uts
    --unshare-ipc
    --unshare-cgroup-try
    --proc /proc
    --dev /dev
    --tmpfs /tmp
    --tmpfs /run
    --tmpfs /var/tmp
    --ro-bind /usr /usr
    --ro-bind /etc /etc
    --ro-bind /opt /opt
    --symlink usr/bin /bin
    --symlink usr/bin /sbin
    --symlink usr/lib /lib
    --symlink usr/lib /lib64
    --bind "$PROJECT_DIR" "$PROJECT_DIR"
    --chdir "$PROJECT_DIR"
    --setenv HOME "$PROJECT_DIR"
    --setenv USER "${USER:-sandbox}"
    --setenv TMPDIR /tmp
    --setenv HTTP_PROXY  "$PROXY_URL"
    --setenv HTTPS_PROXY "$PROXY_URL"
    --setenv http_proxy  "$PROXY_URL"
    --setenv https_proxy "$PROXY_URL"
    --setenv ALL_PROXY   "$PROXY_URL"
    --setenv all_proxy   "$PROXY_URL"
    --setenv NO_PROXY    "$PROXY_HOST,localhost"
    --setenv no_proxy    "$PROXY_HOST,localhost"
)

for extra in \
    /home/linuxbrew \
    /home/xdamman/.local/share/mise \
    /home/xdamman/.nvm \
    /home/xdamman/.cargo
do
    if [[ -d "$extra" ]]; then
        BWRAP_ARGS+=(--ro-bind "$extra" "$extra")
    fi
done

if [[ -n "${TERM:-}" ]]; then
    BWRAP_ARGS+=(--setenv TERM "$TERM")
fi
if [[ -n "${PATH:-}" ]]; then
    BWRAP_ARGS+=(--setenv PATH "$PATH")
fi

if [[ $# -eq 0 ]]; then
    set -- bash -l
fi

set +e
bwrap "${BWRAP_ARGS[@]}" -- "$@"
status=$?
set -e
exit "$status"
