import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { emailApi } from '../../services/emailApi';
import { slackApi } from '../../services/slackApi';
import { StatCard } from '../../components/dashboard/StatCard';
import { Mail, Clock, Send, AlertTriangle, CheckCircle2, Slack, ExternalLink } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const Dashboard: React.FC<{ onComposeClick: () => void }> = ({ onComposeClick }) => {
  const { data: statsData } = useQuery({
    queryKey: ['emailStats'],
    queryFn: () => emailApi.getStats(),
    refetchInterval: 5000,
  });

  const { data: slackData, refetch: refetchSlack } = useQuery({
    queryKey: ['slackStatus'],
    queryFn: () => slackApi.getStatus(),
  });

  const stats = statsData?.stats || {
    scheduled: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
    total: 0,
  };

  // Mock trend points computed from live statistics for visualization
  const chartData = [
    { name: '10:00', sent: Math.max(0, stats.sent - 15), scheduled: stats.scheduled + 10 },
    { name: '11:00', sent: Math.max(0, stats.sent - 10), scheduled: stats.scheduled + 5 },
    { name: '12:00', sent: Math.max(0, stats.sent - 5), scheduled: stats.scheduled + 2 },
    { name: '13:00', sent: stats.sent, scheduled: stats.scheduled },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#111827] to-[#0E1322] border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Email Job Scheduler & Automation</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              High-throughput delayed job scheduler with BullMQ, Redis distributed rate-limiting, and automatic failure recovery.
            </p>
          </div>
          <button
            onClick={onComposeClick}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-600/30 transition active:scale-[0.98] self-start md:self-auto"
          >
            <Mail className="w-4 h-4" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Scheduled"
          value={stats.scheduled}
          icon={Clock}
          color="blue"
          trend="In queue / delayed"
        />
        <StatCard
          title="Active Processing"
          value={stats.processing}
          icon={Mail}
          color="amber"
          trend="Currently sending"
        />
        <StatCard
          title="Successfully Sent"
          value={stats.sent}
          icon={CheckCircle2}
          color="emerald"
          trend="Delivered to SMTP"
        />
        <StatCard
          title="Delivery Failures"
          value={stats.failed}
          icon={AlertTriangle}
          color="red"
          trend="Failed attempts"
        />
      </div>

      {/* Two Column Grid: Charts and Slack Integration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Execution Throughput</h3>
              <p className="text-xs text-slate-400">Sent vs Scheduled jobs over time</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Sent
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Scheduled
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSched" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="sent" stroke="#10b981" fillOpacity={1} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="scheduled" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSched)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Slack Integration Box */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Slack className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Slack Notifications</h3>
                <p className="text-xs text-slate-400">Real-time alerts on rate limits</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              When an email sender reaches their configured hourly limit (e.g. 200/hr), ReachInbox automatically posts an alert to your Slack workspace with rescheduled timings.
            </p>

            {slackData?.connected ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Connected to {slackData.integration?.teamName}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Channel: {slackData.integration?.channelName || '#general'}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400">
                Slack is currently not connected. Rate limit alerts will be logged in PostgreSQL.
              </div>
            )}
          </div>

          <div className="pt-6">
            {slackData?.connected ? (
              <button
                onClick={async () => {
                  await slackApi.disconnect();
                  refetchSlack();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition"
              >
                Disconnect Slack Workspace
              </button>
            ) : (
              <a
                href="http://localhost:5000/api/slack/connect"
                className="w-full py-2.5 px-4 rounded-lg bg-[#4A154B] hover:bg-[#611f69] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
              >
                <Slack className="w-4 h-4" />
                <span>Connect Slack Workspace</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
