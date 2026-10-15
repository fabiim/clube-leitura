#!/usr/bin/env bash
# Runs tests/render.test.js against index.html in headless Chrome.
#
# Builds a throwaway copy of the page with two injections: an error collector
# at the top of <head>, so script errors during load are recorded, and the
# test script before </body>, so it runs after the page's own script has
# rendered. Chrome dumps the final DOM, and the <pre id="test-results"> block
# is printed. Exits non-zero on any failure or if the results never appear.
#
# Needs only google-chrome (or chromium) and python3.

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$chrome" ]]; then
  echo "tests: no google-chrome/chromium found" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Inject the collector and the tests. Plain string replacement keeps the
# page's own markup untouched; each anchor must occur exactly once.
python3 - "$root/index.html" "$root/tests/render.test.js" "$tmp/page.html" <<'EOF'
import sys
page, tests, out = sys.argv[1:]
html = open(page, encoding="utf-8").read()
js = open(tests, encoding="utf-8").read()
for anchor in ("<head>", "</body>"):
    assert html.count(anchor) == 1, f"expected exactly one {anchor} in index.html"
html = html.replace("<head>", "<head><script>window.__testErrors=[];"
    "addEventListener('error',e=>__testErrors.push(e.message));</script>")
html = html.replace("</body>", "<script>\n" + js + "\n</script></body>")
open(out, "w", encoding="utf-8").write(html)
EOF

# A private profile keeps the run independent of any open Chrome window.
dom="$(timeout 60 "$chrome" --headless=new --disable-gpu --no-first-run \
  --user-data-dir="$tmp/profile" --virtual-time-budget=3000 \
  --dump-dom "file://$tmp/page.html" 2>/dev/null)"

# Pull the results block out of the dumped DOM and unescape the entities
# Chrome writes for text content. The test source must never contain the
# literal tag, or the match would start inside the injected script.
results="$(python3 -c '
import sys, re, html
m = re.search(r"<pre id=\"test-results\">(.*?)</pre>", sys.stdin.read(), re.S)
print(html.unescape(m.group(1)) if m else "FAIL\nno test results in page (test script crashed?)")
' <<<"$dom")"

echo "$results"
[[ "$(head -n1 <<<"$results")" == "PASS" ]]
