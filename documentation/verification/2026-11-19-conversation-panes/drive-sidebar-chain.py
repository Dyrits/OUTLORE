import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/claude-501/serve.log").read()).group(1)
out = "/tmp/claude-501/shots"
scheme = sys.argv[1] if len(sys.argv) > 1 else "light"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1900
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9347")
    page = b.contexts[0].pages[0]
    page.add_init_script(f"window.outlore = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false, pairingLinks: {{ listen: () => () => {{}}, take: async () => null }}, updates: null }};")
    page.set_viewport_size({"width": W, "height": 900})
    page.goto("http://localhost:8099/")
    page.evaluate("(s) => { localStorage.clear(); localStorage.setItem('outlore.colorScheme', s); }", scheme)
    page.reload(); page.wait_for_timeout(3500)
    def rects():
        return page.evaluate("""(() => { const row=[...document.querySelectorAll('[aria-label="Fold the pane"], [aria-label="Close the pane"]')]; return row.length })()""")
    page.mouse.move(700, 400); page.mouse.move(2, 400); page.wait_for_timeout(500)
    page.get_by_text("Right sidebar").first.click(); page.wait_for_timeout(2000)
    page.get_by_label(re.compile("^Errand: Design the layout")).first.click(); page.wait_for_timeout(1000)
    page.mouse.move(700, 400); page.mouse.move(2, 400); page.wait_for_timeout(500)
    page.screenshot(path=f"{out}/s1-sidebar-open-{scheme}.png")
    page.mouse.move(60, 124); page.wait_for_timeout(300)
    page.mouse.click(20, 124); page.wait_for_timeout(600)
    page.screenshot(path=f"{out}/s1b-{scheme}.png")
    for t in ("Integrate and review",):
        print(t, page.get_by_text(t).count())
    page.get_by_text("Integrate and review").last.click(); page.wait_for_timeout(2000)
    page.screenshot(path=f"{out}/s2-chain-from-sidebar-{scheme}.png")
    print("close buttons (chain of 4 -> 3):", page.get_by_label("Close the pane").count())
    page.get_by_label("Show quest panel").nth(1).click(); page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/s3-details-pane2-{scheme}.png")
    print("panel tail:", page.evaluate("document.body.innerText").count("Build the component"))
