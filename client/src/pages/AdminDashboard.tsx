import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import {
  LogOut, Mail, RefreshCw, Plus, Upload, Check, Trash2,
  Send, ChevronDown, X, Images, Pencil, BellRing,
} from 'lucide-react';
import { mailApi, uploadApi, usersApi } from '../lib/api';
import { pdfToImage } from '../lib/pdfToImage';
import type { MailItem, Profile } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';

interface Props {
  profile: Profile;
  onSignOut: () => void;
}

type Tab = 'pending' | 'all' | 'customers';

export function AdminDashboard({ profile, onSignOut }: Props) {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<MailItem[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Profile | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await mailApi.list();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    const data = await usersApi.list();
    setCustomers(data);
  }

  useEffect(() => {
    loadItems();
    loadCustomers();
  }, []);

  function handleUpdate(updated: MailItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleBulkCreated(newItems: MailItem[]) {
    setItems((prev) => [...newItems, ...prev]);
    setShowUploadModal(false);
  }

  async function handleSendReminders() {
    setSendingReminders(true);
    try {
      const result = await mailApi.sendReminders();
      if (result.total === 0) {
        alert('No mail was uploaded today, so no emails were sent.');
      } else if (result.sent === 0) {
        const failures = result.results.filter((r) => !r.ok);
        const detail = failures.map((r) => `${r.email}: ${(r as any).error ?? 'unknown error'}`).join('\n');
        alert(`Found mail for ${result.total} customer(s) but failed to send emails.\n\n${detail}`);
      } else {
        alert(`Reminder emails sent to ${result.sent} customer${result.sent !== 1 ? 's' : ''}.`);
      }
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to send reminders. Check your Gmail App Password in server/.env');
    } finally {
      setSendingReminders(false);
    }
  }

  const pending = items.filter((i) =>
    i.status === 'pending_action' || i.status === 'processing'
  );

  const displayed = tab === 'pending' ? pending : items;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm hidden sm:block">Admin Dashboard</span>
            {pending.length > 0 && (
              <span className="bg-yellow-500 text-white text-xs font-bold rounded-full px-2 py-0.5 flex-shrink-0">
                {pending.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-sm text-gray-600 hidden md:block truncate max-w-32">{profile.full_name || profile.email}</span>
            <button
              onClick={handleSendReminders}
              disabled={sendingReminders}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-green-600 text-white text-xs sm:text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
              title="Send daily reminder emails"
            >
              <BellRing size={14} />
              <span className="hidden sm:inline">{sendingReminders ? 'Sending…' : 'Send Reminders'}</span>
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Mail</span>
            </button>
            <button onClick={loadItems} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onSignOut} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-3 sm:px-4 flex gap-0">
          {(['pending', 'all', 'customers'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pending' ? `Pending (${pending.length})` : t === 'all' ? 'All Mail' : 'Customers'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {tab === 'customers' ? (
          <CustomersTab
            customers={customers}
            onAdd={() => setShowAddCustomer(true)}
            onEdit={(c) => setEditingCustomer(c)}
            onDelete={(id) => setCustomers((prev) => prev.filter((c) => c.id !== id))}
          />
        ) : loading && items.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {tab === 'pending' ? 'No pending actions.' : 'No mail items.'}
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {displayed.map((item) => (
              <AdminMailRow key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {showUploadModal && (
        <BulkUploadModal
          customers={customers}
          onClose={() => setShowUploadModal(false)}
          onCreated={handleBulkCreated}
        />
      )}

      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onCreated={(c) => { setCustomers((prev) => [...prev, c]); setShowAddCustomer(false); }}
        />
      )}

      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={(updated) => {
            setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setEditingCustomer(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Admin Mail Row ----

function AdminMailRow({ item, onUpdate, onDelete }: { item: MailItem; onUpdate: (u: MailItem) => void; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [trackingNum, setTrackingNum] = useState('');
  const [scanFiles, setScanFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDelete() {
    if (!window.confirm('Permanently delete this mail item? This cannot be undone and will also remove it from the customer\'s view.')) return;
    setLoading('delete');
    try {
      await mailApi.delete(item.id);
      onDelete(item.id);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to delete');
      setLoading(null);
    }
  }

  async function completeAction(action: string, extra?: object) {
    setLoading(action);
    try {
      const updated = await mailApi.complete(item.id, { action, ...extra });
      onUpdate(updated);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleScanUpload() {
    if (!scanFiles.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of scanFiles) {
        const url = await uploadApi.uploadToS3(file, 'scans');
        urls.push(url);
      }
      await completeAction('scan_completed', { scan_files: urls });
      setScanFiles([]);
    } finally {
      setUploading(false);
    }
  }

  const needsAction = item.status === 'pending_action' || item.status === 'processing';
  const isShredRequest = item.action === 'shred_requested' || item.action === 'shred_after_scan_requested';

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <img
          src={item.image_url}
          alt="Mail"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {item.customer && (
                <p className="text-sm font-medium text-gray-800 truncate">
                  {item.customer.full_name}
                  {item.customer.box_number && (
                    <span className="text-gray-400 font-normal"> · #{item.customer.box_number}</span>
                  )}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">
                {format(new Date(item.received_date), 'MMM d, yyyy')}
              </p>
              <div className="mt-1">
                <StatusBadge status={item.status} action={item.action} />
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={handleDelete}
                disabled={loading === 'delete'}
                className="text-gray-300 hover:text-red-500 disabled:opacity-40 p-1 rounded hover:bg-red-50 transition-colors"
                title="Delete mail item"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-gray-400 hover:text-gray-600 mt-0.5 p-1 flex-shrink-0"
              >
                <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Admin action area */}
          {needsAction && (
            <div className="mt-3 space-y-2">
              {item.action === 'scan_requested' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setScanFiles(Array.from(e.target.files ?? []))}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                  >
                    <Upload size={12} />
                    {scanFiles.length ? `${scanFiles.length} file(s)` : 'Select Scans'}
                  </button>
                  {scanFiles.length > 0 && (
                    <button
                      onClick={handleScanUpload}
                      disabled={uploading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border bg-green-50 text-green-700 hover:bg-green-100 border-green-200 disabled:opacity-60"
                    >
                      <Check size={12} />
                      {uploading ? 'Uploading…' : 'Upload & Complete'}
                    </button>
                  )}
                </div>
              )}

              {item.action === 'forward_requested' && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Tracking # (optional)"
                    value={trackingNum}
                    onChange={(e) => setTrackingNum(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                  />
                  <button
                    onClick={() => completeAction('forwarded', { tracking_number: trackingNum || undefined })}
                    disabled={!!loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 disabled:opacity-60"
                  >
                    <Send size={12} />
                    {loading === 'forwarded' ? 'Marking…' : 'Mark Shipped'}
                  </button>
                </div>
              )}

              {isShredRequest && (
                <div>
                  {item.action === 'shred_after_scan_requested' && (
                    <p className="text-xs text-orange-600 mb-1.5">Customer reviewed scan and requested shred</p>
                  )}
                  <button
                    onClick={() => completeAction('shredded')}
                    disabled={!!loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border bg-red-50 text-red-700 hover:bg-red-100 border-red-200 disabled:opacity-60"
                  >
                    <Trash2 size={12} />
                    {loading === 'shredded' ? 'Confirming…' : 'Confirm Shred'}
                  </button>
                </div>
              )}

              {item.action === 'keep_requested' && (
                <button
                  onClick={() => completeAction('kept')}
                  disabled={!!loading}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border bg-green-50 text-green-700 hover:bg-green-100 border-green-200 disabled:opacity-60"
                >
                  <Check size={12} />
                  {loading === 'kept' ? 'Confirming…' : 'Confirm Keep'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {expanded && item.timeline && item.timeline.length > 0 && (
        <div className="px-3 sm:px-4 pb-4 border-t border-gray-50">
          <Timeline timeline={item.timeline} />
        </div>
      )}
    </div>
  );
}

// ---- Bulk Upload Modal ----

function BulkUploadModal({
  customers,
  onClose,
  onCreated,
}: {
  customers: Profile[];
  onClose: () => void;
  onCreated: (items: MailItem[]) => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    setConverting(true);
    setError('');
    try {
      const converted: File[] = [];
      const urls: string[] = [];
      for (const file of selected) {
        const imageFile = file.type === 'application/pdf' ? await pdfToImage(file) : file;
        converted.push(imageFile);
        urls.push(URL.createObjectURL(imageFile));
      }
      setFiles(converted);
      setPreviews(urls);
    } catch {
      setError('Failed to process one or more files. Please try again.');
    } finally {
      setConverting(false);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length || !customerId) { setError('Select a customer and at least one image.'); return; }
    setLoading(true);
    setError('');
    setProgress(0);

    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadApi.uploadToS3(files[i], 'mail-images');
        imageUrls.push(url);
        setProgress(Math.round(((i + 1) / files.length) * 80));
      }

      const items = await mailApi.bulkCreate({ customer_id: customerId, image_urls: imageUrls, notes: notes || undefined });
      setProgress(100);
      onCreated(items);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add New Mail" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Customer</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} {c.box_number ? `(Box #${c.box_number})` : ''} — {c.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mail Images
            <span className="text-gray-400 font-normal ml-1">(select multiple)</span>
          </label>
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Images size={24} className="text-gray-400 mb-1" />
            <span className="text-sm text-gray-500">
              {converting ? 'Processing…' : files.length ? `${files.length} image(s) ready` : 'Click to select images'}
            </span>
            <span className="text-xs text-gray-400 mt-0.5">Hold Ctrl/Cmd to select multiple</span>
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              required
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {/* Preview grid */}
        {converting && (
          <p className="text-xs text-blue-600 text-center py-2">Converting PDF to image…</p>
        )}
        {previews.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto">
            {previews.map((src, i) => (
              <div key={i} className="relative group">
                <img
                  src={src}
                  alt={`Mail ${i + 1}`}
                  className="w-full h-16 object-cover rounded-md border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Large envelopes from USPS"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Progress bar */}
        {loading && (
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || converting}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {converting ? 'Processing…' : loading
              ? `Uploading ${progress}%…`
              : `Add ${files.length > 1 ? `${files.length} Items` : 'Mail'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Add Customer Modal ----

function AddCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (profile: Profile) => void;
}) {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', box_number: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const profile = await usersApi.create(form);
      onCreated(profile);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Modal title="Add Customer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: 'Full Name', key: 'full_name' as const, type: 'text', required: true },
          { label: 'Email', key: 'email' as const, type: 'email', required: true },
          { label: 'Password', key: 'password' as const, type: 'password', required: true },
          { label: 'Box Number', key: 'box_number' as const, type: 'text', required: false },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              type={type}
              required={required}
              {...field(key)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create Customer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Customers Tab ----

function CustomersTab({ customers, onAdd, onEdit, onDelete }: {
  customers: Profile[];
  onAdd: () => void;
  onEdit: (c: Profile) => void;
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(customer: Profile) {
    if (!window.confirm(`Delete ${customer.full_name || customer.email}? This will permanently remove them and all their mail.`)) return;
    setDeletingId(customer.id);
    try {
      await usersApi.delete(customer.id);
      onDelete(customer.id);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to delete customer');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Customers ({customers.length})</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> Add Customer
        </button>
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No customers yet.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Email', 'Box #', 'Joined', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-600">{c.box_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEdit(c)}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edit customer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c.id}
                          className="text-gray-400 hover:text-red-600 disabled:opacity-40 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {customers.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{c.full_name || '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{c.email}</p>
                  <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                    {c.box_number && <span>Box #{c.box_number}</span>}
                    <span>{format(new Date(c.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onEdit(c)}
                    className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50 transition-colors"
                    title="Edit customer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    className="text-gray-400 hover:text-red-600 disabled:opacity-40 p-1.5 rounded hover:bg-red-50 transition-colors"
                    title="Delete customer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Edit Customer Modal ----

function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Profile;
  onClose: () => void;
  onSaved: (updated: Profile) => void;
}) {
  const [form, setForm] = useState({ full_name: customer.full_name || '', box_number: customer.box_number || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const updated = await usersApi.update(customer.id, form);
      onSaved(updated);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Edit Customer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-3">{customer.email}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Box Number</label>
          <input
            type="text"
            value={form.box_number}
            onChange={(e) => setForm((f) => ({ ...f, box_number: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---- Modal wrapper ----

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
