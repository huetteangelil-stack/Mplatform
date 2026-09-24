import { Star, Award, TrendingUp } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function PreFooter() {
  const { t } = useLanguage();

  const stats = [
    { icon: Star, value: '50K+', label: t('prefooter.statsUsers') },
    { icon: Award, value: '4.9/5', label: t('prefooter.statsRating') },
    { icon: TrendingUp, value: '300%', label: t('prefooter.statsRoi') },
  ];

  const testimonials = [
    { quote: t('prefooter.t1Quote'), author: t('prefooter.t1Author'), role: t('prefooter.t1Role'), company: t('prefooter.t1Company') },
    { quote: t('prefooter.t2Quote'), author: t('prefooter.t2Author'), role: t('prefooter.t2Role'), company: t('prefooter.t2Company') },
    { quote: t('prefooter.t3Quote'), author: t('prefooter.t3Author'), role: t('prefooter.t3Role'), company: t('prefooter.t3Company') },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="text-center p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <Icon className="text-blue-600" size={28} />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            );
          })}
        </div>

        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            {t('prefooter.title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('prefooter.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="p-8 bg-white rounded-2xl shadow-lg border border-gray-100 hover:border-blue-300 hover:shadow-xl transition-all duration-300">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 mb-6 leading-relaxed italic">
                "{testimonial.quote}"
              </p>
              <div className="border-t border-gray-100 pt-4">
                <div className="font-bold text-gray-900">{testimonial.author}</div>
                <div className="text-sm text-gray-600">
                  {testimonial.role} at {testimonial.company}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
