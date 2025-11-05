import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { attendanceAPI } from '../services/api';

const StuckClockInAlert = ({ isAdmin = false }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [forceClockoutModal, setForceClockoutModal] = useState(false);
  const [clockoutTime, setClockoutTime] = useState('');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  // Get stuck clock-ins data (admin only)
  const { data: stuckData, refetch } = useQuery(
    'stuckClockIns',
    () => attendanceAPI.get('/breaks/stuck_clockins/'),
    {
      enabled: isAdmin,
      refetchInterval: 300000, // Check every 5 minutes
      retry: false,
      staleTime: 60000, // Consider data stale after 1 minute
      refetchOnWindowFocus: true, // Refetch when window gains focus
    }
  );

  // Force clock-out mutation
  const forceClockoutMutation = useMutation(
    (data) => attendanceAPI.post('/breaks/force_clockout/', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('stuckClockIns');
        queryClient.invalidateQueries('timeLogsList');
        setForceClockoutModal(false);
        setSelectedEmployee(null);
        setClockoutTime('');
        setReason('');
      }
    }
  );

  // Set default clockout time when modal opens
  useEffect(() => {
    if (forceClockoutModal && selectedEmployee) {
      // Default to current time
      const now = new Date();
      const isoString = now.toISOString().slice(0, 16); // Format for datetime-local input
      setClockoutTime(isoString);
    }
  }, [forceClockoutModal, selectedEmployee]);

  const handleForceClockout = () => {
    if (!selectedEmployee || !clockoutTime) return;

    forceClockoutMutation.mutate({
      employee_id: selectedEmployee.employee_id,
      clockout_time: new Date(clockoutTime).toISOString(),
      reason: reason || 'Admin correction for stuck clock-in'
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'CRITICAL_AUTO':
        return 'text-red-800 bg-red-100 border-red-300';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity) => {
    if (severity === 'CRITICAL' || severity === 'CRITICAL_AUTO') {
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    }
    return <ClockIcon className="h-5 w-5 text-yellow-500" />;
  };

  // Don't show if not admin or no stuck clock-ins
  if (!isAdmin || !stuckData || typeof stuckData.total_stuck !== 'number' || stuckData.total_stuck === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {/* Summary Alert */}
      <div className="glass-status-warning p-6 rounded-lg glass-fade-in">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 mt-1 mr-3" />
          <div className="flex-1">
            <h3 className="text-lg font-medium glass-text-primary mb-2">
              Stuck Clock-In Alert
            </h3>
            <p className="glass-text-secondary mb-3">
              {stuckData?.total_stuck || 0} employee{(stuckData?.total_stuck || 0) !== 1 ? 's' : ''}
              {(stuckData?.total_stuck || 0) === 1 ? ' has' : ' have'} been clocked in for extended periods.
            </p>

            <div className="flex flex-wrap gap-4 text-sm glass-text-secondary mb-3">
              <span>⚠️ Warning: {stuckData?.warning_level || 0}</span>
              <span>🚨 Critical: {stuckData?.critical_level || 0}</span>
              <span>🔧 Auto Clock-Out Needed: {stuckData?.auto_clockout_needed || 0}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="glass-button text-orange-600 hover:text-orange-700 font-semibold"
              >
                {showDetails ? 'Hide Details' : 'View Details'}
              </button>
              <button
                onClick={() => refetch()}
                className="glass-button glass-text-secondary hover:glass-text-primary font-semibold"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed List */}
      {showDetails && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="text-lg font-medium text-gray-900">Stuck Clock-In Details</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {(stuckData?.stuck_employees || []).map((employee, index) => (
              <div key={index} className={`p-4 ${getSeverityColor(employee?.severity)} border-l-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getSeverityIcon(employee?.severity)}
                    <div className="ml-3">
                      <div className="flex items-center">
                        <UserIcon className="h-4 w-4 mr-1" />
                        <span className="font-medium">
                          {employee?.employee_name || 'Unknown'} ({employee?.employee_id || 'N/A'})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Clocked in for:</span> {employee?.hours_clocked_in || 0} hours
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Since:</span> {employee?.clock_in_time ? new Date(employee.clock_in_time).toLocaleString() : 'Unknown'}
                      </div>
                      <div className="text-sm mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          employee?.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                          employee?.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          'bg-red-200 text-red-900'
                        }`}>
                          {employee?.severity || 'UNKNOWN'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setForceClockoutModal(true);
                    }}
                    className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm"
                  >
                    Force Clock-Out
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Force Clock-Out Modal */}
      {forceClockoutModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Force Clock-Out</h3>
              <button
                onClick={() => setForceClockoutModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                <strong>Employee:</strong> {selectedEmployee.employee_name} ({selectedEmployee.employee_id})
              </p>
              <p className="text-gray-600 mb-2">
                <strong>Clocked in for:</strong> {selectedEmployee.hours_clocked_in} hours
              </p>
              <p className="text-gray-600 mb-4">
                <strong>Since:</strong> {new Date(selectedEmployee.clock_in_time).toLocaleString()}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clock-Out Time
              </label>
              <input
                type="datetime-local"
                value={clockoutTime}
                onChange={(e) => setClockoutTime(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                min={new Date(selectedEmployee.clock_in_time).toISOString().slice(0, 16)}
                max={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Force Clock-Out
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
                rows="3"
                placeholder="e.g., Employee forgot to clock out, system correction, etc."
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setForceClockoutModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleForceClockout}
                disabled={!clockoutTime || forceClockoutMutation.isLoading}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {forceClockoutMutation.isLoading ? 'Processing...' : 'Force Clock-Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StuckClockInAlert;
