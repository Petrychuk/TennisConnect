import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, Bell, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/seo";

import { OrganiserSidebarNav } from "@/components/organiser/ui/organiser-sidebar";
import { OrganiserMobileNav } from "@/components/organiser/ui/organiser-mobile-nav";
import { WizardStepSidebar } from "@/components/organiser/sessions/wizard/wizard-step-sidebar";
import { WizardStepIndicator } from "@/components/organiser/sessions/wizard/wizard-step-indicator";
import { Step1SessionType } from "@/components/organiser/sessions/wizard/step1-session-type";
import { Step2DateRegistration } from "@/components/organiser/sessions/wizard/step2-date-registration";
import { Step3DetailsRules } from "@/components/organiser/sessions/wizard/step3-details-rules";
import { Step4ReviewPublish } from "@/components/organiser/sessions/wizard/step4-review-publish";
import { PendingApprovalDialog } from "@/components/organiser/sessions/wizard/pending-approval-dialog";

import { mockOrganiser } from "@/lib/organiser-hub-mock-data";
import {
  createEmptyDraft,
  SESSION_TYPE_OPTIONS,
  type NewSessionDraft,
} from "@/lib/organiser-session-wizard-types";

export default function OrganiserSessionNewPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const profileHref = user ? `/${user.role}/${user.slug}` : "/";

  const [draft, setDraft] = useState<NewSessionDraft>(createEmptyDraft);
  const [step, setStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [pendingApprovalOpen, setPendingApprovalOpen] = useState(false);

  const updateDraft = <K extends keyof NewSessionDraft>(key: K, value: NewSessionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const goToStep = (target: number) => {
    if (target <= maxReachedStep) setStep(target);
  };

  const canProceedFromStep1 = draft.type !== null;

  const handleNext = () => {
    if (step === 1 && !canProceedFromStep1) {
      toast({ title: "Choose a session type to continue" });
      return;
    }
    const next = Math.min(step + 1, 4);
    setStep(next);
    setMaxReachedStep((prev) => Math.max(prev, next));
  };

  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleSaveDraft = () => {
    toast({ title: "Saved as draft", description: "Pick up where you left off any time from Sessions." });
    setLocation("/organiser/sessions");
  };

  const handlePublish = () => {
    setPendingApprovalOpen(true);
  };

  if (authLoading) return null;
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  if (!user?.isOrganizer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="max-w-md w-full shadow-sm">
          <CardHeader>
            <CardTitle>Organiser access required</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            You need to be an approved organiser to view this page. Head to your profile to
            request organiser access.
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeLabel = SESSION_TYPE_OPTIONS.find((t) => t.key === draft.type)?.label ?? "session";

  return (
    <div className="min-h-screen flex bg-background" data-testid="organiser-session-new-page">
      <SEO
        title="Create New Session | Organiser Hub | TennisConnect"
        description="Create a new tennis session in just a few steps."
        noIndex
      />

      <aside className="hidden xl:flex xl:w-64 shrink-0 border-r border-border">
        <OrganiserSidebarNav organiser={mockOrganiser} profileHref={profileHref} className="w-full" />
      </aside>

      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        {/* Compact bar — tablet & mobile */}
        <div className="flex xl:hidden items-center justify-between px-4 h-14 border-b border-border bg-card">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:inline-flex" data-testid="organiser-sidebar-trigger">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SheetTitle className="sr-only">Organiser Hub navigation</SheetTitle>
              <OrganiserSidebarNav organiser={mockOrganiser} profileHref={profileHref} />
            </SheetContent>
          </Sheet>
          <div className="w-9 h-9 md:hidden" aria-hidden="true" />

          <div className="font-display font-bold">New Session</div>

          <div className="flex items-center gap-1">
            <Link href="/messages">
              <Button variant="ghost" size="icon" className="relative" data-testid="organiser-header-bell-mobile">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
              </Button>
            </Link>
            <Link href={profileHref}>
              <Avatar className="h-8 w-8 border border-border">
                <AvatarImage src={mockOrganiser.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {mockOrganiser.name[0]}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-6xl mx-auto">
          {/* Desktop header row */}
          <div className="hidden xl:flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Create New Session</h1>
              <p className="text-muted-foreground mt-1">Create a new tennis session in just a few steps.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={handleSaveDraft} data-testid="organiser-wizard-save-draft-top">
                Save as Draft
              </Button>
              {step < 4 ? (
                <Button onClick={handleNext} data-testid="organiser-wizard-next-top">
                  Next Step
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handlePublish} data-testid="organiser-wizard-publish-top">
                  Publish Session
                </Button>
              )}
            </div>
          </div>

          {/* Tablet/mobile header */}
          <div className="xl:hidden">
            <h1 className="font-display text-xl sm:text-2xl font-bold">Create New Session</h1>
            <p className="text-muted-foreground text-sm mt-1">Create a new tennis session in just a few steps.</p>
          </div>

          {/* Tablet/mobile step indicator */}
          <div className="xl:hidden">
            <WizardStepIndicator currentStep={step} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="hidden xl:block">
              <WizardStepSidebar currentStep={step} maxReachedStep={maxReachedStep} onStepClick={goToStep} />
            </div>

            <div className="xl:col-span-3 space-y-6">
              {step === 1 && <Step1SessionType value={draft.type} onChange={(v) => updateDraft("type", v)} />}
              {step === 2 && <Step2DateRegistration draft={draft} onChange={updateDraft} />}
              {step === 3 && <Step3DetailsRules draft={draft} onChange={updateDraft} />}
              {step === 4 && <Step4ReviewPublish draft={draft} />}

              {/* Tablet/mobile nav buttons */}
              <div className="xl:hidden flex flex-col sm:flex-row gap-2">
                {step > 1 && (
                  <Button variant="outline" onClick={handleBack} className="sm:order-1" data-testid="organiser-wizard-back">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                <Button variant="outline" onClick={handleSaveDraft} className="sm:order-2" data-testid="organiser-wizard-save-draft">
                  Save Draft
                </Button>
                {step < 4 ? (
                  <Button onClick={handleNext} className="sm:order-3 sm:ml-auto" data-testid="organiser-wizard-next">
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handlePublish} className="sm:order-3 sm:ml-auto" data-testid="organiser-wizard-publish">
                    Publish Session
                  </Button>
                )}
              </div>

              {/* Desktop bottom nav row (Back appears once past step 1) */}
              <div className="hidden xl:flex items-center justify-between">
                <div>
                  {step > 1 && (
                    <Button variant="outline" onClick={handleBack} data-testid="organiser-wizard-back-bottom">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleSaveDraft} data-testid="organiser-wizard-save-draft-bottom">
                    Save as Draft
                  </Button>
                  {step < 4 ? (
                    <Button onClick={handleNext} data-testid="organiser-wizard-next-bottom">
                      Next Step
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button onClick={handlePublish} data-testid="organiser-wizard-publish-bottom">
                      Publish Session
                    </Button>
                  )}
                </div>
              </div>

              {step === 1 && (
                <div className="rounded-2xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <Clock className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">You can always edit session details later</p>
                    <p className="text-xs text-muted-foreground">All settings can be changed before you start the live session.</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-medium text-primary flex items-center gap-1 shrink-0"
                    onClick={() => toast({ title: "Example sessions isn't wired up yet" })}
                    data-testid="organiser-wizard-view-examples"
                  >
                    View example sessions
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <OrganiserMobileNav />

      <PendingApprovalDialog open={pendingApprovalOpen} sessionName={draft.name || "Untitled Session"} sessionTypeLabel={typeLabel} />
    </div>
  );
}
