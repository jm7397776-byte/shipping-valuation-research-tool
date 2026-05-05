#!/usr/bin/env python3
import base64
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler


USER = os.environ.get("SHIPPING_TOOL_USER", "shipping")
PASSWORD = os.environ.get("SHIPPING_TOOL_PASSWORD", "change-me")
PORT = int(os.environ.get("SHIPPING_TOOL_PORT", "4173"))
TOKEN = "Basic " + base64.b64encode(f"{USER}:{PASSWORD}".encode()).decode()


class AuthHandler(SimpleHTTPRequestHandler):
    def do_HEAD(self):
        if not self.authorized():
            return self.auth_required()
        return super().do_HEAD()

    def do_GET(self):
        if not self.authorized():
            return self.auth_required()
        return super().do_GET()

    def authorized(self):
        return self.headers.get("Authorization") == TOKEN

    def auth_required(self):
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Shipping Valuation Tool"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Authentication required")


if __name__ == "__main__":
    print(f"Serving private dashboard on 0.0.0.0:{PORT} as {USER}", flush=True)
    HTTPServer(("0.0.0.0", PORT), AuthHandler).serve_forever()
