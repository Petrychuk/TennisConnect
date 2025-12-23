import heroImage from "/assets/images/professional_tennis_coaching_session_on_a_sunny_court.png";
import avatarImage from "/assets/images/female_tennis_coach_portrait.png";

// Shared Mock Data
export const COACHES_DATA = [
  {
    id: 1,
    name: "Nataliia Petrychuk",
    title: "Tennis Coach | Beginner & Intermediate Specialist",
    location: "Manly",
    locations: ["Manly", "Mosman", "Freshwater", "Brookvale"],
    bio: "Passionate tennis coach dedicated to helping beginners and intermediate players fall in love with the game. I actively compete in local amateur tournaments, so I understand the journey of improving your game firsthand. My sessions focus on building solid fundamentals, improving consistency, and most importantly - having fun on the court! Whether you're just starting out or looking to level up your rally game, I'd love to help you reach your goals.",
    rating: 4.9,
    reviews: 24,
    rate: 70,
    experience: "10 years",
    image: avatarImage,
    cover: heroImage,
    tags: ["High Performance", "Kids", "Technique"],
    photos: [],
    schedule: {
      monday: { active: true, start: "07:00", end: "19:00" },
      tuesday: { active: true, start: "07:00", end: "19:00" },
      wednesday: { active: true, start: "07:00", end: "19:00" },
      thursday: { active: true, start: "07:00", end: "19:00" },
      friday: { active: true, start: "07:00", end: "17:00" },
      saturday: { active: true, start: "08:00", end: "14:00" },
      sunday: { active: false, start: "09:00", end: "17:00" }
    }
  },
  {
    id: 2,
    name: "David Chen",
    title: "Former ATP Player & Elite Coach",
    location: "Sydney CBD",
    locations: ["Sydney CBD", "Surry Hills", "Redfern"],
    bio: "Former top 300 ATP player specializing in high-performance coaching for competitive juniors and adults. I focus on modern stroke mechanics, footwork patterns, and match strategy.",
    rating: 5.0,
    reviews: 42,
    rate: 120,
    experience: "15 years",
    image: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop",
    cover: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1600&auto=format&fit=crop",
    tags: ["Pro Level", "Strategy", "Fitness"],
    photos: ["https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800", "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800"]
  },
  {
    id: 3,
    name: "Emily Wilson",
    title: "Junior Development Specialist",
    location: "Eastern Suburbs",
    locations: ["Bondi Beach", "Coogee", "Bronte"],
    bio: "Passionate about introducing kids to tennis in a fun and engaging way. I use the Hot Shots program methodology to help children develop coordination, basic strokes, and a love for the game.",
    rating: 4.8,
    reviews: 18,
    rate: 75,
    experience: "5 years",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    cover: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
    tags: ["Beginners", "Kids", "Fun"],
    photos: ["https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800"]
  },
  {
    id: 4,
    name: "Michael Ross",
    title: "Club Coach & Tournament Director",
    location: "Inner West",
    locations: ["Newtown", "Marrickville", "Stanmore"],
    bio: "Experienced club coach who enjoys working with players of all ages and abilities. I organize social competitions and tournaments to help players gain match experience in a friendly environment.",
    rating: 4.7,
    reviews: 31,
    rate: 85,
    experience: "8 years",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    cover: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1600&auto=format&fit=crop",
    tags: ["Tournaments", "Adults", "Social"],
    photos: []
  },
  {
    id: 5,
    name: "Jessica Lee",
    title: "Performance Coach",
    location: "North Shore",
    locations: ["Chatswood", "Gordon", "Killara"],
    bio: "Specializing in technical correction and mental toughness training. I help intermediate and advanced players break through plateaus and improve their competitive performance.",
    rating: 4.9,
    reviews: 15,
    rate: 95,
    experience: "7 years",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
    cover: "https://images.unsplash.com/photo-1560012057-4372e14c5085?q=80&w=1600&auto=format&fit=crop",
    tags: ["Advanced", "Footwork", "Mental Game"],
    photos: []
  },
  {
    id: 6,
    name: "James Wilson",
    title: "Tennis Australia Club Professional",
    location: "Sutherland Shire",
    locations: ["Cronulla", "Miranda", "Sutherland"],
    bio: "Energetic coach known for high-intensity Cardio Tennis sessions and dynamic group drills. Great for fitness enthusiasts and social players looking to stay active.",
    rating: 4.6,
    reviews: 28,
    rate: 80,
    experience: "12 years",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
    cover: "https://images.unsplash.com/photo-1626244422423-4d535130a55c?q=80&w=1600&auto=format&fit=crop",
    tags: ["Groups", "Cardio Tennis", "Adults"],
    photos: []
  }
];

import racketImg from "/assets/images/used_professional_tennis_racket.png";
import bagImg from "/assets/images/vintage_tennis_bag.png";

export const MARKETPLACE_DATA = [
  {
    id: 101,
    title: "Wilson Pro Staff RF97",
    price: "180",
    condition: "Used - Good",
    image: racketImg,
    location: "Bondi Beach, NSW",
    description: "Classic RF97 Autograph. A few scratches on the bumper but frame is in perfect condition. Freshly strung with Luxilon Alu Power.",
    seller_name: "John D.",
    seller_email: "john.doe@example.com",
    seller_id: 2,
    seller_type: "coach"
  },
  {
    id: 102,
    title: "Vintage Leather Tennis Bag",
    price: "120",
    condition: "Like New",
    image: bagImg,
    location: "Surry Hills, NSW",
    description: "Beautiful vintage-style leather bag. Holds 2 rackets and gear. Perfect for the stylish player.",
    seller_name: "Sarah M.",
    seller_email: "sarah.m@example.com",
    seller_id: 3,
    seller_type: "partner"
  },
  {
    id: 103,
    title: "Babolat Pure Drive 2023",
    price: "220",
    condition: "Used - Excellent",
    image: "https://images.unsplash.com/photo-1617083934555-5634045431b0?w=800&q=80",
    location: "Manly, NSW",
    description: "Used for one season. Grip size L3. Amazing power and spin. Selling because I switched to Pure Aero.",
    seller_name: "Mike R.",
    seller_email: "mike.r@example.com",
    seller_id: 4,
    seller_type: "coach"
  },
  {
    id: 104,
    title: "Nike Court Zoom Vapor",
    price: "90",
    condition: "New in Box",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    location: "Parramatta, NSW",
    description: "Size US 10. Brand new, never worn. Wrong size gift.",
    seller_name: "Alex K.",
    seller_email: "alex.k@example.com",
    seller_id: 5,
    seller_type: "partner"
  },
  {
    id: 105,
    title: "Head Speed Pro 2024",
    price: "250",
    condition: "New",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&q=80",
    location: "Chatswood, NSW",
    description: "Brand new Head Speed Pro. Unstrung. Grip L2.",
    seller_name: "Jessica L.",
    seller_email: "jessica.l@example.com",
    seller_id: 6,
    seller_type: "coach"
  },
  {
    id: 106,
    title: "Case of Wilson US Open Balls",
    price: "180",
    condition: "New",
    image: "https://images.unsplash.com/photo-1558365849-6ebd8b0454b2?w=800&q=80",
    location: "North Sydney, NSW",
    description: "Unopened case of 24 cans. Extra duty felt.",
    seller_name: "Club Pro",
    seller_email: "proshop@example.com",
    seller_id: 7,
    seller_type: "partner"
  }
];

export const CLUBS_DATA = [
  {
    id: 1,
    name: "Royal Sydney Tennis Club",
    location: "Rose Bay, NSW",
    description: "One of the most prestigious tennis clubs in Sydney, featuring 18 grass courts and 8 hard courts. We host regular social competitions, professional coaching clinics, and annual championships. Our facilities include a pro shop, clubhouse with dining, and member lounge.",
    services: ["Grass Courts", "Hard Courts", "Coaching", "Pro Shop", "Tournaments", "Social Events"],
    price: "45",
    phone: "+61 2 9371 4333",
    website: "https://www.rsgc.com.au",
    image: "https://images.unsplash.com/photo-1560012057-4372e14c5085?q=80&w=1600&auto=format&fit=crop",
    rating: 4.9
  },
  {
    id: 2,
    name: "White City Tennis",
    location: "Paddington, NSW",
    description: "Iconic tennis venue with a rich history. Recently redeveloped with state-of-the-art facilities. We offer court hire, private coaching, and high-performance squad training. Home to the Sydney International for many years.",
    services: ["Hard Courts", "Synthetic Grass", "Gym", "Cafe", "Squad Training"],
    price: "35",
    phone: "+61 2 9331 4144",
    website: "https://www.whitecity.com.au",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1600&auto=format&fit=crop",
    rating: 4.7
  },
  {
    id: 3,
    name: "Manly Seaside Tennis",
    location: "Manly, NSW",
    description: "Play tennis with an ocean breeze. Our club offers 6 synthetic grass courts right next to Manly Beach. Perfect for casual hitting and social doubles. We run evening competitions and weekend round-robins.",
    services: ["Synthetic Grass", "Beachside", "Social Comps", "Night Tennis", "BBQ Area"],
    price: "25",
    phone: "+61 2 9977 6023",
    website: "https://www.manlytennis.com.au",
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=1600&q=80",
    rating: 4.8
  },
  {
    id: 4,
    name: "East Courts Tennis",
    location: "Kingsford, NSW",
    description: "Family-friendly tennis centre with 8 well-maintained hard courts. We specialize in junior development programs and holiday camps. Affordable court hire rates for students and seniors.",
    services: ["Hard Courts", "Junior Program", "Holiday Camps", "Equipment Hire"],
    price: "20",
    phone: "+61 2 9662 7033",
    website: "https://www.eastcourts.com.au",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1600&auto=format&fit=crop",
    rating: 4.5
  },
  {
    id: 5,
    name: "North Shore Tennis Centre",
    location: "Chatswood, NSW",
    description: "Premier tennis facility on the North Shore. 12 floodlit courts allowing for play until 10pm. We have a fully stocked pro shop and racket restringing service on-site.",
    services: ["Hard Courts", "Floodlights", "Restringing", "Parking", "Showers"],
    price: "30",
    phone: "+61 2 9411 1500",
    website: "https://www.nstc.com.au",
    image: "https://images.unsplash.com/photo-1626244422423-4d535130a55c?q=80&w=1600&auto=format&fit=crop",
    rating: 4.6
  },
  {
    id: 6,
    name: "Coogee Tennis Club",
    location: "Coogee, NSW",
    description: "Community-focused club with a relaxed atmosphere. 4 synthetic grass courts nestled in a park setting. Great for families and beginners. We host regular social BBQs.",
    services: ["Synthetic Grass", "Park Setting", "Social Events", "Coaching"],
    price: "22",
    phone: "+61 2 9665 5723",
    website: "https://www.coogeetennis.com.au",
    image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=1600&auto=format&fit=crop",
    rating: 4.7
  },
  {
    id: 7,
    name: "Sydney Olympic Park Tennis",
    location: "Homebush, NSW",
    description: "World-class venue that hosted the 2000 Olympics. Play on the same courts as the pros. 16 match courts and indoor training facilities available for public booking.",
    services: ["Plexicushion Courts", "Indoor Courts", "High Performance", "Gym", "Cafe"],
    price: "40",
    phone: "+61 2 9714 4000",
    website: "https://www.tennisworld.net.au",
    image: "https://images.unsplash.com/photo-1576617497557-2c8419c72e61?q=80&w=1600&auto=format&fit=crop",
    rating: 4.8
  },
  {
    id: 8,
    name: "Rushcutters Bay Tennis",
    location: "Rushcutters Bay, NSW",
    description: "Beautifully located courts right by the harbor. 5 synthetic grass courts and 2 hard courts. The kiosk serves great coffee and snacks. Very popular for morning cardio tennis.",
    services: ["Harbour Views", "Cafe", "Cardio Tennis", "Synthetic Grass"],
    price: "32",
    phone: "+61 2 9331 4700",
    website: "https://www.rushcutterstennis.com.au",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop",
    rating: 4.9
  },
  {
    id: 9,
    name: "Alexandria Tennis Hub",
    location: "Alexandria, NSW",
    description: "Urban tennis centre with a vibrant community. 6 hard courts with excellent lighting. We run popular mixed doubles leagues on Tuesday nights.",
    services: ["Hard Courts", "Leagues", "Night Tennis", "Bar"],
    price: "28",
    phone: "+61 2 9698 9451",
    website: "https://www.alexandriatennis.com.au",
    image: "https://images.unsplash.com/photo-1588701292080-6927d2c3df31?q=80&w=1600&auto=format&fit=crop",
    rating: 4.4
  },
  {
    id: 10,
    name: "Marrickville Lawn Tennis",
    location: "Marrickville, NSW",
    description: "One of the few clubs offering real grass courts in the Inner West. A hidden gem with a traditional clubhouse and friendly members.",
    services: ["Grass Courts", "Clubhouse", "Social", "Bar"],
    price: "30",
    phone: "+61 2 9558 1742",
    website: "https://www.marrickvilletennis.com.au",
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1600&auto=format&fit=crop",
    rating: 4.6
  },
  {
    id: 11,
    name: "Parramatta Tennis Centre",
    location: "Parramatta, NSW",
    description: "Large regional centre with 14 courts. We offer affordable coaching programs for all ages and host regular UTR tournaments.",
    services: ["Hard Courts", "Clay Courts", "Tournaments", "Coaching"],
    price: "25",
    phone: "+61 2 9683 1703",
    website: "https://www.parramattatennis.com.au",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1600&auto=format&fit=crop",
    rating: 4.3
  }
];

export const PARTNERS_DATA = [
  {
    id: 1,
    name: "John D.",
    location: "Bondi Beach, NSW",
    skillLevel: "Advanced",
    bio: "I've been playing tennis for 15 years. Looking for a hitting partner for weekday mornings. I love high-intensity rallies.",
    avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop",
    available: true
  },
  {
    id: 2,
    name: "Sarah M.",
    location: "Surry Hills, NSW",
    skillLevel: "Intermediate",
    bio: "Looking for friendly matches on weekends. I enjoy doubles as well!",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    available: true
  },
  {
    id: 3,
    name: "Mike R.",
    location: "Manly, NSW",
    skillLevel: "Beginner",
    bio: "Just started playing tennis a few months ago. Looking for someone to practice with.",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop",
    available: false
  },
  {
    id: 4,
    name: "Emily W.",
    location: "Coogee, NSW",
    skillLevel: "Advanced",
    bio: "Former college player. Looking for competitive sets.",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
    available: true
  },
  {
    id: 5,
    name: "David C.",
    location: "Sydney CBD, NSW",
    skillLevel: "Intermediate",
    bio: "Available evenings after work. Let's hit!",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400&h=400&fit=crop",
    available: true
  },
  {
    id: 6,
    name: "Jessica L.",
    location: "Chatswood, NSW",
    skillLevel: "Beginner",
    bio: "Looking for a patient partner to practice basics.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
    available: true
  },
  {
    id: 7,
    name: "James W.",
    location: "Sutherland, NSW",
    skillLevel: "Advanced",
    bio: "Love playing matches. Contact me if you want a challenge.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
    available: false
  },
  {
    id: 8,
    name: "Anna K.",
    location: "Parramatta, NSW",
    skillLevel: "Intermediate",
    bio: "Looking for mixed doubles partner for upcoming tournament.",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop",
    available: true
  }
];