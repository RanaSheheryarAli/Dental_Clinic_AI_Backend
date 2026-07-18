import dotenv from 'dotenv';
import { z } from 'zod';

// override: true makes the .env file authoritative in development, even if a variable is already
// present-but-empty in the surrounding shell environment (otherwise dotenv silently keeps the empty
// value). In production there is no committed .env, so real environment variables are used as-is.
dotenv.config({ override: true });

const dentistCalConfigSchema = z.object({
  dentistName: z.string().min(1),
  apiKey: z.string().min(1),
  username: z.string().min(1),
  timeZone: z.string().default('Asia/Karachi'),
  serviceEventTypeIds: z.record(z.string(), z.coerce.number().int().positive())
});

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  CALCOM_API_KEY: z.string().optional().default(''),
  CALCOM_BASE_URL: z.string().url().default('https://api.cal.com/v2'),
  DENTIST_CALCOM_CONFIGS: z.string().optional().default('[]'),
  WHATSAPP_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(''),
  RETELL_API_KEY: z.string().optional().default(''),
  // Voice (self-hosted: Twilio Media Streams + Deepgram STT/TTS, brain reused in-process).
  DEEPGRAM_API_KEY: z.string().optional().default(''),
  DEEPGRAM_STT_MODEL: z.string().default('nova-2'),
  DEEPGRAM_TTS_MODEL: z.string().default('aura-2-thalia-en'),
  VOICE_LANG: z.enum(['en', 'ur']).default('en'),
  EMBEDDING_MODEL: z.string().default('Xenova/all-MiniLM-L6-v2'),
  KB_PDF_PATH: z.string().default('../docs/knowledge-base.pdf'),
  CORS_ORIGIN: z.string().default(
    'http://localhost:4173,http://localhost:5173,http://127.0.0.1:4173,http://127.0.0.1:5173,https://*.vercel.app'
  )
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Environment validation failed: ${issues}`);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isCorsOriginAllowed(origin: string) {
  return corsOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) {
      return true;
    }

    if (!allowedOrigin.includes('*')) {
      return false;
    }

    const escaped = allowedOrigin
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    return new RegExp(`^${escaped}$`).test(origin);
  });
}

function parseDentistConfigs(rawValue: string): unknown {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return [];
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(
      'DENTIST_CALCOM_CONFIGS must be a single-line JSON array. Check your .env value for typos or duplicated text.'
    );
  }
}

const parsedDentistConfigs = z.array(dentistCalConfigSchema).safeParse(parseDentistConfigs(env.DENTIST_CALCOM_CONFIGS));

if (!parsedDentistConfigs.success) {
  const issues = parsedDentistConfigs.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`DENTIST_CALCOM_CONFIGS validation failed: ${issues}`);
}

export const dentistCalConfigs = parsedDentistConfigs.data;
