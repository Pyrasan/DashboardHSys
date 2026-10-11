import React from 'react';

export interface User {
  sessionId?: string;
  tier: 'admin' | 'resident' | 'general';
  role: string;
  username: string;
  [key: string]: unknown;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasAccess: (path: string) => boolean;
  isAuthenticated: () => boolean;
  loading: boolean;
}

export interface GateStatusInfo {
  status: string;
  gate: string;
}

export interface DetectionMessage {
  topic: string;
  message: string;
  ts: number;
  id?: number;
}

export interface SocketContextType {
  messages: DetectionMessage[];
  connected: boolean;
  getStatus: (gate: 'entry' | 'exit') => GateStatusInfo | null;
  getHealth: () => unknown;
  gateStatus: { entry: GateStatusInfo | null; exit: GateStatusInfo | null };
  health: unknown;
}

export interface ApiResponse {
  ok: boolean;
  error?: string;
  user?: any;
  stats?: any;
  data?: any;
  users?: any;
  plates?: any;
  cameras?: any;
  sessionId?: string;
  authenticated?: boolean;
  message?: string;
  warning?: string;
  [key: string]: any;
}

export interface Stats {
  total_entry: number;
  total_exit: number;
  detection_valid: number;
  detection_invalid: number;
  resident?: { total_entry: number; total_exit: number };
  guest?: { total_entry: number; total_exit: number; still_inside: number };
  vp?: { total_entry: number; total_exit: number };
  button?: { open_entry: number; open_exit: number };
  hot_hours?: Record<string, number>;
}

export interface VehiclePassUser {
  id: number;
  name: string;
  plates?: string[];
  plate?: string;
  plate_original?: string;
  credits: number;
  active: boolean;
  face_image?: string;
  created_at?: string;
  created_by?: string;
  created_by_name?: string;
  catatan?: string;
  house_address?: string;
  owner_name?: string;
}

export interface Registration {
  id: number;
  username: string;
  name?: string;
  role: string;
  house_address?: string;
  email?: string;
  phone?: string;
  face_image?: string;
  created_at: number;
  approved_by_head_at?: number;
  parent_username?: string;
  status?: string;
}

export interface HouseholdMember {
  id: number;
  username: string;
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  face_image?: string;
  avatar_url?: string;
  created_at: number;
  plates?: string;
}

export interface Household {
  house_address: string;
  head: HouseholdMember;
  members: HouseholdMember[];
  vp?: VehiclePassUser[];
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: number;
}

export interface Message {
  id: number;
  from_username: string;
  to_username: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: number;
}

export interface GuestRecord {
  id: number;
  waktu: string;
  plat_nomor?: string;
  foto?: string;
}

export interface DetectionEntry {
  person?: string;
  muka?: string;
  plat?: string;
  mode?: string;
  face_valid?: boolean;
  plate_valid?: boolean;
  time?: number;
}

export type LucideIcon = React.ComponentType<any>;

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  tiers: string[];
}

export interface HouseholdVehicle {
  plate: string;
  driver: string;
  driver_username?: string;
  status: 'inside' | 'outside' | 'unknown';
  last_ts: number | null;
  last_mode: 'ENTRY' | 'EXIT' | null;
  type: 'resident' | 'vp';
  face_image?: string;
  face_valid: boolean;
  plate_valid: boolean;
}

export interface Household {
  house_address: string;
  head_name: string;
  head_username: string;
  vehicles: HouseholdVehicle[];
}

export interface VehiclePassUserWithStatus {
  id: string;
  name: string;
  house_address: string;
  credits: number;
  vehicles: HouseholdVehicle[];
}

export interface GuestWithStatus {
  id: string;
  person: string;
  plate: string;
  entry_ts: number;
  duration_ms: number;
  duration_hours: number;
  duration_status: 'green' | 'orange' | 'red';
  face_image?: string;
}

export interface VehicleStatusResponse {
  ok: boolean;
  households: Household[];
  vp_users: VehiclePassUserWithStatus[];
  guests: GuestWithStatus[];
  is_admin: boolean;
  user_house: string | null;
  now_ts: number;
}

export interface SessionEvent {
  person: string;
  plat: string;
  mode: 'ENTRY' | 'EXIT';
  face_valid: boolean;
  plate_valid: boolean;
  ts: number;
  face_image?: string;
  plate_image?: string;
  frame_image?: string;
  access_granted?: boolean;
  source?: string;
}

export interface VehicleSession {
  sessionId: string;
  plate: string;
  person: string;
  events: SessionEvent[];
  entryTime: number;
  exitTime?: number;
  durationMs?: number;
  isActive: boolean;
  face_image?: string;
}
