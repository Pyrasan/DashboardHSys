import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { DetectionEntry } from '../types';
import { CheckCircle, XCircle, Trash2, Filter } from 'lucide-react';

export default function Detection() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const [history, setHistory] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const loadedRef = React.useRef(false);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && loadedRef.current) {
      const detection = messages.filter(m => m.topic === 'gate/detection');
      setHistory(prev => {
        const existingTs = new Set(prev.map((e: any) => e.ts));
        const newEntries = detection.filter((e: any) => !existingTs.has(e.ts));
        if (newEntries.length === 0) return prev;
        return [...newEntries, ...prev].slice(0, 200);
      });
    }
  }, [messages]);

  const loadHistory = async () => {
    const res = await api.getHistory('detection', user?.sessionId, 200);
    if (Array.isArray(res)) {
      setHistory(res);
      loadedRef.current = true;
    }
  };

  const handleDelete = async () => {
    if (confirm(t('detection.clear_confirm'))) {
      await api.deleteHistory('detection', user?.sessionId);
      setHistory([]);
    }
  };

  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleString();
  };

  const parseMessage = (msg: string): DetectionEntry => {
    try {
      return JSON.parse(msg);
    } catch {
      return {};
    }
  };

  const getStatusColor = (faceValid?: boolean, plateValid?: boolean): string => {
    if (faceValid && plateValid) return 'border-l-green-500 bg-green-50 dark:bg-green-900/30 dark:border-l-green-400';
    if (!faceValid && !plateValid) return 'border-l-red-500 bg-red-50 dark:bg-red-900/30 dark:border-l-red-400';
    return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:border-l-orange-400';
  };

  const filteredHistory = history.filter(entry => {
    if (filter === 'all') return true;
    const msg = parseMessage(entry.message);
    return msg.mode === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white">{t('detection.history')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('detection.history_desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('detection.all_modes')}</option>
              <option value="ENTRY">{t('detection.entry_option')}</option>
              <option value="EXIT">{t('detection.exit_option')}</option>
            </select>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={handleDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.time')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.plate')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.mode')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.face')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.plate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                        <Filter size={20} className="text-slate-300" />
                      </div>
                      <p>{t('detection.no_detections')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((entry, idx) => {
                  const msg = parseMessage(entry.message);
                  return (
                    <tr key={idx} className={`border-l-4 ${getStatusColor(msg.face_valid, msg.plate_valid)} hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors`}>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatTime(entry.ts)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{msg.person || msg.muka || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{msg.plat || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          msg.mode === 'ENTRY' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-violet-100 text-violet-700'
                        }`}>
                          {msg.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {msg.face_valid ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={16} />
                            <span className="text-xs">{t('detection.face_valid')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                            <XCircle size={16} />
                            <span className="text-xs">{t('detection.face_invalid')}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {msg.plate_valid ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={16} />
                            <span className="text-xs">{t('detection.plate_valid')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-500 dark:text-red-400">
                            <XCircle size={16} />
                            <span className="text-xs">{t('detection.plate_invalid')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
