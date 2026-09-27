import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CrimeSummary } from '../types';
import { BarChart3, TrendingUp } from 'lucide-react';

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  count: number;
}

interface CrimeChartProps {
  summary: CrimeSummary;
  monthlyTrend?: MonthlyTrendPoint[];
  isRangeMode?: boolean;
}

const CrimeChart: React.FC<CrimeChartProps> = ({ summary, monthlyTrend, isRangeMode = false }) => {
  const [viewMode, setViewMode] = useState<'category' | 'trend'>('category');
  const data = summary.byCategory;
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const hasTrend = isRangeMode && monthlyTrend && monthlyTrend.length > 1;

  return (
    <div className="w-full h-[430px] bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            {viewMode === 'category' ? 'Crime Category Breakdown' : 'Monthly Incident Trend'}
          </h3>
          <p className="text-xs text-slate-500">
            {viewMode === 'category' 
              ? `${summary.total} total incident${summary.total === 1 ? '' : 's'} recorded` 
              : `Distribution across ${monthlyTrend?.length || 0} months`}
          </p>
        </div>

        {hasTrend && (
          <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-auto border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setViewMode('category')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                viewMode === 'category'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>By Category</span>
            </button>
            <button
              onClick={() => setViewMode('trend')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                viewMode === 'trend'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Monthly Trend</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-grow w-full min-h-[300px]">
        {viewMode === 'category' ? (
          data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              No incidents recorded for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={150} 
                  tick={{ fontSize: 12, fill: '#475569' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  formatter={(val: number) => [`${val} incident${val === 1 ? '' : 's'}`, 'Count']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyTrend}
              margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                formatter={(val: number) => [`${val} incident${val === 1 ? '' : 's'}`, 'Total Incidents']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default CrimeChart;
