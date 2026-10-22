import assert from "node:assert/strict";
import test from "node:test";
import { safeReturnTo, signInHref } from "../src/lib/delivery/return-to.ts";

test("in-app paths are kept, including their query", () => {
  assert.equal(safeReturnTo("/pickup/review"), "/pickup/review");
  assert.equal(
    safeReturnTo("/orders?tab=history&q=OR-1"),
    "/orders?tab=history&q=OR-1",
  );
  assert.equal(
    safeReturnTo(encodeURIComponent("/track?order=a")),
    "/track?order=a",
  );
});

test("anything that could leave the app falls back", () => {
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/%2F%2Fevil.example/x",
    "/ok\n/evil",
    "%E0%A4%A",
  ])
    assert.equal(safeReturnTo(bad), "/home", bad);
  assert.equal(safeReturnTo(null), "/home");
  assert.equal(safeReturnTo("", "/welcome"), "/welcome");
});

test("the auth pages are never a destination", () => {
  assert.equal(safeReturnTo("/signin"), "/home");
  assert.equal(safeReturnTo("/signup?next=/x"), "/home");
});

test("signInHref carries a safe return path", () => {
  assert.equal(signInHref("/pickup/review"), "/signin?next=%2Fpickup%2Freview");
  assert.equal(signInHref("https://evil.example"), "/signin");
  assert.equal(signInHref("/orders", "signup"), "/signup?next=%2Forders");
});
