import { useNavigate } from 'react-router-dom';
import { Building2, Lightbulb, PenLine, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../lib/i18n';

export function DashboardHomePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const steps = [
    { icon: Building2, title: t('dashHome.step1Title'), description: t('dashHome.step1Desc'), cta: t('dashHome.step1Cta'), to: '/dashboard/businesses', color: 'bg-blue-50 text-blue-600' },
    { icon: Lightbulb, title: t('dashHome.step2Title'), description: t('dashHome.step2Desc'), cta: t('dashHome.step2Cta'), to: '/strategy', color: 'bg-green-50 text-green-600' },
    { icon: PenLine, title: t('dashHome.step3Title'), description: t('dashHome.step3Desc'), cta: t('dashHome.step3Cta'), to: '/dashboard/content', color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('dashHome.title')}</h1>
      <p className="text-gray-400 text-sm mb-10">{t('dashHome.subtitle')}</p>

      <div className="max-w-2xl space-y-4">
        {steps.map(({ icon: Icon, title, description, cta, to, color }, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-5 hover:shadow-sm transition-shadow">
            <div className={'w-12 h-12 rounded-xl ' + color + ' flex items-center justify-center flex-shrink-0'}>
              <Icon size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
              </div>
              <p className="text-gray-500 text-xs ml-7">{description}</p>
            </div>
            <button onClick={() => navigate(to)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0">
              {cta}
              <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
