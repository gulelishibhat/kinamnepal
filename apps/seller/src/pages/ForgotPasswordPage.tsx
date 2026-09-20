import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSellerForgotPassword } from '@/hooks/useSellerAuth';

export default function ForgotPasswordPage() {
  const forgot = useSellerForgotPassword();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) { setError('Enter a valid email address'); return; }
    setError('');
    await forgot.mutateAsync(email);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="KinamNepal" className="h-14 w-14 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
          <p className="text-gray-500 text-sm mt-1">We'll email you a reset link.</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="h-14 w-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-700">
              If a seller account exists for <span className="font-medium">{email}</span>, a reset link is on its way. Check your inbox (and spam folder).
            </p>
            <Link to="/login" className="btn-primary w-full py-3 inline-block text-center">Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <button type="submit" disabled={forgot.isPending} className="btn-primary w-full py-3">
              {forgot.isPending ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link to="/login" className="text-primary-700 font-medium hover:underline">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
