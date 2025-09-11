import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/context/auth-context';
import { ThemeProvider } from '@/components/theme-provider';
import { AccessibilityControls } from '@/components/accessibility-controls';
import { LoadingProvider } from '@/context/loading-context';
import { PageLoader } from '@/components/ui/page-loader';
import { Suspense } from 'react';
import { GlobalNavigationHandler } from '@/components/global-navigation-handler';
import { ErrorRecovery } from '@/components/error-recovery';


export const metadata: Metadata = {
  title: 'UGM Proctor',
  description: 'Sistema de Proctoring (vigilancia en línea) de exámenes universitarios.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
          <LoadingProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
              <Toaster />
              <AccessibilityControls />
              <PageLoader />
              <Suspense fallback={null}>
                <GlobalNavigationHandler />
              </Suspense>
              <ErrorRecovery />
          </LoadingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
