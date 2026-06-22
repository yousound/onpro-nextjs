-- Jobs/orders must belong to the project operator so owners and teammates see the same WIP.
-- Repairs rows saved under a team member's auth id when the workspace cookie was wrong.

UPDATE project_jobs j
SET user_id = p.user_id
FROM projects p
WHERE j.project_id = p.id
  AND j.user_id IS DISTINCT FROM p.user_id;

UPDATE project_orders o
SET user_id = p.user_id
FROM projects p
WHERE o.project_id = p.id
  AND o.user_id IS DISTINCT FROM p.user_id;

-- Read jobs/orders when you can read the parent project (covers owner + team + client members).
DROP POLICY IF EXISTS "project_jobs_select_via_project" ON project_jobs;
CREATE POLICY "project_jobs_select_via_project" ON project_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_jobs.project_id
        AND (
          p.user_id = auth.uid()
          OR member_can_read_operator_contacts(p.user_id)
          OR member_can_read_client_project(p.user_id, p.client_id)
        )
    )
  );

DROP POLICY IF EXISTS "project_orders_select_via_project" ON project_orders;
CREATE POLICY "project_orders_select_via_project" ON project_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_orders.project_id
        AND (
          p.user_id = auth.uid()
          OR member_can_read_operator_contacts(p.user_id)
          OR member_can_read_client_project(p.user_id, p.client_id)
        )
    )
  );
