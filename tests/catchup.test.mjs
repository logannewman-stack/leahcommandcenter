import { test } from "node:test";
import assert from "node:assert/strict";
import { catchUpSales, defaultSince } from "../api/_lib/catchup.js";

const session = (id, over = {}) => ({
  id,
  created: 1_794_700_000,
  payment_status: "paid",
  amount_total: 6800,
  currency: "usd",
  customer_details: { email: `${id}@example.com`, name: "Pat Lee", address: { city: "Boise" } },
  metadata: { kind: "shop", order: "9:1", to_name: "Pat Lee", to_city: "Boise" },
  ...over
});

/** A stand-in for the one read and the inserts the catch-up makes. */
function database(existing = []) {
  const rows = existing.map((source_id) => ({ source_id }));
  return {
    rows,
    from: () => ({
      select: () => ({
        in: async (_col, ids) => ({ data: rows.filter((r) => ids.includes(r.source_id)), error: null })
      })
    })
  };
}

const record = (db) => async (_db, row) => {
  if (db.rows.some((r) => r.source_id === row.source_id)) return { inserted: false };
  db.rows.push(row);
  return { inserted: true, row };
};

test("paid shop orders the board never heard about are added, once, with their items and no celebration", async () => {
  const db = database(["cs_known:merch"]);
  const pages = [
    { data: [session("cs_new1"), session("cs_known"), session("cs_course", { metadata: { kind: "course" } })], has_more: true },
    { data: [session("cs_new2", { payment_status: "unpaid" }), session("cs_gift", { metadata: { kind: "gift", item: "Hat plus one year" }, amount_total: 32900 })], has_more: false }
  ];
  const asked = [];
  const call = async (method, path, params) => {
    asked.push(params);
    return pages.shift();
  };
  const result = await catchUpSales(db, {
    since: Date.UTC(2026, 9, 1),
    call,
    items: async (id) => (id === "cs_new1" ? [{ name: "The Club Hoodie (Cream) / M", quantity: 1, amount_cents: 6800 }] : []),
    byEmail: async () => null,
    record: record(db)
  });

  assert.deepEqual(result, { checked: 5, added: 2 });
  assert.equal(asked[0].created.gte, Math.floor(Date.UTC(2026, 9, 1) / 1000));
  assert.equal(asked[0].status, "complete");
  assert.equal(asked[1].starting_after, "cs_course", "pages on from the last one");

  const merch = db.rows.find((r) => r.source_id === "cs_new1:merch");
  assert.equal(merch.kind, "merch");
  assert.equal(merch.first_name, "Pat");
  assert.equal(merch.city, "Boise");
  assert.equal(merch.source, "stripe-catchup");
  assert.equal(merch.quiet, false);
  assert.deepEqual(merch.detail, { amount_cents: 6800, currency: "usd", items: [{ name: "The Club Hoodie (Cream) / M", quantity: 1 }] });
  assert.equal(merch.occurred_at, new Date(1_794_700_000 * 1000).toISOString(), "dated when it was paid, not now");
  assert.equal(JSON.stringify(merch).includes("@"), false, "no address on the card");

  const gift = db.rows.find((r) => r.source_id === "cs_gift:gift");
  assert.equal(gift.kind, "gift");
  assert.equal(gift.detail.item, "Hat plus one year");
  assert.equal(db.rows.some((r) => r.source_id === "cs_new2:merch"), false, "an unpaid checkout is not a sale");

  // Run again: nothing new.
  pages.push({ data: [session("cs_new1"), session("cs_known")], has_more: false });
  const again = await catchUpSales(db, { since: 0, call, items: async () => [], byEmail: async () => null, record: record(db) });
  assert.equal(again.added, 0);
});

test("a member's own first name is used when the order is theirs", async () => {
  const db = database();
  const result = await catchUpSales(db, {
    call: async () => ({ data: [session("cs_member")], has_more: false }),
    items: async () => [],
    byEmail: async () => ({ userId: "u-1", firstName: "Patricia" }),
    record: record(db)
  });
  assert.equal(result.added, 1);
  assert.equal(db.rows[0].first_name, "Patricia");
  assert.equal(db.rows[0].user_id, "u-1");
});

test("by default it looks back to the first of last month", () => {
  const since = new Date(defaultSince(new Date(2026, 10, 15, 20)));
  assert.equal(since.getFullYear(), 2026);
  assert.equal(since.getMonth(), 9);
  assert.equal(since.getDate(), 1);
  assert.equal(new Date(defaultSince(new Date(2027, 0, 3))).getMonth(), 11, "January looks back to December");
});
