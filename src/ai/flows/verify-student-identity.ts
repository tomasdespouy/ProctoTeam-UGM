'use server';
/**
 * @fileOverview Lee (OCR) el nombre del documento de identidad del estudiante con un
 * modelo de visión de OpenAI y lo compara de forma orientativa con el nombre esperado.
 *
 * NO realiza reconocimiento facial: únicamente extrae el texto impreso del documento,
 * lo que evita las restricciones de política sobre biometría facial. La confirmación
 * final la hace el propio usuario en la interfaz.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import { model } from '@/ai/llm';

const ExtractIdCardInputSchema = z.object({
  idCardPhoto: z.string().describe('Foto del documento de identidad como data URI (data:<mime>;base64,<data>).'),
  expectedName: z.string().optional().describe('Nombre del usuario registrado, para comparar de forma orientativa.'),
});
export type ExtractIdCardInput = z.infer<typeof ExtractIdCardInputSchema>;

const BoxSchema = z
  .object({
    x: z.number().describe('Borde izquierdo de la región, normalizado 0-1.'),
    y: z.number().describe('Borde superior de la región, normalizado 0-1.'),
    width: z.number().describe('Ancho de la región, normalizado 0-1.'),
    height: z.number().describe('Alto de la región, normalizado 0-1.'),
  })
  .nullable();

const ExtractIdCardOutputSchema = z.object({
  readable: z.boolean().describe('Si el documento es legible y contiene un nombre identificable.'),
  detectedName: z.string().describe('Nombre completo de la persona tal como aparece en el documento. Vacío si no se puede leer.'),
  documentNumber: z.string().describe('Número de documento o RUT si es visible; cadena vacía si no.'),
  matchesExpected: z.boolean().describe('Si el nombre detectado corresponde razonablemente a la persona del nombre esperado (ignorando orden de nombres/apellidos, tildes y mayúsculas). Si no se entregó nombre esperado, devuelve true.'),
  notes: z.string().describe('Observación breve (por ejemplo: "documento borroso", "reflejo").'),
  faceBox: BoxSchema.describe('Caja que rodea la foto/rostro del titular impresa en el documento (coordenadas normalizadas 0-1, origen arriba-izquierda). null si no se puede ubicar.'),
  nameBox: BoxSchema.describe('Caja que rodea el TEXTO del nombre completo impreso en el documento (coordenadas normalizadas 0-1). null si no se puede ubicar.'),
});
export type ExtractIdCardOutput = z.infer<typeof ExtractIdCardOutputSchema>;

export async function extractIdCardName(input: ExtractIdCardInput): Promise<ExtractIdCardOutput> {
  if (!input.idCardPhoto) {
    return { readable: false, detectedName: '', documentNumber: '', matchesExpected: false, notes: 'No se proporcionó imagen del documento.', faceBox: null, nameBox: null };
  }

  try {
    const { object } = await generateObject({
      model,
      schema: ExtractIdCardOutputSchema,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente de lectura de documentos (OCR). Tu tarea es LEER el texto impreso de un documento de identidad (cédula o carnet) y extraer el nombre completo y el número de documento. NO realices reconocimiento facial ni analices rostros: limítate a transcribir el texto visible. Si te entregan un nombre esperado, indica en matchesExpected si el nombre del documento corresponde a esa misma persona, ignorando el orden de nombres y apellidos, las tildes y las mayúsculas/minúsculas. Si el documento no es legible, devuelve readable=false. ' +
            'Además, para poder proteger la privacidad, entrega dos regiones con coordenadas NORMALIZADAS (valores 0 a 1, con origen en la esquina superior izquierda de la imagen): faceBox = el rectángulo que contiene la foto/rostro impreso del titular en el documento; nameBox = el rectángulo que contiene el TEXTO del nombre completo. Ajusta cada caja lo más ceñida posible al contenido. Si alguna no es ubicable con confianza, devuélvela como null.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'La imagen puede mostrar a la persona sosteniendo su documento de identidad; ignora el rostro y transcribe el nombre completo y el número impresos en el documento.' +
                (input.expectedName ? ` Nombre esperado del usuario: "${input.expectedName}".` : ''),
            },
            { type: 'image', image: input.idCardPhoto },
          ],
        },
      ],
    });

    return object;
  } catch (error) {
    console.error('Error in extractIdCardName:', error);
    return { readable: false, detectedName: '', documentNumber: '', matchesExpected: false, notes: 'Error al procesar el documento en el servidor.', faceBox: null, nameBox: null };
  }
}
