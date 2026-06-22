
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLoading } from '@/context/loading-context';

export function GlobalNavigationHandler() {
  const { hideLoader } = useLoading();
  const pathname = usePathname();

  useEffect(() => {
    // This effect handles the initial page load.
    // We might not need it if the initial state is false, but it's good for safety.
    hideLoader();
  }, [hideLoader]);
  
  useEffect(() => {
    // Hide loader when the new page component has mounted
    hideLoader();
  }, [pathname, hideLoader]);

  return null;
}
