import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { CustomerInbox } from './pages/CustomerInbox';
import { AdminDashboard } from './pages/AdminDashboard';

export default function App() {
  const { session, profile, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!session || !profile) {
    return <Login onSignIn={signIn} />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard profile={profile} onSignOut={signOut} />;
  }

  return <CustomerInbox profile={profile} onSignOut={signOut} />;
}
