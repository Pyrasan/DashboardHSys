import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Notification } from '../types';
import { ShieldAlert, Bell, Check, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react';
import { HeadOnly } from './RoleGate';
import { useNavigate } from 'react-router-dom';

export default function ThiefAlertWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await api.getNotifications(user.sessionId);
    if (res.ok) {
      const securityAlerts = (res.data || []).filter((n: Notification) => n.type === 'security');
      setNotifications(securityAlerts);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkRead = async (notifId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    await api.markNotificationRead(notifId, user.sessionId);
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const recentAlerts = notifications.slice(0, 5);

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (title: string): { bg: string; border: string; icon: string } => {
    if (title.includes('THIEF') || title.includes('Theft') || title.includes('Mismatch')) {
      return { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-700', icon: 'text-red-500 dark:text-red-400' };
    }
    if (title.includes('No Credits') || title.includes('Denied')) {
      return { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700', icon: 'text-amber-500 dark:text-amber-400' };
    }
    return { bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-700', icon: 'text-orange-500 dark:text-orange-400' };
  };

  return (
    <HeadOnly>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              unreadCount > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-slate-100 dark:bg-slate-700'
            }`}>
              {unreadCount > 0 ? (
                <AlertTriangle size={16} className="text-red-500" />
              ) : (
                <ShieldAlert size={16} className="text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('thief_alert_widget.title')}</h3>
              {unreadCount > 0 && (
                <p className="text-xs text-red-500 font-medium">{unreadCount} {t(unreadCount !== 1 ? 'thief_alert_widget.unread_alerts' : 'thief_alert_widget.unread_alert')}</p>
              )}
            </div>
          </div>
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t('common.loading')}</span>
              </div>
            </div>
          ) : recentAlerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldAlert size={20} className="text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{t('thief_alert_widget.no_alerts')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('thief_alert_widget.all_secure')}</p>
            </div>
          ) : (
            recentAlerts.map((notif) => {
              const severity = getSeverityColor(notif.title);
              return (
                <div
                  key={notif.id}
                  className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer ${
                    !notif.is_read ? `${severity.bg}` : ''
                  }`}
                  onClick={() => navigate('/app/notifications?filter=security')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!notif.is_read && (
                          <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
                        )}
                        <h4 className={`text-sm font-medium truncate ${
                          !notif.is_read ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {notif.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(notif.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notif.is_read && (
                        <button
                          onClick={(e) => handleMarkRead(notif.id, e)}
                          className="p-1.5 hover:bg-white/60 rounded text-slate-400 hover:text-emerald-500"
                          title={t('thief_alert_widget.mark_read')}
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => navigate('/app/notifications?filter=security')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              {t('thief_alert_widget.view_all')}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </HeadOnly>
  );
}
