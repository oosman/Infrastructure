import json, websocket, time, base64, urllib.request

# Get fresh targets
targets = json.loads(urllib.request.urlopen("http://localhost:9222/json/list").read())
page_ws = None
for t in targets:
    if t.get("type") == "page":
        page_ws = t["webSocketDebuggerUrl"]
        title = t.get("title", "?")
        url = t.get("url", "?")[:80]
        print(f"Target: {title} | {url}")
        break

if not page_ws:
    print("No page target found")
    exit(1)

print(f"Connecting: {page_ws}")
ws = websocket.create_connection(page_ws)

# Navigate to claude.ai
ws.send(json.dumps({"id":1, "method":"Page.navigate", "params":{"url":"https://claude.ai"}}))
print("Navigate sent, waiting 10s...")
time.sleep(10)

# Drain + get URL
ws.send(json.dumps({"id":2, "method":"Runtime.evaluate", "params":{"expression":"document.location.href"}}))
for _ in range(100):
    msg = json.loads(ws.recv())
    if msg.get("id") == 2:
        val = msg.get("result",{}).get("result",{}).get("value","?")
        print(f"URL: {val}")
        break

# Title
ws.send(json.dumps({"id":3, "method":"Runtime.evaluate", "params":{"expression":"document.title"}}))
for _ in range(100):
    msg = json.loads(ws.recv())
    if msg.get("id") == 3:
        val = msg.get("result",{}).get("result",{}).get("value","?")
        print(f"Title: {val}")
        break

# Screenshot
ws.send(json.dumps({"id":4, "method":"Page.captureScreenshot", "params":{"format":"png"}}))
for _ in range(100):
    msg = json.loads(ws.recv())
    if msg.get("id") == 4:
        if "result" in msg and "data" in msg["result"]:
            img = base64.b64decode(msg["result"]["data"])
            with open("/tmp/claude-ai-page.png", "wb") as f:
                f.write(img)
            print(f"Screenshot saved: {len(img)} bytes")
        break

ws.close()
print("Done")
