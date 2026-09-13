/**
 * Pure business rules for Dealflow CRM.
 *
 * These functions have no database and no framework dependency so they can
 * be unit-tested directly (see business-rules.test.ts) and reused by any
 * router that needs the same source of truth.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type MoneyLine = {
  lineSubtotal: number;
  lineTotal: number;
};

/**
 * Server-side quotation math:
 *   subtotal = Σ lineSubtotal
 *   base     = Σ lineTotal − quoteDiscount
 *   tax      = 5% of base (UAE VAT)
 *   total    = base + tax
 */
export function computeTotals(lines: MoneyLine[], quoteDiscount: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const linesTotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const base = round2(linesTotal - quoteDiscount);
  const tax = round2(base * 0.05);
  const total = round2(base + tax);
  return { subtotal, discount: quoteDiscount, tax, total };
}

/** Allowed quotation lifecycle moves. */
export const QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected"],
  approved: ["sent"],
  sent: ["accepted", "rejected", "expired"],
  accepted: [],
  rejected: [],
  expired: [],
};

export function canTransitionQuote(from: string, to: string): boolean {
  return (QUOTE_TRANSITIONS[from] ?? []).includes(to);
}

export const APPROVER_ROLES = ["sales_manager", "admin"] as const;

export function isApproverRole(role: string): boolean {
  return (APPROVER_ROLES as readonly string[]).includes(role);
}