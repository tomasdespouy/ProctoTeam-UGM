"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ZoomIn, MessageSquare, XCircle, CheckCircle, AlertTriangle, Power, Loader2, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea';
import type { StudentSession } from '@/services/live-session.service';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface StudentCardProps {
    student: StudentSession;
}

const statusConfig = {
    active: { icon: <CheckCircle className="h-4 w-4 text-green-500" />, text: 'Activo', color: 'text-green-500' },
    alert: { icon: <AlertTriangle className="h-4 w-4 text-destructive" />, text: 'En Alerta', color: 'text-destructive' },
    finished: { icon: <Power className="h-4 w-4 text-muted-foreground" />, text: 'Finalizado', color: 'text-muted-foreground' },
}

export function StudentCard({ student }: StudentCardProps) {
    const { name, id, status, lastAlert, lastSnapshot, alerts } = student;
    const hasValidImage = typeof lastSnapshot === 'string' && lastSnapshot.trim().length > 0;
    const currentStatus = statusConfig[status as keyof typeof statusConfig];
    const { toast } = useToast();
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isTerminating, setIsTerminating] = useState(false);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [highlight, setHighlight] = useState(false);
    const lastAlertTimestamp = alerts?.[0]?.timestamp ?? 0;

    useEffect(() => {
        // Only highlight if the latest alert is recent (e.g., within the last 5 seconds)
        // and the student is currently in 'alert' status.
        if (status === 'alert' && Date.now() - lastAlertTimestamp < 5000) {
            setHighlight(true);
            const timer = setTimeout(() => {
                setHighlight(false);
            }, 4000); // Highlight duration
            return () => clearTimeout(timer);
        }
    }, [lastAlertTimestamp, status]);


    const handleSendMessage = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        try {
            const response = await fetch('/api/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SEND_MESSAGE_TO_STUDENT',
                    payload: { studentId: student.id, message: message.trim() }
                })
            });
            if (!response.ok) throw new Error('Failed to send message');
            toast({ title: 'Éxito', description: 'Mensaje enviado correctamente.' });
            setMessage('');
            setIsMessageDialogOpen(false); // Close dialog on success
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el mensaje.' });
            console.error(error);
        } finally {
            setIsSending(false);
        }
    };

    const handleTerminateSession = async () => {
        setIsTerminating(true);
        try {
            if (!student.examId) {
                throw new Error("No se pudo encontrar el ID del examen para este estudiante.");
            }
            const response = await fetch('/api/live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'BLOCK_STUDENT',
                    payload: { 
                        studentId: student.id,
                        examId: student.examId,
                        reason: 'Sesión finalizada por el supervisor.'
                    }
                })
            });
            
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Falló el bloqueo de la sesión del estudiante');
            }

            toast({ title: 'Éxito', description: `La sesión de ${student.name} ha sido finalizada y bloqueada.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error de Bloqueo', description: error.message || 'No se pudo finalizar la sesión permanentemente.' });
            console.error(error);
        } finally {
            setIsTerminating(false);
        }
    };


    return (
        <Card className={cn(
            "flex flex-col hover:shadow-lg transition-all duration-300",
             highlight && "border-destructive ring-2 ring-destructive animate-pulse"
        )}>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                <Avatar>
                    <AvatarFallback>{name?.split(' ').map(n => n[0]).join('').substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <CardTitle className="text-sm font-bold">{name}</CardTitle>
                    <CardDescription className="text-xs">ID: {id.substring(0,8)}...</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={cn("flex items-center gap-1 text-xs font-semibold", currentStatus?.color)}>
                                    {currentStatus?.icon}
                                    <span>{currentStatus?.text}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Última alerta: {lastAlert}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                     <div className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
                        <Bell className="h-3 w-3" />
                        <span>{alerts.length}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
                <div className="aspect-[4/3] w-full rounded-md overflow-hidden bg-muted relative">
                    {hasValidImage ? (
                        <img src={lastSnapshot} alt={`Pantalla de ${name}`} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            <User className="h-12 w-12 mb-2" />
                            <span className="text-xs font-medium">Esperando video...</span>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="pt-3 border-t">
                <div className="flex w-full justify-around">
                     <TooltipProvider>
                        <Dialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <ZoomIn className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Ampliar</p></TooltipContent>
                            </Tooltip>
                            <DialogContent className="max-w-5xl p-0">
                                <DialogHeader className="p-4 pb-2">
                                    <DialogTitle>Monitor de {name}</DialogTitle>
                                    <DialogDescription>
                                        ID del estudiante: {id} | Estado: <span className={cn("font-semibold", currentStatus?.color)}>{currentStatus?.text}</span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="p-4 pt-0">
                                    <div className="relative aspect-video w-full rounded-md overflow-hidden bg-muted border">
                                        {hasValidImage ? (
                                            <img 
                                                src={lastSnapshot} 
                                                alt={`Pantalla de ${name}`} 
                                                className="absolute inset-0 w-full h-full object-contain"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                <User className="h-16 w-16 mb-3" />
                                                <span className="text-sm font-medium">Esperando video...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        
                        <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MessageSquare className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Enviar Mensaje</p></TooltipContent>
                            </Tooltip>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Enviar advertencia a {name}</DialogTitle>
                                    <DialogDescription>
                                        El estudiante recibirá este mensaje como una notificación. No podrá responder.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Textarea 
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Ej: Por favor, mantén la vista en la pantalla."
                                        rows={4}
                                    />
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Cancelar</Button>
                                    </DialogClose>
                                    <Button onClick={handleSendMessage} disabled={isSending || !message.trim()}>
                                        {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enviar Mensaje
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                     <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>¿Bloquear sesión de monitoreo?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción finalizará y bloqueará permanentemente la sesión para <span className="font-bold">{name}</span>. El estudiante no podrá volver a unirse. Esta acción es irreversible.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction 
                                            onClick={handleTerminateSession} 
                                            disabled={isTerminating}
                                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                        >
                                            {isTerminating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Finalizar y Bloquear
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TooltipTrigger>
                            <TooltipContent><p>Bloquear Sesión</p></TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                </div>
            </CardFooter>
        </Card>
    );
}
