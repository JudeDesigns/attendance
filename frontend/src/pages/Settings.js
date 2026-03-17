import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import TimezoneSettings from '../components/TimezoneSettings';
import { toast } from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('timezone');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const tabs = [
    { id: 'timezone', name: 'Timezone', icon: '🌍' },
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'security', name: 'Security', icon: '🔒' },
  ];

  const handleTimezoneChange = (newTimezone) => {
    toast.success(`Timezone updated to ${newTimezone}`);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    try {
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <h1 className="text-2xl font-bold glass-text-primary">Settings</h1>
        <p className="mt-2 text-sm glass-text-secondary">
          Manage your account preferences and application settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="glass-card p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${activeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-medium">{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'timezone' && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <h2 className="text-xl font-semibold glass-text-primary mb-4">Timezone Configuration</h2>
                <p className="glass-text-secondary text-sm mb-6">
                  Set your timezone to ensure accurate shift scheduling and time display.
                  This affects how times are displayed throughout the application.
                </p>
              </div>
              <TimezoneSettings onTimezoneChange={handleTimezoneChange} />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold glass-text-primary mb-4">Profile Information</h2>
              <p className="glass-text-secondary text-sm mb-6">
                Update your personal information and preferences.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username || ''}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold glass-text-primary mb-4">Change Password</h2>
              <p className="glass-text-secondary text-sm mb-6">
                Update your account password. You&apos;ll need to enter your current password first.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Enter new password (min 8 characters)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full uber-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {passwordLoading ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
