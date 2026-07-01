// Cuentas de super-admin "dueño" que el panel de Gestión de Usuarios NO puede
// cambiar de rol, desactivar ni eliminar. Es una salvaguarda contra bloqueos
// accidentales (p.ej. degradarse a sí mismo y quedar sin acceso).
// Seguro de importar tanto en servidor como en cliente (sin dependencias).
export const PROTECTED_SUPER_ADMIN_EMAILS = ['tomas.despouy@ugm.cl'];

export function isProtectedEmail(email?: string | null): boolean {
  if (!email) return false;
  return PROTECTED_SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
