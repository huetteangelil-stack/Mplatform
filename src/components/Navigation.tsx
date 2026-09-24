import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage, type Language } from '../lib/i18n';

export function Navigation() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              M1
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              {t('nav.features')}
            </a>
            <Link to="/pricing" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
              {t('nav.pricing')}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user && <FlagToggle lang={lang} setLang={setLang} />}
            {user ? (
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium"
              >
                {t('nav.signout')}
              </button>
            ) : (
              <>
                <FlagToggle lang={lang} setLang={setLang} />
                <Link to="/signin" className="text-gray-600 hover:text-blue-600 transition-colors text-sm font-medium">
                  {t('nav.signin')}
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {t('nav.getStarted')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function FlagToggle({ lang, setLang }: { lang: Language; setLang: (lang: Language) => void }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Language selector">
      <FlagButton
        active={lang === 'fr'}
        onClick={() => setLang('fr')}
        tooltip="Français"
        flagSvg={
          <svg viewBox="0 0 24 24" className="w-4 h-4 rounded-sm overflow-hidden" role="img" aria-label="Français">
            <rect width="8" height="24" fill="#0055A4" />
            <rect x="8" width="8" height="24" fill="#FFFFFF" />
            <rect x="16" width="8" height="24" fill="#EF4135" />
          </svg>
        }
      />
      <FlagButton
        active={lang === 'en'}
        onClick={() => setLang('en')}
        tooltip="English"
        flagSvg={
          <svg viewBox="0 0 24 24" className="w-4 h-4 rounded-sm overflow-hidden" role="img" aria-label="English">
            <rect width="24" height="24" fill="#012169" />
            <path d="M0,0 L24,24 M24,0 L0,24" stroke="#FFFFFF" strokeWidth="3" />
            <path d="M0,0 L24,24 M24,0 L0,24" stroke="#C8102E" strokeWidth="1.5" />
            <path d="M12,0 V24 M0,12 H24" stroke="#FFFFFF" strokeWidth="5" />
            <path d="M12,0 V24 M0,12 H24" stroke="#C8102E" strokeWidth="3" />
          </svg>
        }
      />
    </div>
  );
}

function FlagButton({ active, onClick, tooltip, flagSvg }: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  flagSvg: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`relative transition-all duration-300 rounded-full ${
        active
          ? 'opacity-100 scale-110 ring-1.5 ring-blue-500 ring-offset-0.5 ring-offset-white'
          : 'opacity-40 grayscale hover:opacity-70 hover:scale-110'
      }`}
    >
      {flagSvg}
    </button>
  );
}
