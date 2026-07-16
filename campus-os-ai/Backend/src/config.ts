import 'dotenv/config'

const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),

  DATABASE_URL: process.env.DATABASE_URL ?? '',

  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173'
}

export const config = {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  DATABASE_URL: env.DATABASE_URL,

  JWT_SECRET: env.JWT_SECRET,
  JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
  CORS_ORIGIN: env.CORS_ORIGIN
}

// Fail fast rather than silently run an insecure production deployment.
if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === 'dev-secret-change-me') {
    throw new Error(
      'JWT_SECRET is still set to the development default. Set a long, random JWT_SECRET before running in production.'
    )
  }
}

// Always validate DATABASE_URL (even in dev) so failures become clear.
if (!config.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Please add it to Backend/.env')
}



