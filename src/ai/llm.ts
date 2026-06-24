import { openai } from '@ai-sdk/openai';

// ─────────────────────────────────────────────────────────────────────────────
// Proveedor de IA: OpenAI (GPT) vía Vercel AI SDK.
// La API key se lee automáticamente de la variable de entorno OPENAI_API_KEY.
// Modelo por defecto: gpt-4o-mini (soporta visión + salida estructurada, bajo costo).
// Se puede sobrescribir con la variable de entorno OPENAI_MODEL.
// ─────────────────────────────────────────────────────────────────────────────
export const MODEL_ID = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

export const model = openai(MODEL_ID);
