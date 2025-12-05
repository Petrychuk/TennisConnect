import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import avatar1 from "@assets/generated_images/tennis_club_owner_portrait.png";
import avatar2 from "@assets/generated_images/female_tennis_coach_portrait.png";

const testimonials = [
  {
    name: "James Wilson",
    role: "Owner, Sydney Harbour Tennis Club",
    image: avatar1,
    content: "TennisConnect has revolutionized how we fill our court bookings. Since joining, our off-peak utilization has increased by 40%. It's the best platform for reaching the local Sydney tennis community.",
    rating: 5
  },
  {
    name: "Sarah Thompson",
    role: "Head Coach, Northern Beaches Tennis",
    image: avatar2,
    content: "Finding new students for my junior academy used to be a challenge. Now, parents find me directly through the app. The verified reviews help build trust instantly.",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "Director, Chatswood Tennis Centre",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
    content: "The marketplace feature is a game changer. Our members love buying and selling gear within a trusted community. It brings more life to our club atmosphere.",
    rating: 5
  }
];

export function Testimonials() {
  return (
    <section className="py-24 bg-black text-white relative overflow-hidden" id="reviews">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">
              Trusted by Sydney's <span className="text-primary">Best Clubs</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Hear from club owners and coaches who are growing their business with TennisConnect.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors duration-300 h-full">
                <CardContent className="p-8">
                  <Quote className="w-10 h-10 text-primary/20 mb-6" />
                  
                  <div className="flex gap-1 mb-6">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                    ))}
                  </div>
                  
                  <p className="text-gray-300 mb-8 leading-relaxed min-h-[100px]">
                    "{item.content}"
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{item.name}</h4>
                      <p className="text-sm text-primary">{item.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
