import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}) => {
  const variants = {
    primary: "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-sm font-semibold",
    secondary: "bg-[#F3F4F6] text-gray-900 hover:bg-gray-200",
    outline: "border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white shadow-sm font-semibold",
    ghost: "text-[#8B5CF6] hover:bg-[#8B5CF6]/10 font-semibold",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-[11px]",
    md: "px-4 py-2 text-[13px]",
    lg: "px-6 py-3 text-[15px]",
  };

  return (
    <button 
      className={cn(
        "rounded-xl transition-all duration-200 flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
