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
  // Procesa cualquier redirect pendiente y limpia el estado "interaction_in_progress"
  // que pueda haber quedado trabado por un intento previo que no completó
  // (p.ej. cuando Microsoft devuelve un error AADSTS y no se vuelve al callback).
  try {
    await instance.handleRedirectPromise();
  } catch {
    /* sin redirect pendiente o ya procesado */
  }
  return instance;
}

export async function signInWithAzurePopup() {
  try {
    const instance = await initializeMsal();
    const result = await instance.loginPopup(loginRequest);
    return { user: result.account, accessToken: result.accessToken, idToken: result.idToken, error: null };
  } catch (error: any) {
    console.error('Error en login Azure:', error);
    return { user: null, accessToken: null, idToken: null, error };
  }
}

export async function signInWithAzureRedirect() {
  try {
    const instance = await initializeMsal();
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
    if (result) {
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
