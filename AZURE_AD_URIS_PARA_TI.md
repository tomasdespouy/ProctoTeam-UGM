# URIs para Configurar en Azure AD - UGM Proctoring

## 📋 Instrucciones para TI

**Cliente ID:** `e9f08a61-0e07-4a60-b825-c6041cdf0505`  
**Tenant ID:** `05970e72-c674-4f1f-8033-6e35dd7f76aa`

---

## ✅ URIs de Redirección (Redirect URIs)

Agregar estas URIs EXACTAS en la configuración de Azure AD:

### 1. Producción
```
https://UGM-proctoring.replit.app/auth/callback
```

### 2. Desarrollo (Replit Dev)
```
https://6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev/auth/callback
```

### 3. Localhost (opcional - solo para pruebas locales)
```
http://localhost:5000/auth/callback
```

---

## 🔧 Pasos de Configuración en Azure Portal

1. **Ir a Azure Active Directory**
   - Portal: https://portal.azure.com
   - Navegar a: Azure Active Directory → App registrations

2. **Buscar la aplicación**
   - Buscar por Client ID: `e9f08a61-0e07-4a60-b825-c6041cdf0505`
   - O por nombre de la aplicación

3. **Configurar Authentication**
   - En el menú lateral: **Authentication**
   - En **Platform configurations**: Seleccionar **Single-page application (SPA)**
   - Agregar las 3 URIs listadas arriba

4. **Configurar Tokens**
   - En la misma página de Authentication
   - Marcar las siguientes casillas:
     - ✅ **Access tokens** (used for implicit flows)
     - ✅ **ID tokens** (used for implicit and hybrid flows)

5. **Guardar cambios**
   - Hacer clic en **Save** en la parte superior

---

## ⚠️ IMPORTANTE

- **NO incluir** el puerto `:5000` en las URIs de Replit
- Las URIs de Replit usan **HTTPS** (no HTTP)
- Solo localhost usa HTTP con puerto `:5000`
- Asegurarse de configurar como **Single-page application (SPA)**, NO como "Web"

---

## 🧪 Verificación

Una vez configurado, se puede verificar que funciona:
1. Ir a: https://6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev/student/login
2. Hacer clic en "Ingresar con Microsoft"
3. Debería redirigir a la página de login de Microsoft
4. Después de autenticarse, debería redirigir de vuelta a la aplicación

---

## 📞 Contacto

Si hay problemas con la configuración, favor de proporcionar:
- Captura de pantalla del error específico
- Mensaje de error exacto de Azure AD
- Confirmación de que las URIs están configuradas como "SPA" y no como "Web"
