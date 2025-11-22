import { PublicClientApplication, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { msalConfig, loginRequest } from './msal-config';

let msalInstance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

export async function initializeMsal(): Promise<PublicClientApplication> {
  const instance = getMsalInstance();
  await instance.initialize();
  return instance;
}

export async function signInWithAzurePopup() {
  try {
    const instance = await initializeMsal();
    const result = await instance.loginPopup(loginRequest);
    if (result && result.account) {
      instance.setActiveAccount(result.account);
    }
    return { user: result.account, accessToken: result.accessToken, idToken: result.idToken, error: null };
  } catch (error: any) {
    console.error('Error en login Azure:', error);
    return { user: null, accessToken: null, idToken: null, error };
  }
}

export async function signInWithAzureRedirect() {
  try {
    console.log('[Azure Auth] Inicializando MSAL...');
    const instance = await initializeMsal();
    console.log('[Azure Auth] MSAL inicializado correctamente');
    
    // IMPORTANTE: NO limpiar los estados de interacción antes de loginRedirect
    // MSAL necesita estos estados para procesar el callback correctamente
    
    console.log('[Azure Auth] loginRequest:', loginRequest);
    console.log('[Azure Auth] Iniciando loginRedirect...');
    console.log('[Azure Auth] Cliente ID:', 'e9f08a61-0e07-4a60-b825-c6041cdf0505');
    console.log('[Azure Auth] Authority:', 'https://login.microsoftonline.com/05970e72-c674-4f1f-8033-6e35dd7f76aa');
    console.log('[Azure Auth] Redirect URI:', window.location.origin + '/auth/callback');
    
    // Hacer el redirect - esto NO debe esperar porque redirige el navegador
    instance.loginRedirect(loginRequest).catch((error: any) => {
      console.error('[Azure Auth] Error en loginRedirect:', error);
      console.error('[Azure Auth] Error details:', {
        message: error?.message,
        code: error?.error,
        description: error?.error_description,
      });
    });
    
    // La función devuelve aquí porque el navegador será redirigido
    return { error: null };
  } catch (error: any) {
    console.error('[Azure Auth] Error en signInWithAzureRedirect:', error);
    console.error('[Azure Auth] Error stack:', error?.stack);
    return { error };
  }
}

export async function handleAzureRedirectResult() {
  try {
    const instance = await initializeMsal();
    const result = await instance.handleRedirectPromise();
    if (result && result.account) {
      // IMPORTANTE: Establecer la cuenta como activa
      instance.setActiveAccount(result.account);
      console.log('[Azure Auth] Cuenta activa establecida:', result.account.username);
      return { user: result.account, accessToken: result.accessToken, idToken: result.idToken, error: null };
    }
    return { user: null, accessToken: null, idToken: null, error: null };
  } catch (error: any) {
    console.error('Error procesando redirect:', error);
    return { user: null, accessToken: null, idToken: null, error };
  }
}

export async function signOut() {
  try {
    const instance = await initializeMsal();
    await instance.logoutPopup();
    return { error: null };
  } catch (error: any) {
    console.error('Error en logout:', error);
    return { error };
  }
}

export async function getActiveAccount(): Promise<AccountInfo | null> {
  const instance = getMsalInstance();
  return instance.getActiveAccount();
}

export async function acquireTokenSilent(): Promise<string | null> {
  try {
    const instance = await initializeMsal();
    const account = instance.getActiveAccount();
    
    if (!account) {
      return null;
    }

    const result = await instance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    return result.idToken;
  } catch (error) {
    console.error('Error acquiring token silently:', error);
    return null;
  }
}
