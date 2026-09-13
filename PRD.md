Build Brief: B2B Sales CRM & Quotation Management Platform

Role

You are a senior product engineer, UX designer, and application architect. Build a polished, portfolio-ready B2B sales CRM and quotation management platform called Dealflow.

The product should demonstrate that the builder understands both business development operations and full-stack product engineering. It must not look like a generic admin template. It should feel like a focused operating system for B2B sales teams: clear, calm, fast, data-rich, and practical.

Build the application in an existing full-stack web project using the project’s established conventions. Reuse the provided authentication, database, tRPC, UI, storage, and testing infrastructure instead of creating parallel systems. Do not replace existing framework plumbing unless absolutely necessary.




Product Goal

Dealflow helps B2B sales teams manage the complete revenue workflow from the first lead to a won or lost deal.

The platform must allow a sales representative to:

1.
Capture and qualify leads.

2.
Organize companies and contacts.

3.
Track every deal through a visual sales pipeline.

4.
Record calls, meetings, emails, notes, and follow-up tasks.

5.
Create professional quotations in AED.

6.
Track quotation status and deal value.

7.
Monitor personal and team performance.

8.
Maintain a reliable, auditable history of every meaningful sales action.

The resulting application should be suitable as a portfolio project for roles such as:

•
B2B Sales Operations Specialist

•
Business Development Executive

•
E-commerce Technical Specialist

•
Solutions Engineer

•
Full-stack Developer

•
CRM Implementation Specialist

•
Revenue Operations Analyst




Technical Direction

Use the existing project stack and conventions wherever available:

•
React with TypeScript.

•
The existing routing solution.

•
Tailwind CSS and the existing component library.

•
tRPC for typed client-server communication.

•
Drizzle ORM and the project database.

•
Existing authentication/session utilities.

•
Existing object storage helper for quotation documents or company logos if needed.

•
Vitest for business-rule and server procedure tests.

•
The existing notification/toast system.

Use server-side procedures for all business-critical actions. Do not trust prices, totals, permissions, ownership, deal stages, or status transitions supplied by the browser.

Do not introduce Axios or an additional REST client if the existing project uses tRPC. Do not manually manage authentication cookies. Do not expose server credentials, database credentials, payment secrets, or storage service-role keys to browser code.




Product Personas and Permissions

Implement role-aware access control with these personas:

Sales Representative

A sales representative can view and manage the companies, contacts, leads, deals, activities, tasks, and quotations assigned to them. They can create new records, update records they own, and move their deals through permitted pipeline stages.

Sales Manager

A sales manager can view team-wide records, reassign ownership, inspect all activities and quotations within the team, review pipeline performance, and access team analytics. Managers can configure pipeline stages and approve or reject quotations if the workflow requires approval.

Administrator

An administrator can manage users, roles, teams, pipeline stages, product catalog entries used in quotations, system settings, and audit history. Administrative actions must be protected on the server.

Every protected query must be scoped by authenticated user, team, vendor/company ownership, or administrator role as appropriate. Add server-side authorization checks for every mutation.




Core Domain Model

Design a relational data model with clear foreign keys, indexes, timestamps, and ownership relationships. Use UTC timestamps internally and display localized dates in the UI.

Create or extend the following entities as appropriate:

Users and Teams

•
User identity from the existing authentication system.

•
Role: sales_rep, sales_manager, or admin.

•
Team membership.

•
Active/inactive status.

•
Last activity timestamp.

Companies

A company is a B2B account or organization.

Fields should include:

•
Legal or display name.

•
Slug.

•
Industry.

•
Company size.

•
Website.

•
Country and city.

•
Address.

•
Tax/VAT number where relevant.

•
Account owner.

•
Lifecycle status: prospect, qualified, customer, inactive.

•
Estimated annual value.

•
Notes.

•
Created and updated timestamps.

Contacts

A company can have multiple contacts.

Fields should include:

•
Company ID.

•
First name and last name.

•
Job title.

•
Email.

•
Phone.

•
Preferred communication channel.

•
Decision-maker flag.

•
Contact status.

•
Notes.

•
Owner.

•
Created and updated timestamps.

Leads

A lead represents an unqualified or partially qualified opportunity.

Fields should include:

•
Lead name.

•
Company and optional contact.

•
Source: website, referral, event, outbound, partner, other.

•
Lead status: new, contacted, qualified, unqualified, converted.

•
Lead score from 0 to 100.

•
Estimated value in AED.

•
Owner.

•
Next follow-up date.

•
Notes.

•
Conversion metadata.

Deals

A deal represents a qualified revenue opportunity.

Fields should include:

•
Deal name.

•
Company ID.

•
Primary contact ID.

•
Owner.

•
Pipeline ID and stage ID.

•
Amount in AED.

•
Probability percentage.

•
Expected close date.

•
Source lead ID if converted from a lead.

•
Description.

•
Lost reason when lost.

•
Win/loss date.

•
Created and updated timestamps.

Pipeline Stages

Support configurable pipeline stages, for example:

1.
New opportunity

2.
Discovery

3.
Qualified

4.
Solution proposed

5.
Quotation sent

6.
Negotiation

7.
Won

8.
Lost

Each stage should have a name, position, color, probability default, terminal-state flag, and active status.

Activities

Activities are immutable or append-only sales touchpoints whenever possible.

Supported types:

•
Call

•
Meeting

•
Email

•
WhatsApp or messaging follow-up

•
Note

•
Demo

•
Quotation sent

•
Status change

Fields should include:

•
Related company.

•
Optional contact.

•
Optional deal.

•
Activity type.

•
Subject.

•
Body or notes.

•
Activity date.

•
Created by.

•
Completion status.

Tasks and Follow-ups

Tasks should include:

•
Title.

•
Related company, contact, lead, or deal.

•
Assigned user.

•
Due date.

•
Priority: low, medium, high, urgent.

•
Status: open, in progress, completed, cancelled.

•
Reminder flag.

•
Notes.

Product Catalog for Quotations

Create a small internal product/service catalog used when building quotations.

Fields should include:

•
Name.

•
SKU.

•
Description.

•
Unit.

•
Unit price in AED.

•
Tax rate.

•
Active status.

•
Optional category.

Quotations

A quotation belongs to a company and optionally to a deal.

Fields should include:

•
Quote number.

•
Company ID.

•
Contact ID.

•
Deal ID.

•
Owner.

•
Status: draft, pending_approval, approved, sent, viewed, accepted, rejected, expired.

•
Currency, default AED.

•
Valid-until date.

•
Subtotal.

•
Discount.

•
Tax.

•
Total.

•
Customer notes.

•
Internal notes.

•
Created, sent, and updated timestamps.

Quotation line items should include:

•
Product/service ID.

•
Description snapshot.

•
SKU snapshot.

•
Quantity.

•
Unit price snapshot.

•
Discount.

•
Tax rate snapshot.

•
Line subtotal.

•
Line total.

Never recalculate a historical quotation from the current product catalog. Store the necessary line-item snapshots so old quotations remain accurate.

Audit Logs

Record important actions such as:

•
Deal stage changes.

•
Owner changes.

•
Quote approval or rejection.

•
Quote status changes.

•
Company deletion or archival.

•
Permission changes.

•
Product price changes.

Store actor, action, entity type, entity ID, metadata, and timestamp. Never expose raw secrets or sensitive authentication payloads in audit metadata.




Required Screens and Workflows

1. CRM Overview Dashboard

Create a polished dashboard with:

•
Total pipeline value in AED.

•
Weighted pipeline value.

•
Open deals.

•
Deals closing this month.

•
Win rate.

•
Average sales cycle.

•
Overdue follow-ups.

•
Quote acceptance rate.

•
Revenue by pipeline stage.

•
Recent activity timeline.

•
Personal versus team performance when the user is a manager.

Use concise cards, a visual pipeline summary, and one or two meaningful charts. Do not fill the screen with decorative charts that do not support a decision.

2. Company Directory

Build a searchable and filterable company directory with:

•
Search by company name, industry, city, owner, or status.

•
Filters for lifecycle status and owner.

•
Sort by latest activity, estimated value, or creation date.

•
Table and compact card presentation where appropriate.

•
Empty states and loading states.

•
Quick actions to add a contact, create a deal, or log an activity.

3. Company Detail Page

Create a strong company workspace with:

•
Company profile summary.

•
Primary owner.

•
Contacts list.

•
Active deals.

•
Recent activities.

•
Open tasks.

•
Quotations.

•
Timeline of company history.

•
Quick actions for “Add contact”, “Create deal”, “Log activity”, and “Create quotation”.

The user should never lose context while navigating within the company workspace. Include clear back navigation and breadcrumbs.

4. Contact Management

Allow users to create, edit, archive, and view contacts belonging to a company. Add clear validation for email, phone, name, and required company relationship.

Display contact details alongside related activities, tasks, deals, and quotations.

5. Lead Inbox

Build a lead inbox with:

•
New lead queue.

•
Lead score.

•
Source badge.

•
Owner.

•
Next follow-up date.

•
Qualification status.

•
Quick actions for contact, qualify, convert to company/deal, or mark unqualified.

When converting a lead, avoid creating duplicate companies and contacts. Provide a clear conversion flow that allows selecting an existing company or creating a new one.

6. Visual Deal Pipeline

Build a responsive Kanban pipeline.

Each deal card should show:

•
Deal name.

•
Company.

•
Owner avatar or initials.

•
Amount in AED.

•
Probability.

•
Expected close date.

•
Next task indicator.

•
Warning for overdue follow-up.

Support:

•
Drag-and-drop stage changes if the existing app supports it reliably.

•
A click-based fallback for keyboard and mobile accessibility.

•
Stage-level totals.

•
Weighted pipeline totals.

•
Deal detail drawer or page.

•
Confirmation before moving a deal to Won or Lost.

•
Required lost reason when moving to Lost.

All stage transitions must be validated on the server.

7. Deal Detail Page

Show:

•
Deal summary and value.

•
Company and primary contact.

•
Stage and probability.

•
Expected close date.

•
Owner.

•
Activities timeline.

•
Tasks.

•
Quotations.

•
Notes.

•
Audit history.

Add quick actions for “Log activity”, “Create task”, “Create quotation”, “Move stage”, and “Mark won/lost”.

8. Activity Composer

Create a reusable activity composer supporting:

•
Activity type.

•
Subject.

•
Notes.

•
Related company/contact/deal.

•
Activity date.

•
Completion state.

After creating an activity, refresh the relevant timeline and dashboard metrics. Show clear toast feedback and validation errors.

9. Tasks and Follow-up Center

Create a follow-up page with:

•
Today’s tasks.

•
Upcoming tasks.

•
Overdue tasks.

•
Completed tasks.

•
Filters by owner, priority, entity type, and due date.

•
Quick complete action.

•
Link back to the related deal or company.

Use visual priority indicators without relying on color alone.

10. Quotation Builder

Create a professional quotation builder with:

•
Company and contact selection.

•
Deal association.

•
Product/service line item search.

•
Quantity editing.

•
AED unit prices.

•
Discount support.

•
Tax calculation.

•
Valid-until date.

•
Customer-facing notes.

•
Internal notes.

•
Live subtotal, tax, discount, and total summary.

•
Save as draft.

•
Submit for approval.

•
Approve, reject, send, accept, or expire according to role and status.

All monetary calculations must happen on the server and be covered by tests. The browser may provide an optimistic preview, but the server is authoritative.

If PDF generation already exists in the project, create a printable quotation view or PDF-ready layout. Do not add a heavy PDF dependency unless needed. Never fabricate a customer signature, testimonial, rating, or acceptance.

11. Quotation Detail Page

Display:

•
Quote number.

•
Company and contact.

•
Deal.

•
Line items.

•
Totals.

•
Current status.

•
Valid-until date.

•
Activity history.

•
Approval history.

•
Actions available for the current role.

Make the layout printable and suitable for sharing with a B2B customer.

12. Product Catalog Management

Admins and authorized managers should manage products/services used in quotations:

•
Create, edit, archive, and activate entries.

•
Change unit price in AED.

•
Manage SKU and unit.

•
Search catalog.

•
Prevent inactive products from being selected for new quotations.

•
Preserve snapshots on existing quotation line items.

13. Team Analytics

For managers and admins, include:

•
Pipeline by owner.

•
Won revenue by month.

•
Win rate by owner.

•
Average deal age.

•
Quotation acceptance rate.

•
Overdue task count.

•
Lead conversion rate.

•
Source performance.

Use realistic demo data that is clearly marked as demo data. Do not create fake public testimonials, customer reviews, ratings, or endorsements.




UI and Visual Direction

Create a distinctive, premium B2B operating-system interface rather than a generic blue dashboard.

Suggested visual language:

•
Light warm background with deep ink or evergreen navigation accents.

•
A restrained accent color for revenue, progress, and positive movement.

•
Strong typography hierarchy.

•
Dense but breathable data tables.

•
Rounded cards with soft shadows instead of heavy borders.

•
Clear status badges.

•
Carefully designed empty states.

•
Responsive behavior for laptop, tablet, and mobile.

•
Keyboard-accessible controls and visible focus states.

•
Compact command-oriented interactions where useful.

•
Subtle motion under 300ms, respecting prefers-reduced-motion.

Use a persistent sidebar for internal CRM pages. Keep company and deal detail screens context-rich. Avoid nested navigation dead ends.

Use English-first content and AED pricing. Structure labels, date formatting, currency formatting, and direction handling so future Arabic RTL and localization can be added without rewriting the layout.

Do not use lorem ipsum. Use realistic but clearly fictional B2B demo records such as:

•
Northstar Facilities LLC

•
Meridian Hospitality Group

•
Gulfline Office Systems

•
Cedar & Co. Distribution

•
Atlas Retail Solutions

Do not use fake customer testimonials or public reviews anywhere in the product.




Business Rules and Security

Implement and test these rules:

1.
A sales representative can access only records permitted by ownership or team membership.

2.
Managers can view team records but cannot bypass server-side validation.

3.
Administrators can manage system-level configuration.

4.
A deal cannot be moved to Won without the required business fields.

5.
A deal cannot be moved to Lost without a lost reason.

6.
A completed quotation cannot be silently recalculated from the current catalog.

7.
Quotation totals must be calculated on the server from validated line items.

8.
Inactive catalog products cannot be added to a new quotation.

9.
A contact must belong to the selected company.

10.
A deal must belong to the selected company.

11.
A quotation must belong to the selected company and, if associated, to the selected deal.

12.
Activity and task records must preserve their creator and timestamps.

13.
Every ownership-changing or approval-sensitive action must create an audit entry.

14.
Users must not be able to access another team’s private notes or quotes without permission.

15.
All server mutations must validate IDs, dates, statuses, numeric ranges, and text lengths.

16.
Never store card data, API keys, client secrets, or raw authentication payloads.




Demo Data

Create a reproducible demo seed or documented demo setup with:

•
One sales representative.

•
One sales manager.

•
One administrator.

•
Multiple fictional companies.

•
Contacts for each company.

•
Leads in different statuses.

•
Deals across every pipeline stage.

•
Open, overdue, and completed tasks.

•
Activities across several dates.

•
Product/service catalog entries priced in AED.

•
Draft, pending approval, sent, accepted, rejected, and expired quotations.

Clearly label all seed data as demo data. Do not seed customer reviews, testimonials, star ratings, or other fabricated user-generated content.




Testing Requirements

Write unit and server-level tests for:

•
Role and ownership authorization.

•
Company/contact relationship validation.

•
Lead conversion without duplicate company creation.

•
Deal stage transition rules.

•
Lost reason requirement.

•
Quotation subtotal, discount, tax, and total calculations.

•
Inactive catalog product rejection.

•
Quotation line-item price snapshots.

•
Quotation status transitions.

•
Task completion and overdue classification.

•
Audit log creation for sensitive actions.

•
Manager versus sales representative visibility.

Run type-checking, tests, and production build before considering the implementation complete.




Documentation Requirements

Update the project documentation with:

•
Product overview.

•
Core personas and permission matrix.

•
Domain model and relationship diagram.

•
Route and page map.

•
Pipeline state machine.

•
Quotation calculation rules.

•
Security and authorization model.

•
Demo accounts and seed instructions.

•
Testing instructions.

•
Local development instructions.

•
Deployment configuration.

•
Known limitations and future improvements.

Include a portfolio-oriented section titled Implementation Highlights that explains the most impressive engineering decisions in concise language.




Delivery Checklist

Before delivery, verify that:

•
The app opens on a polished CRM dashboard.

•
A user can navigate from a company to a contact, deal, activity, task, and quotation without losing context.

•
The pipeline is understandable at a glance.

•
The quotation builder calculates totals correctly.

•
Server-side authorization is enforced.

•
Demo data can be recreated.

•
Empty, loading, error, validation, unauthorized, and success states are present.

•
The interface is responsive and accessible.

•
Type-checking passes.

•
All tests pass.

•
The production build succeeds.

•
Documentation is complete.

•
No fake testimonials, reviews, ratings, or endorsements are included.

Do not stop at static mockups. Build the working data flow, server procedures, authorization boundaries, business rules, and portfolio-ready interface end to end.

