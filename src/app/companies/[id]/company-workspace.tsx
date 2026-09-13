"use client";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Send,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { type RouterOutputs, api } from "~/trpc/react";

type Workspace = RouterOutputs["companies"]["byId"];
type Contact = Workspace["contacts"][number];

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-AE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const activityTypes = [
  "call",
  "meeting",
  "email",
  "messaging",
  "note",
  "demo",
  "quotation_sent",
  "status_change",
] as const;
const channels = ["email", "phone", "whatsapp", "sms", "other"] as const;
const contactStatuses = ["active", "inactive"] as const;

function Badge({
  children,
  tone = "gold",
}: {
  children: React.ReactNode;
  tone?: "gold" | "green" | "muted";
}) {
  const styles = {
    gold: "bg-[#e6d7af] text-[#6c4b0a]",
    green: "bg-[#dce8df] text-[#205443]",
    muted: "bg-[#eceae3] text-[#65736b]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[#d8d1c4] px-4 py-8 text-center text-sm text-[#849088]">
      {text}
    </p>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-[1500px] animate-pulse space-y-6 px-5 py-8 sm:px-8">
      <div className="h-5 w-40 rounded bg-[#e5e1d8]" />
      <div className="h-48 rounded-2xl bg-white/70" />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="h-96 rounded-2xl bg-white/70" />
        <div className="h-96 rounded-2xl bg-white/70" />
      </div>
    </div>
  );
}

export function CompanyWorkspace({ companyId }: { companyId: number }) {
  const query = api.companies.byId.useQuery({ id: companyId });
  const utils = api.useUtils();
  const [contactDialog, setContactDialog] = useState(false);
  const [dealDialog, setDealDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    preferredCommunicationChannel: "email",
    isDecisionMaker: false,
    status: "active",
    notes: "",
  });
  const [activityForm, setActivityForm] = useState({
    type: "call",
    subject: "",
    body: "",
    occurredAt: new Date().toISOString().slice(0, 16),
    contactId: "none",
    dealId: "none",
    completed: true,
  });
  const [dealForm, setDealForm] = useState({
    name: "",
    amount: "",
    expectedCloseDate: "",
  });

  const invalidate = async () => {
    await Promise.all([
      utils.companies.byId.invalidate({ id: companyId }),
      utils.companies.list.invalidate(),
    ]);
  };
  const contactMutation = api.contacts.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setContactDialog(false);
      toast.success("Contact added");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateContactMutation = api.contacts.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setContactDialog(false);
      toast.success("Contact updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const activityMutation = api.activities.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setActivityForm((current) => ({ ...current, subject: "", body: "" }));
      toast.success("Activity logged");
    },
    onError: (error) => toast.error(error.message),
  });
  const dealMutation = api.deals.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDealDialog(false);
      setDealForm({ name: "", amount: "", expectedCloseDate: "" });
      toast.success("Deal created");
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <WorkspaceSkeleton />;
  if (query.isError || !query.data)
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-[#718078]">
        This company is unavailable or you do not have permission to view it.
      </div>
    );
  const company = query.data;

  function openNewContact() {
    setEditingContact(null);
    setContactForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      preferredCommunicationChannel: "email",
      isDecisionMaker: false,
      status: "active",
      notes: "",
    });
    setContactDialog(true);
  }
  function openEditContact(contact: Contact) {
    setEditingContact(contact);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      preferredCommunicationChannel:
        contact.preferredCommunicationChannel ?? "email",
      isDecisionMaker: contact.isDecisionMaker,
      status: contact.status,
      notes: contact.notes ?? "",
    });
    setContactDialog(true);
  }
  function submitContact(event: React.FormEvent) {
    event.preventDefault();
    const input = {
      ...contactForm,
      companyId,
      preferredCommunicationChannel:
        contactForm.preferredCommunicationChannel as (typeof channels)[number],
      status: contactForm.status as (typeof contactStatuses)[number],
      email: contactForm.email || undefined,
      phone: contactForm.phone || undefined,
      notes: contactForm.notes || undefined,
    };
    if (editingContact)
      updateContactMutation.mutate({ ...input, id: editingContact.id });
    else contactMutation.mutate(input);
  }
  function submitActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!activityForm.subject.trim()) return toast.error("Subject is required");
    activityMutation.mutate({
      companyId,
      type: activityForm.type as (typeof activityTypes)[number],
      subject: activityForm.subject,
      body: activityForm.body || undefined,
      occurredAt: new Date(activityForm.occurredAt),
      contactId:
        activityForm.contactId === "none"
          ? undefined
          : Number(activityForm.contactId),
      dealId:
        activityForm.dealId === "none"
          ? undefined
          : Number(activityForm.dealId),
      completed: activityForm.completed,
    });
  }
  function submitDeal(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(dealForm.amount);
    if (!dealForm.name.trim() || Number.isNaN(amount) || amount < 0)
      return toast.error("Enter a deal name and a valid amount");
    dealMutation.mutate({
      companyId,
      name: dealForm.name,
      amount,
      expectedCloseDate: dealForm.expectedCloseDate
        ? new Date(dealForm.expectedCloseDate)
        : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-5 py-8 sm:px-8">
      <div className="flex items-center gap-2 text-sm text-[#718078]">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 hover:text-[#17342c]"
        >
          <ArrowLeft className="size-4" /> Companies
        </Link>
        <ChevronRight className="size-4" />
        <span className="truncate text-[#17342c]">{company.legalName}</span>
      </div>
      <Card className="border-0 bg-white/85 shadow-[0_12px_32px_rgba(42,55,45,0.06)]">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row">
            <div className="flex gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#dce8df] text-[#205443]">
                <Building2 className="size-7" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-[#17342c]">
                    {company.legalName}
                  </h1>
                  <Badge>{company.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#718078]">
                  <span>{company.industry ?? "Industry not set"}</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" />
                    {company.city ?? company.country ?? "Location not set"}
                  </span>
                  {company.website && (
                    <a
                      className="inline-flex items-center gap-1 text-[#26705b] hover:underline"
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openNewContact}>
                <Plus className="mr-2 size-4" /> Add contact
              </Button>
              <Button variant="outline" onClick={() => setDealDialog(true)}>
                <CircleDollarSign className="mr-2 size-4" /> Create deal
              </Button>
              <Button
                className="bg-[#173f34] text-white hover:bg-[#245b4b]"
                onClick={() =>
                  document
                    .getElementById("activity-composer")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Send className="mr-2 size-4" /> Log activity
              </Button>
              <Link
                href="/quotations"
                className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-[#53655c] hover:bg-[#eceae3]"
              >
                Create quotation
              </Link>
            </div>
          </div>
          <div className="mt-7 grid gap-4 border-t border-[#eee9df] pt-6 sm:grid-cols-4">
            <div>
              <p className="text-xs tracking-wider text-[#849088] uppercase">
                Annual value
              </p>
              <p className="mt-1 font-semibold text-[#17342c]">
                {currency.format(company.estimatedAnnualValue)}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wider text-[#849088] uppercase">
                Owner
              </p>
              <p className="mt-1 flex items-center gap-2 font-medium text-[#53655c]">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#dce8df] text-[10px] font-semibold text-[#205443]">
                  {(company.ownerName ?? "U").slice(0, 2).toUpperCase()}
                </span>
                {company.ownerName ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wider text-[#849088] uppercase">
                Tax number
              </p>
              <p className="mt-1 text-sm text-[#53655c]">
                {company.taxVatNumber ?? "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs tracking-wider text-[#849088] uppercase">
                Company size
              </p>
              <p className="mt-1 text-sm text-[#53655c]">
                {company.companySize ?? "Not set"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card className="border-0 bg-white/85 shadow-[0_12px_32px_rgba(42,55,45,0.05)]">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>
                  People connected to this account.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={openNewContact}>
                <Plus className="mr-2 size-4" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 ? (
                <EmptySection text="No contacts yet. Add the first person for this account." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#eee9df] text-xs tracking-wider text-[#849088] uppercase">
                      <tr>
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Role</th>
                        <th className="pb-3 font-medium">Contact</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eee9df]">
                      {company.contacts.map((contact) => (
                        <tr key={contact.id}>
                          <td className="py-4 font-medium text-[#17342c]">
                            {contact.firstName} {contact.lastName}
                            {contact.isDecisionMaker && (
                              <span className="ml-2 text-xs text-[#9a7a31]">
                                Decision maker
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-[#718078]">
                            {contact.jobTitle ?? "—"}
                          </td>
                          <td className="py-4 text-[#718078]">
                            {contact.email ?? contact.phone ?? "—"}
                          </td>
                          <td className="py-4">
                            <Badge
                              tone={
                                contact.status === "active" ? "green" : "muted"
                              }
                            >
                              {contact.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-right">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Edit ${contact.firstName}`}
                              onClick={() => openEditContact(contact)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/85 shadow-[0_12px_32px_rgba(42,55,45,0.05)]">
            <CardHeader>
              <CardTitle>Active deals</CardTitle>
              <CardDescription>
                Open opportunities connected to this account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.activeDeals.length === 0 ? (
                <EmptySection text="No active deals for this company." />
              ) : (
                company.activeDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-[#fbfaf7] p-4"
                  >
                    <div>
                      <p className="font-medium text-[#17342c]">{deal.name}</p>
                      <p className="mt-1 text-xs text-[#718078]">
                        {deal.stageName ?? "Unstaged"} · {deal.probability}%
                        probability
                      </p>
                    </div>
                    <p className="font-semibold text-[#17342c]">
                      {currency.format(deal.amount)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/85 shadow-[0_12px_32px_rgba(42,55,45,0.05)]">
            <CardHeader>
              <CardTitle>Quotations</CardTitle>
              <CardDescription>
                Commercial documents for this account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.quotations.length === 0 ? (
                <EmptySection text="No quotations have been created yet." />
              ) : (
                company.quotations.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-[#fbfaf7] p-4"
                  >
                    <div>
                      <p className="font-medium text-[#17342c]">
                        {quote.quoteNumber}
                      </p>
                      <p className="mt-1 text-xs text-[#718078]">
                        Valid until{" "}
                        {quote.validUntil
                          ? dateFormatter.format(
                              new Date(`${quote.validUntil}T00:00:00`),
                            )
                          : "not set"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        tone={quote.status === "accepted" ? "green" : "gold"}
                      >
                        {quote.status.replace("_", " ")}
                      </Badge>
                      <p className="mt-2 font-semibold text-[#17342c]">
                        {currency.format(quote.total)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            id="activity-composer"
            className="border-0 bg-[#173f34] text-[#f7f5ef] shadow-[0_12px_32px_rgba(42,55,45,0.12)]"
          >
            <CardHeader>
              <CardTitle className="text-[#f7f5ef]">Log activity</CardTitle>
              <CardDescription className="text-[#b7c9bf]">
                Capture the next meaningful touchpoint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitActivity}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[#d9e4dc]">Type</Label>
                    <Select
                      value={activityForm.type}
                      onValueChange={(value) =>
                        setActivityForm((current) => ({
                          ...current,
                          type: value ?? "call",
                        }))
                      }
                    >
                      <SelectTrigger className="border-white/15 bg-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activityTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#d9e4dc]">Occurred at</Label>
                    <Input
                      className="border-white/15 bg-white/10 text-white"
                      type="datetime-local"
                      value={activityForm.occurredAt}
                      onChange={(event) =>
                        setActivityForm((current) => ({
                          ...current,
                          occurredAt: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#d9e4dc]" htmlFor="activity-subject">
                    Subject
                  </Label>
                  <Input
                    id="activity-subject"
                    className="border-white/15 bg-white/10 text-white placeholder:text-[#b7c9bf]"
                    placeholder="What happened?"
                    value={activityForm.subject}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#d9e4dc]">Related contact</Label>
                  <Select
                    value={activityForm.contactId}
                    onValueChange={(value) =>
                      setActivityForm((current) => ({
                        ...current,
                        contactId: value ?? "none",
                      }))
                    }
                  >
                    <SelectTrigger className="border-white/15 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No contact</SelectItem>
                      {company.contacts.map((contact) => (
                        <SelectItem key={contact.id} value={String(contact.id)}>
                          {contact.firstName} {contact.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#d9e4dc]">Notes</Label>
                  <Textarea
                    className="border-white/15 bg-white/10 text-white placeholder:text-[#b7c9bf]"
                    value={activityForm.body}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                  />
                </div>
                <Button
                  className="w-full bg-[#d9a441] text-[#17342c] hover:bg-[#e5c36d]"
                  disabled={activityMutation.isPending}
                  type="submit"
                >
                  {activityMutation.isPending ? "Saving..." : "Save activity"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/85 shadow-[0_12px_32px_rgba(42,55,45,0.05)]">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                The latest history for this company.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {company.activities.length === 0 ? (
                <EmptySection text="No activity has been logged yet." />
              ) : (
                <div className="space-y-5">
                  {company.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#d9a441]" />
                      <div>
                        <p className="text-sm font-medium text-[#17342c]">
                          {activity.subject}
                        </p>
                        <p className="mt-1 text-xs text-[#718078]">
                          {activity.type.replace("_", " ")} ·{" "}
                          {activity.creatorName ?? "Unknown"} ·{" "}
                          {dateFormatter.format(new Date(activity.activityAt))}
                        </p>
                        {activity.body && (
                          <p className="mt-2 text-sm leading-5 text-[#53655c]">
                            {activity.body}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-0 bg-white/85 shadow-[0_12px_32px_rgba(42,55,45,0.05)]">
            <CardHeader>
              <CardTitle>Open tasks</CardTitle>
              <CardDescription>
                Follow-ups that still need attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {company.openTasks.length === 0 ? (
                <EmptySection text="No open tasks for this company." />
              ) : (
                company.openTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-xl bg-[#fbfaf7] p-3"
                  >
                    <Clock3 className="size-4 text-[#9a7a31]" />
                    <div>
                      <p className="text-sm font-medium text-[#17342c]">
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs text-[#718078]">
                        {task.dueAt
                          ? dateFormatter.format(new Date(task.dueAt))
                          : "No due date"}{" "}
                        · {task.priority}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={contactDialog} onOpenChange={setContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Edit contact" : "Add contact"}
            </DialogTitle>
            <DialogDescription>
              Keep the people behind this account current.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submitContact}>
            <div className="space-y-2">
              <Label>First name *</Label>
              <Input
                value={contactForm.firstName}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last name *</Label>
              <Input
                value={contactForm.lastName}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={contactForm.email}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={contactForm.phone}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred channel</Label>
              <Select
                value={contactForm.preferredCommunicationChannel}
                onValueChange={(value) =>
                  setContactForm((current) => ({
                    ...current,
                    preferredCommunicationChannel: value ?? "email",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={contactForm.status}
                onValueChange={(value) =>
                  setContactForm((current) => ({
                    ...current,
                    status: value ?? "active",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contactStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#53655c] sm:col-span-2">
              <input
                type="checkbox"
                checked={contactForm.isDecisionMaker}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    isDecisionMaker: event.target.checked,
                  }))
                }
              />{" "}
              Decision maker
            </label>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={contactForm.notes}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setContactDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  contactMutation.isPending || updateContactMutation.isPending
                }
              >
                {editingContact ? "Save changes" : "Add contact"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dealDialog} onOpenChange={setDealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create deal</DialogTitle>
            <DialogDescription>
              Start a new opportunity in the first pipeline stage.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitDeal}>
            <div className="space-y-2">
              <Label>Deal name *</Label>
              <Input
                value={dealForm.name}
                onChange={(event) =>
                  setDealForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (AED) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={dealForm.amount}
                onChange={(event) =>
                  setDealForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Expected close date</Label>
              <Input
                type="date"
                value={dealForm.expectedCloseDate}
                onChange={(event) =>
                  setDealForm((current) => ({
                    ...current,
                    expectedCloseDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDealDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={dealMutation.isPending}>
                {dealMutation.isPending ? "Creating..." : "Create deal"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
