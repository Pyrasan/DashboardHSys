import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Notification } from '../types';
import { Bell, Check, RefreshCw, CheckCheck, X, UserPlus, Car, ShieldAlert, Mail } from 'lucide-react';

const NOTIF_ICONS: Record<string, any> = {
  'registration': UserPlus,
  'vp': Car,
  'security': ShieldAlert,
  'message': Mail,
  'general': Bell
};

export default function Notifications() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const res = await api.getNotifications(user?.sessionId);
    if (res.ok) {
      setNotifications(res.data);
    }
    setLoading(false);
  };

  const handleMarkRead = async (notifId: number) => {
    await api.markNotificationRead(notifId, user?.sessionId);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead(user?.sessionId);
    loadNotifications();
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Bell size={24} />
            {t('notifications.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('notifications.desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300"
          >
            <option value="all">{t('common.all')}</option>
            <option value="registration">{t('notifications.filter_registrations')}</option>
            <option value="vp">{t('notifications.filter_vp')}</option>
            <option value="security">{t('notifications.filter_security')}</option>
            <option value="message">{t('notifications.filter_messages')}</option>
            <option value="general">{t('notifications.filter_general')}</option>
          </select>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
            >
              <CheckCheck size={16} />
              {t('notifications.mark_all_read')}
            </button>
          )}
          <button
            onClick={loadNotifications}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <RefreshCw size={16} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={24} className="text-slate-300" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('notifications.no_notifications')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('notifications.all_caught_up')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredNotifications.map((notif) => {
              const IconComponent = NOTIF_ICONS[notif.type] || Bell;
              return (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                    !notif.is_read ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {!notif.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                        <IconComponent size={16} className="text-slate-400 dark:text-slate-500" />
                        <h3 className={`font-medium ${!notif.is_read ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {notif.title}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full text-xs capitalize">
                          {notif.type || 'general'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{notif.message}</p>
                      <p className="text-xs text-slate-400 mt-2">{formatDate(notif.created_at)}</p>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600"
                        title={t('notifications.mark_read_title')}
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
