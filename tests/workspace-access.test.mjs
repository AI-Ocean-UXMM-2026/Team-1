import assert from "node:assert/strict";
import test from "node:test";
import {
  workspaceHome,
  workspaceRedirect,
} from "../src/lib/delivery/access.ts";

test("customer is the default and team roles have distinct URL homes", () => {
  assert.equal(workspaceHome("customer"), "/home");
  assert.equal(workspaceHome("driver"), "/rider/jobs");
  assert.equal(workspaceHome("manager"), "/manager");
  assert.equal(workspaceRedirect("/", "customer"), "/home");
  assert.equal(workspaceRedirect("/home", "customer"), null);
  assert.equal(workspaceRedirect("/", "driver"), "/rider/jobs");
  assert.equal(workspaceRedirect("/", "manager"), "/manager");
});

test("authenticated accounts cannot enter another role's workspace", () => {
  assert.equal(workspaceRedirect("/manager", "customer"), "/home");
  assert.equal(workspaceRedirect("/manager/orders", "driver"), "/rider/jobs");
  assert.equal(workspaceRedirect("/rider", "manager"), "/manager");
  assert.equal(workspaceRedirect("/rider", "driver"), null);
  assert.equal(workspaceRedirect("/manager", "manager"), null);
});

test("signed-in accounts skip the welcome screen", () => {
  assert.equal(workspaceRedirect("/welcome", "customer"), "/home");
  assert.equal(workspaceRedirect("/welcome", "driver"), "/rider/jobs");
  assert.equal(workspaceRedirect("/welcome", null), null);
});

test("guest previews stay accessible and prefix matching respects path boundaries", () => {
  assert.equal(workspaceRedirect("/manager", null), null);
  assert.equal(workspaceRedirect("/rider", null), null);
  assert.equal(workspaceRedirect("/managerial", "customer"), null);
});
