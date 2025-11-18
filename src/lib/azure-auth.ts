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
    
    // CRÍTICO: Limpiar estados de interacción DESPUÉS de inicializar
    console.log('[Azure Auth] Limpiando estados de interacción previos...');
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('interaction')) {
        sessionStorage.removeItem(key);
        console.log('[Azure Auth] Removido:', key);
      }
    });
    
    console.log('[Azure Auth] Iniciando loginRedirect...');
    await instance.loginRedirect(loginRequest);
    return { error: null };
  } catch (error: any) {
    console.error('Error en redirect Azure:', error);
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
