import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { User, Mail, Phone, Home, Lock, Save, X, Edit3, Shield, ArrowLeft, Check, AlertCircle, Camera } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

interface ProfileData {
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  house_address: string;
  face_image: string | null;
  avatar_url: string | null;
}

export default function Profile() {
  const { username: urlUsername } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const targetUsername = urlUsername || user?.username || '';
  const isAdmin = user?.role === 'admin';
  const isSelf = user?.username === targetUsername;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    new_username: '',
    password: '',
    confirm_password: '',
    email: '',
    phone: '',
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, [targetUsername]);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    const res = await api.getProfile(targetUsername, user?.sessionId);
    if (res.ok && res.data) {
      setProfile(res.data);
      setForm({
        name: res.data.name || '',
        new_username: res.data.username || '',
        password: '',
        confirm_password: '',
        email: res.data.email || '',
        phone: res.data.phone || '',
      });
    } else {
      setError(res.error || t('profile.not_found'));
    }
    setLoading(false);
  };

  const handleEdit = () => {
    setEditing(true);
    setError('');
    setSuccess('');
    if (profile) {
      setForm({
        name: profile.name || '',
        new_username: profile.username || '',
        password: '',
        confirm_password: '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setSuccess('');
    if (profile) {
      setForm({
        name: profile.name || '',
        new_username: profile.username || '',
        password: '',
        confirm_password: '',
        email: profile.email || '',
        phone: profile.phone || '',
      });
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (form.password && form.password !== form.confirm_password) {
      setError(t('profile.password_mismatch'));
      return;
    }
    if (form.password && form.password.length < 6) {
      setError(t('profile.password_length'));
      return;
    }
    if (!form.new_username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    const hasChanges =
      form.name !== (profile?.name || '') ||
      form.new_username !== profile?.username ||
      form.email !== (profile?.email || '') ||
      form.phone !== (profile?.phone || '') ||
      form.password !== '';

    if (!hasChanges) {
      setError(t('profile.no_changes'));
      return;
    }

    setSaving(true);
    const data: Record<string, string> = {};
    if (form.name !== (profile?.name || '')) data.name = form.name;
    if (form.new_username !== profile?.username) data.new_username = form.new_username;
    if (form.password) data.password = form.password;
    if (form.email !== (profile?.email || '')) data.email = form.email;
    if (form.phone !== (profile?.phone || '')) data.phone = form.phone;

    const res = await api.updateProfile(profile!.username, data, user?.sessionId);
    setSaving(false);

    if (res.ok) {
      setSuccess(t('profile.update_success'));
      setEditing(false);
      const updatedUsername = res.username || form.new_username;
      await loadProfile();
      if (form.password || form.new_username !== profile?.username) {
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 1500);
      }
    } else {
      if (res.error?.includes('already taken')) {
        setError(t('profile.username_taken'));
      } else {
        setError(res.error || t('profile.update_failed'));
      }
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'head_of_household': return t('register.head_household');
      case 'household_member': return t('register.member');
      default: return role;
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    setUploadingAvatar(true);
    setError('');
    const res = await api.uploadAvatar(profile!.username, file, user?.sessionId);
    setUploadingAvatar(false);
    
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, avatar_url: res.avatar_url } : null);
      setSuccess('Avatar updated successfully');
    } else {
      setError(res.error || 'Failed to upload avatar');
    }
    
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const getAvatarSrc = () => {
    if (profile?.avatar_url) return `${API_URL}${profile.avatar_url}`;
    if (profile?.face_image) return `${API_URL}${profile.face_image}`;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 mb-4">
          <ArrowLeft size={18} />
          <span className="text-sm">{t('common.cancel')}</span>
        </button>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {!isSelf && (
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
          <ArrowLeft size={18} />
          <span className="text-sm">{t('common.cancel')}</span>
        </button>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] p-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              {getAvatarSrc() ? (
                <img
                  src={getAvatarSrc()!}
                  alt={profile?.name || ''}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white/30"
                />
              ) : (
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                  <User size={36} className="text-white" />
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploadingAvatar ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Camera size={20} className="text-white" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="text-white">
              <h1 className="text-xl font-bold">{profile?.name || profile?.username}</h1>
              <p className="text-white/80 text-sm">@{profile?.username}</p>
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                <Shield size={12} />
                {roleLabel(profile?.role || '')}
              </span>
            </div>
          </div>
        </div>

        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
            <Check size={16} className="text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {!editing ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.name')}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{profile?.name || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.username')}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">@{profile?.username}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.email')}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{profile?.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.phone')}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{profile?.phone || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.role')}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{roleLabel(profile?.role || '')}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.house_address')}</label>
                  <p className="text-sm text-slate-800 dark:text-slate-200">{profile?.house_address || '-'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  <Edit3 size={16} />
                  {t('profile.edit_profile')}
                </button>
              </div>
            </>
          ) : (
            <>
              {isAdmin && !isSelf && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">{t('profile.admin_editing')}: @{profile?.username}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.name')}</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.username')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                    <input
                      type="text"
                      value={form.new_username}
                      onChange={e => setForm(f => ({ ...f, new_username: e.target.value }))}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.email')}</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.phone')}</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.new_password')}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••"
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {form.password && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('profile.confirm_password')}</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={form.confirm_password}
                        onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                        placeholder="••••••"
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? t('common.loading') : t('profile.save')}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                >
                  <X size={16} />
                  {t('profile.cancel')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
