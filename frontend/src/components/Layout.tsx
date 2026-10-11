import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NavItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  LayoutDashboard, 
  Camera, 
  BarChart3, 
  Users, 
  ArrowRightLeft, 
  LogOut,
  Bell,
  Menu,
  X,
  Car,
  UserPlus,
  UserCheck,
  Mail,
  Home,
  Activity,
  Clock,
  Moon,
  Sun,
  Globe,
  User
} from 'lucide-react';

const ALL_NAV_ITEMS: NavItem[] = [
  { path: '/app', label: 'Dashboard', icon: LayoutDashboard, tiers: ['admin', 'resident'] },
  { path: '/app/detection', label: 'Live Detection', icon: Camera, tiers: ['admin', 'resident', 'general'] },
  { path: '/app/active-vehicles', label: 'Active Vehicles', icon: Activity, tiers: ['admin', 'head_of_household'] },
  { path: '/app/session-timeline', label: 'Session Timeline', icon: Clock, tiers: ['admin', 'head_of_household', 'household_member'] },
  { path: '/app/stats', label: 'Statistics', icon: BarChart3, tiers: ['admin', 'resident'] },
  { path: '/app/guest', label: 'Guests', icon: Users, tiers: ['admin'] },
  { path: '/app/command', label: 'Control', icon: ArrowRightLeft, tiers: ['admin'] },
  { path: '/app/vp-management', label: 'VehiclePass', icon: Car, tiers: ['admin', 'head_of_household'] },
  { path: '/app/my-household', label: 'My Household', icon: Home, tiers: ['admin', 'resident'] },
  { path: '/app/registrations', label: 'Registrations', icon: UserPlus, tiers: ['admin'] },
  { path: '/app/residents', label: 'Residents', icon: UserCheck, tiers: ['admin'] },
  { path: '/app/head-approvals', label: 'Approvals', icon: UserPlus, tiers: ['head_of_household'] },
  { path: '/app/notifications', label: 'Notifications', icon: Bell, tiers: ['head_of_household', 'household_member', 'admin'] },
  { path: '/app/messages', label: 'Messages', icon: Mail, tiers: ['head_of_household', 'admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showNotifDropdown && user) {
      fetchRecentNotifications();
    }
  }, [showNotifDropdown]);

  useEffect(() => {
    if (showProfileDropdown && user) {
      fetchProfileAvatar();
    }
  }, [showProfileDropdown]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  const fetchRecentNotifications = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/notifications`, {
        headers: { 'X-Session-Id': localStorage.getItem('sessionId') || '' }
      });
      const data = await res.json();
      if (data.ok) {
        setRecentNotifs(data.data.slice(0, 5));
      }
    } catch {
      // silent
    }
  };

  const fetchProfileAvatar = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const res = await fetch(`${API_URL}/api/profile/${user?.username}`, {
        headers: { 'X-Session-Id': localStorage.getItem('sessionId') || '' }
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setProfileAvatar(data.data.avatar_url || data.data.face_image || null);
      }
    } catch {
      // silent
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const userTier = user?.tier || 'general';
  const userRole = user?.role || '';
  const navItems = ALL_NAV_ITEMS.filter(item => item.tiers.includes(userTier) || item.tiers.includes(userRole));

  const labelToTKey = (label: string): string => 'nav.' + label.toLowerCase().replace(/ /g, '_');

  const getPageTitle = (): string => {
    const path = location.pathname;
    if (path === '/app' || path === '/app/') return t('nav.dashboard');
    const sorted = [...ALL_NAV_ITEMS].sort((a, b) => b.path.length - a.path.length);
    const item = sorted.find(n => path.startsWith(n.path));
    return item ? t(labelToTKey(item.label)) : t('nav.dashboard');
  };

  return (
    <div className="flex h-screen bg-[#f4f6f9] dark:bg-slate-900">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-[#0b1120] dark:bg-slate-950 text-[#94a3b8]
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white">SecurePass</h1>
          <p className="text-xs text-slate-500 capitalize">{userTier}</p>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/app'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] text-white' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{t(labelToTKey(item.label))}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{user?.username}</p>
              <p className="text-xs text-slate-500 capitalize">{userTier}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              title={t('layout.logout_title')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 transition-colors"
              title={t('layout.toggle_lang')}
            >
              <Globe size={16} />
              <span className="font-medium uppercase">{lang}</span>
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title={theme === 'dark' ? t('layout.light_mode') : t('layout.dark_mode')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="text-sm text-slate-600 dark:text-slate-300 font-medium">
              {currentTime.toLocaleTimeString()}
            </div>
            
            <div className="relative">
              <button 
                className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              >
                <Bell size={20} className="text-slate-600 dark:text-slate-300" />
                {recentNotifs.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t('nav.notifications')}</h3>
                    <button 
                      onClick={() => navigate('/app/notifications')}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t('layout.show_all')}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {recentNotifs.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        {t('layout.no_notifications')}
                      </div>
                    ) : (
                      recentNotifs.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${!notif.is_read ? 'bg-blue-50/30 dark:bg-blue-900/20' : ''}`}
                        >
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{notif.title}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{notif.message}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {new Date(notif.created_at * 1000).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative" ref={profileDropdownRef}>
              <button 
                className="w-9 h-9 bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] rounded-full flex items-center justify-center text-white font-medium hover:opacity-90 transition-opacity overflow-hidden"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              >
                {profileAvatar ? (
                  <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}${profileAvatar}`} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  user?.username?.charAt(0).toUpperCase()
                )}
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-[#3b82f6] to-[#4f46e5]">
                    <div className="flex items-center gap-3">
                      {profileAvatar ? (
                        <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}${profileAvatar}`} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
                      ) : (
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                          <User size={20} className="text-white" />
                        </div>
                      )}
                      <div className="text-white min-w-0">
                        <p className="text-sm font-semibold truncate">{user?.username}</p>
                        <p className="text-xs text-white/70 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate('/app/profile');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <User size={16} className="text-slate-400" />
                      {t('layout.view_profile')}
                    </button>
                    <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut size={16} />
                      {t('auth.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6 dark:text-slate-200">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
