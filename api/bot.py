import json, urllib.request, os
from http.server import BaseHTTPRequestHandler

T = os.environ.get("TELEGRAM_TOKEN")
U = f"https://api.telegram.org/bot{T}/"

def _r(m, d):
    try:
        req = urllib.request.Request(U+m, data=json.dumps(d).encode(), headers={"Content-Type":"application/json"}, method="POST")
        with urllib.request.urlopen(req) as res: return json.loads(res.read().decode())
    except Exception as e:
        print(f"Error: {e}")
        return None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode()
        try:
            p = json.loads(body)
            if "message" in p:
                c = p["message"]["chat"]["id"]
                # Отвечаем просто текстом для теста
                _r("sendMessage", {"chat_id": c, "text": "СТАРТ"})
        except Exception as e:
            print(f"Payload error: {e}")
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f"Active. Token suffix: {T[-5:] if T else 'NONE'}".encode())
