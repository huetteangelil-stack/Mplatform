import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/i18n';

export function SignUpPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', company: '', password: '', confirmPassword: '', agreeTerms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) { setError(t('auth.firstNameRequired')); return false; }
    if (!formData.lastName.trim()) { setError(t('auth.lastNameRequired')); return false; }
    if (!formData.email.trim()) { setError(t('auth.emailRequired')); return false; }
    if (!formData.company.trim()) { setError(t('auth.companyRequired')); return false; }
    if (formData.password.length < 6) { setError(t('auth.passwordMinLength')); return false; }
    if (formData.password !== formData.confirmPassword) { setError(t('auth.passwordsDontMatch')); return false; }
    if (!formData.agreeTerms) { setError(t('auth.mustAgreeTerms')); return false; }
    return true;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { firstName: formData.firstName, lastName: formData.lastName, company: formData.company, phone: formData.phone } },
      });

      if (signUpError) { setError(signUpError.message); return; }
      if (authData?.user && authData.user.identities && authData.user.identities.length === 0) {
        setError(t('auth.accountExists')); return;
      }
      if (!authData?.user) { setError(t('auth.failedCreateUser')); return; }

      await new Promise(resolve => setTimeout(resolve, 1000));

      let profileCreated = false;
      let attempts = 0;
      while (!profileCreated && attempts < 3) {
        try {
          attempts++;
          const { error: profileError } = await supabase.from('user_profiles')
            .insert({ id: authData.user.id, email: formData.email, full_name: `${formData.firstName} ${formData.lastName}` }).select();
          if (profileError) {
            if (profileError.code === '23505') { profileCreated = true; break; }
            if (attempts === 3) throw profileError;
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            profileCreated = true;
          }
        } catch { if (attempts === 3) break; }
      }

      if (authData.session) { navigate('/dashboard'); } else { sessionStorage.setItem('pendingEmail', formData.email); navigate('/dashboard'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 py-16">
        <button type="button" onClick={() => navigate('/')} className="flex items-center text-blue-600 hover:text-blue-700 mb-8 transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          {t('auth.back')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.createAccount')}</h1>
          <p className="text-gray-600">{t('auth.joinTeams')}</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.firstName')}</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.lastName')}</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="Doe" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.workEmail')}</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="john@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.phone')}</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="+1 (555) 000-0000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.companyName')}</label>
            <input type="text" name="company" value={formData.company} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="Acme Inc." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="••••••••" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.confirmPassword')}</label>
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm" placeholder="••••••••" />
          </div>

          <div className="flex items-start">
            <input type="checkbox" name="agreeTerms" checked={formData.agreeTerms} onChange={handleChange} className="mt-1 rounded border-gray-300" />
            <label className="ml-2 text-sm text-gray-600">
              {t('auth.agreeTerms')}
            </label>
          </div>

          <button type="submit" disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('auth.creatingAccount') : t('auth.signUp')}
          </button>

          <p className="text-center text-sm text-gray-600">
            {t('auth.haveAccount')}{' '}
            <button type="button" onClick={() => navigate('/signin')} className="text-blue-600 hover:text-blue-700 font-medium">
              {t('auth.signin')}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
