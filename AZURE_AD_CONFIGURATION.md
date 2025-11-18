# Configuración de Azure AD para UGM ProctoTeam

## Información de la Aplicación

- **Tenant ID**: `05970e72-c674-4f1f-8033-6e35dd7f76aa`
- **Client ID**: `e9f08a61-0e07-4a60-b825-c6041cdf0505`
- **Nombre**: UGM ProctoTeam

## Redirect URIs Requeridas

Para que la autenticación funcione correctamente, debes agregar las siguientes URIs de redirección en el portal de Azure AD:

### ⚠️ IMPORTANTE: No incluir puerto en URIs de Replit

Las URIs de Replit **NO** deben incluir el puerto `:5000`. Azure AD espera URIs sin puerto para dominios HTTPS.

### Entorno de Producción
```
https://UGM-proctoring.replit.app/auth/callback
```

### Entorno de Desarrollo (Replit Dev)
```
https://6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev/auth/callback
```

**NOTA**: Si tu dominio de desarrollo cambia, actualiza esta URI en Azure AD. El dominio de desarrollo de Replit puede cambiar con el tiempo.

### Localhost (Desarrollo Local)
```
http://localhost:5000/auth/callback
```

**NOTA**: Para localhost, SÍ se incluye el puerto `:5000` porque es desarrollo local.

## Cómo Configurar en Azure AD

1. Ve al [Portal de Azure](https://portal.azure.com)
2. Navega a **Azure Active Directory** > **App registrations**
3. Busca y selecciona tu aplicación (Client ID: `e9f08a61-0e07-4a60-b825-c6041cdf0505`)
4. En el menú lateral, selecciona **Authentication**
5. En la sección **Platform configurations**, haz clic en **Add a platform**
6. Selecciona **Single-page application (SPA)**
7. Agrega las siguientes Redirect URIs (⚠️ **sin puerto** para dominios de Replit):
   - `https://UGM-proctoring.replit.app/auth/callback` ✅
   - `https://6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev/auth/callback` ✅
   - `http://localhost:5000/auth/callback` ✅ (con puerto para localhost)
8. En **Logout URLs**, puedes agregar:
   - `https://UGM-proctoring.replit.app`
   - `http://localhost:5000`
9. Marca las casillas de:
   - **Access tokens** (si usas flujo implícito)
   - **ID tokens**
10. Haz clic en **Save**

## Permisos API Requeridos

Asegúrate de que la aplicación tiene los siguientes permisos de Microsoft Graph:

- **User.Read** (Delegated)
- **openid** (Delegated)
- **profile** (Delegated)
- **email** (Delegated)

## Tipo de Flujo de Autenticación

La aplicación usa **MSAL (Microsoft Authentication Library)** con:
- **Popup flow**: Ventana emergente para iniciar sesión
- **Redirect flow**: Redirección a `/auth/callback` después de la autenticación

## Verificación

Después de configurar las Redirect URIs en Azure AD:

1. Accede a `https://UGM-proctoring.replit.app/student/login` o `/instructor/login`
2. Haz clic en "Ingresar con Microsoft"
3. Se abrirá una ventana emergente de Azure AD
4. Después de autenticarte, serás redirigido a `/auth/callback`
5. Finalmente, serás enviado al portal correspondiente (estudiante o instructor)

## Notas Importantes

- La URI de callback **DEBE** coincidir exactamente con la configurada en Azure AD
- Asegúrate de incluir el protocolo correcto (`https://` para producción, `http://` solo para localhost)
- La ruta `/auth/callback` es estándar para aplicaciones OAuth2/OIDC en Replit
- Si cambias el dominio de producción, actualiza la Redirect URI en Azure AD

## Troubleshooting

### Error: "Redirect URI mismatch" (AADSTS50011)
- ⚠️ **Verifica que NO incluyas el puerto `:5000` en las URIs de Replit** en Azure AD
- Las URIs de Replit deben ser: `https://[dominio].replit.dev/auth/callback` (SIN puerto)
- Solo localhost debe incluir puerto: `http://localhost:5000/auth/callback`
- Verifica que la URI en Azure AD coincida exactamente con la que la aplicación está enviando
- Asegúrate de que no haya espacios o caracteres adicionales
- Revisa el protocolo (http/https)
- Si el dominio de desarrollo de Replit cambió, actualiza la URI en Azure AD

### Error: "Invalid client"
- Verifica el Client ID en `msal-config.ts`
- Asegúrate de estar usando el Tenant ID correcto

### No se redirige después del login
- Verifica que la página `/auth/callback` existe
- Revisa la consola del navegador para errores
- Verifica que `sessionStorage` tenga el valor `loginRole` correcto
