import { motion } from "framer-motion";
import { ShoppingBag, Tag, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MARKETPLACE_DATA } from "@/lib/dummy-data";
import { useState, useEffect } from "react";
import { Link } from "wouter";

export function Marketplace() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    // 1. Load static dummy data (take first 4)
    let displayItems = [...MARKETPLACE_DATA].slice(0, 4);
    
    // 2. Load user's local items if any to PREPEND them (simulating "latest")
    const savedProfile = localStorage.getItem("tennis_connect_coach_profile");
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed.marketplace && Array.isArray(parsed.marketplace) && parsed.marketplace.length > 0) {
          const userItems = parsed.marketplace.map((item: any) => ({
            ...item,
            id: `local-${item.id}`,
            image: item.photos?.[0], // Map photos to image
            title: item.name // Map name to title
          }));
          
          // Combine: User items first, then fill remaining slots with static data
          displayItems = [...userItems, ...displayItems].slice(0, 4);
        }
      } catch (e) {
        console.error("Failed to load local items", e);
      }
    }
    
    setItems(displayItems);
  }, []);

  return (
    <section className="py-24 bg-secondary/30" id="marketplace">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 mb-4">
              <Tag className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Маркетплейс</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display font-bold">
              Теннисное <span className="text-primary">снаряжение</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl text-lg">
              Покупайте и продавайте б/у теннисное оборудование в Сиднее. От ракеток до винтажного снаряжения — отличные предложения от местных игроков.
            </p>
          </div>
          <Link href="/marketplace">
            <Button variant="outline" className="hidden md:flex gap-2 cursor-pointer">
                Все объявления <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
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
              <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group h-full flex flex-col">
                <div className="aspect-square relative overflow-hidden bg-gray-100">
                  <img 
                    src={item.image || item.photos?.[0]} 
                    alt={item.title || item.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-sm font-bold px-3 py-1 rounded-full">
                    ${item.price}
                  </div>
                </div>
                <CardContent className="p-4 flex flex-col flex-grow">
                  <h3 className="font-bold text-lg truncate mb-1" title={item.title || item.name}>{item.title || item.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {item.location}
                  </p>
                  <div className="inline-block bg-secondary px-2 py-1 rounded text-xs font-medium text-secondary-foreground w-fit mt-auto">
                    {item.condition}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Link href={`/coach/${item.seller_id || item.id}`}>
                    <Button className="w-full bg-black text-white hover:bg-gray-800 cursor-pointer">
                        Подробнее
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 md:hidden">
          <Link href="/marketplace">
            <Button variant="outline" className="w-full gap-2 cursor-pointer">
                Все объявления <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
