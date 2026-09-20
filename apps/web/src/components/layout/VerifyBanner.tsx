import { useMe, useResendVerification } from '@/hooks/useAuth';

// Allow-but-nag banner: shown to logged-in customers whose email is not verified.
export default function VerifyBanner() {
  const { data: me } = useMe();
  const resend = useResendVerification();

  if (!me || me.emailVerified !== false) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-amber-800">
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          Please verify your email address to secure your account.
        </span>
        <button
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="min-h-0 min-w-0 font-semibold underline hover:text-amber-900 disabled:opacity-50"
        >
          {resend.isPending ? 'Sending…' : 'Resend verification email'}
        </button>
      </div>
    </div>
  );
}
