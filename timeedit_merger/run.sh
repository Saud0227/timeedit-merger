#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/data}"

mkdir -p "$DATA_DIR"

exec uvicorn app.main:app --host 0.0.0.0 --port 8080