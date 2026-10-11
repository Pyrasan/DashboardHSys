import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Stats as StatsType } from '../types';
import { Car, Users, Clock, TrendingUp, RefreshCw, Calendar } from 'lucide-react';

const STORAGE_KEY = 'securepass_stats_history';

interface DailySnapshot {
  date: string;
  total_entry: number;
  total_exit: number;
  detection_valid: number;
  detection_invalid: number;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadHistory(): DailySnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveHistory(snapshots: DailySnapshot[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
}

function sanitizeStats(stats: any): StatsType {
  return {
    total_entry: stats.total_entry ?? 0,
    total_exit: stats.total_exit ?? 0,
    detection_valid: stats.detection_valid ?? 0,
    detection_invalid: stats.detection_invalid ?? 0,
    resident: stats.resident || { total_entry: 0, total_exit: 0 },
    guest: stats.guest || { total_entry: 0, total_exit: 0, still_inside: 0 },
    vp: stats.vp || { total_entry: 0, total_exit: 0 },
    button: stats.button || { open_entry: 0, open_exit: 0 },
    hot_hours: stats.hot_hours || {},
  };
}

export default function Stats() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<StatsType | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const res = await api.getStats(user?.sessionId);
    if (res.ok && res.stats) {
      setStats(sanitizeStats(res.stats));

      const today = getTodayKey();
      const history = loadHistory();
      const lastEntry = history[history.length - 1];

      if (!lastEntry || lastEntry.date !== today) {
        if (lastEntry) {
          const snapshot: DailySnapshot = {
            date: lastEntry.date,
            total_entry: lastEntry.total_entry,
            total_exit: lastEntry.total_exit,
            detection_valid: lastEntry.detection_valid,
            detection_invalid: lastEntry.detection_invalid,
          };
          const updated = [...history.filter(h => h.date !== lastEntry.date), snapshot];
          saveHistory(updated);
        }
      }
      setDailyHistory(loadHistory());
    }
    setLoading(false);
  }, [user?.sessionId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('stats.loading')}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-red-400" />
          </div>
              <p className="text-red-500 dark:text-red-400 font-medium">{t('stats.failed')}</p>
              <button onClick={loadStats} className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">
            {t('stats.try_again')}
          </button>
        </div>
      </div>
    );
  }

  const hotHours: [string, number][] = Object.entries(stats.hot_hours || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalAllTime = dailyHistory.reduce(
    (acc, d) => ({
      entry: acc.entry + d.total_entry,
      exit: acc.exit + d.total_exit,
    }),
    { entry: 0, exit: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white">{t('stats.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('stats.desc')}</p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <RefreshCw size={16} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <Car className="text-emerald-600" size={20} />
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('stats.entry_label')}</span>
          </div>
          <p className="text-2xl font-bold text-[#0b1120] dark:text-white mt-3">{stats.total_entry}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('stats.today_entries')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-violet-50 rounded-lg">
              <Car className="text-violet-600" size={20} />
            </div>
            <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">{t('stats.exit_label')}</span>
          </div>
          <p className="text-2xl font-bold text-[#0b1120] dark:text-white mt-3">{stats.total_exit}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('stats.today_exits')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <Users className="text-blue-600" size={20} />
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('stats.valid_label')}</span>
          </div>
          <p className="text-2xl font-bold text-[#0b1120] dark:text-white mt-3">{stats.detection_valid}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('stats.today_valid')}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2.5 bg-orange-50 rounded-lg">
              <Clock className="text-orange-600" size={20} />
            </div>
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">{t('stats.invalid_label')}</span>
          </div>
          <p className="text-2xl font-bold text-[#0b1120] dark:text-white mt-3">{stats.detection_invalid}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('stats.today_invalid')}</p>
        </div>
      </div>

      {dailyHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-slate-500 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-[#0b1120] dark:text-white">{t('stats.daily_history')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left py-2 text-slate-500 dark:text-slate-400 font-medium">{t('stats.date')}</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">{t('stats.entry')}</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">{t('stats.exit')}</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">{t('stats.valid')}</th>
                  <th className="text-right py-2 text-slate-500 dark:text-slate-400 font-medium">{t('stats.invalid')}</th>
                </tr>
              </thead>
              <tbody>
                {dailyHistory.map(d => (
                  <tr key={d.date} className="border-b border-slate-50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-2 text-slate-700 dark:text-slate-200">{d.date}</td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-200">{d.total_entry}</td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-200">{d.total_exit}</td>
                    <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">{d.detection_valid}</td>
                    <td className="py-2 text-right text-red-600 dark:text-red-400">{d.detection_invalid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-[#0b1120] dark:text-white mb-5">{t('stats.by_user_type')}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.resident_entry')}</span>
              </div>
              <span className="text-xl font-bold text-[#0b1120] dark:text-white">{stats.resident?.total_entry || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.resident_exit')}</span>
              </div>
              <span className="text-xl font-bold text-[#0b1120] dark:text-white">{stats.resident?.total_exit || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.guest_entry')}</span>
              </div>
              <span className="text-xl font-bold text-[#0b1120] dark:text-white">{stats.guest?.total_entry || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.guest_exit')}</span>
              </div>
              <span className="text-xl font-bold text-[#0b1120] dark:text-white">{stats.guest?.total_exit || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-100 dark:border-orange-800">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="font-medium text-orange-800 dark:text-orange-300">{t('stats.guest_still_inside')}</span>
              </div>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.guest?.still_inside || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.vp_entry')}</span>
              </div>
              <span className="text-xl font-bold text-[#0b1120] dark:text-white">{stats.vp?.total_entry || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.vp_exit')}</span>
              </div>
              <span className="text-xl font-bold text-[#0b1120] dark:text-white">{stats.vp?.total_exit || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-[#0b1120] dark:text-white mb-5">{t('stats.button_presses')}</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.open_entry')}</span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.button?.open_entry || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <span className="font-medium text-slate-700 dark:text-slate-200">{t('stats.open_exit')}</span>
              <span className="text-xl font-bold text-violet-600 dark:text-violet-400">{stats.button?.open_exit || 0}</span>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-[#0b1120] dark:text-white mt-6 mb-5">{t('stats.hot_hours')}</h2>
          <div className="space-y-3">
            {hotHours.length === 0 ? (
              <p className="text-slate-400 text-sm">{t('stats.no_data')}</p>
            ) : (
              hotHours.map(([hour, count]) => (
                <div key={hour} className="flex items-center gap-3">
                  <span className="w-14 text-sm text-slate-600 dark:text-slate-300">{hour}:00</span>
                  <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg"
                      style={{ width: `${(count / hotHours[0][1]) * 100}%` }}
                    ></div>
                  </div>
                  <span className="w-10 text-right text-sm font-medium text-slate-700 dark:text-slate-200">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
