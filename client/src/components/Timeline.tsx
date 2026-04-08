import { format } from 'date-fns';
import type { TimelineEntry } from '../lib/api';

const ACTION_LABELS: Record<string, string> = {
  received:          'Mail Received',
  scan_requested:    'Scan Requested',
  scan_completed:    'Scan Completed',
  forward_requested: 'Forward Requested',
  forwarded:         'Forwarded / Shipped',
  shred_requested:   'Shred Requested',
  shredded:          'Shredded',
  archived:          'Archived',
};

interface Props {
  timeline: TimelineEntry[];
}

export function Timeline({ timeline }: Props) {
  const sorted = [...timeline].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-600 mb-2">History</h4>
      <ol className="relative border-l border-gray-200 ml-3 space-y-3">
        {sorted.map((entry) => (
          <li key={entry.id} className="ml-4">
            <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-400" />
            <p className="text-xs font-medium text-gray-800">
              {ACTION_LABELS[entry.action] ?? entry.action}
            </p>
            {entry.notes && <p className="text-xs text-gray-500">{entry.notes}</p>}
            <p className="text-xs text-gray-400">
              {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
