import { OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth } from "./firebase";

// Configuración de Azure AD
const tenantId = "05970e72-c674-4f1f-8033-6e35dd7f76aa";
const clientId = "e9f08a61-0e07-4a60-b825-c6041cdf0505";

// Crear proveedor de Microsoft Azure AD
export function createAzureProvider() {
  const provider = new OAuthProvider('microsoft.com');
  
  // Configurar tenant específico de UGM
  provider.setCustomParameters({
    tenant: tenantId,
    prompt: 'select_account',
  });

  return provider;
}

// Login con popup (más rápido)
export async function signInWithAzurePopup() {
  const provider = createAzureProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error("Error en login Azure:", error);
    return { user: null, error };
  }
}

// Login con redirect (más compatible con móviles)
export async function signInWithAzureRedirect() {
  const provider = createAzureProvider();
  try {
    await signInWithRedirect(auth, provider);
    return { error: null };
  } catch (error: any) {
    console.error("Error en redirect Azure:", error);
    return { error };
  }
}

// Procesar resultado después de redirect
export async function handleAzureRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return { user: result.user, error: null };
    }
    return { user: null, error: null };
  } catch (error: any) {
    console.error("Error procesando redirect:", error);
    return { user: null, error };
  }
}
