import axios from 'axios';
import { supabase } from './supabase';

// Use relative URL so the Vite proxy handles it — works on any device on the network.
// Set VITE_API_URL only in production to point at your deployed server.
const BASE = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({ baseURL: `${BASE}/api` });

// Attach Supabase JWT + disable browser caching on every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  config.headers['Cache-Control'] = 'no-cache';
  config.params = { ...config.params, _t: Date.now() };
  return config;
});

export default api;

// ---- Types ----

export type Role = 'customer' | 'admin';

export type MailStatus = 'new' | 'pending_action' | 'processing' | 'completed' | 'archived';

export type MailAction =
  | 'scan_requested' | 'scan_completed'
  | 'forward_requested' | 'forwarded'
  | 'shred_requested' | 'shredded'
  | 'shred_after_scan_requested'
  | 'keep_requested' | 'kept'
  | null;

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  box_number: string;
  phone: string;
  role: Role;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  performed_by: string;
  notes: string;
  created_at: string;
}

export interface MailItem {
  id: string;
  customer_id: string;
  customer?: Profile;
  received_date: string;
  status: MailStatus;
  action: MailAction;
  image_url: string;
  scan_files?: string[];
  tracking_number?: string;
  notes?: string;
  timeline?: TimelineEntry[];
  created_at: string;
  updated_at: string;
}

// ---- Mail API helpers ----

export const mailApi = {
  list: (params?: { customer_id?: string; status?: string }) =>
    api.get<MailItem[]>('/mail', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<MailItem>(`/mail/${id}`).then((r) => r.data),

  create: (payload: { customer_id: string; image_url: string; notes?: string }) =>
    api.post<MailItem>('/mail', payload).then((r) => r.data),

  bulkCreate: (payload: { customer_id: string; image_urls: string[]; notes?: string }) =>
    api.post<MailItem[]>('/mail/bulk', payload).then((r) => r.data),

  sendReminders: (customerId?: string) =>
    api.post<{ sent: number; total: number; results: { phone: string; count: number; ok: boolean; error?: string }[] }>(
      '/mail/send-reminders',
      customerId ? { customer_id: customerId } : {},
    ).then((r) => r.data),

  requestAction: (id: string, action: string) =>
    api.patch<MailItem>(`/mail/${id}/request-action`, { action }).then((r) => r.data),

  complete: (id: string, payload: {
    action: string;
    scan_files?: string[];
    tracking_number?: string;
    notes?: string;
  }) => api.patch<MailItem>(`/mail/${id}/complete`, payload).then((r) => r.data),

  archive: (id: string) =>
    api.patch<MailItem>(`/mail/${id}/archive`).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/mail/${id}`).then((r) => r.data),
};

// ---- Upload API helpers ----

export const uploadApi = {
  getPresignedUrl: (filename: string, contentType: string, folder = 'mail-images') =>
    api.post<{ uploadUrl: string; fileUrl: string; key: string }>('/upload/presign', {
      filename, contentType, folder,
    }).then((r) => r.data),

  uploadToS3: async (file: File, folder = 'mail-images') => {
    const { uploadUrl, fileUrl } = await uploadApi.getPresignedUrl(
      file.name,
      file.type,
      folder
    );
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    return fileUrl;
  },
};

// ---- Users API helpers ----

export const usersApi = {
  list: () =>
    api.get<Profile[]>('/users').then((r) => r.data),

  create: (payload: { email: string; password: string; full_name: string; box_number?: string; phone?: string }) =>
    api.post<Profile>('/users', payload).then((r) => r.data),

  update: (id: string, payload: { full_name?: string; box_number?: string; phone?: string }) =>
    api.patch<Profile>(`/users/${id}`, payload).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
};
