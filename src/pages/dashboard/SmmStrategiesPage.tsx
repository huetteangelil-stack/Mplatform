import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, ChevronRight, Cpu, Download, LockKeyhole, Megaphone, RefreshCw, Share2, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Business { id: string; name: string; website: string; }

interface TechItem {
  name: string;
  tag: string;
  categories: string[];
  link: string;
}

interface StrategyRecord {
  id: string;
  business_id: string | null;
  business_name: string;
  website: string;
  strategy_data: Record<string, unknown>;
  smm_strategy: SmmStrategy | null;
  tech_stack?: TechItem[] | null;
}

interface MarketContribution {
  source: string;
  customers: number;
  anchor?: string;
}

interface MarketFilter {
  criterion: string;
  justification: string;
}

interface MarketLayer {
  description: string;
  potentialCustomers: number;
  acv: number;
  marketValue: number;
  rationale: string;
  basedOnEstimates?: boolean; // true if any input behind this figure is tagged "estimate"
  contributions?: MarketContribution[]; // SOM only — the named contributions summed to get potentialCustomers
  // v1.3 (generate-content):
  targetSector?: string; // TAM only — the specific named sector, not a generic bucket
  filters?: MarketFilter[]; // SAM only — the explicit criteria behind penetrationOfTam
  funnelPotentialCustomers?: number; // SOM only — the raw funnel sum, before any capacity cap
  salesCapacityPerYear?: number | null; // SOM only — how many new customers the team can realistically onboard
  salesCapacityRationale?: string; // SOM only
  cappedByCapacity?: boolean; // SOM only — true when capacity, not lead volume, is the binding constraint
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

interface Persona {
  name: string;
  role: string;
  description: string;
  motivations: string[];
  painPoints: string[];
  kpis: string[];
  responsibilities: string[];
  reportingTo: string;
  buyingRole: string;
}

interface SmmStrategy {
  tam: MarketLayer;
  sam: MarketLayer;
  som: MarketLayer;
  personas: Persona[];
}

export function SmmStrategiesPage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [smmStrategy, setSmmStrategy] = useState<SmmStrategy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedPersona, setExpandedPersona] = useState<number | null>(null);
  const [techStack, setTechStack] = useState<TechItem[] | null>(null);
  const [isScrapingTech, setIsScrapingTech] = useState(false);
  const [techError, setTechError] = useState('');

  const selectedStrategy = useMemo(
    () => strategies.find(s => s.business_id === selectedBusinessId) ?? null,
    [strategies, selectedBusinessId],
  );

  useEffect(() => {
    const loadData = async () => {
      const [{ data: bizData }, { data: stratData }] = await Promise.all([
        supabase.from('businesses').select('id, name, website').order('name'),
        supabase.from('marketing_strategies').select('id, business_id, business_name, website, strategy_data, smm_strategy, tech_stack').order('created_at', { ascending: false }),
      ]);
      setBusinesses(bizData ?? []);
      setStrategies((stratData ?? []) as StrategyRecord[]);
      if (bizData && bizData[0]) setSelectedBusinessId(bizData[0].id);
      setIsLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedStrategy) { setSmmStrategy(null); setTechStack(null); return; }
    setSmmStrategy(selectedStrategy.smm_strategy ?? null);
    setTechStack(selectedStrategy.tech_stack ?? null);
    setExpandedPersona(null);
    setTechError('');
  }, [selectedStrategy]);

  const generateSmm = async () => {
    if (!selectedStrategy) return;
    setIsGenerating(true);
    setError('');
    try {
      // v2.3: this page only renders inside the authenticated dashboard, so a session is
      // always expected here.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée, veuillez vous reconnecter.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'smm_strategy', strategy: selectedStrategy.strategy_data }),
      });
      const result = await response.json();
      if (!response.ok || !result.tam || !result.sam || !result.som || !Array.isArray(result.personas)) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Invalid SMM strategy response');
      }
      const generated = result as SmmStrategy;
      setSmmStrategy(generated);
      await supabase.from('marketing_strategies').update({ smm_strategy: generated }).eq('id', selectedStrategy.id);
      setStrategies(prev => prev.map(s => s.id === selectedStrategy.id ? { ...s, smm_strategy: generated } : s));
    } catch {
      setError('Elsa could not generate the SMM strategy. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const scrapeTechnology = async () => {
    if (!selectedStrategy) return;
    setIsScrapingTech(true);
    setTechError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée, veuillez vous reconnecter.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-technology`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ website: selectedStrategy.website, strategyId: selectedStrategy.id }),
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.items)) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Technology scan failed');
      }
      setTechStack(result.items as TechItem[]);
      setStrategies(prev => prev.map(s => s.id === selectedStrategy.id ? { ...s, tech_stack: result.items } : s));
    } catch (e) {
      setTechError(e instanceof Error ? e.message : 'Le scan technologique a échoué. Réessayez.');
    } finally {
      setIsScrapingTech(false);
    }
  };

  const hasStrategy = (bizId: string) => strategies.some(s => s.business_id === bizId);

  if (isLoading) {
    return <div className="flex justify-center py-32"><div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  const businessesWithStrategy = businesses.filter(b => hasStrategy(b.id));

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium mb-6">
        <ArrowLeft size={17} /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMM strategies</h1>
          <p className="text-sm text-gray-500 mt-1">Market sizing (TAM, SAM, SOM) and buyer personas from your ICP</p>
        </div>
        <div className="flex items-center gap-2">
          {businessesWithStrategy.length > 0 && (
            <select
              value={selectedBusinessId}
              onChange={e => setSelectedBusinessId(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {businessesWithStrategy.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50" title="Share"><Share2 size={17} /></button>
          <button className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50" title="Download"><Download size={17} /></button>
        </div>
      </div>

      {businesses.length === 0 ? (
        <EmptyState
          title="Add a business first"
          message="You need a business with a marketing strategy before Elsa can generate an SMM strategy."
          cta="Add a business"
          onClick={() => navigate('/dashboard/businesses')}
        />
      ) : businessesWithStrategy.length === 0 ? (
        <EmptyState
          title="Generate a marketing strategy first"
          message="Elsa needs a marketing strategy and ICP to calculate your TAM, SAM, SOM and buyer personas."
          cta="Create a strategy"
          onClick={() => navigate('/strategy')}
        />
      ) : !selectedStrategy ? null : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Briefcase size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedStrategy.business_name}</p>
                <p className="text-xs text-gray-400">{selectedStrategy.website || '—'}</p>
              </div>
            </div>
            <button
              onClick={generateSmm}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isGenerating ? 'Elsa is thinking...' : smmStrategy ? 'Regenerate strategy' : 'Create new strategy'}
            </button>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

          {isGenerating && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 mb-6">
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="text-base font-semibold text-gray-800">Elsa is generating your SMM strategy...</p>
                <p className="text-sm text-gray-500 mt-1">Calculating TAM, SAM, SOM and building buyer personas from your ICP.</p>
                <p className="text-xs text-gray-400 mt-2">Please wait 1-2 minutes.</p>
              </div>
            </div>
          )}

          {smmStrategy && !isGenerating && (
            <>
              {/* TAM / SAM / SOM */}
              <div className="space-y-4 mb-8">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Target size={20} className="text-blue-600" /> Market sizing
                </h2>
                <MarketCard layer={smmStrategy.tam} label="TAM" title="Total Addressable Market" color="blue" icon={<TrendingUp size={18} />} />
                <MarketCard layer={smmStrategy.sam} label="SAM" title="Serviceable Available Market" color="green" icon={<Target size={18} />} />
                <MarketCard layer={smmStrategy.som} label="SOM" title="Serviceable Obtainable Market" color="amber" icon={<TrendingUp size={18} />} />
              </div>

              {/* Buyer Personas */}
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <Users size={20} className="text-blue-600" /> Buyer personas
                </h2>
                <div className="space-y-3">
                  {smmStrategy.personas.map((persona, index) => {
                    const isExpanded = expandedPersona === index;
                    return (
                      <div key={index} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                        <button
                          onClick={() => setExpandedPersona(isExpanded ? null : index)}
                          className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {persona.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{persona.name}</p>
                            <p className="text-xs text-gray-500">{persona.role} · {persona.buyingRole}</p>
                          </div>
                          <ChevronRight size={18} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-5 space-y-4">
                            <p className="text-sm text-gray-700 leading-relaxed">{persona.description}</p>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <PersonaList title="Motivations" items={persona.motivations} color="text-green-600" />
                              <PersonaList title="Pain points" items={persona.painPoints} color="text-red-500" />
                              <PersonaList title="KPIs" items={persona.kpis} color="text-blue-600" />
                              <PersonaList title="Responsibilities" items={persona.responsibilities} color="text-gray-600" />
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div><span className="text-gray-400">Reports to: </span><span className="text-gray-700 font-medium">{persona.reportingTo}</span></div>
                              <div><span className="text-gray-400">Buying role: </span><span className="text-gray-700 font-medium">{persona.buyingRole}</span></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
                <LockKeyhole size={13} /> Your SMM strategy is private to your account and saved automatically.
              </div>
            </>
          )}

          {!smmStrategy && !isGenerating && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Megaphone size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">No SMM strategy yet for this business.</p>
              <p className="text-xs text-gray-400">Click "Create new strategy" to let Elsa calculate your TAM, SAM, SOM and buyer personas.</p>
            </div>
          )}

          {/* Technology Scraper */}
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Cpu size={20} className="text-blue-600" /> Technology Scraper
              </h2>
              <button
                onClick={scrapeTechnology}
                disabled={isScrapingTech}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
              >
                {isScrapingTech ? (
                  <><RefreshCw size={14} className="animate-spin" /> Scan en cours...</>
                ) : techStack ? (
                  <><RefreshCw size={14} /> Relancer le scan</>
                ) : (
                  <><Cpu size={14} /> Lancer le scan</>
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Détecte les technologies utilisées sur {selectedStrategy.website} (analytics, CRM, publicité, CMS...) — utile pour qualifier rapidement où vous avez le plus de chances de pénétrer.
            </p>

            {techError && <p className="text-sm text-red-600 mb-4">{techError}</p>}

            {techStack && techStack.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="py-2 pr-4">Technologie</th>
                      <th className="py-2 pr-4">Tag</th>
                      <th className="py-2 pr-4">Catégories</th>
                      <th className="py-2">Lien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {techStack.map((t, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap">{t.name}</td>
                        <td className="py-2 pr-4">
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{t.tag}</span>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{t.categories.join(', ') || '—'}</td>
                        <td className="py-2">
                          {t.link && (
                            <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                              {t.link.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !isScrapingTech && !techError ? (
              <p className="text-sm text-gray-400">Aucun scan effectué pour le moment.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, message, cta, onClick }: { title: string; message: string; cta: string; onClick: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
      <Sparkles size={40} className="text-blue-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{message}</p>
      <button onClick={onClick} className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors">{cta}</button>
    </div>
  );
}

const COLOR_MAP = {
  blue: { badge: 'bg-blue-600', card: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
  green: { badge: 'bg-green-500', card: 'bg-green-50', border: 'border-green-100', text: 'text-green-700' },
  amber: { badge: 'bg-amber-500', card: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
};

function MarketCard({ layer, label, title, color, icon }: { layer: MarketLayer; label: string; title: string; color: keyof typeof COLOR_MAP; icon: React.ReactNode }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.card} p-5 sm:p-6`}>
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-8 h-8 rounded-lg ${c.badge} text-white flex items-center justify-center flex-shrink-0`}>{icon}</span>
        <div>
          <p className={`text-xs font-bold ${c.text}`}>{label}</p>
          <h3 className="font-bold text-gray-900 text-base">{title}</h3>
        </div>
        <span className={`ml-auto text-lg font-bold ${c.text}`}>{formatNumber(layer.marketValue)}</span>
      </div>
      {layer.targetSector && (
        <p className="text-xs font-semibold text-blue-700 bg-blue-50 inline-block px-2 py-1 rounded-lg mb-2">
          Secteur ciblé : {layer.targetSector}
        </p>
      )}
      <p className="text-sm text-gray-700 leading-relaxed mb-4">{layer.description}</p>
      {layer.basedOnEstimates && (
        <p className="text-xs font-medium text-amber-600 bg-amber-50 inline-block px-2 py-0.5 rounded-full mb-3">
          Basé en partie sur des estimations non vérifiées
        </p>
      )}
      {layer.filters && layer.filters.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Filtres appliqués</p>
          <ul className="space-y-1">
            {layer.filters.map((f, i) => (
              <li key={i} className="text-xs text-gray-600">
                <span className="font-medium text-gray-800">{f.criterion}</span> — {f.justification}
              </li>
            ))}
          </ul>
        </div>
      )}
      {layer.cappedByCapacity && (
        <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mb-4">
          Plafonné par votre capacité réelle ({formatNumber(layer.salesCapacityPerYear ?? 0)} clients/an) plutôt que par le volume de leads
          ({formatNumber(layer.funnelPotentialCustomers ?? 0)} potentiels selon le funnel). {layer.salesCapacityRationale}
        </p>
      )}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Potential customers</p>
          <p className="text-sm text-gray-800 font-medium mt-1">{formatNumber(layer.potentialCustomers)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ACV</p>
          <p className="text-sm text-gray-800 font-medium mt-1">{formatNumber(layer.acv)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Market value</p>
          <p className="text-sm text-gray-800 font-medium mt-1">{formatNumber(layer.marketValue)}</p>
        </div>
      </div>
      {layer.contributions && layer.contributions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Détail du calcul</p>
          <ul className="space-y-1">
            {layer.contributions.map((c2, i) => (
              <li key={i} className="text-xs text-gray-600 flex justify-between gap-2">
                <span>{c2.source}{c2.anchor?.trim().toLowerCase() === 'estimate' && <span className="text-amber-600"> (estimation)</span>}</span>
                <span className="font-medium text-gray-800">{formatNumber(c2.customers)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-4 leading-relaxed">{layer.rationale}</p>
    </div>
  );
}

function PersonaList({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-700">
            <span className={`font-bold flex-shrink-0 ${color}`}>·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
