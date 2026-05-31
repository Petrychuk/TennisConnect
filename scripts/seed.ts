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

const articles = [
  {
    slug: "10-tips-improve-your-serve",
    title: "10 Tips to Improve Your Serve in 30 Days",
    excerpt: "Master the serve — the most decisive shot in tennis. Pro coaches share their secrets.",
    content: `The serve is the only shot in tennis where you have complete control. Here are 10 proven tips to elevate your serve game:\n\n1. **Toss placement** — Your toss should be slightly in front and to the right (for right-handers).\n2. **Trophy pose** — Pause at the trophy position to gather energy.\n3. **Knee bend** — Bend your knees for explosive power.\n4. **Pronation** — Snap your wrist on contact.\n5. **Follow through** — Let the racquet finish across your body.\n6. **Practice toss** — Spend 10 minutes daily on toss-only practice.\n7. **Use video** — Record yourself and analyse.\n8. **Vary placement** — Wide, body, T — keep opponents guessing.\n9. **Second serve confidence** — A reliable kick serve wins more matches than aces.\n10. **Strength training** — Core and legs power the serve.\n\nApply these consistently for 30 days and watch your serve transform.`,
    coverImage: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&h=600&fit=crop",
    category: "Training",
    author: "Coach Andrea Volkov",
    readTime: 6,
  },
  {
    slug: "choosing-perfect-racquet",
    title: "How to Choose the Perfect Racquet for Your Level",
    excerpt: "A guide to finding the racquet that matches your style — head size, weight, string pattern explained.",
    content: `Choosing a racquet is personal — but the wrong one slows your progress. Here's what matters:\n\n**Head size**: Beginners: 100+ sq in (more forgiving). Advanced: 95-100 sq in (more control).\n\n**Weight**: 260-280g for beginners, 290-310g for intermediates, 310g+ for advanced players.\n\n**Balance**: Head-heavy = power. Head-light = control.\n\n**String pattern**: 16x19 = more spin. 18x20 = more control.\n\n**Grip size**: Measure from middle crease of palm to top of ring finger. Most players: 4 1/4 or 4 3/8.\n\nVisit a local tennis shop and demo 3-5 racquets before committing.`,
    coverImage: "https://images.unsplash.com/photo-1551773188-0801da12f5c1?w=1200&h=600&fit=crop",
    category: "Equipment",
    author: "Mark Stephens",
    readTime: 8,
  },
  {
    slug: "mental-game-pressure-points",
    title: "The Mental Game: Winning Pressure Points",
    excerpt: "Tennis is 80% mental at the top. Learn how the pros stay calm when the match is on the line.",
    content: `When the score is 30-30, deuce, or 5-5 in the final set, the mental game decides matches. Top pros use these techniques:\n\n1. **Breathing reset** — 4 seconds in, 4 seconds out between points.\n2. **Routines** — Bounce the ball the same number of times. Adjust strings. Predictability calms nerves.\n3. **Positive self-talk** — Replace "Don't double fault" with "Solid serve to the body."\n4. **Visualization** — See the shot before you hit it.\n5. **Reset rituals** — Walk to the towel between points. Take your time.\n\nPractice these in training, not just matches. Mental skills are habits.`,
    coverImage: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&h=600&fit=crop",
    category: "Training",
    author: "Dr. Elena Marchetti",
    readTime: 5,
  },
  {
    slug: "tennis-elbow-prevention",
    title: "Tennis Elbow: Prevention and Recovery",
    excerpt: "30% of recreational players will get tennis elbow. Here's how to avoid it — and what to do if you have it.",
    content: `Tennis elbow (lateral epicondylitis) is the bane of recreational players. Prevention is far better than cure:\n\n**Prevention**:\n- Use proper technique — let your legs and core drive the shot, not your arm.\n- String at lower tension (52-56 lbs).\n- Use a multifilament or hybrid string setup.\n- Warm up wrists and forearms before play.\n- Strengthen forearm extensors with light dumbbell exercises.\n\n**Recovery**:\n- Rest 7-14 days at the first sign of pain.\n- Apply ice for 15 minutes 3x daily.\n- Eccentric forearm exercises (slow lowering of weight).\n- Counterforce brace during play.\n- See a physio if pain persists past 3 weeks.\n\nMost cases resolve within 4-6 weeks with proper care.`,
    coverImage: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&h=600&fit=crop",
    category: "Health",
    author: "Dr. Sam Patel",
    readTime: 7,
  },
  {
    slug: "australian-open-2026-preview",
    title: "Australian Open 2026: What to Watch",
    excerpt: "The Aus Open returns to Melbourne Park in January 2026. Here are the storylines, dark horses, and favourites.",
    content: `The 2026 Australian Open promises drama with a new generation challenging the established stars. Key storylines:\n\n**Men's draw** — Sinner enters as defending champion, but a hungry Alcaraz and a resurgent Djokovic make this wide open.\n\n**Women's draw** — Sabalenka, Swiatek, and the rising Mirra Andreeva headline a stacked field.\n\n**Aussie hopes** — Local fans will rally behind de Minaur and the rising junior stars.\n\n**Surface** — The new Plexicushion surface plays slightly faster this year, favouring big servers.\n\n**Dates** — January 19 to February 1, 2026, at Melbourne Park.\n\nGet your tickets early — the night sessions are sold out fast.`,
    coverImage: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1200&h=600&fit=crop",
    category: "News",
    author: "Tom Richards",
    readTime: 4,
  },
  {
    slug: "footwork-fundamentals",
    title: "Footwork Fundamentals: Move Like a Pro",
    excerpt: "Great tennis starts with great feet. Master split steps, recovery, and court positioning.",
    content: `Footwork is the engine of tennis. Without it, even perfect technique fails.\n\n**Split step** — Every time your opponent contacts the ball, your feet should be off the ground. Land balanced, ready to push off in any direction.\n\n**Recovery** — After every shot, recover toward the centre with crossover steps.\n\n**Adjustment steps** — Small, quick steps to get into perfect contact position.\n\n**Open vs closed stance** — Use open stance for power, closed for control.\n\n**Drills** — Ladder drills, cone drills, and shadow swings build footwork muscle memory.\n\nDevote 15 minutes of every practice to footwork drills. The results compound over months.`,
    coverImage: "https://images.unsplash.com/photo-1529926706528-db9e5010cd3e?w=1200&h=600&fit=crop",
    category: "Training",
    author: "Coach Andrea Volkov",
    readTime: 5,
  },
];

const travel = [
  {
    slug: "mallorca-tennis-camp-7d",
    title: "Mallorca Tennis Camp",
    destination: "Mallorca, Spain",
    duration: "7 days",
    price: 2890,
    currency: "AUD",
    description: "Train at the iconic Rafa Nadal Academy. 6 hours of daily on-court tennis, fitness sessions, Mediterranean cuisine, and beach recovery time. All levels welcome — coaches assess and group you on day 1.",
    highlights: ["Rafa Nadal Academy facilities", "6 hrs daily on-court tennis", "Beachside hotel", "Daily fitness & yoga", "Mediterranean dining", "Off-day Palma excursion"],
    includes: ["7 nights 4★ hotel", "All meals", "Airport transfers", "Tennis kit", "Coaching staff"],
    coverImage: "https://images.unsplash.com/photo-1529693662653-9d480530a697?w=1200&h=600&fit=crop",
    gallery: ["https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800", "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800"],
    startDate: "2026-04-12",
    spotsLeft: 6,
    isFeatured: true,
  },
  {
    slug: "dubai-luxury-tennis-5d",
    title: "Dubai Luxury Tennis Retreat",
    destination: "Dubai, UAE",
    duration: "5 days",
    price: 3490,
    currency: "AUD",
    description: "5-star tennis getaway at the Dubai Duty Free Tennis Stadium grounds. Private coaching, desert safari, and skyline views. Tennis luxury at its finest.",
    highlights: ["5★ Burj Khalifa view hotel", "Private 2:1 coaching", "Desert safari evening", "Dubai Duty Free Stadium tour", "Spa & recovery"],
    includes: ["5 nights luxury suite", "Breakfast & dinner", "Private transfers", "All coaching", "Spa credit"],
    coverImage: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=1200&h=600&fit=crop",
    gallery: [],
    startDate: "2026-03-20",
    spotsLeft: 4,
    isFeatured: true,
  },
  {
    slug: "bali-tennis-wellness-10d",
    title: "Bali Tennis & Wellness",
    destination: "Bali, Indonesia",
    duration: "10 days",
    price: 2190,
    currency: "AUD",
    description: "Balance tennis training with deep wellness in Ubud. Morning tennis, afternoon yoga, evening meditation. Reset body and mind in paradise.",
    highlights: ["Jungle villa accommodation", "Daily tennis & yoga", "Balinese spa rituals", "Healthy plant-based menu", "Excursion to rice terraces"],
    includes: ["10 nights villa", "All meals", "Airport transfers", "Wellness program"],
    coverImage: "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=1200&h=600&fit=crop",
    gallery: [],
    startDate: "2026-05-05",
    spotsLeft: 8,
    isFeatured: false,
  },
  {
    slug: "wimbledon-experience-4d",
    title: "Wimbledon Experience",
    destination: "London, UK",
    duration: "4 days",
    price: 4890,
    currency: "AUD",
    description: "Live the Wimbledon dream — Centre Court tickets, hospitality lounge, behind-the-scenes museum tour, and play on grass at a heritage club.",
    highlights: ["Centre Court tickets x 2 days", "Strawberries & cream", "Behind-the-scenes museum", "Play on grass at Hurlingham", "Champagne reception"],
    includes: ["4 nights Mayfair hotel", "Breakfast", "Wimbledon tickets", "Transfers", "Welcome dinner"],
    coverImage: "https://images.unsplash.com/photo-1551892589-865f69869476?w=1200&h=600&fit=crop",
    gallery: [],
    startDate: "2026-07-01",
    spotsLeft: 2,
    isFeatured: true,
  },
];

const recreation = [
  {
    slug: "sports-massage-60",
    name: "Sports Recovery Massage",
    type: "Massage",
    provider: "Court Side Therapy",
    location: "Sydney CBD",
    duration: "60 min",
    price: 120,
    currency: "AUD",
    description: "Deep tissue sports massage targeting the shoulders, forearms, and lower back — the trouble zones for tennis players. Therapists trained in tennis-specific recovery.",
    benefits: ["Reduces forearm tension", "Speeds muscle recovery", "Improves range of motion", "Prevents tennis elbow"],
    coverImage: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&h=600&fit=crop",
    rating: "4.9",
    phone: "+61 2 8000 1234",
    email: "book@courtsidetherapy.com.au",
  },
  {
    slug: "cryotherapy-session",
    name: "Whole-Body Cryotherapy",
    type: "Recovery",
    provider: "ChillZone Recovery",
    location: "Melbourne Richmond",
    duration: "3 min",
    price: 65,
    currency: "AUD",
    description: "3 minutes at -110°C. Used by ATP pros to flush inflammation after long matches. Walk in fatigued, walk out energized.",
    benefits: ["Reduces inflammation", "Boosts energy", "Speeds recovery", "Improves sleep"],
    coverImage: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&h=600&fit=crop",
    rating: "4.8",
    phone: "+61 3 9421 9876",
    email: "hello@chillzone.com.au",
  },
  {
    slug: "tennis-yoga-flow",
    name: "Tennis Player Yoga Flow",
    type: "Yoga",
    provider: "Match Flow Studio",
    location: "Bondi Beach",
    duration: "75 min",
    price: 45,
    currency: "AUD",
    description: "Yoga sequences designed for tennis bodies — hip openers, thoracic mobility, and shoulder release. Restorative classes available too.",
    benefits: ["Improves rotation", "Opens hips", "Calms competitive nerves", "Better recovery"],
    coverImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=600&fit=crop",
    rating: "5.0",
    phone: "+61 2 9300 1122",
    email: "info@matchflow.com.au",
  },
  {
    slug: "physio-assessment",
    name: "Tennis Physio Assessment",
    type: "Physio",
    provider: "Movement Physio",
    location: "Brisbane Newstead",
    duration: "60 min",
    price: 180,
    currency: "AUD",
    description: "Full biomechanical assessment by physios who treat ATP/WTA players. Identify and address injury risk before it becomes a problem.",
    benefits: ["Injury prevention", "Custom exercise plan", "Movement screening", "Pain resolution"],
    coverImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=600&fit=crop",
    rating: "4.9",
    phone: "+61 7 3215 7777",
    email: "clinic@movementphysio.com.au",
  },
  {
    slug: "infrared-sauna-session",
    name: "Infrared Sauna Recovery",
    type: "Recovery",
    provider: "Heat Therapy Hub",
    location: "Perth Subiaco",
    duration: "45 min",
    price: 55,
    currency: "AUD",
    description: "Infrared sauna detox and recovery. Combine with a contrast plunge for the ultimate post-match reset.",
    benefits: ["Detoxification", "Muscle relaxation", "Skin health", "Cardiovascular benefits"],
    coverImage: "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=1200&h=600&fit=crop",
    rating: "4.7",
    phone: "+61 8 9388 2233",
    email: "hi@heattherapyhub.com.au",
  },
];

const tournaments = [
  {
    slug: "sydney-open-2026",
    name: "Sydney Open 2026",
    startDate: "2026-03-15",
    endDate: "2026-03-17",
    location: "Olympic Park Tennis Centre, Sydney",
    address: "Olympic Blvd, Sydney Olympic Park NSW 2127",
    level: "Advanced",
    price: 150,
    prizePool: "5000 AUD",
    maxParticipants: 64,
    currentParticipants: 48,
    description: "Sydney's premier tennis tournament for advanced players. Three days of competition with a $5000 AUD prize pool at the professional Olympic Park courts.",
    organizer: "Sydney Tennis Association",
    phone: "+61 2 9714 7888",
    email: "tournaments@sydneytennis.com.au",
    website: "https://sydneytennis.com.au",
    coverImage: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&h=600&fit=crop",
    status: "upcoming",
    categories: ["Singles", "Doubles"],
    ageGroups: ["18+", "35+", "50+"],
  },
  {
    slug: "melbourne-cup-tennis-2026",
    name: "Melbourne Cup Tennis 2026",
    startDate: "2026-04-10",
    endDate: "2026-04-12",
    location: "Melbourne Park, Melbourne",
    address: "Olympic Blvd, Melbourne VIC 3001",
    level: "Intermediate",
    price: 100,
    prizePool: "3000 AUD",
    maxParticipants: 128,
    currentParticipants: 95,
    description: "Melbourne's largest amateur tournament for intermediate players. Great opportunity to test your skills and connect with the tennis community.",
    organizer: "Tennis Victoria",
    phone: "+61 3 8420 8420",
    email: "events@tennisvic.com.au",
    website: "https://tennisvic.com.au",
    coverImage: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&h=600&fit=crop",
    status: "upcoming",
    categories: ["Singles", "Mixed Doubles"],
    ageGroups: ["Open", "40+"],
  },
  {
    slug: "brisbane-junior-2026",
    name: "Brisbane Junior Championship",
    startDate: "2026-02-20",
    endDate: "2026-02-22",
    location: "Queensland Tennis Centre, Brisbane",
    address: "190 King Arthur Terrace, Tennyson QLD 4105",
    level: "Beginner",
    price: 50,
    prizePool: "1000 AUD",
    maxParticipants: 32,
    currentParticipants: 28,
    description: "Tournament for beginner junior players. Great start for kids aged 8-16 who want to try competitive tennis.",
    organizer: "Tennis Queensland",
    phone: "+61 7 3120 7900",
    email: "juniors@tennisqld.com.au",
    website: "https://tennisqld.com.au",
    coverImage: "https://images.unsplash.com/photo-1551773188-0801da12f5c1?w=1200&h=600&fit=crop",
    status: "upcoming",
    categories: ["Singles"],
    ageGroups: ["8-12", "13-16"],
  },
  {
    slug: "perth-summer-classic-2025",
    name: "Perth Summer Classic 2025",
    startDate: "2025-12-05",
    endDate: "2025-12-07",
    location: "State Tennis Centre, Perth",
    address: "Victoria Park Dr, Burswood WA 6100",
    level: "Advanced",
    price: 120,
    prizePool: "4000 AUD",
    maxParticipants: 48,
    currentParticipants: 48,
    winner: "James Wilson",
    finalist: "Michael Chen",
    description: "Perth's prestigious summer tournament. Featured the best players from Australia's west coast.",
    organizer: "Tennis West",
    phone: "+61 8 6462 8300",
    email: "tournaments@tenniswest.com.au",
    website: "https://tenniswest.com.au",
    coverImage: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1200&h=600&fit=crop",
    status: "past",
    categories: ["Singles", "Doubles"],
    ageGroups: ["Open"],
  },
  {
    slug: "adelaide-autumn-open-2025",
    name: "Adelaide Autumn Open 2025",
    startDate: "2025-11-10",
    endDate: "2025-11-12",
    location: "Memorial Drive Tennis Centre, Adelaide",
    address: "War Memorial Dr, Adelaide SA 5000",
    level: "Intermediate",
    price: 80,
    prizePool: "2500 AUD",
    maxParticipants: 64,
    currentParticipants: 64,
    winner: "Sarah Thompson",
    finalist: "Emma Davis",
    description: "Adelaide's autumn tournament for intermediate players. Wonderful atmosphere and friendly competition.",
    organizer: "Tennis SA",
    phone: "+61 8 8367 9400",
    email: "events@tennissa.com.au",
    website: "https://tennissa.com.au",
    coverImage: "https://images.unsplash.com/photo-1529926706528-db9e5010cd3e?w=1200&h=600&fit=crop",
    status: "past",
    categories: ["Singles", "Doubles", "Mixed Doubles"],
    ageGroups: ["Open", "35+", "50+"],
  },
  {
    slug: "darwin-tropical-open-2026",
    name: "Darwin Tropical Open",
    startDate: "2026-06-08",
    endDate: "2026-06-10",
    location: "Darwin Tennis Club, Darwin",
    address: "Gilruth Ave, The Gardens NT 0820",
    level: "Intermediate",
    price: 80,
    prizePool: "2000 AUD",
    maxParticipants: 48,
    currentParticipants: 12,
    description: "Northern Territory's premier tropical tennis event. Play under the warm Darwin sun with stunning harbour views.",
    organizer: "Tennis NT",
    phone: "+61 8 8945 4222",
    email: "info@tennisnt.com.au",
    website: "https://tennisnt.com.au",
    coverImage: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=1200&h=600&fit=crop",
    status: "upcoming",
    categories: ["Singles", "Doubles"],
    ageGroups: ["Open", "30+"],
  },
];

async function main() {
  try {
    console.log("🌱 Seeding...");

    // 1) Create / upgrade admin user
    const adminEmail = "admin@tennisconnect.com";
    const adminPass = await hashPassword("admin123");
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [adminEmail]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password, name, role, slug, is_admin, profile_completed, status)
         VALUES ($1, $2, $3, $4, $5, true, true, 'active')`,
        [adminEmail, adminPass, "Site Admin", "coach", "site-admin"]
      );
      console.log("✅ Admin user created: admin@tennisconnect.com / admin123");
    } else {
      await pool.query("UPDATE users SET is_admin=true WHERE email=$1", [adminEmail]);
      console.log("✅ Admin user already exists, ensured is_admin=true");
    }

    // 2) Clear existing content (idempotent reseed)
    await pool.query("DELETE FROM articles");
    await pool.query("DELETE FROM travel_packages");
    await pool.query("DELETE FROM recreation_services");
    await pool.query("DELETE FROM tournaments");

    // 3) Insert articles
    for (const a of articles) {
      await pool.query(
        `INSERT INTO articles (slug, title, excerpt, content, cover_image, category, author, read_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [a.slug, a.title, a.excerpt, a.content, a.coverImage, a.category, a.author, a.readTime]
      );
    }
    console.log(`✅ ${articles.length} articles inserted`);

    // 4) Travel packages
    for (const t of travel) {
      await pool.query(
        `INSERT INTO travel_packages (slug, title, destination, duration, price, currency, description, highlights, includes, cover_image, gallery, start_date, spots_left, is_featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::json,$9::json,$10,$11::json,$12,$13,$14)`,
        [t.slug, t.title, t.destination, t.duration, t.price, t.currency, t.description,
          JSON.stringify(t.highlights), JSON.stringify(t.includes), t.coverImage,
          JSON.stringify(t.gallery), t.startDate, t.spotsLeft, t.isFeatured]
      );
    }
    console.log(`✅ ${travel.length} travel packages inserted`);

    // 5) Recreation
    for (const r of recreation) {
      await pool.query(
        `INSERT INTO recreation_services (slug, name, type, provider, location, duration, price, currency, description, benefits, cover_image, rating, phone, email)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::json,$11,$12,$13,$14)`,
        [r.slug, r.name, r.type, r.provider, r.location, r.duration, r.price, r.currency, r.description,
          JSON.stringify(r.benefits), r.coverImage, r.rating, r.phone, r.email]
      );
    }
    console.log(`✅ ${recreation.length} recreation services inserted`);

    // 6) Tournaments
    for (const t of tournaments) {
      await pool.query(
        `INSERT INTO tournaments (slug, name, start_date, end_date, location, address, level, price, prize_pool, max_participants, current_participants, description, organizer, phone, email, website, cover_image, status, categories, age_groups, winner, finalist)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::json,$20::json,$21,$22)`,
        [t.slug, t.name, t.startDate, t.endDate, t.location, t.address, t.level, t.price, t.prizePool,
          t.maxParticipants, t.currentParticipants, t.description, t.organizer, t.phone, t.email, t.website,
          t.coverImage, t.status, JSON.stringify(t.categories), JSON.stringify(t.ageGroups), t.winner || null, t.finalist || null]
      );
    }
    console.log(`✅ ${tournaments.length} tournaments inserted`);

    console.log("🎉 Seed completed!");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
