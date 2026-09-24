import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/i18n';

export function SignInPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email.trim() || !formData.password.trim()) {
      setError(t('auth.enterEmailPassword'));
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.anErrorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-16">
        <button onClick={() => navigate('/')} className="flex items-center text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          {t('auth.back')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.welcomeBack')}</h1>
          <p className="text-gray-600">{t('auth.signinToContinue')}</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              placeholder="john@company.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              placeholder="••••••••" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-gray-300" />
              <label className="ml-2 text-sm text-gray-600">{t('auth.rememberMe')}</label>
            </div>
            <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              {t('auth.forgotPassword')}
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('auth.signingIn') : t('auth.signin')}
          </button>

          <p className="text-center text-sm text-gray-600">
            {t('auth.noAccount')}{' '}
            <button onClick={() => navigate('/signup')} className="text-blue-600 hover:text-blue-700 font-medium">
              {t('auth.signUp')}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
