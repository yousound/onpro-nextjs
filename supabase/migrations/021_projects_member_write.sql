-- Team/vendor workspace members can create and edit projects on the operator workspace.

CREATE POLICY "projects_insert_member_team" ON projects
  FOR INSERT
  WITH CHECK (
    member_can_read_operator_contacts(user_id)
    AND EXISTS (
      SELECT 1
      FROM contacts c
      WHERE c.id = client_id
        AND c.user_id = user_id
    )
  );

CREATE POLICY "projects_update_member_team" ON projects
  FOR UPDATE
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (
    member_can_read_operator_contacts(user_id)
    AND EXISTS (
      SELECT 1
      FROM contacts c
      WHERE c.id = client_id
        AND c.user_id = user_id
    )
  );
