-- Allow active workspace members to update operator CRM contacts (e.g. vendor ↔ client move).

CREATE POLICY "contacts_update_member_team" ON contacts
  FOR UPDATE
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));
