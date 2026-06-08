"use client";

import { useState } from "react";
import { deleteConfirmMessage } from "@/lib/contacts-delete";
import { deleteContact } from "@/lib/data/commit-contacts";
import { loadContacts } from "@/lib/contacts-store";
import type { Contact } from "@/lib/types/contact";

export function useDeleteContact(opts: {
  onSuccess: () => void;
}): {
  deleting: boolean;
  deleteError: string | null;
  clearDeleteError: () => void;
  handleDelete: (contact: Contact) => Promise<void>;
} {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(contact: Contact) {
    const contacts = loadContacts();
    const msg = deleteConfirmMessage(contacts, contact.id);
    if (!window.confirm(msg)) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteContact(contact.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    opts.onSuccess();
  }

  return {
    deleting,
    deleteError,
    clearDeleteError: () => setDeleteError(null),
    handleDelete,
  };
}
