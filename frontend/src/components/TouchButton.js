import React, { useState } from 'react';

const TouchButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon = null,
  className = '',
  hapticFeedback = true,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = () => {
    if (!disabled && !loading) {
      setIsPressed(true);
      
      // Haptic feedback for supported devices
      if (hapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(10); // Very short vibration
      }
    }
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
  };

  const handleClick = (e) => {
    if (!disabled && !loading && onClick) {
      onClick(e);
    }
  };

  // Base classes for touch optimization
  const baseClasses = `
    relative inline-flex items-center justify-center
    font-medium rounded-lg transition-all duration-150 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    select-none touch-manipulation
    active:scale-95 transform
    ${disabled || loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
    ${fullWidth ? 'w-full' : ''}
    ${isPressed ? 'scale-95' : 'scale-100'}
  `;

  // Size variants with touch-friendly dimensions
  const sizeClasses = {
    small: 'px-4 py-2.5 text-sm min-h-[44px]', // 44px minimum for touch targets
    medium: 'px-6 py-3 text-base min-h-[48px]',
    large: 'px-8 py-4 text-lg min-h-[52px]',
    xlarge: 'px-10 py-5 text-xl min-h-[56px]'
  };

  // Color variants
  const variantClasses = {
    primary: `
      bg-blue-600 text-white border border-transparent
      hover:bg-blue-700 focus:ring-blue-500
      active:bg-blue-800
    `,
    secondary: `
      bg-gray-600 text-white border border-transparent
      hover:bg-gray-700 focus:ring-gray-500
      active:bg-gray-800
    `,
    success: `
      bg-green-600 text-white border border-transparent
      hover:bg-green-700 focus:ring-green-500
      active:bg-green-800
    `,
    danger: `
      bg-red-600 text-white border border-transparent
      hover:bg-red-700 focus:ring-red-500
      active:bg-red-800
    `,
    warning: `
      bg-yellow-600 text-white border border-transparent
      hover:bg-yellow-700 focus:ring-yellow-500
      active:bg-yellow-800
    `,
    outline: `
      bg-white text-gray-700 border border-gray-300
      hover:bg-gray-50 focus:ring-gray-500
      active:bg-gray-100
    `,
    ghost: `
      bg-transparent text-gray-700 border border-transparent
      hover:bg-gray-100 focus:ring-gray-500
      active:bg-gray-200
    `,
    link: `
      bg-transparent text-blue-600 border border-transparent
      hover:text-blue-800 focus:ring-blue-500
      active:text-blue-900 underline
    `
  };

  const combinedClasses = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      className={combinedClasses}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
        </div>
      )}
      
      <div className={`flex items-center justify-center space-x-2 ${loading ? 'opacity-0' : 'opacity-100'}`}>
        {icon && (
          <span className="flex-shrink-0">
            {React.cloneElement(icon, {
              className: `${icon.props?.className || ''} ${
                size === 'small' ? 'h-4 w-4' :
                size === 'medium' ? 'h-5 w-5' :
                size === 'large' ? 'h-6 w-6' : 'h-7 w-7'
              }`.trim()
            })}
          </span>
        )}
        <span>{children}</span>
      </div>
    </button>
  );
};

// Preset button components for common use cases
export const PrimaryButton = (props) => <TouchButton variant="primary" {...props} />;
export const SecondaryButton = (props) => <TouchButton variant="secondary" {...props} />;
export const SuccessButton = (props) => <TouchButton variant="success" {...props} />;
export const DangerButton = (props) => <TouchButton variant="danger" {...props} />;
export const OutlineButton = (props) => <TouchButton variant="outline" {...props} />;
export const GhostButton = (props) => <TouchButton variant="ghost" {...props} />;
export const LinkButton = (props) => <TouchButton variant="link" {...props} />;

// Floating Action Button for mobile
export const FloatingActionButton = ({ 
  children, 
  onClick, 
  className = '',
  position = 'bottom-right',
  ...props 
}) => {
  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'bottom-center': 'fixed bottom-6 left-1/2 transform -translate-x-1/2',
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6',
  };

  return (
    <TouchButton
      onClick={onClick}
      className={`
        ${positionClasses[position]}
        h-14 w-14 rounded-full shadow-lg z-50
        bg-blue-600 text-white hover:bg-blue-700
        focus:ring-4 focus:ring-blue-300
        ${className}
      `}
      hapticFeedback={true}
      {...props}
    >
      {children}
    </TouchButton>
  );
};

export default TouchButton;
