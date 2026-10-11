import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { VehiclePassUser } from '../types';
import { Car, RefreshCw, ChevronRight, AlertTriangle, Check, X } from 'lucide-react';
import { HeadOnly } from './RoleGate';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function VehiclePassCreditWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [vps, setVps] = useState<VehiclePassUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVPs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await api.getVP(user.sessionId, false);
    if (res.ok) {
      setVps(res.users || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadVPs();
    const interval = setInterval(loadVPs, 30000);
    return () => clearInterval(interval);
  }, [loadVPs]);

  const totalVps = vps.length;
  const activeVPs = vps.filter(v => v.active).length;
  const zeroCredits = vps.filter(v => v.credits <= 0).length;
  const lowCredits = vps.filter(v => v.credits > 0 && v.credits <= 3).length;

  const hasAlerts = zeroCredits > 0 || lowCredits > 0;

  const getCreditColor = (credits: number): { bg: string; text: string; dot: string } => {
    if (credits <= 0) return { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' };
    if (credits <= 3) return { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
    return { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
  };

  const FaceAvatar = ({ faceImage, size = "w-8 h-8" }: { faceImage?: string; size?: string }) => {
    if (faceImage) {
      return (
        <img
          src={`${API_URL}${faceImage}`}
          alt={t('vp.table_face')}
          className={`${size} rounded-full object-cover border-2 border-amber-200`}
        />
      );
    }
    return (
      <div className={`${size} bg-amber-100 rounded-full flex items-center justify-center`}>
        <Car size={16} className="text-amber-600" />
      </div>
    );
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  return (
    <HeadOnly>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              hasAlerts ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-slate-100 dark:bg-slate-700'
            }`}>
              {hasAlerts ? (
                <AlertTriangle size={16} className="text-amber-500" />
              ) : (
                <Car size={16} className="text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('vp_credit_widget.title')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeVPs} {t('vp_credit_widget.active')} / {totalVps} {t('vp_credit_widget.total')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {zeroCredits > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                {zeroCredits} {t('vp_credit_widget.expired')}
              </span>
            )}
            {lowCredits > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                {lowCredits} {t('vp_credit_widget.low')}
              </span>
            )}
            <button
              onClick={loadVPs}
              disabled={loading}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-300 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">{t('common.loading')}</span>
              </div>
            </div>
          ) : vps.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <Car size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{t('vp_credit_widget.no_users')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('vp_credit_widget.no_users_desc')}</p>
            </div>
          ) : (
            vps.slice(0, 5).map((vp) => {
              const creditColors = getCreditColor(vp.credits);
              return (
                <div
                  key={vp.id}
                  className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                    vp.credits <= 0 ? 'bg-red-50/50 dark:bg-red-900/20' : vp.credits <= 3 ? 'bg-amber-50/50 dark:bg-amber-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FaceAvatar faceImage={vp.face_image} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">{vp.name}</span>
                          {vp.active ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                              <Check size={10} />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                              <X size={10} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Car size={12} className="text-slate-400" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{vp.plate_original || vp.plate || '-'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-lg font-bold ${creditColors.text}`}>
                        {vp.credits}
                      </div>
                      <p className="text-xs text-slate-400">{t('vp_credit_widget.credits_label')}</p>
                    </div>
                  </div>
                  {user?.role === 'admin' && vp.house_address && (
                    <p className="text-xs text-slate-400 mt-1 pl-11">
                      {vp.house_address}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {vps.length > 0 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => navigate('/app/vp-management')}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              {t('vp_credit_widget.manage')}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </HeadOnly>
  );
}
