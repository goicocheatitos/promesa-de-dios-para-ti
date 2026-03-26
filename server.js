/**
 * Servidor local – Una Promesa de Dios para Ti
 * Sirve archivos estáticos de /public  y  maneja /api/chat con Anthropic SDK
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".css":  "text/css",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
};

// ── Anthropic client ──────────────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

// ── API /api/chat ─────────────────────────────────────────────────────────────
async function handleChat(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*",
                         "Access-Control-Allow-Headers": "Content-Type",
                         "Access-Control-Allow-Methods": "POST, OPTIONS" });
    return res.end();
  }
  if (req.method !== "POST") {
    return sendJSON(res, 405, { error: "Method not allowed" });
  }

  try {
    const { system, messages } = await readBody(req);

    if (!Array.isArray(messages)) {
      return sendJSON(res, 400, { error: "Campo 'messages' requerido" });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 700,
      system: system || "Eres un consejero espiritual cristiano sabio y empático.",
      messages: messages.slice(-12),   // máx últimos 12 mensajes de contexto
    });

    const reply = response.content[0]?.text || "";
    return sendJSON(res, 200, { reply });

  } catch (err) {
    console.error("❌ Error Anthropic API:", err.message);
    return sendJSON(res, 500, { error: "Error al procesar tu mensaje" });
  }
}

// ── Static files ──────────────────────────────────────────────────────────────
function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const filePath = path.join(PUBLIC, urlPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403); return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 – Not found");
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

// ── Router ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/chat")) {
    return handleChat(req, res);
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n✦ Una Promesa de Dios para Ti`);
  console.log(`  Servidor corriendo en  http://localhost:${PORT}\n`);
});
