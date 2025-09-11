'use server';
/**
 * @fileOverview A Genkit flow that acts as a help assistant for instructors.
 *
 * - askProctorHelp - A function that answers instructor questions about the platform.
 * - ProctorHelpInput - The input type for the askProctorHelp function.
 * - ProctorHelpOutput - The return type for the askProctorHelp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProctorHelpInputSchema = z.object({
  query: z.string().describe('The instructor\'s question about the platform.'),
});
export type ProctorHelpInput = z.infer<typeof ProctorHelpInputSchema>;

const ProctorHelpOutputSchema = z.object({
  answer: z.string().describe('The helpful answer to the instructor\'s question.'),
});
export type ProctorHelpOutput = z.infer<typeof ProctorHelpOutputSchema>;

export async function askProctorHelp(input: ProctorHelpInput): Promise<ProctorHelpOutput> {
  return proctorHelpFlow(input);
}

const proctorHelpPrompt = ai.definePrompt({
  name: 'proctorHelpPrompt',
  input: {schema: ProctorHelpInputSchema},
  output: {schema: ProctorHelpOutputSchema},
  prompt: `Eres un asistente de IA muy útil para la plataforma UGM Proctor. Tu objetivo es responder las preguntas de los docentes sobre cómo usar la plataforma.
Aquí tienes documentación sobre la plataforma:

**Cómo iniciar una sesión de examen:**
1. Ve a "Configurar Examen".
2. Completa los campos "Título del Examen" y "Duración (en minutos)".
3. Se generará automáticamente un "Código de Acceso".
4. Haz clic en "Crear Sala de Examen".
5. Comparte el "Código de Acceso" generado con tus estudiantes. Ellos usarán este código para unirse a la sesión de monitoreo.

**Cómo monitorear a los estudiantes:**
- El "Dashboard" principal muestra un resumen de los estudiantes activos, las alertas y los estudiantes que han finalizado. Puedes ver las tarjetas individuales de los estudiantes aquí.
- "Monitor en vivo" muestra una vista de cuadrícula de las transmisiones de video de todos los estudiantes activos para una visión general rápida.

**¿Qué son las alertas?**
El sistema detecta automáticamente comportamientos sospechosos como:
- El estudiante está hablando (picos de audio).
- El estudiante no está frente a la cámara.
- Se detectan varias personas en la cámara.
- El estudiante cambia de pestaña o minimiza la ventana del examen.
Estos eventos se muestran en el "Panel de Alertas" en el dashboard principal.

**¿Qué es el "Histórico"?**
La página "Histórico" muestra una lista de todas las sesiones de examen pasadas que has creado. Puedes ver detalles y descargar informes desde aquí (la descarga de informes es una función futura).

**¿Cómo obtienen soporte los estudiantes?**
Los estudiantes tienen un botón "Solicitar Ayuda Técnica" durante el examen. Cuando hacen clic en él, se te envía una alerta crítica a ti, el instructor.

Responde la pregunta del usuario basándote en esta información. Sé conciso y claro. Si la pregunta no está relacionada con la plataforma UGM Proctor, declina cortésmente responder.

Pregunta del usuario: {{{query}}}
`,
});

const proctorHelpFlow = ai.defineFlow(
  {
    name: 'proctorHelpFlow',
    inputSchema: ProctorHelpInputSchema,
    outputSchema: ProctorHelpOutputSchema,
  },
  async (input) => {
    const { output } = await proctorHelpPrompt(input);
    if (!output) {
      return { answer: 'Lo siento, no pude procesar tu pregunta en este momento. Por favor, intenta de nuevo.' };
    }
    return output;
  }
);
