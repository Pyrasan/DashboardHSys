import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Registration } from '../types';
import { UserPlus, Check, X, RefreshCw, User, Home, Clock, CheckCircle } from 'lucide-react';

export default function HeadApprovals() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pending, setPending] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    const res = await api.getHeadPendingRegistrations(user?.sessionId);
    if (res.ok) {
      setPending(res.data);
    }
    setLoading(false);
  };

  const handleApprove = async (id: number) => {
    if (confirm(t('head_approvals.approve_confirm'))) {
      const res = await api.headApproveRegistration(id, user?.sessionId);
      if (res.ok) {
        setPending(pending.filter(r => r.id !== id));
      } else {
        alert(res.error || t('head_approvals.failed_approve'));
      }
    }
  };

  const handleReject = async (id: number) => {
    if (confirm(t('head_approvals.reject_confirm'))) {
      const res = await api.rejectRegistration(id, user?.sessionId);
      if (res.ok) {
        setPending(pending.filter(r => r.id !== id));
        alert(t('head_approvals.reject_success'));
      } else {
        alert(res.error || t('head_approvals.failed_reject'));
      }
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
            <UserPlus size={24} />
            {t('head_approvals.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('head_approvals.desc')}</p>
        </div>
        <button
          onClick={loadPending}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <RefreshCw size={16} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {pending.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-emerald-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('head_approvals.no_pending')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('head_approvals.no_pending_desc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pending.map((reg) => (
              <div key={reg.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                        <User size={20} className="text-blue-600 dark:text-blue-200" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#0b1120] dark:text-white">{reg.username}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('head_approvals.id_label')} #{reg.id} | {t('head_approvals.submitted')} {formatDate(reg.created_at)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {reg.name && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <User size={14} className="text-slate-400" />
                          <span>{reg.name}</span>
                        </div>
                      )}
                      {reg.house_address && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Home size={14} className="text-slate-400" />
                          <span>{reg.house_address}</span>
                        </div>
                      )}
                      {reg.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Clock size={14} className="text-slate-400" />
                          <span>{reg.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(reg.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Check size={16} />
                      {t('head_approvals.approve')}
                    </button>
                    <button
                      onClick={() => handleReject(reg.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <X size={16} />
                      {t('head_approvals.reject')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
