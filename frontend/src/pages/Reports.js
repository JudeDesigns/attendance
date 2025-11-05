import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  DocumentChartBarIcon as DocumentReportIcon,
  ArrowDownTrayIcon as DownloadIcon,
  CalendarIcon,
  FunnelIcon as FilterIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { reportsAPI } from '../services/api';

const Reports = () => {
  const queryClient = useQueryClient();
  
  // State management
  const [selectedReportType, setSelectedReportType] = useState('LATE_ARRIVAL');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // 30 days ago
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); // Today
  const [department, setDepartment] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch report templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery(
    'reportTemplates',
    () => reportsAPI.getTemplates()
  );

  // Fetch report executions
  const { data: executionsData, isLoading: executionsLoading } = useQuery(
    'reportExecutions',
    () => reportsAPI.getExecutions()
  );

  // Report type configurations
  const reportTypes = [
    {
      key: 'LATE_ARRIVAL',
      name: 'Late Arrival Report',
      description: 'Employees who arrived late to work',
      icon: ClockIcon,
      color: 'text-yellow-600'
    },
    {
      key: 'OVERTIME',
      name: 'Overtime Report', 
      description: 'Employees who worked overtime hours',
      icon: ExclamationTriangleIcon,
      color: 'text-orange-600'
    },
    {
      key: 'DEPARTMENT_SUMMARY',
      name: 'Department Summary',
      description: 'Summary by department',
      icon: UserGroupIcon,
      color: 'text-blue-600'
    },
    {
      key: 'ATTENDANCE_SUMMARY',
      name: 'Attendance Summary',
      description: 'Detailed attendance summary',
      icon: ChartBarIcon,
      color: 'text-green-600'
    }
  ];

  // Generate report mutation
  const generateReportMutation = useMutation(
    (reportData) => reportsAPI.generateReport(reportData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('reportExecutions');
        setIsGenerating(false);
      },
      onError: (error) => {
        console.error('Report generation failed:', error);
        setIsGenerating(false);
      }
    }
  );

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select start and end dates');
      return;
    }

    // Find template for selected report type
    const template = templatesData?.results?.find(t => t.report_type === selectedReportType);
    if (!template) {
      alert('Report template not found');
      return;
    }

    setIsGenerating(true);

    const reportData = {
      template_id: template.id,
      start_date: startDate,
      end_date: endDate,
      format: 'CSV',
      filters: department ? { department } : {}
    };

    try {
      await generateReportMutation.mutateAsync(reportData);
      alert('Report generated successfully!');
    } catch (error) {
      alert('Failed to generate report: ' + error.message);
    }
  };

  const handleDownloadReport = async (executionId) => {
    try {
      const response = await reportsAPI.downloadReport(executionId);
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${executionId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download report: ' + error.message);
    }
  };

  if (templatesLoading || executionsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center">
          <DocumentReportIcon className="h-8 w-8 text-blue-500 mr-3" />
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Reports & Analytics</h1>
            <p className="glass-text-secondary">Generate and download attendance reports</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Generation Panel */}
        <div className="lg:col-span-2 glass-card glass-slide-up p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Generate Report</h2>
          
          {/* Report Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reportTypes.map((type) => {
                const IconComponent = type.icon;
                return (
                  <div
                    key={type.key}
                    className={`relative rounded-lg border p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedReportType === type.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300'
                    }`}
                    onClick={() => setSelectedReportType(type.key)}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <IconComponent className={`h-6 w-6 ${type.color}`} />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-gray-900">
                          {type.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    {selectedReportType === type.key && (
                      <div className="absolute top-2 right-2">
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department Filter (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Enter department name"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <FilterIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || generateReportMutation.isLoading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating || generateReportMutation.isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Report...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <DocumentReportIcon className="h-5 w-5 mr-2" />
                Generate Report
              </div>
            )}
          </button>
        </div>

        {/* Recent Reports */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Reports</h2>
          
          {executionsData?.results?.length > 0 ? (
            <div className="space-y-3">
              {executionsData.results.slice(0, 5).map((execution) => (
                <div
                  key={execution.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {execution.template_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {execution.start_date} to {execution.end_date}
                      </p>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          execution.status === 'COMPLETED' 
                            ? 'bg-green-100 text-green-800'
                            : execution.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {execution.status}
                        </span>
                      </div>
                    </div>
                    {execution.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleDownloadReport(execution.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                        title="Download Report"
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <DocumentReportIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No reports yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generate your first report to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
