/** Whether the signed-in user may edit workspace / contact permission profiles. */
export function canManageWorkspacePermissions(isTeamView: boolean): boolean {
  return !isTeamView;
}
