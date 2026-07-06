import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import type { ClubService, CourtSurface, CompetitionType } from "@shared/constants/clubs";
import { Button } from "@/components/ui/button";
import { ClubListingType } from "./ClubListingType";
import { ClubBasicSection } from "./sections/ClubBasicSection";
import { ClubLocationSection } from "./sections/ClubLocationSection";
import { ClubContactSection } from "./sections/ClubContactSection";
import { ClubServicesSection } from "./sections/ClubServicesSection";
import { ClubPricingSection } from "./sections/ClubPricingSection";
import { ClubCourtsSection } from "./sections/ClubCourtsSection";
import { ClubCompetitionSection } from "./sections/ClubCompetitionSection";
import { ClubSeoSection } from "./sections/ClubSeoSection";
import { ClubImageSection } from "./sections/ClubImageSection";

export interface ClubFormProps {
  mode?: "create" | "edit";
  clubId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export interface ClubFormData {
  // Listing
  listingType: "free" | "premium";

  // Basic
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;

  // Images
  image: string;
  logo: string;
  cover: string;

  // Location
  state: string;
  suburb: string;
  address: string;
  googleMapsUrl: string;

  // Services
  services: ClubService[];

  // Pricing
  price: string;
  hourlyPrice: string;
  pricingNotes: string;

  // Courts
  courtSurfaces: CourtSurface[];
  indoorCourts: string;
  outdoorCourts: string;
  hasLighting: boolean;
  hasMultipleLocations: boolean;
  numberOfLocations: string;

  // Contact
  website: string;
  email: string;
  phone: string;
  facebook: string;
  instagram: string;

  contactPersonName: string;
  contactPersonRole: string;
  contactPersonEmail: string;
  contactPersonPhone: string;
  contactPersonNotes: string;
  displayContactPerson: boolean;

  // Competitions
  hostsCompetitions: boolean;
  hostedCompetitions: CompetitionType[];

  // SEO
  seoTitle: string;
  metaDescription: string;
  metaKeywords: string;
}
export function ClubForm({
    mode = "create",
    clubId,
    onClose,
    onSaved,
  }: ClubFormProps) {
  
    const [step, setStep] = useState<"details" | "media">("details");
    const [loading, setLoading] = useState(false);
    const [savedClubId, setSavedClubId] = useState(
      clubId ?? ""
    );
    const [form, setForm] = useState<ClubFormData>({
      listingType: "free",
  
      // Basic
      name: "",
      slug: "",
      category: "",
      shortDescription: "",
      description: "",
  
      // Images
      image: "",
      logo: "",
      cover: "",
  
      // Location
      state: "",
      suburb: "",
      address: "",
      googleMapsUrl: "",
  
      // Services
      services: [],
  
      // Pricing
      price: "",
      hourlyPrice: "",
      pricingNotes: "",
  
      // Courts
      courtSurfaces: [],
      indoorCourts: "",
      outdoorCourts: "",
      hasLighting: false,
      hasMultipleLocations: false,
      numberOfLocations: "",
  
      // Contact
      website: "",
      email: "",
      phone: "",
      facebook: "",
      instagram: "",
  
      contactPersonName: "",
      contactPersonRole: "",
      contactPersonEmail: "",
      contactPersonPhone: "",
      contactPersonNotes: "",
      displayContactPerson: false,
  
      // Competitions
      hostsCompetitions: false,
      hostedCompetitions: [],
  
      // SEO
      seoTitle: "",
      metaDescription: "",
      metaKeywords: "",
    });

    const updateField = <
      K extends keyof ClubFormData
    >(
      key: K,
      value: ClubFormData[K]
    ) => {
      setForm((prev) => ({
        ...prev,
        [key]: value,
      }));
    };
 
    useEffect(() => {
      if (
        mode !== "edit" ||
        !clubId
      ) {
        return;
      }  
      loadClub();
    }, [clubId]);
  
    const loadClub = async () => {
      try { 
        setLoading(true); 
        const res = await fetch(
          `/api/admin/clubs/${clubId}`,
          {
            credentials: "include",
          }
        ); 
        if (!res.ok) {
          throw new Error(
            "Failed to load club"
          );
        } 
        const club = await res.json();
 
        setForm({
          ...club,
        });
        setSavedClubId(club.id); 
      } catch (err) { 
        console.error(err);
  
      } finally { 
        setLoading(false);
  
      }
    };
    const handleSave = async () => {
        try {
          setLoading(true);
      
          const url =
            mode === "create"
              ? "/api/admin/clubs"
              : `/api/admin/clubs/${savedClubId}`;
      
          const method =
            mode === "create"
              ? "POST"
              : "PUT";
      
          const res = await fetch(url, {
            method,
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(form),
          });
      
          if (!res.ok) {
            throw new Error("Failed to save club");
          }
      
          const club = await res.json();
      
          setSavedClubId(club.id);
      
          setStep("media");
      
        } catch (err) {
      
          console.error(err);
      
        } finally {
      
          setLoading(false);
      
        }
      };
      
      const handleUpdate = async () => {
      
        if (!savedClubId) return;
      
        try {
      
          setLoading(true);
      
          const res = await fetch(
            `/api/admin/clubs/${savedClubId}`,
            {
              method: "PUT",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(form),
            }
          );
      
          if (!res.ok) {
      
            throw new Error(
              "Failed to update club"
            );
      
          }
      
          setStep("media");
      
        } catch (err) {
      
          console.error(err);
      
        } finally {
      
          setLoading(false);
      
        }
      
      };
         
      const handleBack = () => {     
        setStep("details");
      
      };
        
      const handleDone = () => {     
        onSaved?.();     
        onClose();
      
      };

return (
    <div
      className="space-y-10"
      data-testid="club-form"
    >
     <div className="flex items-center justify-between">

        <div>

        <h2 className="text-xl font-bold">
            {step === "details"
            ? "Club Details"
            : "Upload Media"}
        </h2>

        <p className="text-sm text-muted-foreground">
            Step {step === "details" ? "1" : "2"} of 2
        </p>

        </div>

        </div>

        <Separator />
      {/* ===================================================================== */}
      {/* STEP 1 */}
      {/* ===================================================================== */}
  
      {step === "details" && (
        <>
          <ClubListingType
            value={form.listingType}
            onChange={(value) =>
              updateField("listingType", value)
            }
          />
  
          <Separator />
  
          <ClubBasicSection
            form={form}
            updateField={updateField}
          />
  
          <Separator />
  
          <ClubLocationSection
            form={form}
            updateField={updateField}
          />
  
          <Separator />
  
          <ClubContactSection
            form={form}
            updateField={updateField}
          />
  
          <Separator />
  
          <ClubServicesSection
            form={form}
            updateField={updateField}
          />
  
          <Separator />
  
          <ClubPricingSection
            form={form}
            updateField={updateField}
          />
  
          {form.listingType === "premium" && (
            <>
              <Separator />
  
              <ClubCourtsSection
                form={form}
                updateField={updateField}
              />
  
              <Separator />
  
              <ClubCompetitionSection
                form={form}
                updateField={updateField}
              />
  
              <Separator />
  
              <ClubSeoSection
                form={form}
                updateField={updateField}
              />
            </>
          )}
        </>
      )}
  
      {/* ===================================================================== */}
      {/* STEP 2 */}
      {/* ===================================================================== */}
  
      {step === "media" && (
        <ClubImageSection
        clubId={savedClubId}
        form={form}
        updateField={updateField}
    />
      )}
  
      <Separator />
  
      {/* ===================================================================== */}
      {/* FOOTER */}
      {/* ===================================================================== */}
  
      <div className="flex items-center justify-between">
  
        {step === "details" ? (
          <>
            <Button
              variant="outline"
              onClick={onClose}
              data-testid="club-cancel-btn"
            >
              Cancel
            </Button>
  
            <Button
              onClick={
                mode === "create"
                  ? handleSave
                  : handleUpdate
              }
              disabled={loading}
              data-testid="club-save-btn"
            >
              {loading
                ? "Saving..."
                : "Save & Continue"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleBack}
              data-testid="club-back-btn"
            >
              ← Back
            </Button>
  
            <Button
              onClick={handleDone}
              data-testid="club-done-btn"
            >
              Done
            </Button>
          </>
        )}
  
      </div>
  
    </div>
  );
}