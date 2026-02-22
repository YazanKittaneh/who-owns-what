import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  addresses: defineTable({
    pin: v.string(),
    address: v.string(),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    ownerName: v.string(),
    portfolioId: v.string(),
    violationsOpen: v.number(),
    permitsTotal: v.number(),
  })
    .index("by_pin", ["pin"])
    .index("by_portfolio_id", ["portfolioId"]),
  portfolios: defineTable({
    portfolioId: v.string(),
    ownerName: v.string(),
    pinCount: v.number(),
  }).index("by_portfolio_id", ["portfolioId"]),
});
