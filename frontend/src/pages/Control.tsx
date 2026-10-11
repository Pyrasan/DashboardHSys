import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { DetectionEntry } from '../types';
import { ArrowRightCircle, ArrowLeftCircle, History, RefreshCw, Shield } from 'lucide-react';

interface CommandEntry {
  command?: string;
  time?: number;
}

export default function Control() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [history, setHistory] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const res = await api.getHistory('command', user?.sessionId, 50);
    if (Array.isArray(res)) {
      setHistory(res);
    }
  };

  const sendCommand = async (command: string) => {
    setSending(true);
    const res = await api.sendCommand(command, user?.sessionId);
    setSending(false);
    if (res.ok) {
      loadHistory();
    } else {
      alert(res.error || t('control.send_failed'));
    }
  };

  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseMessage = (msg: string): CommandEntry => {
    try {
      return JSON.parse(msg);
    } catch {
      return {};
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white">{t('gate_control.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('gate_control.desc')}</p>
        </div>
        <button
          onClick={loadHistory}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <RefreshCw size={16} />
          {t('common.refresh')}
        </button>
      </div>

      {user?.role !== 'admin' ? (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-700 rounded-full flex items-center justify-center">
              <Shield size={24} className="text-amber-600 dark:text-amber-200" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">{t('gate_control.access_restricted')}</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">{t('gate_control.access_desc')}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => sendCommand('OPEN - ENTRY')}
            disabled={sending}
            className="group flex items-center justify-center gap-4 p-8 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-400 disabled:to-slate-500 text-white rounded-xl transition-all shadow-sm hover:shadow-md"
          >
            <ArrowRightCircle size={48} className="group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="text-xl font-bold">{t('control.open_entry_btn')}</p>
              <p className="text-sm opacity-80">{t('gate_control.open_entry')}</p>
            </div>
          </button>

          <button
            onClick={() => sendCommand('OPEN - EXIT')}
            disabled={sending}
            className="group flex items-center justify-center gap-4 p-8 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 disabled:from-slate-400 disabled:to-slate-500 text-white rounded-xl transition-all shadow-sm hover:shadow-md"
          >
            <ArrowLeftCircle size={48} className="group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <p className="text-xl font-bold">{t('control.open_exit_btn')}</p>
              <p className="text-sm opacity-80">{t('gate_control.open_exit')}</p>
            </div>
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#0b1120] dark:text-white flex items-center gap-2">
            <History size={20} />
            {t('gate_control.history')}
          </h2>
        </div>

        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <History size={20} className="text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm">{t('gate_control.no_commands')}</p>
            </div>
          ) : (
            history.map((entry, idx) => {
              const msg = parseMessage(entry.message);
              const isEntry = msg.command?.includes('ENTRY');
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    isEntry 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500 dark:border-emerald-600' 
                      : 'bg-violet-50 dark:bg-violet-900/30 border-l-4 border-violet-500 dark:border-violet-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isEntry ? (
                      <ArrowRightCircle className="text-emerald-600 dark:text-emerald-400" size={18} />
                    ) : (
                      <ArrowLeftCircle className="text-violet-600 dark:text-violet-400" size={18} />
                    )}
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{msg.command || entry.message}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {msg.time ? new Date(msg.time).toLocaleString('id-ID') : formatTime(entry.ts)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
