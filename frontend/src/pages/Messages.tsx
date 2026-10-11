import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../api';
import { Message } from '../types';
import { Mail, Send, RefreshCw, Eye, Reply } from 'lucide-react';

export default function Messages() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<{ username: string; name: string; house_address: string }[]>([]);

  const canCompose = user?.role === 'admin' || user?.role === 'head_of_household';

  useEffect(() => {
    loadMessages();
  }, [folder]);

  useEffect(() => {
    loadRecipients();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    const res = await api.getMessages(folder, user?.sessionId);
    if (res.ok) {
      setMessages(res.data || []);
    }
    setLoading(false);
  };

  const loadRecipients = async () => {
    if (!canCompose) return;
    const res = await api.getMessageRecipients(user?.sessionId);
    if (res.ok) {
      setRecipients(res.data || []);
    }
  };

  const openCompose = (to = '', subject = '') => {
    setComposeData({ to, subject, message: '' });
    setShowCompose(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeData.to || !composeData.message) return;

    setSending(true);
    const res = await api.sendMessage(
      composeData.to,
      composeData.subject,
      composeData.message,
      user?.sessionId
    );

    if (res.ok) {
      setComposeData({ to: '', subject: '', message: '' });
      setShowCompose(false);
      loadMessages();
    } else {
      alert(res.error || t('messages.send_failed'));
    }
    setSending(false);
  };

  const handleMarkRead = async (msgId: number) => {
    await api.markMessageRead(msgId, user?.sessionId);
    loadMessages();
  };

  const handleReply = (msg: Message) => {
    openCompose(msg.from_username, msg.subject ? `Re: ${msg.subject}` : '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1120] dark:text-white flex items-center gap-2">
            <Mail size={24} />
            {t('messages.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {folder === 'inbox' ? t('messages.inbox_desc') : t('messages.sent_desc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFolder(folder === 'inbox' ? 'sent' : 'inbox')}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            {folder === 'inbox' ? t('messages.view_sent') : t('messages.view_inbox')}
          </button>
          {canCompose && (
            <button
              onClick={() => openCompose()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Send size={16} />
              {t('messages.compose')}
            </button>
          )}
          <button
            onClick={loadMessages}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {showCompose && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold mb-4">{t('messages.compose_title')}</h3>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('messages.to')}</label>
              {user?.role === 'admin' ? (
                <select
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                >
                  <option value="">{t('messages.select_recipient')}</option>
                  {recipients.map((r) => (
                    <option key={r.username} value={r.username}>
                      {r.name} ({r.username}){r.house_address ? ` - ${r.house_address}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  placeholder={t('messages.select_recipient')}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('messages.subject')}</label>
              <input
                type="text"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                placeholder={t('messages.subject_placeholder')}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{t('messages.message_label')}</label>
              <textarea
                value={composeData.message}
                onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                placeholder={t('messages.message_placeholder')}
                rows={4}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sending || !composeData.to || !composeData.message}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? t('messages.sending') : t('messages.send')}
              </button>
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center">
            <Mail size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">{t('messages.no_messages_in')} {folder}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!msg.is_read ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!msg.is_read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                      )}
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {folder === 'inbox' ? `${t('messages.from')} ${msg.from_username}` : `${t('messages.to_label')} ${msg.to_username}`}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{msg.subject || t('messages.no_subject')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{msg.message}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(msg.created_at * 1000).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {folder === 'inbox' && (
                      <button
                        onClick={() => handleReply(msg)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                        title={t('messages.reply_title')}
                      >
                        <Reply size={16} className="text-slate-400" />
                      </button>
                    )}
                    {!msg.is_read && folder === 'inbox' && (
                      <button
                        onClick={() => handleMarkRead(msg.id)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                        title={t('notifications.mark_read_title')}
                      >
                        <Eye size={16} className="text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
