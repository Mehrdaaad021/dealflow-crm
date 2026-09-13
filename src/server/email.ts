import { Resend } from "resend";

type Status = "approved" | "rejected" | string;

interface QuotationStatusEmail {
  to: string;
  quoteNumber: string;
  companyName: string | null;
  status: Status;
  reason?: string | null;
  actorName: string | null;
}

const BRAND = {
  name: "Dealflow",
  tagline: "Revenue Workspace",
  green: "#1f6f5c",
  dark: "#122f2a",
  cream: "#faf7f2",
  muted: "#5c6b66",
  accent: "#8a6d3b",
};

function wrap(body: string, preheader: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${preheader}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.dark};">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(18,47,42,0.06);">
          <tr>
            <td style="background:${BRAND.dark};color:#ffffff;padding:22px 28px;">
              <div style="font-size:18px;font-weight:700;letter-spacing:0.2px;">${BRAND.name}</div>
              <div style="font-size:10px;color:${BRAND.accent};letter-spacing:2px;margin-top:2px;">${BRAND.tagline.toUpperCase()} · DEMO</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f7f3ec;font-size:11px;color:${BRAND.muted};text-align:center;">
              Fictional demo data — sent from Dealflow CRM portfolio project.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statusConfig(status: Status) {
  if (status === "approved") {
    return {
      emoji: "✅",
      headline: "Your quotation has been approved",
      color: "#1f6f5c",
      cta: "View quotation",
    };
  }
  if (status === "rejected") {
    return {
      emoji: "❌",
      headline: "Your quotation was rejected",
      color: "#b42318",
      cta: "Review feedback",
    };
  }
  return {
    emoji: "📄",
    headline: `Quotation status: ${status}`,
    color: BRAND.dark,
    cta: "Open quotation",
  };
}

export async function sendQuotationStatusEmail(
  args: QuotationStatusEmail,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }

  const cfg = statusConfig(args.status);
  const reasonBlock =
    args.status === "rejected" && args.reason
      ? `<div style="margin-top:16px;padding:12px 14px;background:#fff5f5;border-left:3px solid #b42318;border-radius:6px;font-size:13px;color:#7a1a14;">
           <div style="font-weight:600;margin-bottom:4px;">Feedback</div>
           <div>${args.reason.replace(/</g, "&lt;")}</div>
         </div>`
      : "";

  const body = `
    <div style="font-size:28px;line-height:1;">${cfg.emoji}</div>
    <h1 style="font-size:20px;font-weight:700;color:${cfg.color};margin:14px 0 8px 0;">
      ${cfg.headline}
    </h1>
    <p style="font-size:14px;color:${BRAND.muted};margin:0 0 18px 0;">
      ${args.quoteNumber} · ${args.companyName ?? "Unknown company"}
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;font-size:13px;">
          <div style="color:${BRAND.muted};font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Reviewed by</div>
          <div style="color:${BRAND.dark};font-weight:600;margin-top:2px;">
            ${args.actorName ?? "A manager"}
          </div>
        </td>
      </tr>
    </table>
    ${reasonBlock}
    <p style="font-size:13px;color:${BRAND.muted};margin:22px 0 0 0;">
      This is a demo notification from the Dealflow CRM portfolio project. In production, this would link directly to the quotation.
    </p>
  `;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Dealflow CRM <onboarding@resend.dev>",
      to: args.to,
      subject: `${cfg.emoji} ${args.quoteNumber} — ${cfg.headline}`,
      html: wrap(body, cfg.headline),
    });
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    return { sent: false, reason };
  }
}