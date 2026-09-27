import React, { useEffect, useState, useMemo } from 'react';
import { fetchCodfordBoundary } from './services/onsService';
import {
  fetchAvailableDates,
  fetchCrimesInBoundary,
  fetchCrimesInDateRange,
  getMonthsBetween,
} from './services/policeService';
import {
  generateCrimeReport,
  generateRiskAssessment,
  CrimeReportResponse,
  RiskAssessmentResponse,
} from './services/geminiService';
import { Crime, GeoFeature, CrimeSummary } from './types';
import CrimeMap from './components/CrimeMap';
import CrimeChart from './components/CrimeChart';
import EmbedModal from './components/EmbedModal';
import DiagnosticsModal from './components/DiagnosticsModal';
import RiskAssessmentCard from './components/RiskAssessmentCard';
import ReactMarkdown from 'react-markdown';
import {
  ShieldAlert,
  MapPin,
  Calendar,
  CalendarRange,
  Loader2,
  FileText,
  BarChart3,
  Info,
  Code,
  Filter,
  Copy,
  Check,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Cpu,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';

// Helper to format YYYY-MM or YYYY-MM to YYYY-MM to readable string (e.g. "2024-03" -> "Mar 2024", "2023-09 to 2024-05" -> "Sep 2023 – May 2024")
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    const fmt = (s: string) => {
      const [year, month] = s.split('-').map(Number);
      return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }
  const [year, month] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const App: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [boundary, setBoundary] = useState<GeoFeature | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  
  // Date Mode: 'single' (specific month) or 'range' (date span)
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [reportDate, setReportDate] = useState<string>('');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [rangePreset, setRangePreset] = useState<'3months' | '6months' | '12months' | 'custom'>('6months');
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);

  const [crimes, setCrimes] = useState<Crime[]>([]);
  const [lastFetchedDate, setLastFetchedDate] = useState<string | null>(null);

  // Month-by-month and range report storage (prevents redundant token use and avoids loops)
  const [reportsByDate, setReportsByDate] = useState<Record<string, CrimeReportResponse>>({});
  const [riskAssessmentsByDate, setRiskAssessmentsByDate] = useState<Record<string, RiskAssessmentResponse>>({});

  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [generatingRiskAssessment, setGeneratingRiskAssessment] = useState<boolean>(false);

  const [showEmbedModal, setShowEmbedModal] = useState<boolean>(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  
  // Refinement States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredCrimeId, setHoveredCrimeId] = useState<number | null>(null);
  const [reportCopied, setReportCopied] = useState<boolean>(false);

  // Determine active date key
  const effectiveDate = useMemo(() => {
    if (dateMode === 'single') {
      return reportDate;
    }
    if (rangeStart && rangeEnd) {
      const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
      return `${start} to ${end}`;
    }
    return reportDate;
  }, [dateMode, reportDate, rangeStart, rangeEnd]);

  // Determine active months to query
  const activeMonths = useMemo(() => {
    if (dateMode === 'single') {
      return reportDate ? [reportDate] : [];
    }
    if (rangeStart && rangeEnd) {
      return getMonthsBetween(rangeStart, rangeEnd, availableDates);
    }
    return reportDate ? [reportDate] : [];
  }, [dateMode, reportDate, rangeStart, rangeEnd, availableDates]);

  // Cooldown countdown for rate-limit reset
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // 1. Initial Setup: Get Boundary and Date List
  useEffect(() => {
    const initApp = async () => {
      try {
        setInitialLoading(true);
        
        // Fetch Boundary
        const boundaryData = await fetchCodfordBoundary();
        if (!boundaryData) {
          throw new Error("Could not find boundary data for Codford.");
        }
        setBoundary(boundaryData);

        // Fetch Date List
        const dates = await fetchAvailableDates();
        setAvailableDates(dates);
        
        // Set Default Date (Latest) and Initial 6-Month Range
        if (dates.length > 0) {
          setReportDate(dates[0]);
          setRangeEnd(dates[0]);
          setRangeStart(dates[Math.min(5, dates.length - 1)]);
        }

      } catch (err: any) {
        setError(err.message || "An unexpected error occurred during initialization.");
      } finally {
        setInitialLoading(false);
      }
    };

    initApp();
  }, []);

  // 2. Fetch Crimes when Date Selection or Boundary Changes
  useEffect(() => {
    const loadCrimes = async () => {
      if (!boundary || activeMonths.length === 0) return;

      try {
        setDataLoading(true);
        if (dateMode === 'single') {
          const crimeData = await fetchCrimesInBoundary(boundary, reportDate);
          setCrimes(crimeData);
          setLastFetchedDate(reportDate);
        } else {
          setLoadProgress({ loaded: 0, total: activeMonths.length });
          const crimeData = await fetchCrimesInDateRange(
            boundary,
            activeMonths,
            (loaded, total) => setLoadProgress({ loaded, total })
          );
          setCrimes(crimeData);
          setLastFetchedDate(effectiveDate);
        }
      } catch (err: any) {
        console.error("Failed to load crimes for", effectiveDate, err);
        setCrimes([]); 
        setLastFetchedDate(effectiveDate);
      } finally {
        setDataLoading(false);
        setLoadProgress(null);
      }
    };

    loadCrimes();
  }, [boundary, dateMode, reportDate, activeMonths, effectiveDate]);

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

  // Calculate Monthly Incident Trend for Date Range Mode
  const monthlyTrend = useMemo(() => {
    if (dateMode !== 'range' || activeMonths.length <= 1) return [];

    const countsByMonth: Record<string, number> = {};
    activeMonths.forEach((m) => { countsByMonth[m] = 0; });

    crimes.forEach((c) => {
      if (countsByMonth[c.month] !== undefined) {
        countsByMonth[c.month] += 1;
      }
    });

    return [...activeMonths]
      .sort((a, b) => a.localeCompare(b))
      .map((m) => {
        const [year, month] = m.split('-').map(Number);
        const label = new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        return {
          month: m,
          label,
          count: countsByMonth[m] || 0,
        };
      });
  }, [dateMode, activeMonths, crimes]);

  // Derived state for Filtering
  const filteredCrimes = useMemo(() => {
    if (selectedCategory === 'all') return crimes;
    return crimes.filter(c => c.category === selectedCategory);
  }, [crimes, selectedCategory]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(crimes.map(c => c.category));
    return Array.from(cats).sort();
  }, [crimes]);

  // Current report objects for active date
  const currentReport = effectiveDate ? reportsByDate[effectiveDate] : null;
  const aiReportText = currentReport?.report || null;
  const isQuotaExhausted = currentReport?.isQuotaExhausted || false;
  const reportSource = currentReport?.source || 'gemini-3.8-flash';

  const currentRiskAssessment = effectiveDate ? riskAssessmentsByDate[effectiveDate] || null : null;

  // Trigger Report & Risk Assessment Generation
  useEffect(() => {
    if (
      !initialLoading && 
      !dataLoading && 
      summary && 
      effectiveDate && 
      lastFetchedDate === effectiveDate
    ) {
      // 1. Monthly / Period Crime Activity Report
      if (!reportsByDate[effectiveDate] && !generatingReport) {
        setGeneratingReport(true);
        generateCrimeReport(effectiveDate, summary, crimes, false)
          .then(result => {
            setReportsByDate(prev => ({ ...prev, [effectiveDate]: result }));
            if (result.isQuotaExhausted) {
              setCooldownSeconds(60);
            }
          })
          .catch(err => {
            console.error("Report generation failed:", err);
            setReportsByDate(prev => ({
              ...prev,
              [effectiveDate]: {
                report: `### ${summary.total} Incidents Recorded in ${formatDate(effectiveDate)}\n\n**Executive Summary:** Official Wiltshire Police records log **${summary.total}** incident${summary.total === 1 ? '' : 's'} for Codford Parish. Primary category: **${summary.mostFrequentCategory}**.\n\n*(Note: Instant parish statistics generated)*`,
                source: 'statistical_fallback_error',
                message: err?.message || 'Generation error',
              }
            }));
          })
          .finally(() => setGeneratingReport(false));
      }

      // 2. Local Risk & Benchmark Assessment (Dixon of Dock Green & Crimewatch analysis)
      if (!riskAssessmentsByDate[effectiveDate] && !generatingRiskAssessment) {
        setGeneratingRiskAssessment(true);
        generateRiskAssessment(effectiveDate, summary, false)
          .then(result => {
            setRiskAssessmentsByDate(prev => ({ ...prev, [effectiveDate]: result }));
            if (result.isQuotaExhausted) {
              setCooldownSeconds(60);
            }
          })
          .catch(err => {
            console.error("Risk assessment failed:", err);
            setRiskAssessmentsByDate(prev => ({
              ...prev,
              [effectiveDate]: {
                assessment: `Evening All,\n\nTaking a look at our figures for ${formatDate(effectiveDate)}, Codford recorded ${summary.total} incident(s). While any incident in our village is noticeable, Wiltshire remains one of the safest police force areas in England (~56 per 1,000 annually vs ~89 nationally). Everyday crime risk in Codford remains exceptionally low.\n\nDon't have nightmares!`,
                source: 'statistical_fallback_error',
                message: err?.message || 'Risk assessment error',
              }
            }));
          })
          .finally(() => setGeneratingRiskAssessment(false));
      }
    }
  }, [
    initialLoading,
    dataLoading,
    crimes,
    summary,
    effectiveDate,
    reportsByDate,
    riskAssessmentsByDate,
    generatingReport,
    generatingRiskAssessment,
    lastFetchedDate
  ]);

  const handleRegenerateReport = () => {
    if (generatingReport || cooldownSeconds > 0) return;
    setGeneratingReport(true);
    generateCrimeReport(effectiveDate, summary, crimes, true)
      .then(result => {
        setReportsByDate(prev => ({ ...prev, [effectiveDate]: result }));
        if (result.isQuotaExhausted) {
          setCooldownSeconds(60);
        }
      })
      .catch(err => {
        console.error("Regeneration failed:", err);
      })
      .finally(() => setGeneratingReport(false));
  };

  const handleRefreshRiskAssessment = () => {
    if (generatingRiskAssessment || cooldownSeconds > 0) return;
    setGeneratingRiskAssessment(true);
    generateRiskAssessment(effectiveDate, summary, true)
      .then(result => {
        setRiskAssessmentsByDate(prev => ({ ...prev, [effectiveDate]: result }));
        if (result.isQuotaExhausted) {
          setCooldownSeconds(60);
        }
      })
      .catch(err => {
        console.error("Risk assessment refresh failed:", err);
      })
      .finally(() => setGeneratingRiskAssessment(false));
  };

  const handleCopyReport = () => {
    if (aiReportText) {
      navigator.clipboard.writeText(aiReportText);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setReportDate(e.target.value);
    setSelectedCategory('all');
  };

  const handlePresetSelect = (preset: '3months' | '6months' | '12months') => {
    setRangePreset(preset);
    if (availableDates.length === 0) return;
    const end = availableDates[0];
    let count = 3;
    if (preset === '6months') count = 6;
    if (preset === '12months') count = 12;
    const start = availableDates[Math.min(count - 1, availableDates.length - 1)];
    setRangeEnd(end);
    setRangeStart(start);
    setSelectedCategory('all');
  };

  const handleRangeStartChange = (val: string) => {
    setRangeStart(val);
    setRangePreset('custom');
    setSelectedCategory('all');
    if (val > rangeEnd) {
      setRangeEnd(val);
    }
  };

  const handleRangeEndChange = (val: string) => {
    setRangeEnd(val);
    setRangePreset('custom');
    setSelectedCategory('all');
    if (val < rangeStart) {
      setRangeStart(val);
    }
  };

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
          <div className="flex items-center space-x-3 sm:space-x-4 text-sm text-slate-300">
             <div className="hidden sm:flex items-center space-x-1">
                <MapPin className="w-4 h-4" />
                <span>Codford, Wiltshire</span>
             </div>
             {effectiveDate && (
              <div className="hidden sm:flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(effectiveDate)}</span>
              </div>
             )}

             {/* Diagnostics Button */}
             <button 
                onClick={() => setShowDiagnosticsModal(true)}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition-colors text-white border border-slate-700 text-xs sm:text-sm"
                title="AI Model & Token Diagnostics"
             >
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="hidden xs:inline">Diagnostics</span>
             </button>

             {/* Embed Button */}
             <button 
                onClick={() => setShowEmbedModal(true)}
                className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md transition-colors text-white border border-slate-700 text-xs sm:text-sm"
                title="Get code to embed on website"
             >
                <Code className="w-4 h-4" />
                <span className="hidden xs:inline">Embed</span>
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Prominent Reporting Notice */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 mb-8 rounded-r-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
           <div className="bg-amber-100 p-3 rounded-full shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
           </div>
           <div className="flex-grow">
              <h3 className="text-lg font-bold text-amber-900 mb-1">Help Protect Our Community: Report Every Incident</h3>
              <p className="text-amber-800 text-sm mb-3 max-w-3xl">
                Accurate crime data is essential for effective policing in Codford. If incidents aren't reported, they don't appear in these statistics or influence police resource allocation.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                  <span className="text-amber-900">
                    <span className="font-bold">Emergency:</span> 999
                  </span>
                  <span className="text-amber-900">
                     <span className="font-bold">Non-Emergency:</span> 101
                  </span>
                  <a 
                    href="https://www.wiltshire.police.uk/ro/report/ocr/af/how-to-report-a-crime/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-blue-700 bg-white border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors shadow-sm"
                  >
                    <span>Report Online via Wiltshire Police</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
              </div>
           </div>
        </div>

        {initialLoading ? (
           <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-slate-500 animate-pulse">Initializing geography and connection...</p>
           </div>
        ) : (
          <div className="space-y-8">
            
            {/* Filter & Date Controls */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800">Parish Report Parameters</h3>
                  <span className="hidden sm:inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {dateMode === 'single' ? 'Single Month' : `${activeMonths.length} Months Span`}
                  </span>
                </div>

                {/* Mode Switcher: Specific Month vs Date Range */}
                <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto text-xs sm:text-sm font-medium">
                  <button
                    onClick={() => { setDateMode('single'); setSelectedCategory('all'); }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
                      dateMode === 'single'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Specific Month</span>
                  </button>
                  <button
                    onClick={() => { setDateMode('range'); setSelectedCategory('all'); }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all ${
                      dateMode === 'range'
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CalendarRange className="w-4 h-4 text-indigo-600" />
                    <span>Date Range</span>
                  </button>
                </div>
              </div>

              {/* Controls Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {dateMode === 'single' ? (
                  /* Single Month Picker */
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <label htmlFor="date-select" className="text-sm font-medium text-slate-600">Month:</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                          id="date-select"
                          value={reportDate}
                          onChange={handleDateChange}
                          disabled={dataLoading}
                          className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-48 disabled:opacity-50"
                        >
                          {availableDates.map(date => (
                            <option key={date} value={date}>{formatDate(date)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Date Range Picker */
                  <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                    {/* Quick Presets */}
                    <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs font-medium">
                      <button
                        onClick={() => handlePresetSelect('3months')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          rangePreset === '3months' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Last 3M
                      </button>
                      <button
                        onClick={() => handlePresetSelect('6months')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          rangePreset === '6months' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Last 6M
                      </button>
                      <button
                        onClick={() => handlePresetSelect('12months')}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          rangePreset === '12months' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Last 12M
                      </button>
                    </div>

                    {/* From Month */}
                    <div className="flex items-center space-x-2">
                      <label htmlFor="range-start-select" className="text-sm font-medium text-slate-600">From:</label>
                      <select
                        id="range-start-select"
                        value={rangeStart}
                        onChange={(e) => handleRangeStartChange(e.target.value)}
                        disabled={dataLoading}
                        className="py-1.5 px-3 bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block disabled:opacity-50"
                      >
                        {[...availableDates].reverse().map(date => (
                          <option key={`start-${date}`} value={date}>{formatDate(date)}</option>
                        ))}
                      </select>
                    </div>

                    {/* To Month */}
                    <div className="flex items-center space-x-2">
                      <label htmlFor="range-end-select" className="text-sm font-medium text-slate-600">To:</label>
                      <select
                        id="range-end-select"
                        value={rangeEnd}
                        onChange={(e) => handleRangeEndChange(e.target.value)}
                        disabled={dataLoading}
                        className="py-1.5 px-3 bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block disabled:opacity-50"
                      >
                        {availableDates.map(date => (
                          <option key={`end-${date}`} value={date}>{formatDate(date)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Right side: Category Filter */}
                <div className="flex items-center space-x-2 self-start lg:self-auto">
                  <label htmlFor="category-select" className="text-sm font-medium text-slate-600">Category:</label>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      id="category-select"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      disabled={dataLoading || crimes.length === 0}
                      className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-48 disabled:opacity-50"
                    >
                      <option value="all">All Categories ({crimes.length})</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Context bar for Date Range */}
              {dateMode === 'range' && (
                <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Viewing <strong>{activeMonths.length} months</strong>: {formatDate(effectiveDate)} across Codford Parish boundary.
                  </span>
                  <span>
                    Aggregated official data: <strong>{crimes.length} incident{crimes.length === 1 ? '' : 's'}</strong> logged.
                  </span>
                </div>
              )}
            </div>

            {dataLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-slate-600 font-medium">
                  {loadProgress && loadProgress.total > 1
                    ? `Retrieving crime data across ${loadProgress.total} months (${loadProgress.loaded}/${loadProgress.total} loaded)...`
                    : `Retrieving crime data for ${formatDate(effectiveDate)}...`}
                </p>
                {loadProgress && loadProgress.total > 1 && (
                  <div className="w-64 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
                <>
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
                      <p className="text-xl font-bold text-slate-900">{formatDate(effectiveDate)}</p>
                    </div>
                  </div>
                </div>

                {/* NEW: Stats Analysis Card: Codford vs National & County Averages */}
                <RiskAssessmentCard
                  assessmentData={currentRiskAssessment}
                  loading={generatingRiskAssessment}
                  onRefresh={handleRefreshRiskAssessment}
                  cooldownSeconds={cooldownSeconds}
                  summary={summary}
                  formattedDate={formatDate(effectiveDate)}
                />

                {/* AI Activity Summary Section */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                   <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-2 text-white">
                        <FileText className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Activity Summary</h2>
                        {reportSource === 'gemini-3.8-flash' && (
                          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-300" /> Gemini 3.8
                          </span>
                        )}
                        {reportSource === 'gemini-3.1-flash-lite' && (
                          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-300" /> Gemini 3.1
                          </span>
                        )}
                        {reportSource === 'cache' && (
                          <span className="text-xs bg-emerald-400/25 text-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300/30">
                            <Zap className="w-3 h-3 text-emerald-300" /> Cached (0 Tokens)
                          </span>
                        )}
                        {(reportSource.startsWith('statistical_fallback') || isQuotaExhausted) && (
                          <span className="text-xs bg-amber-400/25 text-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300/30">
                            <BarChart3 className="w-3 h-3 text-amber-300" /> Parish Statistics
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {generatingReport && <Loader2 className="w-5 h-5 text-white/80 animate-spin" />}
                        
                        {/* Regenerate / Retry button */}
                        {!generatingReport && (
                          <button
                            onClick={handleRegenerateReport}
                            disabled={cooldownSeconds > 0}
                            className="flex items-center space-x-1 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-2.5 py-1 rounded transition-colors"
                            title={cooldownSeconds > 0 ? `Rate limit cooldown: ${cooldownSeconds}s remaining` : 'Refresh analysis'}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${cooldownSeconds > 0 ? 'text-amber-300' : ''}`} />
                            <span>{cooldownSeconds > 0 ? `${cooldownSeconds}s Cooldown` : 'Refresh'}</span>
                          </button>
                        )}

                        {/* Copy Report */}
                        {!generatingReport && aiReportText && (
                          <button 
                            onClick={handleCopyReport}
                            className="flex items-center space-x-1 text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded transition-colors"
                            title="Copy report markdown to clipboard"
                          >
                             {reportCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                             <span>{reportCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}
                      </div>
                   </div>

                   {/* Rate Limit / Token Notice Banner */}
                   {isQuotaExhausted && (
                     <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
                        <div className="flex items-start sm:items-center gap-2">
                           <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                           <span>
                             <strong>API Token Limit Reached:</strong> Google Gemini rate limit (tokens per minute) was reached. An accurate parish statistical analysis is active below without interruption.
                           </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setShowDiagnosticsModal(true)}
                            className="text-amber-800 underline hover:text-amber-950 font-medium"
                          >
                            Diagnostics
                          </button>
                          <button
                            onClick={handleRegenerateReport}
                            disabled={generatingReport || cooldownSeconds > 0}
                            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 disabled:opacity-50 text-amber-900 rounded font-medium transition-colors flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${generatingReport ? 'animate-spin' : ''}`} />
                            {cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Retry AI'}
                          </button>
                        </div>
                     </div>
                   )}

                   <div className="p-8 prose prose-slate max-w-none">
                      {generatingReport ? (
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                          <div className="h-4 bg-slate-100 rounded w-full"></div>
                          <div className="h-4 bg-slate-100 rounded w-5/6"></div>
                        </div>
                      ) : (
                        <ReactMarkdown>{aiReportText || "No analysis available."}</ReactMarkdown>
                      )}
                   </div>
                </div>

                {/* Visuals Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <h3 className="text-lg font-semibold text-slate-800 flex items-center space-x-2">
                          <MapPin className="w-5 h-5 text-slate-500" />
                          <span>Incident Map</span>
                        </h3>
                    </div>
                    {boundary && (
                      <CrimeMap 
                        boundary={boundary} 
                        crimes={filteredCrimes} 
                        hoveredCrimeId={hoveredCrimeId}
                      />
                    )}
                    <p className="text-xs text-slate-400">
                      *Map visualizes crime locations relative to the Codford Civil Parish boundary. 
                      Red dots represent approximate locations provided by police.uk.
                      Hover over the Incident Log to highlight locations.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <CrimeChart 
                      summary={summary} 
                      monthlyTrend={monthlyTrend} 
                      isRangeMode={dateMode === 'range'} 
                    />
                  </div>
                </div>

                {/* Raw Data Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-800">Incident Log</h3>
                    <span className="text-xs text-slate-500">
                      {filteredCrimes.length} {filteredCrimes.length === 1 ? 'incident' : 'incidents'} shown
                    </span>
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
                        {filteredCrimes.map((crime) => (
                          <tr 
                            key={crime.id} 
                            className={`transition-colors cursor-default ${
                              hoveredCrimeId === crime.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                            }`}
                            onMouseEnter={() => setHoveredCrimeId(crime.id)}
                            onMouseLeave={() => setHoveredCrimeId(null)}
                          >
                            <td className="px-6 py-3 whitespace-nowrap">{formatDate(crime.month)}</td>
                            <td className="px-6 py-3 capitalize">
                               <span className={`inline-block px-2 py-0.5 rounded text-xs border ${
                                 crime.category === 'anti-social-behaviour' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                 crime.category.includes('violent') ? 'bg-red-50 text-red-700 border-red-200' :
                                 'bg-slate-100 text-slate-600 border-slate-200'
                               }`}>
                                {crime.category.replace(/-/g, ' ')}
                               </span>
                            </td>
                            <td className="px-6 py-3 font-medium text-slate-700">{crime.location.street.name}</td>
                            <td className="px-6 py-3">{crime.outcome_status?.category || 'Status unavailable'}</td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              {crime.outcome_status?.date ? formatDate(crime.outcome_status.date) : '-'}
                            </td>
                          </tr>
                        ))}
                        {filteredCrimes.length === 0 && (
                           <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                              <p>No crimes recorded matching your selection.</p>
                              {selectedCategory !== 'all' && (
                                <button 
                                  onClick={() => setSelectedCategory('all')}
                                  className="mt-2 text-blue-600 hover:underline text-sm"
                                >
                                  Clear filters
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
            )}

          </div>
        )}
      </main>

      {!initialLoading && (
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
      <DiagnosticsModal 
        isOpen={showDiagnosticsModal} 
        onClose={() => setShowDiagnosticsModal(false)}
        onCacheCleared={() => {
          setReportsByDate({});
          setRiskAssessmentsByDate({});
        }}
      />
    </div>
  );
};

export default App;
