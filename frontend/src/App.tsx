import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Stats from './pages/Stats';
import Guest from './pages/Guest';
import Control from './pages/Control';
import VehiclePassManagement from './pages/VehiclePassManagement';
import Cameras from './pages/Cameras';
import Registrations from './pages/Registrations';
import Residents from './pages/Residents';
import Notifications from './pages/Notifications';
import HeadApprovals from './pages/HeadApprovals';
import Messages from './pages/Messages';
import ResidentHome from './pages/ResidentHome';
import Landing from './pages/Landing';
import ActiveVehiclesSummary from './pages/ActiveVehiclesSummary';
import HouseholdVehicles from './pages/HouseholdVehicles';
import GuestVehicles from './pages/GuestVehicles';
import SessionTimeline from './pages/SessionTimeline';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { loading, hasAccess, user } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="detection" element={
          hasAccess('/app/detection') ? <Cameras /> : <Navigate to="/app" replace />
        } />
        <Route path="stats" element={
          hasAccess('/app/stats') ? <Stats /> : <Navigate to="/app" replace />
        } />
        <Route path="guest" element={
          hasAccess('/app/guest') ? <Guest /> : <Navigate to="/app" replace />
        } />
        <Route path="command" element={
          hasAccess('/app/command') ? <Control /> : <Navigate to="/app" replace />
        } />
        <Route path="vp-management" element={
          hasAccess('/app/vp-management') ? <VehiclePassManagement /> : <Navigate to="/app" replace />
        } />
        <Route path="registrations" element={
          hasAccess('/app/registrations') ? <Registrations /> : <Navigate to="/app" replace />
        } />
        <Route path="residents" element={
          hasAccess('/app/residents') ? <Residents /> : <Navigate to="/app" replace />
        } />
        <Route path="notifications" element={
          hasAccess('/app/notifications') ? <Notifications /> : <Navigate to="/app" replace />
        } />
        <Route path="messages" element={
          hasAccess('/app/messages') ? <Messages /> : <Navigate to="/app" replace />
        } />
        <Route path="head-approvals" element={
          hasAccess('/app/head-approvals') ? <HeadApprovals /> : <Navigate to="/app" replace />
        } />
        <Route path="my-household" element={
          hasAccess('/app/my-household') ? <ResidentHome /> : <Navigate to="/app" replace />
        } />
        <Route path="active-vehicles" element={
          hasAccess('/app/active-vehicles') ? <ActiveVehiclesSummary /> : <Navigate to="/app" replace />
        } />
        <Route path="active-vehicles/household" element={
          hasAccess('/app/active-vehicles') ? <HouseholdVehicles /> : <Navigate to="/app" replace />
        } />
        <Route path="active-vehicles/guests" element={
          hasAccess('/app/active-vehicles') ? <GuestVehicles /> : <Navigate to="/app" replace />
        } />
        <Route path="session-timeline" element={
          hasAccess('/app/session-timeline') ? <SessionTimeline /> : <Navigate to="/app" replace />
        } />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/:username" element={
          user?.role === 'admin' ? <Profile /> : <Navigate to="/app/profile" replace />
        } />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <SocketProvider>
              <AppRoutes />
            </SocketProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
