import React, { useState, useEffect } from 'react';
import { coreAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const TimezoneSettings = ({ onTimezoneChange }) => {
  const [timezones, setTimezones] = useState([]);
  const [currentTimezone, setCurrentTimezone] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [timeInfo, setTimeInfo] = useState(null);

  useEffect(() => {
    fetchTimezones();
    fetchTimeInfo();
  }, []);

  const fetchTimezones = async () => {
    try {
      const response = await coreAPI.getTimezones();
      if (response?.data?.timezones) {
        setTimezones(response.data.timezones);
      }
      if (response?.data?.current_user_timezone) {
        setCurrentTimezone(response.data.current_user_timezone);
      }
    } catch (error) {
      console.error('Error fetching timezones:', error);
      toast.error('Failed to load timezones');
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeInfo = async () => {
    try {
      const response = await coreAPI.getCurrentTimeInfo();
      if (response?.data) {
        setTimeInfo(response.data);
      }
    } catch (error) {
      console.error('Error fetching time info:', error);
    }
  };

  const handleTimezoneChange = async (newTimezone) => {
    if (newTimezone === currentTimezone) return;

    setUpdating(true);
    try {
      await coreAPI.updateUserTimezone(newTimezone);
      setCurrentTimezone(newTimezone);
      toast.success('Timezone updated successfully');

      // Refresh time info
      await fetchTimeInfo();

      // Notify parent component
      if (onTimezoneChange) {
        onTimezoneChange(newTimezone);
      }
    } catch (error) {
      console.error('Error updating timezone:', error);
      toast.error('Failed to update timezone');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
        <div className="animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/4 mb-4"></div>
          <div className="h-10 bg-white/20 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
      <h3 className="text-lg font-semibold text-white mb-4">Timezone Settings</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Select Your Timezone
          </label>
          <select
            value={currentTimezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            disabled={updating}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            {Array.isArray(timezones) && timezones.map(([value, label]) => (
              <option key={value} value={value} className="bg-gray-800 text-white">
                {label}
              </option>
            ))}
          </select>
        </div>

        {timeInfo && (
          <div className="bg-white/5 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-white/80">Current Time Information</h4>
            <div className="text-sm text-white/70 space-y-1">
              <div>
                <span className="font-medium">Your Local Time:</span> {timeInfo.formatted_time}
              </div>
              <div>
                <span className="font-medium">UTC Time:</span> {new Date(timeInfo.utc_time).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Timezone:</span> {timeInfo.user_timezone}
              </div>
              <div>
                <span className="font-medium">Offset:</span> {timeInfo.timezone_offset}
              </div>
            </div>
          </div>
        )}

        {updating && (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span className="ml-2 text-sm text-white/70">Updating timezone...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimezoneSettings;
