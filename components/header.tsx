"use client";

import { Menu, X } from 'lucide-react';
import { School } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface HeaderProps {
  onMenuToggle: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  schoolName?: string;
}

export function Header({ onMenuToggle, isMobileMenuOpen, schoolName = "School Deck" }: HeaderProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-35 bg-white border-b border-slate-200 shadow-sm md:hidden">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMenuToggle(!isMobileMenuOpen)}
            className="h-9 w-9 rounded-lg hover:bg-slate-100"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm flex-shrink-0">
              <School className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm truncate">{schoolName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
