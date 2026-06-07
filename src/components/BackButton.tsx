'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export default function BackButton({ ...props }: BackButtonProps) {
  return (
    <Button variant="ghost" {...props}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  );
}
