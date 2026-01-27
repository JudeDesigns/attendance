import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { schedulingAPI, employeeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import SpreadsheetImporter from '../components/SpreadsheetImporter';
import {
  CalendarIcon,
  PlusIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  XMarkIcon,
  DocumentArrowUpIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AdminScheduling = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [showSpreadsheetImporter, setShowSpreadsheetImporter] = useState(false);

  // Helper function to format time from datetime string
  const formatTime = (datetimeString) => {
    if (!datetimeString) return '';
    try {
      // Parse the datetime string - if it has timezone info, it will be handled correctly
      const date = new Date(datetimeString);
      if (isNaN(date.getTime())) {
        return datetimeString;
      }

      // Use toLocaleTimeString to display in user's timezone
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return datetimeString;
    }
  };

  // Helper function to get the correct time field (local time preferred)
  const getDisplayTime = (shift, field) => {
    if (field === 'start') {
      return shift.start_time_local || shift.start_time;
    } else if (field === 'end') {
      return shift.end_time_local || shift.end_time;
    }
    return null;
  };
  const [selectedShift, setSelectedShift] = useState(null);
  const [viewMode, setViewMode] = useState('week'); // 'week', 'month', 'employee'
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  // Handle URL parameters
  useEffect(() => {
    const employeeParam = searchParams.get('employee');
    if (employeeParam) {
      setSelectedEmployee(employeeParam);
      setViewMode('employee'); // Switch to employee view when pre-selecting
    }
  }, [searchParams]);

  // Fetch employees
  const { data: employeesData } = useQuery('employees', () => employeeAPI.list());
  const employees = employeesData?.data?.results || [];

  // Fetch shifts for selected period
  const weekStart = startOfWeek(new Date(selectedDate));
  const weekEnd = endOfWeek(new Date(selectedDate));
  
  const { data: shiftsData, isLoading } = useQuery(
    ['admin-shifts', selectedDate, selectedEmployee],
    () => schedulingAPI.shifts({
      start_date: format(weekStart, 'yyyy-MM-dd'),
      end_date: format(weekEnd, 'yyyy-MM-dd'),
      employee: selectedEmployee !== 'all' ? selectedEmployee : undefined,
    }),
    {
      refetchInterval: false, // Disable auto-refresh to prevent table flickering
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    }
  );

  const shifts = shiftsData?.data?.results || [];

  // Fetch shift templates
  const { data: templatesData } = useQuery('shift-templates', () => schedulingAPI.getShiftTemplates());
  const templates = templatesData?.data?.results || [];

  // Mutations
  const createShiftMutation = useMutation(schedulingAPI.createShift, {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-shifts']);
      toast.success('Shift created successfully');
      setShowShiftForm(false);
      setSelectedShift(null);
    },
    onError: (error) => {
      console.error('Create shift error:', error);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.detail ||
                          (error.response?.data && typeof error.response.data === 'object'
                            ? Object.values(error.response.data).flat().join(', ')
                            : 'Failed to create shift');
      toast.error(errorMessage);
    },
  });

  const updateShiftMutation = useMutation(
    ({ id, data }) => schedulingAPI.updateShift(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['admin-shifts']);
        toast.success('Shift updated successfully');
        setShowShiftForm(false);
        setSelectedShift(null);
      },
      onError: (error) => {
        console.error('Update shift error:', error);
        const errorMessage = error.response?.data?.message ||
                            error.response?.data?.detail ||
                            (error.response?.data && typeof error.response.data === 'object'
                              ? Object.values(error.response.data).flat().join(', ')
                              : 'Failed to update shift');
        toast.error(errorMessage);
      },
    }
  );

  const deleteShiftMutation = useMutation(schedulingAPI.deleteShift, {
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-shifts']);
      toast.success('Shift deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete shift');
    },
  });

  const bulkCreateMutation = useMutation(schedulingAPI.bulkCreateShifts, {
    onSuccess: (response) => {
      queryClient.invalidateQueries(['admin-shifts']);
      const message = response.data?.message || 'Shifts created successfully';
      toast.success(message);
      setShowBulkForm(false);
    },
    onError: (error) => {
      console.error('Bulk create error:', error);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.detail ||
                          (error.response?.data && typeof error.response.data === 'object'
                            ? Object.values(error.response.data).flat().join(', ')
                            : 'Failed to create shifts');
      toast.error(errorMessage);
    },
  });

  // Group shifts by date and employee
  const groupedShifts = shifts.reduce((acc, shift) => {
    // Extract date from start_time_local if available, fallback to start_time
    const timeToUse = shift.start_time_local || shift.start_time;
    const date = timeToUse ? timeToUse.split('T')[0] : null;
    if (!date) return acc; // Skip shifts without valid start_time

    if (!acc[date]) acc[date] = {};
    if (!acc[date][shift.employee_name]) acc[date][shift.employee_name] = [];
    acc[date][shift.employee_name].push(shift);
    return acc;
  }, {});

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return {
      date: format(day, 'yyyy-MM-dd'),
      dayName: format(day, 'EEE'),
      dayNumber: format(day, 'd'),
    };
  });

  const handleCreateShift = (shiftData) => {
    // CRITICAL FIX: Send times as naive datetime strings (no timezone info)
    // The backend will interpret these as local times based on user's timezone setting
    const processedData = {
      ...shiftData,
      start_time: `${shiftData.date}T${shiftData.start_time}:00`,
      end_time: `${shiftData.date}T${shiftData.end_time}:00`,
    };

    console.log('Creating/updating shift with data:', processedData);
    console.log('Times will be interpreted as local time by backend');

    if (selectedShift && selectedShift.id) {
      updateShiftMutation.mutate({ id: selectedShift.id, data: processedData });
    } else {
      createShiftMutation.mutate(processedData);
    }
  };

  const handleDeleteShift = (shiftId) => {
    if (window.confirm('Are you sure you want to delete this shift?')) {
      deleteShiftMutation.mutate(shiftId);
    }
  };

  const handleBulkCreate = (bulkData) => {
    // Rename days_of_week to weekdays for backend
    const { days_of_week, ...restData } = bulkData;

    const payload = {
      ...restData,
      weekdays: days_of_week,
    };

    bulkCreateMutation.mutate(payload);
  };

  // Handle spreadsheet import
  const handleSpreadsheetImport = async (parsedData) => {
    try {
      // Map employee names to IDs
      const employeeMap = {};
      employees.forEach(emp => {
        const fullName = `${emp.user.first_name} ${emp.user.last_name}`;
        employeeMap[fullName.toLowerCase()] = emp.id;
        employeeMap[emp.user.first_name.toLowerCase()] = emp.id; // Also map by first name
      });

      // Convert parsed shifts to API format
      const shiftsToCreate = parsedData.shifts
        .filter(shift => !shift.pending && !shift.off) // Skip pending and off days
        .map(shift => {
          const employeeId = employeeMap[shift.employee_name.toLowerCase()];

          if (!employeeId) {
            console.warn(`Employee not found: ${shift.employee_name}`);
            return null;
          }

          const shiftData = {
            employee: employeeId,
            date: shift.date,
            shift_type: shift.shift_type || 'REGULAR',
            location: shift.location || '',
            notes: ''
          };

          // Add time information
          if (shift.start_time && shift.end_time) {
            shiftData.start_time = shift.start_time;
            shiftData.end_time = shift.end_time;
          }

          // Add lunch break info to notes
          if (shift.lunch_break_time) {
            shiftData.notes += `Lunch break: ${shift.lunch_break_time}. `;
          }

          // Add special assignment info
          if (shift.special_assignment) {
            shiftData.notes += `Special assignment: ${shift.special_assignment}. `;
            shiftData.shift_type = 'SPECIAL';
          }

          // Add flexible work notes
          if (shift.flexible) {
            shiftData.notes += `Flexible hours: ${shift.notes || 'Until tasks completed'}. `;
            shiftData.shift_type = 'FLEXIBLE';
          }

          return shiftData;
        })
        .filter(Boolean); // Remove null entries

      if (shiftsToCreate.length === 0) {
        toast.error('No valid shifts found to import');
        return;
      }

      // Use the new bulk import endpoint
      const response = await schedulingAPI.importSpreadsheet({
        shifts: shiftsToCreate
      });

      // Show results
      const { success_count, error_count, errors } = response.data;

      if (success_count > 0) {
        toast.success(`Successfully imported ${success_count} shifts`);
        queryClient.invalidateQueries(['admin-shifts']);
      }

      if (error_count > 0) {
        toast.error(`Failed to import ${error_count} shifts`);
        console.error('Import errors:', errors);
      }

      setShowSpreadsheetImporter(false);

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import spreadsheet');
    }
  };

  const getShiftConflicts = () => {
    const conflicts = [];
    Object.entries(groupedShifts).forEach(([date, employeeShifts]) => {
      Object.entries(employeeShifts).forEach(([employee, shifts]) => {
        if (shifts.length > 1) {
          // Check for overlapping shifts
          for (let i = 0; i < shifts.length - 1; i++) {
            for (let j = i + 1; j < shifts.length; j++) {
              const shift1 = shifts[i];
              const shift2 = shifts[j];
              if (
                (shift1.start_time < shift2.end_time && shift1.end_time > shift2.start_time)
              ) {
                conflicts.push({
                  date,
                  employee,
                  shifts: [shift1, shift2],
                });
              }
            }
          }
        }
      });
    });
    return conflicts;
  };

  const conflicts = getShiftConflicts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Admin Scheduling</h1>
            <p className="glass-text-secondary">Manage employee schedules and shifts</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => queryClient.invalidateQueries(['admin-shifts'])}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center"
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowSpreadsheetImporter(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center"
            >
              <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
              Import Spreadsheet
            </button>
            <button
              onClick={() => setShowBulkForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
            >
              <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
              Bulk Create
            </button>
            <button
              onClick={() => {
                setSelectedShift(null);
                setShowShiftForm(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Shift
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Week Starting</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.user.first_name} {employee.user.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Schedule Conflicts Detected
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {conflicts.map((conflict, index) => (
                    <li key={index}>
                      {conflict.employee} on {conflict.date} has overlapping shifts
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Grid */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading schedule...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  {weekDays.map((day) => (
                    <th key={day.date} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>
                        <div>{day.dayName}</div>
                        <div className="text-lg font-bold text-gray-900">{day.dayNumber}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees
                  .filter(emp => selectedEmployee === 'all' || emp.id === selectedEmployee)
                  .map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {employee.user.first_name?.[0]}{employee.user.last_name?.[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.user.first_name} {employee.user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{employee.department}</div>
                          </div>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const dayShifts = groupedShifts[day.date]?.[`${employee.user.first_name} ${employee.user.last_name}`] || [];
                        return (
                          <td key={day.date} className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              {dayShifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  className={`text-xs p-2 rounded ${
                                    shift.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                    shift.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium">
                                        {formatTime(getDisplayTime(shift, 'start'))} - {formatTime(getDisplayTime(shift, 'end'))}
                                      </div>
                                      <div>{shift.location || 'No location'}</div>
                                      {shift.employee_timezone && (
                                        <div className="text-xs text-gray-500">
                                          {shift.employee_timezone}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => {
                                          setSelectedShift(shift);
                                          setShowShiftForm(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        <PencilIcon className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteShift(shift.id)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <TrashIcon className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {dayShifts.length === 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedShift({
                                      employee: employee.id,
                                      date: day.date,
                                    });
                                    setShowShiftForm(true);
                                  }}
                                  className="w-full text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded p-2 hover:border-gray-400"
                                >
                                  + Add Shift
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Shifts</dt>
                  <dd className="text-lg font-medium text-gray-900">{shifts.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Scheduled Employees</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {new Set(shifts.map(s => s.employee_name)).size}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Hours</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {shifts.reduce((total, shift) => total + (shift.duration_hours || 0), 0).toFixed(1)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Conflicts</dt>
                  <dd className="text-lg font-medium text-gray-900">{conflicts.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shift Form Modal */}
      {showShiftForm && (
        <ShiftForm
          shift={selectedShift}
          employees={employees}
          templates={templates}
          onSubmit={handleCreateShift}
          onClose={() => {
            setShowShiftForm(false);
            setSelectedShift(null);
          }}
          isLoading={createShiftMutation.isLoading || updateShiftMutation.isLoading}
        />
      )}

      {/* Spreadsheet Importer Modal */}
      {showSpreadsheetImporter && (
        <SpreadsheetImporter
          employees={employees}
          onImport={handleSpreadsheetImport}
          onClose={() => setShowSpreadsheetImporter(false)}
        />
      )}

      {/* Bulk Create Form Modal */}
      {showBulkForm && (
        <BulkShiftForm
          employees={employees}
          templates={templates}
          onSubmit={handleBulkCreate}
          onClose={() => setShowBulkForm(false)}
          isLoading={bulkCreateMutation.isLoading}
        />
      )}
    </div>
  );
};

// Simple ShiftForm component
const ShiftForm = ({ shift, employees, templates, onSubmit, onClose, isLoading }) => {
  // Helper function to extract time from datetime string (naive, no timezone conversion)
  const extractTimeFromDatetime = (datetimeString) => {
    if (!datetimeString) return '';
    try {
      // Extract time portion directly from the string without timezone conversion
      // Format: "2026-01-28 09:00:00" or "2026-01-28T09:00:00"
      const timePart = datetimeString.split('T')[1] || datetimeString.split(' ')[1];
      if (timePart) {
        // Return HH:MM format
        return timePart.substring(0, 5);
      }
      return '';
    } catch (error) {
      return '';
    }
  };

  // Helper function to extract date from datetime string (naive, no timezone conversion)
  const extractDateFromDatetime = (datetimeString) => {
    if (!datetimeString) return '';
    try {
      // Extract date portion directly from the string without timezone conversion
      // Format: "2026-01-28 09:00:00" or "2026-01-28T09:00:00"
      const datePart = datetimeString.split('T')[0] || datetimeString.split(' ')[0];
      return datePart; // Already in YYYY-MM-DD format
    } catch (error) {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    employee: shift?.employee || '',
    date: shift ? (extractDateFromDatetime(shift.start_time_local || shift.start_time) || shift.date) : format(new Date(), 'yyyy-MM-dd'),
    start_time: shift ? extractTimeFromDatetime(shift.start_time_local || shift.start_time) : '09:00',
    end_time: shift ? extractTimeFromDatetime(shift.end_time_local || shift.end_time) : '17:00',
    shift_type: shift?.shift_type || 'REGULAR',
    location: shift?.location || '',
    notes: shift?.notes || '',
    is_published: shift?.is_published !== undefined ? shift.is_published : true, // Default to published for new shifts
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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            {shift ? 'Edit Shift' : 'Add New Shift'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Employee</label>
            <select
              name="employee"
              value={formData.employee}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Employee</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.user.first_name} {emp.user.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              disabled={shift && shift.date} // Lock date if it was pre-selected from the table
              className={`mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                shift && shift.date ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Shift Type</label>
            <select
              name="shift_type"
              value={formData.shift_type}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="REGULAR">Regular</option>
              <option value="OVERTIME">Overtime</option>
              <option value="HOLIDAY">Holiday</option>
              <option value="NIGHT">Night</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Work location"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes..."
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_published"
              checked={formData.is_published}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm font-medium text-gray-700">
              Publish shift (make visible to employee)
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : (shift ? 'Update Shift' : 'Create Shift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Simple BulkShiftForm component
const BulkShiftForm = ({ employees, templates, onSubmit, onClose, isLoading }) => {
  const [formData, setFormData] = useState({
    employees: [],
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(addDays(new Date(), 6), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '17:00',
    shift_type: 'REGULAR',
    days_of_week: [0, 1, 2, 3, 4], // Monday to Friday (0=Mon, 6=Sun)
    is_published: true, // Default to published for bulk shifts
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

  const handleEmployeeChange = (employeeId) => {
    setFormData(prev => ({
      ...prev,
      employees: prev.employees.includes(employeeId)
        ? prev.employees.filter(id => id !== employeeId)
        : [...prev.employees, employeeId]
    }));
  };

  const handleDayChange = (day) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day]
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Bulk Create Shifts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center space-x-2 p-1">
                  <input
                    type="checkbox"
                    checked={formData.employees.includes(emp.id)}
                    onChange={() => handleEmployeeChange(emp.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{emp.user.first_name} {emp.user.last_name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
            <div className="flex space-x-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                <label key={day} className="flex items-center space-x-1">
                  <input
                    type="checkbox"
                    checked={formData.days_of_week.includes(index)}
                    onChange={() => handleDayChange(index)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_published"
              checked={formData.is_published}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm font-medium text-gray-700">
              Publish all shifts (make visible to employees)
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || formData.employees.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Shifts'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminScheduling;
