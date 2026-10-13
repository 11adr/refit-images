#!/usr/bin/env sh
# Rebuilds public/caire.wasm and the matching wasm_exec.js from the Go sources.
set -e
cd "$(dirname "$0")/wasm"
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o ../public/caire.wasm .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../public/wasm_exec.js
echo "built public/caire.wasm ($(wc -c < ../public/caire.wasm) bytes)"
