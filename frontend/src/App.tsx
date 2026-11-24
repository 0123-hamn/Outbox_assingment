import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { ScheduledEmails } from './pages/ScheduledEmails';
import { SentEmails } from './pages/SentEmails';
import { Login } from './pages/Login';
import { ComposeModal } from './components/emails/ComposeModal';
import { useQueryClient } from '@tanstack/react-query';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const queryClient = useQueryClient();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    );
  }

  const handleScheduleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduledEmails'] });
    queryClient.invalidateQueries({ queryKey: ['emailStats'] });
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />

        <Route
          path="/dashboard"
          element={
            user ? (
              <Layout onComposeClick={() => setIsComposeOpen(true)}>
                <Dashboard onComposeClick={() => setIsComposeOpen(true)} />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/scheduled"
          element={
            user ? (
              <Layout onComposeClick={() => setIsComposeOpen(true)}>
                <ScheduledEmails />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/sent"
          element={
            user ? (
              <Layout onComposeClick={() => setIsComposeOpen(true)}>
                <SentEmails />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
      </Routes>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleScheduleSuccess}
      />
    </>
  );
};
