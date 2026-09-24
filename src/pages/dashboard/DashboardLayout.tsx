import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users,
  Megaphone, PenLine, LogOut, CreditCard, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/i18n';

export function DashboardLayout() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userEmail, setUserEmail] = useState<string>('');
  const [isJourneyOpen, setIsJourneyOpen] = useState(false);
  const [counts, setCounts] = useState({ businesses: 0, strategies: 0, content: 0 });

  const navItems = [
    { to: '/dashboard/businesses', icon: Briefcase, label: t('dash.myBusinesses') },
    { to: '/dashboard/content', icon: PenLine, label: t('dash.contentCreation') },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/signin'); return; }
      setUserEmail(session.user.email ?? '');
    });
  }, [navigate]);

  useEffect(() => {
    const fetchCounts = async () => {
      const [b, s, c] = await Promise.all([
        supabase.from('businesses').select('id', { count: 'exact', head: true }),
        supabase.from('marketing_strategies').select('id', { count: 'exact', head: true }),
        supabase.from('content_tasks').select('id', { count: 'exact', head: true }),
      ]);
      setCounts({ businesses: b.count ?? 0, strategies: s.count ?? 0, content: c.count ?? 0 });
    };
    fetchCounts();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const progressSteps = [counts.businesses > 0, counts.strategies > 0, counts.content > 0];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full overflow-y-auto">
        <div className="px-4 pt-5 pb-4 border-b border-gray-100">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400 text-yellow-900 font-bold text-sm rounded-full tracking-wide">
            AI STRATEGY
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavLink to="/dashboard" end className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`
          }>
            <LayoutDashboard size={18} />
            {t('dash.getStarted')}
          </NavLink>

          <div className="pt-3 pb-1 px-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ELSA AI</span>
          </div>

          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`
            }>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          <NavLink to="/dashboard/icp" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`
          }>
            <Users size={18} />
            {t('dash.icp')}
          </NavLink>

          <NavLink to="/dashboard/smm" className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`
          }>
            <Megaphone size={18} />
            {t('dash.smm')}
          </NavLink>
        </nav>

        <div className="mx-3 mb-3">
          <button onClick={() => setIsJourneyOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2.5 border border-blue-200 bg-blue-50 rounded-xl text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors">
            <span>{t('dash.journey')}</span>
            <ChevronDown size={16} className={`transition-transform ${isJourneyOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex gap-1.5 mt-2 px-1">
            {progressSteps.map((done, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
            ))}
          </div>
          {isJourneyOpen && (
            <div className="mt-2 px-1 space-y-1 text-xs text-gray-500">
              <p className={counts.businesses > 0 ? 'text-green-600 font-medium' : ''}>
                {counts.businesses > 0 ? '✓' : '○'} {t('dash.journeyBusiness')}
              </p>
              <p className={counts.strategies > 0 ? 'text-green-600 font-medium' : ''}>
                {counts.strategies > 0 ? '✓' : '○'} {t('dash.journeyStrategy')}
              </p>
              <p className={counts.content > 0 ? 'text-green-600 font-medium' : ''}>
                {counts.content > 0 ? '✓' : '○'} {t('dash.journeyContent')}
              </p>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">{t('dash.freeSubscription')}</p>
          <button onClick={() => navigate('/pricing')} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            {t('dash.upgradeNow')}
          </button>
        </div>

        <div className="border-t border-gray-100 px-3 py-3 flex items-center justify-between">
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <LogOut size={16} />
            {t('dash.logout')}
          </button>
          <button onClick={() => navigate('/pricing')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <CreditCard size={16} />
            {t('dash.billing')}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet context={{ completedSteps: progressSteps.filter(Boolean).length, userEmail, refreshCounts: async () => {
          const [b, s, c] = await Promise.all([
            supabase.from('businesses').select('id', { count: 'exact', head: true }),
            supabase.from('marketing_strategies').select('id', { count: 'exact', head: true }),
            supabase.from('content_tasks').select('id', { count: 'exact', head: true }),
          ]);
          setCounts({ businesses: b.count ?? 0, strategies: s.count ?? 0, content: c.count ?? 0 });
        }}} />
      </main>
    </div>
  );
}
