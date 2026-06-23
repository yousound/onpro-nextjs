-- Project document library (mockups, tech packs, mailroom art) — metadata + storage.

CREATE TABLE IF NOT EXISTS project_documents (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_id text,
  job_label text,
  name text NOT NULL,
  project_name text,
  kind text NOT NULL DEFAULT 'other',
  size_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by text NOT NULL DEFAULT 'Upload',
  file_name text,
  storage_path text,
  external_url text,
  source_ref text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_job ON project_documents(project_id, job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_documents_source_ref
  ON project_documents(source_ref)
  WHERE source_ref IS NOT NULL;

ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_documents_select_via_project" ON project_documents;
CREATE POLICY "project_documents_select_via_project" ON project_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = project_documents.project_id
        AND (
          p.user_id = auth.uid()
          OR member_can_read_operator_contacts(p.user_id)
          OR member_can_read_client_project(p.user_id, p.client_id)
        )
    )
  );

DROP POLICY IF EXISTS "project_documents_select_member_team" ON project_documents;
CREATE POLICY "project_documents_select_member_team" ON project_documents
  FOR SELECT USING (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "project_documents_insert_member_team" ON project_documents;
CREATE POLICY "project_documents_insert_member_team" ON project_documents
  FOR INSERT WITH CHECK (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "project_documents_update_member_team" ON project_documents;
CREATE POLICY "project_documents_update_member_team" ON project_documents
  FOR UPDATE
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "project_documents_delete_member_team" ON project_documents;
CREATE POLICY "project_documents_delete_member_team" ON project_documents
  FOR DELETE USING (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "project_documents_all_own" ON project_documents;
CREATE POLICY "project_documents_all_own" ON project_documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Storage bucket: project-documents/{operator_user_id}/{project_id}/{document_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  true,
  12582912,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/postscript', 'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $storage_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'project_documents_public_read'
  ) THEN
    CREATE POLICY "project_documents_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'project-documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'project_documents_insert_operator'
  ) THEN
    CREATE POLICY "project_documents_insert_operator"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'project-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'project_documents_delete_operator'
  ) THEN
    CREATE POLICY "project_documents_delete_operator"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'project-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF to_regclass('public.workspace_memberships') IS NULL THEN
    RAISE NOTICE 'project-documents: skipped member storage policies — run 008 first.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'project_documents_insert_member'
  ) THEN
    CREATE POLICY "project_documents_insert_member"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'project-documents'
        AND EXISTS (
          SELECT 1
          FROM projects p
          WHERE p.id::text = (storage.foldername(name))[2]
            AND member_can_read_operator_contacts(p.user_id)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'project_documents_delete_member'
  ) THEN
    CREATE POLICY "project_documents_delete_member"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'project-documents'
        AND EXISTS (
          SELECT 1
          FROM projects p
          WHERE p.id::text = (storage.foldername(name))[2]
            AND member_can_read_operator_contacts(p.user_id)
        )
      );
  END IF;
END
$storage_policies$;
