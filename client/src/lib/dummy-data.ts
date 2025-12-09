import heroImage from "@assets/generated_images/professional_tennis_coaching_session_on_a_sunny_court.png";
import avatarImage from "@assets/generated_images/female_tennis_coach_portrait.png";

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

import racketImg from "@assets/generated_images/used_professional_tennis_racket.png";
import bagImg from "@assets/generated_images/vintage_tennis_bag.png";

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