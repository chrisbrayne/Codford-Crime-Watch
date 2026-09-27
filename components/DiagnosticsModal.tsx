import React, { useEffect, useState } from 'react';
import { X, Cpu, AlertCircle, CheckCircle2, RefreshCw, Key, ShieldCheck, Zap } from 'lucide-react';
import { fetchDiagnostics, DiagnosticsResponse, clearReportCache } from '../services/geminiService';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCacheCleared?: () => void;
}

const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose, onCacheCleared }) => {
  const [data, setData] = useState<DiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [clearing, setClearing] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    const result = await fetchDiagnostics();
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleClearCache = async () => {
    setClearing(true);
    await clearReportCache();
    await loadData();
    setClearing(false);
    if (onCacheCleared) onCacheCleared();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-lg">AI & Token Quota Diagnostics</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Explanation of "Out of Tokens" */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 text-sm">Why does "Out of Tokens" happen?</h4>
                <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                  Google Gemini APIs enforce a <strong>Rate & Token Limit</strong> on free tier keys (e.g. 15 requests per minute and a strict Tokens-Per-Minute quota). When multiple months are queried in rapid succession or if repeated network retries occur, Google returns <code>429 Resource Exhausted: Quota exceeded for tokens per minute</code>.
                </p>
                <div className="mt-3 bg-white/80 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>How this app protects your tokens:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
                    <li><strong>Server-Side Caching:</strong> Each month's analysis is cached in memory. Switching back to a previously loaded month consumes <strong>0 tokens</strong>.</li>
                    <li><strong>Loop Prevention:</strong> Failed or rate-limited requests no longer trigger endless background re-render loops.</li>
                    <li><strong>Instant Statistical Fallback:</strong> If Gemini is at its rate limit, Codford Crime Watch seamlessly generates an accurate Parish activity breakdown without crashing.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Current System Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-xs">Live System Status</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-slate-500" />
                  API Key Status
                </span>
                {data?.geminiKeyConfigured ? (
                  <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Configured ({data.keySource})
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> Not Detected
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-slate-500" />
                  Active Model
                </span>
                <span className="text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  {data?.modelInUse || 'gemini-3.8-flash'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">In-Memory Cached Months (0 tokens):</span>
                <button
                  onClick={handleClearCache}
                  disabled={clearing || !data?.cachedMonths?.length}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${clearing ? 'animate-spin' : ''}`} />
                  Clear Cache
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data?.cachedMonths && data.cachedMonths.length > 0 ? (
                  data.cachedMonths.map(m => (
                    <span key={m} className="px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md font-mono text-slate-700">
                      {m}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No months cached yet in current session.</span>
                )}
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <h5 className="font-bold text-slate-800 text-xs">What to do if you encounter rate limits:</h5>
            <ol className="list-decimal pl-4 space-y-1">
              <li><strong>Wait 60 seconds:</strong> Google's per-minute quota resets every 60 seconds.</li>
              <li><strong>Use Cached Reports:</strong> Once generated, navigating between months is instant and free of token consumption.</li>
              <li><strong>Paid API Project:</strong> For heavy automated reporting, link a billing account in Google Cloud Console or Google AI Studio to unlock 1,000+ RPM.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticsModal;
