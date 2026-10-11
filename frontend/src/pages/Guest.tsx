import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { GuestRecord } from '../types';
import { Users, Trash2, Clock, RefreshCw, Car } from 'lucide-react';

export default function Guest() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuests();
  }, []);

  const loadGuests = async () => {
    setLoading(true);
    const res = await api.getTamu(user?.sessionId);
    if (res.ok) {
      setGuests(res.data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm(t('guest.delete_confirm'))) {
      await api.deleteTamu(id, user?.sessionId);
      loadGuests();
    }
  };

  const formatTime = (time: string): string => {
    if (!time) return '-';
    try {
      return new Date(time).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return time;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('guest.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Users size={24} />
            {t('guest.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('guest.desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-100 dark:border-orange-800 rounded-lg">
            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{guests.length} {t('guest.title').toLowerCase()}</span>
          </div>
          <button
            onClick={loadGuests}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {guests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-slate-300 dark:text-slate-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('guest.no_records')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('guest.empty_desc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('guest.id')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('guest.time')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('table.plate')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('guest.photo')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('guest.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {guests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">#{item.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Clock size={14} className="text-slate-400" />
                        {formatTime(item.waktu)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Car size={14} className="text-slate-400" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{item.plat_nomor || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.foto ? (
                        <img 
                          src={item.foto} 
                          alt="Guest" 
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                        />
                      ) : (
                        <span className="text-slate-400 text-sm">{t('guest.no_photo')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
