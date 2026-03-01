import json, asyncio, websockets, sys

TAB_ID = sys.argv[1] if len(sys.argv) > 1 else "6D5742FB8E632D69118F1776C60E6D25"
WS_URL = f"ws://localhost:9222/devtools/page/{TAB_ID}"

async def get_dom():
    async with websockets.connect(WS_URL) as ws:
        cmd = {
            "id": 1,
            "method": "Runtime.evaluate",
            "params": {
                "expression": "document.title + '\\n---\\n' + document.body.innerText.substring(0, 2000)"
            }
        }
        await ws.send(json.dumps(cmd))
        resp = json.loads(await ws.recv())
        val = resp.get("result", {}).get("result", {}).get("value", "NO VALUE")
        print(val)

asyncio.run(get_dom())
