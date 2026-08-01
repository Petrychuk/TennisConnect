import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import SEO from "@/components/seo";
import { MessagesInbox } from "@/components/messages/MessagesInbox";

export default function MessagesPage() {
  return (
    <>
      <SEO
        title="Messages | TennisConnect"
        description="Private messages."
        canonical="/messages"
        noIndex
      />
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <MessagesInbox />
        </div>
        <Footer />
      </div>
    </>
  );
}
