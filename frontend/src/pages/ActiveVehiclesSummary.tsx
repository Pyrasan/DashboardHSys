import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Household, HouseholdVehicle, VehiclePassUserWithStatus, GuestWithStatus } from '../types';
import { 
  Car, 
  RefreshCw, 
  Users, 
  AlertTriangle,
  Home,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ActiveVehiclesSummary() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [guests, setGuests] = useState<GuestWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = useCallback(async () => {
    const res = await api.getActiveSessions(user?.sessionId);
    if (res.ok) {
      setHouseholds(res.households || []);
      setGuests(res.guests || []);
      setIsAdmin(res.is_admin || false);
    }
    setLoading(false);
  }, [user?.sessionId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const countByStatus = (vehicles: HouseholdVehicle[], status: string) => {
    return vehicles.filter(v => v.status === status).length;
  };

  const totalVehicles = households.reduce((acc, hh) => acc + hh.vehicles.length, 0);
  const totalInside = households.reduce((acc, hh) => acc + countByStatus(hh.vehicles, 'inside'), 0);
  const totalOutside = households.reduce((acc, hh) => acc + countByStatus(hh.vehicles, 'outside'), 0);

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
      <div>
        <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
          <Car size={24} />
          {t('active_vehicles_summary.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('active_vehicles_summary.desc')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title={t('active_vehicles_summary.total_registered')}
          value={totalVehicles}
          color="blue"
          icon={Car}
        />
        <SummaryCard
          title={t('active_vehicles_summary.inside')}
          value={totalInside}
          color="emerald"
          icon={ArrowRight}
        />
        <SummaryCard
          title={t('active_vehicles_summary.outside')}
          value={totalOutside}
          color="red"
          icon={Car}
        />
        <SummaryCard
          title={t('active_vehicles_summary.guests_inside')}
          value={guests.length}
          color={guests.some(g => g.duration_status === 'red') ? 'red' : 'amber'}
          icon={Users}
          alert={guests.some(g => g.duration_status === 'red')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div 
          onClick={() => navigate('/app/active-vehicles/household')}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Home size={20} className="text-blue-600" />
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{t('active_vehicles_summary.household_vehicles')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {households.length} {t('active_vehicles_summary.households_registered')}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{totalInside}</p>
                  <p className="text-xs text-slate-400">{t('active_vehicles_summary.inside_label')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{totalOutside}</p>
                  <p className="text-xs text-slate-400">{t('active_vehicles_summary.outside_label')}</p>
                </div>
              </div>
            </div>
          </div>
          
          {households.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex flex-wrap gap-2">
                {households.slice(0, 3).map(hh => (
                  <span key={hh.house_address} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs text-slate-600 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {hh.house_address}
                  </span>
                ))}
                {households.length > 3 && (
                  <span className="text-xs text-slate-400">+{households.length - 3} {t('common.more')}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div 
          onClick={() => navigate('/app/active-vehicles/guests')}
          className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border p-6 cursor-pointer hover:shadow-md transition-all group ${
            guests.some(g => g.duration_status === 'red') 
              ? 'border-red-200 hover:border-red-400' 
              : 'border-slate-100 dark:border-slate-700 hover:border-amber-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  guests.some(g => g.duration_status === 'red') ? 'bg-red-100' : 'bg-amber-100'
                }`}>
                  <Users size={20} className={guests.some(g => g.duration_status === 'red') ? 'text-red-600' : 'text-amber-600'} />
                </div>
                <ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{t('active_vehicles_summary.guests_card_title')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('active_vehicles_summary.guests_card_desc')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">{guests.length}</p>
              <p className="text-xs text-slate-400">{t('active_vehicles_summary.total_guests')}</p>
            </div>
          </div>
          
          {guests.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                   <span className="text-xs text-slate-600 dark:text-slate-300">
                      {guests.filter(g => g.duration_status === 'green').length} &lt; 12h
                   </span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                   <span className="text-xs text-slate-600 dark:text-slate-300">
                     {guests.filter(g => g.duration_status === 'orange').length} 12-24h
                   </span>
                 </div>
                 {guests.filter(g => g.duration_status === 'red').length > 0 && (
                   <div className="flex items-center gap-1.5">
                     <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                     <span className="text-xs text-red-600 font-medium">
                        {guests.filter(g => g.duration_status === 'red').length} &gt; 24h
                     </span>
                   </div>
                 )}
              </div>
            </div>
          )}
        </div>
      </div>

      {guests.some(g => g.duration_status === 'red') && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-800">{t('active_vehicles_summary.alert_over_24h')}</h4>
            <p className="text-sm text-red-600 mt-1">
              {guests.filter(g => g.duration_status === 'red').length} {t('active_vehicles_summary.guests_over_24h')}
              <button 
                onClick={() => navigate('/app/active-vehicles/guests')}
                className="ml-2 underline font-medium hover:text-red-800"
              >
                {t('active_vehicles_summary.view_details')} →
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  color, 
  icon: Icon,
  alert = false
}: { 
  title: string; 
  value: number; 
  color: string; 
  icon: any;
  alert?: boolean;
}) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
          <Icon size={20} className={c.text} />
        </div>
        {alert && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
      </div>
      <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-3">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
    </div>
  );
}
