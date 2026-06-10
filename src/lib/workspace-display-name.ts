/** Human-readable workspace label — never return the generic word "Workspace" alone. */
export function workspaceDisplayName(options: {
  workspaceName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  contactCompanyName?: string | null;
  contactName?: string | null;
  fallback?: string;
}): string {
  const candidates = [
    options.workspaceName,
    options.companyName,
    options.fullName,
    options.contactCompanyName,
    options.contactName,
    options.fallback,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === "workspace") continue;
    return trimmed;
  }
  return options.fallback?.trim() || "Team workspace";
}
