import { motion } from "framer-motion";
import { ShoppingBag, Tag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import racketImg from "@assets/generated_images/used_professional_tennis_racket.png";
import bagImg from "@assets/generated_images/vintage_tennis_bag.png";

const items = [
  {
    id: 1,
    title: "Wilson Pro Staff RF97",
    price: "$180",
    condition: "Used - Good",
    image: racketImg,
    location: "Bondi Beach, NSW"
  },
  {
    id: 2,
    title: "Vintage Leather Tennis Bag",
    price: "$120",
    condition: "Like New",
    image: bagImg,
    location: "Surry Hills, NSW"
  },
  {
    id: 3,
    title: "Babolat Pure Drive 2023",
    price: "$220",
    condition: "Used - Excellent",
    image: "https://images.unsplash.com/photo-1617083934555-5634045431b0?w=800&q=80",
    location: "Manly, NSW"
  },
  {
    id: 4,
    title: "Nike Court Zoom Vapor",
    price: "$90",
    condition: "New in Box",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    location: "Parramatta, NSW"
  }
];

export function Marketplace() {
  return (
    <section className="py-24 bg-secondary/30" id="marketplace">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 mb-4">
              <Tag className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Marketplace</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold">
              Tennis <span className="text-primary">Gear Exchange</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl text-lg">
              Buy and sell pre-loved tennis equipment in Sydney. From rackets to vintage gear, find great deals from local players.
            </p>
          </div>
          <Button variant="outline" className="hidden md:flex gap-2">
            View All Listings <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group">
                <div className="aspect-square relative overflow-hidden bg-gray-100">
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-sm font-bold px-3 py-1 rounded-full">
                    {item.price}
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg truncate mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{item.location}</p>
                  <div className="inline-block bg-secondary px-2 py-1 rounded text-xs font-medium text-secondary-foreground">
                    {item.condition}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button className="w-full bg-black text-white hover:bg-gray-800">
                    Contact Seller
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 md:hidden">
          <Button variant="outline" className="w-full gap-2">
            View All Listings <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
