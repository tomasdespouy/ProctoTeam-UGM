
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTheme } from 'next-themes';

interface LogoProps {
  width?: number;
  height?: number;
}

export function PortalLogo({ width = 48, height = 48 }: LogoProps) {
  const { resolvedTheme } = useTheme();
  // Default to the light theme logo URL
  const [logoSrc, setLogoSrc] = useState("https://i.postimg.cc/65cC9b5h/Logo-UGM-alto-contraste-Blanco-01-1.png");

  useEffect(() => {
    // This effect runs only on the client, after hydration, to prevent mismatch errors.
    if (resolvedTheme === 'dark') {
      // Dark theme logo
      setLogoSrc("https://i.postimg.cc/0y9ZnJrV/UGM-logo-transparente-fondo-1.png");
    } else {
      // Light theme logo
      setLogoSrc("https://i.postimg.cc/65cC9b5h/Logo-UGM-alto-contraste-Blanco-01-1.png");
    }
  }, [resolvedTheme]);

  return (
    <Image
      src={logoSrc}
      alt="UGM Portal Logo"
      width={width}
      height={height}
      className="object-contain"
      priority
    />
  );
}
