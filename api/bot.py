import json, urllib.request, os
from http.server import BaseHTTPRequestHandler

T = os.environ.get("TELEGRAM_TOKEN")
G = "https://ahvasalam1337.github.io/ebalvrot/"
U = f"https://api.telegram.org/bot{T}/"

def _r(m, d):
    try:
        req = urllib.request.Request(U+m, data=json.dumps(d).encode(), headers={"Content-Type":"application/json"}, method="POST")
        with urllib.request.urlopen(req) as res: return json.loads(res.read().decode())
    except: return None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            p = json.loads(self.rfile.read(int(self.headers['Content-Length'])).decode())
            if "message" in p:
                c = p["message"]["chat"]["id"]
                _r("sendMessage", {"chat_id": c, "text": "Приветик! Спасипки что заинтересовались моей игрой :3", "reply_markup": {"inline_keyboard": [[{"text": "ОТКРЫТЬ ИГРУ И ИГРАТЬ В ИГРУ 🕹", "web_app": {"url": G}}]]}})
        except: pass
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"s":"ok"}')
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'active')
