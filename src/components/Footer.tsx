import { Twitter, Linkedin, Github } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function Footer() {
  const { t } = useLanguage();

  const navigation = {
    product: [
      { name: t('nav.features'), href: '#features' },
      { name: t('nav.pricing'), href: '/pricing' },
      { name: 'API', href: '#' },
      { name: 'Integrations', href: '#' },
    ],
    company: [
      { name: t('nav.about'), href: '#' },
      { name: 'Blog', href: '#' },
      { name: 'Careers', href: '#' },
      { name: t('pricing.contactUs'), href: '#' },
    ],
    resources: [
      { name: 'Documentation', href: '#' },
      { name: 'Help Center', href: '#' },
      { name: 'Community', href: '#' },
      { name: 'Status', href: '#' },
    ],
    legal: [
      { name: 'Privacy', href: '#' },
      { name: 'Terms', href: '#' },
      { name: 'Security', href: '#' },
      { name: 'Cookies', href: '#' },
    ],
  };

  const socialLinks = [
    { name: 'Twitter', icon: Twitter, href: '#' },
    { name: 'LinkedIn', icon: Linkedin, href: '#' },
    { name: 'GitHub', icon: Github, href: '#' },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <span className="text-3xl font-bold text-white">M1</span>
            <p className="mt-4 text-sm text-gray-400">
              {t('footer.tagline')}
            </p>
            <div className="flex gap-4 mt-6">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                    aria-label={social.name}
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          {[
            { title: t('footer.product'), items: navigation.product },
            { title: t('footer.company'), items: navigation.company },
            { title: t('footer.resources'), items: navigation.resources },
            { title: t('footer.legal'), items: navigation.legal },
          ].map((section) => (
            <div key={section.title}>
              <h3 className="text-white font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <a href={item.href} className="text-sm hover:text-white transition-colors">
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 pt-8">
          <p className="text-sm text-gray-400 text-center">
            © {new Date().getFullYear()} M1 Project. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
