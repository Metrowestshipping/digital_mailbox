import { useEffect, useState } from 'react';
import { LogOut, Mail, RefreshCw } from 'lucide-react';
import { mailApi } from '../lib/api';
import type { MailItem, MailStatus, Profile } from '../lib/api';
import { MailCard } from '../components/MailCard';

interface Props {
  profile: Profile;
  onSignOut: () => void;
}

type Section = { label: string; statuses: MailStatus[]; emptyMsg: string };

const SECTIONS: Section[] = [
  { label: 'Inbox',      statuses: ['new'],             emptyMsg: 'No new mail.' },
  { label: 'Processing', statuses: ['pending_action', 'processing'], emptyMsg: 'Nothing in progress.' },
  { label: 'Completed',  statuses: ['completed'],       emptyMsg: 'No completed items.' },
  { label: 'Archived',   statuses: ['archived'],        emptyMsg: 'No archived items.' },
];

export function CustomerInbox({ profile, onSignOut }: Props) {
  const [items, setItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await mailApi.list();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleUpdate(updated: MailItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function itemsInSection(section: Section) {
    return items.filter((i) => section.statuses.includes(i.status));
  }

  const newCount = items.filter((i) => i.status === 'new').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Mail size={16} className="text-white" />
            </div>
            <div>
              <span className="font-semibold text-gray-900 text-sm">Metrowest Digital Mailbox</span>
              {profile.box_number && (
                <span className="ml-2 text-xs text-gray-500">Box #{profile.box_number}</span>
              )}
            </div>
            {newCount > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {newCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:block">{profile.full_name || profile.email}</span>
            <button
              onClick={load}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {loading && items.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading your mail…</div>
        ) : (
          SECTIONS.map((section) => {
            const sectionItems = itemsInSection(section);
            // Hide empty archived section to keep UI clean
            if (section.label === 'Archived' && sectionItems.length === 0) return null;
            return (
              <section key={section.label}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {section.label}
                  </h2>
                  {sectionItems.length > 0 && (
                    <span className="text-xs text-gray-400">({sectionItems.length})</span>
                  )}
                </div>
                {sectionItems.length === 0 ? (
                  <p className="text-sm text-gray-400 pl-1">{section.emptyMsg}</p>
                ) : (
                  <div className="space-y-3">
                    {sectionItems.map((item) => (
                      <MailCard key={item.id} item={item} onUpdate={handleUpdate} />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
