import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Household } from '../types';
import { Users, Home, Mail, Phone, User, Clock, RefreshCw, Search, Eye, EyeOff, X, ChevronDown, ChevronRight, Car, CreditCard, MapPin, Plus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const SCROLLBAR_STYLE = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
`;

const FaceAvatar = ({ faceImage, avatarUrl, size = "w-10 h-10", fallbackIcon: FallbackIcon, fallbackColor, iconSize = 20 }: {
  faceImage?: string;
  avatarUrl?: string;
  size?: string;
  fallbackIcon: any;
  fallbackColor?: string;
  iconSize?: number
}) => {
  const imgSrc = avatarUrl || faceImage;
  if (imgSrc) {
    return (
      <img
        src={`${API_URL}${imgSrc}`}
        alt="Face"
        className={`${size} rounded-full object-cover border-2 ${(fallbackColor || 'bg-slate-100').replace('bg-', 'border-').replace('100', '200')}`}
      />
    );
  }
  const bgColor = fallbackColor || 'bg-slate-100';
  return (
    <div className={`${size} ${bgColor} rounded-full flex items-center justify-center flex-shrink-0`}>
      <FallbackIcon size={iconSize} className={bgColor.replace('bg-', 'text-').replace('100', '600')} />
    </div>
  );
};

export default function Residents() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const [households, setHouseholds] = useState<Household[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHouse, setExpandedHouse] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState('');

  useEffect(() => {
    loadHouseholds();
    if (isAdmin) {
      loadAddresses();
    }
  }, []);

  const loadHouseholds = async () => {
    setLoading(true);
    const res = await api.getHouseholds(user?.sessionId);
    if (res.ok && res.data) {
      setHouseholds(res.data);
    }
    setLoading(false);
  };

  const loadAddresses = async () => {
    const res = await api.getAddresses();
    if (res.ok) {
      setAddresses(res.data || []);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) return;

    const res = await api.addAddress(newAddress.trim(), user?.sessionId);
    if (res.ok) {
      alert(t('residents.address_added'));
      setNewAddress('');
      setShowAddAddress(false);
      loadAddresses();
    } else {
      alert(res.error || t('residents.address_add_failed'));
    }
  };

  const deleteResident = async (username: string, role: string, house_address: string) => {
    if (!window.confirm(`${t('residents.delete_confirm')} ${username}?`)) return;
    const res = await api.deleteResident(username, user?.sessionId);
    if (res.ok) {
      alert(t('residents.deleted'));
      loadHouseholds();
    } else {
      alert(res.error || t('residents.delete_failed'));
    }
  };

  const filteredHouseholds = households.filter(h => {
    const search = searchTerm.toLowerCase();
    return (
      h.house_address.toLowerCase().includes(search) ||
      h.head.username.toLowerCase().includes(search) ||
      h.head.name?.toLowerCase().includes(search) ||
      h.head.email?.toLowerCase().includes(search) ||
      h.head.phone?.toLowerCase().includes(search) ||
      h.members.some(m => m.username.toLowerCase().includes(search) || m.name?.toLowerCase().includes(search) || m.email?.toLowerCase().includes(search) || m.phone?.toLowerCase().includes(search))
    );
  });

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const toggleAllPasswords = () => {
    const newShowAll = !showAllPasswords;
    setShowAllPasswords(newShowAll);
    if (newShowAll) {
      setVisiblePasswords({});
    }
  };

  const isPasswordVisible = (userId: string): boolean => {
    return showAllPasswords || visiblePasswords[userId];
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('residents.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{SCROLLBAR_STYLE}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Users size={24} />
            {t('residents.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('residents.desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAddAddress(!showAddAddress)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              {showAddAddress ? <X size={16} /> : <Plus size={16} />}
              {showAddAddress ? t('common.cancel') : t('residents.add_address')}
            </button>
          )}
          <button
            onClick={toggleAllPasswords}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            {showAllPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            {showAllPasswords ? t('residents.hide_all_passwords') : t('residents.show_all_passwords')}
          </button>
          <button
            onClick={loadHouseholds}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <RefreshCw size={16} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {showAddAddress && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4">{t('residents.add_new_address')}</h3>
          <form onSubmit={handleAddAddress} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('residents.house_address_label')}</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('residents.enter_address')}
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Plus size={16} className="inline mr-2" />
                {t('residents.add_address')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddAddress(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('residents.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {filteredHouseholds.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home size={24} className="text-slate-300" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('residents.no_households')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('residents.no_households_desc')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
            {filteredHouseholds.map((household) => (
              <div key={household.house_address}>
                <button
                  onClick={() => setExpandedHouse(expandedHouse === household.house_address ? null : household.house_address)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <FaceAvatar
                      faceImage={household.head.face_image}
                      avatarUrl={household.head.avatar_url}
                      size="w-12 h-12"
                      fallbackIcon={Home}
                      fallbackColor="bg-purple-100"
                      iconSize={20}
                    />
                    <div className="text-left">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {household.house_address}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('residents.head_label')}: {household.head.name || household.head.username} ({household.members.length + 1})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {household.vp && household.vp.length > 0 && (
                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full text-xs">
                        {household.vp.length} VehiclePass ({t('common.credits')})
                      </span>
                    )}
                    {expandedHouse === household.house_address ? (
                      <ChevronDown size={20} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={20} className="text-slate-400" />
                    )}
                  </div>
                </button>

                {expandedHouse === household.house_address && (
                  <div className="bg-slate-50/50 p-4 space-y-4">
                    <div>
                        <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                          <User size={16} /> {t('residents.residents')}
                      </h4>
                      <div className="grid gap-3">
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="flex items-start gap-3">
                            <FaceAvatar
                              faceImage={household.head.face_image}
                              avatarUrl={household.head.avatar_url}
                              size="w-10 h-10"
                              fallbackIcon={User}
                              fallbackColor="bg-purple-100"
                              iconSize={20}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  {household.head.name || household.head.username}
                                  <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 rounded-full text-xs">{t('residents.head_label')}</span>
                                </p>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <User size={14} className="text-slate-400" />
                                  <span className="text-slate-500 dark:text-slate-400">{t('residents.username')}</span>
                                  <span className="font-mono">{household.head.username}</span>
                                </div>
                                {household.head.email && (
                                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <Mail size={14} className="text-slate-400" />
                                    <span className="text-slate-500 dark:text-slate-400">{t('residents.email')}</span>
                                    <span>{household.head.email}</span>
                                  </div>
                                )}
                                {household.head.phone && (
                                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <Phone size={14} className="text-slate-400" />
                                    <span className="text-slate-500 dark:text-slate-400">{t('residents.phone')}</span>
                                    <span>{household.head.phone}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <MapPin size={14} className="text-slate-400" />
                                  <span className="text-slate-500 dark:text-slate-400">{t('residents.address')}</span>
                                  <span>{household.house_address}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                  <Clock size={14} className="text-slate-400" />
                                  <span className="text-slate-500 dark:text-slate-400">{t('residents.registered')}</span>
                                  <span>{formatDate(household.head.created_at)}</span>
                                </div>
                                {isAdmin && household.head && (
                                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 md:col-span-2">
                                    <Eye size={14} className="text-slate-400" />
                                    <span className="text-slate-500 dark:text-slate-400">{t('residents.password')}</span>
                                    <code className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-mono flex-1">
                                      {isPasswordVisible(`head-${household.head.username}`)
                                        ? (household.head.password || t('residents.no_password'))
                                        : '••••••••'}
                                    </code>
                                    <button
                                      onClick={() => togglePasswordVisibility(`head-${household.head.username}`)}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                      disabled={showAllPasswords}
                                    >
                                      {isPasswordVisible(`head-${household.head.username}`) ? (
                                        <EyeOff size={14} className="text-slate-400" />
                                      ) : (
                                        <Eye size={14} className="text-slate-400" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => deleteResident(household.head.username, 'head_of_household', household.house_address)}
                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                                        title={t('vp.delete_title_attr')}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {household.members.map((member) => (
                          <div key={member.id} className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div className="flex items-start gap-3">
                              <FaceAvatar
                                faceImage={member.face_image}
                                avatarUrl={member.avatar_url}
                                size="w-10 h-10"
                                fallbackIcon={User}
                                fallbackColor="bg-blue-100"
                                iconSize={20}
                              />
                              <div className="flex-1 space-y-2">
                                <p className="font-medium text-slate-800 dark:text-slate-100">
                                  {member.name || member.username}
                                  <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full text-xs">{t('residents.member_label')}</span>
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <User size={14} className="text-slate-400" />
                                    <span className="text-slate-500 dark:text-slate-400">{t('residents.username')}</span>
                                    <span className="font-mono">{member.username}</span>
                                  </div>
                                  {member.email && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                      <Mail size={14} className="text-slate-400" />
                                      <span className="text-slate-500 dark:text-slate-400">{t('residents.email')}</span>
                                      <span>{member.email}</span>
                                    </div>
                                  )}
                                  {member.phone && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                      <Phone size={14} className="text-slate-400" />
                                      <span className="text-slate-500 dark:text-slate-400">{t('residents.phone')}</span>
                                      <span>{member.phone}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                    <Clock size={14} className="text-slate-400" />
                                    <span className="text-slate-500 dark:text-slate-400">{t('residents.registered')}</span>
                                    <span>{formatDate(member.created_at)}</span>
                                  </div>
                                  {isAdmin && member && (
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 md:col-span-2">
                                      <Eye size={14} className="text-slate-400" />
                                      <span className="text-slate-500 dark:text-slate-400">{t('residents.password')}</span>
                                      <code className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-mono flex-1">
                                        {isPasswordVisible(`member-${member.id}`)
                                          ? (member.password || t('residents.password_empty'))
                                          : '••••••••••'}
                                      </code>
                                      <button
                                        onClick={() => togglePasswordVisibility(`member-${member.id}`)}
                                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                        disabled={showAllPasswords}
                                      >
                                        {isPasswordVisible(`member-${member.id}`) ? (
                                          <EyeOff size={14} className="text-slate-400" />
                                        ) : (
                                          <Eye size={14} className="text-slate-400" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => deleteResident(member.username, 'household_member', household.house_address)}
                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                                        title={t('vp.delete_title_attr')}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {household.vp && household.vp.length > 0 && (
                      <div>
                        <h4 className="font-medium text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                          <CreditCard size={16} /> {t('residents.vp_section')}
                        </h4>
                        <div className="grid gap-2">
                          {household.vp.map((vp) => (
                            <div key={vp.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                              <FaceAvatar
                                faceImage={vp.face_image}
                                size="w-10 h-10"
                                fallbackIcon={Car}
                                fallbackColor="bg-amber-100"
                                iconSize={20}
                              />
                              <div className="flex-1">
                                <p className="font-medium text-slate-800 dark:text-slate-100">{vp.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{t('table.plate')}: {vp.plate} | {t('common.credits')}: {vp.credits}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <Home size={20} className="text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-200">{t('residents.title')}: {filteredHouseholds.length}</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{t('residents.click_to_see')}</p>
          </div>
        </div>
      </div>

      {isAdmin && addresses.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin size={18} />
            {t('residents.available_addresses')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {addresses.map((addr, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <span className="text-sm text-slate-700 dark:text-slate-200">{addr}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
