import { useState } from 'react';
import { format } from 'date-fns';
import {
  ScanLine, Trash2, Archive, ChevronDown, ChevronUp,
  Eye, Package, FileText, CheckCircle,
} from 'lucide-react';
import { mailApi } from '../lib/api';
import type { MailItem } from '../lib/api';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';
import { FileViewer } from './FileViewer';

interface Props {
  item: MailItem;
  onUpdate: (updated: MailItem) => void;
  isAdmin?: boolean;
}

interface PendingConfirm {
  title: string;
  description: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function MailCard({ item, onUpdate, isAdmin }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  function confirm(opts: PendingConfirm) {
    setPending(opts);
  }

  async function handleAction(action: string) {
    setLoading(action);
    try {
      const updated = await mailApi.requestAction(item.id, action);
      onUpdate(updated);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to submit request');
    } finally {
      setLoading(null);
    }
  }

  async function handleArchive() {
    setLoading('archive');
    try {
      const updated = await mailApi.archive(item.id);
      onUpdate(updated);
    } finally {
      setLoading(null);
    }
  }

  const canAct = item.status === 'new';
  const isCompleted = item.status === 'completed';
  const isScanCompleted = isCompleted && item.action === 'scan_completed';

  return (
    <>
      {showFiles && item.scan_files && (
        <FileViewer files={item.scan_files} onClose={() => setShowFiles(false)} />
      )}
      {pending && (
        <ConfirmDialog
          title={pending.title}
          description={pending.description}
          destructive={pending.destructive}
          onConfirm={() => { pending.onConfirm(); setPending(null); }}
          onCancel={() => setPending(null)}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex gap-3 p-3 sm:p-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-32 h-16 sm:w-48 sm:h-24 bg-gray-100 rounded-lg overflow-hidden">
            {!imgError ? (
              <img
                src={item.image_url}
                alt="Mail"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => window.open(item.image_url, '_blank')}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <FileText size={28} />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Received {format(new Date(item.received_date), 'MMM d, yyyy')}
                </p>
                <StatusBadge status={item.status} action={item.action} />
                {isAdmin && item.customer && (
                  <p className="text-xs text-gray-500 mt-1">
                    {item.customer.full_name} — Box #{item.customer.box_number}
                  </p>
                )}
              </div>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5 p-1"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {/* Tracking info */}
            {item.tracking_number && (
              <p className="text-xs text-green-700 mt-1 font-medium">
                Tracking: {item.tracking_number}
              </p>
            )}

            {/* Customer action buttons */}
            {!isAdmin && (
              <div className="flex flex-wrap gap-2 mt-3">
                {/* Initial actions — only when status is new */}
                {canAct && (
                  <>
                    <ActionButton
                      label="Keep"
                      icon={<CheckCircle size={13} />}
                      onClick={() => confirm({
                        title: 'Confirm: Keep',
                        description: 'Your mail will be held at the store for pickup. No further action will be taken on this item.',
                        onConfirm: () => handleAction('keep_requested'),
                      })}
                      loading={loading === 'keep_requested'}
                      color="green"
                    />
                    <ActionButton
                      label="Open & Scan"
                      icon={<ScanLine size={13} />}
                      onClick={() => confirm({
                        title: 'Confirm: Open & Scan',
                        description: 'We will open this mail item and scan the contents for you to view digitally. This action cannot be undone.',
                        onConfirm: () => handleAction('scan_requested'),
                      })}
                      loading={loading === 'scan_requested'}
                      color="blue"
                    />
                    <ActionButton
                      label="Shred"
                      icon={<Trash2 size={13} />}
                      onClick={() => confirm({
                        title: 'Confirm: Shred',
                        description: 'This mail item will be permanently shredded and destroyed. This action is final and cannot be reversed or recovered.',
                        destructive: true,
                        onConfirm: () => handleAction('shred_requested'),
                      })}
                      loading={loading === 'shred_requested'}
                      color="red"
                    />
                    {/* <ActionButton
                      label="Forward"
                      icon={<Send size={13} />}
                      onClick={() => handleAction('forward_requested')}
                      loading={loading === 'forward_requested'}
                      color="indigo"
                    /> */}
                  </>
                )}

                {/* Post-scan actions — view document + keep or shred */}
                {isScanCompleted && item.scan_files?.length ? (
                  <>
                    <ActionButton
                      label="View Document"
                      icon={<Eye size={13} />}
                      onClick={() => setShowFiles(true)}
                      color="blue"
                    />
                    <ActionButton
                      label="Keep"
                      icon={<CheckCircle size={13} />}
                      onClick={() => confirm({
                        title: 'Confirm: Keep',
                        description: 'The scanned document will be saved to your mailbox. The physical mail item will be held at the store for pickup.',
                        onConfirm: handleArchive,
                      })}
                      loading={loading === 'archive'}
                      color="green"
                    />
                    <ActionButton
                      label="Shred"
                      icon={<Trash2 size={13} />}
                      onClick={() => confirm({
                        title: 'Confirm: Shred',
                        description: 'The physical mail item will be permanently shredded and destroyed. This action is final and cannot be reversed or recovered.',
                        destructive: true,
                        onConfirm: () => handleAction('shred_after_scan_requested'),
                      })}
                      loading={loading === 'shred_after_scan_requested'}
                      color="red"
                    />
                  </>
                ) : null}

                {/* Forwarded */}
                {item.action === 'forwarded' && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                    <Package size={13} /> Shipped
                  </span>
                )}

                {/* Shredded */}
                {item.action === 'shredded' && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 font-medium">
                    <Trash2 size={13} /> Shredded
                  </span>
                )}

                {/* Archive button for other completed items */}
                {isCompleted && !isScanCompleted && (
                  <ActionButton
                    label="Archive"
                    icon={<Archive size={13} />}
                    onClick={() => confirm({
                      title: 'Confirm: Archive',
                      description: 'This item will be moved to your archive.',
                      onConfirm: handleArchive,
                    })}
                    loading={loading === 'archive'}
                    color="gray"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expanded timeline */}
        {expanded && item.timeline && item.timeline.length > 0 && (
          <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-gray-50">
            <Timeline timeline={item.timeline} />
          </div>
        )}
      </div>
    </>
  );
}

function ActionButton({
  label, icon, onClick, loading, color = 'blue',
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  color?: 'blue' | 'indigo' | 'red' | 'green' | 'gray';
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200',
    red:    'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
    green:  'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
    gray:   'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200',
  };

  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-60 ${colors[color]}`}
    >
      {icon}
      {loading ? 'Loading…' : label}
    </button>
  );
}

function ConfirmDialog({
  title, description, destructive, onConfirm, onCancel,
}: {
  title: string;
  description: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5">{description}</p>
        {destructive && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            This action is permanent and cannot be undone.
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Yes, Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
