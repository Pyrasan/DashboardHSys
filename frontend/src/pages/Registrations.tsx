import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Registration } from '../types';
import { UserPlus, Check, X, Clock, Home, Mail, Phone, User, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const FaceAvatar = ({ faceImage, avatarUrl, size = "w-10 h-10" }: { faceImage?: string; avatarUrl?: string; size?: string }) => {
  const imgSrc = avatarUrl || faceImage;
  if (imgSrc) {
    return (
      <img
        src={`${API_URL}${imgSrc}`}
        alt="Face"
        className={`${size} rounded-full object-cover border-2 border-blue-200`}
      />
    );
  }
  return (
    <div className={`${size} bg-blue-100 rounded-full flex items-center justify-center`}>
      <User size={20} className="text-blue-600" />
    </div>
  );
};

export default function Registrations() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pending, setPending] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    const res = await api.getPendingRegistrations(user?.sessionId);
    if (res.ok) {
      setPending(res.data);
    }
    setLoading(false);
  };

  const handleApprove = async (id: number) => {
    if (confirm(t('registrations.approve_confirm'))) {
      const res = await api.approveRegistration(id, user?.sessionId);
      if (res.ok) {
        setPending(pending.filter(r => r.id !== id));
      } else {
        alert(res.error || t('registrations.approve_failed'));
      }
    }
  };

  const handleReject = async (id: number) => {
    if (confirm(t('registrations.reject_confirm'))) {
      const res = await api.rejectRegistration(id, user?.sessionId);
      if (res.ok) {
        setPending(pending.filter(r => r.id !== id));
      } else {
        alert(res.error || t('registrations.reject_failed'));
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

  const getRoleLabel = (role: string, tFunc: (key: string) => string): { label: string; color: string } => {
    if (role === 'head_of_household') return { label: tFunc('registrations.head_of_household'), color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' };
    if (role === 'household_member') return { label: tFunc('registrations.household_member'), color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' };
    return { label: role, color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300' };
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
            {t('registrations.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('registrations.desc')}</p>
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
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-emerald-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('registrations.no_pending')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('registrations.no_pending_desc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pending.map((reg) => {
              const roleInfo = getRoleLabel(reg.role, t);
              return (
                <div key={reg.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <FaceAvatar faceImage={reg.face_image} avatarUrl={(reg as any).avatar_url} size="w-10 h-10" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[#0b1120] dark:text-white">{reg.username}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                              {roleInfo.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">ID: #{reg.id} | Submitted: {formatDate(reg.created_at)}</p>
                        </div>
                      </div>
                      
                      {reg.role === 'household_member' && reg.parent_username && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                          <User size={14} className="inline mr-1" />
                          {t('registrations.member_of')} <span className="font-medium">{reg.parent_username}</span>
                        </p>
                      )}
                      
                      {reg.role === 'household_member' && (
                        <div className="mb-2">
                          {!reg.approved_by_head_at ? (
                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                              <Clock size={14} />
                              <span>{t('registrations.waiting_head_approval')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                              <Check size={14} />
                              <span>{t('registrations.head_approved')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {reg.role === 'head_of_household' && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-2">
                          <Clock size={14} />
                          <span>{t('registrations.waiting_admin')}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                        {reg.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Mail size={14} className="text-slate-400" />
                            <span>{reg.email}</span>
                          </div>
                        )}
                        {reg.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Phone size={14} className="text-slate-400" />
                            <span>{reg.phone}</span>
                          </div>
                        )}
                      </div>

                      {(!reg.name && !reg.house_address && !reg.email && !reg.phone) && (
                        <p className="text-sm text-slate-400 italic">{t('registrations.no_info')}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(reg.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Check size={16} />
                        {t('registrations.approve')}
                      </button>
                      <button
                        onClick={() => handleReject(reg.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <X size={16} />
                        {t('registrations.reject')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">{t('registrations.how_it_works')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
