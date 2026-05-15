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
import { WIP_COLUMNS } from "@/lib/wip-columns";
import { formatCellValue } from "@/lib/format";
import { MilestoneStrip } from "@/components/milestone-strip";
import Link from "next/link";

function Inspector({ project }: { project: Project }) {
  return (
    <aside className="shrink-0 border-t border-border-light bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Inspector</h2>
          <p className="text-xs text-text-secondary">Selected job / project row</p>
        </div>
        <Link
          href={`/projects/${project.id}`}
          className="shrink-0 text-xs font-semibold text-accent hover:underline"
        >
          Open project detail →
        </Link>
      </div>
      <dl className="mt-3 grid gap-4 text-xs sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
        <div>
          <dt className="text-text-secondary">Name</dt>
          <dd className="mt-0.5 font-medium text-text-primary">{project.name}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Client</dt>
          <dd className="mt-0.5 font-medium text-text-primary">{project.client.name}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Status</dt>
          <dd className="mt-0.5 font-medium text-text-primary">{project.status}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Due</dt>
          <dd className="mt-0.5 font-medium text-text-primary">{formatCellValue(project.due_date)}</dd>
        </div>
        <div className="min-w-0 sm:col-span-2 md:col-span-4 lg:col-span-5">
          <dt className="text-text-secondary">Milestones</dt>
          <dd className="mt-1 overflow-x-auto">
            <MilestoneStrip project={project} />
          </dd>
        </div>
      </dl>
    </aside>
  );
}

export function ProductionBoard({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const raw = searchParams.get("inspect");
    const id = raw ? Number(raw) : NaN;
    if (Number.isFinite(id)) setSelectedId(id);
  }, [searchParams]);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const columns: ColumnDef<Project>[] = useMemo(
    () => [
      {
        id: "milestones",
        header: "Milestones",
        size: 120,
        cell: ({ row }) => <MilestoneStrip project={row.original} />,
      },
      ...WIP_COLUMNS.map(
        (c): ColumnDef<Project> => ({
          id: c.id,
          header: c.label,
          size: c.minWidth,
          accessorFn: (row) => c.accessor(row),
          cell: ({ getValue }) => formatCellValue(getValue()),
        }),
      ),
    ],
    [],
  );

  const table = useReactTable({
    data: projects,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const onPickRow = (id: number) => {
    setSelectedId(id);
    router.replace(`/production?inspect=${id}`, { scroll: false });
  };

  const openProjectDetail = (id: number) => {
    router.push(`/projects/${id}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-white p-4 lg:p-6">
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
              const active = selectedId === row.original.id;
              return (
                <tr
                  key={row.id}
                  onClick={() => onPickRow(row.original.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    openProjectDetail(row.original.id);
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
      {selected ? (
        <Inspector project={selected} />
      ) : (
        <aside className="flex shrink-0 items-center justify-center border-t border-border-light bg-white px-6 py-4 text-sm text-text-secondary">
          Select a row to inspect, or double-click a row to open project details. Add{" "}
          <code className="mx-1 rounded bg-surface-body px-1">?inspect=1</code> to the URL to deep-link.
        </aside>
      )}
    </div>
  );
}
