import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { 
  Household, 
  HouseholdVehicle
} from '../types';
import { 
  Car, 
  RefreshCw, 
  Clock, 
  Home, 
  Users, 
  User,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Minus,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function HouseholdVehicles() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [vpUsers, setVpUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHouseholds, setExpandedHouseholds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadData = useCallback(async () => {
    const res = await api.getActiveSessions(user?.sessionId);
    if (res.ok) {
      setHouseholds(res.households || []);
      setVpUsers(res.vp_users || []);
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

  const toggleHousehold = (address: string) => {
    setExpandedHouseholds(prev => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  };

  const filterVehicles = (vehicles: HouseholdVehicle[]) => {
    if (filterStatus === 'all') return vehicles;
    return vehicles.filter(v => v.status === filterStatus);
  };

  const countByStatus = (vehicles: HouseholdVehicle[], status: string) => {
    return vehicles.filter(v => v.status === status).length;
  };

  const totalInside = households.reduce((acc, hh) => acc + countByStatus(hh.vehicles, 'inside'), 0) +
    vpUsers.reduce((acc, v) => acc + countByStatus(v.vehicles, 'inside'), 0);

  const totalOutside = households.reduce((acc, hh) => acc + countByStatus(hh.vehicles, 'outside'), 0) +
    vpUsers.reduce((acc, v) => acc + countByStatus(v.vehicles, 'outside'), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('household_vehicles.loading')}</span>
        </div>
      </div>
    );
  }

   return (
     <div className="space-y-6">
       <div className="flex items-center gap-4">
         <button
           onClick={() => navigate('/app/active-vehicles')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
            title={t('household_vehicles.back_title')}
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
                <Home size={24} />
                {t('household_vehicles.title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('household_vehicles.desc')}</p>
           </div>
           <div className="flex items-center gap-2">
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
        <StatMini label={t('active_vehicles.inside')} value={totalInside} color="emerald" />
        <StatMini label={t('active_vehicles.outside')} value={totalOutside} color="red" />
        <StatMini label={t('active_vehicles.households')} value={households.length} color="blue" />
        <StatMini label={t('active_vehicles.vp_users')} value={vpUsers.length} color="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterButton active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label={t('common.all')} />
        <FilterButton active={filterStatus === 'inside'} onClick={() => setFilterStatus('inside')} label={t('active_vehicles.inside')} variant="success" />
        <FilterButton active={filterStatus === 'outside'} onClick={() => setFilterStatus('outside')} label={t('active_vehicles.outside')} variant="danger" />
      </div>

      {households.length > 0 && (
        <div className="space-y-4">
          {households.map(hh => {
            const filtered = filterVehicles(hh.vehicles);
            const isExpanded = expandedHouseholds.has(hh.house_address);
            const insideCount = countByStatus(hh.vehicles, 'inside');
            const outsideCount = countByStatus(hh.vehicles, 'outside');
            
            return (
              <div key={hh.house_address} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  onClick={() => toggleHousehold(hh.house_address)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {hh.house_address}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{hh.head_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{insideCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span className="text-sm text-red-700 dark:text-red-300 font-medium">{outsideCount}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700">
                    {filtered.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        {t('household_vehicles.no_vehicles_filter')}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filtered.map((vehicle, idx) => (
                        <VehicleCard key={idx} vehicle={vehicle} now={Date.now()} t={t} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {vpUsers.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users size={20} className="text-amber-500" />
            {t('active_vehicles.vp_users')}
          </h2>
          
          <div className="grid gap-4">
            {vpUsers.map(vp => {
              const filtered = filterVehicles(vp.vehicles);
              return (
                <div key={vp.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-amber-100 dark:border-amber-900/50 overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-amber-50/50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center">
                        <User size={20} className="text-amber-600 dark:text-amber-300" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{vp.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{vp.house_address || t('household_vehicles.no_address')}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${getVPStatusColor(vp.credits)}`}>
                      {vp.credits} {t('common.credits')}
                    </div>
                  </div>
                  
                  {filtered.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                      {t('household_vehicles.no_vehicles_filter')}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filtered.map((vehicle, idx) => (
                        <VehicleCard key={idx} vehicle={vehicle} now={Date.now()} t={t} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {households.length === 0 && vpUsers.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home size={24} className="text-slate-300" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('household_vehicles.no_households')}</p>
          <p className="text-sm text-slate-400 mt-1">{t('household_vehicles.no_households_desc')}</p>
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
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function VehicleCard({ vehicle, now, t: tFunc }: { vehicle: HouseholdVehicle; now: number; t: (key: string) => string }) {
  const config = getStatusConfig(vehicle.status, tFunc);
  const StatusIcon = config.icon;
  
  const timeSinceLast = vehicle.last_ts ? now - vehicle.last_ts : null;
  
  return (
    <div className={`p-4 flex items-center gap-4 ${config.bg} border-l-4 ${config.border}`}>
      <div className="flex-shrink-0">
        {(vehicle as any).avatar_url || vehicle.face_image ? (
          <img 
            src={`${API_URL}${(vehicle as any).avatar_url || vehicle.face_image}`} 
            alt={vehicle.driver} 
            className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600">
            <User size={20} className="text-slate-400" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{vehicle.driver}</span>
          {vehicle.driver_username && vehicle.driver_username !== vehicle.driver && (
            <span className="text-xs text-slate-400">({vehicle.driver_username})</span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <Car size={13} className="text-slate-400" />
            <span className="font-mono font-medium">{vehicle.plate}</span>
          </span>
          {timeSinceLast && (
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-400" />
              {vehicle.last_mode === 'ENTRY' ? tFunc('household_vehicles.entered') : tFunc('household_vehicles.exited')} {formatDuration(timeSinceLast)} {tFunc('active_vehicles.ago')}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${config.bg} ${config.text}`}>
          <StatusIcon size={14} />
          <span className="text-xs font-semibold">{config.label}</span>
        </div>
        {vehicle.last_mode && (
          <span className="text-xs text-slate-400">
            {formatTime(vehicle.last_ts)}
          </span>
        )}
      </div>
    </div>
  );
}

function getStatusConfig(status: string, tFunc: (key: string) => string = (k) => k) {
  switch (status) {
    case 'inside':
      return { 
        bg: 'bg-emerald-50 dark:bg-emerald-900/30', 
        border: 'border-l-emerald-500 dark:border-l-emerald-600', 
        text: 'text-emerald-700 dark:text-emerald-300', 
        label: tFunc('active_vehicles.inside'),
        icon: ArrowRight
      };
    case 'outside':
      return { 
        bg: 'bg-red-50 dark:bg-red-900/30', 
        border: 'border-l-red-500 dark:border-l-red-600', 
        text: 'text-red-700 dark:text-red-300', 
        label: tFunc('active_vehicles.outside'),
        icon: ArrowLeft
      };
    default:
      return { 
        bg: 'bg-slate-50 dark:bg-slate-700/50', 
        border: 'border-l-slate-300', 
        text: 'text-slate-500 dark:text-slate-400', 
        label: tFunc('active_vehicles.no_data_status'),
        icon: Minus
      };
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) return '0m';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTime(ts: number | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getVPStatusColor(credits: number) {
  if (credits < 2) return 'text-red-600 dark:text-red-400';
  if (credits < 5) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function FilterButton({ active, onClick, label, variant = 'default' }: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  variant?: 'default' | 'success' | 'danger';
}) {
  let activeClasses = 'bg-blue-600 text-white';
  if (variant === 'success') activeClasses = 'bg-emerald-600 text-white';
  if (variant === 'danger') activeClasses = 'bg-red-600 text-white';
  
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

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
    red: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  };
  const c = colors[color] || colors.blue;
  
  return (
    <div className={`${c.bg} rounded-lg p-3 text-center`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className={`text-xs ${c.text} mt-0.5`}>{label}</p>
    </div>
  );
}
