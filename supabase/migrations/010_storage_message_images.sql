-- Chat image uploads for in-app Messages (Live mode).
-- NON-DESTRUCTIVE: no DROP POLICY, no table drops, no row deletes.
-- Bucket: 3 MB; image/jpeg, image/png, image/gif, image/webp (public).
--
-- Run order: 008 → 009 → this file (safe to re-run).
-- If the bucket already exists in the Dashboard, this only adds missing storage policies.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-images',
  'message-images',
  true,
  3145728,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $storage_policies$
BEGIN
  -- Public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'message_images_public_read'
  ) THEN
    CREATE POLICY "message_images_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'message-images');
  END IF;

  -- Operator: upload/delete under {auth.uid()}/{conversation_id}/...
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'message_images_insert_operator'
  ) THEN
    CREATE POLICY "message_images_insert_operator"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'message-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'message_images_delete_operator'
  ) THEN
    CREATE POLICY "message_images_delete_operator"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'message-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Member policies (need 008 + 009)
  IF to_regclass('public.workspace_memberships') IS NULL THEN
    RAISE NOTICE 'message-images: skipped member policies — run 008 then re-run this file.';
    RETURN;
  END IF;

  IF to_regclass('public.conversations') IS NULL THEN
    RAISE NOTICE 'message-images: skipped member policies — run 009 then re-run this file.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'message_images_insert_member'
  ) THEN
    CREATE POLICY "message_images_insert_member"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'message-images'
        AND EXISTS (
          SELECT 1
          FROM conversations c
          JOIN workspace_memberships wm ON wm.operator_user_id = c.user_id
          WHERE c.user_id::text = (storage.foldername(name))[1]
            AND c.id::text = (storage.foldername(name))[2]
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'message_images_delete_member'
  ) THEN
    CREATE POLICY "message_images_delete_member"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'message-images'
        AND EXISTS (
          SELECT 1
          FROM conversations c
          JOIN workspace_memberships wm ON wm.operator_user_id = c.user_id
          WHERE c.user_id::text = (storage.foldername(name))[1]
            AND c.id::text = (storage.foldername(name))[2]
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
        )
      );
  END IF;
END
$storage_policies$;
