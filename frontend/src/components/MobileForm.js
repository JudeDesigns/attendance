import React, { useState } from 'react';
import { XMarkIcon as XIcon, CheckIcon } from '@heroicons/react/24/outline';

const MobileForm = ({
  title,
  fields = [],
  onSubmit,
  onCancel,
  submitText = "Submit",
  cancelText = "Cancel",
  isLoading = false,
  initialData = {},
  className = ""
}) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: null
      }));
    }
  };

  const handleBlur = (fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    // Validate field on blur
    const field = fields.find(f => f.name === fieldName);
    if (field && field.validate) {
      const error = field.validate(formData[fieldName], formData);
      if (error) {
        setErrors(prev => ({
          ...prev,
          [fieldName]: error
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    fields.forEach(field => {
      const fieldValue = formData[field.name] || field.defaultValue;
      if (field.required && !fieldValue) {
        newErrors[field.name] = `${field.label} is required`;
      } else if (field.validate) {
        const error = field.validate(fieldValue, formData);
        if (error) {
          newErrors[field.name] = error;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      // Include default values for fields that don't have explicit values
      const submitData = { ...formData };
      fields.forEach(field => {
        if (!submitData[field.name] && field.defaultValue) {
          submitData[field.name] = field.defaultValue;
        }
      });
      onSubmit(submitData);
    }
  };

  const renderField = (field) => {
    const value = formData[field.name] || field.defaultValue || '';
    const error = errors[field.name];
    const isTouched = touched[field.name];

    const baseInputClasses = `
      block w-full px-4 py-3 text-base border rounded-lg
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
      transition-colors duration-200
      ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}
      ${field.disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
    `;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <input
            type={field.type}
            id={field.name}
            name={field.name}
            value={value}
            placeholder={field.placeholder}
            disabled={field.disabled || isLoading}
            className={baseInputClasses}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
            autoComplete={field.autoComplete}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );

      case 'textarea':
        return (
          <textarea
            id={field.name}
            name={field.name}
            value={value}
            placeholder={field.placeholder}
            disabled={field.disabled || isLoading}
            rows={field.rows || 4}
            className={baseInputClasses + ' resize-none'}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
          />
        );

      case 'select':
        return (
          <select
            id={field.name}
            name={field.name}
            value={value}
            disabled={field.disabled || isLoading}
            className={baseInputClasses}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
          >
            {field.placeholder && (
              <option value="">{field.placeholder}</option>
            )}
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              id={field.name}
              name={field.name}
              checked={!!value}
              disabled={field.disabled || isLoading}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              onChange={(e) => handleInputChange(field.name, e.target.checked)}
            />
            <label htmlFor={field.name} className="ml-3 text-sm text-gray-700">
              {field.checkboxLabel || field.label}
            </label>
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-3">
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center">
                <input
                  type="radio"
                  id={`${field.name}_${option.value}`}
                  name={field.name}
                  value={option.value}
                  checked={value === option.value}
                  disabled={field.disabled || isLoading}
                  className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                />
                <label htmlFor={`${field.name}_${option.value}`} className="ml-3 text-sm text-gray-700">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        );

      case 'date':
      case 'datetime-local':
      case 'time':
        return (
          <input
            type={field.type}
            id={field.name}
            name={field.name}
            value={value}
            disabled={field.disabled || isLoading}
            className={baseInputClasses}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
            min={field.min}
            max={field.max}
          />
        );

      default:
        return (
          <input
            type="text"
            id={field.name}
            name={field.name}
            value={value}
            placeholder={field.placeholder}
            disabled={field.disabled || isLoading}
            className={baseInputClasses}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
          />
        );
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      {title && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 rounded-full"
              >
                <XIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {fields.map((field) => (
          <div key={field.name}>
            {field.type !== 'checkbox' && (
              <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
            
            {renderField(field)}
            
            {errors[field.name] && (
              <p className="mt-2 text-sm text-red-600">{errors[field.name]}</p>
            )}
            
            {field.help && !errors[field.name] && (
              <p className="mt-2 text-sm text-gray-500">{field.help}</p>
            )}
          </div>
        ))}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t border-gray-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <CheckIcon className="h-4 w-4 mr-2" />
            )}
            {submitText}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MobileForm;
