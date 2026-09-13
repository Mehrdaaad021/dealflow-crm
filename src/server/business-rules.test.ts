import { describe, expect, it } from "vitest";

import {
  canTransitionQuote,
  computeTotals,
  isApproverRole,
  round2,
} from "~/server/business-rules";

describe("quotation money math (server-side source of truth)", () => {
  it("adds 5% VAT on the base when there is no discount", () => {
    const totals = computeTotals([{ lineSubtotal: 3000, lineTotal: 3000 }], 0);
    expect(totals.subtotal).toBe(3000);
    expect(totals.discount).toBe(0);
    expect(totals.tax).toBe(150);
    expect(totals.total).toBe(3150);
  });

  it("applies line discounts and quote discount before VAT", () => {
    const totals = computeTotals(
      [
        { lineSubtotal: 1000, lineTotal: 900 },
        { lineSubtotal: 500, lineTotal: 500 },
      ],
      100,
    );
    // base = (900 + 500) - 100 = 1300 → tax 65 → total 1365
    expect(totals.subtotal).toBe(1500);
    expect(totals.tax).toBe(65);
    expect(totals.total).toBe(1365);
  });

  it("keeps money at two decimals (no floating point dust)", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    const totals = computeTotals([{ lineSubtotal: 33.33, lineTotal: 33.33 }], 0);
    expect(totals.tax).toBe(1.67);
    expect(totals.total).toBe(35);
  });
});

describe("quotation lifecycle transitions", () => {
  it("allows the happy path", () => {
    expect(canTransitionQuote("draft", "pending_approval")).toBe(true);
    expect(canTransitionQuote("pending_approval", "approved")).toBe(true);
    expect(canTransitionQuote("approved", "sent")).toBe(true);
    expect(canTransitionQuote("sent", "accepted")).toBe(true);
  });

  it("blocks shortcuts that skip approval", () => {
    expect(canTransitionQuote("draft", "approved")).toBe(false);
    expect(canTransitionQuote("draft", "sent")).toBe(false);
    expect(canTransitionQuote("pending_approval", "sent")).toBe(false);
  });

  it("locks closed quotations forever", () => {
    expect(canTransitionQuote("accepted", "sent")).toBe(false);
    expect(canTransitionQuote("rejected", "pending_approval")).toBe(false);
    expect(canTransitionQuote("expired", "sent")).toBe(false);
  });
});

describe("approval roles", () => {
  it("lets managers and admins approve", () => {
    expect(isApproverRole("sales_manager")).toBe(true);
    expect(isApproverRole("admin")).toBe(true);
  });

  it("never lets a rep approve their own quote", () => {
    expect(isApproverRole("sales_rep")).toBe(false);
  });
});