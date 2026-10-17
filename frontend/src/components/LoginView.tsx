import React, { useState } from 'react';
import { Github, Shield, Cpu, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../api';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubOAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await api.getGitHubAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'GitHub OAuth is not configured on the backend yet. You can sign in using Dev Mode below.');
      setLoading(false);
    }
  };

  const handleDevSignIn = async (username: string, name: string, email: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.devLogin(username, name, email);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Dev login failed.');
    } finally {
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">
              Or Fast Dev Sign-In
            </span>
          </div>
        </div>

        {/* Quick Dev Sign-In Options */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-1">
            Sign In As Team Member:
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDevSignIn('foez-ahmed', 'Foez Ahmed', 'foez.ahmed@adnsemicon.com')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-adn-400 hover:bg-slate-50 text-left transition-all text-xs font-semibold text-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <img
                src="https://github.com/foez-ahmed.png"
                alt="Foez"
                className="w-7 h-7 rounded-full bg-slate-100"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="text-slate-900 font-bold">Foez Ahmed</div>
                <div className="text-[10px] text-slate-400">foez.ahmed@adnsemicon.com</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDevSignIn('m-reyad', 'Mohiuddin Reyad', 'mohiuddin.reyad@adnsemicon.com')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-adn-400 hover:bg-slate-50 text-left transition-all text-xs font-semibold text-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <img
                src="https://github.com/m-reyad.png"
                alt="Mohiuddin"
                className="w-7 h-7 rounded-full bg-slate-100"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="text-slate-900 font-bold">Mohiuddin Reyad</div>
                <div className="text-[10px] text-slate-400">mohiuddin.reyad@adnsemicon.com</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDevSignIn('farhan-efty', 'Farhan Efty', 'farhan.efty@adnsemicon.com')}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-adn-400 hover:bg-slate-50 text-left transition-all text-xs font-semibold text-slate-800"
          >
            <div className="flex items-center gap-2.5">
              <img
                src="https://github.com/farhan-efty.png"
                alt="Farhan"
                className="w-7 h-7 rounded-full bg-slate-100"
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="text-slate-900 font-bold">Farhan Efty</div>
                <div className="text-[10px] text-slate-400">farhan.efty@adnsemicon.com</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
