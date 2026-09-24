import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, ChevronRight, Download, LockKeyhole, Megaphone, RefreshCw, Share2, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Business { id: string; name: string; website: string; }

interface StrategyRecord {
  id: string;
  business_id: string | null;
  business_name: string;
  website: string;
  strategy_data: Record<string, unknown>;
  smm_strategy: SmmStrategy | null;
}

interface MarketLayer {
  description: string;
  potentialCustomers: string;
  acv: string;
  marketValue: string;
  rationale: string;
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

  const selectedStrategy = useMemo(
    () => strategies.find(s => s.business_id === selectedBusinessId) ?? null,
    [strategies, selectedBusinessId],
  );

  useEffect(() => {
    const loadData = async () => {
      const [{ data: bizData }, { data: stratData }] = await Promise.all([
        supabase.from('businesses').select('id, name, website').order('name'),
        supabase.from('marketing_strategies').select('id, business_id, business_name, website, strategy_data, smm_strategy').order('created_at', { ascending: false }),
      ]);
      setBusinesses(bizData ?? []);
      setStrategies((stratData ?? []) as StrategyRecord[]);
      if (bizData && bizData[0]) setSelectedBusinessId(bizData[0].id);
      setIsLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedStrategy) { setSmmStrategy(null); return; }
    setSmmStrategy(selectedStrategy.smm_strategy ?? null);
    setExpandedPersona(null);
  }, [selectedStrategy]);

  const generateSmm = async () => {
    if (!selectedStrategy) return;
    setIsGenerating(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
        <span className={`ml-auto text-lg font-bold ${c.text}`}>{layer.marketValue}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed mb-4">{layer.description}</p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Potential customers</p>
          <p className="text-sm text-gray-800 font-medium mt-1">{layer.potentialCustomers}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ACV</p>
          <p className="text-sm text-gray-800 font-medium mt-1">{layer.acv}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Market value</p>
          <p className="text-sm text-gray-800 font-medium mt-1">{layer.marketValue}</p>
        </div>
      </div>
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
