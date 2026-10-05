#!/bin/bash
# run.sh <script.py> — run a python script in the :8002 test bench console, print RES lines
f=$1; b=$(basename $f)
scp -q "$f" newbox:/tmp/t_$b && ssh newbox "docker cp /tmp/t_$b jewelima-test-backend-1:/home/frappe/t_$b && docker exec -i jewelima-test-backend-1 bash -c 'cd /home/frappe/frappe-bench && bench --site development.localhost console < /home/frappe/t_$b'" 2>&1 | grep -a -E "RES|Error|Traceback" | grep -av "print(" | sed 's/^.*\(RES\)/\1/'
