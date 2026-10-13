#!/usr/bin/env sh
# Rebuilds caire.wasm and the matching wasm_exec.js from the Go sources.
set -e
cd "$(dirname "$0")/wasm"
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o ../caire.wasm .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../wasm_exec.js
echo "built caire.wasm ($(wc -c < ../caire.wasm) bytes)"
