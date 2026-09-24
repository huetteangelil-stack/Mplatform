import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { Footer } from '../components/Footer';
import { useLanguage } from '../lib/i18n';

const TIERS = [
  { credits: 200, price: 80, basePrice: 80 },
  { credits: 500, price: 180, basePrice: 200 },
  { credits: 1000, price: 340, basePrice: 400 },
];

export function PricingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [tierIndex, setTierIndex] = useState(0);

  const tier = TIERS[tierIndex];
  const discount = Math.round((1 - tier.price / tier.basePrice) * 100);
  const saved = tier.basePrice - tier.price;

  const costItems: [string, string][] = [
    [t('pricing.icp'), `50 ${t('pricing.credits')}`],
    [t('pricing.marketingStrategy'), `50 ${t('pricing.credits')}`],
    [t('pricing.smmStrategy'), `80 ${t('pricing.credits')}`],
    [t('pricing.socialPost'), `10 ${t('pricing.credits')}`],
    [t('pricing.bannerAd'), `10 ${t('pricing.credits')}`],
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              {t('pricing.title')}
            </h1>
            <p className="text-lg text-gray-500">
              {t('pricing.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-8 sm:p-10 text-white">
              <p className="font-semibold text-blue-100 text-sm mb-1">
                {t('pricing.subtitle')}
              </p>
              <p className="text-blue-200 text-sm mb-8">
                {t('pricing.monthlyRenew')}
              </p>

              <div className="text-center mb-6">
                <span className="text-6xl font-bold">{tier.credits.toLocaleString()}</span>
                <span className="text-xl ml-2 text-blue-100">{t('pricing.creditsMonth')}</span>
              </div>

              <div className="mb-2 px-1">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={tierIndex}
                  onChange={(e) => setTierIndex(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-white"
                  style={{
                    background: `linear-gradient(to right, white ${tierIndex * 50}%, rgba(255,255,255,0.3) ${tierIndex * 50}%)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-blue-200 px-1 mb-10">
                <span>200</span>
                <span>500</span>
                <span>1,000</span>
              </div>

              <div>
                <p className="font-bold text-white mb-3">{t('pricing.costPerItem')}</p>
                <ul className="space-y-1.5 text-sm text-blue-100">
                  {costItems.map(([label, value]) => (
                    <li key={label} className="flex justify-between">
                      <span>{label}</span>
                      <span className="font-semibold text-white">= {value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white p-8 sm:p-10 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none"
                style={{
                  backgroundImage: `radial-gradient(circle at 60% 40%, #3b82f6 0%, transparent 60%), radial-gradient(circle at 30% 70%, #6366f1 0%, transparent 50%)`,
                }}>
              </div>

              <div className="relative z-10 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('pricing.totalBilled')}</h2>
                <p className="text-gray-500 text-sm mb-8">{t('pricing.monthlyRenew')}</p>

                <div className="mb-8">
                  <span className="text-4xl font-bold text-green-500 align-top mt-3 mr-1">$</span>
                  <span className="text-7xl font-extrabold text-green-500">{tier.price}</span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-10">
                  <p>
                    {t('pricing.originalPrice')}{' '}
                    <span className="font-semibold text-gray-900">${tier.basePrice}</span>
                  </p>
                  <p>
                    {t('pricing.discount')}{' '}
                    <span className={`font-semibold ${discount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      {discount}%
                    </span>
                  </p>
                  <p>
                    {t('pricing.totalSaved')}{' '}
                    <span className={`font-semibold ${saved > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      ${saved}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => navigate('/signup')}
                  className="w-full py-4 px-8 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {t('pricing.buyCredits')}
                </button>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-500 text-sm mb-4">{t('pricing.customPlan')}</p>
            <button className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold">
              {t('pricing.contactUs')}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
