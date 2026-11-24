import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Papa from 'papaparse';
import { X, Upload, Mail, Clock, Send, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { emailApi } from '../../services/emailApi';
import { EmailSender } from '../../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const composeSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  body: z.string().min(1, 'Email body is required'),
  senderId: z.string().min(1, 'Please select a sender profile'),
  startTime: z.string().min(1, 'Scheduled time is required'),
  delayBetweenEmails: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().min(1).default(200),
});

type ComposeFormData = z.infer<typeof composeSchema>;

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [manualRecipientInput, setManualRecipientInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default datetime: now + 5 minutes in local format
  const getDefaultStartTime = () => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ComposeFormData>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      delayBetweenEmails: 2000,
      hourlyLimit: 200,
      startTime: getDefaultStartTime(),
    },
  });

  useEffect(() => {
    if (isOpen) {
      emailApi.getSenders().then((res) => {
        if (res.success && res.senders.length > 0) {
          setSenders(res.senders);
          setValue('senderId', res.senders[0].id);
        }
      });
    }
  }, [isOpen, setValue]);

  if (!isOpen) return null;

  // File Upload Parser (.csv / .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          const extracted: string[] = [];
          let invalid = 0;
          results.data.forEach((row: any) => {
            if (Array.isArray(row)) {
              row.forEach((cell) => {
                if (typeof cell === 'string') {
                  const cleaned = cell.trim();
                  if (emailRegex.test(cleaned)) extracted.push(cleaned.toLowerCase());
                  else if (cleaned.includes('@')) invalid++;
                }
              });
            }
          });
          const unique = Array.from(new Set([...recipients, ...extracted]));
          setRecipients(unique);
          setInvalidCount(invalid);
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split(/[\r\n,;]+/);
        const extracted: string[] = [];
        let invalid = 0;
        lines.forEach((line) => {
          const cleaned = line.trim();
          if (emailRegex.test(cleaned)) extracted.push(cleaned.toLowerCase());
          else if (cleaned.includes('@')) invalid++;
        });
        const unique = Array.from(new Set([...recipients, ...extracted]));
        setRecipients(unique);
        setInvalidCount(invalid);
      };
      reader.readAsText(file);
    }
  };

  const addManualRecipient = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = manualRecipientInput.trim().toLowerCase();
    if (emailRegex.test(trimmed)) {
      if (!recipients.includes(trimmed)) {
        setRecipients([...recipients, trimmed]);
      }
      setManualRecipientInput('');
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ComposeFormData) => {
    if (recipients.length === 0) {
      setErrorMsg('Please add at least one recipient email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await emailApi.schedule({
        subject: data.subject,
        body: data.body,
        recipients,
        senderId: data.senderId,
        startTime: new Date(data.startTime).toISOString(),
        delayBetweenEmails: data.delayBetweenEmails,
        hourlyLimit: data.hourlyLimit,
      });

      reset();
      setRecipients([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to schedule emails. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compose & Schedule Campaign</h2>
              <p className="text-xs text-slate-400">Schedule personalized emails with distributed rate-limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sender & Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Sender Profile
              </label>
              <select
                {...register('senderId')}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.senderName} ({s.senderEmail})
                  </option>
                ))}
              </select>
              {errors.senderId && <p className="text-xs text-red-400 mt-1">{errors.senderId.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Subject
              </label>
              <input
                {...register('subject')}
                placeholder="e.g. Interview Opportunity with Outbox"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
              {errors.subject && <p className="text-xs text-red-400 mt-1">{errors.subject.message}</p>}
            </div>
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Email Content
            </label>
            <textarea
              {...register('body')}
              rows={4}
              placeholder="Write your email body here..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
            />
            {errors.body && <p className="text-xs text-red-400 mt-1">{errors.body.message}</p>}
          </div>

          {/* Recipient Upload & Manual Input */}
          <div className="p-4 rounded-xl bg-[#0B0F19] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white">Recipients</span>
                <span className="ml-2 text-xs text-slate-400">
                  ({recipients.length} valid, {invalidCount} invalid)
                </span>
              </div>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / TXT</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Manual input bar */}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Add recipient manually (e.g. alex@example.com)"
                value={manualRecipientInput}
                onChange={(e) => setManualRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addManualRecipient();
                  }
                }}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={addManualRecipient}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                Add
              </button>
            </div>

            {/* Recipient preview chips */}
            {recipients.length > 0 && (
              <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5 p-2 bg-[#111827] rounded-lg border border-slate-850">
                {recipients.map((email, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-xs text-slate-200"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(idx)}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scheduling Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                {...register('startTime')}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Delay Between Emails (ms)
              </label>
              <input
                type="number"
                {...register('delayBetweenEmails', { valueAsNumber: true })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Hourly Limit / Sender
              </label>
              <input
                type="number"
                {...register('hourlyLimit', { valueAsNumber: true })}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium shadow-lg shadow-emerald-600/30 transition active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Schedule Campaign</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
