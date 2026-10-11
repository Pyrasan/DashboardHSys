import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { SessionEvent, VehicleSession, DetectionEntry } from '../types';
import { 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  RefreshCw, 
  Search, 
  Filter, 
  ChevronDown,
  Car,
  User,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

function parseDetectionMessage(msg: string): SessionEvent | null {
  try {
    const parsed = JSON.parse(msg);
    return {
      person: parsed.person || parsed.muka || 'Unknown',
      plat: parsed.plat || '-',
      mode: parsed.mode === 'EXIT' ? 'EXIT' : 'ENTRY',
      face_valid: parsed.face_valid ?? true,
      plate_valid: parsed.plate_valid ?? true,
      ts: 0,
      face_image: parsed.face_image,
      plate_image: parsed.plate_image,
      frame_image: parsed.frame_image,
      access_granted: parsed.access_granted,
      source: parsed.source
    };
  } catch {
    return null;
  }
}

function normalizePlate(plate: string): string {
  if (!plate || plate === '-') return '';
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function classifyPersonType(person: string): 'resident' | 'vp' | 'guest' | 'unknown' {
  const p = person.toLowerCase();
  if (p.startsWith('g_') || p.startsWith('guest')) return 'guest';
  if (p.startsWith('vp_')) return 'vp';
  if (p === 'unknown' || p === 'unknown person') return 'unknown';
  return 'resident';
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '-';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatTime(ts: number): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short'
  });
}

function groupDetectionsIntoSessions(detections: any[]): VehicleSession[] {
  const plateEvents: Record<string, SessionEvent[]> = {};
  
  for (const det of detections) {
    const parsed = parseDetectionMessage(det.message);
    if (!parsed) continue;
    
    if (parsed.source === 'simulation') continue;
    
    const plateKey = normalizePlate(parsed.plat);
    if (!plateKey) continue;
    
    const event: SessionEvent = {
      ...parsed,
      ts: det.ts
    };
    
    if (!plateEvents[plateKey]) {
      plateEvents[plateKey] = [];
    }
    plateEvents[plateKey].push(event);
  }
  
  const sessions: VehicleSession[] = [];
  let sessionCounter = 0;
  
  for (const [plateKey, events] of Object.entries(plateEvents)) {
    const sortedEvents = [...events].sort((a, b) => a.ts - b.ts);
    
    let currentSession: { entry: SessionEvent | null; person: string; face_image?: string } = { entry: null, person: '' };
    
    for (const event of sortedEvents) {
      if (event.mode === 'ENTRY') {
        if (currentSession.entry) {
          const sessionId = `sess_${sessionCounter++}`;
          sessions.push({
            sessionId,
            plate: event.plat,
            person: currentSession.person || event.person,
            events: [currentSession.entry],
            entryTime: currentSession.entry.ts,
            exitTime: undefined,
            durationMs: undefined,
            isActive: true,
            face_image: currentSession.face_image
          });
        }
        currentSession = { 
          entry: event, 
          person: event.person,
          face_image: event.face_image
        };
      } else if (event.mode === 'EXIT') {
        if (currentSession.entry) {
          const sessionId = `sess_${sessionCounter++}`;
          const duration = event.ts - currentSession.entry.ts;
          sessions.push({
            sessionId,
            plate: event.plat,
            person: currentSession.person || event.person,
            events: [currentSession.entry, event],
            entryTime: currentSession.entry.ts,
            exitTime: event.ts,
            durationMs: duration,
            isActive: false,
            face_image: currentSession.face_image
          });
          currentSession = { entry: null, person: '' };
        } else {
          const sessionId = `sess_${sessionCounter++}`;
          sessions.push({
            sessionId,
            plate: event.plat,
            person: event.person,
            events: [event],
            entryTime: 0,
            exitTime: event.ts,
            durationMs: undefined,
            isActive: false,
            face_image: event.face_image
          });
        }
      }
    }
    
    if (currentSession.entry) {
      const sessionId = `sess_${sessionCounter++}`;
      sessions.push({
        sessionId,
        plate: currentSession.entry.plat,
        person: currentSession.person,
        events: [currentSession.entry],
        entryTime: currentSession.entry.ts,
        exitTime: undefined,
        durationMs: undefined,
        isActive: true,
        face_image: currentSession.face_image
      });
    }
  }
  
  return sessions.sort((a, b) => {
    const aTime = a.isActive ? a.entryTime : (a.exitTime || a.entryTime);
    const bTime = b.isActive ? b.entryTime : (b.exitTime || b.entryTime);
    return bTime - aTime;
  });
}

export default function SessionTimeline() {
  const { user } = useAuth();
  const { messages } = useSocket();
  const { t } = useLanguage();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPlate, setSearchPlate] = useState('');
  const [searchPerson, setSearchPerson] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [filterType, setFilterType] = useState<'all' | 'resident' | 'vp' | 'guest' | 'unknown'>('all');
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [householdPlates, setHouseholdPlates] = useState<string[]>([]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      api.getHouseholdPlates(user.sessionId).then((res: any) => {
        if (res.ok && Array.isArray(res.plates)) {
          setHouseholdPlates(res.plates.map((p: string) => normalizePlate(p)));
        }
      });
    }
  }, [user]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const res = await api.getHistory('detection', user?.sessionId, 500);
    if (Array.isArray(res)) {
      setHistory(res);
    } else if (res.ok && Array.isArray(res.data)) {
      setHistory(res.data);
    }
    setLoading(false);
  }, [user?.sessionId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (messages.length > 0) {
      const detection = messages.filter(m => m.topic === 'gate/detection');
      if (detection.length > 0) {
        setHistory(prev => {
          const existingKeys = new Set(prev.map(d => `${d.topic}|${d.message}|${d.ts}`));
          const deduped = detection.filter(d => !existingKeys.has(`${d.topic}|${d.message}|${d.ts}`));
          if (deduped.length === 0) return prev;
          return [...deduped, ...prev].slice(0, 500);
        });
      }
    }
  }, [messages]);

  const sessions = useMemo(() => {
    const allSessions = groupDetectionsIntoSessions(history);
    if (user?.role !== 'admin' && householdPlates.length > 0) {
      return allSessions.filter(s => householdPlates.includes(normalizePlate(s.plate)));
    }
    return allSessions;
  }, [history, user?.role, householdPlates]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (searchPlate) {
        const plateMatch = normalizePlate(s.plate).includes(normalizePlate(searchPlate));
        if (!plateMatch) return false;
      }
      
      if (searchPerson) {
        const personMatch = s.person.toLowerCase().includes(searchPerson.toLowerCase());
        if (!personMatch) return false;
      }
      
      if (filterStatus === 'active' && !s.isActive) return false;
      if (filterStatus === 'completed' && s.isActive) return false;
      
      if (filterType !== 'all') {
        const pType = classifyPersonType(s.person);
        if (pType !== filterType) return false;
      }
      
      return true;
    });
  }, [sessions, searchPlate, searchPerson, filterStatus, filterType]);

  const activeCount = sessions.filter(s => s.isActive).length;
  const completedCount = sessions.filter(s => !s.isActive).length;

  const getStatusBadge = (session: VehicleSession) => {
    if (session.isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
          {t('session_timeline.still_inside')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
        {t('session_timeline.completed')}
      </span>
    );
  };

  const getTypeBadge = (person: string) => {
    const type = classifyPersonType(person);
    const config: Record<string, { bg: string; text: string; label: string }> = {
      resident: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', label: t('session_timeline.resident') },
      vp: { bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-700 dark:text-amber-300', label: t('session_timeline.vp_users') },
      guest: { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-700 dark:text-orange-300', label: t('session_timeline.guest') },
      unknown: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: t('session_timeline.unknown') }
    };
    const c = config[type] || config.unknown;
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  const getEventValidation = (event: SessionEvent) => {
    const bothValid = event.face_valid && event.plate_valid;
    const bothInvalid = !event.face_valid && !event.plate_valid;
    
    if (bothValid) return 'border-l-[#10b981] bg-[#ecfdf5] dark:bg-[#ecfdf5]/10';
    if (bothInvalid) return 'border-l-[#ef4444] bg-[#fef2f2] dark:bg-[#fef2f2]/10';
    return 'border-l-[#f97316] bg-[#fff7ed] dark:bg-[#fff7ed]/10';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Clock size={24} />
            {t('session_timeline.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('session_timeline.desc')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              {activeCount} {t('session_timeline.active')}
            </span>
            <span className="text-slate-300">|</span>
            <span>{completedCount} {t('session_timeline.completed_count')}</span>
          </div>
          <button
            onClick={loadHistory}
            disabled={loading}
             className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('session_timeline.refresh')}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('session_timeline.search_plate')}
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('session_timeline.search_name')}
              value={searchPerson}
              onChange={(e) => setSearchPerson(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">{t('session_timeline.all_status')}</option>
              <option value="active">{t('session_timeline.still_inside')}</option>
              <option value="completed">{t('session_timeline.completed')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">{t('session_timeline.all_types')}</option>
              <option value="resident">{t('session_timeline.residents')}</option>
              <option value="vp">{t('session_timeline.vp_users')}</option>
              <option value="guest">{t('session_timeline.guests')}</option>
              <option value="unknown">{t('session_timeline.unknown_people')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin" />
            <span>{t('session_timeline.loading')}</span>
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={24} className="text-slate-300" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('session_timeline.no_sessions')}</p>
          <p className="text-sm text-slate-400 mt-1">
            {sessions.length === 0 
              ? t('session_timeline.no_history')
              : t('session_timeline.adjust_filters')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.sessionId}
              className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border transition-all cursor-pointer ${
                session.isActive 
                  ? 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700' 
                  : 'border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600'
              }`}
              onClick={() => setExpandedSession(
                expandedSession === session.sessionId ? null : session.sessionId
              )}
            >
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      session.isActive ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      <Car size={20} className={session.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                          {session.plate}
                        </span>
                        {getStatusBadge(session)}
                        {getTypeBadge(session.person)}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {session.person}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm">
                          <div className="w-6 h-6 rounded bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                            <ArrowRight size={12} className="text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-slate-600 dark:text-slate-300">{formatTime(session.entryTime)}</span>
                        </div>
                      </div>
                      {session.exitTime && (
                        <div className="flex items-center gap-1 text-sm mt-1">
                          <div className="w-6 h-6 rounded bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                            <ArrowLeft size={12} className="text-violet-600 dark:text-violet-400" />
                          </div>
                          <span className="text-slate-600 dark:text-slate-300">{formatTime(session.exitTime)}</span>
                        </div>
                      )}
                    </div>
                    {session.durationMs && (
                      <div className="text-right bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                        <p className="text-xs text-slate-400 uppercase tracking-wider">{t('session_timeline.duration')}</p>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{formatDuration(session.durationMs)}</p>
                      </div>
                    )}
                    {session.isActive && (
                      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 rounded-lg">
                        <AlertCircle size={16} className="text-emerald-500 dark:text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{t('session_timeline.active_label')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {expandedSession === session.sessionId && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">{t('session_timeline.event_details')}</h4>
                  <div className="space-y-3">
                    {session.events.map((event, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border-l-4 ${getEventValidation(event)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              event.mode === 'ENTRY' ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-violet-100 dark:bg-violet-900/50'
                            }`}>
                              {event.mode === 'ENTRY' ? (
                                <ArrowRight size={16} className="text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ArrowLeft size={16} className="text-violet-600 dark:text-violet-400" />
                              )}
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${
                                event.mode === 'ENTRY' ? 'text-emerald-700 dark:text-emerald-300' : 'text-violet-700 dark:text-violet-300'
                              }`}>
                                {event.mode}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{formatTime(event.ts)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              {event.face_valid ? (
                                <CheckCircle size={14} className="text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <XCircle size={14} className="text-red-500 dark:text-red-400" />
                              )}
                              <span className="text-xs text-slate-500 dark:text-slate-400">{t('session_timeline.face')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {event.plate_valid ? (
                                <CheckCircle size={14} className="text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <XCircle size={14} className="text-red-500 dark:text-red-400" />
                              )}
                              <span className="text-xs text-slate-500 dark:text-slate-400">{t('session_timeline.plate')}</span>
                            </div>
                          </div>
                        </div>
                        
                        {event.face_image && (
                          <div className="mt-3 flex items-center gap-4">
                            <div>
                              <p className="text-xs text-slate-400 mb-1">{t('session_timeline.face_image')}</p>
                              <img
                                src={`${API_URL}${event.face_image}`}
                                alt="Face"
                                className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-600"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            {event.plate_image && (
                              <div>
                                <p className="text-xs text-slate-400 mb-1">{t('session_timeline.plate_image')}</p>
                                <img
                                  src={`${API_URL}${event.plate_image}`}
                                  alt="Plate"
                                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-600"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
