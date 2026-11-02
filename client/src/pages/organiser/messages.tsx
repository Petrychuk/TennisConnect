import { MessagesInbox } from "@/components/messages/MessagesInbox";
import { OrganiserLayout } from "@/components/organiser/ui/organiser-layout";
import { OrganiserBreadcrumb } from "@/components/organiser/ui/organiser-breadcrumb";

// The site inbox inside the Hub shell. MessagesInbox renders the page's
// one <h1> ("Messages") - the separate sr-only H1 this page used to add
// made two.
export default function OrganiserMessagesPage() {
  return (
    <OrganiserLayout
      testId="organiser-messages-page"
      seoTitle="Messages | Organiser Hub | TennisConnect"
      seoDescription="Your messages, right from the Organiser Hub."
      mobileTitle="Messages"
    >
      <div className="px-2 sm:px-6 lg:px-8 py-6 space-y-6">
        <OrganiserBreadcrumb current="Messages" testId="organiser-messages-page-breadcrumb" />
        <MessagesInbox />
      </div>
    </OrganiserLayout>
  );
}
