-- Team/vendor workspace members can read and write jobs + orders on the operator workspace.

CREATE POLICY "project_jobs_select_member_team" ON project_jobs
  FOR SELECT USING (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_jobs_insert_member_team" ON project_jobs
  FOR INSERT WITH CHECK (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_jobs_update_member_team" ON project_jobs
  FOR UPDATE
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_jobs_delete_member_team" ON project_jobs
  FOR DELETE USING (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_orders_select_member_team" ON project_orders
  FOR SELECT USING (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_orders_insert_member_team" ON project_orders
  FOR INSERT WITH CHECK (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_orders_update_member_team" ON project_orders
  FOR UPDATE
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));

CREATE POLICY "project_orders_delete_member_team" ON project_orders
  FOR DELETE USING (member_can_read_operator_contacts(user_id));
