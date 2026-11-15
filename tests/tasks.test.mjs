import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dueChoices, dueLabel, groupTasks, localISO, nextDue, progressFor, sectionOf } from "../src/lib/tasks.js";

// Sunday, November 15, 2026.
const TODAY = "2026-11-15";

test("dates are calendar days, and a month rolls over", () => {
  assert.equal(localISO(new Date(2026, 10, 15, 23, 59)), TODAY);
  assert.equal(addDays(TODAY, 1), "2026-11-16");
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("a repeating to-do's next date follows the same rules as the database", () => {
  assert.equal(nextDue(TODAY, "daily"), "2026-11-16");
  assert.equal(nextDue(TODAY, "weekly"), "2026-11-22");
  assert.equal(nextDue("2026-11-13", "weekdays"), "2026-11-16", "Friday to Monday");
  assert.equal(nextDue("2026-11-16", "weekdays"), "2026-11-17");
  assert.equal(nextDue("2026-11-16", "mwf"), "2026-11-18", "Monday to Wednesday");
  assert.equal(nextDue("2026-11-20", "mwf"), "2026-11-23", "Friday to Monday");
  assert.equal(nextDue(TODAY, "mwf"), "2026-11-16", "Sunday to Monday");
  assert.equal(nextDue("2026-01-31", "monthly"), "2026-02-28", "the end of a short month");
  assert.equal(nextDue("2026-11-20", "monthly"), "2026-12-20");
  assert.equal(nextDue(TODAY, "none"), null);
});

test("a due date reads the way a person says it", () => {
  assert.deepEqual(dueLabel(TODAY, TODAY), { text: "Today", tone: "today" });
  assert.deepEqual(dueLabel("2026-11-16", TODAY), { text: "Tomorrow", tone: "soon" });
  assert.deepEqual(dueLabel("2026-11-20", TODAY), { text: "Friday", tone: "soon" });
  assert.deepEqual(dueLabel("2026-11-24", TODAY), { text: "Tue, Nov 24", tone: "later" });
  assert.deepEqual(dueLabel("2027-01-05", TODAY), { text: "Tue, Jan 5, 2027", tone: "later" });
  assert.deepEqual(dueLabel("2026-11-14", TODAY), { text: "Yesterday", tone: "late" });
  assert.deepEqual(dueLabel("2026-11-12", TODAY), { text: "3 days late", tone: "late" });
  assert.deepEqual(dueLabel(null, TODAY), { text: "", tone: "" });
});

const task = (over) => ({ id: String(Math.random()), assignee_email: "abra@x.co", status: "open", due_on: TODAY, sort_order: 1, created_at: "2026-11-01", ...over });

test("each to-do lands in its section, and done ones by the day they were done", () => {
  assert.equal(sectionOf(task({ due_on: "2026-11-14" }), TODAY), "overdue");
  assert.equal(sectionOf(task({}), TODAY), "today");
  assert.equal(sectionOf(task({ due_on: "2026-11-18" }), TODAY), "upcoming");
  assert.equal(sectionOf(task({ due_on: null }), TODAY), "someday");
  assert.equal(sectionOf(task({ status: "done", done_at: new Date(2026, 10, 15, 9).toISOString() }), TODAY), "doneToday");
  assert.equal(sectionOf(task({ status: "done", done_at: new Date(2026, 10, 13, 9).toISOString() }), TODAY), "doneEarlier");
});

test("sections sort open by due date and done newest first; a held one stays put", () => {
  const a = task({ id: "a", due_on: "2026-11-20" });
  const b = task({ id: "b", due_on: "2026-11-17" });
  const c = task({ id: "c", status: "done", done_at: new Date(2026, 10, 15, 8).toISOString() });
  const d = task({ id: "d", status: "done", done_at: new Date(2026, 10, 15, 11).toISOString() });
  const groups = groupTasks([a, b, c, d], TODAY);
  assert.deepEqual(groups.upcoming.map((t) => t.id), ["b", "a"]);
  assert.deepEqual(groups.doneToday.map((t) => t.id), ["d", "c"]);
  const held = groupTasks([a, b, c, d], TODAY, new Map([["d", "today"]]));
  assert.deepEqual(held.today.map((t) => t.id), ["d"]);
  assert.deepEqual(held.doneToday.map((t) => t.id), ["c"]);
});

test("a person's day counts what is done today against what was due by today", () => {
  const list = [
    task({ due_on: "2026-11-14" }),
    task({}),
    task({ status: "done", done_at: new Date(2026, 10, 15, 9).toISOString() }),
    task({ due_on: "2026-11-20" }),
    task({ assignee_email: "amy@x.co" })
  ];
  assert.deepEqual(progressFor(list, "abra@x.co", TODAY), { done: 1, left: 2, total: 3, ratio: 1 / 3 });
  assert.equal(progressFor(list, null, TODAY).total, 4, "everyone");
  assert.deepEqual(progressFor([], "abra@x.co", TODAY), { done: 0, left: 0, total: 0, ratio: 0 });
});

test("the quick due dates: today, tomorrow, next Monday, none", () => {
  assert.deepEqual(
    dueChoices(TODAY).map((c) => c.value),
    [TODAY, "2026-11-16", "2026-11-23", null],
    "on a Sunday, next Monday is the one after tomorrow"
  );
  assert.equal(dueChoices("2026-11-16")[2].value, "2026-11-23", "from a Monday, the one after");
});
