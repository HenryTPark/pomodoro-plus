'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export default function SettingsButton({ ...props }: SettingsButtonProps) {
  return (
    <Button variant="ghost" {...props}>
      <Settings className="mr-2 h-4 w-4" />
      Settings
    </Button>
  );
}
