"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
// [CORRECCIÓN]: Cambiado MicOff por FileText para la prohibición de materiales
import { CheckCircle, ShieldAlert, UserCheck, FileText, Users, MonitorOff } from 'lucide-react';

interface RequirementsModalProps {
  isOpen: boolean;
  onAcceptRequirements: () => void;
}

export function RequirementsModal({ isOpen, onAcceptRequirements }: RequirementsModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline text-primary flex items-center gap-2">
            <ShieldAlert className="h-7 w-7" />
            Declaración Jurada y Compromiso
          </DialogTitle>
          <DialogDescription>
            Para asegurar la integridad del proceso, al continuar declaras bajo juramento que entiendes y aceptas las siguientes condiciones de monitoreo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-sm max-h-[50vh] overflow-y-auto pr-2">
          <div className="flex items-start space-x-3">
            <UserCheck className="h-5 w-5 mt-1 flex-shrink-0 text-primary" />
            <div>
              <h4 className="font-semibold">Compromiso de Identidad</h4>
              <p className="text-muted-foreground">Declaro ser el estudiante inscrito en este curso y seré la única persona que rendirá este examen. La suplantación de identidad es una falta grave.</p>
            </div>
          </div>
           <div className="flex items-start space-x-3">
            <Users className="h-5 w-5 mt-1 flex-shrink-0 text-primary" />
            <div>
              <h4 className="font-semibold">Entorno del Examen</h4>
              <p className="text-muted-foreground">Me comprometo a rendir el examen en un lugar privado, sin la presencia o ayuda de terceras personas. El sistema detectará la presencia de otros individuos.</p>
            </div>
          </div>
           <div className="flex items-start space-x-3">
            {/* [CORRECCIÓN ICONO]: Cambiado a FileText para representar materiales/ayuda. */}
            <FileText className="h-5 w-5 mt-1 flex-shrink-0 text-primary" />
            <div>
              <h4 className="font-semibold">Prohibición de Ayuda Externa</h4>
              <p className="text-muted-foreground">No utilizaré material de apoyo no autorizado, dispositivos electrónicos adicionales (incluyendo teléfonos), ni recibiré ayuda verbal o no verbal de ninguna persona.</p>
            </div>
          </div>
           <div className="flex items-start space-x-3">
            <MonitorOff className="h-5 w-5 mt-1 flex-shrink-0 text-primary" />
            <div>
              <h4 className="font-semibold">Monitoreo Técnico</h4>
              {/* [CORRECCIÓN REDACCIÓN]: Eliminado el audio por completo. */}
              <p className="text-muted-foreground">Acepto que mi cámara y pantalla completa serán monitoreadas para la captura de imágenes. El sistema registrará el cambio de pestaña o el uso de software no permitido.</p>
            </div>
          </div>
           <div className="p-4 bg-muted/50 rounded-lg mt-2">
             <h4 className="font-semibold text-destructive flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Consecuencias por Incumplimiento
            </h4>
            <p className="text-destructive/90 text-xs">
                Entiendo que cualquier infracción a estas reglas (como la presencia de otra persona, el uso de un teléfono o el cambio de pestañas) generará una alerta que será revisada por mi docente. Una falta grave puede resultar en la anulación inmediata de mi examen y/o la expulsión, según el reglamento académico.
            </p>
           </div>
        </div>
        <DialogFooter className="px-0">
          <Button onClick={onAcceptRequirements} className="w-full bg-green-600 hover:bg-green-700 text-white mx-0">
            <CheckCircle className="mr-2 h-4 w-4" />
            Acepto los Términos y me Comprometo a Cumplirlos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}