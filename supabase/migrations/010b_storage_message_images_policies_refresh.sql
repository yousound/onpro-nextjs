-- OPTIONAL — only to replace existing message-images storage policies.
-- Uses DROP POLICY (Supabase may warn). Does not delete uploaded files.
-- Skip if 010_storage_message_images.sql completed successfully.

DROP POLICY IF EXISTS "message_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "message_images_insert_operator" ON storage.objects;
DROP POLICY IF EXISTS "message_images_insert_member" ON storage.objects;
DROP POLICY IF EXISTS "message_images_delete_operator" ON storage.objects;
DROP POLICY IF EXISTS "message_images_delete_member" ON storage.objects;

-- Then run 010_storage_message_images.sql again to recreate policies.
