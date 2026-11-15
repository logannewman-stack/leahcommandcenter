import { test } from "node:test";
import assert from "node:assert/strict";
import { intervals, isToday, series } from "../src/lib/trends.js";

// A Wednesday afternoon, local time.
const NOW = new Date(2026, 10, 18, 15, 30);

test("daily is 14 days ending today; weekly is 12 Monday weeks; monthly is 12 months", () => {
  const daily = intervals("daily", NOW);
  assert.equal(daily.length, 14);
  assert.equal(daily[13].label, "Nov 18");
  assert.equal(daily[0].label, "Nov 5");

  const weekly = intervals("weekly", NOW);
  assert.equal(weekly.length, 12);
  assert.equal(weekly[11].start.getDay(), 1, "weeks start on Monday");
  assert.equal(weekly[11].label, "Nov 16");
  assert.equal(weekly[11].end.getTime() - weekly[11].start.getTime() >= 6.9 * 864e5, true);

  const monthly = intervals("monthly", NOW);
  assert.equal(monthly.length, 12);
  assert.equal(monthly[11].label, "Nov");
  assert.equal(monthly[0].label, "Dec");
  assert.equal(monthly[0].start.getFullYear(), 2025);
});

test("a series counts each item into its bucket and leaves out what is outside the range", () => {
  const buckets = intervals("daily", NOW);
  const items = [
    { at: new Date(2026, 10, 18, 9).toISOString() },
    { at: new Date(2026, 10, 18, 23, 59).toISOString() },
    { at: new Date(2026, 10, 17, 0, 0).toISOString() },
    { at: new Date(2026, 9, 1).toISOString() },
    { at: "not a date" }
  ];
  const counted = series(buckets, items, (i) => i.at);
  assert.equal(counted[13].value, 2, "today");
  assert.equal(counted[12].value, 1, "yesterday, from midnight");
  assert.equal(counted.reduce((s, d) => s + d.value, 0), 3);
});

test("a series can sum a value, as merch sales sum their cents", () => {
  const buckets = intervals("monthly", NOW);
  const orders = [
    { at: new Date(2026, 10, 2).toISOString(), cents: 6800 },
    { at: new Date(2026, 10, 9).toISOString(), cents: 3200 },
    { at: new Date(2026, 9, 30).toISOString(), cents: 3400 }
  ];
  const summed = series(buckets, orders, (o) => o.at, (o) => o.cents);
  assert.equal(summed[11].value, 10000);
  assert.equal(summed[10].value, 3400);
});

test("today is the viewer's own calendar day", () => {
  assert.equal(isToday(new Date(2026, 10, 18, 0, 1).toISOString(), NOW), true);
  assert.equal(isToday(new Date(2026, 10, 17, 23, 59).toISOString(), NOW), false);
  assert.equal(isToday("nope", NOW), false);
});
