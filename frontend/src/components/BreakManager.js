import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { attendanceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const BreakManager = () => {
  const { user } = useAuth();
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const queryClient = useQueryClient();

  // Get break requirements - USER-SPECIFIC CACHE KEY
  const { data: breakRequirements, refetch: refetchRequirements } = useQuery(
    ['breakRequirements', user?.employee_profile?.id],
    () => attendanceAPI.get('/breaks/break_requirements/'),
    {
      refetchInterval: 300000, // Check every 5 minutes
      enabled: !!user?.employee_profile?.id
    }
  );

  // Get active break - USER-SPECIFIC CACHE KEY
  const { data: activeBreakData } = useQuery(
    ['activeBreak', user?.employee_profile?.id],
    () => attendanceAPI.get('/breaks/active_break/'),
    {
      refetchInterval: 60000, // Check every minute
      enabled: !!user?.employee_profile?.id
    }
  );

  // Waive break mutation
  const waiveBreakMutation = useMutation(
    (reason) => attendanceAPI.post('/breaks/waive_break/', { reason }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['breakRequirements', user?.employee_profile?.id]);
        queryClient.invalidateQueries(['activeBreak', user?.employee_profile?.id]);
        setShowWaiverModal(false);
        setWaiverReason('');
      }
    }
  );

  // Decline break reminder mutation
  const declineReminderMutation = useMutation(
    (reason) => attendanceAPI.post('/breaks/decline_break_reminder/', { reason }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['breakRequirements', user?.employee_profile?.id]);
        setShowDeclineModal(false);
        setDeclineReason('');
      }
    }
  );

  // Start break mutation
  const startBreakMutation = useMutation(
    (breakData) => attendanceAPI.post('/breaks/start_break/', breakData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['activeBreak', user?.employee_profile?.id]);
        queryClient.invalidateQueries(['breakRequirements', user?.employee_profile?.id]);
      }
    }
  );

  // End break mutation (FIXED: Changed POST to PATCH to match backend)
  const endBreakMutation = useMutation(
    (breakId) => attendanceAPI.patch(`/breaks/${breakId}/end_break/`, {}),
    {
      onSuccess: (response) => {
        console.log('Break ended successfully:', response);
        toast.success('Break ended successfully');
        queryClient.invalidateQueries(['activeBreak', user?.employee_profile?.id]);
        queryClient.invalidateQueries(['breakRequirements', user?.employee_profile?.id]);
        queryClient.invalidateQueries(['currentAttendanceStatus', user?.employee_profile?.id]);
        queryClient.invalidateQueries(['shiftStatus', user?.employee_profile?.id]);
      },
      onError: (error) => {
        console.error('End break error:', error);
        console.error('Error response:', error.response);
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to end break';
        toast.error(`Error: ${errorMessage}`);
      }
    }
  );

  const handleWaiverSubmit = () => {
    if (waiverReason.trim()) {
      waiveBreakMutation.mutate(waiverReason.trim());
    }
  };

  const handleDeclineSubmit = () => {
    if (declineReason.trim()) {
      declineReminderMutation.mutate(declineReason.trim());
    }
  };

  const handleStartBreak = (breakType) => {
    startBreakMutation.mutate({ break_type: breakType });
  };

  const handleEndBreak = () => {
    console.log('handleEndBreak called');
    console.log('activeBreakData:', activeBreakData);

    // FIXED: Access the correct nested path
    const breakId = activeBreakData?.data?.break?.id;
    console.log('breakId:', breakId);

    if (breakId) {
      console.log('Calling endBreakMutation with breakId:', breakId);
      endBreakMutation.mutate(breakId);
    } else {
      console.error('No break ID found in activeBreakData');
      alert('Error: Cannot find active break ID');
    }
  };

  // Show break reminder if required
  if (breakRequirements?.data?.requires_break && !activeBreakData?.data?.has_active_break) {
    return (
      <div className="glass-status-warning p-4 mb-4 glass-fade-in">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 mt-1 mr-3" />
          <div className="flex-1">
            <h3 className="text-lg font-medium glass-text-primary mb-2">
              {breakRequirements.data.is_overdue ? 'Break Overdue!' : 'Break Reminder'}
            </h3>
            <p className="glass-text-secondary mb-4">
              You've worked {breakRequirements.data.hours_worked} hours. {breakRequirements.data.reason}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStartBreak(breakRequirements.data.break_type)}
                className="uber-button-primary flex items-center"
                disabled={startBreakMutation.isLoading}
              >
                <ClockIcon className="h-4 w-4 mr-2" />
                Take Break Now
              </button>
              
              <button
                onClick={() => setShowWaiverModal(true)}
                className="uber-button-secondary"
              >
                Waive Break
              </button>

              <button
                onClick={() => setShowDeclineModal(true)}
                className="glass-button glass-text-secondary"
              >
                Remind Later
              </button>
            </div>
          </div>
        </div>

        {/* Waiver Modal */}
        {showWaiverModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="glass-modal p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium glass-text-primary mb-4">Waive Break</h3>
              <p className="glass-text-secondary mb-4">
                Please provide a reason for waiving your required break:
              </p>
              <textarea
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                className="glass-input w-full mb-4"
                rows="3"
                placeholder="e.g., Critical deadline, covering for colleague, etc."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowWaiverModal(false)}
                  className="glass-button glass-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWaiverSubmit}
                  disabled={!waiverReason.trim() || waiveBreakMutation.isLoading}
                  className="uber-button-secondary disabled:opacity-50"
                >
                  {waiveBreakMutation.isLoading ? 'Recording...' : 'Record Waiver'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Decline Modal */}
        {showDeclineModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="glass-modal p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium glass-text-primary mb-4">Decline Break Reminder</h3>
              <p className="glass-text-secondary mb-4">
                Please provide a reason for declining the break reminder:
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="glass-input w-full mb-4"
                rows="3"
                placeholder="e.g., Will take break in 30 minutes, finishing current task, etc."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeclineModal(false)}
                  className="glass-button glass-text-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeclineSubmit}
                  disabled={!declineReason.trim() || declineReminderMutation.isLoading}
                  className="glass-button glass-text-primary disabled:opacity-50"
                >
                  {declineReminderMutation.isLoading ? 'Recording...' : 'Record Decline'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show active break status
  if (activeBreakData?.data?.has_active_break) {
    const breakData = activeBreakData.data.break;
    return (
      <div className="glass-status-success p-4 mb-4 glass-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircleIcon className="h-6 w-6 text-green-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium glass-text-primary">
                On {breakData.break_type.replace('_', ' ')} Break
              </h3>
              <p className="glass-text-secondary">
                Started at {new Date(breakData.start_time).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleEndBreak}
            disabled={endBreakMutation.isLoading}
            className="uber-button-primary disabled:opacity-50"
          >
            {endBreakMutation.isLoading ? 'Ending...' : 'End Break'}
          </button>
        </div>
      </div>
    );
  }

  // No break required or active
  return null;
};

export default BreakManager;
