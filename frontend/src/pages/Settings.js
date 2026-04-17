import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, notificationAPI } from '../services/api';
import TimezoneSettings from '../components/TimezoneSettings';
import { toast } from 'react-hot-toast';

const Settings = () => {
  const { user, isAdmin, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('timezone');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Company / Payroll settings state (admin only)
  const [companySettings, setCompanySettings] = useState({
    regular_rate_multiplier: '1.00',
    overtime_8_multiplier: '1.50',
    overtime_12_multiplier: '2.00',
    overtime_alert_email: '',
    stuck_clockin_alert_email: '',
    driver_activity_alert_email: '',
    missed_clockout_hours: '2.0',
  });

  // Fetch company settings
  useQuery(
    'companySettings',
    async () => {
      const response = await notificationAPI.getCompanySettings();
      return response.data;
    },
    {
      enabled: hasPermission('manage_payroll_settings') || hasPermission('manage_alert_settings'),
      onSuccess: (data) => {
        if (data) {
          setCompanySettings({
            regular_rate_multiplier: data.regular_rate_multiplier || '1.00',
            overtime_8_multiplier: data.overtime_8_multiplier || '1.50',
            overtime_12_multiplier: data.overtime_12_multiplier || '2.00',
            overtime_alert_email: data.overtime_alert_email || '',
            stuck_clockin_alert_email: data.stuck_clockin_alert_email || '',
            driver_activity_alert_email: data.driver_activity_alert_email || '',
            missed_clockout_hours: data.missed_clockout_hours || '2.0',
          });
        }
      },
      retry: false,
    }
  );

  const saveCompanySettingsMutation = useMutation(
    async (data) => notificationAPI.updateCompanySettings(data),
    {
      onSuccess: () => toast.success('Payroll & alert settings saved!'),
      onError: (error) => toast.error(error.response?.data?.detail || 'Failed to save settings'),
    }
  );

  const handleCompanySettingsChange = (field, value) => {
    setCompanySettings(prev => ({ ...prev, [field]: value }));
  };

  const baseTabs = [
    { id: 'timezone', name: 'Timezone', icon: '🌍' },
    { id: 'profile', name: 'Profile', icon: '👤' },
    { id: 'security', name: 'Security', icon: '🔒' },
  ];

  const tabs = [...baseTabs];
  if (hasPermission('manage_payroll_settings')) {
    tabs.push({ id: 'payroll', name: 'Payroll', icon: '💰' });
  }
  if (hasPermission('manage_alert_settings')) {
    tabs.push({ id: 'alerts', name: 'Alerts', icon: '🔔' });
  }

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

          {activeTab === 'payroll' && hasPermission('manage_payroll_settings') && (
            <div className="glass-card p-6">
              <h2 className="text-xl font-semibold glass-text-primary mb-2">Overtime Rate Multipliers</h2>
              <p className="glass-text-secondary text-sm mb-6">
                Configure the pay multipliers used when calculating overtime in CSV exports.
                For example, 1.50 means time-and-a-half.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Regular Hours (≤8h)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={companySettings.regular_rate_multiplier}
                    onChange={(e) => handleCompanySettingsChange('regular_rate_multiplier', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 1.00 (standard rate)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Over 8 Hours
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={companySettings.overtime_8_multiplier}
                    onChange={(e) => handleCompanySettingsChange('overtime_8_multiplier', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 1.50 (time-and-a-half)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Over 12 Hours
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={companySettings.overtime_12_multiplier}
                    onChange={(e) => handleCompanySettingsChange('overtime_12_multiplier', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 2.00 (double time)</p>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => saveCompanySettingsMutation.mutate(companySettings)}
                  disabled={saveCompanySettingsMutation.isLoading}
                  className="uber-button-primary disabled:opacity-50"
                >
                  {saveCompanySettingsMutation.isLoading ? 'Saving...' : 'Save Payroll Settings'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && hasPermission('manage_alert_settings') && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <h2 className="text-xl font-semibold glass-text-primary mb-2">Alert Email Recipients</h2>
                <p className="glass-text-secondary text-sm mb-6">
                  Set the email addresses that should receive specific alerts.
                  Leave blank to only notify admin users in the app.
                </p>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overtime Alert Email
                    </label>
                    <input
                      type="email"
                      value={companySettings.overtime_alert_email}
                      onChange={(e) => handleCompanySettingsChange('overtime_alert_email', e.target.value)}
                      placeholder="manager@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">Receives an email when any employee works overtime</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stuck Clock-In Alert Email
                    </label>
                    <input
                      type="email"
                      value={companySettings.stuck_clockin_alert_email}
                      onChange={(e) => handleCompanySettingsChange('stuck_clockin_alert_email', e.target.value)}
                      placeholder="supervisor@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">Receives an email when an employee stays clocked in past their shift</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Driver Activity Alert Email
                    </label>
                    <input
                      type="email"
                      value={companySettings.driver_activity_alert_email}
                      onChange={(e) => handleCompanySettingsChange('driver_activity_alert_email', e.target.value)}
                      placeholder="dispatch@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1">Receives all Driver clock-ins, clock-outs, breaks taken, and break waivers</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6">
                <h2 className="text-xl font-semibold glass-text-primary mb-2">Missed Clock-Out Detection</h2>
                <p className="glass-text-secondary text-sm mb-6">
                  How many hours after a shift ends before sending an alert that the employee hasn&apos;t clocked out.
                </p>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hours After Shift End
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={companySettings.missed_clockout_hours}
                    onChange={(e) => handleCompanySettingsChange('missed_clockout_hours', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 2.0 hours</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveCompanySettingsMutation.mutate(companySettings)}
                  disabled={saveCompanySettingsMutation.isLoading}
                  className="uber-button-primary disabled:opacity-50"
                >
                  {saveCompanySettingsMutation.isLoading ? 'Saving...' : 'Save Alert Settings'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
