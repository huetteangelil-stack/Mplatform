import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, Share2, Save, CircleCheck as CheckCircle, Briefcase, Lightbulb, PenLine } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';

interface FormData {
  website: string;
  businessName: string;
  businessModel: string;
  companyAge: string;
  teamSize: string;
  geographicMarket: string;
}

interface IcpDescription {
  overview: string;
  offer: string;
  howItWorks: string;
  capabilities: string[];
  benefits: string[];
  differentiation: string[];
}

interface IcpNeed {
  title: string;
  fulfillment: string;
}

interface IcpProblem {
  title: string;
  context: string;
}

interface Strategy {
  icp: {
    description: IcpDescription;
    needs: IcpNeed[];
    problems: IcpProblem[];
    demographics: string;
    psychographics: string;
    painPoints: string[];
    goals: string[];
  };
  channels: {
    primary: string[];
    secondary: string[];
  };
  tactics: string[];
  kpis: string[];
  timeline: string;
}

export function StrategyResultPage() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const saveStrategy = useCallback(async () => {
    if (!strategy || !formData) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/signin'); return; }
    setIsSaving(true);
    try {
      // Find or create a business entry for this website
      const { data: existing } = await supabase
        .from('businesses')
        .select('id')
        .eq('website', formData.website)
        .maybeSingle();

      let businessId: string | null = existing?.id ?? null;

      if (!businessId) {
        const { data: created } = await supabase
          .from('businesses')
          .insert({
            name: formData.businessName,
            website: formData.website,
            business_model: formData.businessModel,
            geographic_market: formData.geographicMarket,
          })
          .select('id')
          .maybeSingle();
        businessId = created?.id ?? null;
      }

      await supabase.from('marketing_strategies').insert({
        business_id: businessId,
        business_name: formData.businessName,
        website: formData.website,
        strategy_data: strategy,
      });
      setIsSaved(true);
      setTimeout(() => navigate('/dashboard/strategies'), 800);
    } finally {
      setIsSaving(false);
    }
  }, [strategy, formData, navigate]);

  useEffect(() => {
    const generateStrategy = async () => {
      try {
        const decoded = JSON.parse(decodeURIComponent(domain || ''));
        setFormData(decoded);

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(decoded)
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const strategyData: Strategy = await response.json();
        setStrategy(strategyData);
        setError(null);
      } catch (err) {
        console.error('Error generating strategy:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate strategy');
        setTimeout(() => navigate('/strategy'), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    generateStrategy();
  }, [domain, navigate]);

  const generatePDF = useCallback(() => {
    if (!strategy || !formData) return;

    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      const addText = (text: string, x: number, fontSize: number, style: string, color: [number, number, number]) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', style as 'normal' | 'bold' | 'italic');
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, contentWidth - (x - margin));
        if (y + lines.length * fontSize * 0.5 > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, x, y);
        y += lines.length * fontSize * 0.45 + 2;
      };

      const addSectionTitle = (title: string) => {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 4;
        doc.setFillColor(37, 99, 235);
        doc.rect(margin, y - 5, contentWidth, 0.8, 'F');
        y += 4;
        addText(title, margin, 14, 'bold', [17, 24, 39]);
        y += 2;
      };

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(`Marketing Strategy`, margin, 18);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`for ${formData.businessName}`, margin, 26);
      doc.setFontSize(9);
      doc.text(`${formData.businessModel} | ${formData.geographicMarket}`, margin, 33);
      y = 52;

      // Description Section
      if (strategy.icp.description) {
        const desc = strategy.icp.description;
        addSectionTitle('Description');
        if (desc.overview) {
          addText('Description of my business', margin, 11, 'bold', [55, 65, 81]);
          addText(desc.overview, margin + 4, 10, 'normal', [75, 85, 99]);
          y += 2;
        }
        if (desc.offer) {
          addText('What exactly does my business offer?', margin, 11, 'bold', [55, 65, 81]);
          addText(desc.offer, margin + 4, 10, 'normal', [75, 85, 99]);
          y += 2;
        }
        if (desc.howItWorks) {
          addText('How it works?', margin, 11, 'bold', [55, 65, 81]);
          addText(desc.howItWorks, margin + 4, 10, 'normal', [75, 85, 99]);
          y += 2;
        }
        if (desc.capabilities?.length) {
          addText('Key capabilities', margin, 11, 'bold', [55, 65, 81]);
          desc.capabilities.forEach(c => addText(`  •  ${c}`, margin + 2, 10, 'normal', [75, 85, 99]));
          y += 2;
        }
        if (desc.benefits?.length) {
          addText('Key benefits', margin, 11, 'bold', [55, 65, 81]);
          desc.benefits.forEach(b => addText(`  +  ${b}`, margin + 2, 10, 'normal', [22, 163, 74]));
          y += 2;
        }
        if (desc.differentiation?.length) {
          addText('How we stand out', margin, 11, 'bold', [55, 65, 81]);
          desc.differentiation.forEach(d => addText(`  ★  ${d}`, margin + 2, 10, 'normal', [109, 40, 217]));
          y += 2;
        }
      }

      // Needs Section
      if (strategy.icp.needs?.length) {
        addSectionTitle('Needs your product potentially satisfies');
        strategy.icp.needs.forEach((need, idx) => {
          addText(`${idx + 1}) ${need.title}`, margin, 11, 'bold', [22, 163, 74]);
          addText(`How we fulfil this need: ${need.fulfillment}`, margin + 4, 10, 'normal', [75, 85, 99]);
          y += 2;
        });
      }

      // Problems Section
      if (strategy.icp.problems?.length) {
        addSectionTitle('Problems your product potentially solves');
        strategy.icp.problems.forEach((problem, idx) => {
          addText(`${idx + 1}) ${problem.title}`, margin, 11, 'bold', [234, 88, 12]);
          addText(`Context: ${problem.context}`, margin + 4, 10, 'normal', [75, 85, 99]);
          y += 2;
        });
      }

      // ICP Section
      addSectionTitle('Ideal Customer Profile');

      addText('Demographics', margin, 11, 'bold', [55, 65, 81]);
      addText(strategy.icp.demographics, margin + 4, 10, 'normal', [75, 85, 99]);
      y += 2;

      addText('Psychographics', margin, 11, 'bold', [55, 65, 81]);
      addText(strategy.icp.psychographics, margin + 4, 10, 'normal', [75, 85, 99]);
      y += 2;

      addText('Pain Points', margin, 11, 'bold', [55, 65, 81]);
      strategy.icp.painPoints.forEach(point => {
        addText(`  -  ${point}`, margin + 2, 10, 'normal', [75, 85, 99]);
      });
      y += 2;

      addText('Goals & Objectives', margin, 11, 'bold', [55, 65, 81]);
      strategy.icp.goals.forEach(goal => {
        addText(`  +  ${goal}`, margin + 2, 10, 'normal', [75, 85, 99]);
      });

      // Channels Section
      addSectionTitle('Marketing Channels');

      addText('Primary Channels', margin, 11, 'bold', [55, 65, 81]);
      addText(strategy.channels.primary.join('  |  '), margin + 4, 10, 'normal', [37, 99, 235]);
      y += 2;

      addText('Secondary Channels', margin, 11, 'bold', [55, 65, 81]);
      addText(strategy.channels.secondary.join('  |  '), margin + 4, 10, 'normal', [75, 85, 99]);

      // Tactics Section
      addSectionTitle('Marketing Tactics');
      strategy.tactics.forEach((tactic, idx) => {
        addText(`${idx + 1}. ${tactic}`, margin + 2, 10, 'normal', [55, 65, 81]);
      });

      // KPIs Section
      addSectionTitle('Key Performance Indicators');
      strategy.kpis.forEach(kpi => {
        addText(`  -  ${kpi}`, margin + 2, 10, 'normal', [75, 85, 99]);
      });

      // Timeline Section
      addSectionTitle('Timeline');
      addText(strategy.timeline, margin + 4, 10, 'normal', [37, 99, 235]);

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated by AI Strategy | Page ${i} of ${pageCount}`, margin, 290);
      }

      doc.save(`${formData.businessName.replace(/\s+/g, '_')}_Marketing_Strategy.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [strategy, formData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => navigate('/strategy')}
          className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium mb-8"
        >
          <ArrowLeft size={20} />
          Create another strategy
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating your strategy</h2>
              <p className="text-gray-600">Our AI is analyzing your business and creating a personalized marketing plan...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-[500px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">!</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error generating strategy</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <p className="text-gray-500 text-sm">Redirecting...</p>
            </div>
          </div>
        ) : strategy && formData ? (
          <div className="flex gap-6 lg:gap-8 items-start">
          {/* ─── Main content ─── */}
          <div className="flex-1 min-w-0 space-y-8">
            <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12 sticky top-4 z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    Marketing Strategy for {formData.businessName}
                  </h1>
                  <p className="text-gray-600 mt-2">AI-Generated Ideal Customer Profile & Go-to-Market Plan</p>
                  <p className="text-sm text-gray-500 mt-1">{formData.businessModel} | {formData.geographicMarket}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={saveStrategy}
                    disabled={isSaving || isSaved}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                      isSaved
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    title="Save to dashboard"
                  >
                    {isSaved ? (
                      <><CheckCircle size={18} className="text-green-600" /><span>Saved!</span></>
                    ) : isSaving ? (
                      <><div className="w-4 h-4 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" /><span>Saving...</span></>
                    ) : (
                      <><Save size={18} /><span className="hidden sm:inline">Save to dashboard</span></>
                    )}
                  </button>
                  <button className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" title="Share strategy">
                    <Share2 size={20} className="text-gray-700" />
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={isGeneratingPdf}
                    className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition-colors flex items-center gap-2"
                  >
                    {isGeneratingPdf ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                    <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Compartment 1 — Description */}
            {strategy.icp.description && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-xs">DESC</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Description</h2>
                </div>

                <div className="space-y-6">
                  {strategy.icp.description.overview && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Description of my business</h3>
                      <p className="text-gray-700 leading-relaxed">{strategy.icp.description.overview}</p>
                    </div>
                  )}
                  {strategy.icp.description.offer && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">What exactly does my business offer?</h3>
                      <p className="text-gray-700 leading-relaxed">{strategy.icp.description.offer}</p>
                    </div>
                  )}
                  {strategy.icp.description.howItWorks && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">How it works?</h3>
                      <p className="text-gray-700 leading-relaxed">{strategy.icp.description.howItWorks}</p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-6 pt-2">
                    {strategy.icp.description.capabilities?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Key capabilities</h3>
                        <ul className="space-y-2">
                          {strategy.icp.description.capabilities.map((item, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-700">
                              <span className="text-blue-500 font-bold mt-0.5 flex-shrink-0">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {strategy.icp.description.benefits?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Key benefits</h3>
                        <ul className="space-y-2">
                          {strategy.icp.description.benefits.map((item, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-700">
                              <span className="text-green-500 font-bold mt-0.5 flex-shrink-0">+</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {strategy.icp.description.differentiation?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">How we stand out</h3>
                        <ul className="space-y-2">
                          {strategy.icp.description.differentiation.map((item, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-700">
                              <span className="text-purple-500 font-bold mt-0.5 flex-shrink-0">★</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Compartment 2 — Needs */}
            {strategy.icp.needs?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-xs">NEED</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Needs your product potentially satisfies</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {strategy.icp.needs.map((need, idx) => (
                    <div key={idx} className="p-4 bg-green-50 rounded-xl border border-green-100">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900 text-sm">{need.title}</h3>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pl-9">
                        <span className="font-medium text-gray-700">How we fulfil this need: </span>
                        {need.fulfillment}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compartment 3 — Problems */}
            {strategy.icp.problems?.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-bold text-xs">PROB</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Problems your product potentially solves</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {strategy.icp.problems.map((problem, idx) => (
                    <div key={idx} className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900 text-sm">{problem.title}</h3>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pl-9">
                        <span className="font-medium text-gray-700">Context: </span>
                        {problem.context}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Ideal Customer Profile</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Demographics</h3>
                    <p className="text-gray-600 leading-relaxed">{strategy.icp.demographics}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Psychographics</h3>
                    <p className="text-gray-600 leading-relaxed">{strategy.icp.psychographics}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Pain Points</h3>
                    <ul className="space-y-2">
                      {strategy.icp.painPoints.map((point, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="text-red-500 font-bold mt-1">-</span>
                          <span className="text-gray-600">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Goals & Objectives</h3>
                    <ul className="space-y-2">
                      {strategy.icp.goals.map((goal, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="text-green-500 font-bold mt-1">+</span>
                          <span className="text-gray-600">{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Marketing Channels</h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Primary Channels</h3>
                      <div className="flex flex-wrap gap-2">
                        {strategy.channels.primary.map((channel, idx) => (
                          <span
                            key={idx}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                          >
                            {channel}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Secondary Channels</h3>
                      <div className="flex flex-wrap gap-2">
                        {strategy.channels.secondary.map((channel, idx) => (
                          <span
                            key={idx}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                          >
                            {channel}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Timeline</h2>
                  <p className="text-gray-600 leading-relaxed bg-blue-50 p-4 rounded-lg border-l-4 border-blue-600">
                    {strategy.timeline}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Marketing Tactics</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {strategy.tactics.map((tactic, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-gradient-to-br from-blue-50 to-gray-50 rounded-lg border border-blue-100 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex gap-3">
                      <span className="text-blue-600 font-bold text-lg flex-shrink-0">{idx + 1}</span>
                      <p className="text-gray-700">{tactic}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Performance Indicators</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {strategy.kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-gradient-to-br from-green-50 to-gray-50 rounded-lg border border-green-100"
                  >
                    <p className="text-gray-700 text-sm">{kpi}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to implement this strategy?</h2>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Unlock our premium plan to get AI-assisted implementation guides, content templates, and campaign management tools.
              </p>
              <button
                onClick={() => navigate('/pricing')}
                className="px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                View Plans
              </button>
            </div>
          </div>{/* end flex-1 main content */}

          {/* ─── Right sidebar ─── */}
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <div className="sticky top-6 space-y-4">

              {/* 1 — My businesses */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  <Briefcase size={14} className="text-gray-400" />
                  My businesses
                </h3>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-sm font-semibold text-blue-800 truncate leading-tight">
                    Marketing Strategy for {formData.businessName}
                  </p>
                  <p className="text-xs text-blue-500 mt-1 leading-snug">
                    AI-Generated Ideal Customer Profile &amp; Go-to-Market Plan
                  </p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">
                    {formData.businessModel} · {formData.geographicMarket}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard/businesses')}
                  className="w-full mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium text-left transition-colors"
                >
                  View all businesses →
                </button>
              </div>

              {/* 2 — Marketing strategies */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  <Lightbulb size={14} className="text-gray-400" />
                  Marketing strategies
                </h3>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  Inception Engineering · PBN + farmPHONE methodology
                </p>
                <button
                  onClick={saveStrategy}
                  disabled={isSaving || isSaved}
                  className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                    isSaved
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white'
                  }`}
                >
                  {isSaved ? '✓ Sauvegardée' : isSaving ? 'Saving...' : 'Inception strategie'}
                </button>
              </div>

              {/* 3 — Content creation */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  <PenLine size={14} className="text-gray-400" />
                  Content creation
                </h3>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  LinkedIn posts, Facebook ads &amp; campaigns from your ICP.
                </p>
                <button
                  onClick={() => navigate('/dashboard/content')}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Create content
                </button>
              </div>

            </div>
          </aside>

          </div>
        ) : null}
      </div>
    </div>
  );
}
