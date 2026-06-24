// src/ai/flows/evaluate-proctoring-alert.ts
'use server';

/**
 * @fileOverview Evalúa una alerta de proctoring durante un examen usando OpenAI (GPT),
 * devolviendo severidad, explicación, recomendación y un puntaje de confianza.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { model } from '@/ai/llm';

const EvaluateProctoringAlertInputSchema = z.object({
  eventType: z.string().describe('Tipo de evento que disparó la alerta (p.ej. cambio de pestaña, pico de audio).'),
  eventDetails: z.string().describe('Información detallada del evento, incluyendo marcas de tiempo y datos relevantes.'),
  studentId: z.string().describe('ID del estudiante que rinde el examen.'),
  examName: z.string().describe('Nombre del examen supervisado.'),
});
export type EvaluateProctoringAlertInput = z.infer<typeof EvaluateProctoringAlertInputSchema>;

const EvaluateProctoringAlertOutputSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']).describe('Nivel de severidad de la alerta.'),
  explanation: z.string().describe('Explicación detallada de por qué se disparó la alerta y su impacto en la integridad del examen.'),
  recommendation: z.string().describe('Recomendación para el supervisor (p.ej. investigar, escalar, ignorar).'),
  confidenceScore: z.number().min(0).max(1).describe('Puntaje entre 0 y 1 con la confianza en la evaluación de severidad.'),
});
export type EvaluateProctoringAlertOutput = z.infer<typeof EvaluateProctoringAlertOutputSchema>;

export async function evaluateProctoringAlert(
  input: EvaluateProctoringAlertInput
): Promise<EvaluateProctoringAlertOutput> {
  try {
    const { object } = await generateObject({
      model,
      schema: EvaluateProctoringAlertOutputSchema,
      prompt: `Eres un asistente de IA que ayuda a los supervisores a evaluar alertas durante los exámenes en línea.

Se te proporciona la siguiente información sobre un evento que activó una alerta:

Tipo de Evento: ${input.eventType}
Detalles del Evento: ${input.eventDetails}
ID de Estudiante: ${input.studentId}
Nombre del Examen: ${input.examName}

Basándote en esta información, determina la gravedad de la alerta, proporciona una explicación detallada
y recomienda cómo debe proceder el supervisor. Además, proporciona una puntuación de confianza para tu evaluación.`,
    });

    return object;
  } catch (error) {
    console.error('Error in evaluateProctoringAlert:', error);
    return {
      severity: 'critical' as const,
      explanation: 'Se produjo un error al procesar la alerta. El sistema de IA no está disponible.',
      recommendation: 'Notifique al soporte técnico sobre el error del sistema de IA.',
      confidenceScore: 0.0,
    };
  }
}
