"use client";

import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { api } from "~/trpc/react";

const currency = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-AE", {
  day: "numeric",
  month: "short",
});
const companyStatuses = [
  "prospect",
  "qualified",
  "customer",
  "inactive",
] as const;

type FormState = {
  name: string;
  website: string;
  country: string;
  city: string;
  industry: string;
  size: string;
  status: (typeof companyStatuses)[number];
  estimatedAnnualValue: string;
  taxNumber: string;
  notes: string;
};

const initialForm: FormState = {
  name: "",
  website: "",
  country: "United Arab Emirates",
  city: "",
  industry: "",
  size: "",
  status: "prospect",
  estimatedAnnualValue: "",
  taxNumber: "",
  notes: "",
};

function relativeDate(value: Date | string | null) {
  if (!value) return "No activity yet";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return dateFormatter.format(new Date(value));
}

function initials(name: string | null) {
  return (name ?? "Unassigned")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-[#e6d7af] px-2.5 py-1 text-xs font-semibold text-[#6c4b0a] capitalize">
      {status}
    </span>
  );
}

export function CompaniesView() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [ownerId, setOwnerId] = useState("all");
  const [sortBy, setSortBy] = useState<
    "latest_activity" | "estimated_value" | "created_at"
  >("latest_activity");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const listQuery = api.companies.list.useQuery({
    search,
    status:
      status === "all"
        ? undefined
        : (status as (typeof companyStatuses)[number]),
    ownerId: ownerId === "all" ? undefined : ownerId,
    sortBy,
  });
  const utils = api.useUtils();
  const createCompany = api.companies.create.useMutation({
    onSuccess: async () => {
      await utils.companies.list.invalidate();
      setDialogOpen(false);
      setForm(initialForm);
      setErrors({});
      toast.success("Company created successfully");
    },
    onError: (error) => {
      setErrors({ form: error.message });
    },
  });

  const rows = listQuery.data ?? [];
  const owners = Array.from(
    new Map(
      rows
        .filter((row) => row.ownerId)
        .map((row) => [row.ownerId, row.ownerName]),
    ).entries(),
  );

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setOwnerId("all");
  }

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const annualValue = Number(form.estimatedAnnualValue);
    if (!form.name.trim()) nextErrors.name = "Company name is required.";
    if (form.website && !/^https?:\/\/.+/.test(form.website))
      nextErrors.website = "Use a complete URL, such as https://example.com.";
    if (
      !form.estimatedAnnualValue ||
      Number.isNaN(annualValue) ||
      annualValue < 0
    )
      nextErrors.estimatedAnnualValue = "Enter a value of zero or more.";
    if (form.notes.length > 2000)
      nextErrors.notes = "Notes must be 2,000 characters or fewer.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    createCompany.mutate({
      ...form,
      estimatedAnnualValue: annualValue,
      size: form.size || undefined,
      website: form.website || undefined,
      country: form.country || undefined,
      city: form.city || undefined,
      industry: form.industry || undefined,
      taxNumber: form.taxNumber || undefined,
      notes: form.notes || undefined,
    });
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold tracking-[0.18em] text-[#9a7a31] uppercase">
            Account directory
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#17342c] sm:text-4xl">
            Companies
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#718078]">
            Keep every account, owner, and commercial signal easy to find.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 bg-[#173f34] text-[#f7f5ef] hover:bg-[#245b4b]">
                <Plus className="size-4" /> New company
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New company</DialogTitle>
              <DialogDescription>
                Add a company account to your Dealflow workspace.
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company-name">Company name *</Label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                />
                {errors.name && (
                  <p className="text-xs text-red-700">{errors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-industry">Industry</Label>
                <Input
                  id="company-industry"
                  value={form.industry}
                  onChange={(event) =>
                    updateForm("industry", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-size">Company size</Label>
                <Input
                  id="company-size"
                  placeholder="51-200"
                  value={form.size}
                  onChange={(event) => updateForm("size", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-city">City</Label>
                <Input
                  id="company-city"
                  value={form.city}
                  onChange={(event) => updateForm("city", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-country">Country</Label>
                <Input
                  id="company-country"
                  value={form.country}
                  onChange={(event) =>
                    updateForm("country", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-website">Website</Label>
                <Input
                  id="company-website"
                  placeholder="https://example.com"
                  value={form.website}
                  onChange={(event) =>
                    updateForm("website", event.target.value)
                  }
                />
                {errors.website && (
                  <p className="text-xs text-red-700">{errors.website}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-tax">Tax / VAT number</Label>
                <Input
                  id="company-tax"
                  value={form.taxNumber}
                  onChange={(event) =>
                    updateForm("taxNumber", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    updateForm("status", value ?? "prospect")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companyStatuses.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-value">
                  Estimated annual value (AED) *
                </Label>
                <Input
                  id="company-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedAnnualValue}
                  onChange={(event) =>
                    updateForm("estimatedAnnualValue", event.target.value)
                  }
                />
                {errors.estimatedAnnualValue && (
                  <p className="text-xs text-red-700">
                    {errors.estimatedAnnualValue}
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="company-notes">Notes</Label>
                <Textarea
                  id="company-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                />
                {errors.notes && (
                  <p className="text-xs text-red-700">{errors.notes}</p>
                )}
              </div>
              {errors.form && (
                <p className="text-sm text-red-700 sm:col-span-2">
                  {errors.form}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createCompany.isPending}>
                  {createCompany.isPending ? "Creating..." : "Create company"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </section>

      <section className="rounded-2xl border border-[#e4ded2] bg-white/65 p-3 shadow-[0_12px_32px_rgba(42,55,45,0.04)] sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#849088]" />
            <Input
              className="border-[#ded8ca] bg-[#fbfaf7] pl-9"
              placeholder="Search companies, industry, city..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value ?? "all")}
          >
            <SelectTrigger className="border-[#ded8ca] bg-[#fbfaf7]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {companyStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ownerId}
            onValueChange={(value) => setOwnerId(value ?? "all")}
          >
            <SelectTrigger className="border-[#ded8ca] bg-[#fbfaf7]">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map(([id, name]) => (
                <SelectItem key={id} value={id!}>
                  {name ?? "Unnamed owner"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(value) =>
              setSortBy((value ?? "latest_activity") as typeof sortBy)
            }
          >
            <SelectTrigger className="border-[#ded8ca] bg-[#fbfaf7]">
              <SlidersHorizontal className="mr-2 size-4 text-[#849088]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest_activity">Latest activity</SelectItem>
              <SelectItem value="estimated_value">Estimated value</SelectItem>
              <SelectItem value="created_at">Created date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {listQuery.isLoading ? (
        <div className="grid animate-pulse gap-3">
          <div className="h-16 rounded-xl bg-white/70" />
          <div className="h-16 rounded-xl bg-white/70" />
          <div className="h-16 rounded-xl bg-white/70" />
        </div>
      ) : listQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Unable to load companies. Please refresh and try again.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cfc8b9] bg-white/55 px-6 py-16 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#edf2eb] text-[#26705b]">
            <Search />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#17342c]">
            No companies match those filters
          </h2>
          <p className="mt-2 text-sm text-[#718078]">
            Try a broader search or clear the filters to see the full directory.
          </p>
          <Button
            className="mt-5 gap-2"
            variant="outline"
            onClick={clearFilters}
          >
            <X className="size-4" /> Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-[#e4ded2] bg-white/80 shadow-[0_12px_32px_rgba(42,55,45,0.05)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e4ded2] text-xs tracking-wider text-[#849088] uppercase">
                <tr>
                  <th className="px-5 py-4 font-medium">Company</th>
                  <th className="px-4 py-4 font-medium">Industry</th>
                  <th className="px-4 py-4 font-medium">Owner</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 text-right font-medium">
                    Annual value
                  </th>
                  <th className="px-5 py-4 text-right font-medium">
                    Last activity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9df]">
                {rows.map((company) => (
                  <tr
                    key={company.id}
                    className="cursor-pointer transition-colors hover:bg-[#fbfaf7]"
                    onClick={() => router.push(`/companies/${company.id}`)}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/companies/${company.id}`}
                        className="font-semibold text-[#17342c] underline-offset-4 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#d9a441] focus-visible:outline-none"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {company.legalName}
                      </Link>
                      <p className="mt-1 text-xs text-[#849088]">
                        /{company.slug}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-[#53655c]">
                      {company.industry ?? "—"}
                      <br />
                      <span className="text-xs text-[#849088]">
                        {company.city ?? company.country ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-full bg-[#dce8df] text-xs font-semibold text-[#12352d]">
                          {initials(company.ownerName)}
                        </span>
                        <span className="text-[#53655c]">
                          {company.ownerName ?? "Unassigned"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={company.status} />
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-[#17342c]">
                      {currency.format(company.estimatedAnnualValue)}
                    </td>
                    <td className="px-5 py-4 text-right text-[#718078]">
                      {relativeDate(company.lastActivityDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((company) => (
              <article
                key={company.id}
                className="cursor-pointer rounded-2xl bg-white/85 p-4 shadow-[0_10px_24px_rgba(42,55,45,0.05)] transition-colors hover:bg-[#fbfaf7]"
                onClick={() => router.push(`/companies/${company.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-semibold text-[#17342c] underline-offset-4 hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[#d9a441] focus-visible:outline-none"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {company.legalName}
                    </Link>
                    <p className="mt-1 text-xs text-[#849088]">
                      {company.industry ?? "General"} · {company.city ?? "UAE"}
                    </p>
                  </div>
                  <StatusBadge status={company.status} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[#849088]">Owner</p>
                    <p className="mt-1 text-[#53655c]">
                      {company.ownerName ?? "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#849088]">Annual value</p>
                    <p className="mt-1 font-semibold text-[#17342c]">
                      {currency.format(company.estimatedAnnualValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#849088]">Contacts</p>
                    <p className="mt-1 text-[#53655c]">
                      {company.contactsCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#849088]">Last activity</p>
                    <p className="mt-1 text-[#53655c]">
                      {relativeDate(company.lastActivityDate)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
