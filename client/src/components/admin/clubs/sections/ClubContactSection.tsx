import type { ClubFormData } from "../ClubForm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTACT_PERSON_ROLES } from "@shared/constants/clubs";

interface ClubContactSectionProps {
  form: ClubFormData;

  updateField: <
    K extends keyof ClubFormData
  >(
    key: K,
    value: ClubFormData[K]
  ) => void;
}

export function ClubContactSection({
  form,
  updateField,
}: ClubContactSectionProps) {

  const isPremium =
    form.listingType === "premium";

  return (
    <section
      className="space-y-8"
      data-testid="club-contact-section"
    >

      {/* Heading */}

      <div>

        <h2
          className="text-2xl font-display font-semibold"
          data-testid="club-contact-heading"
        >
          Contact Information
        </h2>

        <p
          className="mt-1 text-sm text-muted-foreground"
          data-testid="club-contact-description"
        >
          Public contact details displayed on TennisConnect.
        </p>

      </div>

      {/* Public Contact */}

      <div className="space-y-6">

        <div>

          <h3 className="text-lg font-semibold">
            Public Contact
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            For a Free Listing provide at least a Website or an Email.
          </p>

        </div>

        {/* Website */}

        <div className="space-y-2">

          <Label htmlFor="club-website">
            Website
          </Label>

          <Input
            id="club-website"
            data-testid="club-website"
            placeholder="https://..."
            value={form.website}
            onChange={(e) =>
              updateField(
                "website",
                e.target.value
              )
            }
          />

        </div>

        {/* Email */}

        <div className="space-y-2">

          <Label htmlFor="club-email">
            Public Email
          </Label>

          <Input
            id="club-email"
            type="email"
            data-testid="club-email"
            placeholder="club@example.com"
            value={form.email}
            onChange={(e) =>
              updateField(
                "email",
                e.target.value
              )
            }
          />

        </div>

        {/* Premium Only */}

        {isPremium && (

          <>

            {/* Phone */}

            <div className="space-y-2">

              <Label htmlFor="club-phone">
                Phone Number
              </Label>

              <Input
                id="club-phone"
                data-testid="club-phone"
                placeholder="+61..."
                value={form.phone}
                onChange={(e) =>
                  updateField(
                    "phone",
                    e.target.value
                  )
                }
              />

            </div>

            {/* Facebook */}

            <div className="space-y-2">

              <Label htmlFor="club-facebook">
                Facebook
              </Label>

              <Input
                id="club-facebook"
                data-testid="club-facebook"
                placeholder="https://facebook.com/..."
                value={form.facebook}
                onChange={(e) =>
                  updateField(
                    "facebook",
                    e.target.value
                  )
                }
              />

            </div>

            {/* Instagram */}

            <div className="space-y-2">

              <Label htmlFor="club-instagram">
                Instagram
              </Label>

              <Input
                id="club-instagram"
                data-testid="club-instagram"
                placeholder="https://instagram.com/..."
                value={form.instagram}
                onChange={(e) =>
                  updateField(
                    "instagram",
                    e.target.value
                  )
                }
              />

            </div>

          </>

        )}

      </div>
      {/* Community Contact */}
     
      {isPremium && (

        <div
        className="space-y-6 rounded-2xl border p-6"
        data-testid="community-contact-section"
        >

        <div>

            <h3 className="text-lg font-semibold">
            Community Contact
            </h3>

            <p className="mt-1 text-sm text-muted-foreground">
            Person responsible for managing this club or community.
            </p>

        </div>

        {/* ====================================================== */}
        {/* Name */}
        {/* ====================================================== */}

        <div className="space-y-2">

            <Label htmlFor="contact-person-name">
            Contact Person
            </Label>

            <Input
            id="contact-person-name"
            data-testid="contact-person-name"
            placeholder="John Smith"
            value={form.contactPersonName}
            onChange={(e) =>
                updateField(
                "contactPersonName",
                e.target.value
                )
            }
            />

        </div>

        {/* ====================================================== */}
        {/* Role */}
        {/* ====================================================== */}

        <div className="space-y-2">

            <Label>
            Role
            </Label>

            <Select
            value={form.contactPersonRole}
            onValueChange={(value) =>
                updateField(
                "contactPersonRole",
                value
                )
            }
            >

            <SelectTrigger
                data-testid="contact-person-role"
            >

                <SelectValue
                placeholder="Select role"
                />

            </SelectTrigger>

            <SelectContent>

                {CONTACT_PERSON_ROLES.map((role) => (

                    <SelectItem
                    key={role.value}
                    value={role.value}
                    >
                    {role.label}
                    </SelectItem>

                    ))}

            </SelectContent>

            </Select>

        </div>

        {/* ====================================================== */}
        {/* Contact Details */}
        {/* ====================================================== */}

        <div className="grid gap-6 md:grid-cols-2">

            <div className="space-y-2">

            <Label htmlFor="contact-person-email">
                Email
            </Label>

            <Input
                id="contact-person-email"
                type="email"
                data-testid="contact-person-email"
                placeholder="manager@club.com"
                value={form.contactPersonEmail}
                onChange={(e) =>
                updateField(
                    "contactPersonEmail",
                    e.target.value
                )
                }
            />

            </div>

            <div className="space-y-2">

            <Label htmlFor="contact-person-phone">
                Phone
            </Label>

            <Input
                id="contact-person-phone"
                data-testid="contact-person-phone"
                placeholder="+61..."
                value={form.contactPersonPhone}
                onChange={(e) =>
                updateField(
                    "contactPersonPhone",
                    e.target.value
                )
                }
            />

            </div>

        </div>

        {/* ====================================================== */}
        {/* Notes */}
        {/* ====================================================== */}

        <div className="space-y-2">

            <Label htmlFor="contact-person-notes">
            Notes
            </Label>

            <Textarea
            id="contact-person-notes"
            data-testid="contact-person-notes"
            rows={4}
            placeholder="Additional information..."
            value={form.contactPersonNotes}
            onChange={(e) =>
                updateField(
                "contactPersonNotes",
                e.target.value
                )
            }
            />

        </div>

        {/* ====================================================== */}
        {/* Display Publicly */}
        {/* ====================================================== */}

        <div
            className="flex items-center gap-3 rounded-xl border p-4"
            data-testid="display-contact-person"
        >

            <Checkbox
            id="display-contact-person-checkbox"
            checked={form.displayContactPerson}
            onCheckedChange={(checked) =>
                updateField(
                "displayContactPerson",
                Boolean(checked)
                )
            }
            />

            <Label
            htmlFor="display-contact-person-checkbox"
            className="cursor-pointer"
            >
            Display contact person on the public profile
            </Label>

        </div>

        </div>

        )}

      {/* Validation Hint */}

      {!isPremium && (

        <div
        className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground"
        data-testid="free-contact-info"
        >

        <strong>Free Listing</strong>

        <p className="mt-2">
            Provide at least a Website or an Email.
            Additional contact information becomes available
            with a Premium Listing.
        </p>

        </div>

        )}

    </section>

  );
}