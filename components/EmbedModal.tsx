import React, { useState } from 'react';
import { X, Copy, Check, Code } from 'lucide-react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmbedModal: React.FC<EmbedModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate the current URL (removes query params to keep it clean)
  const appUrl = window.location.origin + window.location.pathname;

  const embedCode = `<iframe 
  src="${appUrl}" 
  width="100%" 
  height="900" 
  style="border:none; border-radius: 12px; overflow: hidden;" 
  title="Codford Crime Watch"
></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <Code className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Embed on Parish Website</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <p className="text-slate-600 text-sm">
            To display this dashboard on the parish website, copy the code below and paste it into an 
            <strong> HTML Block</strong> or <strong>Code Widget</strong> on your CMS (WordPress, Wix, etc).
          </p>

          <div className="relative">
            <pre className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-2 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50 transition-colors group"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
              )}
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-1">Important for Public Use</h4>
            <p className="text-xs text-blue-700">
              Ensure this application is deployed to a public URL (like Vercel or Netlify) before embedding. 
              If you embed the "localhost" link, visitors will not see the report.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmbedModal;