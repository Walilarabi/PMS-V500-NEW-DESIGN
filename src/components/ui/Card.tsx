import React, { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div 
    className={cn(
      "bg-white rounded-[20px] border border-[#F3F4F6] shadow-[0_2px_8px_rgba(0,0,0,0.03)]",
      className
    )} 
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("p-4 px-6 border-b border-[#F3F4F6] flex items-center justify-between", className)} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("p-6", className)} {...props}>
    {children}
  </div>
);
