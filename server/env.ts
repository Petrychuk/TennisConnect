import dotenv from "dotenv";

// Определяем окружение
const NODE_ENV = process.env.NODE_ENV || "development";

// Выбираем env-файл
const envFile = NODE_ENV === "development" ? ".env.dev" : ".env";

// Загружаем переменные
dotenv.config({ path: envFile });

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`❌ Missing required environment variable: ${name}`);
  }

  return value;
}

export const ENV = {
  SESSION_SECRET: requireEnv("SESSION_SECRET"),
  VITE_SUPABASE_URL: requireEnv("VITE_SUPABASE_URL"),
  VITE_SUPABASE_ANON_KEY: requireEnv("VITE_SUPABASE_ANON_KEY"),
  
};

