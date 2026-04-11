#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/data}"
export CONFIG_PATH="${CONFIG_PATH:-/data/config.json}"

mkdir -p /data

exec uvicorn app.main:app --host 0.0.0.0 --port 8080