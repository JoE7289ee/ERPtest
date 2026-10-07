set -a; . /tmp/zzt_reader.env; set +a
S=http://localhost:8002
B=$S/api/method/jewelima.jewelima.agent_api
H="Authorization: token $T_KEY:$T_SECRET"
code() { curl -s -o /tmp/r.json -w "%{http_code}" "$@"; }
js() { python3 -c "import json;d=json.load(open('/tmp/r.json'))['message'];$1" 2>/dev/null || echo "(no message)"; }
echo "tags            $(code -H "$H" "$B.gallery_tags") $(js "print(len(d['tags']), [t for t in d['tags'] if t['tag'].startswith('ZZT')])")"
echo "designs         $(code -H "$H" -G --data-urlencode "tag=ZZT Reader Tag" "$B.gallery_designs") $(js "print(d['total'], d['count'], sorted(d['designs'][0].keys()), d['designs'][0]['photo_url'][:70])")"
echo "designs all     $(code -H "$H" -G --data-urlencode "tag=zzt reader tag" --data-urlencode "status=all" "$B.gallery_designs") $(js "print(d['total'], d['tag'], sorted(x['card_status'] for x in d['designs']))")"
echo "designs pending $(code -H "$H" -G --data-urlencode "tag=ZZT Reader Tag" --data-urlencode "status=Pending" "$B.gallery_designs") $(js "print(d['total'])")"
echo "designs paged   $(code -H "$H" -G --data-urlencode "tag=ZZT Reader Tag" --data-urlencode "limit=2" --data-urlencode "start=2" "$B.gallery_designs") $(js "print(d['total'], d['start'], d['count'])")"
echo "unknown tag     $(code -H "$H" -G --data-urlencode "tag=No Such Tag" "$B.gallery_designs")"
echo "no key          $(code -G --data-urlencode "tag=ZZT Reader Tag" "$B.gallery_designs")"
echo "wrong secret    $(code -H "Authorization: token $T_KEY:wrong" "$B.gallery_tags")"
echo "photo queue     $(code -H "$H" "$B.photos_pending")"
echo "photo card      $(code -H "$H" -G --data-urlencode "card=X" "$B.photo_card")"
echo "selection book  $(code -H "$H" "$B.selection_photos")"
echo "photo submit    $(code -H "$H" -X POST -d "card=X" "$B.photo_submit")"
echo "POST on a GET   $(code -H "$H" -X POST -d "tag=ZZT Reader Tag" "$B.gallery_designs")"
echo "design list     $(code -H "$H" "$S/api/resource/Design%20Bank?limit=1")"
echo "floor call      $(code -H "$H" "$S/api/method/jewelima.jewelima.api.get_designs")"
echo "gallery page api $(code -H "$H" "$S/api/method/jewelima.jewelima.design_bank_api.get_designs")"
echo "outside orders  $(code -H "$H" "$S/api/method/jewelima.jewelima.outside_orders.get_orders")"
for u in /desk /desk/design-gallery /app /app/design-bank; do echo "page $u   $(curl -s -o /tmp/d.html -w "%{http_code} %{size_download}b" -H "$H" "$S$u") boot=$(grep -c "frappe.boot = {\"user\"" /tmp/d.html)"; done
echo "guest /desk     $(curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" "$S/desk")"
P=$(curl -s -H "$H" -G --data-urlencode "tag=ZZT Reader Tag" "$B.gallery_designs" | python3 -c "
import json,sys
from urllib.parse import urlparse
print(urlparse(json.load(sys.stdin)['message']['designs'][0]['photo_url']).path)")
echo "photo with key  $(curl -s -o /tmp/p.img -w "%{http_code} %{content_type} %{size_download}" -H "$H" "$S$P") | $(python3 -c "print(open('/tmp/p.img','rb').read(4))")"
echo "photo no key    $(curl -s -o /tmp/p.img -w "%{http_code} %{content_type} %{size_download}" "$S$P")"
n=0; for i in $(seq 1 70); do c=$(code -H "$H" "$B.gallery_tags"); [ "$c" = "429" ] && n=$((n+1)); done; echo "70 more calls   $n refused with 429"
rm -f /tmp/r.json /tmp/p.img /tmp/d.html
