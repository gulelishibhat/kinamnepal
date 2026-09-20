import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function VerifyBanner() {
  const [sending, setSending] = useState(false);
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data as { emailVerified?: boolean };
    },
  });

  // Only nag when we know the account is explicitly unverified.
  if (!me || me.emailVerified !== false) return null;

  async function resend() {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent. Check your inbox.');
    } catch {
      toast.error('Could not send verification email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex items-center justify-between gap-3">
      <p className="text-sm text-yellow-800">
        Please verify your email address to secure your seller account.
      </p>
      <button onClick={resend} disabled={sending} className="text-sm font-medium text-yellow-900 underline disabled:opacity-50 min-h-0 min-w-0">
        {sending ? 'Sending…' : 'Resend email'}
      </button>
    </div>
  );
}
