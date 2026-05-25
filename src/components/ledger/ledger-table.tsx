import type { ReactNode } from "react";

export function LedgerTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-light text-xs font-medium uppercase tracking-wide text-text-secondary">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">{children}</tbody>
      </table>
    </div>
  );
}
