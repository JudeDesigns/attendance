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

  // GPS status tracking
  const [gpsStatus, setGpsStatus] = useState('pending'); // 'pending' | 'granted' | 'denied' | 'unavailable'

  // Request GPS coordinates
  const requestGPS = (silent = false) => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        if (!silent) toast.error('📍 Geolocation is not supported by your browser.', { duration: 5000 });
        setGpsStatus('unavailable');
        resolve(null);
        return;
      }

      setGpsStatus('pending');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(coords);
          setGpsStatus('granted');
          resolve(coords);
        },
        (error) => {
          console.warn('GPS Error:', error.code, error.message);
          if (error.code === 1) {
            // PERMISSION_DENIED
            setGpsStatus('denied');
            if (!silent) toast.error('📍 Location permission denied. Please tap the lock icon in your browser address bar → allow Location.', { duration: 8000 });
          } else if (error.code === 2) {
            // POSITION_UNAVAILABLE
            setGpsStatus('unavailable');
            if (!silent) toast.error('📍 Could not determine your location. Make sure Location/GPS is turned ON in your device settings.', { duration: 6000 });
          } else if (error.code === 3) {
            // TIMEOUT - silently fall back, don't spam the user
            setGpsStatus('unavailable');
          }
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  // Get current location on page load - silently, no error toasts
  useEffect(() => {
    requestGPS(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Re-request GPS before each QR scan to ensure fresh coordinates
      const freshCoords = await requestGPS();

      if (!freshCoords && !location) {
        toast.error('📍 Location access is required for QR clock-in. Please enable location in your browser settings and try again.', { duration: 6000 });
        setLoading(false);
        return;
      }

      const action = isCurrentlyClockedIn ? 'clock_out' : 'clock_in';
      const scanData = {
        qr_code: qrData.trim(),
        action: action,
        notes: notes,
        latitude: freshCoords?.latitude || location?.latitude || null,
        longitude: freshCoords?.longitude || location?.longitude || null,
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

      // Extract the most specific error message from DRF response
      let errorMsg = 'QR scan failed';
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = Array.isArray(errorData.detail) ? errorData.detail[0] : errorData.detail;
        } else if (errorData.gps) {
          errorMsg = Array.isArray(errorData.gps) ? errorData.gps[0] : errorData.gps;
        } else if (errorData.qr_code) {
          errorMsg = Array.isArray(errorData.qr_code) ? errorData.qr_code[0] : errorData.qr_code;
        } else if (errorData.non_field_errors) {
          errorMsg = Array.isArray(errorData.non_field_errors) ? errorData.non_field_errors[0] : errorData.non_field_errors;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      }

      // Show with location pin for GPS/location-related errors
      const isLocationError = errorMsg.toLowerCase().includes('gps') || errorMsg.toLowerCase().includes('location') || errorMsg.toLowerCase().includes('within') || errorMsg.toLowerCase().includes('geofence');
      toast.error(isLocationError ? `📍 ${errorMsg}` : errorMsg, { duration: isLocationError ? 8000 : 5000 });
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
    <div className="max-w-lg mx-auto space-y-4">

      {/* ── Page Title ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clock In / Out</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Status:&nbsp;
          <span className={`font-semibold ${isCurrentlyClockedIn ? 'text-emerald-600' : 'text-gray-600'}`}>
            {isCurrentlyClockedIn ? 'Clocked In' : 'Clocked Out'}
          </span>
        </p>
      </div>

      {/* ── QR Enforcement banner ────────────────────────────────────── */}
      {qrEnforcement.requires_location_qr && qrEnforcement.qr_enforcement_type !== 'NONE' && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <QrcodeIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">QR Code Required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {qrEnforcement.qr_enforcement_type === 'ALL_OPERATIONS'
                ? 'Scan a location QR for all clock-in/out'
                : 'Scan a location QR for your first clock-in today'}
            </p>
          </div>
        </div>
      )}

      {/* ── Shift info ───────────────────────────────────────────────── */}
      {shiftStatus && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${shiftStatus.current_shift
          ? 'bg-green-50 border-green-200'
          : shiftStatus.upcoming_shift
            ? 'bg-amber-50 border-amber-200'
            : 'bg-red-50 border-red-200'
          }`}>
          {shiftStatus.current_shift
            ? <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
            : shiftStatus.upcoming_shift
              ? <ClockIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
              : <XCircleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />}
          <div className="text-sm">
            {shiftStatus.current_shift ? (
              <>
                <p className="font-semibold text-green-800">Active shift</p>
                <p className="text-green-700">
                  {new Date(shiftStatus.current_shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {new Date(shiftStatus.current_shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {shiftStatus.current_shift.location && ` · ${shiftStatus.current_shift.location}`}
                </p>
              </>
            ) : shiftStatus.upcoming_shift ? (
              <>
                <p className="font-semibold text-amber-800">Upcoming shift</p>
                <p className="text-amber-700">
                  Starts in {shiftStatus.upcoming_shift.minutes_until_start} min
                  {shiftStatus.upcoming_shift.location && ` · ${shiftStatus.upcoming_shift.location}`}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-red-800">No scheduled shift</p>
                <p className="text-red-700 text-xs">Clock-in only available within 15 min of shift start</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Method segmented control ─────────────────────────────────── */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveMethod('portal')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeMethod === 'portal'
            ? 'bg-white shadow text-gray-900'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ClockIcon className="h-4 w-4" />
          Portal
        </button>
        <button
          onClick={() => { setActiveMethod('qr'); requestGPS(true); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeMethod === 'qr'
            ? 'bg-white shadow text-gray-900'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <QrcodeIcon className="h-4 w-4" />
          QR Scan
        </button>
      </div>

      {/* ── Portal mode ──────────────────────────────────────────────── */}
      {activeMethod === 'portal' && (
        <div className="glass-card rounded-2xl p-6 text-center space-y-4">
          {isCurrentlyClockedIn ? (
            <>
              <button
                onClick={handleClockOut}
                disabled={loading || !canClockOut || qrEnforcement.requires_qr_for_clock_out}
                className="w-full flex items-center justify-center gap-3 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:bg-gray-300 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg transition-all duration-150 disabled:cursor-not-allowed"
              >
                {loading
                  ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  : <XCircleIcon className="h-6 w-6" />}
                Clock Out
              </button>
              {qrEnforcement.requires_qr_for_clock_out && (
                <p className="text-xs text-amber-600">⚠️ QR code required — switch to QR Scan</p>
              )}
              {!canClockOut && !qrEnforcement.requires_qr_for_clock_out && (
                <p className="text-xs text-red-500">No active scheduled shift for clock-out</p>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => handleClockIn()}
                disabled={loading || !canClockIn || qrEnforcement.requires_qr_for_clock_in}
                className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg transition-all duration-150 disabled:cursor-not-allowed"
              >
                {loading
                  ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  : <CheckCircleIcon className="h-6 w-6" />}
                Clock In
              </button>
              {qrEnforcement.requires_qr_for_clock_in && (
                <p className="text-xs text-amber-600">⚠️ QR code required — switch to QR Scan</p>
              )}
              {!canClockIn && !qrEnforcement.requires_qr_for_clock_in && (
                <p className="text-xs text-red-500">No scheduled shift available for clock-in</p>
              )}
            </>
          )}

          {/* Location detected indicator */}
          {location && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600">
              <LocationMarkerIcon className="h-4 w-4" />
              Location detected
            </div>
          )}
        </div>
      )}

      {/* ── QR Scanner mode ──────────────────────────────────────────── */}
      {activeMethod === 'qr' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 pb-2 text-center">
            <p className="text-sm font-medium text-gray-700">
              Point camera at the location QR code
            </p>
          </div>
          <QRScanner
            onScan={handleQRScan}
            onError={handleQRError}
            isActive={activeMethod === 'qr'}
            onActivate={() => requestGPS(true)}
          />
          <div className="p-4 pt-2 text-center">
            <button
              onClick={() => setActiveMethod('portal')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Portal
            </button>
          </div>
        </div>
      )}

      {/* ── Notes (collapsible) ──────────────────────────────────────── */}
      <details className="glass-card rounded-2xl overflow-hidden">
        <summary className="px-5 py-3.5 cursor-pointer text-sm font-medium text-gray-600 select-none list-none flex items-center justify-between">
          <span>Add a note (optional)</span>
          <span className="text-gray-400 text-xs">tap to expand</span>
        </summary>
        <div className="px-5 pb-4">
          <textarea
            rows={3}
            className="glass-input w-full text-sm placeholder-gray-400"
            placeholder="Add notes about your shift…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </details>

      {/* ── Available Locations ──────────────────────────────────────── */}
      {locations.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">Locations</p>
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                {loc.description && <p className="text-xs text-gray-500">{loc.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};


export default ClockIn;
