import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { DetectionEntry } from '../types';
import { Camera, Car, Video, VideoOff, LogIn } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function Landing() {
  const { t } = useLanguage();
  const { messages } = useSocket();
  const [showEntry, setShowEntry] = useState(true);
  const [showExit, setShowExit] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const detection = messages.filter(m => m.topic === 'gate/detection');
      setHistory(prev => {
        const merged = [...detection, ...prev].slice(0, 20);
        return merged;
      });
    }
  }, [messages]);

  const loadHistory = async () => {
    const res = await api.getHistory('detection', null, 20);
    if (Array.isArray(res)) {
      setHistory(res);
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
    if (faceValid && plateValid) return 'border-l-[#10b981]';
    if (!faceValid && !plateValid) return 'border-l-[#ef4444]';
    return 'border-l-[#f97316]';
  };

  const filteredHistory = history.filter(entry => {
    if (filter === 'all') return true;
    const msg = parseMessage(entry.message);
    return msg.mode === filter;
  }).slice(0, 10);

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-slate-900">
      <div className="bg-[#0b1120] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car size={20} />
          <span className="font-bold">SecurePass</span>
        </div>
        <a href="/login" className="flex items-center gap-2 px-3 py-1.5 bg-[#3b82f6] rounded-lg text-sm hover:bg-[#2563eb] transition">
          <LogIn size={16} />
          {t('auth.login')}
        </a>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEntry(!showEntry)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
              showEntry 
                ? 'bg-emerald-600 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {showEntry ? <Video size={14} /> : <VideoOff size={14} />}
            {t('detection.entry')}
          </button>
          <button
            onClick={() => setShowExit(!showExit)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
              showExit 
                ? 'bg-violet-600 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {showExit ? <Video size={14} /> : <VideoOff size={14} />}
            {t('detection.exit')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {showEntry && (
            <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-emerald-600 px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white">{t('detection.entry')}</span>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              </div>
              <div className="aspect-video bg-slate-900">
                <img src={`${API_URL}/stream/entry`} alt="Entry" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          {showExit && (
            <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-violet-600 px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-white">{t('detection.exit')}</span>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              </div>
              <div className="aspect-video bg-slate-900">
                <img src={`${API_URL}/stream/exit`} alt="Exit" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {!showEntry && !showExit && (
          <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-8 text-center text-slate-500 dark:text-slate-400">
            {t('detection.hide_all')}
          </div>
        )}
      </div>

      <div className="px-4 pb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('detection.history')}</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">{t('common.all')}</option>
              <option value="ENTRY">{t('detection.entry')}</option>
              <option value="EXIT">{t('detection.exit')}</option>
            </select>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-64 overflow-y-auto">
            {filteredHistory.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">{t('detection.no_detections')}</div>
            ) : (
              filteredHistory.map((entry, idx) => {
                const msg = parseMessage(entry.message);
                return (
                  <div key={idx} className={`px-4 py-2 border-l-4 ${getStatusColor(msg.face_valid, msg.plate_valid)}`}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{msg.person || '-'}</span>
                      <span className="text-slate-500 dark:text-slate-400">{msg.plat || '-'}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{msg.mode}</span>
                      <span>{formatTime(entry.ts)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
