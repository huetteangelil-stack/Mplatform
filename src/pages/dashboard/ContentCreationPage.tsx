import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Sparkles, FileText, Loader2, ChevronLeft, Lightbulb } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ContentTask {
  id: string;
  task_name: string;
  topic: string;
  status: string;
  created_at: string;
  business_id: string | null;
  content: string | null;
  content_data: ContentResult | null;
}

interface Business {
  id: string;
  name: string;
  website: string;
}

interface Strategy {
  icp: {
    description: {
      overview: string;
      offer: string;
      howItWorks: string;
      capabilities: string[];
      benefits: string[];
      differentiation: string[];
    };
    needs: { title: string; fulfillment: string }[];
    problems: { title: string; context: string }[];
    demographics: string;
    psychographics: string;
    painPoints: string[];
    goals: string[];
  };
  channels: { primary: string[]; secondary: string[] };
  tactics: string[];
  kpis: string[];
  timeline: string;
}

interface ContentResult {
  title: string;
  body: string;
  callToAction: string;
}

interface Draft extends ContentResult {}


const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-500' },
  in_progress: { label: 'In progress', className: 'bg-yellow-100 text-yellow-700' },
  done: { label: 'Done', className: 'bg-green-100 text-green-700' },
};

const POST_TYPES = [
  { value: 'POV', label: 'POV', description: 'Point of view — opinion, contrarian take, or thought leadership' },
  { value: 'TIPS', label: 'Tips', description: 'Actionable advice and practical insights for your audience' },
] as const;

export function ContentCreationPage() {
  const [tasks, setTasks] = useState<ContentTask[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ task_name: '', business_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedTask, setSelectedTask] = useState<ContentTask | null>(null);
  const [viewingTask, setViewingTask] = useState<ContentTask | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedPostType, setSelectedPostType] = useState<'POV' | 'TIPS' | ''>('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState<number | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [generatingHooks, setGeneratingHooks] = useState(false);
  const [postError, setPostError] = useState('');

  const fetchData = async () => {
    const [{ data: taskData }, { data: bizData }] = await Promise.all([
      supabase.from('content_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('businesses').select('id, name, website').order('name'),
    ]);
    setTasks(taskData ?? []);
    setBusinesses(bizData ?? []);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.task_name.trim()) { setError('Task name is required.'); return; }
    if (!form.business_id) { setError('Business is required.'); return; }
    setSaving(true);
    setError('');
    const { data } = await supabase
      .from('content_tasks')
      .insert({ task_name: form.task_name, business_id: form.business_id })
      .select('*')
      .maybeSingle();
    setSaving(false);
    if (data) {
      setShowModal(false);
      setForm({ task_name: '', business_id: '' });
      fetchData();
      openTask(data as ContentTask);
    } else {
      setError('Failed to create task.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('content_tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const openSavedContent = (task: ContentTask) => {
    setViewingTask(task);
    setSelectedTask(null);
  };

  const openTask = async (task: ContentTask) => {
    setViewingTask(null);
    setSelectedTask(task);
    setTopics([]);
    setTopicsError('');
    setSelectedTopic('');
    setSelectedPostType('');
    setDrafts([]);
    setSelectedDraftIndex(null);
    setHooks([]);
    setPostError('');
    setLoadingTopics(true);

    try {
      const strategy = await fetchStrategy(task.business_id);
      if (!strategy) {
        setTopicsError('No marketing strategy found for this business. Generate one first.');
        setLoadingTopics(false);
        return;
      }
      const result = await callContentAPI({ mode: 'topics', contentType: 'educational', postType: 'TIPS', strategy });
      const list = Array.isArray(result) ? result.map(String) : [];
      setTopics(list);
      if (list.length === 0) setTopicsError('No topics were generated. Try again.');
    } catch {
      setTopicsError('Failed to generate topics. Please try again.');
    } finally {
      setLoadingTopics(false);
    }
  };

  const fetchStrategy = async (businessId: string | null): Promise<Strategy | null> => {
    if (!businessId) return null;
    const { data } = await supabase
      .from('marketing_strategies')
      .select('strategy_data')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.strategy_data as Strategy) ?? null;
  };

  const callContentAPI = async (payload: Record<string, unknown>): Promise<unknown> => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-content`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `Request failed (${response.status})`);
    }
    return response.json();
  };

  const handleGenerateDrafts = async () => {
    if (!selectedTask || !selectedTopic || !selectedPostType || !selectedTask.business_id) return;
    setGeneratingDrafts(true);
    setPostError('');
    setDrafts([]);
    setSelectedDraftIndex(null);
    setHooks([]);

    try {
      const strategy = await fetchStrategy(selectedTask.business_id);
      if (!strategy) throw new Error('Strategy not found.');
      const result = await callContentAPI({
        mode: 'drafts',
        contentType: 'educational',
        postType: selectedPostType,
        selectedTopic,
        strategy,
      });
      const generatedDrafts = Array.isArray(result) ? result as Draft[] : [];
      if (generatedDrafts.length !== 3 || generatedDrafts.some(d => !d.title || !d.body || d.body.length < 2000)) {
        throw new Error('Invalid drafts response.');
      }
      setDrafts(generatedDrafts);
    } catch {
      setPostError('Failed to generate the drafts. Please try again.');
    } finally {
      setGeneratingDrafts(false);
    }
  };

  const handleGenerateHooks = async () => {
    if (!selectedTask || !selectedTopic || !selectedPostType || !selectedTask.business_id || selectedDraftIndex === null) return;
    const draft = drafts[selectedDraftIndex];
    setGeneratingHooks(true);
    setPostError('');
    setHooks([]);

    try {
      const strategy = await fetchStrategy(selectedTask.business_id);
      if (!strategy) throw new Error('Strategy not found.');
      const result = await callContentAPI({
        mode: 'hooks',
        contentType: 'educational',
        postType: selectedPostType,
        selectedTopic,
        selectedDraft: draft.body,
        strategy,
      });
      const generatedHooks = Array.isArray(result) ? result.map(String) : [];
      if (generatedHooks.length !== 3) throw new Error('Invalid hooks response.');
      setHooks(generatedHooks);
      await supabase
        .from('content_tasks')
        .update({ content: draft.body, content_data: draft, status: 'done', topic: selectedTopic })
        .eq('id', selectedTask.id);
      fetchData();
    } catch {
      setPostError('Failed to generate hooks. Please try again.');
    } finally {
      setGeneratingHooks(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const getBusinessName = (id: string | null) => businesses.find(b => b.id === id)?.name ?? '—';

  // ─── Saved content view (read-only) ───
  if (viewingTask) {
    const saved = viewingTask.content_data;
    return (
      <div className="p-6 sm:p-8 max-w-4xl mx-auto">
        <button
          onClick={() => setViewingTask(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium mb-6"
        >
          <ChevronLeft size={20} /> Back to content tasks
        </button>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb size={22} className="text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900">{viewingTask.task_name}</h1>
          </div>
          <p className="text-sm text-gray-500">{getBusinessName(viewingTask.business_id)}</p>
        </div>

        {saved ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{saved.title}</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">{saved.body}</p>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Call to action</p>
              <p className="text-sm text-blue-600 font-medium">{saved.callToAction}</p>
            </div>
          </div>
        ) : viewingTask.content ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewingTask.content}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <FileText size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No saved content found for this task.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Detail view: topic selection + content type + generation ───
  if (selectedTask) {
    return (
      <div className="p-6 sm:p-8 max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedTask(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium mb-6"
        >
          <ChevronLeft size={20} /> Back to content tasks
        </button>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={22} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">{selectedTask.task_name}</h1>
          </div>
          <p className="text-sm text-gray-500">{getBusinessName(selectedTask.business_id)}</p>
        </div>

        {/* Step 1 — Topics */}
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Choose a topic</h2>
          <p className="text-sm text-gray-500 mb-5">Select one of the AI-generated topics to create your post.</p>

          {loadingTopics && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <Sparkles size={22} className="text-blue-600" />
              </div>
              <p className="text-base font-semibold text-gray-800">Elsa is generating topics for you...</p>
              <p className="text-sm text-gray-500 mt-1">Analyzing your business and creating relevant topics.</p>
              <p className="text-xs text-gray-400 mt-2">Please wait 30 seconds.</p>
            </div>
          )}

          {topicsError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{topicsError}</div>
          )}

          {!loadingTopics && !topicsError && topics.length > 0 && (
            <div className="space-y-3">
              {topics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedTopic(topic); setSelectedPostType(''); setDrafts([]); setSelectedDraftIndex(null); setHooks([]); setPostError(''); }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTopic === topic
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      selectedTopic === topic ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</span>
                    <p className="text-sm text-gray-700 pt-1">{topic}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2 — Content type and Get drafts */}
        {selectedTopic && !loadingTopics && (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Choose a content type</h2>
            <p className="text-sm text-gray-500 mb-5">Select the format for your post about the chosen topic.</p>

            <div className="grid sm:grid-cols-2 gap-4">
              {POST_TYPES.map(pt => (
                <button
                  key={pt.value}
                  onClick={() => { setSelectedPostType(pt.value); setDrafts([]); setSelectedDraftIndex(null); setHooks([]); setPostError(''); }}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    selectedPostType === pt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-base">{pt.label}</p>
                  <p className="text-sm text-gray-500 mt-1">{pt.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerateDrafts}
              disabled={!selectedPostType || generatingDrafts}
              className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {generatingDrafts ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              {generatingDrafts ? 'Generating drafts...' : 'Get drafts'}
            </button>
          </div>
        )}

        {generatingDrafts && (
          <div className="bg-white rounded-2xl shadow-sm p-8 mb-6">
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                <Sparkles size={24} className="text-blue-600" />
              </div>
              <p className="text-base font-semibold text-gray-800">Elsa is generating {selectedPostType} drafts for you...</p>
              <p className="text-sm text-gray-500 mt-1">Creating 3 long-form drafts with hooks and calls to action.</p>
              <p className="text-xs text-gray-400 mt-2">Please wait 2-3 minutes.</p>
            </div>
          </div>
        )}

        {postError && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 mb-6">{postError}</div>
        )}

        {/* Step 3 — Draft selection */}
        {drafts.length > 0 && !generatingDrafts && (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Choose the draft that suits you best</h2>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-gray-700">
              <p className="font-bold text-gray-900 mb-1">ATTENTION!</p>
              <p>Choose the draft that best matches your voice. Elsa will generate opening hooks after your selection.</p>
            </div>
            <div className="grid lg:grid-cols-3 gap-4 mt-6">
              {drafts.map((draft, index) => (
                <button
                  key={index}
                  onClick={() => { setSelectedDraftIndex(index); setHooks([]); }}
                  className={`text-left rounded-xl border-2 p-4 transition-all ${selectedDraftIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
                    {selectedDraftIndex === index && <span className="text-xs font-semibold text-blue-600">Selected</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-3">{draft.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap max-h-80 overflow-hidden">{draft.body}</p>
                  <p className="text-xs text-blue-600 font-medium mt-4">CTA: {draft.callToAction}</p>
                </button>
              ))}
            </div>

            {selectedDraftIndex !== null && (
              <button
                onClick={handleGenerateHooks}
                disabled={generatingHooks}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors"
              >
                {generatingHooks ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {generatingHooks ? 'Generating hooks...' : 'Generate hooks'}
              </button>
            )}
          </div>
        )}

        {generatingHooks && (
          <div className="bg-white rounded-2xl shadow-sm p-8 mb-6">
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-base font-semibold text-gray-800">Elsa is generating hooks for your draft...</p>
              <p className="text-sm text-gray-500 mt-1">Creating 3 strong openings to help your post get attention.</p>
            </div>
          </div>
        )}

        {hooks.length > 0 && selectedDraftIndex !== null && !generatingHooks && (
          <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Choose your hook</h2>
            <p className="text-sm text-gray-500 mb-5">Select the opening that best fits your voice.</p>
            <div className="space-y-3">
              {hooks.map((hook, index) => (
                <button key={index} className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <span className="text-xs font-bold text-blue-600 mr-3">{index + 1}</span>
                  <span className="text-sm text-gray-700">{hook}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Default list view ───
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Content creation</h1>
        <button
          onClick={() => { setError(''); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={18} />
          Create content
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-8">
        Create LinkedIn and Facebook posts based on your marketing strategy.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <FileText size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Click "Create content" to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50">
            <span className="col-span-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Task name</span>
            <span className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Business</span>
            <span className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</span>
            <span className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Created</span>
            <span className="col-span-1" />
          </div>
          <div className="divide-y divide-gray-50">
            {tasks.map(task => {
              const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
              return (
                <div
                  key={task.id}
                  onClick={() => openTask(task)}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-blue-50/40 transition-colors cursor-pointer group"
                >
                  <div className="col-span-4">
                    <p className="font-medium text-gray-900 text-sm truncate">{task.task_name}</p>
                    {task.topic && <p className="text-xs text-gray-400 truncate mt-0.5">{task.topic}</p>}
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm text-gray-500 truncate">{getBusinessName(task.business_id)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">{formatDate(task.created_at)}</p>
                  </div>
                  <div className="col-span-1 flex justify-end items-center gap-1">
                    {task.status === 'done' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openSavedContent(task); }}
                        className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="View saved content"
                      >
                        <Lightbulb size={14} className="text-amber-500" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Create content task</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Task name *</label>
                <input
                  value={form.task_name}
                  onChange={e => setForm(p => ({ ...p, task_name: e.target.value }))}
                  placeholder="LinkedIn campaign for Q3"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business *</label>
                {businesses.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-3">
                    You need to add a business first.
                  </p>
                ) : (
                  <select
                    value={form.business_id}
                    onChange={e => setForm(p => ({ ...p, business_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a business</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {saving ? 'Creating...' : 'Create task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
