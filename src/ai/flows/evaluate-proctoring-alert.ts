// src/ai/flows/evaluate-proctoring-alert.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for evaluating proctoring alerts during an exam.
 *
 * - evaluateProctoringAlert - A function that evaluates a proctoring alert and provides a severity assessment and supporting information.
 * - EvaluateProctoringAlertInput - The input type for the evaluateProctoringAlert function.
 * - EvaluateProctoringAlertOutput - The return type for the evaluateProctoringAlert function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateProctoringAlertInputSchema = z.object({
  eventType: z.string().describe('The type of event that triggered the alert (e.g., tab switch, audio spike).'),
  eventDetails: z.string().describe('Detailed information about the event, including timestamps and any relevant data.'),
  studentId: z.string().describe('The ID of the student taking the exam.'),
  examName: z.string().describe('The name of the exam being proctored.'),
});
export type EvaluateProctoringAlertInput = z.infer<typeof EvaluateProctoringAlertInputSchema>;

const EvaluateProctoringAlertOutputSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']).describe('The severity level of the alert.'),
  explanation: z.string().describe('A detailed explanation of why the alert was triggered and its potential impact on exam integrity.'),
  recommendation: z.string().describe('A recommendation for the proctor on how to proceed (e.g., investigate further, escalate to supervisor, ignore).'),
  confidenceScore: z.number().min(0).max(1).describe('A score between 0 and 1 indicating the confidence level in the severity assessment.'),
});
export type EvaluateProctoringAlertOutput = z.infer<typeof EvaluateProctoringAlertOutputSchema>;

export async function evaluateProctoringAlert(input: EvaluateProctoringAlertInput): Promise<EvaluateProctoringAlertOutput> {
  return evaluateProctoringAlertFlow(input);
}

const evaluateProctoringAlertPrompt = ai.definePrompt({
  name: 'evaluateProctoringAlertPrompt',
  input: {schema: EvaluateProctoringAlertInputSchema},
  output: {schema: EvaluateProctoringAlertOutputSchema},
  prompt: `Eres un asistente de IA que ayuda a los supervisores a evaluar alertas durante los exámenes en línea.

Se te proporciona la siguiente información sobre un evento que activó una alerta:

Tipo de Evento: {{{eventType}}}
Detalles del Evento: {{{eventDetails}}}
ID de Estudiante: {{{studentId}}}
Nombre del Examen: {{{examName}}}

Basándote en esta información, determina la gravedad de la alerta, proporciona una explicación detallada
y recomienda cómo debe proceder el supervisor. Además, proporciona una puntuación de confianza para tu evaluación.

Asegúrate de seguir el esquema de salida. Devuelve un objeto JSON.
`,
});

const evaluateProctoringAlertFlow = ai.defineFlow(
  {
    name: 'evaluateProctoringAlertFlow',
    inputSchema: EvaluateProctoringAlertInputSchema,
    outputSchema: EvaluateProctoringAlertOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await evaluateProctoringAlertPrompt(input);
      if (!output) {
        throw new Error('AI model returned no output.');
      }
      return output;
    } catch (error) {
      console.error('Error in evaluateProctoringAlertFlow:', error);
      return {
        severity: 'critical' as const,
        explanation:
          'Se produjo un error al procesar la alerta. El sistema de IA no está disponible.',
        recommendation:
          'Notifique al soporte técnico sobre el error del sistema de IA.',
        confidenceScore: 0.0,
      };
    }
  }
);
