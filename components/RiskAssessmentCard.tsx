import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ShieldCheck, Scale, Loader2, RefreshCw, Copy, Check, Sparkles, Zap, AlertTriangle, TrendingDown } from 'lucide-react';
import { RiskAssessmentResponse } from '../services/geminiService';
import { CrimeSummary } from '../types';
import { calculateParishRiskMetrics } from '../services/riskCalculator';

interface RiskAssessmentCardProps {
  assessmentData: RiskAssessmentResponse | null;
  loading: boolean;
  onRefresh: () => void;
  cooldownSeconds: number;
  summary: CrimeSummary;
  formattedDate: string;
}

const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  assessmentData,
  loading,
  onRefresh,
  cooldownSeconds,
  summary,
  formattedDate,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    if (assessmentData?.assessment) {
      navigator.clipboard.writeText(assessmentData.assessment);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // High-precision benchmark metrics considering duration and population
  const metrics = calculateParishRiskMetrics(formattedDate, summary);

  const isCached = assessmentData?.source === 'cache';
  const isAi = assessmentData?.source === 'gemini-3.8-flash' || assessmentData?.source === 'gemini-3.1-flash-lite';
  const modelName = assessmentData?.source === 'gemini-3.1-flash-lite' ? 'Gemini 3.1' : 'Gemini 3.8';
  const isQuota = assessmentData?.isQuotaExhausted;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/50">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-lg text-white">Local Risk & Benchmark Assessment</h2>
              {isAi && (
                <span className="text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> {modelName}
                </span>
              )}
              {isCached && (
                <span className="text-xs bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-300" /> Cached
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">
              Comparative analysis: Codford Parish vs Wiltshire County & England/Wales Averages
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {loading && <Loader2 className="w-5 h-5 text-white/80 animate-spin" />}

          {!loading && (
            <button
              onClick={onRefresh}
              disabled={cooldownSeconds > 0}
              className="flex items-center space-x-1.5 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/10"
              title={cooldownSeconds > 0 ? `Cooldown: ${cooldownSeconds}s` : 'Re-assess crime risk'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{cooldownSeconds > 0 ? `${cooldownSeconds}s Cooldown` : 'Refresh Assessment'}</span>
            </button>
          )}

          {!loading && assessmentData?.assessment && (
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/10"
              title="Copy assessment text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Benchmark Metric Comparison Bar */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Codford Metric */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span className="truncate max-w-[170px]" title={formattedDate}>Codford ({formattedDate})</span>
            <span className="text-blue-600 font-bold">Pop. ~700</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{summary.total}</span>
            <span className="text-xs text-slate-500">
              total incident{summary.total === 1 ? '' : 's'} {metrics.durationMonths > 1 ? `(${metrics.durationMonths} mos)` : ''}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
            <span>Rate per 1,000 (annualized):</span>
            <span className="font-bold text-blue-700">{metrics.codfordRatePerThousand}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Monthly per 1,000:</span>
            <span className="font-semibold text-slate-700">{metrics.codfordMonthlyPerThousand}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-1.5 rounded-full" 
              style={{ width: `${Math.min(100, Math.max(5, (metrics.codfordRatePerThousand / metrics.nationalAnnualRate) * 100))}%` }}
            />
          </div>
        </div>

        {/* Wiltshire County Average */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>Wiltshire County Average</span>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3 mr-0.5" /> Top 5 Safest UK
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">56.2</span>
            <span className="text-xs text-slate-500">annual / 1,000</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
            <span>Codford comparison:</span>
            <span className="font-bold text-emerald-700">
              {metrics.percentLowerThanWiltshire >= 0 ? `${metrics.percentLowerThanWiltshire}% lower` : `${Math.abs(metrics.percentLowerThanWiltshire)}% higher`}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Monthly equivalent:</span>
            <span className="font-semibold text-slate-700">~4.7 / 1,000</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full" 
              style={{ width: `${(metrics.wiltshireAnnualRate / metrics.nationalAnnualRate) * 100}%` }}
            />
          </div>
        </div>

        {/* England & Wales Average */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1">
            <span>England & Wales Average</span>
            <span className="text-[10px] text-slate-400">National ONS</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-700">89.3</span>
            <span className="text-xs text-slate-500">annual / 1,000</span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex items-center justify-between">
            <span>Codford comparison:</span>
            <span className="font-bold text-indigo-700">
              {metrics.percentLowerThanNational >= 0 ? `${metrics.percentLowerThanNational}% lower` : `${Math.abs(metrics.percentLowerThanNational)}% higher`}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Monthly equivalent:</span>
            <span className="font-semibold text-slate-700">~7.4 / 1,000</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      {/* Quota / Rate Limit Warning */}
      {isQuota && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>AI token rate limit active for this minute. Showing verified statistical risk assessment.</span>
          </div>
          {cooldownSeconds > 0 && (
            <span className="font-mono font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
              {cooldownSeconds}s
            </span>
          )}
        </div>
      )}

      {/* Assessment Body Content */}
      <div className="p-6 sm:p-8">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-1/4"></div>
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6"></div>
            <div className="h-4 bg-slate-100 rounded w-4/5"></div>
            <div className="h-5 bg-slate-100 rounded w-1/3 pt-2"></div>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-4">
            <ReactMarkdown
              components={{
                p: ({ children }) => {
                  const textContent = String(children);
                  const isOpening = textContent.includes('Evening All');
                  const isClosing = textContent.includes("Don't have nightmares");

                  if (isOpening) {
                    return (
                      <p className="text-base font-semibold text-slate-900 border-l-4 border-blue-600 pl-3 py-0.5 italic">
                        {children}
                        <span className="block text-[11px] font-normal not-italic text-slate-400 mt-0.5">
                          (Reference: PC George Dixon, <em>Dixon of Dock Green</em>)
                        </span>
                      </p>
                    );
                  }

                  if (isClosing) {
                    return (
                      <p className="text-base font-semibold text-slate-900 border-l-4 border-indigo-600 pl-3 py-0.5 italic mt-4">
                        {children}
                        <span className="block text-[11px] font-normal not-italic text-slate-400 mt-0.5">
                          (Reference: Nick Ross, BBC <em>Crimewatch</em>)
                        </span>
                      </p>
                    );
                  }

                  return <p className="text-slate-700 leading-relaxed text-sm sm:text-base">{children}</p>;
                },
              }}
            >
              {assessmentData?.assessment || "No risk assessment available."}
            </ReactMarkdown>

            {/* Reassuring Key takeaway badge */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <TrendingDown className="w-3.5 h-3.5" />
                Actual Parish Crime Risk: Consistently Low & Peaceful
              </span>
              <span>Based on Wiltshire Police open data & ONS rural parish metrics</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskAssessmentCard;
