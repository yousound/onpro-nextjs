"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/components/profile-provider";
import { useEnsureContactsLoaded } from "@/lib/use-ensure-contacts-loaded";
import type { CurrentUserDisplay } from "@/lib/current-user-display";
import type { Contact } from "@/lib/types/contact";
import {
  contactDisplayName,
  contactsForSegment,
  loadContacts,
  vendorContacts,
  vendorDisplayName,
} from "@/lib/contacts-store";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";

export function useProjectVendors(): Contact[] {
  const tick = useEnsureContactsLoaded();
  return useMemo(() => vendorContacts(loadContacts()), [tick]);
}

export function useProjectTeam(): Contact[] {
  const tick = useEnsureContactsLoaded();
  return useMemo(() => contactsForSegment(loadContacts(), "team"), [tick]);
}

/** Signed-in operator row for team pickers — profile name wins over stale CRM text. */
export function resolveOwnerTeamContact(
  user: CurrentUserDisplay | null,
  team: Contact[],
): Contact | null {
  if (!user?.email?.trim()) return null;
  const email = user.email.trim().toLowerCase();
  const profileName = user.fullName.trim() || email.split("@")[0] || "You";
  const existing =
    (user.selfContactId ? team.find((c) => c.id === user.selfContactId) : undefined) ??
    team.find((c) => c.email.trim().toLowerCase() === email);

  if (existing) {
    return {
      ...existing,
      name: profileName,
      contact_name: profileName,
    };
  }

  return {
    id: user.selfContactId ?? `self-${user.id}`,
    segment: "team",
    kind: "individual",
    company_code: "",
    name: profileName,
    contact_name: profileName,
    email: user.email.trim(),
    member_contact_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Owner first, then the rest of the team directory (no alphabetical reorder). */
export function teamContactsWithSelf(team: Contact[], user: CurrentUserDisplay | null): Contact[] {
  const owner = resolveOwnerTeamContact(user, team);
  if (!owner) return team;
  const ownerEmail = owner.email.trim().toLowerCase();
  const rest = team.filter(
    (c) => c.id !== owner.id && c.email.trim().toLowerCase() !== ownerEmail,
  );
  return [owner, ...rest];
}

export function ownerTeamContactDefaults(
  user: CurrentUserDisplay | null,
  team: Contact[],
): { name: string; email: string } | null {
  const owner = resolveOwnerTeamContact(user, team);
  if (!owner) return null;
  return { name: contactDisplayName(owner), email: owner.email.trim() };
}

export function defaultTeamContactFromUser(
  user: CurrentUserDisplay | null,
): { name: string; email: string } | null {
  return ownerTeamContactDefaults(user, []);
}

function teamSearchOptions(team: Contact[]): SearchableSelectOption[] {
  const seen = new Set<string>();
  const options: SearchableSelectOption[] = [];
  for (const c of team) {
    const name = contactDisplayName(c);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      value: name,
      label: name,
      sublabel: c.email,
      keywords: [c.email, c.team_role, c.contact_name].filter(Boolean).join(" "),
    });
  }
  return options;
}

export function vendorNameOptions(vendors: Contact[]): string[] {
  const names = vendors.map((v) => vendorDisplayName(v));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function vendorSelectBindings(value: string | null | undefined, options: string[]) {
  const current = value?.trim() ?? "";
  const match = options.find((n) => n.toLowerCase() === current.toLowerCase());
  const inList = Boolean(match);
  const selectValue = inList ? match! : "";
  return { selectValue, inList, current };
}

const stealthWrapClass =
  "rounded-xl border border-border-light bg-surface-body/40 px-4 py-3";

const stealthLabelClass = "min-w-0 flex-1 text-sm font-medium text-text-secondary";

const fieldLabelClass = "block text-xs font-medium text-text-secondary";

function vendorSearchOptions(vendors: Contact[]): SearchableSelectOption[] {
  return vendorNameOptions(vendors).map((name) => {
    const v = vendors.find((c) => vendorDisplayName(c) === name);
    return {
      value: name,
      label: name,
      sublabel: v?.company_code ? `Code ${v.company_code}` : undefined,
      keywords: [v?.email, v?.company_code, v?.contact_name].filter(Boolean).join(" "),
    };
  });
}

export function VendorStealthSelect({
  label,
  vendors,
  value,
  onCommit,
  emptyLabel = "Select vendor…",
}: {
  label: string;
  vendors: Contact[];
  value: string | null | undefined;
  onCommit: (next: string | null) => void;
  emptyLabel?: string;
}) {
  const options = useMemo(() => vendorSearchOptions(vendors), [vendors]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options.map((o) => o.value));

  return (
    <div className={stealthWrapClass}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={stealthLabelClass}>{label}</span>
        <div className="min-w-[12rem] flex-1">
          <SearchableSelect
            label="Vendor"
            labelClassName="sr-only"
            options={options}
            value={selectValue}
            savedLabel={!inList && current ? current : null}
            placeholder={emptyLabel}
            emptyMessage="No vendors match"
            variant="field"
            onChange={(name) => onCommit(name)}
            onClear={() => onCommit(null)}
          />
        </div>
      </div>
    </div>
  );
}

export function TeamFieldSelect({
  label,
  team: teamProp,
  value,
  onChange,
  emptyLabel = "Select team member…",
  labelClassName = fieldLabelClass,
}: {
  label: string;
  team: Contact[];
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  emptyLabel?: string;
  labelClassName?: string;
}) {
  const user = useCurrentUser();
  const team = useMemo(() => teamContactsWithSelf(teamProp, user), [teamProp, user]);
  const options = useMemo(() => teamSearchOptions(team), [team]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options.map((o) => o.value));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={selectValue}
      savedLabel={!inList && current ? current : null}
      placeholder={emptyLabel}
      emptyMessage={
        team.length === 0 ? "No team members yet — tap + Add" : "No team members match"
      }
      listClassName="absolute z-[260] mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      commitOnBlur
      labelClassName={labelClassName}
      onChange={(name) => onChange(name)}
      onClear={() => onChange(null)}
    />
  );
}

export function VendorFieldSelect({
  label,
  vendors,
  value,
  onChange,
  emptyLabel = "Select vendor…",
  labelClassName = fieldLabelClass,
}: {
  label: string;
  vendors: Contact[];
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  emptyLabel?: string;
  labelClassName?: string;
}) {
  const options = useMemo(() => vendorSearchOptions(vendors), [vendors]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options.map((o) => o.value));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={selectValue}
      savedLabel={!inList && current ? current : null}
      placeholder={emptyLabel}
      emptyMessage={vendors.length === 0 ? "No vendors yet — tap + Add" : "No vendors match"}
      listClassName="absolute z-[260] mt-1 w-full max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      commitOnBlur
      labelClassName={labelClassName}
      onChange={(name) => onChange(name)}
      onClear={() => onChange(null)}
    />
  );
}
