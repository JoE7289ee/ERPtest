#!/bin/bash
. ./t8002-env.sh
for u in reena@jd.in sheeja@jd.in jojokk@jd.in balans@jd.in smitha@jd.in femipaul@jd.in nitha@jd.in anoop@jd.in meghnavipinkannan@jd.in jinu@jd.in nimaks@jd.in amritha@jd.in jiyanto@jd.in joju@jd.in lenusthomas@jd.in antonysebastian@jd.in; do
  export SMOKE_SID=$(SID $u) SMOKE_WHO=$u SMOKE_OUT=smoke-$u.json
  FAST=1 npx playwright test _t8002_smoke --project=chromium --no-deps --reporter=list --output=test-results-smoke > smoke-$u.log 2>&1
  echo "$u done $(date +%H:%M:%S)" >> smoke-roles.progress
done
echo ALL-DONE >> smoke-roles.progress
