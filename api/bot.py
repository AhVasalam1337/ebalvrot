import json, urllib.request, os
from http.server import BaseHTTPRequestHandler

T = os.environ.get("TELEGRAM_TOKEN")
G = "https://ahvasalam1337.github.io/ebalvrot/"
U = f"https://api.telegram.org/bot{T}/"

def _r(m, d):
    try:
        data = json.dumps(d).encode('utf-8')
        req = urllib.request.Request(U + m, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        # Увеличиваем таймаут и отключаем прокси, если они мешают
        with urllib.request.urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"!!! SEND ERROR: {e}")
        return None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            cl = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(cl).decode('utf-8')
            p = json.loads(body)
            
            if "message" in p:
                c = p["message"]["chat"]["id"]
                # Отправляем кнопку
                _r("sendMessage", {
                    "chat_id": c, 
                    "text": "Приветик! Спасибки что заинтересовались моей игрой :3", 
                    "reply_markup": {
                        "inline_keyboard": [[
                            {"text": "ОТКРЫТЬ ИГРУ И ИГРАТЬ В ИГРУ 🕹", "web_app": {"url": G}}
                        ]]
                    }
                })
        except Exception as e:
            print(f"!!! POST ERROR: {e}")

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(f"STATUS: TOKEN LOADED | SUFFIX: {T[-5:] if T else 'NONE'}".encode())
