"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { getProjects } from "@/lib/mock/projects";
import { mergeProjectLists, readSessionProjects } from "@/lib/mock/project-session";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import { formatShortDate } from "@/lib/format";
import { WipProgressSummary } from "@/components/wip-timeline";
import { JobDetailsModal } from "@/components/job-details-modal";
import { normalizeJob } from "@/lib/job-defaults";
import { clientCodeByName } from "@/lib/reference/client-codes";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import { JOB_WIP_COLUMNS, formatJobWipCell } from "@/lib/job-wip-columns";

export type ProductionJobRow = ProjectJob & {
  projectName: string;
  clientName: string;
};

function parseInspectJob(raw: string | null): { projectId: number; jobId: string } | null {
  if (!raw) return null;
  const [pid, jid] = raw.split(":");
  const projectId = Number(pid);
  if (!Number.isFinite(projectId) || !jid) return null;
  return { projectId, jobId: jid };
}

function rowKey(row: Pick<ProductionJobRow, "project_id" | "id">): string {
  return `${row.project_id}:${row.id}`;
}

export function ProductionBoard({ projects: projectsProp }: { projects: Project[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modalJob, setModalJob] = useState<{ project: Project; job: ProjectJob } | null>(null);

  const projects = useMemo(
    () => mergeProjectLists(projectsProp.length ? projectsProp : getProjects(), readSessionProjects()),
    [projectsProp],
  );

  const jobRows = useMemo(() => {
    const rows: ProductionJobRow[] = [];
    for (const p of projects) {
      for (const j of loadProjectJobs(p.id, p)) {
        rows.push({
          ...j,
          projectName: p.name,
          clientName: p.client.name,
        });
      }
    }
    return rows;
  }, [projects]);

  const vendors = useMemo(() => vendorContacts(loadContacts()), []);

  const openRowKey = modalJob ? rowKey({ project_id: modalJob.project.id, id: modalJob.job.id }) : null;

  useEffect(() => {
    const parsed = parseInspectJob(searchParams.get("inspectJob"));
    if (!parsed) return;
    const project = projects.find((p) => p.id === parsed.projectId);
    const job = project ? loadProjectJobs(project.id, project).find((j) => j.id === parsed.jobId) : null;
    if (project && job) {
      setModalJob({ project, job });
    }
  }, [searchParams, projects]);

  const columns: ColumnDef<ProductionJobRow>[] = useMemo(
    () => [
      { id: "job", header: "Job", size: 160, accessorFn: (r) => r.name, cell: ({ row }) => row.original.name || "—" },
      { id: "project", header: "Project", size: 140, accessorFn: (r) => r.projectName },
      { id: "client", header: "Client", size: 120, accessorFn: (r) => r.clientName },
      { id: "po", header: "PO #", size: 130, accessorFn: (r) => r.po_number ?? "" },
      { id: "status", header: "Status", size: 110, accessorFn: (r) => r.status },
      {
        id: "progress",
        header: "Progress",
        size: 120,
        cell: ({ row }) => <WipProgressSummary steps={row.original.timeline} />,
      },
      {
        id: "due",
        header: "Due",
        size: 100,
        accessorFn: (r) => r.due_date,
        cell: ({ getValue }) => formatShortDate(getValue() as string | null),
      },
      ...JOB_WIP_COLUMNS.map(
        (c): ColumnDef<ProductionJobRow> => ({
          id: c.id,
          header: c.label,
          size: c.minWidth,
          accessorFn: (row) => c.accessor(row),
          cell: ({ getValue }) => formatJobWipCell(getValue()),
        }),
      ),
    ],
    [],
  );

  const table = useReactTable({
    data: jobRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  function openJobModal(row: ProductionJobRow) {
    const project = projects.find((p) => p.id === row.project_id);
    if (!project) return;
    const job = loadProjectJobs(project.id, project).find((j) => j.id === row.id);
    if (!job) return;
    setModalJob({ project, job });
    router.replace(
      `/production?inspectJob=${row.project_id}:${encodeURIComponent(row.id)}`,
      { scroll: false },
    );
  }

  function closeJobModal() {
    setModalJob(null);
    router.replace("/production", { scroll: false });
  }

  function handleSaveJob(saved: ProjectJob) {
    if (!modalJob) return;
    const current = loadProjectJobs(modalJob.project.id, modalJob.project);
    const next = current.some((j) => j.id === saved.id)
      ? current.map((j) => (j.id === saved.id ? saved : j))
      : [...current, saved];
    saveProjectJobs(modalJob.project.id, next);
    setModalJob({ project: modalJob.project, job: saved });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-white p-4 lg:p-6">
        <p className="mb-3 text-xs text-text-secondary">
          Click a row to open Job Details. Share a link with{" "}
          <code className="rounded bg-surface-body px-1">?inspectJob=projectId:jobId</code>
        </p>
        <table className="min-w-max border-collapse bg-white text-left text-xs">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border-light bg-white">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="whitespace-nowrap px-2 py-2 font-semibold uppercase tracking-wide text-text-secondary"
                    style={{ minWidth: h.getSize() }}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {table.getRowModel().rows.map((row) => {
              const key = rowKey(row.original);
              const active = openRowKey === key;
              return (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openJobModal(row.original)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openJobModal(row.original);
                    }
                  }}
                  className={`cursor-pointer border-b border-border-light bg-white ${
                    active ? "bg-slate-50 ring-1 ring-inset ring-accent/25" : "hover:bg-slate-50"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-2 py-2 text-text-primary"
                      style={{ minWidth: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalJob ? (
        <JobDetailsModal
          project={modalJob.project}
          job={normalizeJob(modalJob.job, modalJob.project)}
          allJobs={loadProjectJobs(modalJob.project.id, modalJob.project)}
          clientCode={clientCodeByName(modalJob.project.client.name) ?? "GG"}
          vendors={vendors}
          onClose={closeJobModal}
          onSave={(saved) => {
            handleSaveJob(saved);
          }}
        />
      ) : null}
    </div>
  );
}
