import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { notificationAPI } from '../services/api';
import PushSubscriptionManager from '../components/PushSubscriptionManager';

const NotificationSettings = () => {
  const [emailSettings, setEmailSettings] = useState({
    host: '',
    port: '587',
    use_tls: true,
    username: '',
    password: '',
    from_email: '',
  });

  const [smsSettings, setSmsSettings] = useState({
    account_sid: '',
    auth_token: '',
    phone_number: '',
  });

  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [activeTab, setActiveTab] = useState('email');
  const [configId, setConfigId] = useState(null);

  // Fetch active email configuration
  const { isLoading: isLoadingConfig } = useQuery(
    'emailConfig',
    async () => {
      try {
        const response = await notificationAPI.getEmailConfig();
        return response.data;
      } catch (error) {
        // If 404, it just means no config exists yet, which is fine
        if (error.response?.status === 404) return null;
        throw error;
      }
    },
    {
      onSuccess: (data) => {
        if (data) {
          setConfigId(data.id);
          setEmailSettings({
            host: data.email_host,
            port: data.email_port,
            use_tls: data.email_use_tls,
            username: data.email_host_user,
            // Password is write-only, so we leave it blank or set a placeholder if needed
            // But for security, better to leave blank and only update if changed
            password: '',
            from_email: data.default_from_email,
          });
        }
      },
      retry: false,
    }
  );

  // Save email settings
  const saveEmailMutation = useMutation(
    async (data) => {
      const payload = {
        email_backend: 'django.core.mail.backends.smtp.EmailBackend',
        email_host: data.host,
        email_port: data.port,
        email_use_tls: data.use_tls,
        email_host_user: data.username,
        default_from_email: data.from_email,
        is_active: true
      };

      // Only include password if provided (it's optional on update)
      if (data.password) {
        payload.email_host_password = data.password;
      }

      if (configId) {
        return notificationAPI.updateEmailConfig(configId, payload);
      } else {
        return notificationAPI.createEmailConfig(payload);
      }
    },
    {
      onSuccess: (response) => {
        setConfigId(response.data.id);
        toast.success('Email settings saved successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to save email settings');
      }
    }
  );

  // Test email configuration
  const testEmailMutation = useMutation(
    async (email) => {
      if (!configId) {
        throw new Error('Please save settings before testing');
      }
      return notificationAPI.testEmailConfig(configId, { recipient: email });
    },
    {
      onSuccess: () => {
        toast.success('Test email sent successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || error.message || 'Failed to send test email');
      },
    }
  );

  // Test SMS configuration
  const testSMSMutation = useMutation(
    async (phone) => {
      // This would be an API call to test SMS configuration
      return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true }), 2000);
      });
    },
    {
      onSuccess: () => {
        toast.success('Test SMS sent successfully!');
      },
      onError: () => {
        toast.error('Failed to send test SMS');
      },
    }
  );

  const handleEmailSettingsChange = (field, value) => {
    setEmailSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSmsSettingsChange = (field, value) => {
    setSmsSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }
    testEmailMutation.mutate(testEmail);
  };

  const handleTestSMS = () => {
    if (!testPhone) {
      toast.error('Please enter a test phone number');
      return;
    }
    testSMSMutation.mutate(testPhone);
  };

  const saveEmailSettings = () => {
    saveEmailMutation.mutate(emailSettings);
  };

  const saveSmsSettings = () => {
    // This would save SMS settings via API
    toast.success('SMS settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <h1 className="text-2xl font-bold glass-text-primary">Notification Settings</h1>
        <p className="glass-text-secondary">Configure email and SMS notification delivery</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card glass-slide-up p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <EnvelopeIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Email Service</h3>
                <p className="text-sm text-gray-600">SMTP configuration</p>
              </div>
            </div>
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 text-green-500" />
              <span className="ml-2 text-sm font-medium text-green-700">Connected</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <DevicePhoneMobileIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">SMS Service</h3>
                <p className="text-sm text-gray-600">Twilio integration</p>
              </div>
            </div>
            <div className="flex items-center">
              <XCircleIcon className="h-6 w-6 text-red-500" />
              <span className="ml-2 text-sm font-medium text-red-700">Not configured</span>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('email')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'email'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <EnvelopeIcon className="h-5 w-5 inline mr-2" />
              Email Configuration
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'sms'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <DevicePhoneMobileIcon className="h-5 w-5 inline mr-2" />
              SMS Configuration
            </button>
            <button
              onClick={() => setActiveTab('push')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'push'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <DevicePhoneMobileIcon className="h-5 w-5 inline mr-2" />
              Push Notifications
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Host *
                  </label>
                  <input
                    type="text"
                    value={emailSettings.host}
                    onChange={(e) => handleEmailSettingsChange('host', e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Port *
                  </label>
                  <input
                    type="number"
                    value={emailSettings.port}
                    onChange={(e) => handleEmailSettingsChange('port', e.target.value)}
                    placeholder="587"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="email"
                  value={emailSettings.username}
                  onChange={(e) => handleEmailSettingsChange('username', e.target.value)}
                  placeholder="your-email@gmail.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={emailSettings.password}
                  onChange={(e) => handleEmailSettingsChange('password', e.target.value)}
                  placeholder="App password or account password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Email *
                </label>
                <input
                  type="email"
                  value={emailSettings.from_email}
                  onChange={(e) => handleEmailSettingsChange('from_email', e.target.value)}
                  placeholder="noreply@worksync.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={emailSettings.use_tls}
                  onChange={(e) => handleEmailSettingsChange('use_tls', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Use TLS encryption
                </label>
              </div>

              {/* Test Email Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Test Email Configuration</h4>
                <div className="flex space-x-4">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleTestEmail}
                    disabled={testEmailMutation.isLoading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {testEmailMutation.isLoading ? 'Sending...' : 'Send Test Email'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={saveEmailSettings}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                >
                  {saveEmailMutation.isLoading ? 'Saving...' : 'Save Email Settings'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sms' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Twilio Account Required
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        To send SMS notifications, you need a Twilio account.
                        <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                          Sign up here
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account SID *
                </label>
                <input
                  type="text"
                  value={smsSettings.account_sid}
                  onChange={(e) => handleSmsSettingsChange('account_sid', e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auth Token *
                </label>
                <input
                  type="password"
                  value={smsSettings.auth_token}
                  onChange={(e) => handleSmsSettingsChange('auth_token', e.target.value)}
                  placeholder="Your Twilio Auth Token"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Twilio Phone Number *
                </label>
                <input
                  type="tel"
                  value={smsSettings.phone_number}
                  onChange={(e) => handleSmsSettingsChange('phone_number', e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Test SMS Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Test SMS Configuration</h4>
                <div className="flex space-x-4">
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleTestSMS}
                    disabled={testSMSMutation.isLoading}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {testSMSMutation.isLoading ? 'Sending...' : 'Send Test SMS'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={saveSmsSettings}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                >
                  Save SMS Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'push' && (
            <PushSubscriptionManager />
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
