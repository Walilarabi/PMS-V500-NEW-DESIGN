import React from 'react';
import { cn } from '@/src/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  [key: string]: any;
}

export const Badge = ({ children, variant = 'neutral', className, ...props }: BadgeProps) => {
  const variants = {
    success: "bg-emerald-50 text-emerald-600 border-emerald-100",
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    danger: "bg-red-50 text-red-600 border-red-100",
    info: "bg-blue-50 text-blue-600 border-blue-100",
    neutral: "bg-gray-50 text-gray-600 border-gray-100",
  };

  return (
    <span 
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        variants[variant as keyof typeof variants] || variants.neutral,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
