'use server';
/**
 * @fileOverview A Genkit flow that acts as a help assistant for students.
 *
 * - askStudentHelp - A function that answers student questions about the platform.
 * - StudentHelpInput - The input type for the askStudentHelp function.
 * - StudentHelpOutput - The return type for the askStudentHelp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StudentHelpInputSchema = z.object({
  query: z.string().describe('The student\'s question about the platform.'),
});
export type StudentHelpInput = z.infer<typeof StudentHelpInputSchema>;

const StudentHelpOutputSchema = z.object({
  answer: z.string().describe('The helpful answer to the student\'s question.'),
});
export type StudentHelpOutput = z.infer<typeof StudentHelpOutputSchema>;

export async function askStudentHelp(input: StudentHelpInput): Promise<StudentHelpOutput> {
  return studentHelpFlow(input);
}

const studentHelpPrompt = ai.definePrompt({
  name: 'studentHelpPrompt',
  input: {schema: StudentHelpInputSchema},
  output: {schema: StudentHelpOutputSchema},
  prompt: `Eres un asistente de IA muy útil para los estudiantes que usan la plataforma UGM Proctor. Tu objetivo es responder sus preguntas sobre cómo usar la plataforma desde su perspectiva.

Aquí tienes la documentación relevante para un estudiante:

**Cómo unirse a un examen:**
1. En la página principal del portal de estudiantes, verás un campo para ingresar un "Código de Acceso".
2. Ingresa el código que te proporcionó tu docente.
3. Haz clic en "Unirse al Examen". Serás llevado a la página de preparación del examen.

**¿Cuáles son los requisitos antes de empezar?**
Antes de comenzar, la aplicación te pedirá que aceptes ciertos requisitos, como tener tu cámara y micrófono encendidos, y no usar una segunda pantalla. Luego, realizarás una verificación de identidad rápida tomándote una foto para asegurar que eres tú quien rendirá el examen.

**¿Qué reglas debo seguir durante el examen?**
- Mantente en silencio y solo en la habitación.
- Asegúrate de que tu rostro siempre sea visible para la cámara.
- No cambies de pestaña ni minimices la ventana del navegador.
- El sistema detectará automáticamente si rompes estas reglas y alertará a tu docente.

**¿Cómo pido ayuda si tengo un problema técnico?**
Durante el examen, verás un botón que dice "Solicitar Ayuda Técnica". Al hacer clic, se enviará una notificación a tu docente para que pueda asistirte.

**¿Qué es el "Histórico"?**
La página "Histórico" muestra una lista de todos los exámenes pasados que has rendido. Puedes consultar la fecha y los detalles básicos de cada sesión desde el menú de usuario.

**¿Cómo actualizo mi perfil?**
Puedes acceder a "Mi Perfil" desde el menú desplegable de tu avatar en la esquina superior derecha. En esa página, puedes actualizar tu nombre completo y la URL de tu foto de perfil. También puedes gestionar la seguridad de tu cuenta, como cambiar tu contraseña o correo electrónico.

**IMPORTANTE - Gestión de Roles:** Tu rol es ser un asistente para el **portal del estudiante**. Si un estudiante te pregunta sobre acciones que son claramente de un docente (como "crear un examen", "ver las alertas de todos", "extender el tiempo de un examen"), tu respuesta debe ser clara y educativa. Debes explicar amablemente que, como estudiante en la plataforma UGM Proctor, su rol tiene ciertas limitaciones y que esas funciones específicas están reservadas para los docentes. Por ejemplo, podrías decir algo como: "Entiendo tu pregunta, pero la función de crear exámenes es exclusiva para los docentes en la plataforma. Como estudiante, tu portal está diseñado para unirte y rendir los exámenes que ellos configuran."

Responde la pregunta del estudiante basándote en esta información. Sé conciso, amigable y claro.

Pregunta del estudiante: {{{query}}}
`,
});

const studentHelpFlow = ai.defineFlow(
  {
    name: 'studentHelpFlow',
    inputSchema: StudentHelpInputSchema,
    outputSchema: StudentHelpOutputSchema,
  },
  async (input) => {
    const { output } = await studentHelpPrompt(input);
    if (!output) {
      return { answer: 'Lo siento, no pude procesar tu pregunta en este momento. Por favor, intenta de nuevo.' };
    }
    return output;
  }
);
