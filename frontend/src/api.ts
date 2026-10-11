import { ApiResponse } from './types';

const API_URL = import.meta.env.VITE_API_URL || '';

export const api = {
  async login(username: string, password: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      return data;
    } catch {
      return { ok: false, error: 'Network error' };
    }
  },

  async logout(sessionId?: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'X-Session-Id': sessionId || '' },
      });
      return res.json();
    } catch {
      return { ok: true };
    }
  },

  async checkAuth(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getHistory(type: string, sessionId?: string | null, limit = 100): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/history/${type}?limit=${limit}`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getStats(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/stats`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getTamu(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/tamu`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async deleteTamu(id: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/tamu/${id}`, {
      method: 'DELETE',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getVP(sessionId: string, activeOnly = false): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp?active_only=${activeOnly}`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getVPById(id: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp/${id}`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async checkVP(faceEncoding: string, plate: string, mode = 'MASUK'): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ face_encoding: faceEncoding, plate, mode }),
    });
    return res.json();
  },

  async updateVP(id: number | string, data: Record<string, unknown>, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '' 
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAddresses(): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/addresses`);
    return res.json();
  },

  async addAddress(address: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/addresses`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '' 
      },
      body: JSON.stringify({ address }),
    });
    return res.json();
  },

  async createVP(data: Record<string, unknown>, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '' 
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteVP(id: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp/${id}`, {
      method: 'DELETE',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getMessages(folder: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/messages?folder=${folder || 'inbox'}`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async sendMessage(toUsername: string, subject: string, message: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/messages/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '' 
      },
      body: JSON.stringify({ to_username: toUsername, subject, message }),
    });
    return res.json();
  },

  async markMessageRead(msgId: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/messages/${msgId}/read`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getMessageRecipients(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/messages/recipients`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async sendCommand(command: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/command`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '' 
      },
      body: JSON.stringify({ command }),
    });
    return res.json();
  },

  async deleteHistory(type: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/history/${type}`, {
      method: 'DELETE',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getSystemHealth(): Promise<ApiResponse> {
    try {
      const res = await fetch(`${API_URL}/api/system/health`);
      return res.json();
    } catch {
      return { ok: false, error: 'Network error' };
    }
  },

  async getCameraStatus(): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/camera/status`);
    return res.json();
  },

  async register(data: Record<string, unknown>): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async registerWithFace(formData: FormData): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async createVPWithFace(formData: FormData, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/vp`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
      body: formData,
    });
    return res.json();
  },

  async getPendingRegistrations(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/registrations/pending`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async approveRegistration(regId: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/registrations/${regId}/approve`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async rejectRegistration(regId: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/registrations/${regId}/reject`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getResidentInfo(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/auth/resident-info`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getResidents(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/residents`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async resetResidentPassword(username: string, newPassword: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/residents/${username}/reset-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '' 
      },
      body: JSON.stringify({ new_password: newPassword }),
    });
    return res.json();
  },

  async deleteResident(username: string, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/residents/${username}`, {
      method: 'DELETE',
      headers: { 
        'X-Session-Id': sessionId || '' 
      },
    });
    return res.json();
  },

  async getHeadPendingRegistrations(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/registrations/head-pending`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async headApproveRegistration(regId: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/registrations/${regId}/head-approve`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getNotifications(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/notifications`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async markNotificationRead(notifId: number, sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/notifications/${notifId}/read`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async markAllNotificationsRead(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getHouseholds(sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/residents/households`, {
      headers: { 'X-Session-Id': sessionId || '' },
    });
    return res.json();
  },

  async getHeads(): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/residents/heads`);
    return res.json();
  },

  async getHouseholdPlates(sessionId: string, headUsername?: string): Promise<ApiResponse> {
    let url = `${API_URL}/api/residents/household-plates`;
    if (headUsername) {
      url += `?head_username=${encodeURIComponent(headUsername)}`;
    }
    const res = await fetch(url, {
      headers: sessionId ? { 'X-Session-Id': sessionId || '' } : {},
    });
    return res.json();
  },

  async updatePlates(username: string, plates: string[], sessionId?: string): Promise<ApiResponse> {
    const res = await fetch(`${API_URL}/api/residents/${encodeURIComponent(username)}/plates`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId || '',
      },
      body: JSON.stringify({ plates }),
    });
    return res.json();
  },

   async checkPlateDuplicates(plates: string[], headUsername?: string, excludeVpId?: string, sessionId?: string): Promise<ApiResponse> {
     const body: Record<string, any> = { plates };
     if (headUsername) body.head_username = headUsername;
     if (excludeVpId) body.exclude_vp_id = excludeVpId;
     const res = await fetch(`${API_URL}/api/plates/check-duplicates`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-Session-Id': sessionId || '',
       },
       body: JSON.stringify(body),
     });
     return res.json();
   },

   async getActiveSessions(sessionId?: string): Promise<ApiResponse> {
     const res = await fetch(`${API_URL}/api/sessions/vehicle-status`, {
       headers: { 'X-Session-Id': sessionId || '' },
     });
     return res.json();
   },

   async getProfile(username: string, sessionId?: string): Promise<ApiResponse> {
     const res = await fetch(`${API_URL}/api/profile/${encodeURIComponent(username)}`, {
       headers: { 'X-Session-Id': sessionId || '' },
     });
     return res.json();
   },

   async updateProfile(username: string, data: { name?: string; new_username?: string; password?: string; email?: string; phone?: string }, sessionId?: string): Promise<ApiResponse> {
     const res = await fetch(`${API_URL}/api/profile/${encodeURIComponent(username)}`, {
       method: 'PUT',
       headers: {
         'Content-Type': 'application/json',
         'X-Session-Id': sessionId || '',
       },
       body: JSON.stringify(data),
     });
     return res.json();
   },

   async uploadAvatar(username: string, file: File, sessionId?: string): Promise<ApiResponse> {
     const formData = new FormData();
     formData.append('avatar', file);
     const res = await fetch(`${API_URL}/api/profile/${encodeURIComponent(username)}/avatar`, {
       method: 'POST',
       headers: { 'X-Session-Id': sessionId || '' },
       body: formData,
     });
     return res.json();
   },
 };
