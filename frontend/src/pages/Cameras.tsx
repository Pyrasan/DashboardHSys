import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { DetectionEntry } from '../types';
import { Camera, Car, Video, VideoOff, CheckCircle, XCircle, Trash2, Filter } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function Cameras() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const [showEntry, setShowEntry] = useState(true);
  const [showExit, setShowExit] = useState(true);
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
    const res: any = await api.getHistory('detection', user?.sessionId, 200);
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
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Camera size={24} />
            {t('detection.live')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('detection.desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEntry(!showEntry)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showEntry 
                ? 'bg-emerald-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {showEntry ? <Video size={16} /> : <VideoOff size={16} />}
            {t('detection.entry')}
          </button>
          <button
            onClick={() => setShowExit(!showExit)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showExit 
                ? 'bg-violet-600 text-white' 
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {showExit ? <Video size={16} /> : <VideoOff size={16} />}
            {t('detection.exit')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showEntry && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600">
              <div className="flex items-center gap-2 text-white">
                <Car size={18} />
                <span className="font-medium">{t('detection.entry_camera')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-800 animate-pulse"></span>
                <span className="text-xs text-white/80">{t('detection.live_badge')}</span>
              </div>
            </div>
            <div className="aspect-video bg-slate-900 relative">
              <img
                src={`${API_URL}/stream/entry`}
                alt="Entry Camera"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera size={32} className="text-slate-600 dark:text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('detection.waiting')}</p>
                </div>
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('detection.entry_desc_bottom')}</p>
            </div>
          </div>
        )}

        {showExit && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500 to-violet-600">
              <div className="flex items-center gap-2 text-white">
                <Car size={18} />
                <span className="font-medium">{t('detection.exit_camera')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-800 animate-pulse"></span>
                <span className="text-xs text-white/80">{t('detection.live_badge')}</span>
              </div>
            </div>
            <div className="aspect-video bg-slate-900 relative">
              <img
                src={`${API_URL}/stream/exit`}
                alt="Exit Camera"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera size={32} className="text-slate-600 dark:text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{t('detection.waiting')}</p>
                </div>
              </div>
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('detection.exit_desc_bottom')}</p>
            </div>
          </div>
        )}
      </div>

      {!showEntry && !showExit && (
        <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-8 text-center">
          <VideoOff size={40} className="text-slate-400 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('detection.hide_all')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('detection.toggle_hint')}</p>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-600 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#0b1120] dark:text-white">{t('detection.history')}</h2>
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
                <option value="ENTRY">{t('detection.entry')}</option>
                <option value="EXIT">{t('detection.exit')}</option>
              </select>
            </div>
            {user?.role === 'admin' && (
              <button
                onClick={handleDelete}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 dark:bg-slate-700/25">
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
                      <tr key={idx} className={`border-l-4 ${getStatusColor(msg.face_valid, msg.plate_valid)} hover:bg-slate-50/50 dark:hover:bg-slate-700/25 transition-colors`}>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatTime(entry.ts)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{msg.person || msg.muka || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{msg.plat || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            msg.mode === 'ENTRY' 
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' 
                              : 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
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
    </div>
  );
}
