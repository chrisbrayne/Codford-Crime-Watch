import React, { useEffect, useState, useMemo } from 'react';
import { fetchCodfordBoundary } from './services/onsService';
import { fetchLatestAvailableDate, fetchCrimesInBoundary } from './services/policeService';
import { generateCrimeReport } from './services/geminiService';
import { Crime, GeoFeature, CrimeSummary } from './types';
import CrimeMap from './components/CrimeMap';
import CrimeChart from './components/CrimeChart';
import EmbedModal from './components/EmbedModal';
import ReactMarkdown from 'react-markdown';
import { ShieldAlert, MapPin, Calendar, Loader2, FileText, BarChart3, Info, Code } from 'lucide-react';

// Helper to format YYYY-MM to MMM YYYY (e.g. "2024-03" -> "Mar 2024")
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const App: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<GeoFeature | null>(null);
  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [reportDate, setReportDate] = useState<string>('');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [showEmbedModal, setShowEmbedModal] = useState<boolean>(false);

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        // 1. Get Boundary
        const boundaryData = await fetchCodfordBoundary();
        if (!boundaryData) {
          throw new Error("Could not find boundary data for Codford.");
        }
        setBoundary(boundaryData);

        // 2. Get Date
        const date = await fetchLatestAvailableDate();
        setReportDate(date);

        // 3. Get Crimes
        const crimeData = await fetchCrimesInBoundary(boundaryData, date);
        setCrimes(crimeData);

      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  // Calculate Summary
  const summary: CrimeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    crimes.forEach(c => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });

    const byCategory = Object.entries(counts)
      .map(([name, value]) => ({ 
        name: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
        value 
      }))
      .sort((a, b) => b.value - a.value);

    return {
      total: crimes.length,
      byCategory,
      mostFrequentCategory: byCategory.length > 0 ? byCategory[0].name : 'None'
    };
  }, [crimes]);

  // Trigger AI Report
  useEffect(() => {
    if (!loading && crimes.length >= 0 && summary && reportDate && !aiReport && !generatingReport) {
       setGeneratingReport(true);
       generateCrimeReport(reportDate, summary, crimes)
        .then(text => setAiReport(text))
        .catch(err => console.error(err))
        .finally(() => setGeneratingReport(false));
    }
  }, [loading, crimes, summary, reportDate, aiReport, generatingReport]);


  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-md text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">System Unavailable</h2>
          <p className="text-slate-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-6 h-6 text-blue-400" />
            <span className="text-lg font-bold tracking-tight">Codford Crime Watch</span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-slate-300">
             <div className="hidden sm:flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>Codford, Wiltshire</span>
             </div>
             <div className="hidden sm:flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{reportDate}</span>
             </div>
             <button 
                onClick={() => setShowEmbedModal(true)}
                className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition-colors text-white border border-slate-700"
                title="Get code to embed on website"
             >
                <Code className="w-4 h-4" />
                <span className="hidden xs:inline">Embed</span>
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {loading ? (
           <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 animate-pulse">Consulting police records and ONS geography...</p>
           </div>
        ) : (
          <div className="space-y-8">
            
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total Crimes</p>
                  <p className="text-3xl font-bold text-slate-900">{summary.total}</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                 <div className="p-3 bg-purple-50 text-purple-600 rounded-full">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Top Category</p>
                  <p className="text-lg font-bold text-slate-900 truncate max-w-[150px]" title={summary.mostFrequentCategory}>
                    {summary.mostFrequentCategory}
                  </p>
                </div>
              </div>

               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
                 <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Reporting Period</p>
                  <p className="text-xl font-bold text-slate-900">{reportDate}</p>
                </div>
              </div>
            </div>

            {/* AI Report Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-white">
                    <FileText className="w-5 h-5" />
                    <h2 className="font-semibold text-lg">Activity Summary</h2>
                  </div>
                  {generatingReport && <Loader2 className="w-5 h-5 text-white/80 animate-spin" />}
               </div>
               <div className="p-8 prose prose-slate max-w-none">
                  {generatingReport ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-100 rounded w-full"></div>
                      <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                    </div>
                  ) : (
                    <ReactMarkdown>{aiReport || "No analysis available."}</ReactMarkdown>
                  )}
               </div>
            </div>

            {/* Visuals Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-slate-500" />
                  <span>Geographic Distribution</span>
                </h3>
                {boundary && <CrimeMap boundary={boundary} crimes={crimes} />}
                <p className="text-xs text-slate-400">
                  *Map visualizes crime locations relative to the Codford Civil Parish boundary. 
                  Red dots represent approximate locations provided by police.uk.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-slate-500" />
                  <span>Category Breakdown</span>
                </h3>
                <CrimeChart summary={summary} />
              </div>
            </div>

            {/* Raw Data Table (Optional but useful for transparency) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-800">Incident Log</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-900 font-medium">
                    <tr>
                      <th className="px-6 py-3 whitespace-nowrap">Reported</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Location</th>
                      <th className="px-6 py-3">Outcome</th>
                      <th className="px-6 py-3 whitespace-nowrap">Last Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {crimes.map((crime) => (
                      <tr key={crime.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap">{formatDate(crime.month)}</td>
                        <td className="px-6 py-3 capitalize">{crime.category.replace(/-/g, ' ')}</td>
                        <td className="px-6 py-3">{crime.location.street.name}</td>
                        <td className="px-6 py-3">{crime.outcome_status?.category || 'Status unavailable'}</td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {crime.outcome_status?.date ? formatDate(crime.outcome_status.date) : '-'}
                        </td>
                      </tr>
                    ))}
                    {crimes.length === 0 && (
                       <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          No crimes recorded for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      {!loading && (
        <footer className="bg-slate-100 border-t border-slate-200 mt-auto shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid md:grid-cols-2 gap-8 text-sm text-slate-500">
              <div>
                <h4 className="font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Disclaimer</h4>
                <p className="mb-2">
                  Data provided for information purposes only. This tool is not affiliated with the Wiltshire Police or the Office for National Statistics.
                  This report is generated automatically using open government data and should not be used for legal or emergency purposes.
                </p>
                <p><strong>Last Retrieved:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Data Sources</h4>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>
                      <strong>Crime Data:</strong> Provided by the <a href="https://data.police.uk/about/data/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Police.uk API</a>. 
                      Contains public sector information licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open Government Licence v3.0</a>.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span>•</span>
                    <span>
                      <strong>Parish Boundary:</strong> <a href="https://geoportal.statistics.gov.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ONS Open Geography Portal</a>. 
                      Contains National Statistics data © Crown copyright and database right {new Date().getFullYear()}.
                      Contains OS data © Crown copyright and database right {new Date().getFullYear()}.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </footer>
      )}

      <EmbedModal isOpen={showEmbedModal} onClose={() => setShowEmbedModal(false)} />
    </div>
  );
};

export default App;