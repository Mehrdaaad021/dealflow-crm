import "dotenv/config";

import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";

import { db } from "./index";
import {
  activities,
  auditLogs,
  companies,
  contacts,
  deals,
  leads,
  pipelineStages,
  pipelines,
  products,
  quotationLineItems,
  quotations,
  tasks,
  teamMembers,
  teams,
  users,
} from "./schema";

const demoEmails = [
  "rep@dealflow.demo",
  "manager@dealflow.demo",
  "admin@dealflow.demo",
];

const day = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * day);
const daysFromNow = (days: number) => new Date(now.getTime() + days * day);
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const money = (cents: number) => (cents / 100).toFixed(2);

const quoteTotal = (subtotalCents: number, discountCents: number) => {
  const taxableCents = subtotalCents - discountCents;
  const taxCents = Math.round(taxableCents * 0.05);

  return {
    subtotal: money(subtotalCents),
    discount: money(discountCents),
    tax: money(taxCents),
    total: money(taxableCents + taxCents),
  };
};

async function seed() {
  const hashedPassword = await bcrypt.hash("Demo1234!", 12);

  await db.transaction(async (tx) => {
    await tx.delete(quotationLineItems);
    await tx.delete(quotations);
    await tx.delete(auditLogs);
    await tx.delete(tasks);
    await tx.delete(activities);
    await tx.delete(deals);
    await tx.delete(leads);
    await tx.delete(contacts);
    await tx.delete(companies);
    await tx.delete(pipelineStages);
    await tx.delete(pipelines);
    await tx.delete(products);
    await tx.delete(teamMembers);
    await tx.delete(teams);
    await tx.delete(users).where(inArray(users.email, demoEmails));

    const insertedUsers = await tx
      .insert(users)
      .values([
        {
          id: "demo-sales-rep",
          name: "Rania Al Mansoori",
          email: "rep@dealflow.demo",
          hashedPassword,
          role: "sales_rep",
          active: true,
          lastActivityAt: daysAgo(0),
        },
        {
          id: "demo-sales-manager",
          name: "Omar Hassan",
          email: "manager@dealflow.demo",
          hashedPassword,
          role: "sales_manager",
          active: true,
          lastActivityAt: daysAgo(1),
        },
        {
          id: "demo-admin",
          name: "Maya Nasser",
          email: "admin@dealflow.demo",
          hashedPassword,
          role: "admin",
          active: true,
          lastActivityAt: daysAgo(2),
        },
      ])
      .returning();

    const userByEmail = Object.fromEntries(
      insertedUsers.map((user) => [user.email, user]),
    );
    const rep = userByEmail["rep@dealflow.demo"]!;
    const manager = userByEmail["manager@dealflow.demo"]!;
    const admin = userByEmail["admin@dealflow.demo"]!;

    const [team] = await tx
      .insert(teams)
      .values({
        name: "Demo Revenue Team",
        description: "DEMO DATA - Dealflow sales team",
      })
      .returning();

    await tx.insert(teamMembers).values(
      [rep, manager, admin].map((user) => ({
        teamId: team!.id,
        userId: user.id,
      })),
    );

    const [pipeline] = await tx
      .insert(pipelines)
      .values({
        name: "B2B Revenue Pipeline",
        description: "DEMO DATA - Standard B2B sales pipeline",
      })
      .returning();

    const stageSeed = [
      ["New Opportunity", "#64748B", 10, false],
      ["Discovery", "#0EA5E9", 25, false],
      ["Qualified", "#2563EB", 45, false],
      ["Solution Proposed", "#7C3AED", 60, false],
      ["Quotation Sent", "#C026D3", 70, false],
      ["Negotiation", "#EA580C", 80, false],
      ["Won", "#16A34A", 100, true],
      ["Lost", "#DC2626", 0, true],
    ] as const;

    const insertedStages = await tx
      .insert(pipelineStages)
      .values(
        stageSeed.map(
          ([name, color, probabilityDefault, isTerminal], position) => ({
            pipelineId: pipeline!.id,
            name,
            position: position + 1,
            color,
            probabilityDefault,
            isTerminal,
            active: true,
          }),
        ),
      )
      .returning();

    const companiesSeed = [
      [
        "Northstar Facilities LLC",
        "Facilities Management",
        "Dubai",
        "customer",
        18500000,
        rep.id,
      ],
      [
        "Meridian Hospitality Group",
        "Hospitality",
        "Abu Dhabi",
        "qualified",
        42000000,
        manager.id,
      ],
      [
        "Gulfline Office Systems",
        "Office Technology",
        "Sharjah",
        "prospect",
        9800000,
        rep.id,
      ],
      [
        "Cedar & Co. Distribution",
        "Distribution",
        "Ajman",
        "qualified",
        27500000,
        manager.id,
      ],
      [
        "Atlas Retail Solutions",
        "Retail Technology",
        "Dubai",
        "prospect",
        15300000,
        rep.id,
      ],
    ] as const;

    const insertedCompanies = await tx
      .insert(companies)
      .values(
        companiesSeed.map(
          (
            [legalName, industry, city, status, annualValue, ownerId],
            index,
          ) => ({
            legalName,
            slug: legalName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, ""),
            industry,
            companySize: ["201-500", "501-1000", "51-200", "201-500", "51-200"][
              index
            ],
            website: `https://${legalName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.demo`,
            country: "United Arab Emirates",
            city,
            address: `${city}, United Arab Emirates`,
            taxVatNumber: `DEMO-VAT-${index + 1}`,
            ownerId,
            status,
            estimatedAnnualValue: money(annualValue),
            notes: "DEMO DATA - Fictional company for product demonstration.",
          }),
        ),
      )
      .returning();

    const insertedContacts = await tx
      .insert(contacts)
      .values(
        insertedCompanies.flatMap((company, index) => [
          {
            companyId: company.id,
            firstName: ["Lina", "Faisal", "Noura", "Yousef", "Sara"][index]!,
            lastName: ["Rahman", "Khalid", "Al Mazrouei", "Haddad", "Qasim"][
              index
            ]!,
            jobTitle: "Procurement Director",
            email: `contact${index + 1}.primary@dealflow.demo`,
            phone: `+971 50 555 10${index + 1}`,
            preferredCommunicationChannel: "email" as const,
            isDecisionMaker: true,
            status: "active" as const,
            ownerId: company.ownerId,
            notes: "DEMO DATA - Fictional decision-maker contact.",
          },
          {
            companyId: company.id,
            firstName: ["Kareem", "Huda", "Bilal", "Amal", "Tariq"][index]!,
            lastName: ["Saeed", "Mansour", "George", "Darwish", "Saleh"][
              index
            ]!,
            jobTitle: "Operations Manager",
            email: `contact${index + 1}.operations@dealflow.demo`,
            phone: `+971 50 555 20${index + 1}`,
            preferredCommunicationChannel: "phone" as const,
            isDecisionMaker: false,
            status: "active" as const,
            ownerId: company.ownerId,
            notes: "DEMO DATA - Fictional operational contact.",
          },
        ]),
      )
      .returning();

    const primaryContacts = insertedCompanies.map(
      (_, index) => insertedContacts[index * 2]!,
    );

    const leadSeed = [
      ["Facilities Expansion Inquiry", 0, "website", "new", 72, 850000, rep.id],
      [
        "Hotel Network Refresh",
        1,
        "referral",
        "contacted",
        64,
        1250000,
        manager.id,
      ],
      ["Office Automation RFP", 2, "event", "qualified", 88, 460000, rep.id],
      [
        "Distribution Fleet Upgrade",
        3,
        "outbound",
        "unqualified",
        31,
        720000,
        manager.id,
      ],
      [
        "Retail Analytics Partnership",
        4,
        "partner",
        "converted",
        94,
        980000,
        rep.id,
      ],
      [
        "Hospitality Service Desk",
        1,
        "other",
        "converted",
        90,
        640000,
        manager.id,
      ],
    ] as const;

    const insertedLeads = await tx
      .insert(leads)
      .values(
        leadSeed.map(
          (
            [
              name,
              companyIndex,
              source,
              status,
              score,
              estimatedValue,
              ownerId,
            ],
            index,
          ) => ({
            name,
            companyId: insertedCompanies[companyIndex]!.id,
            contactId: primaryContacts[companyIndex]!.id,
            source,
            status,
            score,
            estimatedValue: money(estimatedValue),
            ownerId,
            nextFollowUpAt:
              status === "unqualified" ? null : daysFromNow(index + 1),
            notes: "DEMO DATA - Fictional lead for product demonstration.",
            convertedAt: status === "converted" ? daysAgo(index + 2) : null,
            conversionMetadata:
              status === "converted"
                ? { demo: true, convertedBy: ownerId, note: "DEMO DATA" }
                : null,
          }),
        ),
      )
      .returning();

    const insertedDeals = await tx
      .insert(deals)
      .values(
        insertedStages.map((stage, index) => ({
          name: [
            "Facilities Preventive Maintenance",
            "Meridian Guest Experience Rollout",
            "Gulfline Smart Office Deployment",
            "Cedar Distribution Visibility",
            "Atlas Retail Intelligence",
            "Meridian Service Operations",
            "Northstar National Contract",
            "Cedar Legacy Platform Review",
          ][index]!,
          companyId: insertedCompanies[index % insertedCompanies.length]!.id,
          primaryContactId: primaryContacts[index % primaryContacts.length]!.id,
          ownerId: index % 2 === 0 ? rep.id : manager.id,
          pipelineId: pipeline!.id,
          stageId: stage.id,
          amount: money(
            [285000, 640000, 460000, 780000, 925000, 510000, 1250000, 340000][
              index
            ]!,
          ),
          probability: stage.probabilityDefault,
          expectedCloseDate: dateOnly(
            index === 7 ? daysAgo(10) : daysFromNow(index - 2),
          ),
          sourceLeadId: index >= 6 ? insertedLeads[index - 6]!.id : null,
          description:
            "DEMO DATA - Fictional deal created to demonstrate pipeline reporting.",
          lostReason:
            index === 7 ? "Budget deferred to next fiscal year." : null,
          wonLostAt: index >= 6 ? daysAgo(index === 6 ? 4 : 10) : null,
        })),
      )
      .returning();

    await tx.insert(tasks).values([
      {
        title: "Follow up on Northstar maintenance scope",
        companyId: insertedCompanies[0]!.id,
        contactId: primaryContacts[0]!.id,
        dealId: insertedDeals[0]!.id,
        assignedToId: rep.id,
        dueAt: daysAgo(3),
        priority: "high",
        status: "open",
        reminder: true,
        notes: "DEMO DATA - Overdue follow-up.",
      },
      {
        title: "Confirm Meridian discovery attendees",
        companyId: insertedCompanies[1]!.id,
        contactId: primaryContacts[1]!.id,
        dealId: insertedDeals[1]!.id,
        assignedToId: manager.id,
        dueAt: daysAgo(1),
        priority: "urgent",
        status: "open",
        reminder: true,
        notes: "DEMO DATA - Overdue follow-up.",
      },
      {
        title: "Send Gulfline solution outline",
        companyId: insertedCompanies[2]!.id,
        dealId: insertedDeals[2]!.id,
        assignedToId: rep.id,
        dueAt: daysFromNow(1),
        priority: "medium",
        status: "open",
        reminder: true,
        notes: "DEMO DATA - Upcoming task.",
      },
      {
        title: "Review Cedar pricing options",
        companyId: insertedCompanies[3]!.id,
        dealId: insertedDeals[3]!.id,
        assignedToId: manager.id,
        dueAt: daysFromNow(3),
        priority: "high",
        status: "in_progress",
        reminder: false,
        notes: "DEMO DATA - Upcoming task.",
      },
      {
        title: "Prepare Atlas stakeholder briefing",
        companyId: insertedCompanies[4]!.id,
        dealId: insertedDeals[4]!.id,
        assignedToId: rep.id,
        dueAt: daysFromNow(7),
        priority: "low",
        status: "open",
        reminder: false,
        notes: "DEMO DATA - Upcoming task.",
      },
      {
        title: "Log completed Meridian site visit",
        companyId: insertedCompanies[1]!.id,
        dealId: insertedDeals[1]!.id,
        assignedToId: manager.id,
        dueAt: daysAgo(5),
        priority: "medium",
        status: "completed",
        reminder: false,
        notes: "DEMO DATA - Completed task.",
      },
      {
        title: "Archive old Cedar proposal follow-up",
        companyId: insertedCompanies[3]!.id,
        dealId: insertedDeals[7]!.id,
        assignedToId: manager.id,
        dueAt: daysAgo(12),
        priority: "low",
        status: "completed",
        reminder: false,
        notes: "DEMO DATA - Completed task.",
      },
    ]);

    await tx.insert(activities).values([
      {
        companyId: insertedCompanies[0]!.id,
        contactId: primaryContacts[0]!.id,
        dealId: insertedDeals[0]!.id,
        type: "call",
        subject: "Maintenance scope discovery call",
        body: "DEMO DATA - Discussed facilities coverage and response-time requirements.",
        activityAt: daysAgo(2),
        createdById: rep.id,
        status: "completed",
      },
      {
        companyId: insertedCompanies[1]!.id,
        contactId: primaryContacts[1]!.id,
        dealId: insertedDeals[1]!.id,
        type: "meeting",
        subject: "Guest experience workshop",
        body: "DEMO DATA - Mapped guest operations pain points and rollout milestones.",
        activityAt: daysAgo(7),
        createdById: manager.id,
        status: "completed",
      },
      {
        companyId: insertedCompanies[2]!.id,
        contactId: primaryContacts[2]!.id,
        dealId: insertedDeals[2]!.id,
        type: "email",
        subject: "Smart office requirements received",
        body: "DEMO DATA - Customer shared the initial office automation requirements.",
        activityAt: daysAgo(12),
        createdById: rep.id,
        status: "completed",
      },
      {
        companyId: insertedCompanies[3]!.id,
        contactId: primaryContacts[3]!.id,
        dealId: insertedDeals[3]!.id,
        type: "note",
        subject: "Distribution visibility notes",
        body: "DEMO DATA - Identified fleet tracking and inventory visibility priorities.",
        activityAt: daysAgo(18),
        createdById: manager.id,
        status: "completed",
      },
      {
        companyId: insertedCompanies[4]!.id,
        contactId: primaryContacts[4]!.id,
        dealId: insertedDeals[4]!.id,
        type: "call",
        subject: "Retail analytics qualification call",
        body: "DEMO DATA - Confirmed store count, reporting cadence, and success criteria.",
        activityAt: daysAgo(25),
        createdById: rep.id,
        status: "completed",
      },
      {
        companyId: insertedCompanies[0]!.id,
        contactId: primaryContacts[0]!.id,
        dealId: insertedDeals[6]!.id,
        type: "meeting",
        subject: "National contract executive review",
        body: "DEMO DATA - Reviewed final commercial terms with the executive sponsor.",
        activityAt: daysAgo(29),
        createdById: manager.id,
        status: "completed",
      },
    ]);

    const productSeed = [
      {
        name: "Preventive Maintenance Plan",
        sku: "DF-MAINT-001",
        unit: "service",
        unitPrice: 185000,
        category: "Services",
        status: "active" as const,
      },
      {
        name: "Guest Experience Suite",
        sku: "DF-HOSP-002",
        unit: "license",
        unitPrice: 240000,
        category: "Hospitality",
        status: "active" as const,
      },
      {
        name: "Smart Office Controller",
        sku: "DF-OFFICE-003",
        unit: "unit",
        unitPrice: 18500,
        category: "Office Systems",
        status: "active" as const,
      },
      {
        name: "Fleet Visibility Platform",
        sku: "DF-DIST-004",
        unit: "license",
        unitPrice: 97500,
        category: "Distribution",
        status: "active" as const,
      },
      {
        name: "Retail Analytics Core",
        sku: "DF-RETAIL-005",
        unit: "license",
        unitPrice: 165000,
        category: "Retail Technology",
        status: "active" as const,
      },
      {
        name: "Implementation Workshop",
        sku: "DF-SVC-006",
        unit: "day",
        unitPrice: 6500,
        category: "Services",
        status: "active" as const,
      },
      {
        name: "Priority Support Package",
        sku: "DF-SUP-007",
        unit: "year",
        unitPrice: 28000,
        category: "Support",
        status: "active" as const,
      },
      {
        name: "Executive Reporting Add-on",
        sku: "DF-REP-008",
        unit: "license",
        unitPrice: 42000,
        category: "Reporting",
        status: "active" as const,
      },
      {
        name: "Legacy Reporting Connector",
        sku: "DF-LEGACY-009",
        unit: "connector",
        unitPrice: 12000,
        category: "Legacy",
        status: "inactive" as const,
      },
    ];

    const insertedProducts = await tx
      .insert(products)
      .values(
        productSeed.map(({ name, sku, unit, unitPrice, category, status }) => ({
          name,
          sku,
          description: `DEMO DATA - Fictional ${name.toLowerCase()} catalog entry.`,
          unit,
          unitPrice: money(unitPrice),
          taxRate: "5.00",
          category,
          status,
        })),
      )
      .returning();

    const quoteStatuses = [
      "draft",
      "pending_approval",
      "approved",
      "sent",
      "accepted",
      "rejected",
      "expired",
    ] as const;
    const quoteInputs = quoteStatuses.map((status, index) => {
      const subtotalCents = [
        28500000, 64000000, 46000000, 78000000, 92500000, 51000000, 34000000,
      ][index]!;
      const discountCents = [0, 3200000, 0, 5000000, 7500000, 2500000, 1500000][
        index
      ]!;
      return {
        status,
        index,
        subtotalCents,
        discountCents,
        totals: quoteTotal(subtotalCents, discountCents),
      };
    });

    const insertedQuotations = await tx
      .insert(quotations)
      .values(
        quoteInputs.map(({ status, index, totals }) => ({
          quoteNumber: `DEMO-Q-${String(index + 1).padStart(3, "0")}`,
          companyId: insertedCompanies[index % insertedCompanies.length]!.id,
          contactId: primaryContacts[index % primaryContacts.length]!.id,
          dealId: insertedDeals[index]!.id,
          ownerId: index % 2 === 0 ? rep.id : manager.id,
          status,
          currency: "AED" as const,
          validUntil: dateOnly(daysFromNow(30 - index * 4)),
          ...totals,
          customerNotes: "DEMO DATA - Fictional quotation for demonstration.",
          internalNotes:
            "DEMO DATA - Do not use for real commercial decisions.",
          sentAt: ["sent", "accepted", "rejected", "expired"].includes(status)
            ? daysAgo(index + 1)
            : null,
        })),
      )
      .returning();

    await tx.insert(quotationLineItems).values(
      quoteInputs.flatMap(
        ({ index, subtotalCents, discountCents }, quoteIndex) => {
          const product = insertedProducts[quoteIndex % 8]!;
          const quantity =
            quoteIndex % 3 === 0 ? 10 : quoteIndex % 3 === 1 ? 5 : 2;
          const unitPriceCents = Math.round(subtotalCents / quantity);
          const lineSubtotalCents = unitPriceCents * quantity;
          const lineDiscountCents = discountCents;
          const lineTotalCents = lineSubtotalCents - lineDiscountCents;

          return {
            quotationId: insertedQuotations[index]!.id,
            productId: product.id,
            description: `${product.name} - DEMO DATA snapshot`,
            sku: product.sku,
            quantity: String(quantity),
            unitPrice: money(unitPriceCents),
            discount: money(lineDiscountCents),
            taxRate: "5.00",
            lineSubtotal: money(lineSubtotalCents),
            lineTotal: money(lineTotalCents),
          };
        },
      ),
    );
  });

  console.log("Seeded Dealflow demo data successfully.");
}

try {
  await seed();
} catch (error) {
  console.error("Failed to seed Dealflow demo data.", error);
  process.exitCode = 1;
}
