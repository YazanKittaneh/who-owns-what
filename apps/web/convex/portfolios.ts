import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

export const getById = queryGeneric({
  args: { portfolioId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("addresses")
      .withIndex("by_portfolio_id", (q) => q.eq("portfolioId", args.portfolioId))
      .collect();
  },
});

export const getSummary = queryGeneric({
  args: { portfolioId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("portfolios")
      .withIndex("by_portfolio_id", (q) => q.eq("portfolioId", args.portfolioId))
      .first();
  },
});

export const recomputeSummaries = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const addresses = await ctx.db.query("addresses").collect();
    const grouped = new Map<
      string,
      {
        ownerName: string;
        pinCount: number;
        totalViolationsOpen: number;
        totalPermits: number;
      }
    >();

    for (const row of addresses) {
      const current = grouped.get(row.portfolioId) ?? {
        ownerName: row.ownerName,
        pinCount: 0,
        totalViolationsOpen: 0,
        totalPermits: 0,
      };

      current.pinCount += 1;
      current.totalViolationsOpen += row.violationsOpen;
      current.totalPermits += row.permitsTotal;
      grouped.set(row.portfolioId, current);
    }

    const existing = await ctx.db.query("portfolios").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    for (const [portfolioId, summary] of grouped.entries()) {
      await ctx.db.insert("portfolios", {
        portfolioId,
        ownerName: summary.ownerName,
        pinCount: summary.pinCount,
        totalViolationsOpen: summary.totalViolationsOpen,
        totalPermits: summary.totalPermits,
      });
    }

    return { portfolios: grouped.size };
  },
});
