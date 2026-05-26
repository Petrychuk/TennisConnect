import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.dev" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
-- Add isAdmin to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Articles
CREATE TABLE IF NOT EXISTS articles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(255) NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  cover_image text NOT NULL,
  category text NOT NULL,
  author text NOT NULL,
  read_time integer NOT NULL DEFAULT 5,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Travel Packages
CREATE TABLE IF NOT EXISTS travel_packages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(255) NOT NULL UNIQUE,
  title text NOT NULL,
  destination text NOT NULL,
  duration text NOT NULL,
  price integer NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'AUD',
  description text NOT NULL,
  highlights json DEFAULT '[]'::json,
  includes json DEFAULT '[]'::json,
  cover_image text NOT NULL,
  gallery json DEFAULT '[]'::json,
  start_date text,
  spots_left integer NOT NULL DEFAULT 10,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Recreation Services
CREATE TABLE IF NOT EXISTS recreation_services (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(255) NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL,
  provider text NOT NULL,
  location text NOT NULL,
  duration text NOT NULL,
  price integer NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'AUD',
  description text NOT NULL,
  benefits json DEFAULT '[]'::json,
  cover_image text NOT NULL,
  rating text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Tournaments (events)
CREATE TABLE IF NOT EXISTS tournaments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(255) NOT NULL UNIQUE,
  name text NOT NULL,
  start_date text NOT NULL,
  end_date text,
  location text NOT NULL,
  address text,
  level text NOT NULL,
  price integer NOT NULL,
  prize_pool text,
  max_participants integer NOT NULL DEFAULT 64,
  current_participants integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  organizer text NOT NULL,
  phone text,
  email text,
  website text,
  cover_image text NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  categories json DEFAULT '[]'::json,
  age_groups json DEFAULT '[]'::json,
  winner text,
  finalist text,
  created_at timestamp NOT NULL DEFAULT now()
);
`;

async function run() {
  try {
    console.log("Running migration...");
    await pool.query(SQL);
    console.log("✅ Migration successful");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
