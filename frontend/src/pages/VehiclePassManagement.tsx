import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { VehiclePassUser } from '../types';
import { Car, Plus, Trash2, Edit3, RefreshCw, Check, X, Camera, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const FaceAvatar = ({ faceImage, size = "w-10 h-10", t }: { faceImage?: string; size?: string; t: (key: string) => string }) => {
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
      <Car size={20} className="text-amber-600" />
    </div>
  );
};

export default function VehiclePassManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [vps, setVps] = useState<VehiclePassUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [heads, setHeads] = useState<any[]>([]);
  const [householdPlates, setHouseholdPlates] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    plates: [] as string[],
    credits: '10',
    head_username: '',
    catatan: ''
  });
  const [faceImageFile, setFaceImageFile] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVPs();
    if (user?.role === 'admin') {
      loadHeads();
    } else {
      loadHouseholdPlates();
    }
  }, []);

  const loadVPs = async () => {
    setLoading(true);
    const res = await api.getVP(user?.sessionId || '', false);
    if (res.ok) {
      setVps(res.users || []);
    }
    setLoading(false);
  };

  const loadHeads = async () => {
    const res = await api.getHeads();
    if (res.ok) {
      setHeads(res.data || []);
    }
  };

  const loadHouseholdPlates = async (headUsername?: string) => {
    const res = await api.getHouseholdPlates(user?.sessionId || '', headUsername);
    if (res.ok) {
      setHouseholdPlates(res.plates || []);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      plates: [],
      credits: '10',
      head_username: '',
      catatan: ''
    });
    setFaceImageFile(null);
    setFaceImagePreview(null);
    setEditId(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
    if (user?.role !== 'admin') {
      loadHouseholdPlates();
    }
  };

  const openEditForm = (vp: VehiclePassUser) => {
    const platesArray = vp.plates || (vp.plate ? vp.plate.split(',').map(s => s.trim()).filter(Boolean) : []);
    setFormData({
      name: vp.name || '',
      plates: platesArray,
      credits: String(vp.credits ?? 10),
      head_username: '',
      catatan: vp.catatan || ''
    });
    setFaceImageFile(null);
    setFaceImagePreview(null);
    setEditId(vp.id);
    setShowForm(true);
    if (user?.role === 'admin' && vp.created_by) {
      loadHouseholdPlates(vp.created_by);
    } else if (user?.role !== 'admin') {
      loadHouseholdPlates();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'head_username' && user?.role === 'admin' && !editId) {
      setFormData({ ...formData, head_username: value, plates: [] });
      if (value) {
        loadHouseholdPlates(value);
      } else {
        setHouseholdPlates([]);
      }
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handlePlateToggle = (plate: string) => {
    const current = formData.plates;
    if (current.includes(plate)) {
      setFormData({ ...formData, plates: current.filter(p => p !== plate) });
    } else {
      setFormData({ ...formData, plates: [...current, plate] });
    }
  };

  const handleFaceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaceImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFaceImage = () => {
    setFaceImageFile(null);
    setFaceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.plates.length === 0) {
      alert(t('vp.name_required'));
      return;
    }
    if (!formData.credits || parseInt(formData.credits) < 1) {
      alert(t('vp.credits_min'));
      return;
    }

    const normalizedPlates = formData.plates.map(p => p.replace(/\s+/g, '').toUpperCase()).filter(Boolean);
    if (normalizedPlates.length > 0) {
      const headUsername = user?.role === 'admin' ? formData.head_username : user?.username;
      const excludeVpId = editId || undefined;
      const dupCheck = await api.checkPlateDuplicates(normalizedPlates, headUsername, excludeVpId);
      if (dupCheck.ok && dupCheck.duplicates?.length > 0) {
        const dupInfo = dupCheck.duplicates.map((d: any) =>
          `${d.plate} (${d.owners.map((o: any) => o.owner).join(', ')})`
        ).join('; ');
        alert(`${t('vp.plate_duplicate')} ${dupInfo}. ${t('vp.plate_duplicate_hint')}`);
        return;
      }
    }

    setSubmitting(true);

    let data;
    if (editId) {
      data = await api.updateVP(editId, {
        name: formData.name,
        plates: normalizedPlates,
        credits: parseInt(formData.credits),
        catatan: formData.catatan || ''
      }, user?.sessionId);
    } else {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      normalizedPlates.forEach(p => submitData.append('plate', p));
      submitData.append('credits', formData.credits);
      if (user?.role === 'admin') {
        submitData.append('head_username', formData.head_username);
      }
      if (faceImageFile) {
        submitData.append('face_image', faceImageFile);
      }
      data = await api.createVPWithFace(submitData, user?.sessionId);
    }

    setSubmitting(false);

    if (data.ok) {
      alert(editId ? t('vp.updated') : t('vp.added'));
      resetForm();
      setShowForm(false);
      loadVPs();
    } else {
      alert(data.error || t('vp.operation_failed'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('vp.delete_confirm'))) return;
    const res = await api.deleteVP(id, user?.sessionId);
    if (res.ok) {
      loadVPs();
    } else {
      alert(res.error || t('vp.operation_failed'));
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span>{t('vp.loading')}</span>
        </div>
      </div>
    );
  }

  const canModify = user?.role === 'admin' || user?.role === 'head_of_household';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Car size={24} />
            {t('vp.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('vp.desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadVPs}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
          >
            <RefreshCw size={16} />
            {t('common.refresh')}
          </button>
          {canModify && (
            <button
              onClick={() => {
                if (showForm && !editId) {
                  setShowForm(false);
                  resetForm();
                } else {
                  openAddForm();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              {showForm && !editId ? <X size={16} /> : <Plus size={16} />}
              {showForm && !editId ? t('common.cancel') : t('vp.add')}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 relative">
          {submitting && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex flex-col items-center justify-center">
              <Loader2 size={40} className="animate-spin text-blue-600 mb-3" />
              <p className="text-slate-700 dark:text-slate-200 font-medium">{t('vp.processing_face')}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('vp.encoding_face')}</p>
            </div>
          )}
          <h3 className="text-lg font-semibold mb-4">{editId ? t('vp.edit_title') : t('vp.add_title')}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('vp.name_label')}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('vp.name_placeholder')}
                  required
                />
              </div>
              {user?.role === 'admin' && !editId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('vp.household_label')}</label>
                  <select
                    name="head_username"
                    value={formData.head_username}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">{t('vp.select_head')}</option>
                    {heads.map((h) => (
                      <option key={h.username} value={h.username}>
                        {h.name || h.username} ({h.house_address})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('vp.plates_label')}</label>
              {editId ? (
                <input
                  type="text"
                  value={formData.plates.join(', ')}
                  onChange={(e) => setFormData({ ...formData, plates: e.target.value.split(',').map(s => s.replace(/\s+/g, '')).filter(Boolean) })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="K1234AG, B5678DEF"
                  required
                />
              ) : householdPlates.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                  {householdPlates.map((p) => (
                    <label key={p} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.plates.includes(p)}
                        onChange={() => handlePlateToggle(p)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{p}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={formData.plates.join(', ')}
                  onChange={(e) => setFormData({ ...formData, plates: e.target.value.split(',').map(s => s.replace(/\s+/g, '')).filter(Boolean) })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('vp.select_household_first')}
                  required
                />
              )}
              {formData.plates.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('vp.selected')} {formData.plates.join(', ')}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('vp.credits_label')}</label>
              <input
                type="number"
                name="credits"
                value={formData.credits}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('vp.notes_label')}</label>
              <textarea
                name="catatan"
                value={formData.catatan}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('vp.notes_placeholder')}
              />
            </div>

            {!editId && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">{t('vp.face_photo_label')}</label>
                <div className="flex items-center gap-4">
                  {faceImagePreview ? (
                    <div className="relative">
                      <img
                        src={faceImagePreview}
                        alt={t('vp.table_face')}
                        className="w-20 h-20 rounded-lg object-cover border-2 border-[#3b82f6]"
                      />
                      <button
                        type="button"
                        onClick={removeFaceImage}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#3b82f6] hover:bg-slate-50 dark:hover:bg-slate-700/30 transition"
                    >
                      <Camera size={20} className="text-slate-400 mb-1" />
                      <span className="text-xs text-slate-400">{t('vp.upload')}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFaceImageChange}
                      className="hidden"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('vp.face_photo_hint')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> {t('vp.processing')}</> : (editId ? t('vp.save_changes') : t('vp.add'))}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {vps.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car size={24} className="text-slate-300" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('vp.no_users')}</p>
            <p className="text-sm text-slate-400 mt-1">{t('vp.no_users_desc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 dark:bg-slate-700/25">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_id')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_face')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_name')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_plate')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_credits')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_status')}</th>
                    {user?.role === 'admin' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_owner')}</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_created')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('vp.table_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {vps.map((vp) => (
                  <tr key={vp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">#{vp.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <FaceAvatar faceImage={vp.face_image} size="w-8 h-8" t={t} />
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{vp.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Car size={14} className="text-slate-400" />
                        <span className="font-medium text-slate-700 dark:text-slate-200">{vp.plate_original || vp.plate}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${vp.credits <= 0 ? 'text-red-600 dark:text-red-400' : vp.credits <= 3 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {vp.credits}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {vp.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                          <Check size={12} />
                          {t('vp.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                          <X size={12} />
                          {t('vp.inactive')}
                        </span>
                      )}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{vp.owner_name || vp.created_by || '-'}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(vp.created_at)}
                      <span className="text-xs text-slate-400 ml-1">{t('vp.by')} {vp.created_by_name || vp.created_by || t('vp.unknown')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        {canModify && (
                          <>
                            <button
                              onClick={() => openEditForm(vp)}
                              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-blue-500 dark:text-blue-400 hover:text-blue-700"
                              title={t('vp.edit_title_attr')}
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(vp.id)}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-500 dark:text-red-400 hover:text-red-700"
                              title={t('vp.delete_title_attr')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
