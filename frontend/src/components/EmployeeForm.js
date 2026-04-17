import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'react-query';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { employeeAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EmployeeForm = ({ employee, onClose, onSuccess }) => {
  const { isSubAdmin } = useAuth();
  const isEditing = !!employee;

  // Password change state (edit mode only)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    // User fields
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',

    // Employee fields
    employee_id: '',
    role: '',
    phone_number: '',
    address: '',
    date_of_birth: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    hire_date: (() => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const g = (t) => p.find(x => x.type === t)?.value || ''; return `${g('year')}-${g('month')}-${g('day')}`; })(),
    employment_status: 'ACTIVE',
    department: '',
    job_title: '',
    hourly_rate: '',

    // QR Code Enforcement
    requires_location_qr: false,
    qr_enforcement_type: 'NONE',
  });

  const [errors, setErrors] = useState({});

  // Fetch roles
  const { data: rolesData, error: rolesError, isLoading: rolesLoading } = useQuery('roles', () => employeeAPI.getRoles(), {
    onSuccess: (data) => {
      console.log('Roles data received:', data);
    },
    onError: (error) => {
      console.error('Roles fetch error:', error);
    }
  });

  // Initialize form data when editing
  useEffect(() => {
    if (employee) {
      setFormData({
        first_name: employee.user.first_name || '',
        last_name: employee.user.last_name || '',
        email: employee.user.email || '',
        username: employee.user.username || '',
        password: '', // Don't populate password for editing

        employee_id: employee.employee_id || '',
        role: employee.role?.id || employee.role || '',
        phone_number: employee.phone_number || '',
        address: employee.address || '',
        date_of_birth: employee.date_of_birth || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        hire_date: employee.hire_date || (() => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const g = (t) => p.find(x => x.type === t)?.value || ''; return `${g('year')}-${g('month')}-${g('day')}`; })(),
        employment_status: employee.employment_status || 'ACTIVE',
        department: employee.department || '',
        job_title: employee.job_title || '',
        hourly_rate: employee.hourly_rate || '',

        // QR Code Enforcement
        requires_location_qr: employee.requires_location_qr || false,
        qr_enforcement_type: employee.qr_enforcement_type || 'NONE',
      });
    }
  }, [employee]);

  // Create/Update mutation
  const mutation = useMutation(
    (data) => {
      if (isEditing) {
        return employeeAPI.update(employee.id, data);
      } else {
        return employeeAPI.create(data);
      }
    },
    {
      onSuccess: () => {
        onSuccess();
      },
      onError: (error) => {
        if (error.response?.data) {
          setErrors(error.response.data);
        } else {
          setErrors({ non_field_errors: [error.message] });
        }
      },
    }
  );

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    setPasswordError('');

    // Basic validation
    const requiredFields = ['first_name', 'last_name', 'email', 'employee_id', 'role'];
    if (!isEditing) {
      requiredFields.push('username', 'password');
    }

    const newErrors = {};
    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = ['This field is required.'];
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Validate password fields in edit mode if either is filled
    if (isEditing && (newPassword || confirmPassword)) {
      if (newPassword.length < 8) {
        setPasswordError('Password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match.');
        return;
      }
    }

    // Prepare data for submission
    const submitData = { ...formData };

    // Convert empty strings to null for nullable optional fields
    ['date_of_birth', 'hourly_rate'].forEach(field => {
      if (submitData[field] === '') {
        submitData[field] = null;
      }
    });

    // Convert hourly_rate to number if provided
    if (submitData.hourly_rate) {
      submitData.hourly_rate = parseFloat(submitData.hourly_rate);
    }

    // Include new password if provided in edit mode
    if (isEditing && newPassword) {
      submitData.new_password = newPassword;
      // Show confirmation modal before applying password change
      setPendingSubmitData(submitData);
      setShowConfirm(true);
      return;
    }

    mutation.mutate(submitData);
  };

  const handleConfirmSubmit = () => {
    setShowConfirm(false);
    mutation.mutate(pendingSubmitData);
    setPendingSubmitData(null);
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
    setPendingSubmitData(null);
  };

  const getFieldError = (fieldName) => {
    return errors[fieldName] || errors[`user.${fieldName}`] || errors.non_field_errors;
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditing ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6">
          {/* Error Messages */}
          {errors.non_field_errors && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-800">
                {errors.non_field_errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b pb-2">
                Personal Information
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  First Name *
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('first_name') ? 'border-red-300' : 'border-gray-300'
                    }`}
                />
                {getFieldError('first_name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('first_name')[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('last_name') ? 'border-red-300' : 'border-gray-300'
                    }`}
                />
                {getFieldError('last_name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('last_name')[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('email') ? 'border-red-300' : 'border-gray-300'
                    }`}
                />
                {getFieldError('email') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('email')[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Employment Information */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b pb-2">
                Employment Information
              </h4>

              {!isEditing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Username *
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('username') ? 'border-red-300' : 'border-gray-300'
                        }`}
                    />
                    {getFieldError('username') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('username')[0]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('password') ? 'border-red-300' : 'border-gray-300'
                        }`}
                    />
                    {getFieldError('password') && (
                      <p className="mt-1 text-sm text-red-600">{getFieldError('password')[0]}</p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Employee ID *
                </label>
                <input
                  type="text"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('employee_id') ? 'border-red-300' : 'border-gray-300'
                    }`}
                />
                {getFieldError('employee_id') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('employee_id')[0]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={rolesLoading}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${getFieldError('role') ? 'border-red-300' : 'border-gray-300'
                    }`}
                >
                  <option value="">{rolesLoading ? 'Loading roles...' : 'Select a role'}</option>
                  {(() => {
                    // Handle different possible data structures
                    let roles = null;
                    if (rolesData?.data?.results) {
                      roles = rolesData.data.results;
                    } else if (rolesData?.results) {
                      roles = rolesData.results;
                    } else if (Array.isArray(rolesData?.data)) {
                      roles = rolesData.data;
                    } else if (Array.isArray(rolesData)) {
                      roles = rolesData;
                    }

                    console.log('Raw rolesData:', rolesData);
                    console.log('Extracted roles:', roles);

                    if (!Array.isArray(roles)) {
                      console.error('Roles is not an array:', roles);
                      return <option disabled>Error loading roles</option>;
                    }
                    
                    let filteredRoles = roles;
                    if (isSubAdmin) {
                      filteredRoles = roles.filter(r => 
                        r.name !== 'ADMIN' && 
                        r.name !== 'SUPER_ADMIN' && 
                        r.name !== 'SUB_ADMIN'
                      );
                    }

                    return filteredRoles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ));
                  })()}
                </select>
                {getFieldError('role') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('role')[0]}</p>
                )}
                {rolesError && (
                  <p className="mt-1 text-sm text-red-600">Failed to load roles: {rolesError.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Employment Status
                </label>
                <select
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Job Title
                </label>
                <input
                  type="text"
                  name="job_title"
                  value={formData.job_title}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hire Date
                </label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hourly Rate ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="hourly_rate"
                  value={formData.hourly_rate}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* QR Code Enforcement */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Clock-In/Out Settings
            </h4>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="requires_location_qr"
                    name="requires_location_qr"
                    type="checkbox"
                    checked={formData.requires_location_qr}
                    onChange={handleChange}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="requires_location_qr" className="font-medium text-gray-700">
                    Require Location QR Code
                  </label>
                  <p className="text-gray-500">
                    When enabled, this employee must use location QR codes for clock-in/out operations
                  </p>
                </div>
              </div>

              {formData.requires_location_qr && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    QR Code Enforcement Level
                  </label>
                  <select
                    name="qr_enforcement_type"
                    value={formData.qr_enforcement_type}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="NONE">No Enforcement</option>
                    <option value="FIRST_CLOCK_IN">First Clock-In of Day Only</option>
                    <option value="ALL_OPERATIONS">All Clock-In/Out Operations</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    {formData.qr_enforcement_type === 'FIRST_CLOCK_IN' &&
                      'Employee must scan QR code for their first clock-in each day'
                    }
                    {formData.qr_enforcement_type === 'ALL_OPERATIONS' &&
                      'Employee must scan QR code for every clock-in and clock-out'
                    }
                    {formData.qr_enforcement_type === 'NONE' &&
                      'QR code scanning is optional'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Emergency Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="emergency_contact_name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="emergency_contact_phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Change Password — edit mode only */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-md font-medium text-gray-900 mb-1">Change Password</h4>
              <p className="text-sm text-gray-500 mb-4">Leave blank to keep the current password.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${passwordError ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${passwordError ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              {passwordError && (
                <p className="mt-2 text-sm text-red-600">{passwordError}</p>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="mt-6 pt-6 border-t flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {mutation.isLoading ? 'Saving...' : (isEditing ? 'Update Employee' : 'Create Employee')}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 bg-yellow-100 rounded-full p-2">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Password Change</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              You are about to change the password for <span className="font-medium text-gray-900">{employee?.user?.first_name} {employee?.user?.last_name}</span>. They will need to use the new password on their next login.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Yes, Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeForm;
