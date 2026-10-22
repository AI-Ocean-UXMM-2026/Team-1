#!/usr/bin/env node

/**
 * Yangon Traffic & Interception Point Studio CLI Runner
 *
 * Usage:
 *   node scripts/traffic-editor.mjs
 *   bun scripts/traffic-editor.mjs
 *   node scripts/traffic-editor.mjs --validate path/to/points.json
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const HTML_FILE = path.join(ROOT_DIR, "public", "tools", "traffic-editor.html");

const args = process.argv.slice(2);

// Check if user passed --validate
const validateIdx = args.indexOf("--validate");
if (validateIdx !== -1) {
  const filePath = args[validateIdx + 1];
  if (!filePath) {
    console.error("Error: Please provide a JSON file path to validate.");
    process.exit(1);
  }
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found at ${fullPath}`);
    process.exit(1);
  }
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const items = Array.isArray(data) ? data : data.features || [];
    console.log(`\nValidating ${filePath}:`);
    console.log(`Total Points: ${items.length}`);
    let validCount = 0;
    for (const item of items) {
      const lat = item.latitude ?? item.geometry?.coordinates?.[1];
      const lng = item.longitude ?? item.geometry?.coordinates?.[0];
      const name = item.name ?? item.properties?.name;
      if (typeof lat === "number" && typeof lng === "number") {
        validCount++;
      } else {
        console.warn(`[!] Invalid coords for item:`, item);
      }
    }
    console.log(`Valid Coordinates: ${validCount}/${items.length}`);
    console.log(`Status: ${validCount === items.length ? "PASSED" : "FAILED"}\n`);
    process.exit(0);
  } catch (err) {
    console.error(`JSON Parse Error:`, err.message);
    process.exit(1);
  }
}

// Start tiny HTTP server to serve the editor HTML
const PORT = process.env.PORT || 3333;

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/traffic-editor.html" || req.url?.startsWith("/tools/")) {
    fs.readFile(HTML_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error loading traffic-editor.html: " + err.message);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("\n=======================================================");
  console.log("   Yangon Traffic & Interception Point Studio");
  console.log("=======================================================");
  console.log(`\n  Editor running at: ${url}`);
  console.log(`  File location:     ${HTML_FILE}`);
  console.log("\n  Features:");
  console.log("   - Click anywhere on Yangon map to drop points & junctions");
  console.log("   - Label townships, cycle delays, and corridors");
  console.log("   - Drag markers to fine-tune road positions");
  console.log("   - 1-click Download / Copy .json");
  console.log("   - Rapid click mode for corridors between interceptions\n");
  console.log("  Press Ctrl+C to exit when finished.\n");

  // Attempt to open in browser automatically
  const openCmd = process.platform === "darwin" ? `open "${url}"` : process.platform === "win32" ? `start "${url}"` : `xdg-open "${url}"`;
  exec(openCmd, () => {});
});
