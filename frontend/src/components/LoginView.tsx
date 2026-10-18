import React, { useEffect, useState } from 'react';
import { Github, Shield, Cpu } from 'lucide-react';
import { api } from '../api';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('approval') !== 'pending') return;

    setApprovalPending(true);
    url.searchParams.delete('approval');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const handleGitHubOAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.getGitHubAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate GitHub sign-in.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl border border-slate-200/90 shadow-lg">
        {/* Logo and title */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-adn-600 to-adn-800 text-white flex items-center justify-center mx-auto shadow-md shadow-adn-600/30">
            <Cpu className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            ADN Semiconductor
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Employee Daily Update & Reporting Portal (EMS)
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            {error}
          </div>
        )}
        {approvalPending && (
          <div role="status" className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
            Your request to join EMS has been received. An administrator must approve your account before you can sign in.
          </div>
        )}

        {/* GitHub Sign in */}
        <div className="space-y-4">
          <button
            type="button"
            disabled={loading}
            onClick={handleGitHubOAuth}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            <Github className="w-5 h-5" />
            <span>Sign in with GitHub</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure read-only authentication • Zero PATs required</span>
          </div>
        </div>
      </div>
    </div>
  );
};
