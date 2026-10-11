import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SocketContextType, DetectionMessage, GateStatusInfo } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<DetectionMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [gateStatus, setGateStatus] = useState<{ entry: GateStatusInfo | null; exit: GateStatusInfo | null }>({ entry: null, exit: null });
  const [health, setHealth] = useState<unknown>(null);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/history/detection?limit=10`, {
          headers: { 'X-Session-Id': localStorage.getItem('sessionId') || '' }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data as DetectionMessage[]);
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    }, 2000);

    const healthInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/camera/status`);
        const data = await res.json();
        if (data.cameras) {
          setGateStatus({
            entry: { status: data.cameras?.entry?.status || 'unknown', gate: 'ENTRY' },
            exit: { status: data.cameras?.exit?.status || 'unknown', gate: 'EXIT' }
          });
        }
      } catch {
        // Silent fail
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(healthInterval);
    };
  }, []);

  const getStatus = (gate: 'entry' | 'exit'): GateStatusInfo | null => {
    return gate === 'entry' ? gateStatus.entry : gateStatus.exit;
  };

  const getHealth = (): unknown => {
    return health;
  };

  return (
    <SocketContext.Provider value={{ 
      messages, 
      connected,
      getStatus,
      getHealth,
      gateStatus,
      health
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = (): SocketContextType => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
