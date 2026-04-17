import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { subAdminAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const PERMISSION_GROUPS = [
  {
    name: 'Dashboard & Reports',
    permissions: [
      { key: 'view_dashboard', label: 'View Dashboard' },
      { key: 'force_clockout', label: 'Force Clock-Out' },
      { key: 'view_reports', label: 'View Reports' },
      { key: 'generate_reports', label: 'Generate Reports' },
      { key: 'export_data', label: 'Export Data (CSV)' },
    ]
  },
  {
    name: 'Employee Management',
    permissions: [
      { key: 'view_employees', label: 'View Employees' },
      { key: 'create_employees', label: 'Create Employees' },
      { key: 'edit_employees', label: 'Edit Employees' },
      { key: 'manage_employee_status', label: 'Manage Status (Activate/Terminate)' },
      { key: 'delete_employees', label: 'Delete Employees (Hard Delete)' },
      { key: 'view_employee_status', label: 'View Employee Status Board' },
      { key: 'edit_time_logs', label: 'Edit Time Logs' },
    ]
  },
  {
    name: 'Scheduling & Leave',
    permissions: [
      { key: 'view_schedule', label: 'View Schedule' },
      { key: 'manage_schedule', label: 'Manage Schedule' },
      { key: 'manage_leave', label: 'Manage Leave Requests & Balances' },
    ]
  },
  {
    name: 'System Admin',
    permissions: [
      { key: 'manage_locations', label: 'Manage Locations' },
      { key: 'view_notifications', label: 'View Notifications & Logs' },
      { key: 'manage_notification_templates', label: 'Manage Notification Templates' },
      { key: 'manage_webhooks', label: 'Manage Webhooks' },
      { key: 'manage_payroll_settings', label: 'Manage Payroll Settings' },
      { key: 'manage_alert_settings', label: 'Manage Alert Settings' },
    ]
  }
];

const SubAdminManagement = () => {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSubAdmin, setSelectedSubAdmin] = useState(null);

  // Fetch sub-admins
  const { data: subAdminsData, isLoading } = useQuery(
    'sub-admins',
    () => subAdminAPI.list(),
    { refetchInterval: 30000 }
  );

  const subAdmins = subAdminsData?.data?.results || subAdminsData?.data || [];

  const deleteMutation = useMutation(subAdminAPI.delete, {
    onSuccess: () => {
      toast.success('Sub-admin deleted successfully');
      queryClient.invalidateQueries('sub-admins');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete sub-admin');
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to permanently delete this sub-admin?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (subAdmin) => {
    setSelectedSubAdmin(subAdmin);
    setShowCreateForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary flex items-center">
              <ShieldCheckIcon className="h-8 w-8 mr-3 text-indigo-600" />
              Sub-Admin Management
            </h1>
            <p className="glass-text-secondary mt-1">
              Create sub-admin accounts and granularly configure their system privileges.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedSubAdmin(null);
              setShowCreateForm(true);
            }}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Sub-Admin
          </button>
        </div>
      </div>

      {/* Sub-Admins List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading sub-admins...</p>
          </div>
        ) : subAdmins.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Sub-Admins</h3>
            <p className="mt-1 text-sm text-gray-500">Create a sub-admin to delegate responsibilities.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subAdmins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-700 font-medium">
                          {admin.user?.first_name?.[0]}{admin.user?.last_name?.[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {admin.user?.first_name} {admin.user?.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{admin.user?.email}</div>
                        <div className="text-xs text-gray-400 mt-0.5">ID: {admin.employee_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      admin.employment_status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {admin.employment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {admin.permissions?.length > 0 ? (
                        <>
                          <span className="text-sm text-gray-900 font-medium">{admin.permissions.length} privileges</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(admin)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(admin.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateForm && (
        <SubAdminForm
          subAdmin={selectedSubAdmin}
          onClose={() => {
            setShowCreateForm(false);
            setSelectedSubAdmin(null);
          }}
        />
      )}
    </div>
  );
};

const SubAdminForm = ({ subAdmin, onClose }) => {
  const queryClient = useQueryClient();
  const isEditing = !!subAdmin;

  const [formData, setFormData] = useState({
    username: subAdmin?.user?.username || '',
    email: subAdmin?.user?.email || '',
    password: '',
    first_name: subAdmin?.user?.first_name || '',
    last_name: subAdmin?.user?.last_name || '',
    employee_id: subAdmin?.employee_id || '',
    employment_status: subAdmin?.employment_status || 'ACTIVE',
    permissions: subAdmin?.permissions || [],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionToggle = (permissionKey) => {
    setFormData(prev => {
      const perms = prev.permissions;
      if (perms.includes(permissionKey)) {
        return { ...prev, permissions: perms.filter(p => p !== permissionKey) };
      } else {
        // Auto-grant view_employees if they select something that needs it
        const newPerms = [...perms, permissionKey];
        const needsViewEmployees = [
          'create_employees', 'edit_employees', 'manage_employee_status', 'delete_employees',
          'edit_time_logs', 'view_schedule', 'manage_schedule', 'manage_leave', 'view_notifications',
          'view_employee_status', 'export_data'
        ];
        if (needsViewEmployees.includes(permissionKey) && !newPerms.includes('view_employees')) {
            newPerms.push('view_employees');
        }
        return { ...prev, permissions: newPerms };
      }
    });
  };

  const mutation = useMutation(
    (data) => isEditing ? subAdminAPI.update(subAdmin.id, { permissions: data.permissions, employment_status: data.employment_status }) : subAdminAPI.create(data),
    {
      onSuccess: () => {
        toast.success(`Sub-admin ${isEditing ? 'updated' : 'created'} successfully`);
        queryClient.invalidateQueries('sub-admins');
        onClose();
      },
      onError: (error) => {
        const msg = error.response?.data;
        if (typeof msg === 'object') {
           const errStrings = Object.entries(msg).map(([k,v]) => `${k}: ${v}`).join(' | ');
           toast.error(errStrings);
        } else {
           toast.error(msg?.detail || msg?.message || `Failed to ${isEditing ? 'update' : 'create'} sub-admin`);
        }
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    // For creation, we might need a dummy role ID. Wait, the backend ignores it or expects it.
    // If we let the API handle it, we can just omit it or pass empty if not required.
    const payload = { ...formData };
    if (isEditing) {
      // Update serializer only accepts permissions and employment_status
      mutation.mutate({
        permissions: payload.permissions,
        employment_status: payload.employment_status
      });
    } else {
      mutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Edit Sub-Admin Privileges' : 'Create Sub-Admin'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <form id="subAdminForm" onSubmit={handleSubmit} className="space-y-6">
            {!isEditing && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Account Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                    <input type="text" name="first_name" required value={formData.first_name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                    <input type="text" name="last_name" required value={formData.last_name} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input type="email" name="email" required value={formData.email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username *</label>
                    <input type="text" name="username" required value={formData.username} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password *</label>
                    <input type="password" name="password" required value={formData.password} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" autoComplete="new-password" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Employee ID *</label>
                    <input type="text" name="employee_id" required value={formData.employee_id} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                </div>
              </div>
            )}

            {isEditing && (
               <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700">Employment Status</label>
                  <select name="employment_status" value={formData.employment_status} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
               </div>
            )}

            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-3">Privileges & Permissions</h4>
              <p className="text-sm text-gray-500 mb-4">Select the specific actions and pages this sub-admin can access. Note: "View Employees" is automatically granted if required by other selections.</p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.name} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                      <h5 className="font-semibold text-sm text-gray-700">{group.name}</h5>
                    </div>
                    <div className="p-4 space-y-3 bg-white">
                      {group.permissions.map((perm) => (
                        <div key={perm.key} className="flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id={`perm-${perm.key}`}
                              name={`perm-${perm.key}`}
                              type="checkbox"
                              checked={formData.permissions.includes(perm.key)}
                              onChange={() => handlePermissionToggle(perm.key)}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor={`perm-${perm.key}`} className="font-medium text-gray-700 cursor-pointer">
                              {perm.label}
                            </label>
                            <span className="block text-xs text-gray-500 font-mono mt-0.5">{perm.key}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            disabled={mutation.isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="subAdminForm"
            disabled={mutation.isLoading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isLoading ? 'Saving...' : 'Save Sub-Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubAdminManagement;
