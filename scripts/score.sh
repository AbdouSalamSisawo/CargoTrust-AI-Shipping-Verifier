#!/usr/bin/env bash
# Grade out/submission.json with the organizers' scorer kept in .local/ (never committed).
set -e
KIT=".local/sdoc-docker/server"
if [ ! -f "$KIT/score_cli.py" ]; then
  echo "Organizer scorer not found at $KIT — unzip sdoc-hackathon-docker.zip into .local/sdoc-docker/"
  exit 1
fi
SUB="$(pwd)/out/submission.json"
cd "$KIT" && PYTHONIOENCODING=utf-8 PYTHONPATH=. python score_cli.py "$SUB"
