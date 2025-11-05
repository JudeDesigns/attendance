import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { schedulingAPI } from '../services/api';
import { useQuery } from 'react-query';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const Schedule = () => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(currentWeek);

  // Get shifts for the current week
  const { data: shiftsData, isLoading } = useQuery(
    ['shifts', user?.employee_profile?.id, format(weekStart, 'yyyy-MM-dd')],
    () => schedulingAPI.shifts({
      employee: user?.employee_profile?.id,
      start_date: format(weekStart, 'yyyy-MM-dd'),
      end_date: format(weekEnd, 'yyyy-MM-dd'),
    }),
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  const shifts = shiftsData?.data?.results || [];

  const navigateWeek = (direction) => {
    if (direction === 'prev') {
      setCurrentWeek(subWeeks(currentWeek, 1));
    } else {
      setCurrentWeek(addWeeks(currentWeek, 1));
    }
  };

  const getDaysOfWeek = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getShiftsForDay = (date) => {
    return shifts.filter(shift => 
      isSameDay(new Date(shift.start_time), date)
    );
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    try {
      // Parse the datetime string and keep it in UTC to avoid timezone conversion
      const date = new Date(timeString);
      // Use UTC methods to avoid local timezone conversion
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();

      // Convert to 12-hour format
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayMinutes = minutes.toString().padStart(2, '0');

      return `${displayHours}:${displayMinutes} ${period}`;
    } catch (error) {
      return timeString;
    }
  };

  const calculateShiftDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours.toFixed(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="glass-card glass-fade-in p-4 md:p-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <h1 className="text-xl md:text-2xl font-bold glass-text-primary">Schedule</h1>

          {/* Week Navigation - Mobile Responsive */}
          <div className="flex items-center justify-center space-x-2 md:space-x-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="glass-button p-2 rounded-md"
            >
              <ChevronLeftIcon className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            <div className="text-sm md:text-lg font-medium glass-text-primary text-center min-w-0">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </div>

            <button
              onClick={() => navigateWeek('next')}
              className="glass-button p-2 rounded-md"
            >
              <ChevronRightIcon className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Overview - Mobile Responsive */}
      <div className="glass-card glass-slide-up p-4 md:p-6">
        <h2 className="text-base md:text-lg font-medium glass-text-primary mb-4">Weekly Overview</h2>

        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="glass-card p-3 md:p-4">
            <div className="flex items-center">
              <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-blue-600 mr-2" />
              <div>
                <p className="text-xs md:text-sm font-medium glass-text-secondary">Total Shifts</p>
                <p className="text-lg md:text-xl font-semibold glass-text-primary">{shifts.length}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-3 md:p-4">
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 md:h-5 md:w-5 text-green-600 mr-2" />
              <div>
                <p className="text-xs md:text-sm font-medium glass-text-secondary">Total Hours</p>
                <p className="text-lg md:text-xl font-semibold glass-text-primary">
                  {shifts.reduce((total, shift) => {
                    return total + parseFloat(calculateShiftDuration(shift.start_time, shift.end_time));
                  }, 0).toFixed(1)}h
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid - Horizontally Scrollable on Mobile */}
      <div className="glass-card glass-slide-up overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-full md:min-w-0" style={{ minWidth: '700px' }}>
            <div className="grid grid-cols-7 gap-px bg-white bg-opacity-20">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="glass-table-header py-2 px-2 md:px-3">
                  <div className="text-xs md:text-sm font-medium glass-text-primary text-center">
                    {day}
                  </div>
                </div>
              ))}

              {/* Calendar Days */}
              {getDaysOfWeek().map((date) => {
                const dayShifts = getShiftsForDay(date);
                const isToday = isSameDay(date, new Date());

                return (
                  <div
                    key={date.toISOString()}
                    className={`glass-table-row p-2 md:p-3 min-h-24 md:min-h-32 ${
                      isToday ? 'bg-blue-500 bg-opacity-10' : ''
                    }`}
                  >
                    <div className={`text-xs md:text-sm font-medium mb-1 md:mb-2 ${
                      isToday ? 'text-blue-600' : 'glass-text-primary'
                    }`}>
                      {format(date, 'd')}
                    </div>

                    <div className="space-y-1">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className="bg-indigo-100 text-indigo-800 px-1.5 md:px-2 py-1 rounded text-xs"
                        >
                          <div className="font-medium text-xs">
                            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                          </div>
                          <div className="text-indigo-600 text-xs">
                            {calculateShiftDuration(shift.start_time, shift.end_time)}h
                          </div>
                          {shift.location && (
                            <div className="text-indigo-600 mt-1 truncate text-xs">
                              {shift.location}
                            </div>
                          )}
                        </div>
                      ))}

                      {dayShifts.length === 0 && (
                        <div className="text-gray-400 text-xs">
                          No shifts
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile scroll hint */}
        <div className="md:hidden text-center py-2 text-xs glass-text-secondary">
          ← Swipe to see all days →
        </div>
      </div>

      {/* Shift Details - Mobile Responsive */}
      {shifts.length > 0 && (
        <div className="glass-card glass-slide-up">
          <div className="p-4 md:p-6">
            <h3 className="text-base md:text-lg leading-6 font-medium glass-text-primary mb-4">
              Shift Details
            </h3>

            {/* Mobile: Card Layout */}
            <div className="md:hidden space-y-3">
              {shifts.map((shift) => (
                <div key={shift.id} className="glass-card p-3 border border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium glass-text-primary text-sm">
                      {format(new Date(shift.start_time), 'EEE, MMM d')}
                    </div>
                    <div className="text-xs glass-text-secondary">
                      {calculateShiftDuration(shift.start_time, shift.end_time)}h
                    </div>
                  </div>
                  <div className="text-sm glass-text-secondary mb-1">
                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                  </div>
                  {shift.location && (
                    <div className="text-xs glass-text-secondary mb-1">
                      📍 {shift.location}
                    </div>
                  )}
                  {shift.notes && (
                    <div className="text-xs glass-text-muted mt-2 p-2 bg-gray-50 rounded">
                      {shift.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {format(new Date(shift.start_time), 'EEE, MMM d')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(shift.start_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(shift.end_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {calculateShiftDuration(shift.start_time, shift.end_time)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.location || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {shift.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No Shifts Message */}
      {shifts.length === 0 && (
        <div className="glass-empty-state">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium glass-text-primary">No shifts scheduled</h3>
          <p className="mt-1 text-sm glass-text-secondary">
            You don't have any shifts scheduled for this week.
          </p>
        </div>
      )}
    </div>
  );
};

export default Schedule;
