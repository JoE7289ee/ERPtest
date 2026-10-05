import json, sys
a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
tot = 0
for dt in sorted(set(a) | set(b)):
    x, y = a.get(dt), b.get(dt)
    if x is None: print(f"+ DOCTYPE {dt}: {len(y)} rows"); continue
    if y is None: print(f"- DOCTYPE {dt} gone"); continue
    add = [k for k in y if k not in x]; rem = [k for k in x if k not in y]
    chg = []
    for k in x:
        if k in y and x[k] != y[k]:
            if isinstance(x[k], dict) and isinstance(y[k], dict):
                d = {f: (x[k].get(f), y[k].get(f)) for f in set(x[k]) | set(y[k]) if x[k].get(f) != y[k].get(f)}
                chg.append((k, d))
            else: chg.append((k, (x[k], y[k])))
    if add or rem or chg:
        tot += 1
        print(f"== {dt}: +{len(add)} -{len(rem)} ~{len(chg)}")
        for k in add[:6]: print("   +", k, str({f: v for f, v in y[k].items() if v not in (None, '', '0', '0.0')})[:230] if isinstance(y[k], dict) else y[k])
        for k in rem[:6]: print("   -", k, str({f: v for f, v in x[k].items() if v not in (None, '', '0', '0.0')})[:230] if isinstance(x[k], dict) else x[k])
        for k, d in chg[:8]: print("   ~", k, str(d)[:260])
print("doctypes changed:", tot)
