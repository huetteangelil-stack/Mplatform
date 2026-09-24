import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, CircleCheck as CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/i18n';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!email.trim()) { setError(t('forgot.enterEmail')); setLoading(false); return; }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) { setError(resetError.message); return; }
      const generated = Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 54)]).join('');
      setNewPassword(generated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.anErrorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-16">
        <button onClick={() => navigate('/signin')} className="flex items-center text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          {t('forgot.backToSignin')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('forgot.title')}</h1>
          <p className="text-gray-600">{t('forgot.desc')}</p>
        </div>

        {!success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="john@company.com" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? t('forgot.processing') : t('forgot.generate')}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-green-600" size={32} />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('forgot.emailSent')}</h2>
              <p className="text-gray-600 text-sm mb-6">
                {t('forgot.emailSentDesc')} <strong>{email}</strong>. {t('forgot.clickLink')}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2 font-medium">{t('forgot.suggestedPassword')}</p>
              <div className="flex items-center justify-between bg-white rounded px-3 py-2 border border-blue-200">
                <code className="text-lg font-mono text-gray-900">{newPassword}</code>
                <button onClick={() => navigator.clipboard.writeText(newPassword)} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  {t('forgot.copy')}
                </button>
              </div>
            </div>
            <button onClick={() => navigate('/signin')} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              {t('forgot.backToSignin')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
