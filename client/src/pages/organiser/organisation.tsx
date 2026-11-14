import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ExternalLink, Globe, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { OrganiserLayout } from "@/components/organiser/ui/organiser-layout";
import { OrganiserBreadcrumb } from "@/components/organiser/ui/organiser-breadcrumb";
import { createOrganizationWithProfile, getMyOrganization, updateOrganization } from "@/lib/api/organizer-sessions";
import {
  ORGANIZATION_PROFILE_LIMITS,
  organizationProfileSchema,
  type OrganizationProfile,
} from "@shared/organizationProfile";
import type { Organization } from "@shared/schema";

/*
  "Your Organisation" (Organiser Hub, Phase 2 Batch 2).

  Edits the organiser's own organisation through the existing API:
  GET /api/organizer/organizations/me, PUT /api/organizer/organizations/:id
  (POST when they don't have one yet - normally the Create Session wizard
  makes one called "<name>'s Sessions" on first use, which is what most
  organisers will want to rename here).

  Fields are exactly what shared/organizationProfile.ts accepts: name,
  description, website, email, phone. Logo and cover aren't editable -
  there is no organisation image upload and neither is shown anywhere
  (docs/organiser-hub/KNOWN_LIMITATIONS.md).
*/

type FormKey = keyof OrganizationProfile;
type FormState = Record<FormKey, string>;

const EMPTY_FORM: FormState = { name: "", description: "", website: "", email: "", phone: "" };
const ORG_QUERY_KEY = ["/api/organizer/organizations/me"] as const;

function toForm(org: Organization | null | undefined): FormState {
  if (!org) return EMPTY_FORM;
  return {
    name: org.name ?? "",
    description: org.description ?? "",
    website: org.website ?? "",
    email: org.email ?? "",
    phone: org.phone ?? "",
  };
}

/** "400: {"message":"Organization not found"}" -> "Organization not found". */
function serverMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const json = raw.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* not JSON */
  }
  return json || "Something went wrong";
}

export default function OrganiserOrganisationPage() {
  return (
    <OrganiserLayout
      testId="organiser-organisation-page"
      seoTitle="Your Organisation | Organiser Hub | TennisConnect"
      seoDescription="Your organisation's name, description and contact details."
      mobileTitle="Your Organisation"
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-5xl">
        <OrganiserBreadcrumb current="Your Organisation" testId="organiser-organisation-breadcrumb" />
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Your Organisation</h1>
          <p className="text-muted-foreground mt-1">
            How your organisation appears to players on your public page and next to your sessions.
          </p>
        </div>
        <OrganisationContent />
      </div>
    </OrganiserLayout>
  );
}

function OrganisationContent() {
  const orgQuery = useQuery({ queryKey: ORG_QUERY_KEY, queryFn: getMyOrganization });

  if (orgQuery.isLoading) {
    return (
      <div className="space-y-3" data-testid="organiser-organisation-loading">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (orgQuery.isError) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-10 text-center space-y-3" role="alert" data-testid="organiser-organisation-error">
          <p className="font-medium">Couldn't load your organisation.</p>
          <Button variant="outline" className="min-h-11" onClick={() => orgQuery.refetch()} data-testid="organiser-organisation-retry">
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // key: a fresh form whenever another organisation (or none -> one) loads.
  return <OrganisationForm key={orgQuery.data?.id ?? "new"} organization={orgQuery.data ?? null} />;
}

function OrganisationForm({ organization }: { organization: Organization | null }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initial = useMemo(() => toForm(organization), [organization]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  const isNew = !organization;
  const dirty = (Object.keys(form) as FormKey[]).some((k) => form[k] !== initial[k]);

  const set = (key: FormKey) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = organizationProfileSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<FormKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FormKey;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSaving(true);
    try {
      const saved = isNew
        ? await createOrganizationWithProfile(parsed.data)
        : await updateOrganization(organization.id, parsed.data);
      queryClient.setQueryData(ORG_QUERY_KEY, saved);
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/organizations/by-user"] });
      setForm(toForm(saved));
      toast({ title: isNew ? "Organisation created" : "Organisation saved" });
    } catch (error) {
      toast({ title: "Couldn't save your organisation", description: serverMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <form onSubmit={handleSubmit} noValidate className="lg:col-span-2" data-testid="organiser-organisation-form">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Building2 className="w-4 h-4 text-primary-text" />
            <CardTitle asChild className="text-base">
              <h2>{isNew ? "Set up your organisation" : "Organisation details"}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNew && (
              <p className="text-sm text-muted-foreground" data-testid="organiser-organisation-new-note">
                You don't have an organisation yet. One is also created for you when you publish your first session.
              </p>
            )}
            <Field id="org-name" label="Name" error={errors.name} required>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                maxLength={ORGANIZATION_PROFILE_LIMITS.name}
                placeholder={user?.name ? `e.g. ${user.name} Tennis` : "e.g. Lyne Park Tennis"}
                autoComplete="organization"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "org-name-error" : undefined}
                className="min-h-11"
                data-testid="organiser-organisation-name"
              />
            </Field>
            <Field
              id="org-description"
              label="Description"
              error={errors.description}
              hint={`${form.description.length}/${ORGANIZATION_PROFILE_LIMITS.description}`}
            >
              <Textarea
                id="org-description"
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                maxLength={ORGANIZATION_PROFILE_LIMITS.description}
                placeholder="Who you are, where you play and who your sessions are for."
                className="min-h-28"
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "org-description-error" : undefined}
                data-testid="organiser-organisation-description"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="org-website" label="Website" error={errors.website} className="sm:col-span-2">
                <Input
                  id="org-website"
                  type="url"
                  inputMode="url"
                  value={form.website}
                  onChange={(e) => set("website")(e.target.value)}
                  placeholder="yourclub.com.au"
                  autoComplete="url"
                  aria-invalid={!!errors.website}
                  aria-describedby={errors.website ? "org-website-error" : undefined}
                  className="min-h-11"
                  data-testid="organiser-organisation-website"
                />
              </Field>
              <Field id="org-email" label="Contact email" error={errors.email}>
                <Input
                  id="org-email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="hello@yourclub.com.au"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "org-email-error" : undefined}
                  className="min-h-11"
                  data-testid="organiser-organisation-email"
                />
              </Field>
              <Field id="org-phone" label="Contact phone" error={errors.phone}>
                <Input
                  id="org-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="+61 2 9000 1234"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "org-phone-error" : undefined}
                  className="min-h-11"
                  data-testid="organiser-organisation-phone"
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Website, email and phone are shown to everyone on your public page. Leave a field empty to hide it.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              {!isNew && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setForm(initial);
                    setErrors({});
                  }}
                  data-testid="organiser-organisation-reset"
                >
                  Discard changes
                </Button>
              )}
              <Button type="submit" className="min-h-11" disabled={saving || (!isNew && !dirty)} data-testid="organiser-organisation-save">
                {saving ? "Saving…" : isNew ? "Create organisation" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="shadow-sm" data-testid="organiser-organisation-public-card">
        <CardHeader>
          <CardTitle asChild className="text-base">
            <h2>Public page</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {organization ? (
            <>
              <p className="font-semibold break-words">{organization.name}</p>
              <ContactList organization={organization} />
              <Button asChild variant="outline" className="w-full min-h-11">
                <Link href={`/organisations/${organization.slug}`} data-testid="organiser-organisation-view-public">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View public page
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Your public page appears once your organisation is created.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContactList({ organization }: { organization: Organization }) {
  const items = [
    organization.website && { icon: Globe, text: organization.website.replace(/^https?:\/\//, "") },
    organization.email && { icon: Mail, text: organization.email },
    organization.phone && { icon: Phone, text: organization.phone },
  ].filter(Boolean) as { icon: typeof Globe; text: string }[];
  if (items.length === 0) {
    return <p className="text-muted-foreground">No contact details yet.</p>;
  }
  return (
    <ul className="space-y-1.5 text-muted-foreground" data-testid="organiser-organisation-contacts">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
          {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
        </Label>
        {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
