import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { GuestWithStatus } from '../types';
import { 
  Car, 
  RefreshCw, 
  Clock, 
  Users, 
  AlertTriangle,
  User,
  ArrowLeft
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function GuestVehicles() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [guests, setGuests] = useState<GuestWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [filterDuration, setFilterDuration] = useState<string>('all');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    const res = await api.getActiveSessions(user?.sessionId);
    if (res.ok) {
      setGuests(res.guests || []);
    }
    setLoading(false);
  }, [user?.sessionId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (messages.length > 0) {
      const hasNewDetection = messages.some(m => m.topic === 'gate/detection');
      if (hasNewDetection) {
        loadData();
      }
    }
  }, [messages, loadData]);

  const formatDuration = (ms: number): string => {
    if (ms < 0) return '0m';
    const hours = Math.floor(ms / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (ts: number | null): string => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGuestDurationConfig = (status: string) => {
    switch (status) {
      case 'green':
        return { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-600', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: '< 12h', min: 0, max: 12 };
      case 'orange':
        return { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-600', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: '12-24h', min: 12, max: 24 };
      case 'red':
        return { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-600', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: '> 24h', min: 24, max: 9999 };
      default:
        return { bg: 'bg-slate-50 dark:bg-slate-700/50', border: 'border-slate-300', dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', label: '', min: 0, max: 0 };
    }
  };

  const filteredGuests = guests.filter(g => {
    if (filterDuration === 'all') return true;
    return g.duration_status === filterDuration;
  });

  const countGreen = guests.filter(g => g.duration_status === 'green').length;
  const countOrange = guests.filter(g => g.duration_status === 'orange').length;
  const countRed = guests.filter(g => g.duration_status === 'red').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('guest_vehicles.loading')}</span>
        </div>
      </div>
    );
  }

   return (
     <div className="space-y-6">
       <div className="flex items-center gap-4">
         <button
           onClick={() => navigate('/app/active-vehicles')}
           className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700"
            title={t('guest_vehicles.back_title')}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
                <Users size={24} />
                {t('guest_vehicles.title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('guest_vehicles.desc')}</p>
           </div>
           <div className="flex items-center gap-2">
             {countRed > 0 && (
                <div className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500 dark:text-red-400 animate-pulse" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">{countRed} {t('guest_vehicles.over_24h')}</span>
               </div>
             )}
             <button
               onClick={loadData}
               className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
             >
               <RefreshCw size={18} />
             </button>
           </div>
         </div>
       </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-600">
        <TabButton 
          active={location.pathname.includes('/household')} 
          onClick={() => navigate('/app/active-vehicles/household')} 
          label={t('household_vehicles.title')}
        />
        <TabButton 
          active={location.pathname.includes('/guests')} 
          onClick={() => navigate('/app/active-vehicles/guests')} 
          label={t('guest_vehicles.title')}
        />
        <TabButton 
          active={location.pathname === '/app/active-vehicles'} 
          onClick={() => navigate('/app/active-vehicles')} 
          label={t('active_vehicles_summary.title')}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatMini label={t('active_vehicles.guests_inside')} value={guests.length} color="amber" />
        <StatMini label="< 12h" value={countGreen} color="emerald" />
        <StatMini label="12-24h" value={countOrange} color="amber" />
        <StatMini label="> 24h" value={countRed} color="red" alert={countRed > 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <DurationFilter active={filterDuration === 'all'} onClick={() => setFilterDuration('all')} label={t('common.all')} />
        <DurationFilter active={filterDuration === 'green'} onClick={() => setFilterDuration('green')} label="< 12h" color="emerald" />
        <DurationFilter active={filterDuration === 'orange'} onClick={() => setFilterDuration('orange')} label="12-24h" color="amber" />
        <DurationFilter active={filterDuration === 'red'} onClick={() => setFilterDuration('red')} label="> 24h" color="red" />
      </div>

      {countRed > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-800 dark:text-red-200">{t('guest_vehicles.attention_title')}</h4>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
              {countRed} {t('guest_vehicles.attention_desc')}
            </p>
          </div>
        </div>
      )}

      {filteredGuests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-slate-300" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {filterDuration === 'all' ? t('guest_vehicles.no_guests') : t('guest_vehicles.no_guests_filter')}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filterDuration === 'all' ? t('guest_vehicles.empty_hint') : t('guest_vehicles.filter_hint')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredGuests.map(guest => {
            const config = getGuestDurationConfig(guest.duration_status);
            const isAlert = guest.duration_status === 'red';
            return (
              <div 
                key={guest.id} 
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden ${isAlert ? 'border-red-300 dark:border-red-700' : 'border-slate-100 dark:border-slate-700'}`}
              >
                <div className={`flex items-center gap-3 p-4 border-l-4 ${config.border}`}>
                  <div className="flex-shrink-0">
                    {guest.face_image ? (
                      <img 
                        src={`${API_URL}${guest.face_image}`} 
                        alt="Guest" 
                        className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                        <User size={24} className="text-slate-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{guest.person}</span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${isAlert ? 'animate-pulse' : ''}`}>
                        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                        {config.label}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Car size={13} className="text-slate-400" />
                        <span className="font-mono font-medium">{guest.plate}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        <span className="font-semibold">{formatDuration(guest.duration_ms)}</span>
                        <span className="text-slate-400">{t('common.since')} {formatTime(guest.entry_ts)}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 hidden sm:flex flex-col items-end gap-1">
                    <div className={`text-2xl font-bold ${config.text}`}>
                      {guest.duration_hours.toFixed(1)}h
                    </div>
                    <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          guest.duration_status === 'red' ? 'bg-red-500' : 
                          guest.duration_status === 'orange' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ 
                          width: `${Math.min((guest.duration_hours / 30) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active 
          ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400' 
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function DurationFilter({ active, onClick, label, color = 'default' }: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  color?: 'default' | 'emerald' | 'amber' | 'red';
}) {
  let activeClasses = 'bg-blue-600 text-white';
  if (color === 'emerald') activeClasses = 'bg-emerald-600 text-white';
  if (color === 'amber') activeClasses = 'bg-amber-600 text-white';
  if (color === 'red') activeClasses = 'bg-red-600 text-white';
  
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? activeClasses : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30'
      }`}
    >
      {label}
    </button>
  );
}

function StatMini({ label, value, color, alert = false }: { 
  label: string; 
  value: number; 
  color: string; 
  alert?: boolean;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
    red: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  };
  const c = colors[color] || colors.blue;
  
  return (
    <div className={`${c.bg} rounded-lg p-3 text-center relative`}>
      {alert && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
      <p className="text-2xl font-bold">{value}</p>
      <p className={`text-xs ${c.text} mt-0.5`}>{label}</p>
    </div>
  );
}
