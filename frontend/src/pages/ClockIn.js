import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, locationAPI } from '../services/api';
import { useQuery } from 'react-query';
import QRScanner from '../components/QRScanner';
import {
  ClockIcon,
  QrCodeIcon as QrcodeIcon,
  MapPinIcon as LocationMarkerIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ClockIn = () => {
  const { user } = useAuth();
  const [activeMethod, setActiveMethod] = useState('portal');
  const [location, setLocation] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Get current attendance status - USER-SPECIFIC CACHE KEY
  const { data: statusData, refetch: refetchStatus } = useQuery(
    ['currentAttendanceStatus', user?.employee_profile?.id],
    () => attendanceAPI.currentStatus(),
    {
      enabled: !!user?.employee_profile?.id,
      refetchInterval: 10000,
    }
  );

  // Get QR enforcement status - USER-SPECIFIC CACHE KEY
  const { data: qrEnforcementData } = useQuery(
    ['qrEnforcementStatus', user?.employee_profile?.id],
    () => attendanceAPI.qrEnforcementStatus(),
    {
      enabled: !!user?.employee_profile?.id,
      refetchInterval: 30000,
    }
  );

  // Get shift status - USER-SPECIFIC CACHE KEY
  const { data: shiftStatusData, refetch: refetchShiftStatus } = useQuery(
    ['shiftStatus', user?.employee_profile?.id],
    () => attendanceAPI.shiftStatus(),
    {
      enabled: !!user?.employee_profile?.id,
      refetchInterval: 30000,
    }
  );

  // Get locations for QR scanning
  const { data: locationsData } = useQuery('locations', locationAPI.list);

  const currentStatus = statusData?.data;
  const shiftStatus = shiftStatusData?.data || {};
  const locations = locationsData?.data?.results || locationsData?.results || [];
  const qrEnforcement = qrEnforcementData?.data || {};

  // Use shiftStatus as the primary source of truth since it's confirmed working
  // Fallback to currentStatus if shiftStatus is not yet loaded
  const isCurrentlyClockedIn = shiftStatus.is_clocked_in ?? (currentStatus?.is_clocked_in || false);

  // Safe checks for clock in/out availability
  // If shiftStatus is not loaded yet, default to false (disabled)
  const canClockIn = shiftStatus.can_clock_in === true;
  const canClockOut = shiftStatus.can_clock_out === true;

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Location access denied:', error);
        }
      );
    }
  }, []);

  const handleClockIn = async (locationId = null) => {
    setLoading(true);
    try {
      const clockInData = {
        method: activeMethod === 'qr' ? 'QR_CODE' : 'PORTAL',
        notes: notes || `Clock-in via ${activeMethod}`,
      };

      if (locationId) {
        clockInData.location_id = locationId;
      }

      if (location) {
        clockInData.latitude = location.latitude;
        clockInData.longitude = location.longitude;
      }

      await attendanceAPI.clockIn(clockInData);
      toast.success('Clocked in successfully!');
      setNotes('');
      setActiveMethod('portal'); // Close camera if open

      // CRITICAL FIX: Refetch BOTH status queries to update UI state
      await Promise.all([refetchStatus(), refetchShiftStatus()]);
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.requires_qr) {
        toast.error('You must use location QR code for clock-in');
        setActiveMethod('qr');
      } else if (errorData?.requires_shift) {
        toast.error('No scheduled shift found. You can only clock in during scheduled shifts or within 15 minutes before shift start.');
      } else {
        toast.error(errorData?.detail || errorData?.message || 'Clock-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const clockOutData = {
        method: activeMethod === 'qr' ? 'QR_CODE' : 'PORTAL',
        notes: notes || `Clock-out via ${activeMethod}`,
      };

      if (location) {
        clockOutData.latitude = location.latitude;
        clockOutData.longitude = location.longitude;
      }

      const response = await attendanceAPI.clockOut(clockOutData);
      const duration = response.data.duration_hours || 0;
      toast.success(`Clocked out successfully! Worked ${duration.toFixed(1)} hours.`);
      setNotes('');
      setActiveMethod('portal'); // Close camera if open

      // CRITICAL FIX: Refetch BOTH status queries to update UI state
      await Promise.all([refetchStatus(), refetchShiftStatus()]);
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData?.requires_qr) {
        toast.error('You must use location QR code for clock-out');
        setActiveMethod('qr');
      } else if (errorData?.requires_shift) {
        toast.error('No active scheduled shift found. You can only clock out during an active scheduled shift.');
      } else {
        toast.error(errorData?.detail || errorData?.message || 'Clock-out failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async (qrData) => {
    // SECURITY UPDATE: Use server-side validation for QR codes
    setLoading(true);
    try {
      const action = isCurrentlyClockedIn ? 'clock_out' : 'clock_in';
      const scanData = {
        qr_code: qrData,
        action: action,
        notes: notes
      };

      const response = await attendanceAPI.qrScan(scanData);

      toast.success(response.data.message || 'Scan successful');
      setNotes('');
      setActiveMethod('portal');

      // CRITICAL FIX: Refetch BOTH status queries to update UI state
      await Promise.all([refetchStatus(), refetchShiftStatus()]);
    } catch (error) {
      console.error('QR Scan error:', error);
      const errorData = error.response?.data;
      toast.error(errorData?.detail || errorData?.message || 'Invalid QR code');
      // Don't close the scanner immediately on error so user can try again
    } finally {
      setLoading(false);
    }
  };

  const handleQRError = (error) => {
    toast.error(`QR Scanner Error: ${error}`);
    setActiveMethod('portal');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="text-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Time Tracking</h1>
        <p className="text-sm md:text-base text-gray-600 mt-2">
          Current Status:
          <span className={`ml-2 font-medium ${isCurrentlyClockedIn ? 'text-green-600' : 'text-gray-600'
            }`}>
            {isCurrentlyClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
          </span>
        </p>
      </div>

      {/* QR Enforcement Notice - Mobile Responsive */}
      {qrEnforcement.requires_location_qr && qrEnforcement.qr_enforcement_type !== 'NONE' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4">
          <div className="flex items-start">
            <QrcodeIcon className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                QR Code Required
              </p>
              <p className="text-xs md:text-sm text-yellow-600 mt-1">
                {qrEnforcement.qr_enforcement_type === 'ALL_OPERATIONS'
                  ? 'You must scan a location QR code for all clock-in and clock-out operations'
                  : 'You must scan a location QR code for your first clock-in of the day'
                }
              </p>
              {qrEnforcement.requires_qr_for_clock_in && (
                <p className="text-xs md:text-sm text-yellow-600 mt-1 font-medium">
                  ⚠️ QR code required for next clock-in
                </p>
              )}
              {qrEnforcement.requires_qr_for_clock_out && isCurrentlyClockedIn && (
                <p className="text-xs md:text-sm text-yellow-600 mt-1 font-medium">
                  ⚠️ QR code required for clock-out
                </p>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Shift Information - Mobile Responsive */}
      {shiftStatus && (
        <div className="glass-card glass-fade-in p-4 md:p-6 mb-4 md:mb-6">
          <h2 className="text-base md:text-lg font-medium glass-text-primary mb-3 md:mb-4">Shift Information</h2>

          {shiftStatus.current_shift ? (
            <div className="flex items-center mb-4">
              <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Current Shift: {new Date(shiftStatus.current_shift.start_time).toLocaleTimeString()} - {new Date(shiftStatus.current_shift.end_time).toLocaleTimeString()}
                </p>
                {shiftStatus.current_shift.location && (
                  <p className="text-sm text-green-600 mt-1">
                    Location: {shiftStatus.current_shift.location}
                  </p>
                )}
              </div>
            </div>
          ) : shiftStatus.upcoming_shift ? (
            <div className="flex items-center mb-4">
              <ClockIcon className="h-5 w-5 text-yellow-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Upcoming Shift: {new Date(shiftStatus.upcoming_shift.start_time).toLocaleTimeString()} - {new Date(shiftStatus.upcoming_shift.end_time).toLocaleTimeString()}
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  Starts in {shiftStatus.upcoming_shift.minutes_until_start} minutes
                </p>
                {shiftStatus.upcoming_shift.location && (
                  <p className="text-sm text-yellow-600 mt-1">
                    Location: {shiftStatus.upcoming_shift.location}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center mb-4">
              <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  No scheduled shift found
                </p>
                <p className="text-sm text-red-600 mt-1">
                  You can only clock in during scheduled shifts or within 15 minutes before shift start
                </p>
              </div>
            </div>
          )}

          {/* Clock In/Out Eligibility Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className={`p-3 rounded-lg ${canClockIn ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm font-medium ${canClockIn ? 'text-green-800' : 'text-red-800'}`}>
                Clock In: {canClockIn ? 'Available' : 'Not Available'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${canClockOut ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm font-medium ${canClockOut ? 'text-green-800' : 'text-red-800'}`}>
                Clock Out: {canClockOut ? 'Available' : 'Not Available'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Method Selection - Mobile Responsive */}
      <div className="glass-card glass-fade-in p-4 md:p-6">
        <h2 className="text-base md:text-lg font-medium glass-text-primary mb-3 md:mb-4">Clock-In Method</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <button
            onClick={() => setActiveMethod('portal')}
            className={`p-4 border-2 rounded-lg text-left transition-all duration-300 ${activeMethod === 'portal'
              ? 'border-blue-400 glass-gradient-primary'
              : 'glass-button border-transparent hover:border-blue-300'
              }`}
          >
            <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-600 mb-2" />
            <h3 className="text-sm md:text-base font-medium glass-text-primary">Portal Clock-In</h3>
            <p className="text-xs md:text-sm glass-text-secondary">Simple button click</p>
          </button>

          <button
            onClick={() => setActiveMethod('qr')}
            className={`p-4 border-2 rounded-lg text-left transition-all duration-300 ${activeMethod === 'qr'
              ? 'border-blue-400 glass-gradient-primary'
              : 'glass-button border-transparent hover:border-blue-300'
              }`}
          >
            <QrcodeIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-600 mb-2" />
            <h3 className="text-sm md:text-base font-medium glass-text-primary">QR Code Scan</h3>
            <p className="text-xs md:text-sm glass-text-secondary">Scan location QR code</p>
          </button>
        </div>
      </div>

      {/* Notes Input - Mobile Responsive */}
      <div className="glass-card glass-fade-in p-4 md:p-6">
        <label htmlFor="notes" className="block text-sm font-medium glass-text-primary mb-2">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className="glass-input w-full placeholder-gray-400 glass-text-primary text-sm md:text-base"
          placeholder="Add any notes about your shift..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Location Status - Mobile Responsive */}
      {location && (
        <div className="glass-status-success p-3 md:p-4 rounded-lg">
          <div className="flex items-center">
            <LocationMarkerIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <p className="text-xs md:text-sm font-medium">
              Location detected and will be recorded
            </p>
          </div>
        </div>
      )}

      {/* Clock-In/Out Interface - Mobile Responsive */}
      <div className="glass-card glass-slide-up p-4 md:p-6">
        {activeMethod === 'portal' && (
          <div className="text-center">
            {isCurrentlyClockedIn ? (
              <div>
                <button
                  onClick={handleClockOut}
                  disabled={loading || qrEnforcement.requires_qr_for_clock_out || !canClockOut}
                  className={`w-full sm:w-auto inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 border border-transparent text-base md:text-lg font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${qrEnforcement.requires_qr_for_clock_out || !canClockOut
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <XCircleIcon className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                  )}
                  Clock Out
                </button>
                {qrEnforcement.requires_qr_for_clock_out && (
                  <p className="text-xs md:text-sm text-yellow-600 mt-2">
                    QR code required for clock-out. Switch to QR scanner.
                  </p>
                )}
                {!canClockOut && !qrEnforcement.requires_qr_for_clock_out && (
                  <p className="text-xs md:text-sm text-red-600 mt-2">
                    No active scheduled shift found for clock-out.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => handleClockIn()}
                  disabled={loading || qrEnforcement.requires_qr_for_clock_in || !canClockIn}
                  className={`w-full sm:w-auto inline-flex items-center justify-center px-6 md:px-8 py-3 md:py-4 border border-transparent text-base md:text-lg font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed ${qrEnforcement.requires_qr_for_clock_in || !canClockIn
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                    }`}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <CheckCircleIcon className="h-5 w-5 md:h-6 md:w-6 mr-2" />
                  )}
                  Clock In
                </button>
                {qrEnforcement.requires_qr_for_clock_in && (
                  <p className="text-xs md:text-sm text-yellow-600 mt-2">
                    QR code required for clock-in. Switch to QR scanner.
                  </p>
                )}
                {!canClockIn && !qrEnforcement.requires_qr_for_clock_in && (
                  <p className="text-xs md:text-sm text-red-600 mt-2">
                    No scheduled shift found for clock-in.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeMethod === 'qr' && (
          <div>
            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-4 text-center">
              Scan QR Code to Clock In
            </h3>
            <QRScanner
              onScan={handleQRScan}
              onError={handleQRError}
              isActive={activeMethod === 'qr'}
            />
            <div className="mt-4 text-center">
              <button
                onClick={() => setActiveMethod('portal')}
                className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
              >
                Switch to Portal Clock-In
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Available Locations - Mobile Responsive */}
      {locations.length > 0 && (
        <div className="glass-card-bright p-4 md:p-6 mb-6 md:mb-8">
          <h3 className="text-base md:text-lg font-medium glass-text-primary mb-3 md:mb-4">Available Locations</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {locations.map((loc) => (
              <div key={loc.id} className="glass-location-card p-3 md:p-4">
                <h4 className="text-sm md:text-base font-medium glass-text-primary">{loc.name}</h4>
                <p className="text-xs md:text-sm glass-text-secondary">{loc.description}</p>
                <p className="text-xs glass-text-muted mt-1">QR: {loc.qr_code_payload}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockIn;
