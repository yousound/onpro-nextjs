"use client";

import { useState } from "react";
import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerProgressPair } from "@/components/ledger/ledger-progress-pair";
import { LedgerWorkAccounting } from "@/components/ledger/ledger-work-accounting";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerTable } from "@/components/ledger/ledger-table";
import { formatUsd } from "@/lib/ledger/format";
import type { InvoiceKind, LedgerProjectId } from "@/lib/ledger/types";

export function LedgerInvoiceList({ filterProject }: { filterProject?: LedgerProjectId }) {
  const { state, markInvoicePaid, addInvoice } = useLedger();
  const [showAdd, setShowAdd] = useState(false);
  const [dateLabel, setDateLabel] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState<LedgerProjectId>("onpro");
  const [kind, setKind] = useState<InvoiceKind>("retainer");

  const invoices = filterProject
    ? state.invoices.filter((i) => i.projectId === filterProject)
    : state.invoices;

  const submitAdd = () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!dateLabel.trim() || !label.trim() || Number.isNaN(cents) || cents <= 0) return;
    addInvoice({ dateLabel: dateLabel.trim(), label: label.trim(), amountCents: cents, projectId, kind });
    setShowAdd(false);
    setDateLabel("");
    setLabel("");
    setAmount("");
  };

  return (
    <>
      <LedgerProgressPair />
      <LedgerSection
        title="Invoices"
        action={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Add invoice
          </button>
        }
      >
        <LedgerTable headers={["Date", "Description", "Amount", "Project", "Status", ""]}>
          {invoices.map((inv) => (
            <tr key={inv.id} className="text-text-primary">
              <td className="px-3 py-3 first:pl-0">{inv.dateLabel}</td>
              <td className="px-3 py-3">{inv.label}</td>
              <td className="px-3 py-3 tabular-nums font-medium">{formatUsd(inv.amountCents)}</td>
              <td className="px-3 py-3 uppercase text-xs text-text-secondary">{inv.projectId}</td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    inv.status === "paid"
                      ? "bg-health-ok/15 text-health-ok"
                      : "bg-health-warn/15 text-health-warn"
                  }`}
                >
                  {inv.status === "paid" ? "Paid" : "Pending"}
                </span>
              </td>
              <td className="px-3 py-3 text-right last:pr-0">
                {inv.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => markInvoicePaid(inv.id)}
                    className="rounded-lg bg-health-ok px-3 py-1.5 text-xs font-semibold text-white hover:bg-health-ok/90"
                  >
                    Mark paid
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </LedgerTable>
      </LedgerSection>

      <LedgerWorkAccounting filterProject={filterProject} />

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Add invoice</h3>
            <div className="mt-4 space-y-3">
              <input
                placeholder="Date label (e.g. Aug 2026)"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              />
              <input
                placeholder="Description"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              />
              <input
                placeholder="Amount (USD)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              />
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value as LedgerProjectId)}
                className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              >
                <option value="onpro">OnPro</option>
                <option value="fbrc">FBRC</option>
                <option value="dropx">DROPX</option>
              </select>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as InvoiceKind)}
                className="w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              >
                <option value="retainer">Retainer</option>
                <option value="transfer">Transfer</option>
                <option value="milestone">Milestone</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-surface-body"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdd}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
