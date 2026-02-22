import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

function scoreAddressMatch(query: string, candidate: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  if (c.startsWith(q)) return 3;
  if (c.includes(q)) return 2;
  return 0;
}

export const search = queryGeneric({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const q = args.query.trim().toLowerCase();
    if (!q) return [];

    const rows = await ctx.db.query("addresses").take(200);
    return rows
      .map((row) => ({
        row,
        score: Math.max(
          scoreAddressMatch(q, row.address),
          scoreAddressMatch(q, row.ownerName),
          row.pin.includes(q) ? 3 : 0,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((entry) => entry.row);
  },
});

export const getByPin = queryGeneric({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("addresses")
      .withIndex("by_pin", (q) => q.eq("pin", args.pin))
      .first();
  },
});

export const upsertBatch = mutationGeneric({
  args: {
    rows: v.array(
      v.object({
        pin: v.string(),
        address: v.string(),
        city: v.string(),
        state: v.string(),
        zip: v.string(),
        ownerName: v.string(),
        portfolioId: v.string(),
        violationsOpen: v.number(),
        permitsTotal: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("addresses")
        .withIndex("by_pin", (q) => q.eq("pin", row.pin))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, row);
      } else {
        await ctx.db.insert("addresses", row);
      }
    }

    return { upserted: args.rows.length };
  },
});
