import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Lightbulb, Trash2, ChevronRight, Globe, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SavedStrategy {
  id: string;
  business_name: string;
  website: string;
  strategy_data: Record<string, unknown>;
  created_at: string;
  business_id: string | null;
}

export function MarketingStrategiesPage() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('marketing_strategies')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setStrategies(data ?? []);
        setIsLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this strategy?')) return;
    await supabase.from('marketing_strategies').delete().eq('id', id);
    setStrategies(prev => prev.filter(s => s.id !== id));
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const getChannels = (strategy: SavedStrategy): string[] => {
    const data = strategy.strategy_data as Record<string, unknown>;
    const channels = data?.channels as Record<string, unknown> | undefined;
    return (channels?.primary as string[]) ?? [];
  };

  const getTacticCount = (strategy: SavedStrategy): number => {
    const data = strategy.strategy_data as Record<string, unknown>;
    return ((data?.tactics as unknown[]) ?? []).length;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Marketing strategies</h1>
        <button
          onClick={() => navigate('/strategy')}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={18} />
          Create new strategy
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-8 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">Inception Engineering</span>
        <span>Powered by PBN + farmPHONE methodology</span>
      </p>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Lightbulb size={48} className="text-gray-200 mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Now let's turn your ICP into a winning strategy.
          </h2>
          <p className="text-gray-400 text-base max-w-md">
            Create your first marketing strategy and start turning insights into growth. Click create to start.
          </p>
          <button
            onClick={() => navigate('/strategy')}
            className="mt-8 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            <Plus size={18} />
            Create new strategy
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {strategies.map(s => (
            <div
              key={s.id}
              onClick={() => navigate(`/dashboard/strategies/${s.id}`)}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={18} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{s.business_name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Globe size={12} /> {s.website || '—'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={12} /> {formatDate(s.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="hidden sm:flex gap-1.5">
                    {getChannels(s).slice(0, 3).map((ch, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">{ch}</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 hidden sm:block">{getTacticCount(s)} tactics</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors ml-2"
                  >
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/strategies/${s.id}`); }}
                    className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <ChevronRight size={16} className="text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
