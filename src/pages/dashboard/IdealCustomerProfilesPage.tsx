import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Download, LockKeyhole, RefreshCw, Share2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface IcpDescription {
  overview: string;
  offer: string;
  howItWorks: string;
  capabilities: string[];
  benefits: string[];
  differentiation: string[];
}

interface IcpData {
  description: IcpDescription;
  needs: { title: string; fulfillment: string }[];
  problems: { title: string; context: string }[];
  demographics: string;
  psychographics: string;
  painPoints: string[];
  goals: string[];
}

interface StrategyData {
  icp?: IcpData;
  channels?: { primary?: string[]; secondary?: string[] };
  tactics?: string[];
  kpis?: string[];
  timeline?: string;
}

interface StrategyRecord {
  id: string;
  business_name: string;
  website: string;
  strategy_data: StrategyData;
  icp_insights: InsightGroup[] | null;
}

interface InsightItem {
  title: string;
  description: string;
  count?: number;
}

interface InsightGroup {
  title: string;
  items: InsightItem[];
}

const FALLBACK_GROUPS: InsightGroup[] = [
  { title: 'Customer overview', items: [{ title: 'Jobs-to-be-Done', description: 'Key tasks and responsibilities of customers' }] },
  { title: 'Goals, challenges & motivation', items: [
    { title: 'Problems', description: 'Challenges and roadblocks that stand in customers way' },
    { title: 'Pain points and frustrations', description: 'How problems impact customers', count: 3 },
    { title: 'Decision triggers', description: 'What makes customers look for a new solution', count: 2 },
  ] },
  { title: 'Buying behavior', items: [
    { title: 'Alternative solutions', description: "Tools or methods solving customer's problem" },
    { title: 'Existing knowledge', description: 'What customers already know about the issue and solutions' },
    { title: 'Buying criteria', description: 'What customers look for when choosing a solution', count: 2 },
  ] },
  { title: 'Marketing and communication', items: [
    { title: 'Best channels to reach customers', description: 'Where you can effectively engage customers', count: 1 },
    { title: '20+ places where customers spend time', description: 'Places customers engage online and offline', count: 2 },
    { title: 'Preferred communication channels', description: 'How customers like to connect' },
    { title: 'Essential tools', description: 'Software and resources customers rely on' },
    { title: 'Information sources buyer trusts', description: 'Where customers get industry insights', count: 1 },
  ] },
];

export function IdealCustomerProfilesPage() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [insights, setInsights] = useState<InsightGroup[]>([]);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const selectedStrategy = useMemo(
    () => strategies.find(strategy => strategy.id === selectedStrategyId) ?? strategies[0] ?? null,
    [selectedStrategyId, strategies],
  );
  const icp = selectedStrategy?.strategy_data.icp;

  useEffect(() => {
    const loadStrategies = async () => {
      const { data, error: queryError } = await supabase
        .from('marketing_strategies')
        .select('id, business_name, website, strategy_data, icp_insights')
        .order('created_at', { ascending: false });
      if (queryError) {
        setError('Unable to load your marketing strategies.');
      } else {
        const records = (data ?? []) as StrategyRecord[];
        setStrategies(records);
        if (records[0]) {
          setSelectedStrategyId(records[0].id);
          setInsights(records[0].icp_insights ?? []);
        }
      }
      setIsLoading(false);
    };
    loadStrategies();
  }, []);

  useEffect(() => {
    if (!selectedStrategy) return;
    setInsights(selectedStrategy.icp_insights ?? []);
    setExpandedInsight(null);
  }, [selectedStrategy]);

  const generateInsights = async () => {
    if (!selectedStrategy || !selectedStrategy.strategy_data.icp) return;
    setIsGenerating(true);
    setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'icp_insights', strategy: selectedStrategy.strategy_data }),
      });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.groups) || result.groups.length === 0) {
        throw new Error('Invalid insights response');
      }
      const generatedGroups = result.groups as InsightGroup[];
      setInsights(generatedGroups);
      await supabase.from('marketing_strategies').update({ icp_insights: generatedGroups }).eq('id', selectedStrategy.id);
      setStrategies(previous => previous.map(strategy => strategy.id === selectedStrategy.id
        ? { ...strategy, icp_insights: generatedGroups }
        : strategy));
    } catch {
      setError('Elsa could not generate the customer insights. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const displayGroups = insights.length > 0 ? insights : FALLBACK_GROUPS;
  const insightCount = displayGroups.reduce((total, group) => total + group.items.length, 0);
  const segment = icp?.demographics || 'Your ideal customer segment';
  const persona = icp?.psychographics || 'Your key decision-maker and buyer persona';
  const companyProfile = icp?.description?.overview || 'Key firmographic details of the ideal customer';
  const barriers = icp?.problems?.map(problem => problem.title).join(' · ') || 'Why customers might hesitate to buy';
  const goals = icp?.goals?.slice(0, 3).join(' · ') || 'What customers want to achieve';

  if (isLoading) {
    return <div className="flex justify-center py-32"><div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  if (!selectedStrategy || !icp) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-12">
          <Sparkles size={40} className="text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create your Ideal Customer Profile</h1>
          <p className="text-gray-500 mb-6">Generate a marketing strategy first so Elsa can build the customer insights.</p>
          <button onClick={() => navigate('/strategy')} className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors">Create a strategy</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/dashboard/strategies')} className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium mb-6">
        <ArrowLeft size={17} /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ideal customer profile</h1>
          <p className="text-sm text-gray-500 mt-1">Built from your saved marketing strategy</p>
        </div>
        <div className="flex items-center gap-2">
          {strategies.length > 1 && (
            <select value={selectedStrategy.id} onChange={event => setSelectedStrategyId(event.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {strategies.map(strategy => <option key={strategy.id} value={strategy.id}>{strategy.business_name}</option>)}
            </select>
          )}
          <button className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50" title="Share"><Share2 size={17} /></button>
          <button className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50" title="Download"><Download size={17} /></button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-7 grid md:grid-cols-3 gap-6 mb-6">
        <ProfileSummary label="Request" value="B2B" color="bg-blue-600" />
        <ProfileSummary label="Segment" value={segment} color="bg-green-500" />
        <ProfileSummary label="Persona" value={persona} color="bg-green-500" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <p className="text-sm text-gray-600">This is your free ICP. Elsa uses your strategy to reveal the customer insights below.</p>
        <button onClick={generateInsights} disabled={isGenerating} className="flex items-center justify-center gap-2 px-5 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
          {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isGenerating ? 'Elsa is thinking...' : insights.length > 0 ? 'Refresh insights' : 'Generate insights'}
        </button>
      </div>

      <div className="space-y-2 mb-8">
        <ProfileRow title="Segment description" description={segment} />
        <ProfileRow title="Company profile" description={companyProfile} />
        <ProfileRow title="Buyer persona" description={persona} />
        <ProfileRow title="Barriers" description={barriers} badge="Proof checked" />
        <ProfileRow title="Goals and objectives" description={goals} badge="Proof checked" />
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{error}</div>}

      <div className="mb-5">
        <h2 className="text-lg font-bold text-blue-700">Elsa found {insightCount} customer insights!</h2>
        <p className="text-sm text-blue-600 mt-1">Insights help refine your marketing strategy, strengthen positioning, and deepen customer understanding to drive growth.</p>
      </div>

      <div className="border-t border-gray-200">
        {displayGroups.map(group => (
          <section key={group.title} className="py-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-base font-bold text-gray-900">{group.title}</h3>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold">{group.items.length} {group.items.length === 1 ? 'insight' : 'insights'}</span>
            </div>
            <div className="space-y-2">
              {group.items.map(item => {
                const key = `${group.title}-${item.title}`;
                const isExpanded = expandedInsight === key;
                return (
                  <div key={key} className="rounded-xl bg-gray-100 overflow-hidden">
                    <button onClick={() => setExpandedInsight(isExpanded ? null : key)} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-200 transition-colors">
                      <span className="font-semibold text-gray-900 text-sm">{item.title}</span>
                      <span className="text-sm text-gray-500 flex-1 truncate">{item.description}</span>
                      {item.count && <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{item.count}</span>}
                      <span className="flex items-center gap-1 text-xs font-semibold text-gray-700 ml-2 flex-shrink-0"><span className="hidden sm:inline">{isExpanded ? 'Close' : 'View'}</span>{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    </button>
                    {isExpanded && <div className="px-4 pb-4 pt-1 text-sm text-gray-700 leading-relaxed bg-gray-50">{item.description}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-gray-400"><LockKeyhole size={13} /> Insights are generated from your saved strategy and remain private to your account.</div>
    </div>
  );
}

function ProfileSummary({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="flex gap-3 items-start"><span className={`w-7 h-7 rounded-full ${color} flex items-center justify-center flex-shrink-0`}><Check size={15} className="text-white" /></span><div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p><p className="text-sm text-gray-800 mt-1 leading-snug">{value}</p></div></div>;
}

function ProfileRow({ title, description, badge }: { title: string; description: string; badge?: string }) {
  return <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm"><span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><Check size={14} className="text-white" /></span><p className="font-semibold text-sm text-gray-900 whitespace-nowrap">{title}</p><p className="text-sm text-gray-400 truncate flex-1 hidden sm:block">{description}</p>{badge && <span className="hidden sm:inline-flex px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">{badge}</span>}<ChevronRight size={16} className="text-gray-400 flex-shrink-0" /></div>;
}
