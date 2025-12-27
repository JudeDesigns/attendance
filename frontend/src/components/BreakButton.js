import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { attendanceAPI } from '../services/api';

const BreakButton = ({ className = "", currentStatus }) => {
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [breakTimeReached, setBreakTimeReached] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);

  const queryClient = useQueryClient();

  // Internal status query removed - using prop from Dashboard instead

  // Get break requirements
  const {
    data: breakRequirements,
    refetch: refetchBreakRequirements,
    isError: isBreakError,
    error: breakError
  } = useQuery(
    'breakRequirements',
    () => attendanceAPI.get('/breaks/break_requirements/'),
    {
      enabled: !!currentStatus?.is_clocked_in,
      refetchInterval: 60000, // Check every minute
      onError: (err) => {
        console.error('Break requirements fetch failed:', err);
      }
    }
  );

  // Get active break status
  const { data: activeBreakData } = useQuery(
    'activeBreak',
    () => attendanceAPI.get('/breaks/active_break/'),
    {
      enabled: !!currentStatus?.is_clocked_in,
      refetchInterval: 30000,
    }
  );

  // Waive break mutation
  const waiveBreakMutation = useMutation(
    (reason) => attendanceAPI.post('/breaks/waive_break/', { reason }),
    {
      onSuccess: () => {
        toast.success('Break waived successfully');
        setShowWaiverModal(false);
        setWaiverReason('');
        setBreakTimeReached(false);
        setFollowUpSent(false);
        queryClient.invalidateQueries('breakRequirements');
        queryClient.invalidateQueries('activeBreak');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to waive break');
      }
    }
  );

  // Start break mutation
  const startBreakMutation = useMutation(
    (breakData) => attendanceAPI.post('/breaks/start_break/', breakData),
    {
      onSuccess: () => {
        toast.success('Break started successfully');
        setBreakTimeReached(false);
        setFollowUpSent(false);
        queryClient.invalidateQueries('activeBreak');
        queryClient.invalidateQueries('breakRequirements');
        queryClient.invalidateQueries('currentStatus');
      },
      onError: (error) => {
        toast.error(error.response?.data?.detail || 'Failed to start break');
      }
    }
  );

  // Check if break time has been reached and send notifications
  useEffect(() => {
    if (breakRequirements?.data?.requires_break && !breakTimeReached && !activeBreakData?.data?.has_active_break) {
      setBreakTimeReached(true);

      // Send immediate notification
      toast.custom(
        (t) => (
          <div className="break-notification-toast p-4 rounded-lg shadow-lg max-w-md">
            <div className="text-white">
              <strong>Break Time!</strong>
              <br />
              You've worked {breakRequirements.data.hours_worked} hours. Time for your {breakRequirements.data.break_type.toLowerCase()} break.
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    handleStartBreak(breakRequirements.data.break_type);
                    toast.dismiss(t.id);
                  }}
                  className="bg-white bg-opacity-20 text-white px-3 py-1 rounded text-sm hover:bg-opacity-30 transition-all"
                >
                  Take Break
                </button>
                <button
                  onClick={() => {
                    setShowWaiverModal(true);
                    toast.dismiss(t.id);
                  }}
                  className="bg-white bg-opacity-20 text-white px-3 py-1 rounded text-sm hover:bg-opacity-30 transition-all"
                >
                  Waive
                </button>
              </div>
            </div>
          </div>
        ),
        {
          duration: Infinity,
          position: 'top-center',
        }
      );

      // Set 5-minute follow-up timer
      setTimeout(() => {
        if (!followUpSent && !activeBreakData?.data?.has_active_break) {
          setFollowUpSent(true);
          toast.custom(
            (t) => (
              <div className="break-followup-toast p-4 rounded-lg shadow-lg max-w-md">
                <div className="text-white">
                  <strong>URGENT: Break Reminder</strong>
                  <br />
                  You still haven't taken your required break. Please take your break or waive it now.
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        handleStartBreak(breakRequirements.data.break_type);
                        toast.dismiss(t.id);
                      }}
                      className="bg-white bg-opacity-20 text-white px-3 py-1 rounded text-sm hover:bg-opacity-30 transition-all"
                    >
                      Take Break Now
                    </button>
                    <button
                      onClick={() => {
                        setShowWaiverModal(true);
                        toast.dismiss(t.id);
                      }}
                      className="bg-white bg-opacity-20 text-white px-3 py-1 rounded text-sm hover:bg-opacity-30 transition-all"
                    >
                      Waive Break
                    </button>
                  </div>
                </div>
              </div>
            ),
            {
              duration: Infinity,
              position: 'top-center',
            }
          );
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
  }, [breakRequirements, breakTimeReached, activeBreakData, followUpSent]);

  const handleStartBreak = (breakType) => {
    startBreakMutation.mutate({
      break_type: breakType || 'LUNCH',
      notes: 'Break started via Break Button'
    });
  };

  const handleWaiverSubmit = () => {
    if (waiverReason.trim()) {
      waiveBreakMutation.mutate(waiverReason.trim());
    }
  };

  // Determine button state
  const isCurrentlyClockedIn = currentStatus?.is_clocked_in;
  const requiresBreak = breakRequirements?.data?.requires_break;
  const hasActiveBreak = activeBreakData?.data?.has_active_break;
  const isOverdue = breakRequirements?.data?.is_overdue;
  const canTakeManualBreak = breakRequirements?.data?.can_take_manual_break;

  // Button styling based on state
  let buttonClass = "flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all duration-200 ";
  let buttonText = "Break Time";
  let buttonIcon = ClockIcon;
  let isDisabled = false;

  if (!isCurrentlyClockedIn) {
    // Not clocked in - blurred/disabled
    buttonClass += "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 blur-sm";
    buttonText = "Clock In First";
    isDisabled = true;
  } else if (hasActiveBreak) {
    // Currently on break
    buttonClass += "bg-green-600 text-white shadow-lg";
    buttonText = "On Break";
    buttonIcon = CheckCircleIcon;
    isDisabled = true;
  } else if (requiresBreak) {
    if (isOverdue) {
      // Overdue break - urgent
      buttonClass += "bg-red-600 text-white shadow-lg animate-pulse";
      buttonText = "Break Overdue!";
      buttonIcon = ExclamationTriangleIcon;
    } else {
      // Break time reached - active
      buttonClass += "bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-105";
      buttonText = "Take Break Now";
    }
  } else if (canTakeManualBreak) {
    // Manual break available - enabled but different styling
    buttonClass += "bg-gray-500 text-white shadow-md hover:bg-gray-600 hover:scale-105";
    buttonText = "Take Break";
    isDisabled = false;
  } else {
    // Break time not reached yet - blurred/disabled
    buttonClass += "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 blur-sm";
    buttonText = "Break Not Available";
    isDisabled = true;
  }

  const IconComponent = buttonIcon;

  return (
    <>
      <div className={`${className}`}>
        <button
          onClick={() => (requiresBreak || canTakeManualBreak) && !hasActiveBreak ? handleStartBreak(breakRequirements?.data?.break_type || 'SHORT') : null}
          disabled={isDisabled}
          className={buttonClass}
          title={
            !isCurrentlyClockedIn
              ? "You must be clocked in to take breaks"
              : hasActiveBreak
                ? "You are currently on break"
                : requiresBreak
                  ? `Take your ${breakRequirements.data.break_type.toLowerCase()} break`
                  : canTakeManualBreak
                    ? "Take a voluntary break"
                    : "Break not available yet (work at least 1 hour)"
          }
        >
          <IconComponent className="h-5 w-5 mr-2" />
          {buttonText}
        </button>

        {/* Break info display */}
        {isCurrentlyClockedIn && !hasActiveBreak && (
          <div className="mt-2 text-sm text-gray-600">
            {isBreakError ? (
              <span className="text-red-500">
                Error: {breakError?.message || 'Unable to load status'}
              </span>
            ) : requiresBreak ? (
              <span className={isOverdue ? "text-red-600 font-medium" : "text-blue-600"}>
                {breakRequirements?.data?.hours_worked}h worked - {breakRequirements?.data?.reason}
              </span>
            ) : canTakeManualBreak ? (
              <span className="text-gray-600">
                {breakRequirements?.data?.hours_worked || 0}h worked - Manual break available
              </span>
            ) : (
              <span>
                {breakRequirements?.data?.hours_worked || 0}h worked - Break at 2h
              </span>
            )}
          </div>
        )}
      </div>

      {/* Waiver Modal */}
      {showWaiverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium glass-text-primary mb-4">
              Waive Break
            </h3>
            <p className="glass-text-secondary mb-4">
              Please provide a reason for waiving your required break:
            </p>
            <textarea
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
              placeholder="e.g., Critical project deadline, client meeting, etc."
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowWaiverModal(false);
                  setWaiverReason('');
                }}
                className="glass-button glass-text-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleWaiverSubmit}
                disabled={!waiverReason.trim() || waiveBreakMutation.isLoading}
                className="glass-button-primary"
              >
                {waiveBreakMutation.isLoading ? 'Waiving...' : 'Waive Break'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BreakButton;
