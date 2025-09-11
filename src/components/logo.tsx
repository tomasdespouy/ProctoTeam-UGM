
'use client';

import React from 'react';
import Image from 'next/image';

interface LogoProps {
  width?: number;
  height?: number;
}

export function Logo({ width = 250, height = 250 }: LogoProps) {
  // This component now uses a single, fixed logo for the main/login pages.
  const logoSrc = "https://i.postimg.cc/0y9ZnJrV/UGM-logo-transparente-fondo-1.png";

  return (
    <Image
      src={logoSrc}
      alt="UGM Logo"
      width={width}
      height={height}
      className="object-contain"
      priority
    />
  );
}
