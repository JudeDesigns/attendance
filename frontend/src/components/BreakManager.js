import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  ClockIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { attendanceAPI } from '../services/api';

const BreakManager = () => {
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const queryClient = useQueryClient();

  // Get break requirements
  const { data: breakRequirements, refetch: refetchRequirements } = useQuery(
    'breakRequirements',
    () => attendanceAPI.get('/breaks/break_requirements/'),
    {
      refetchInterval: 300000, // Check every 5 minutes
      enabled: true
    }
  );

  // Get active break
  const { data: activeBreakData } = useQuery(
    'activeBreak',
    () => attendanceAPI.get('/breaks/active_break/'),
    {
      refetchInterval: 60000, // Check every minute
    }
  );

  // Waive break mutation
  const waiveBreakMutation = useMutation(
    (reason) => attendanceAPI.post('/breaks/waive_break/', { reason }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('breakRequirements');
        queryClient.invalidateQueries('activeBreak');
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
        queryClient.invalidateQueries('breakRequirements');
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
        queryClient.invalidateQueries('activeBreak');
        queryClient.invalidateQueries('breakRequirements');
      }
    }
  );

  // End break mutation
  const endBreakMutation = useMutation(
    (breakId) => attendanceAPI.post(`/breaks/${breakId}/end_break/`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('activeBreak');
        queryClient.invalidateQueries('breakRequirements');
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
    if (activeBreakData?.break?.id) {
      endBreakMutation.mutate(activeBreakData.break.id);
    }
  };

  // Show break reminder if required
  if (breakRequirements?.requires_break && !activeBreakData?.has_active_break) {
    return (
      <div className="glass-status-warning p-4 mb-4 glass-fade-in">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 mt-1 mr-3" />
          <div className="flex-1">
            <h3 className="text-lg font-medium glass-text-primary mb-2">
              {breakRequirements.is_overdue ? 'Break Overdue!' : 'Break Reminder'}
            </h3>
            <p className="glass-text-secondary mb-4">
              You've worked {breakRequirements.hours_worked} hours. {breakRequirements.reason}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStartBreak(breakRequirements.break_type)}
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
  if (activeBreakData?.has_active_break) {
    const breakData = activeBreakData.break;
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
