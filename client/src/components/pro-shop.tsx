import { motion } from "framer-motion";
import { Sparkles, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const newArrivals = [
  {
    id: 1,
    title: "Wilson Pro Staff RF97",
    price: 349,
    originalPrice: 399,
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&h=400&fit=crop",
    badge: "New",
    category: "Rackets"
  },
  {
    id: 2,
    title: "Nike Court Zoom Vapor",
    price: 189,
    originalPrice: 219,
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop",
    badge: "Bestseller",
    category: "Shoes"
  },
  {
    id: 3,
    title: "Babolat Pure Drive",
    price: 279,
    originalPrice: null,
    image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=400&h=400&fit=crop",
    badge: "Pro Choice",
    category: "Rackets"
  },
  {
    id: 4,
    title: "Head Tennis Bag Tour",
    price: 129,
    originalPrice: 159,
    image: "https://images.unsplash.com/photo-1584735175315-9d5df23860e6?w=400&h=400&fit=crop",
    badge: "Sale",
    category: "Bags"
  },
];

export function ProShop() {
  const handleShopClick = () => {
    window.open("https://shop.tennisconnect.com", "_blank", "noopener,noreferrer");
  };

  return (
    <section className="py-24 bg-gradient-to-b from-background to-secondary/30 relative overflow-hidden" id="shop">
      {/* Decorative Elements */}
      <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 mb-4"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">New Arrivals</span>
            </motion.div>
            
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl md:text-5xl font-display font-bold"
            >
              The Tennis <span className="text-primary">Vault</span>
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground mt-4 max-w-xl text-lg"
            >
              Premium gear from top brands. Elevate your game with the latest equipment, apparel, and accessories.
            </motion.p>
          </div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Button 
              onClick={handleShopClick}
              className="hidden md:flex gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-6 cursor-pointer"
              data-testid="shop-visit-button"
            >
              Visit Shop <ExternalLink className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {newArrivals.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="group overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer h-full"
                onClick={handleShopClick}
                data-testid={`product-card-${product.id}`}
              >
                <div className="relative aspect-square overflow-hidden bg-secondary/50">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  
                  {/* Badge */}
                  <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${
                    product.badge === "Sale" 
                      ? "bg-red-500 text-white" 
                      : product.badge === "New"
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/80 text-white"
                  }`}>
                    {product.badge}
                  </div>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-white font-bold flex items-center gap-2">
                      View in Shop <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    {product.category}
                  </p>
                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">
                    {product.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-display font-bold">${product.price}</span>
                    {product.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        ${product.originalPrice}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 md:hidden"
        >
          <Button 
            onClick={handleShopClick}
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full cursor-pointer"
          >
            Visit Shop <ExternalLink className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
