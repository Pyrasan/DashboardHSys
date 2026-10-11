import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Household } from '../types';
import { Home, User, Users, Car, Plus, X, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

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

export default function ResidentHome() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const isHead = user?.role === 'head_of_household';
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHouse, setSelectedHouse] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPlate, setNewPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [plateWarning, setPlateWarning] = useState('');

  useEffect(() => {
    loadHouseholds();
  }, []);

  const loadHouseholds = async () => {
    setLoading(true);
    const res = await api.getHouseholds(user?.sessionId);
    if (res.ok && res.data) {
      setHouseholds(res.data);
      if (res.data.length > 0) {
        if (!isAdmin) {
          setSelectedHouse(res.data[0]);
        } else if (!selectedHouse) {
          setSelectedHouse(res.data[0]);
        }
      }
    }
    setLoading(false);
  };

  const getPlates = (): string[] => {
    if (!selectedHouse) return [];
    const platesStr = selectedHouse.head?.plates || '';
    return platesStr ? platesStr.split(',').map(p => p.trim()).filter(p => p) : [];
  };

  const handleAddPlate = async () => {
    if (!newPlate.trim() || !selectedHouse) return;
    setPlateWarning('');
    const normalized = newPlate.replace(/\s+/g, '').toUpperCase();
    const dupCheck = await api.checkPlateDuplicates([normalized]);
    if (dupCheck.ok && dupCheck.duplicates?.length > 0) {
      const dupInfo = dupCheck.duplicates.map((d: any) =>
        `${d.plate} (${d.owners.map((o: any) => o.owner).join(', ')})`
      ).join('; ');
      setPlateWarning(`${t('resident_home.plate_duplicate')} ${dupInfo}. ${t('resident_home.plate_duplicate_hint')}`);
      return;
    }
    setSaving(true);
    const currentPlates = getPlates();
    currentPlates.push(normalized);
    const username = selectedHouse.head.username;
    const res = await api.updatePlates(username, currentPlates, user?.sessionId);
    if (res.ok) {
      setSelectedHouse(prev => prev ? {
        ...prev,
        head: { ...prev.head, plates: currentPlates.join(', ') }
      } : null);
      setNewPlate('');
    } else {
      alert(res.error || t('resident_home.add_failed'));
    }
    setSaving(false);
  };

  const handleRemovePlate = async (plateToRemove: string) => {
    if (!selectedHouse) return;
    setSaving(true);
    const currentPlates = getPlates().filter(p => p !== plateToRemove);
    const username = selectedHouse.head.username;
    const res = await api.updatePlates(username, currentPlates, user?.sessionId);
    if (res.ok) {
      setSelectedHouse(prev => prev ? {
        ...prev,
        head: { ...prev.head, plates: currentPlates.join(', ') }
      } : null);
    } else {
      alert(res.error || t('resident_home.remove_failed'));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('resident_home.loading')}</span>
        </div>
      </div>
    );
  }

  if (!selectedHouse) {
    return (
      <div className="p-12 text-center dark:text-slate-300">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Home size={24} className="text-slate-300" />
        </div>
        <p className="text-slate-500 font-medium">{t('resident_home.no_household')}</p>
        <p className="text-sm text-slate-400 mt-1">{t('resident_home.no_household_desc')}</p>
      </div>
    );
  }

  const plates = getPlates();
  const canManagePlates = isAdmin || isHead;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Home size={24} />
            {t('resident_home.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedHouse.house_address}</p>
        </div>
        <button onClick={loadHouseholds} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" title={t('resident_home.refresh')}>
          <RefreshCw size={18} className="text-slate-400" />
        </button>
      </div>

      {isAdmin && households.length > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('resident_home.select_household')}</label>
          <select
            value={selectedHouse.house_address}
            onChange={(e) => {
              const h = households.find(hh => hh.house_address === e.target.value);
              if (h) setSelectedHouse(h);
            }}
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {households.map(h => (
              <option key={h.house_address} value={h.house_address}>{h.house_address}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold dark:text-white mb-4 flex items-center gap-2">
          <Users size={18} /> {t('resident_home.residents')}
        </h2>

        <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800 mb-3">
          <div className="flex items-center gap-3">
            <FaceAvatar
              faceImage={selectedHouse.head.face_image}
              avatarUrl={selectedHouse.head.avatar_url}
              size="w-10 h-10"
              fallbackIcon={User}
              fallbackColor="bg-purple-200"
              iconSize={18}
            />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {selectedHouse.head.name || selectedHouse.head.username}
                <span className="ml-2 px-2 py-0.5 bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 rounded-full text-xs">{t('resident_home.head_badge')}</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">@{selectedHouse.head.username}</p>
            </div>
          </div>
        </div>

        {selectedHouse.members.map(member => (
          <div key={member.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-2">
            <div className="flex items-center gap-3">
              <FaceAvatar
                faceImage={member.face_image}
                avatarUrl={member.avatar_url}
                size="w-10 h-10"
                fallbackIcon={User}
                fallbackColor="bg-blue-100"
                iconSize={18}
              />
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {member.name || member.username}
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-200 rounded-full text-xs">{t('resident_home.member_badge')}</span>
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">@{member.username}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold dark:text-white mb-4 flex items-center gap-2">
          <Car size={18} /> {t('resident_home.registered_vehicles')}
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {plates.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('resident_home.no_vehicles')}</p>
          ) : (
            plates.map((plate, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm dark:text-slate-200">
                <Car size={14} className="text-slate-500" />
                <span className="font-mono">{plate}</span>
                {canManagePlates && (
                  <button
                    onClick={() => handleRemovePlate(plate)}
                    className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    disabled={saving}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {canManagePlates && (
          <>
            {plateWarning && (
              <div className="bg-amber-500/20 border border-amber-500/50 text-amber-700 dark:text-amber-300 p-3 rounded-lg text-sm mb-3">
                {plateWarning}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleAddPlate(); }} className="flex gap-2">
              <input
                type="text"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value.replace(/\s+/g, ''))}
                placeholder={t('resident_home.plate_placeholder')}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={saving || !newPlate.trim()}
              >
                <Plus size={16} />
                {t('resident_home.add')}
              </button>
            </form>
          </>
        )}
      </div>

      {selectedHouse.vp && selectedHouse.vp.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold dark:text-white mb-4">{t('resident_home.vp_section')}</h2>
          <div className="space-y-2">
            {selectedHouse.vp.map(vpItem => (
              <div key={vpItem.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{vpItem.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                    {Array.isArray(vpItem.plates) ? vpItem.plates.join(', ') : vpItem.plates}
                  </p>
                </div>
                <span               className={`px-2 py-1 rounded-full text-xs ${vpItem.active ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {vpItem.credits} {t('resident_home.credits')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
