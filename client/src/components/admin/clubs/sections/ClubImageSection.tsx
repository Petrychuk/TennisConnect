import type { ClubFormData } from "../ClubForm";
import { ImageUploader } from "@/components/admin/common/ImageUploader";
import { GalleryUploader } from "@/components/admin/common/GalleryUploader";
interface ClubImageSectionProps {
  clubId: string;
  form: ClubFormData;

  updateField: <
    K extends keyof ClubFormData
  >(
    key: K,
    value: ClubFormData[K]
  ) => void;

  saveMedia: (
    data: Partial<{
      image: string;
      logo: string;
      cover: string;
      gallery: string[];
    }>
  ) => Promise<void>;
}

export function ClubImageSection({
  clubId,
  form,
  updateField,
  saveMedia,
}: ClubImageSectionProps) {

  const isPremium =
    form.listingType === "premium";

  return (
    <section
      className="space-y-8"
      data-testid="club-image-section"
    >

      {/* Heading */}
      <div>
        <h2 className="text-2xl font-display font-semibold">
          Club Images
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload professional images that represent
          your club or community.
        </p>
      </div>

      {/* Directory Image */}
      <ImageUploader

        folder="clubs"
        entityId={clubId}
        type="image"
        value={form.image}
        label="Club Image"
        description="Displayed on directory cards and search results."
        onUploaded={async (url) => {
          updateField(
            "image",
            url
          );       
          await saveMedia({
            image: url,
          });
        
        }}
        onDeleted={() =>
          updateField(
            "image",
            ""
          )
        }
      />
      
      {/* Premium Images */}
      {isPremium && (
      <div
        className="space-y-6"
        data-testid="club-premium-images"
      >
        <div>
          <h3 className="text-lg font-semibold">
            Premium Images
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your logo and cover image to create
            a professional club profile.
          </p>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Logo */}

          <ImageUploader
            folder="clubs"
            entityId={clubId}
            type="logo"
            value={form.logo}
            label="Club Logo"
            description="Displayed on the Premium club profile."
            onUploaded={async (url) => {
              updateField(
                "logo",
                url
              );        
              await saveMedia({
                logo: url,
              });
            
            }}
            onDeleted={() =>
              updateField(
                "logo",
                ""
              )
            }
          />

          {/* Cover */}
          <ImageUploader
            folder="clubs"
            entityId={clubId}
            type="cover"
            value={form.cover}
            label="Cover Image"
            description="Large hero image displayed at the top of your Premium club page."
            onUploaded={async (url) => {
              updateField(
                "cover",
                url
              );         
                await saveMedia({
                  cover: url,
                });          
            }}
            onDeleted={() =>
              updateField(
                "cover",
                ""
              )
            }
          />
        </div>
      </div>
      )}
      
      {/* Premium Features (Free Listing) */}

      {!isPremium && (
        <div
          className="
            rounded-2xl
            border
            border-dashed
            bg-muted/30
            p-6
          "
          data-testid="premium-images-card"
        >
          <h3 className="text-lg font-semibold">
            ⭐ Premium Image Features
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrade your listing to unlock a complete
            visual presentation for your club.
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li>✓ Club Logo</li>
            <li>✓ Cover Image</li>
            <li>✓ Photo Gallery</li>
            <li>✓ Premium Club Profile</li>
            <li>✓ Better Presentation</li>
          </ul>
        </div>
      )}

      {/* Gallery */}

      {isPremium && (

        <div
          className="
            rounded-2xl
            border
            bg-muted/20
            p-8
          "
          data-testid="club-gallery-section"
        >
          <h3 className="text-lg font-semibold">
            Club Gallery
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload up to 10 photos showcasing your
            facilities, courts and community. If you don't
            add any, the Gallery section is simply hidden
            on the club's premium page.
          </p>

          <div className="mt-6">
            <GalleryUploader
              folder="clubs"
              entityId={clubId}
              value={form.gallery || []}
              max={10}
              label="Gallery Photos"
              onChange={async (urls) => {
                updateField("gallery", urls);
                await saveMedia({ gallery: urls });
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}