import json, urllib.request, os
from http.server import BaseHTTPRequestHandler

T = os.environ.get("TELEGRAM_TOKEN")
U = f"https://api.telegram.org/bot{T}/sendMessage"

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Читаем входящий сигнал
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)
            
            # 2. Пытаемся вытащить chat_id
            if "message" in data:
                chat_id = data["message"]["chat"]["id"]
                
                # 3. ПРЯМАЯ ОТПРАВКА (БЕЗ ФУНКЦИЙ)
                payload = {
                    "chat_id": chat_id,
                    "text": "СИСТЕМА ЖИВА. АРХИТЕКТОР, ПРИЕМ!"
                }
                
                req = urllib.request.Request(
                    U, 
                    data=json.dumps(payload).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method="POST"
                )
                # Отправляем и не ждем ответа (fire and forget для теста)
                urllib.request.urlopen(req, timeout=5)
                
        except Exception as e:
            # Если тут будет ошибка, мы увидим её в логах Vercel
            print(f"DEBUG ERROR: {e}")

        # 4. ВСЕГДА ОТВЕЧАЕМ ТЕЛЕГРАМУ 200 OK
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(f"ENDPOINT READY. TOKEN: {T[-5:] if T else 'MISSING'}".encode())
