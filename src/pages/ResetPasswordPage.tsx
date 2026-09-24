import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CircleCheck as CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/i18n';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    if (!accessToken || type !== 'recovery') {
      setError(t('reset.invalidLink'));
    }
  }, [searchParams, t]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError(t('auth.passwordMinLength')); return; }
    if (password !== confirmPassword) { setError(t('auth.passwordsDontMatch')); return; }
    setLoading(true);
    try {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      if (!accessToken) { setError(t('reset.invalidResetLink')); return; }
      const { error: sessionError } = await supabase.auth.setSession(accessToken, hashParams.get('refresh_token') || '');
      if (sessionError) { setError(sessionError.message); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(updateError.message); return; }
      setSuccess(true);
      setTimeout(() => navigate('/signin'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.anErrorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="text-green-600" size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('reset.updated')}</h1>
          <p className="text-gray-600 mb-4">{t('reset.updatedDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('reset.title')}</h1>
          <p className="text-gray-600">{t('reset.desc')}</p>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{error}</div>}
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('reset.newPassword')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                placeholder={t('reset.placeholderNew')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('reset.confirmPassword')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                placeholder={t('reset.placeholderConfirm')} />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('reset.updating') : t('reset.update')}
          </button>
        </form>
      </div>
    </div>
  );
}
