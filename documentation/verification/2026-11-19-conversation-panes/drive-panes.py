import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/claude-501/serve.log").read()).group(1)
out = "/tmp/claude-501/shots"
scheme = sys.argv[1] if len(sys.argv) > 1 else "light"
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1500
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9347")
    page = b.contexts[0].pages[0]
    page.add_init_script(f"window.outlore = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false, pairingLinks: {{ listen: () => () => {{}}, take: async () => null }}, updates: null }};")
    page.set_viewport_size({"width": W, "height": 900})
    page.goto("http://localhost:8099/")
    page.evaluate("(s) => { localStorage.clear(); localStorage.setItem('outlore.colorScheme', s); }", scheme)
    page.reload(); page.wait_for_timeout(3500)
    def widths():
        return page.evaluate("[...document.querySelectorAll('[aria-label=\"Resize the panes\"]')].map(e => Math.round(e.parentElement.getBoundingClientRect().width))")
    def titles():
        return page.evaluate("[...document.querySelectorAll('[role=button][aria-label^=\"Close the pane\"], [aria-label=\"Fold the pane\"]')].length")
    def open_sidebar_quest(name):
        page.mouse.move(700, 400); page.mouse.move(2, 400); page.wait_for_timeout(500)
        page.get_by_text(name).first.click(); page.wait_for_timeout(2000)
    open_sidebar_quest("Right sidebar")
    page.get_by_label(re.compile("^Errand: Build the component")).first.click(); page.wait_for_timeout(1200)
    print("2 panes widths (resizer parents):", widths())
    page.get_by_label(re.compile("^Errand: Unit tests")).first.click(); page.wait_for_timeout(1200)
    print("3 panes:", widths())
    # fold the middle pane
    page.get_by_label("Fold the pane").first.click(); page.wait_for_timeout(800)
    page.screenshot(path=f"{out}/q1-folded-{scheme}.png")
    print("after fold, strips:", page.get_by_label(re.compile("^Open ")).count(), "panes:", widths())
    page.get_by_label(re.compile("^Open ")).first.click(); page.wait_for_timeout(800)
    print("after unfold, strips:", page.get_by_label(re.compile("^Open ")).count())
    # close deepest
    page.get_by_label("Close the pane").last.click(); page.wait_for_timeout(1200)
    print("after close, close buttons:", page.get_by_label("Close the pane").count())
    page.screenshot(path=f"{out}/q2-closed-{scheme}.png")
    # reopen from the reply line
    page.get_by_label(re.compile("^Errand: Unit tests")).first.click(); page.wait_for_timeout(1200)
    print("reopened, close buttons:", page.get_by_label("Close the pane").count())
    # resize
    r = page.get_by_label("Resize the panes").first.bounding_box()
    before = widths()
    page.mouse.move(r["x"]+4, 400); page.mouse.down(); page.mouse.move(r["x"]+104, 400, steps=8); page.mouse.up(); page.wait_for_timeout(500)
    print("resize +100:", before, "->", widths())
    # details panel follows pane pressed
    page.get_by_label("Show quest panel").first.click(); page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/q3-details-{scheme}.png")
    tabs = page.evaluate("[...document.querySelectorAll('[role=tab]')].map(e=>e.innerText)")
    print("tabs:", tabs)
    # press the first pane then check panel title
    page.mouse.click(300, 300); page.wait_for_timeout(800)
    page.screenshot(path=f"{out}/q4-focus-first-{scheme}.png")
    # open an errand directly from the sidebar: whole chain
    page.mouse.move(700, 400); page.mouse.move(2, 400); page.wait_for_timeout(500)
    print("sidebar errand rows:", page.get_by_text("Integrate and review").count())
