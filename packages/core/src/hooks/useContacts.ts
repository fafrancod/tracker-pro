import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import {
  subscribeContacts,
  createContact,
  updateContact,
  deleteContact,
} from '../services/contactService';
import type { CreateContactPayload, UpdateContactPayload, Contact } from '../types';

export function useContacts() {
  const uid = useStore(s => s.uid);
  const contacts = useStore(s => s.contacts);
  const {
    setContacts,
    addContactOptimistic,
    updateContactOptimistic,
    removeContactOptimistic,
  } = useStore();

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeContacts(uid, next => {
      setContacts(next);
    });
    return unsub;
  }, [uid, setContacts]);

  const addContact = useCallback(
    async (payload: CreateContactPayload) => {
      if (!uid) {
        throw new Error('Sesión no lista. Recarga la página e inténtalo de nuevo.');
      }
      const created = await createContact(payload);
      addContactOptimistic(created as Contact);
      return created;
    },
    [uid, addContactOptimistic]
  );

  const editContact = useCallback(
    async (contactId: string, payload: UpdateContactPayload) => {
      if (!uid) {
        throw new Error('Sesión no lista. Recarga la página e inténtalo de nuevo.');
      }
      updateContactOptimistic(contactId, payload);
      try {
        await updateContact(contactId, payload);
      } catch (err) {
        // Recargar lista si el patch falla (evita UI desfasada)
        throw err;
      }
    },
    [uid, updateContactOptimistic]
  );

  const removeContact = useCallback(
    async (contactId: string) => {
      if (!uid) {
        throw new Error('Sesión no lista. Recarga la página e inténtalo de nuevo.');
      }
      removeContactOptimistic(contactId);
      await deleteContact(contactId);
    },
    [uid, removeContactOptimistic]
  );

  return { contacts, addContact, editContact, removeContact };
}
