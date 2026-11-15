import test from "node:test";
import assert from "node:assert/strict";
import { MILESTONES, milestonesFor, nextStep, reached } from "../api/_lib/milestones.js";
import { momentsAhead } from "../api/_lib/moments.js";

test("the next step and how far", () => {
  assert.deepEqual(nextStep(462, MILESTONES.members.steps), { target: 500, previous: 250, away: 38, ratio: (462 - 250) / 250 });
  assert.equal(nextStep(0, MILESTONES.members.steps).target, 100);
  assert.equal(nextStep(1e9, MILESTONES.members.steps), null);
  assert.equal(reached(99, MILESTONES.members.steps), 0);
});

test("the hourly job offers only the top step reached", () => {
  const got = milestonesFor({ members: 612, paying: 40, mrr_cents: 1_050_000 });
  assert.deepEqual(got.map((m) => m.source_id), ["milestone:members:500", "milestone:paying:25", "milestone:mrr:1000000"]);
  assert.match(got[2].detail.title, /\$10,000 month/);
  assert.deepEqual(milestonesFor({ members: 12, paying: 0, mrr_cents: 0 }), []);
});

test("member moments: first names and the day of the mark", async () => {
  const now = new Date("2026-11-16T15:00:00Z");
  const calls = [];
  const db = {
    from: () => {
      const q = {
        select: () => q,
        gte: (_c, v) => ((q.from = v), q),
        lt: (_c, v) => ((q.to = v), q),
        limit: async () => {
          calls.push([q.from, q.to]);
          return q.from.startsWith("2026-10-17") ? { data: [{ id: "abcdef12-3456", full_name: "Sarah Jones", created_at: "2026-10-19T09:00:00Z" }] } : { data: [] };
        }
      };
      return q;
    }
  };
  const got = await momentsAhead(db, now);
  assert.equal(calls.length, 4);
  assert.deepEqual(got, [{ id: "abcdef12", first_name: "Sarah", days: 30, on: "2026-11-18" }]);
});
