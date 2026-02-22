import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  addresses: defineTable({
    pin: v.string(),
    address: v.string(),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
  }).index("by_pin", ["pin"]),
  portfolios: defineTable({
    portfolioId: v.string(),
    ownerName: v.string(),
    pinCount: v.number(),
  }).index("by_portfolio_id", ["portfolioId"]),
});
