# 🚨 INSTRUCCIONES URGENTES PARA TI - Azure AD

## ❌ PROBLEMA DETECTADO

Error: `AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type`

**Causa**: La aplicación está configurada como tipo **"Web"** en Azure AD, pero **DEBE** ser tipo **"Single-Page Application (SPA)"**.

---

## ✅ SOLUCIÓN - PASOS EXACTOS

### Paso 1: Ir a Azure Portal
1. Abrir: https://portal.azure.com
2. Ir a: **Azure Active Directory** → **App registrations**
3. Buscar app con Client ID: `e9f08a61-0e07-4a60-b825-c6041cdf0505`

### Paso 2: ELIMINAR la configuración "Web" (si existe)
1. En el menú lateral, hacer clic en **Authentication**
2. En **Platform configurations**, si ven una sección que dice **"Web"**:
   - Hacer clic en el botón **"..."** (tres puntos) al lado de "Web"
   - Seleccionar **"Remove"** o **"Eliminar"**
   - Confirmar la eliminación

### Paso 3: AGREGAR configuración "Single-page application"
1. En **Platform configurations**, hacer clic en **"+ Add a platform"**
2. Seleccionar **"Single-page application"** (NO "Web", NO "Mobile and desktop")
3. Agregar estas URIs EXACTAS:
   ```
   https://ugm-proctoring.replit.app/auth/callback
   https://6b145858-516c-4253-bbb2-6042ec3593fe-00-3el5cnkqxkgt7.janeway.replit.dev/auth/callback
   ```

### Paso 4: Configurar Tokens
1. En la misma página de **Authentication**
2. Bajar a la sección **"Implicit grant and hybrid flows"**
3. Marcar estas casillas:
   - ✅ **Access tokens** (used for implicit flows)
   - ✅ **ID tokens** (used for implicit and hybrid flows)

### Paso 5: Guardar
1. Hacer clic en **"Save"** en la parte superior de la página
2. Esperar confirmación de que se guardó correctamente

---

## 🔍 VERIFICACIÓN

Después de hacer los cambios, en la página de **Authentication** deberías ver:

**Platform configurations:**
- ✅ **Single-page application** (con las 2 URIs)
- ❌ **Web** (NO debe aparecer)

**Implicit grant and hybrid flows:**
- ✅ Access tokens: **Checked**
- ✅ ID tokens: **Checked**

---

## ⚠️ MUY IMPORTANTE

- **NO** configurar como "Web application"
- **SÍ** configurar como "Single-page application (SPA)"
- Esta es la diferencia clave que está causando el error

---

## 📞 Confirmación

Una vez completado, por favor confirmar que:
1. ✅ Eliminaron la configuración "Web" (si existía)
2. ✅ Agregaron "Single-page application" con las URIs
3. ✅ Marcaron "Access tokens" e "ID tokens"
4. ✅ Guardaron los cambios

Después de estos cambios, la autenticación funcionará inmediatamente.
