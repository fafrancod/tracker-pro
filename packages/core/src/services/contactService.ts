import { getSupabase } from '../supabase';
import { api } from '../lib/api';
import { isDemoMode } from '../lib/demoMode';
import { subscribeTable } from '../lib/realtime';
import { normalizeTag } from '../lib/tags';
import type {
  Contact,
  ContactKind,
  CreateContactPayload,
  PersonRelationship,
  UpdateContactPayload,
} from '../types';

export type ContactsUnsubscribe = () => void;

const RELATIONSHIPS = new Set<PersonRelationship>([
  'father',
  'mother',
  'son',
  'daughter',
  'niece',
  'nephew',
  'friend',
  'coworker',
]);

export async function fetchContacts(uid: string): Promise<Contact[]> {
  const { data, error } = await getSupabase()
    .from('contacts')
    .select('*')
    .eq('user_id', uid)
    .order('order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapContact(row.id as string, row as Record<string, unknown>));
}

export function subscribeContacts(
  uid: string,
  cb: (contacts: Contact[]) => void
): ContactsUnsubscribe {
  if (isDemoMode()) return () => undefined;

  void fetchContacts(uid).then(cb).catch(() => cb([]));

  return subscribeTable({
    topic: `contacts:${uid}`,
    table: 'contacts',
    filter: `user_id=eq.${uid}`,
    onChange: () => {
      void fetchContacts(uid).then(cb).catch(() => cb([]));
    },
  });
}

interface ContactApiResponse {
  id: string;
  kind: ContactKind;
  name: string;
  tags: string[];
  relationship: PersonRelationship | null;
  order: number;
  created_at?: string;
  createdAt?: string;
}

export async function createContact(payload: CreateContactPayload): Promise<Contact> {
  const res = await api.post<ContactApiResponse>('/api/contacts', payload);
  return mapContact(res.id, res as unknown as Record<string, unknown>);
}

export async function updateContact(
  contactId: string,
  payload: UpdateContactPayload
): Promise<void> {
  await api.patch<void>(`/api/contacts/${encodeURIComponent(contactId)}`, payload);
}

export async function deleteContact(contactId: string): Promise<void> {
  await api.del<void>(`/api/contacts/${encodeURIComponent(contactId)}`);
}

function mapContact(id: string, raw: Record<string, unknown>): Contact {
  const kind: ContactKind = raw.kind === 'pet' ? 'pet' : 'person';
  const tagsRaw = Array.isArray(raw.tags) ? (raw.tags as string[]) : [];
  const tags = tagsRaw.map(normalizeTag).filter(Boolean);
  const relRaw = raw.relationship;
  const relationship =
    kind === 'person' && typeof relRaw === 'string' && RELATIONSHIPS.has(relRaw as PersonRelationship)
      ? (relRaw as PersonRelationship)
      : null;

  return {
    id,
    kind,
    name: (raw.name as string) ?? '',
    tags,
    relationship,
    order: typeof raw.order === 'number' ? raw.order : 0,
    createdAt:
      (raw.created_at as string) ?? (raw.createdAt as string) ?? new Date(0).toISOString(),
  };
}
