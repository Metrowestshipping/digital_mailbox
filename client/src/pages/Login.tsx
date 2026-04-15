import { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
}

const DISCLAIMER_TEXT = `Virtual Mailbox Action Disclaimer

By selecting and submitting any action request (including but not limited to Open & Scan, Discard, or Shred) for a mail item, the customer acknowledges and agrees to the following:

Once an action has been processed by our team, the request is final and irreversible.
We cannot retrieve, reverse, or recover any mail item after the requested action has been completed.
If a Discard or Shred request is selected and processed, the mail item will be permanently destroyed, and no copies or recovery will be available.
All mail items stored in the system will be automatically deleted after 30 days or at the end of the monthly renewal cycle (renewal date: the 1st of each month) as a safety precaution. Once deleted from the system, items cannot be recovered digitally.
If a mail item is automatically deleted from the system without a Discard or Shred request, the physical mail piece may still be available for pickup at the store location, subject to our in-store holding policies.
Customers are strongly encouraged to pick up their mail before the end of each month (prior to the new renewal cycle) to maintain a clear and organized record of incoming mail for each billing period.
It is the customer’s responsibility to verify that the selected action is correct and to manage their mail items within the allowed storage period.
By proceeding with any action, you confirm your understanding and acceptance of this policy.

Acknowledgment
By proceeding with any action request, you confirm that you have read, understood, and agreed to this disclaimer.`;

export function Login({ onSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSignIn(email, password);
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Metrowest Digital Mailbox</h1>
            <p className="text-sm text-gray-500">Sign in to your account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="hint: mailbox number"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="text-xs text-gray-500 text-center">
            By signing in, you agree to our{' '}
            <button
              type="button"
              onClick={() => setDisclaimerOpen(!disclaimerOpen)}
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium"
            >
              Mail Handling Policy
              {disclaimerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {disclaimerOpen && (
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                {DISCLAIMER_TEXT}
              </pre>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
