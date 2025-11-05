import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import {
  ClockIcon,
  UserPlusIcon as UserAddIcon,
  DocumentChartBarIcon as DocumentReportIcon,
  CalendarIcon,
  CogIcon,
  ArrowDownTrayIcon as DownloadIcon,
  PlusIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { attendanceAPI, employeeAPI, reportsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const QuickActions = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Quick clock in/out mutation
  const clockMutation = useMutation(
    (action) => {
      if (action === 'clock_in') {
        return attendanceAPI.clockIn({
          coordinates: { latitude: 0, longitude: 0 }, // Default coordinates
          location_name: 'Quick Action'
        });
      } else {
        return attendanceAPI.clockOut({
          coordinates: { latitude: 0, longitude: 0 },
          location_name: 'Quick Action'
        });
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('currentTimeLog');
        queryClient.invalidateQueries('attendanceStats');
      },
      onError: (error) => {
        alert('Clock action failed: ' + error.message);
      }
    }
  );

  // Quick report generation
  const generateQuickReport = async (reportType) => {
    setIsGeneratingReport(true);
    try {
      // Get templates
      const templatesResponse = await reportsAPI.getTemplates();
      const template = templatesResponse.data.results.find(t => t.report_type === reportType);
      
      if (!template) {
        alert('Report template not found');
        return;
      }

      // Generate report for last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await reportsAPI.generateReport({
        template_id: template.id,
        start_date: startDate,
        end_date: endDate,
        format: 'CSV'
      });

      alert('Report generated successfully!');
      queryClient.invalidateQueries('reportExecutions');
    } catch (error) {
      alert('Report generation failed: ' + error.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const quickActions = [
    // Universal actions
    {
      name: 'Quick Clock In',
      description: 'Clock in from dashboard',
      icon: ClockIcon,
      color: 'bg-green-500 hover:bg-green-600',
      action: () => clockMutation.mutate('clock_in'),
      loading: clockMutation.isLoading,
      show: true
    },
    {
      name: 'View Schedule',
      description: 'Check your schedule',
      icon: CalendarIcon,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => navigate('/schedule'),
      show: true
    },
    {
      name: 'Time Tracking',
      description: 'View time logs',
      icon: ClockIcon,
      color: 'bg-purple-500 hover:bg-purple-600',
      action: () => navigate('/time-tracking'),
      show: true
    },

    // Admin-only actions
    {
      name: 'Add Employee',
      description: 'Create new employee',
      icon: UserAddIcon,
      color: 'bg-indigo-500 hover:bg-indigo-600',
      action: () => navigate('/employees'),
      show: isAdmin
    },
    {
      name: 'Generate Report',
      description: 'Quick attendance report',
      icon: DocumentReportIcon,
      color: 'bg-orange-500 hover:bg-orange-600',
      action: () => generateQuickReport('ATTENDANCE_SUMMARY'),
      loading: isGeneratingReport,
      show: isAdmin
    },
    {
      name: 'Employee List',
      description: 'Manage employees',
      icon: UsersIcon,
      color: 'bg-teal-500 hover:bg-teal-600',
      action: () => navigate('/employees'),
      show: isAdmin
    },
    {
      name: 'Reports Dashboard',
      description: 'View all reports',
      icon: DocumentReportIcon,
      color: 'bg-pink-500 hover:bg-pink-600',
      action: () => navigate('/reports'),
      show: isAdmin
    },
    {
      name: 'System Settings',
      description: 'Configure system',
      icon: CogIcon,
      color: 'bg-gray-500 hover:bg-gray-600',
      action: () => navigate('/settings'),
      show: isAdmin
    }
  ];

  const visibleActions = quickActions.filter(action => action.show);

  return (
    <div className="glass-card glass-slide-up">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium glass-text-primary">
            Quick Actions
          </h3>
          <PlusIcon className="h-5 w-5 glass-text-secondary" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleActions.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <button
                key={index}
                onClick={action.action}
                disabled={action.loading}
                className={`${action.color} text-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group`}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {action.loading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : (
                      <IconComponent className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{action.name}</p>
                    <p className="text-xs opacity-90">{action.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Additional Quick Stats */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
              <div className="text-sm text-gray-500">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {new Date().toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div className="text-sm text-gray-500">Date</div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Links</h4>
          <div className="space-y-2">
            <a
              href="/clock-in"
              className="block text-sm text-blue-600 hover:text-blue-800"
            >
              → Full Clock In/Out Page
            </a>
            <a
              href="/time-tracking"
              className="block text-sm text-blue-600 hover:text-blue-800"
            >
              → Detailed Time Tracking
            </a>
            {isAdmin && (
              <>
                <a
                  href="/admin"
                  className="block text-sm text-blue-600 hover:text-blue-800"
                >
                  → Admin Dashboard
                </a>
                <a
                  href="/reports"
                  className="block text-sm text-blue-600 hover:text-blue-800"
                >
                  → Reports & Analytics
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
