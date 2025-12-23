import { motion } from "framer-motion";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, MapPin, ShoppingBag, Filter, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { MARKETPLACE_DATA } from "@/lib/dummy-data";

import heroBg from "/assets/images/elegant_dark_tennis_equipment_display_background.png";

import { Link } from "wouter";
import { User, ShieldCheck } from "lucide-react";

export default function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Buy Modal State
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [buyName, setBuyName] = useState("");
  const [buyEmail, setBuyEmail] = useState("");
  const [buyPhone, setBuyPhone] = useState("");
  const [buyMessage, setBuyMessage] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    
    async function fetchMarketplaceItems() {
      try {
        const res = await fetch("/api/marketplace", {
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          // Transform data to match expected format
          const transformedItems = data.map((item: any) => ({
            ...item,
            title: item.title,
            image: item.image || "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&h=800&fit=crop",
            seller_name: item.sellerName,
            seller_email: item.sellerEmail,
          }));
          setItems(transformedItems);
        } else {
          // Fallback to dummy data if API fails
          setItems(MARKETPLACE_DATA);
        }
      } catch (error) {
        console.error("Failed to fetch marketplace items:", error);
        // Fallback to dummy data
        setItems(MARKETPLACE_DATA);
      } finally {
        setLoading(false);
      }
    }
    
    fetchMarketplaceItems();
  }, []);

  const filteredItems = items.filter(item => {
    // Safe access to title and description
    const title = (item.title || item.name || "").toLowerCase();
    const description = (item.description || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = title.includes(query) || description.includes(query);
    return matchesSearch;
  });

  const handleBuyRequest = () => {
     if (!buyName || (!buyEmail && !buyPhone)) {
        toast({
          variant: "destructive",
          title: "Missing Contact Info",
          description: "Please provide your name and either email or phone number."
        });
        return;
     }

     setIsBuyModalOpen(false);
     toast({
       title: "Order Request Sent!",
       description: `A request for "${selectedItem?.title || selectedItem?.name}" has been sent to ${selectedItem?.seller_name}.`
     });
     
     // Reset
     setBuyName("");
     setBuyEmail("");
     setBuyPhone("");
     setBuyMessage("");
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar />
      
      <main className="pb-24 pt-20">
        {/* Header */}
            <div className="relative border-b-0 py-32 mb-12 overflow-hidden bg-black/90">
                <div className="absolute inset-0 z-0">
                   <img src={heroBg} className="w-full h-full object-cover opacity-40" alt="Marketplace Background" />
                   <div className="absolute inset-0 bg-linear-to-b from-black/80 via-black/60 to-background"></div>
                </div>
                
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <Badge className="mb-6 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-1.5 text-sm font-bold shadow-[0_0_20px_rgba(223,255,0,0.4)] border-none">
                        Official Marketplace
                    </Badge>
                    <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 tracking-tight text-white drop-shadow-xl">
                        Tennis <span className="text-primary relative inline-block">
                            Gear Exchange
                            <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-50" viewBox="0 0 100 10" preserveAspectRatio="none">
                               <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                            </svg>
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto leading-relaxed drop-shadow-md font-medium">
                        The trusted place for Sydney's tennis community to buy, sell, and trade pre-loved equipment.
                    </p>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="container mx-auto px-4 mb-12">
                <div className="flex flex-col md:flex-row gap-4 items-center bg-card p-4 rounded-xl border shadow-sm">
                    <div className="relative grow w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input 
                          placeholder="Search for rackets, bags, shoes..." 
                          className="pl-9 bg-background"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select defaultValue="all">
                            <SelectTrigger className="w-[180px]">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4" />
                                    <SelectValue placeholder="Category" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="rackets">Rackets</SelectItem>
                                <SelectItem value="bags">Bags</SelectItem>
                                <SelectItem value="shoes">Shoes</SelectItem>
                                <SelectItem value="apparel">Apparel</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="gap-2">
                            <ArrowUpDown className="w-4 h-4" /> Sort
                        </Button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredItems.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 group h-full flex flex-col border-border/50">
                                <div className="aspect-4/3 relative overflow-hidden bg-muted">
                                    <img 
                                      src={item.image || item.photos?.[0]} 
                                      alt={item.title || item.name} 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute top-3 right-3 flex gap-2">
                                        <Badge className="bg-black/70 backdrop-blur-md text-white border-none shadow-sm">
                                            ${item.price}
                                        </Badge>
                                    </div>
                                    {item.isLocal && (
                                        <div className="absolute top-3 left-3">
                                            <Badge className="bg-primary text-primary-foreground font-bold shadow-sm">
                                                New Listing
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                                <CardContent className="p-5 flex flex-col grow">
                                    <div className="mb-2">
                                        <h3 className="font-bold text-lg leading-tight line-clamp-1" title={item.title || item.name}>
                                            {item.title || item.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {item.location}
                                        </p>
                                    </div>
                                    
                                    <div className="flex gap-2 mb-4">
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {item.condition}
                                        </Badge>
                                    </div>
                                    
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 grow">
                                        {item.description}
                                    </p>
                                    
                                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                                        <Link href={item.seller_type === 'coach' ? `/coach/${item.seller_id}` : `#`}>
                                            <div className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer group/seller">
                                                {item.seller_type === 'coach' ? (
                                                    <div className="bg-primary/10 p-1 rounded-full">
                                                        <ShieldCheck className="w-3 h-3 text-primary" />
                                                    </div>
                                                ) : (
                                                    <div className="bg-muted p-1 rounded-full">
                                                        <User className="w-3 h-3" />
                                                    </div>
                                                )}
                                                <span className="font-medium group-hover/seller:underline">{item.seller_name}</span>
                                            </div>
                                        </Link>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-4 pt-0">
                                    <Button 
                                        className="w-full font-bold gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                        onClick={() => {
                                            setSelectedItem(item);
                                            setIsBuyModalOpen(true);
                                            if (user) {
                                                setBuyName(user.name || "");
                                                setBuyEmail(user.email || "");
                                            }
                                        }}
                                    >
                                        <ShoppingBag className="w-4 h-4" /> Buy / Offer
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="text-center py-24 text-muted-foreground">
                        <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-bold mb-2">No items found</h3>
                        <p>Try adjusting your search terms or filters.</p>
                    </div>
                )}
            </div>
          </main>
          <Footer />
          {/* Buy Modal */}
          <Dialog open={isBuyModalOpen} onOpenChange={setIsBuyModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Contact Seller</DialogTitle>
                    <DialogDescription>
                        Send a message to {selectedItem?.seller_name} about {selectedItem?.title || selectedItem?.name}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="p-3 bg-muted/30 rounded-lg flex gap-3 items-center border">
                        <img 
                            src={selectedItem?.image || selectedItem?.photos?.[0]} 
                            className="w-16 h-16 rounded object-cover bg-muted" 
                        />
                        <div>
                            <p className="font-bold">{selectedItem?.title || selectedItem?.name}</p>
                            <p className="text-primary font-bold">${selectedItem?.price}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Your Name</Label>
                        <Input 
                            value={buyName} 
                            onChange={(e) => setBuyName(e.target.value)} 
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input 
                                value={buyEmail} 
                                onChange={(e) => setBuyEmail(e.target.value)} 
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input 
                                value={buyPhone} 
                                onChange={(e) => setBuyPhone(e.target.value)} 
                                placeholder="04XX XXX XXX"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea 
                            value={buyMessage} 
                            onChange={(e) => setBuyMessage(e.target.value)} 
                            placeholder="Hi, is this still available? When can I pick it up?" 
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsBuyModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleBuyRequest} className="font-bold bg-primary text-primary-foreground">Send Request</Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>
  );
}