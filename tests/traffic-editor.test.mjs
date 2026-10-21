import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const HTML_FILE = path.join(ROOT_DIR, "public", "tools", "traffic-editor.html");
const SCRIPT_FILE = path.join(ROOT_DIR, "scripts", "traffic-editor.mjs");

test("traffic-editor.html exists and contains key interactive features", () => {
  assert.ok(fs.existsSync(HTML_FILE), "HTML file must exist in public/tools/");
  const content = fs.readFileSync(HTML_FILE, "utf-8");

  // Essential map & UI elements
  assert.ok(content.includes('id="map"'), "Contains Leaflet map container");
  assert.ok(content.includes('downloadJSON()'), "Contains JSON download handler");
  assert.ok(content.includes('copyJSON()'), "Contains copy JSON handler");
  assert.ok(content.includes('loadYangonPresetSignals()'), "Contains YTSC presets loader");
  assert.ok(content.includes('toggle-rapid'), "Contains rapid click mode toggle");
  assert.ok(content.includes('toggle-connect'), "Contains corridor connection toggle");
  assert.ok(content.includes('interception_midpoint'), "Supports intermediate interception points");
  assert.ok(content.includes('traffic_light'), "Supports traffic light points");
  assert.ok(content.includes('bottleneck'), "Supports bottleneck points");
});

test("scripts/traffic-editor.mjs validates JSON traffic points via CLI", () => {
  assert.ok(fs.existsSync(SCRIPT_FILE), "CLI script must exist");

  const tempJson = path.join(ROOT_DIR, "tests", "fixtures-traffic-points.json");
  const testData = [
    {
      id: "pt_test_1",
      name: "Pyay Road & Novotel Interception",
      township: "Kamayut",
      type: "interception_midpoint",
      latitude: 16.8215,
      longitude: 96.1305,
      estimatedCycleSeconds: 45,
      road: "Pyay Road",
      betweenIntersections: "Between Hledan and Hanthawaddy"
    },
    {
      id: "pt_test_2",
      name: "Hledan Junction",
      township: "Kamayut",
      type: "traffic_light",
      latitude: 16.8288,
      longitude: 96.129,
      estimatedCycleSeconds: 120,
      road: "Pyay Road & Hledan Road"
    }
  ];

  fs.writeFileSync(tempJson, JSON.stringify(testData, null, 2), "utf-8");

  try {
    const stdout = execSync(`node "${SCRIPT_FILE}" --validate "${tempJson}"`, {
      encoding: "utf-8"
    });
    assert.ok(stdout.includes("Valid Coordinates: 2/2"));
    assert.ok(stdout.includes("Status: PASSED"));
  } finally {
    if (fs.existsSync(tempJson)) {
      fs.unlinkSync(tempJson);
    }
  }
});
