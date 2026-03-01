import json, asyncio, websockets, os, subprocess, time, urllib.request

CHROME_PROFILE = os.path.expanduser("~/chrome-profile")
EXTENSION_PATH = os.path.expanduser("~/chrome-extensions/claude-chrome-unpacked")
CDP_PORT = 9222
DISPLAY = ":98"

JS = """
(function() {
    const r = {};
    r.user_messages = document.querySelectorAll('[data-testid="user-message"]').length;
    
    // Look for "N / M" leaf text nodes (branch indicators like "5 / 5")
    const fracs = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walk.nextNode()) {
        const t = node.textContent.trim();
        if (/^\\d+\\s*\\/\\s*\\d+$/.test(t)) {
            const el = node.parentElement;
            fracs.push({
                text: t,
                tag: el.tagName,
                cls: (el.className||'').substring(0,80),
                testid: el.getAttribute('data-testid')||'',
                parent_testid: (el.parentElement && el.parentElement.getAttribute('data-testid'))||'',
                nearby: (el.parentElement && el.parentElement.innerText||'').substring(0,200)
            });
        }
    }
    r.fraction_nodes = fracs.slice(0, 15);
    r.total_fractions = fracs.length;
    
    // Look for branch/variant/sibling attributes
    const found = [];
    document.querySelectorAll('*').forEach(function(el) {
        for (var i = 0; i < el.attributes.length; i++) {
            var attr = el.attributes[i];
            var v = attr.name + '=' + attr.value;
            if (/branch|variant|sibling|version/i.test(v)) {
                found.push(v.substring(0, 100));
            }
        }
    });
    r.branch_attrs = found.filter(function(v,i,a){return a.indexOf(v)===i;}).slice(0, 10);
    
    // Action bars with button labels
    const actionBars = document.querySelectorAll('[data-testid*="action-bar"]');
    r.action_bars = [];
    actionBars.forEach(function(ab) {
        r.action_bars.push({
            testid: ab.getAttribute('data-testid'),
            buttons: Array.from(ab.querySelectorAll('button')).map(function(b) {
                return b.getAttribute('aria-label') || b.getAttribute('data-testid') || b.innerText.trim().substring(0,30);
            })
        });
    });
    r.action_bar_count = actionBars.length;
    
    return JSON.stringify(r, null, 2);
})()
"""

async def main():
    xvfb = subprocess.Popen(["Xvfb", DISPLAY, "-screen", "0", "1920x1080x24"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    chrome = subprocess.Popen([
        "/opt/google/chrome/chrome", "--no-first-run", "--no-sandbox", "--disable-gpu",
        "--user-data-dir=" + CHROME_PROFILE, "--load-extension=" + EXTENSION_PATH,
        "--remote-debugging-port=" + str(CDP_PORT), "--remote-allow-origins=*",
        "--window-size=1920,1080",
        "https://claude.ai/chat/1875754e-04ca-4095-8a6d-591122f068e6",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
    
    tab_id = None
    for _ in range(60):
        try:
            tabs = json.loads(urllib.request.urlopen("http://localhost:%d/json/list" % CDP_PORT, timeout=2).read())
            for tab in tabs:
                if "claude.ai/chat" in tab.get("url", ""):
                    tab_id = tab["id"]
                    break
        except:
            pass
        if tab_id:
            break
        await asyncio.sleep(1)
    
    if not tab_id:
        print("ERROR: no tab")
        chrome.kill(); xvfb.kill()
        return
    
    # Wait for messages to render
    for _ in range(40):
        try:
            async with websockets.connect("ws://localhost:%d/devtools/page/%s" % (CDP_PORT, tab_id),
                                           max_size=10_000_000,
                                           additional_headers={"Origin": "http://localhost:%d" % CDP_PORT}) as ws:
                await ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{
                    "expression":"document.querySelectorAll('[data-testid=\"user-message\"]').length",
                    "returnByValue":True}}))
                resp = json.loads(await ws.recv())
                count = resp.get("result",{}).get("result",{}).get("value",0)
                if count > 0:
                    print("Page loaded: %d user messages" % count, flush=True)
                    break
        except:
            pass
        await asyncio.sleep(1)
    
    await asyncio.sleep(5)
    
    # Run the branch check
    async with websockets.connect("ws://localhost:%d/devtools/page/%s" % (CDP_PORT, tab_id),
                                   max_size=50_000_000,
                                   additional_headers={"Origin": "http://localhost:%d" % CDP_PORT}) as ws:
        await ws.send(json.dumps({"id":2,"method":"Runtime.evaluate","params":{
            "expression": JS, "returnByValue": True}}))
        resp = json.loads(await ws.recv())
        print(resp.get("result",{}).get("result",{}).get("value","ERROR"))
    
    chrome.terminate()
    try: chrome.wait(timeout=5)
    except: chrome.kill()
    xvfb.terminate()
    try: xvfb.wait(timeout=3)
    except: xvfb.kill()

asyncio.run(main())
