import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/claude-501/serve.log").read()).group(1)
out = "/tmp/claude-501/shots"
scheme = sys.argv[1] if len(sys.argv) > 1 else "light"
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9347")
    page = b.contexts[0].pages[0]
    page.add_init_script(f"window.outlore = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false, pairingLinks: {{ listen: () => () => {{}}, take: async () => null }}, updates: null }};")
    def load(**prefs):
        page.goto("http://localhost:8099/")
        page.evaluate("(p) => { localStorage.clear(); localStorage.setItem('outlore.colorScheme', p.scheme); for (const [k,v] of Object.entries(p.prefs)) localStorage.setItem(k, v); }", {"scheme": scheme, "prefs": prefs})
        page.reload(); page.wait_for_timeout(3500)
    def sbx():
        return page.evaluate("(() => { const e=document.querySelector('[aria-label=\"Resize the sidebar\"]'); return e ? Math.round(e.getBoundingClientRect().x + 4 - 0) : null })()")
    def panel_left():
        return page.evaluate("(() => { const e=document.querySelector('[aria-label=\"Resize the sidebar\"]'); if(!e) return null; const p=e.parentElement; return Math.round(p.getBoundingClientRect().x) })()")
    load()
    print("rest:", panel_left())
    page.mouse.move(700, 400); page.mouse.move(2, 400); page.wait_for_timeout(120)
    print("at edge, before delay (should be hidden):", panel_left())
    page.wait_for_timeout(500); print("after delay (0 = open):", panel_left())
    page.screenshot(path=f"{out}/open-{scheme}.png")
    page.mouse.move(900, 400); page.wait_for_timeout(600); print("pointer left (hidden):", panel_left())
    page.mouse.move(700, 400); page.mouse.move(40, 400); page.wait_for_timeout(500); print("at 40px, no hot zone (hidden):", panel_left())
    page.get_by_label("Show sidebar (⌘B)").click(); page.wait_for_timeout(400); print("button opens (0):", panel_left())
    page.mouse.move(1000, 400); page.wait_for_timeout(600); print("hand-opened stays while pointer never visited:", panel_left())
    page.mouse.click(1000, 400); page.wait_for_timeout(400); print("press outside closes:", panel_left())
    page.keyboard.press("Control+b"); page.wait_for_timeout(400); print("ctrl+b opens:", panel_left())
    page.keyboard.press("Escape"); page.wait_for_timeout(400); print("escape closes:", panel_left())
    page.keyboard.press("Control+b"); page.wait_for_timeout(300)
    quest = page.get_by_text("Merge menus into sidebar").first
    quest.click(); page.wait_for_timeout(1500); print("choosing a quest closes:", panel_left())
    page.screenshot(path=f"{out}/quest-{scheme}.png")
    # right edge
    load(**{"outlore:sidebar-side": "right"})
    page.mouse.move(700, 400); page.mouse.move(1498, 400); page.wait_for_timeout(700)
    print("right edge opens (panel x, window 1500):", panel_left())
    page.screenshot(path=f"{out}/right-{scheme}.png")
    page.mouse.move(100, 400); page.wait_for_timeout(600); print("right leaves:", panel_left())
    # docked
    load(**{"outlore:sidebar-mode": "docked"})
    print("docked panel x (0):", panel_left())
    page.screenshot(path=f"{out}/docked-{scheme}.png")
    # settings
    page.get_by_text("Workshop").first.click() if page.get_by_text("Workshop").count() else None
