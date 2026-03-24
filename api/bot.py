import json
import requests
import os
from http.server import BaseHTTPRequestHandler

# Тянем токен из настроек Vercel
T = os.environ.get("TELEGRAM_TOKEN")
G = "https://ahvasalam1337.github.io/ebalvrot/"
U = f"https://api.telegram.org/bot{T}/" if T else None

def _r(m, d):
    if not U:
        print("!!! ERROR: TELEGRAM_TOKEN IS MISSING IN ENV")
        return None
    try:
        r = requests.post(U + m, json=d, timeout=10)
        return r.json()
    except Exception as e:
        print(f"!!! REQUEST ERROR: {e}")
        return None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        cl = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(cl).decode('utf-8')
        
        try:
            p = json.loads(body)
            if "message" in p:
                c = p["message"]["chat"]["id"]
                # Основной ответ с кнопкой игры
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
            print(f"!!! LOGIC ERROR: {e}")

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"s":"ok"}')

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        # Этот текст покажет в браузере, видит ли сервер токен
        status = "TOKEN LOADED" if T else "TOKEN MISSING"
        suffix = T[-5:] if T else "NONE"
        self.wfile.write(f"STATUS: {status} | SUFFIX: {suffix}".encode())
