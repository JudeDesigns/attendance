import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import {
  HomeIcon,
  ClockIcon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon as LogoutIcon,
  Bars3Icon as MenuIcon,
  XMarkIcon as XIcon,
  UserGroupIcon,
  UsersIcon,
  DocumentChartBarIcon as DocumentReportIcon,
  MapPinIcon,
  BellIcon,


} from '@heroicons/react/24/outline';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle scroll effect for header transparency
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  let navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, current: location.pathname === '/' },
    { name: 'Clock In/Out', href: '/clock-in', icon: ClockIcon, current: location.pathname === '/clock-in' },
    { name: 'Time Tracking', href: '/time-tracking', icon: ChartBarIcon, current: location.pathname === '/time-tracking' },
    { name: 'Schedule', href: '/schedule', icon: CalendarIcon, current: location.pathname === '/schedule' },
    { name: 'Leave Management', href: '/leave', icon: CalendarIcon, current: location.pathname === '/leave' },
  ];

  // Add admin-only navigation items
  if (isAdmin) {
    // Keep Dashboard and Clock In/Out, but replace schedule, leave, and time tracking with admin versions
    navigation = navigation.filter(item => !['Schedule', 'Leave Management', 'Time Tracking'].includes(item.name));

    navigation.push(
      { name: 'Admin Dashboard', href: '/admin', icon: UserGroupIcon, current: location.pathname === '/admin' },
      { name: 'Employee Status', href: '/employee-status', icon: ChartBarIcon, current: location.pathname === '/employee-status' },
      { name: 'Employee Management', href: '/employees', icon: UsersIcon, current: location.pathname === '/employees' },
      { name: 'Location Management', href: '/locations', icon: MapPinIcon, current: location.pathname === '/locations' },

      // Employee QR Codes removed - individual employee QR codes no longer supported
      { name: 'Notification Management', href: '/notifications', icon: BellIcon, current: location.pathname === '/notifications' },
      { name: 'Notification Settings', href: '/notification-settings', icon: CogIcon, current: location.pathname === '/notification-settings' },
      { name: 'Admin Scheduling', href: '/admin/scheduling', icon: CalendarIcon, current: location.pathname === '/admin/scheduling' },
      { name: 'Leave Approvals', href: '/admin/leave', icon: CalendarIcon, current: location.pathname === '/admin/leave' },
      { name: 'Reports', href: '/reports', icon: DocumentReportIcon, current: location.pathname === '/reports' },
      { name: 'Webhooks', href: '/webhooks', icon: CogIcon, current: location.pathname === '/webhooks' },
      { name: 'Settings', href: '/settings', icon: CogIcon, current: location.pathname === '/settings' }
    );
  }



  return (
    <div className="h-screen flex overflow-hidden glass-gradient-dark">
      {/* Mobile sidebar - Higher z-index to appear above header */}
      <div className={`fixed inset-0 flex z-50 md:hidden transition-opacity duration-300 ease-in-out ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300 ease-in-out" onClick={() => setSidebarOpen(false)} />
        <div className={`relative flex-1 flex flex-col max-w-xs w-full glass-modal transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full glass-button focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-6 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <h1 className="text-xl font-bold glass-text-primary">WorkSync</h1>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    item.current
                      ? 'glass-nav-item active'
                      : 'glass-nav-item'
                  } group flex items-center px-2 py-2 text-base font-medium`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-4 h-6 w-6" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-base font-medium text-gray-700">{user?.first_name} {user?.last_name}</p>
                  <p className="text-sm font-medium text-gray-500">{user?.employee_profile?.employee_id}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="glass-button p-2 rounded-full ml-3"
                title="Logout"
              >
                <LogoutIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 glass-nav">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold glass-text-primary">WorkSync</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      item.current
                        ? 'glass-nav-item active'
                        : 'glass-nav-item'
                    } group flex items-center px-2 py-2 text-sm font-medium`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-white border-opacity-20 p-4">
              <div className="flex items-center w-full">
                <div className="flex-1">
                  <p className="text-sm font-medium glass-text-primary">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs font-medium glass-text-secondary">{user?.employee_profile?.employee_id}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-3 flex-shrink-0 p-1 glass-button"
                >
                  <LogoutIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className={`transition-all duration-300 relative z-40 ${
          isScrolled
            ? 'glass-header-transparent backdrop-blur-md'
            : 'glass-nav'
        }`}>
          <div className="flex items-center justify-between px-4 py-3 md:py-3">
            {/* Mobile menu button - Enhanced visibility */}
            <div className="md:hidden">
              <button
                className="glass-button mobile-hamburger-button h-10 w-10 inline-flex items-center justify-center rounded-lg transition-all duration-200"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Empty space for desktop - no title needed */}
            <div className="hidden md:block">
              {/* Removed duplicate WorkSync title */}
            </div>

            {/* Right side - Mobile vs Desktop layout */}
            <div className="flex items-center">
              {/* Mobile: Only notification bell */}
              <div className="md:hidden">
                <NotificationBell />
              </div>

              {/* Desktop: Full layout with user info */}
              <div className="hidden md:flex md:items-center md:space-x-4">
                <NotificationBell />

                {/* User info - Desktop only */}
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-sm font-medium glass-text-primary">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs glass-text-secondary">{user?.employee_profile?.employee_id}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="glass-button p-2 rounded-full"
                    title="Logout"
                  >
                    <LogoutIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative z-10 overflow-y-auto focus:outline-none glass-main-bg">
          <div className="py-6 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
