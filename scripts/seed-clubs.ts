import { Pool } from "pg";
import dotenv from "dotenv";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

dotenv.config({ path: ".env.dev" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const clubs = [
  {
    name: "Royal Sydney Tennis Club",
    location: "Rose Bay, NSW",
    description: "Prestigious club with 18 grass and 8 hard courts. Regular social comps, professional coaching, annual championships. Pro shop, dining, member lounge.",
    services: ["Grass Courts", "Hard Courts", "Coaching", "Pro Shop", "Tournaments", "Social Events"],
    price: "45",
    phone: "+61 2 9371 4333",
    website: "https://www.rsgc.com.au",
    image: "https://images.unsplash.com/photo-1560012057-4372e14c5085?q=80&w=1600&auto=format&fit=crop",
    rating: "4.9",
  },
  {
    name: "White City Tennis",
    location: "Paddington, NSW",
    description: "Iconic venue with rich history, recently redeveloped. Court hire, private coaching, high-performance squad training.",
    services: ["Hard Courts", "Synthetic Grass", "Gym", "Cafe", "Squad Training"],
    price: "35",
    phone: "+61 2 9331 4144",
    website: "https://www.whitecity.com.au",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1600&auto=format&fit=crop",
    rating: "4.7",
  },
  {
    name: "Manly Seaside Tennis",
    location: "Manly, NSW",
    description: "Play tennis with an ocean breeze — 6 synthetic grass courts next to Manly Beach. Evening competitions and weekend round-robins.",
    services: ["Synthetic Grass", "Beachside", "Social Comps", "Night Tennis", "BBQ Area"],
    price: "25",
    phone: "+61 2 9977 6023",
    website: "https://www.manlytennis.com.au",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=1600&q=80",
    rating: "4.8",
  },
  {
    name: "East Courts Tennis",
    location: "Kingsford, NSW",
    description: "Family-friendly with 8 well-maintained hard courts. Junior development, holiday camps, affordable student/senior rates.",
    services: ["Hard Courts", "Junior Program", "Holiday Camps", "Equipment Hire"],
    price: "20",
    phone: "+61 2 9662 7033",
    website: "https://www.eastcourts.com.au",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1600&auto=format&fit=crop",
    rating: "4.5",
  },
  {
    name: "North Shore Tennis Centre",
    location: "Chatswood, NSW",
    description: "Premier facility on the North Shore. 12 floodlit courts till 10pm. Fully stocked pro shop and on-site restringing.",
    services: ["Hard Courts", "Floodlights", "Restringing", "Parking", "Showers"],
    price: "30",
    phone: "+61 2 9411 1500",
    website: "https://www.nstc.com.au",
    image: "https://images.unsplash.com/photo-1626244422423-4d535130a55c?q=80&w=1600&auto=format&fit=crop",
    rating: "4.6",
  },
  {
    name: "Coogee Tennis Club",
    location: "Coogee, NSW",
    description: "Community-focused club with a relaxed atmosphere. 4 synthetic grass courts in a park setting. Family and beginner friendly.",
    services: ["Synthetic Grass", "Park Setting", "Social Events", "Coaching"],
    price: "22",
    phone: "+61 2 9665 5723",
    website: "https://www.coogeetennis.com.au",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=1600&auto=format&fit=crop",
    rating: "4.7",
  },
  {
    name: "Sydney Olympic Park Tennis",
    location: "Homebush, NSW",
    description: "World-class venue hosted the 2000 Olympics. 16 match courts and indoor training, available for public booking.",
    services: ["Plexicushion Courts", "Indoor Courts", "High Performance", "Gym", "Cafe"],
    price: "40",
    phone: "+61 2 9714 4000",
    website: "https://www.tennisworld.net.au",
    image: "https://images.unsplash.com/photo-1576617497557-2c8419c72e61?q=80&w=1600&auto=format&fit=crop",
    rating: "4.8",
  },
  {
    name: "Rushcutters Bay Tennis",
    location: "Rushcutters Bay, NSW",
    description: "Beautiful harbor location. 5 synthetic grass and 2 hard courts. Kiosk with great coffee. Popular for morning cardio tennis.",
    services: ["Harbour Views", "Cafe", "Cardio Tennis", "Synthetic Grass"],
    price: "32",
    phone: "+61 2 9331 4700",
    website: "https://www.rushcutterstennis.com.au",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
    rating: "4.9",
  },
];

async function main() {
  try {
    console.log("🌱 Seeding clubs...");
    await pool.query("DELETE FROM clubs");
    for (const c of clubs) {
      await pool.query(
        `INSERT INTO clubs (name, location, description, services, price, phone, website, image, rating)
         VALUES ($1,$2,$3,$4::json,$5,$6,$7,$8,$9)`,
        [c.name, c.location, c.description, JSON.stringify(c.services), c.price, c.phone, c.website, c.image, c.rating]
      );
    }
    console.log(`✅ ${clubs.length} clubs inserted`);

    // Fix player password
    const playerPass = await hashPassword("newpassword123");
    const result = await pool.query(
      "UPDATE users SET password=$1 WHERE email=$2 RETURNING id",
      [playerPass, "shadowpn+7@gmail.com"]
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log("✅ Player password reset for shadowpn+7@gmail.com");
    } else {
      console.log("⚠️ Player user shadowpn+7@gmail.com not found");
    }
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
