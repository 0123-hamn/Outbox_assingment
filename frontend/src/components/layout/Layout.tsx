import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Clock, Send, LogOut, Slack, BarChart3 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children: React.ReactNode; onComposeClick: () => void }> = ({
  children,
  onComposeClick,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    { name: 'Scheduled Emails', path: '/scheduled', icon: Clock },
    { name: 'Sent Emails', path: '/sent', icon: Send },
  ];

  return (
    <div className="flex h-screen bg-[#0B0F19] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800/80 bg-[#0E1322] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
              <span className="text-[10px] block text-emerald-400 font-semibold uppercase tracking-wider">Scheduler</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="p-4">
            <button
              onClick={onComposeClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-600/25 transition active:scale-[0.98]"
            >
              <Mail className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile and Bottom Actions */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-[#0E1322]/50 backdrop-blur px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-white capitalize">
              {location.pathname.replace('/', '') || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Bull Board Queues
            </a>
          </div>
        </header>

        {/* Page View */}
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
