import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_GROUPS, NAV_ITEMS, activeItem, badgeCount, documentTitle } from "../src/lib/nav.js";

test("the nav is grouped as the DOD Command Center's: Overview, Members, Team", () => {
  assert.deepEqual(
    NAV_GROUPS.map((g) => g.label),
    ["Overview", "Members", "Team"]
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.path),
    ["/", "/pulse", "/journey", "/team", "/setup"]
  );
  assert.equal(new Set(NAV_ITEMS.map((i) => i.key)).size, NAV_ITEMS.length, "keys are unique");
});

test("every nav path is a route, and every route is on the nav", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const routes = [...app.matchAll(/path="([^"*]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...routes].sort(), NAV_ITEMS.map((i) => i.path).sort());
});

test("a path lights its item, with or without a trailing slash; anything else is the dashboard", () => {
  assert.equal(activeItem("/pulse").key, "pulse");
  assert.equal(activeItem("/Pulse/").key, "pulse");
  assert.equal(activeItem("/journey").key, "journey");
  assert.equal(activeItem("/").key, "dashboard");
  assert.equal(activeItem("/nowhere").key, "dashboard");
  assert.equal(documentTitle(activeItem("/setup")), "Setup · Command Center");
});

test("a badge reads its own count and nothing else", () => {
  const pulse = NAV_ITEMS.find((i) => i.key === "pulse");
  const team = NAV_ITEMS.find((i) => i.key === "team");
  assert.equal(badgeCount(pulse, { needsYou: 3 }), 3);
  assert.equal(badgeCount(pulse, {}), 0);
  assert.equal(badgeCount(team, { needsYou: 3 }), 0);
});
