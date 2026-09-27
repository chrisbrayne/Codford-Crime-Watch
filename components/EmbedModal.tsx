import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Code, Link as LinkIcon } from 'lucide-react';

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EmbedModal: React.FC<EmbedModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  // Initialize URL when modal opens
  useEffect(() => {
    if (isOpen) {
        let currentUrl = window.location.href;
        // Strip specific file references if present (e.g., index.html) to keep it clean
        currentUrl = currentUrl.replace(/\/index\.html$/, '/');
        setAppUrl(currentUrl);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0">
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
        <div className="p-6 space-y-6 overflow-y-auto">
          
          <div className="space-y-3">
             <label className="block text-sm font-medium text-slate-700">
                1. Verify Application URL
             </label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                  placeholder="https://your-site.netlify.app/"
                />
             </div>
             <p className="text-xs text-slate-500">
                Ensure this matches your live website URL (e.g. from Netlify or Vercel).
             </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
               2. Copy Embed Code
            </label>
            <p className="text-slate-600 text-sm">
              Copy the code below and paste it into an <strong>HTML Block</strong> or <strong>Code Widget</strong> on your CMS (WordPress, Wix, etc).
            </p>

            <div className="relative">
              <pre className="bg-slate-100 border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap break-all shadow-inner">
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
          </div>
          
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
             <p className="text-xs text-blue-700">
               <strong>Tip:</strong> The iframe height is set to 900px by default. You can adjust the <code>height="900"</code> value in the code above to better fit your website's layout.
             </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
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