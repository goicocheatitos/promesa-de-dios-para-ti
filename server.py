#!/usr/bin/env python3
"""
Servidor local – Una Promesa de Dios para Ti
Sirve archivos estáticos de /public  y  maneja /api/chat con el CLI de Claude
"""

import os
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

PORT   = 3456
PUBLIC = Path(__file__).parent / "public"

# Ruta al CLI de Claude Code instalado por Claude Desktop
CLAUDE_BIN = os.path.expanduser(
    "~/Library/Application Support/Claude/claude-code/2.1.78/claude.app/Contents/MacOS/claude"
)

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js":   "application/javascript",
    ".json": "application/json",
    ".css":  "text/css",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
}


class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        path = self.path.split("?")[0]
        if path != "/favicon.ico":
            print(f"  {self.command:5s}  {path}  →  {args[1]}")

    # ── CORS preflight ──────────────────────────────────────────────
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ── POST  /api/chat ─────────────────────────────────────────────
    def do_POST(self):
        if not self.path.startswith("/api/chat"):
            self._send_json(405, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw    = self.rfile.read(length)

        try:
            body = json.loads(raw)
        except Exception:
            self._send_json(400, {"error": "JSON inválido"})
            return

        system   = body.get("system", "Eres un consejero espiritual cristiano sabio y empático.")
        messages = body.get("messages", [])

        if not isinstance(messages, list) or not messages:
            self._send_json(400, {"error": "Campo 'messages' requerido"})
            return

        # Último mensaje del usuario (el actual)
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            ""
        )

        # Historial anterior (sin el último mensaje del usuario) para contexto
        history_msgs = messages[:-1]
        history_text = ""
        if history_msgs:
            history_lines = []
            for m in history_msgs[-10:]:   # máx 10 mensajes anteriores
                role = "Usuario" if m["role"] == "user" else "Consejero"
                history_lines.append(f"{role}: {m['content']}")
            history_text = "\n\n---HISTORIAL DE CONVERSACIÓN---\n" + "\n".join(history_lines) + "\n---FIN HISTORIAL---\n\n"

        # Sistema + historial
        full_system = system + history_text

        try:
            result = subprocess.run(
                [CLAUDE_BIN, "--print", "--no-session-persistence",
                 "--system-prompt", full_system,
                 last_user],
                capture_output=True,
                text=True,
                timeout=60,
                env={**os.environ}
            )

            reply = result.stdout.strip()
            if not reply:
                err = result.stderr.strip()
                print(f"  ❌ Claude CLI stderr: {err[:200]}")
                self._send_json(500, {"error": "Sin respuesta del consejero"})
                return

            self._send_json(200, {"reply": reply})

        except subprocess.TimeoutExpired:
            print("  ❌ Timeout en Claude CLI")
            self._send_json(500, {"error": "El consejero tardó demasiado, intenta de nuevo"})
        except Exception as e:
            print(f"  ❌ Error ejecutando Claude: {e}")
            self._send_json(500, {"error": "Error interno al procesar tu mensaje"})

    # ── GET  archivos estáticos ─────────────────────────────────────
    def do_GET(self):
        url_path = self.path.split("?")[0]
        if url_path in ("/", ""):
            url_path = "/index.html"

        file_path = (PUBLIC / url_path.lstrip("/")).resolve()

        # Seguridad: prevenir path traversal
        if not str(file_path).startswith(str(PUBLIC.resolve())):
            self.send_response(403); self.end_headers()
            self.wfile.write(b"Forbidden"); return

        if not file_path.exists():
            self.send_response(404); self.end_headers()
            self.wfile.write(b"404 - Not found"); return

        ext  = file_path.suffix.lower()
        mime = MIME.get(ext, "application/octet-stream")

        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    # ── Helpers ─────────────────────────────────────────────────────
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"\n✦  Una Promesa de Dios para Ti")
    print(f"   Servidor corriendo en  http://localhost:{PORT}")
    print(f"   Claude CLI: {CLAUDE_BIN}\n")
    HTTPServer(("", PORT), Handler).serve_forever()
