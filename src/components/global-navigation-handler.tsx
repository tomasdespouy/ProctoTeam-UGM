
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLoading } from '@/context/loading-context';

export function GlobalNavigationHandler() {
  const { showLoader, hideLoader } = useLoading();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // This effect handles the initial page load.
    // We might not need it if the initial state is false, but it's good for safety.
    hideLoader();
  }, [hideLoader]);
  
  useEffect(() => {
    const originalPush = router.push;

    router.push = (...args: Parameters<typeof originalPush>) => {
      // Don't show loader if the path is the same
      if (args[0] !== pathname) {
         showLoader();
      }
      originalPush(...args);
    };

    return () => {
      router.push = originalPush;
    };
  }, [router, showLoader, pathname]);

  useEffect(() => {
    // Hide loader when the new page component has mounted
    hideLoader();
  }, [pathname, hideLoader]);

  return null;
}
