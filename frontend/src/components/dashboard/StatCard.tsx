import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
}

const colorMap = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, color = 'blue' }) => {
  return (
    <div className="bg-[#111827]/80 backdrop-blur-sm border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`p-3 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
