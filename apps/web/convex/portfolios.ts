import { queryGeneric } from "convex/server";
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
