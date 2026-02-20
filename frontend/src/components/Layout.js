import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import ErrorBoundary from './ErrorBoundary';
import {
  HomeIcon,
  ClockIcon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon as LogoutIcon,
  UserGroupIcon,
  UsersIcon,
  DocumentChartBarIcon as DocumentReportIcon,
  MapPinIcon,
  BellIcon,
  Bars3Icon as MenuIcon,
  XMarkIcon as XIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ClockIcon as ClockIconSolid,
  CalendarIcon as CalendarIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  ClipboardDocumentListIcon as ClipboardSolid,
} from '@heroicons/react/24/solid';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Employee bottom tabs (mobile only, non-admin) ──────────────────────────
  const employeeBottomTabs = [
    { name: 'Home', href: '/', Icon: HomeIcon, ActiveIcon: HomeIconSolid },
    { name: 'Clock', href: '/clock-in', Icon: ClockIcon, ActiveIcon: ClockIconSolid },
    { name: 'Schedule', href: '/schedule', Icon: CalendarIcon, ActiveIcon: CalendarIconSolid },
    { name: 'Leave', href: '/leave', Icon: ClipboardDocumentListIcon, ActiveIcon: ClipboardSolid },
    { name: 'Hours', href: '/time-tracking', Icon: ChartBarIcon, ActiveIcon: ChartBarIconSolid },
  ];

  // ── Desktop sidebar nav ────────────────────────────────────────────────────
  let sidebarNav = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Clock In/Out', href: '/clock-in', icon: ClockIcon },
    { name: 'Time Tracking', href: '/time-tracking', icon: ChartBarIcon },
    { name: 'Schedule', href: '/schedule', icon: CalendarIcon },
    { name: 'Leave Management', href: '/leave', icon: CalendarIcon },
  ];

  if (isAdmin) {
    sidebarNav = sidebarNav.filter(item =>
      !['Schedule', 'Leave Management', 'Time Tracking'].includes(item.name)
    );
    sidebarNav.push(
      { name: 'Admin Dashboard', href: '/admin', icon: UserGroupIcon },
      { name: 'Employee Status', href: '/employee-status', icon: ChartBarIcon },
      { name: 'Employee Management', href: '/employees', icon: UsersIcon },
      { name: 'Location Management', href: '/locations', icon: MapPinIcon },
      { name: 'Notification Management', href: '/notifications', icon: BellIcon },
      { name: 'Notification Settings', href: '/notification-settings', icon: CogIcon },
      { name: 'Admin Scheduling', href: '/admin/scheduling', icon: CalendarIcon },
      { name: 'Leave Approvals', href: '/admin/leave', icon: CalendarIcon },
      { name: 'Reports', href: '/reports', icon: DocumentReportIcon },
      { name: 'Webhooks', href: '/webhooks', icon: CogIcon },
      { name: 'Settings', href: '/settings', icon: CogIcon },
    );
  }

  const navWithActive = sidebarNav.map(item => ({
    ...item,
    current: location.pathname === item.href,
  }));

  const showBottomNav = !isAdmin;

  return (
    <div className="flex flex-col glass-gradient-dark overflow-hidden w-full" style={{ height: '100dvh', maxHeight: '-webkit-fill-available' }}>

      {/* ── Mobile drawer sidebar (admin only) ──────────────────────────── */}
      {isAdmin && (
        <>
          <div
            className={`fixed inset-0 flex z-50 md:hidden transition-opacity duration-300 ease-in-out ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
          >
            <div
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className={`relative flex-1 flex flex-col max-w-xs w-full glass-modal transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full glass-button focus:outline-none"
                  onClick={() => setSidebarOpen(false)}
                >
                  <XIcon className="h-6 w-6 text-white" />
                </button>
              </div>
              <div className="flex-1 h-0 pt-6 pb-4 overflow-y-auto">
                <div className="flex-shrink-0 flex items-center px-4 mb-2">
                  <h1 className="text-xl font-bold glass-text-primary">WorkSync</h1>
                </div>
                <nav className="mt-2 px-2 space-y-1">
                  {navWithActive.map(item => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${item.current ? 'glass-nav-item active' : 'glass-nav-item'
                        } group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg`}
                    >
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex-shrink-0 border-t border-white border-opacity-20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium glass-text-primary">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs glass-text-secondary">{user?.employee_profile?.employee_id}</p>
                  </div>
                  <button onClick={handleLogout} className="glass-button p-2 rounded-full ml-3">
                    <LogoutIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Horizontal row: desktop sidebar + main column ─────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col h-0 flex-1 glass-nav">
              <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                <div className="flex items-center flex-shrink-0 px-4">
                  <h1 className="text-xl font-bold glass-text-primary">WorkSync</h1>
                </div>
                <nav className="mt-5 flex-1 px-2 space-y-1">
                  {navWithActive.map(item => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${item.current ? 'glass-nav-item active' : 'glass-nav-item'
                        } group flex items-center px-2 py-2 text-sm font-medium`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex-shrink-0 border-t border-white border-opacity-20 p-4">
                <div className="flex items-center w-full">
                  <div className="flex-1">
                    <p className="text-sm font-medium glass-text-primary">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs glass-text-secondary">{user?.employee_profile?.employee_id}</p>
                  </div>
                  <button onClick={handleLogout} className="ml-3 flex-shrink-0 p-1 glass-button">
                    <LogoutIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content column ──────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ─ Header: sticky so it never scrolls away on mobile ─────────── */}
          <div className="sticky top-0 z-40 glass-nav flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Left: hamburger (admin mobile) or app name (employee mobile) */}
              <div className="md:hidden">
                {isAdmin ? (
                  <button
                    className="glass-button h-10 w-10 inline-flex items-center justify-center rounded-lg"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    <MenuIcon className="h-5 w-5" />
                  </button>
                ) : (
                  <span className="text-lg font-bold glass-text-primary tracking-tight">WorkSync</span>
                )}
              </div>

              {/* Desktop: empty spacer */}
              <div className="hidden md:block" />

              {/* Right: bell + user info/logout */}
              <div className="flex items-center space-x-2 md:space-x-4 text-gray-500">
                <NotificationBell />
                <div className="hidden md:flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium glass-text-primary">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs glass-text-secondary">{user?.employee_profile?.employee_id}</p>
                  </div>
                </div>
                {/* Logout visible on all screen sizes */}
                <button onClick={handleLogout} className="glass-button p-2 ml-1 rounded-full text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 flex-shrink-0" title="Logout">
                  <LogoutIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* ─ Scrollable page content ────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto focus:outline-none glass-main-bg relative z-0">
            {/* Add extra pb-24 padding to account for the fixed bottom nav on mobile */}
            <div className={`py-5 ${showBottomNav ? 'pb-24 md:pb-6' : 'pb-6'}`}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </div>
            </div>
          </main>

        </div>{/* end main column */}
      </div>{/* end horizontal row */}

      {/* ── Mobile bottom tab bar (employees only) ──────────────────────── */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bottom-nav-bar"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-stretch h-16">
            {employeeBottomTabs.map(tab => {
              const isActive = location.pathname === tab.href;
              const TabIcon = isActive ? tab.ActiveIcon : tab.Icon;
              return (
                <Link
                  key={tab.name}
                  to={tab.href}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors duration-150"
                  style={{ color: isActive ? '#2563eb' : '#6b7280' }}
                >
                  <TabIcon className={`h-6 w-6 transition-transform duration-150 ${isActive ? 'scale-110' : 'scale-100'}`} />
                  <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                    {tab.name}
                  </span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600"
                      style={{ position: 'absolute', bottom: 4 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
