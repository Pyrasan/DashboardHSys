import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Lock, User, Car, Home, Mail, Phone, ArrowLeft, Users, Check, Camera, X, Loader2 } from 'lucide-react';

export default function Register() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [registrationType, setRegistrationType] = useState('head_of_household');
  const [heads, setHeads] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    house_address: '',
    plates: '',
    email: '',
    phone: '',
    parent_username: '',
  });
  const [faceImageFile, setFaceImageFile] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (registrationType === 'household_member') {
      loadHeads();
    } else {
      setFormData(prev => ({ ...prev, parent_username: '', plates: '' }));
    }
    loadAddresses();
  }, [registrationType]);

  useEffect(() => {
    if (registrationType === 'household_member' && formData.parent_username) {
      const selectedHead = heads.find(h => h.username === formData.parent_username);
      if (selectedHead?.plates) {
        setFormData(prev => ({ ...prev, plates: selectedHead.plates }));
      }
    }
  }, [formData.parent_username, registrationType]);

  const loadHeads = async () => {
    const res = await api.getHeads();
    if (res.ok) {
      setHeads(res.data);
    }
  };

  const loadAddresses = async () => {
    const res = await api.getAddresses();
    if (res.ok) {
      setAddresses(res.data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'plates') {
      setFormData({ ...formData, plates: value.replace(/\s+/g, '') });
    } else {
      setFormData({ ...formData, [name]: value });
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
    setError('');
    setSuccess('');
    setWarning('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('register.password_mismatch'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('register.password_length'));
      return;
    }

    const plateList = formData.plates.split(',').map(p => p.trim()).filter(Boolean);
    if (plateList.length > 0) {
      const headUsername = registrationType === 'household_member' ? formData.parent_username : undefined;
      const dupCheck = await api.checkPlateDuplicates(plateList, headUsername);
      if (dupCheck.ok && dupCheck.duplicates?.length > 0) {
        const dupInfo = dupCheck.duplicates.map((d: any) =>
          `${d.plate} (${d.owners.map((o: any) => o.owner).join(', ')})`
        ).join('; ');
        setError(`Plate number already registered: ${dupInfo}. Please use a different plate number.`);
        return;
      }
    }

    setLoading(true);

    const submitData = new FormData();
    submitData.append('username', formData.username);
    submitData.append('password', formData.password);
    submitData.append('name', formData.name);
    submitData.append('house_address', formData.house_address);
    submitData.append('plates', formData.plates);
    submitData.append('email', formData.email);
    submitData.append('phone', formData.phone);
    submitData.append('role', registrationType);
    submitData.append('parent_username', registrationType === 'household_member' ? formData.parent_username : '');

    if (faceImageFile) {
      submitData.append('face_image', faceImageFile);
    }

    const data = await api.registerWithFace(submitData);

    setLoading(false);

    if (data.ok) {
      setSuccess(data.message || '');
      if (data.warning) {
        setWarning(data.warning);
      }
      setTimeout(() => navigate('/login'), 3000);
    } else {
      setError(data.error || t('register.failed'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b1120] via-[#1e293b] to-[#0f172a]">
      <div className="w-full max-w-2xl p-8">
        <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition">
          <ArrowLeft size={18} />
          {t('register.back_to_login')}
        </Link>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Car className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-bold text-white">{t('register.title')}</h1>
          <p className="text-slate-400 mt-2">{t('register.subtitle')}</p>
        </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/10 relative">
            {loading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl z-10 flex flex-col items-center justify-center">
                <Loader2 size={48} className="animate-spin text-[#3b82f6] mb-4" />
                <p className="text-white font-medium text-lg">{t('register.processing_face')}</p>
                <p className="text-slate-400 text-sm mt-1">{t('register.encoding_face')}</p>
              </div>
            )}
            <div className="flex rounded-lg bg-white/5 p-1 mb-8">
            <button
              type="button"
              onClick={() => setRegistrationType('head_of_household')}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition ${
                registrationType === 'head_of_household'
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="inline mr-2 w-4 h-4" />
              {t('register.head_household')}
            </button>
            <button
              type="button"
              onClick={() => setRegistrationType('household_member')}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition ${
                registrationType === 'household_member'
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="inline mr-2 w-4 h-4" />
              {t('register.member')}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 p-3 rounded-lg text-sm mb-4">
              <Check className="inline mr-2 w-4 h-4" />
              {success}
            </div>
          )}

          {warning && (
            <div className="bg-amber-500/20 border border-amber-500/50 text-amber-400 p-3 rounded-lg text-sm mb-4">
              {warning}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.username_label')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                    placeholder={t('register.username_placeholder')}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.full_name')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                    placeholder={t('register.name_placeholder')}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.password_label')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                    placeholder={t('register.min_6_chars')}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.confirm_password_label')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                    placeholder={t('register.confirm_password_placeholder')}
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.face_photo')}</label>
              <div className="flex items-center gap-4">
                {faceImagePreview ? (
                  <div className="relative">
                    <img
                      src={faceImagePreview}
                      alt="Face preview"
                      className="w-24 h-24 rounded-lg object-cover border-2 border-[#3b82f6]"
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
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-[#3b82f6] hover:bg-white/5 transition"
                  >
                    <Camera size={24} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-400">{t('common.upload')}</span>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('register.face_photo_hint')}</p>
                </div>
              </div>
            </div>

            {registrationType === 'head_of_household' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.house_address')}</label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <select
                      name="house_address"
                      value={formData.house_address}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#3b82f6] transition"
                      required
                    >
                      <option value="" className="bg-slate-800">{t('register.select_address')}</option>
                      {addresses.map((addr) => (
                        <option key={addr} value={addr} className="bg-slate-800">
                          {addr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.vehicle_plates')}</label>
                  <div className="relative">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      name="plates"
                      value={formData.plates}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                      placeholder={t('register.plates_placeholder')}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('register.plates_hint')}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.select_head')}</label>
                  <select
                    name="parent_username"
                    value={formData.parent_username}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#3b82f6] transition"
                    required
                  >
                    <option value="" className="bg-slate-800">{t('register.select_head_placeholder')}</option>
                    {heads.map((h) => (
                      <option key={h.username} value={h.username} className="bg-slate-800">
                        {h.name || h.username} - {h.house_address}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.parent_username && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.house_address').replace(' *', '')}</label>
                      <div className="relative">
                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                          type="text"
                          value={heads.find(h => h.username === formData.parent_username)?.house_address || ''}
                          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white"
                          disabled
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.plates_from_head')}</label>
                      <div className="relative">
                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                          type="text"
                          value={formData.plates || ''}
                          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/70"
                          disabled
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('register.plates_auto_assigned')}</p>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.phone')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                    placeholder={t('register.phone_placeholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('register.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] transition"
                    placeholder={t('register.email_placeholder')}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#3b82f6] to-[#4f46e5] hover:from-[#2563eb] hover:to-[#4338ca] text-white font-medium py-3 rounded-lg transition disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> {t('register.processing_button')}</> : t('auth.register')}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-slate-400">
              {t('register.has_account')}{' '}
              <Link to="/login" className="text-[#3b82f6] hover:underline">
                {t('login.sign_in')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
