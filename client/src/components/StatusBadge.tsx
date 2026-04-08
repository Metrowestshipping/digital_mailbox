import type { MailAction, MailStatus } from '../lib/api';

const STATUS_CONFIG: Record<MailStatus, { label: string; classes: string }> = {
  new:            { label: 'New',        classes: 'bg-blue-100 text-blue-700' },
  pending_action: { label: 'Pending',    classes: 'bg-yellow-100 text-yellow-700' },
  processing:     { label: 'Processing', classes: 'bg-orange-100 text-orange-700' },
  completed:      { label: 'Completed',  classes: 'bg-green-100 text-green-700' },
  archived:       { label: 'Archived',   classes: 'bg-gray-100 text-gray-500' },
};

const ACTION_LABELS: Record<string, string> = {
  scan_requested:    'Scan Requested',
  scan_completed:    'Scanned',
  forward_requested: 'Forward Requested',
  forwarded:         'Shipped',
  shred_requested:          'Shred Requested',
  shredded:                 'Shredded',
  shred_after_scan_requested: 'Shred After Review',
  keep_requested:             'Keep Requested',
  kept:                       'Kept',
};

interface Props {
  status: MailStatus;
  action?: MailAction;
}

export function StatusBadge({ status, action }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
        {cfg.label}
      </span>
      {action && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          {ACTION_LABELS[action] ?? action}
        </span>
      )}
    </span>
  );
}
