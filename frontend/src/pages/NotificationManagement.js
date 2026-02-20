import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { notificationAPI, employeeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  BellIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// Helper functions
const getNotificationTypeIcon = (type) => {
  switch (type) {
    case 'EMAIL':
      return <EnvelopeIcon className="h-5 w-5" />;
    case 'SMS':
      return <DevicePhoneMobileIcon className="h-5 w-5" />;
    case 'PUSH':
      return <BellIcon className="h-5 w-5" />;
    case 'WEBHOOK':
      return <GlobeAltIcon className="h-5 w-5" />;
    default:
      return <BellIcon className="h-5 w-5" />;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const NotificationManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');

  // Fetch notification templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery(
    'notification-templates',
    () => notificationAPI.getTemplates(),
    {
      refetchInterval: 30000,
    }
  );

  // Fetch notification logs
  const { data: logsData, isLoading: logsLoading } = useQuery(
    'notification-logs',
    () => notificationAPI.getLogs(),
    {
      refetchInterval: 15000,
    }
  );

  // Fetch notification statistics
  const { data: statsData, isLoading: statsLoading } = useQuery(
    'notification-stats',
    () => notificationAPI.getStats(),
    {
      refetchInterval: 60000,
    }
  );

  const templates = templatesData?.data?.results || templatesData?.results || [];
  const logs = logsData?.data?.results || logsData?.results || [];
  const stats = statsData?.data || {};

  // Mutations
  const createTemplateMutation = useMutation(notificationAPI.createTemplate, {
    onSuccess: () => {
      queryClient.invalidateQueries('notification-templates');
      toast.success('Template created successfully');
      setShowCreateForm(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to create template');
    },
  });

  const updateTemplateMutation = useMutation(
    ({ id, data }) => notificationAPI.updateTemplate(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notification-templates');
        toast.success('Template updated successfully');
        setSelectedTemplate(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update template');
      },
    }
  );

  const deleteTemplateMutation = useMutation(notificationAPI.deleteTemplate, {
    onSuccess: () => {
      queryClient.invalidateQueries('notification-templates');
      toast.success('Template deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete template');
    },
  });

  const handleCreateTemplate = (templateData) => {
    createTemplateMutation.mutate(templateData);
  };

  const handleUpdateTemplate = (id, templateData) => {
    updateTemplateMutation.mutate({ id, data: templateData });
  };

  const handleDeleteTemplate = (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteTemplateMutation.mutate(id);
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Notification Management</h1>
            <p className="glass-text-secondary">Manage notification templates and monitor delivery</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Template
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <BellIcon className="h-6 w-6 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">Total Templates</p>
                <p className="text-2xl font-bold text-blue-900">{templates.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">Sent Today</p>
                <p className="text-2xl font-bold text-green-900">{stats.sent_today || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ClockIcon className="h-6 w-6 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{stats.pending || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <XCircleIcon className="h-6 w-6 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">Failed</p>
                <p className="text-2xl font-bold text-red-900">{stats.failed || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'templates'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Templates ({templates.length})
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'logs'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Notification Logs ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Analytics
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              isLoading={templatesLoading}
              onEdit={setSelectedTemplate}
              onDelete={handleDeleteTemplate}
              onView={(template) => {
                setSelectedTemplate(template);
                setShowTemplateModal(true);
              }}
            />
          )}

          {activeTab === 'logs' && (
            <LogsTab />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              stats={stats}
              isLoading={statsLoading}
            />
          )}
        </div>
      </div>

      {/* Create/Edit Template Forms */}
      {(showCreateForm || selectedTemplate) && (
        <TemplateForm
          template={selectedTemplate}
          onSubmit={selectedTemplate ?
            (data) => handleUpdateTemplate(selectedTemplate.id, data) :
            handleCreateTemplate
          }
          onCancel={() => {
            setShowCreateForm(false);
            setSelectedTemplate(null);
          }}
          isLoading={createTemplateMutation.isLoading || updateTemplateMutation.isLoading}
        />
      )}

      {/* Template View Modal */}
      {showTemplateModal && selectedTemplate && (
        <TemplateViewModal
          template={selectedTemplate}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};

// Templates Tab Component
const TemplatesTab = ({ templates, isLoading, onEdit, onDelete, onView }) => {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8">
        <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a notification template.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Template
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Event
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {templates.map((template) => (
            <tr key={template.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{template.name}</div>
                  <div className="text-sm text-gray-500">{template.subject}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  {getNotificationTypeIcon(template.notification_type)}
                  <span className="ml-2 text-sm text-gray-900">{template.notification_type}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {template.event_type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onView(template)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(template.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Activity Center Tab Component (replaces old LogsTab)
const LogsTab = () => {
  const [filters, setFilters] = useState({
    employee_id: '',
    event_type: '',
    date_from: '',
    date_to: '',
  });
  const [expandedNotifs, setExpandedNotifs] = useState({});
  const [expandedEmployees, setExpandedEmployees] = useState({});

  // Fetch activity feed
  const { data: activityData, isLoading } = useQuery(
    ['activity-feed', filters],
    () => notificationAPI.getActivityFeed(filters),
    { refetchInterval: 30000, keepPreviousData: true }
  );

  // Fetch employees for filter dropdown
  const { data: employeesData } = useQuery(
    'employees-list',
    () => employeeAPI.list(),
    { staleTime: 300000 }
  );

  const activity = activityData?.data || {};
  const summary = activity.summary || {};
  const employees = activity.employees || [];
  const employeeList = employeesData?.data?.results || employeesData?.data || [];

  const toggleNotif = (id) => setExpandedNotifs(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleEmployee = (id) => setExpandedEmployees(prev => ({ ...prev, [id]: !prev[id] }));

  const eventTypeOptions = [
    { value: '', label: 'All Events' },
    { value: 'clock_in', label: '🟢 Clock In' },
    { value: 'clock_out', label: '🔴 Clock Out' },
    { value: 'break_waived', label: '⚠️ Break Waived' },
    { value: 'break_reminder', label: '⏰ Break Reminder' },
    { value: 'break_compliance_violation', label: '🚨 Compliance Violation' },
    { value: 'overtime', label: '⏱️ Overtime' },
    { value: 'overtime_admin', label: '⏱️ Overtime (Admin)' },
    { value: 'late_clock_in', label: '⚡ Late Clock In' },
    { value: 'missed_clock_out', label: '❌ Missed Clock Out' },
    { value: 'shift_reminder', label: '📋 Shift Reminder' },
  ];

  const getEventBadge = (eventType) => {
    const badges = {
      'clock_in': { bg: 'bg-green-100 text-green-800', icon: '🟢' },
      'clock_out': { bg: 'bg-red-100 text-red-800', icon: '🔴' },
      'break_waived': { bg: 'bg-amber-100 text-amber-800', icon: '⚠️' },
      'break_reminder': { bg: 'bg-blue-100 text-blue-800', icon: '⏰' },
      'break_overdue': { bg: 'bg-orange-100 text-orange-800', icon: '⏰' },
      'break_compliance_violation': { bg: 'bg-red-100 text-red-900', icon: '🚨' },
      'overtime': { bg: 'bg-purple-100 text-purple-800', icon: '⏱️' },
      'overtime_admin': { bg: 'bg-purple-100 text-purple-800', icon: '⏱️' },
      'late_clock_in': { bg: 'bg-yellow-100 text-yellow-800', icon: '⚡' },
      'missed_clock_out': { bg: 'bg-red-100 text-red-800', icon: '❌' },
      'shift_reminder': { bg: 'bg-indigo-100 text-indigo-800', icon: '📋' },
      'shift_assigned': { bg: 'bg-teal-100 text-teal-800', icon: '📋' },
      'custom': { bg: 'bg-gray-100 text-gray-800', icon: '💬' },
    };
    return badges[eventType] || { bg: 'bg-gray-100 text-gray-800', icon: '📌' };
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'Unknown') return dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading activity feed...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="bg-indigo-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-indigo-700">{summary.total_activities || 0}</p>
          <p className="text-xs text-indigo-600 font-medium">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{summary.clock_ins || 0}</p>
          <p className="text-xs text-green-600 font-medium">Clock Ins</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{summary.clock_outs || 0}</p>
          <p className="text-xs text-red-600 font-medium">Clock Outs</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{summary.break_waivers || 0}</p>
          <p className="text-xs text-amber-600 font-medium">Break Waivers</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{summary.compliance_violations || 0}</p>
          <p className="text-xs text-red-600 font-medium">Violations</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{summary.unique_employees || 0}</p>
          <p className="text-xs text-blue-600 font-medium">Employees</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
            <select
              value={filters.employee_id}
              onChange={(e) => setFilters(prev => ({ ...prev, employee_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Employees</option>
              {employeeList.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.user?.first_name || ''} {emp.user?.last_name || emp.employee_id || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
            <select
              value={filters.event_type}
              onChange={(e) => setFilters(prev => ({ ...prev, event_type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {eventTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
        {(filters.employee_id || filters.event_type || filters.date_from || filters.date_to) && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => setFilters({ employee_id: '', event_type: '', date_from: '', date_to: '' })}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Grouped Activity Feed */}
      {employees.length === 0 ? (
        <div className="text-center py-12">
          <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No activity found</h3>
          <p className="mt-1 text-sm text-gray-500">Notification activity will appear here once events occur.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {employees.map((emp) => (
            <div key={emp.employee_id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Employee Header */}
              <button
                onClick={() => toggleEmployee(emp.employee_id)}
                className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-5 py-3 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 bg-indigo-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-indigo-700">
                      {emp.employee_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900">{emp.employee_name}</p>
                    <p className="text-xs text-gray-500">ID: {emp.employee_code} · {emp.total_notifications} activities</p>
                  </div>
                </div>
                <svg
                  className={`h-5 w-5 text-gray-400 transition-transform ${expandedEmployees[emp.employee_id] !== false ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Employee Dates (default expanded) */}
              {expandedEmployees[emp.employee_id] !== false && (
                <div className="divide-y divide-gray-100">
                  {emp.dates.map((dateGroup) => (
                    <div key={dateGroup.date} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          📅 {formatDate(dateGroup.date)}
                        </p>
                        <span className="text-xs text-gray-400">{dateGroup.count} event{dateGroup.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2">
                        {dateGroup.notifications.map((notif) => {
                          const badge = getEventBadge(notif.event_type);
                          const isExpanded = expandedNotifs[notif.id];
                          return (
                            <div
                              key={notif.id}
                              className="bg-white border border-gray-100 rounded-md hover:shadow-sm transition-shadow"
                            >
                              <button
                                onClick={() => toggleNotif(notif.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left"
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg}`}>
                                    {badge.icon} {notif.event_type.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-xs text-gray-500 truncate">
                                    {notif.subject || 'No subject'}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                                  {formatTime(notif.created_at)}
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 border-t border-gray-50">
                                  <div className="mt-2 bg-gray-50 rounded p-3">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{notif.message || 'No message content'}</p>
                                  </div>
                                  <div className="mt-2 flex items-center space-x-3 text-xs text-gray-400">
                                    <span>Type: {notif.notification_type}</span>
                                    <span>·</span>
                                    <span>Status: {notif.status}</span>
                                    {notif.sent_at && (
                                      <>
                                        <span>·</span>
                                        <span>Sent: {formatTime(notif.sent_at)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Analytics Tab Component
const AnalyticsTab = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Success Rate</h3>
        <div className="text-3xl font-bold text-green-600">
          {stats.success_rate ? `${stats.success_rate}%` : 'N/A'}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Based on last 30 days
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Most Used Template</h3>
        <div className="text-lg font-semibold text-gray-900">
          {stats.most_used_template || 'N/A'}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {stats.most_used_count || 0} notifications sent
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Average Response Time</h3>
        <div className="text-3xl font-bold text-blue-600">
          {stats.avg_response_time || 'N/A'}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Milliseconds
        </p>
      </div>
    </div>
  );
};

// Template Form Component
const TemplateForm = ({ template, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    notification_type: template?.notification_type || 'PUSH',
    event_type: template?.event_type || '',
    subject: template?.subject || '',
    message_template: template?.message_template || '',
    is_active: template?.is_active !== undefined ? template.is_active : true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const eventTypes = [
    'clock_in', 'clock_out', 'overtime', 'late_clock_in', 'missed_clock_out',
    'shift_reminder', 'break_reminder', 'weekly_summary', 'leave_request_submitted',
    'leave_request_approved', 'leave_request_rejected', 'schedule_published',
    'shift_assigned', 'shift_cancelled', 'employee_birthday', 'work_anniversary'
  ];

  const notificationTypes = [
    { value: 'PUSH', label: 'Push Notification' },
    { value: 'EMAIL', label: 'Email' },
    { value: 'SMS', label: 'SMS' },
    { value: 'WEBHOOK', label: 'Webhook' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            {template ? 'Edit Template' : 'Create New Template'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Clock In Notification"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Type *
                </label>
                <select
                  name="notification_type"
                  value={formData.notification_type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {notificationTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Type *
              </label>
              <select
                name="event_type"
                value={formData.event_type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select an event type</option>
                {eventTypes.map(event => (
                  <option key={event} value={event}>{event.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Email subject or notification title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Template *
              </label>
              <textarea
                name="message_template"
                value={formData.message_template}
                onChange={handleChange}
                required
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Use placeholders like {employee_name}, {clock_in_time}, {location}, etc."
              />
              <p className="text-xs text-gray-500 mt-1">
                Available placeholders: {'{employee_name}'}, {'{clock_in_time}'}, {'{clock_out_time}'}, {'{location}'}, {'{total_hours}'}, {'{date}'}
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Active Template
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Template View Modal Component
const TemplateViewModal = ({ template, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Template Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{template.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <div className="mt-1 flex items-center">
                  {getNotificationTypeIcon(template.notification_type)}
                  <span className="ml-2 text-sm text-gray-900">{template.notification_type}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Event</label>
                <p className="mt-1 text-sm text-gray-900">{template.event_type}</p>
              </div>
            </div>

            {template.subject && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <p className="mt-1 text-sm text-gray-900">{template.subject}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Message Template</label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{template.message_template}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <span className={`mt-1 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                {template.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
              <div>
                <label className="block font-medium">Created</label>
                <p>{new Date(template.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="block font-medium">Updated</label>
                <p>{new Date(template.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationManagement;
