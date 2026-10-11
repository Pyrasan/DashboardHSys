import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Stats, DetectionEntry, LucideIcon } from '../types';
import { Car, User, CheckCircle, XCircle, ArrowRight, ArrowLeft, Cpu, MemoryStick, HardDrive, Timer, Thermometer, Wifi } from 'lucide-react';
import ThiefAlertWidget from '../components/ThiefAlertWidget';
import VehiclePassCreditWidget from '../components/VehiclePassCreditWidget';

interface SystemStatus {
  gate_controller: { status: string };
  entry_camera: { status: string };
  exit_camera: { status: string };
  mqtt: { status: string; port: number };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDetections, setRecentDetections] = useState<any[]>([]);
  const [residentInfo, setResidentInfo] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    gate_controller: { status: 'offline' },
    entry_camera: { status: 'offline' },
    exit_camera: { status: 'offline' },
    mqtt: { status: 'offline', port: 1883 }
  });
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const detection = messages.filter(m => m.topic === 'gate/detection').slice(0, 10);
      setRecentDetections(detection);
    }
  }, [messages]);

  const loadData = async () => {
    if (user?.sessionId) {
      const res: any = await api.getStats(user.sessionId);
      if (res.ok) {
        setStats(res.stats);
      }
      
      const camRes: any = await api.getCameraStatus();
      if (camRes.ok) {
        setSystemStatus(prev => ({
          ...prev,
          entry_camera: { status: camRes.cameras?.entry?.status || 'offline' },
          exit_camera: { status: camRes.cameras?.exit?.status || 'offline' },
          mqtt: { status: camRes.mqtt?.status || 'running', port: camRes.mqtt?.port || 1883 }
        }));
      }
      
      const healthRes: any = await api.getSystemHealth();
      if (healthRes.ok) {
        setHealth(healthRes.health);
        setSystemStatus(prev => ({
          ...prev,
          mqtt: { status: healthRes.health?.mqtt?.status || prev.mqtt.status, port: healthRes.health?.mqtt?.port || prev.mqtt.port }
        }));
      }
      
      if (user?.tier === 'resident') {
        const infoRes: any = await api.getResidentInfo(user.sessionId);
        if (infoRes.ok) {
          setResidentInfo(infoRes.data);
        }
      }
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();
  const parseMessage = (msg: string): DetectionEntry => { try { return JSON.parse(msg); } catch { return {}; } };

  const isSystemNormal = (): boolean => {
    return Object.values(systemStatus).every(s => 
      s.status === 'running' || s.status === 'streaming' || s.status === 'idle'
    );
  };

  const getDisplayName = (): string => {
    const name = residentInfo?.name;
    if (user?.tier === 'resident' && name) {
      return name;
    }
    return user?.username || t('dashboard.unknown');
  };

  const getSubtitle = (): string => {
    if (user?.tier === 'resident' && residentInfo?.house_number) {
      return `${t('dashboard.residing_at')} ${residentInfo.house_number}`;
    }
    if (user?.tier === 'admin') {
      if (isSystemNormal()) {
        return t('dashboard.all_systems_normal');
      }
      return t('dashboard.systems_warning');
    }
    return t('dashboard.welcome_smart_gate');
  };

  const labelToKey = (label: string): string => 'dashboard.' + label.toLowerCase().replace(/ /g, '_');

  const isAdmin = user?.tier === 'admin';

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl p-6 text-white ${
        isAdmin && !isSystemNormal() 
          ? 'bg-gradient-to-r from-amber-600 to-orange-700' 
          : 'bg-gradient-to-r from-[#0b1120] to-[#1e293b] dark:from-slate-950 dark:to-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('dashboard.welcome_back')}, {getDisplayName()}</h1>
            <p className="mt-1 text-slate-400">
              {getSubtitle()}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                isSystemNormal() 
                  ? 'bg-green-500/20' 
                  : 'bg-red-500/20'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  isSystemNormal() ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="text-sm font-medium">
                  {isSystemNormal() ? t('dashboard.system_active') : t('dashboard.system_issue')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title={t('dashboard.today_entry')} value={stats?.total_entry || 0} icon={ArrowRight} gradient="from-emerald-500 to-teal-600" />
        <StatCard title={t('dashboard.today_exit')} value={stats?.total_exit || 0} icon={ArrowLeft} gradient="from-violet-500 to-purple-600" />
        <StatCard title={t('dashboard.guests_inside')} value={stats?.guest?.still_inside || 0} icon={User} gradient="from-orange-500 to-amber-500" />
      </div>

      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col ${isAdmin ? 'lg:col-span-2' : ''}`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('dashboard.recent_detections')}</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto flex-1">
            {recentDetections.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('dashboard.no_detections')}</div>
            ) : (
              recentDetections.map((entry, idx) => {
                const msg = parseMessage(entry.message);
                return (
                  <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        msg.mode === 'ENTRY' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400'
                      }`}>
                        {msg.mode === 'ENTRY' ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{msg.person || t('dashboard.unknown')}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{msg.plat || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {msg.face_valid ? (
                          <CheckCircle size={16} className="text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <XCircle size={16} className="text-red-500 dark:text-red-400" />
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.face')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {msg.plate_valid ? (
                          <CheckCircle size={16} className="text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <XCircle size={16} className="text-red-500 dark:text-red-400" />
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.plate')}</span>
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{formatTime(entry.ts)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">{t('dashboard.system_status')}</h3>
              <div className="space-y-3">
                <StatusItem name={t('dashboard.gate_controller')} status={systemStatus.gate_controller.status} />
                <StatusItem name={t('dashboard.entry_camera')} status={systemStatus.entry_camera.status} />
                <StatusItem name={t('dashboard.exit_camera')} status={systemStatus.exit_camera.status} />
                <StatusItem name={t('dashboard.api_server')} status="running" />
                <StatusItem name={t('dashboard.mqtt_broker')} status={systemStatus.mqtt.status} port={systemStatus.mqtt.port} />
              </div>
            </div>

            {health && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">{t('dashboard.system_health')}</h3>
                <div className="space-y-4">
                  <HealthBar icon={Cpu} label={t('dashboard.cpu_temp').replace('Temp', '').trim() || 'CPU'} percent={health.cpu.percent} detail={`${health.cpu.freq_mhz} MHz`} color="blue" />
                  <HealthBar icon={MemoryStick} label="RAM" percent={health.ram.percent} detail={`${health.ram.used_gb} / ${health.ram.total_gb} GB`} color="emerald" />
                  <HealthBar icon={HardDrive} label="Disk" percent={health.disk.percent} detail={`${health.disk.used_gb} / ${health.disk.total_gb} GB`} color="violet" />
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Timer size={16} className="text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">{t('dashboard.uptime')}</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatUptime(health.uptime_seconds)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer size={16} className="text-orange-500" />
                      <div>
                        <p className="text-xs text-slate-500">{t('dashboard.cpu_temp')}</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{health.cpu.temp_celsius != null ? `${health.cpu.temp_celsius}°C` : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer size={16} className="text-red-500" />
                      <div>
                        <p className="text-xs text-slate-500">{t('dashboard.gpu_temp')}</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{health.gpu?.temp_celsius != null ? `${health.gpu.temp_celsius}°C` : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ThiefAlertWidget />
            <VehiclePassCreditWidget />
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThiefAlertWidget />
          <VehiclePassCreditWidget />
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, gradient }: { title: string; value: number; icon: LucideIcon; gradient: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${gradient} flex items-center justify-center text-white`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function StatusItem({ name, status, port }: { name: string; status: string; port?: number }) {
  const { t } = useLanguage();
  const isOnline = status === 'running' || status === 'streaming' || status === 'idle';
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex items-center gap-2">
        {port && <Wifi size={14} className="text-slate-400" />}
        <span className="text-sm text-slate-600 dark:text-slate-300">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {port && (
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">:{port}</span>
        )}
        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#10b981]' : 'bg-red-500'}`}></span>
        <span className={`text-xs font-medium ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {status === 'streaming' ? t('common.online') : status === 'idle' ? t('common.idle') : status === 'running' ? t('common.online') : t('common.offline')}
        </span>
      </div>
    </div>
  );
}

const healthColorMap: Record<string, { icon: string; bar: string }> = {
  blue: { icon: 'text-blue-500', bar: 'bg-blue-500' },
  emerald: { icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  violet: { icon: 'text-violet-500', bar: 'bg-violet-500' },
};

function HealthBar({ icon: Icon, label, percent, detail, color }: { icon: any; label: string; percent: number; detail: string; color: string }) {
  const colors = healthColorMap[color] || healthColorMap.blue;
  const barColor = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-amber-500' : colors.bar;
  const textColor = percent > 90 ? 'text-red-600' : percent > 70 ? 'text-amber-600' : 'text-slate-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon size={16} className={colors.icon} />
          <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{detail}</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{percent}%</span>
    </div>
  );
}
