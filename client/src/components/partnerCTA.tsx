import {
    Building2,
    CheckCircle,
    Phone,
  } from "lucide-react";
  
  import {
    Button,
  } from "@/components/ui/button";
  
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog";
  
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Textarea } from "@/components/ui/textarea";
  
  export function PartnerCTA() {
    return (
      <div className="my-10 md:my-16
        bg-[url('/assets/images/subtle_abstract_tennis-themed_background_with_lime_green_accents.webp')]
        border border-primary/20
        rounded-3xl
        p-4 md:p-8 lg:p-10
        relative
        overflow-hidden">
    
        <div className="absolute
        inset-0
        bg-gradient-to-r
        from-[hsl(var(--tennis-ball))/5]
        via-transparent
        to-[hsl(var(--tennis-ball))/10]" />
  
        <div className="relative
        z-10
        grid
        lg:grid-cols-[1.5fr_1fr]
        gap-8
        lg:gap-12
        items-center
        text-center
        lg:text-left">
  
          <div className="max-w-3xl mx-auto md:mx-0">
  
            <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-sm font-bold mb-4 backdrop-blur-sm">
              <Building2 className="w-4 h-4" />
              JOIN TENNISCONNECT
            </div>
  
            <h3 className="text-2xl md:text-5xl leading-tight font-display font-bold mb-4">
              Join Australia's Tennis Network
            </h3>
  
            <p className="text-lg opacity-90 mb-8 max-w-xl">
            Reach more local players, promote your venue, and grow your tennis community with TennisConnect.
            </p>
  
            <div className="flex flex-col sm:flex-row gap-4">
  
              {/* <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="font-bold text-primary h-12 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer"
                    onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("open-support-chat")
                        );
                      }}
                  >
                    List Your Venue
                  </Button>
                </DialogTrigger>
  
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Partner Inquiry
                    </DialogTitle>
  
                    <DialogDescription>
                      Fill out this form and our team will contact you within 24 hours.
                    </DialogDescription>
                  </DialogHeader>
  
                  <div className="space-y-4 py-4">
  
                    <div className="space-y-2">
                      <Label>Club Name</Label>
                      <Input placeholder="e.g. Grand Slam Tennis Centre" />
                    </div>
  
                    <div className="space-y-2">
                      <Label>Contact Person</Label>
                      <Input placeholder="Your Name" />
                    </div>
  
                    <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input placeholder="+61 ..." />
                    </div>
  
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea placeholder="Tell us about your facilities..." />
                    </div>
  
                  </div>
  
                  <DialogFooter>
                    <Button className="w-full cursor-pointer">
                      Send Inquiry
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog> */}
              <Button
                size="lg"
                variant="secondary"
                className="
                    w-[220px]
                    md:w-auto
                    mx-auto
                    md:mx-0
                    rounded-xl
                    shadow-lg
                    hover:shadow-xl
                    transition-all
                    cursor-pointer
                "
                onClick={() => {
                    window.dispatchEvent(
                    new CustomEvent("open-support-chat")
                    );
                }}
                >
                List Your Venue
                </Button>
   
            </div>
          </div>
  
          <div className="hidden md:block p-8 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 rotate-3 hover:rotate-0 transition-transform duration-500">
  
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
  
              <div className="text-left">
                <p className="font-semibold text-base md:text-lg">Clubs & Courts</p>   
              </div>
            </div>
  
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
  
              <div className="text-left">
                <p className="font-semibold text-base md:text-lg">Tennis Communities</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
  
              <div className="text-left">
                <p className="font-semibold text-base md:text-lg">Social Groups</p>   
              </div>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
  
              <div className="text-left">
                <p className="font-semibold text-base md:text-lg">Coaching Academies</p>   
              </div>
            </div>
          </div>
  
        </div>
      </div>
    );
  }