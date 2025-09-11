
'use server';
/**
 * @fileOverview A Genkit flow for verifying a student's identity by comparing a photo of their ID card with a photo of their face.
 *
 * - verifyStudentIdentity - A function that takes two images and returns whether they are of the same person.
 * - VerifyStudentIdentityInput - The input type for the verifyStudentIdentity function.
 * - VerifyStudentIdentityOutput - The return type for the verifyStudentIdentity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VerifyStudentIdentityInputSchema = z.object({
  idCardPhoto: z.string().describe("A photo of the student's ID card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  facePhoto: z.string().describe("A photo of the student's face, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type VerifyStudentIdentityInput = z.infer<typeof VerifyStudentIdentityInputSchema>;

const VerifyStudentIdentityOutputSchema = z.object({
    isMatch: z.boolean().describe("Whether the person in the ID card photo and the face photo are the same."),
    reason: z.string().describe("A brief explanation for the decision, especially if there is no match."),
});
export type VerifyStudentIdentityOutput = z.infer<typeof VerifyStudentIdentityOutputSchema>;


export async function verifyStudentIdentity(input: VerifyStudentIdentityInput): Promise<VerifyStudentIdentityOutput> {
  return verifyStudentIdentityFlow(input);
}

const verifyStudentIdentityPrompt = ai.definePrompt({
  name: 'verifyStudentIdentityPrompt',
  input: {schema: VerifyStudentIdentityInputSchema},
  output: {schema: VerifyStudentIdentityOutputSchema},
  prompt: `You are an expert security agent responsible for biometric verification. Your task is to determine if two photos belong to the same person.

You will be given two images:
1. A photo of a person's ID card.
2. A live photo of a person's face.

Analyze the facial features in both images carefully. Compare key features like eye shape, nose, jawline, and overall face structure.

If the person is the same, set 'isMatch' to true. If they are different, set 'isMatch' to false and provide a brief reason why (e.g., "Different nose shape", "Jawline does not match"). If either image is unclear or doesn't contain a face, set 'isMatch' to false and state the reason (e.g., "ID card photo is blurry", "No face detected in live photo").

ID Card Photo:
{{media url=idCardPhoto}}

Face Photo:
{{media url=facePhoto}}
`,
});

const verifyStudentIdentityFlow = ai.defineFlow(
  {
    name: 'verifyStudentIdentityFlow',
    inputSchema: VerifyStudentIdentityInputSchema,
    outputSchema: VerifyStudentIdentityOutputSchema,
  },
  async (input) => {
    if (!input.idCardPhoto || !input.facePhoto) {
        return { isMatch: false, reason: "Una o ambas imágenes no fueron proporcionadas." };
    }
    try {
      const { output } = await verifyStudentIdentityPrompt(input);
      if (!output) {
        throw new Error('AI model returned no output.');
      }
      return output;
    } catch (error) {
      console.error('Error in verifyStudentIdentityFlow:', error);
      return {
        isMatch: false,
        reason: 'Se produjo un error en el servidor al procesar la verificación. Por favor, inténtalo de nuevo.',
      };
    }
  }
);
