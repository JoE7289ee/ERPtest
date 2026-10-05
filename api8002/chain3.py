import sys, json; sys.path.insert(0,'.')
from jw import *
sh, ba, sm, low = User("sheeja@jd.in"), User("balans@jd.in"), User("smitha@jd.in"), User("lenusthomas@jd.in")
A = "E7617.19.1"
print("ctx balans:", ba.call("get_stone_issue_context"))
print("ctx smitha:", sm.call("get_stone_issue_context"))
guarded("mark card for stone issue", low, sh, "mark_stone_issue", bags=[A])
c = ba.call("get_stone_issue_card", barcode=A)
print(json.dumps(c, default=str)[:1500])
json.dump(c, open("stonecard.json", "w"), default=str, indent=1)
