import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { emailApi } from '../../services/emailApi';
import { format } from 'date-fns';
import { Search, Send, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { EmailJob } from '../../types';

export const SentEmails: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sentEmails', page, statusFilter, searchQuery],
    queryFn: () =>
      searchQuery
        ? emailApi.search(searchQuery, statusFilter, page, 15)
        : emailApi.getSent(page, 15, statusFilter),
    refetchInterval: 5000,
  });

  const emails: EmailJob[] = data?.items || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Sent & Delivery History</h2>
          <p className="text-sm text-slate-400">View successfully dispatched emails, Ethereal preview links, and errors</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Delivery States</option>
            <option value="sent">Sent Only</option>
            <option value="failed">Failed Only</option>
          </select>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search recipient or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-[#111827] border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>

          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0E1322] text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Sender</th>
                <th className="px-6 py-4">Sent Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ethereal Preview / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading delivery records...</p>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Send className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-medium text-slate-300">No sent emails recorded yet</p>
                    <p className="text-xs text-slate-500 mt-1">Dispatched emails will appear here.</p>
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr key={email.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-medium text-white">{email.recipientEmail}</td>
                    <td className="px-6 py-4 text-slate-300 truncate max-w-xs">{email.subject}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {email.sender?.senderEmail || 'Default'}
                    </td>
                    <td className="px-6 py-4 text-slate-300 whitespace-nowrap text-xs">
                      {email.sentAt ? format(new Date(email.sentAt), 'MMM dd, yyyy HH:mm:ss') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {email.status === 'sent' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Sent
                        </span>
                      )}
                      {email.status === 'failed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20" title={email.lastError || ''}>
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {email.previewUrl ? (
                        <a
                          href={email.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20"
                        >
                          <span>View in Ethereal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : email.lastError ? (
                        <span className="text-xs text-red-400 truncate max-w-xs block ml-auto">
                          {email.lastError}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded bg-slate-800 disabled:opacity-50 text-slate-200"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-slate-800 disabled:opacity-50 text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
