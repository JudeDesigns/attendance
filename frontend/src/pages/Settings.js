import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TimezoneSettings from '../components/TimezoneSettings';
import { toast } from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('timezone');

  const tabs = [
    { id: 'timezone', name: 'Timezone', icon: '🌍' },
    { id: 'profile', name: 'Profile', icon: '👤' },
  ];

  const handleTimezoneChange = (newTimezone) => {
    toast.success(`Timezone updated to ${newTimezone}`);
    // You can add additional logic here if needed
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-white/70">
            Manage your account preferences and application settings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${activeTab === tab.id
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
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
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                  <h2 className="text-xl font-semibold text-white mb-4">Timezone Configuration</h2>
                  <p className="text-white/70 mb-6">
                    Set your timezone to ensure accurate shift scheduling and time display.
                    This affects how times are displayed throughout the application.
                  </p>
                </div>
                <TimezoneSettings onTimezoneChange={handleTimezoneChange} />
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
                <p className="text-white/70 mb-6">
                  Update your personal information and preferences.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username || ''}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
