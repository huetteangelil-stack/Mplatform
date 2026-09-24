import { Zap, Target, TrendingUp, Shield, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/i18n';

export function Features() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const features = [
    { icon: Zap, title: t('features.f1Title'), description: t('features.f1Desc') },
    { icon: Target, title: t('features.f2Title'), description: t('features.f2Desc') },
    { icon: TrendingUp, title: t('features.f3Title'), description: t('features.f3Desc') },
    { icon: Shield, title: t('features.f4Title'), description: t('features.f4Desc') },
    { icon: Clock, title: t('features.f5Title'), description: t('features.f5Desc') },
    { icon: Users, title: t('features.f6Title'), description: t('features.f6Desc') },
  ];

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            {t('features.title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group p-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-300">
                  <Icon className="text-blue-600 group-hover:text-white transition-colors" size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-12 text-center text-white shadow-2xl">
          <h3 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('features.ctaTitle')}
          </h3>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            {t('features.ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/strategy')}
              className="px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-gray-100 transition-colors font-semibold text-lg"
            >
              {t('features.ctaStart')}
            </button>
            <button className="px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-400 transition-colors font-semibold text-lg border-2 border-white/30">
              {t('features.ctaDemo')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
