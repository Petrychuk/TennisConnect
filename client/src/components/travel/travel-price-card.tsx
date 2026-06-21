import {
    Calendar,
    Clock3,
    Users,
  } from "lucide-react";
  
  import { TravelBookingButton } from "./travel-booking-button";
  
  interface TravelPriceCardProps {
    price: number;
    currency?: string;
    duration?: string;
    startDate?: string | null;
    spotsLeft?: number | null;
    ctaText?: string;
    ctaUrl?: string;
  }
  
  export function TravelPriceCard({
    price,
    currency = "AUD",
    duration,
    startDate,
    spotsLeft,
    ctaText,
    ctaUrl,
  }: TravelPriceCardProps) {
    const formattedDate = startDate
      ? new Date(startDate).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "TBA";
  
    return (
      <div
        className="
          rounded-3xl
          border
          bg-card
          shadow-sm
          overflow-hidden
        "
      >
        <div
          className="
            p-5
            md:p-6
          "
        >
          {/* PRICE */}
  
          <div className="mb-5">
            <p
              className="
                text-[11px]
                uppercase
                tracking-wider
                text-primary
                font-semibold
                mb-2
              "
            >
              Package Price
            </p>
  
            <div className="flex items-end gap-2">
              <span
                className="
                  text-3xl
                  md:text-4xl
                  font-display
                  font-bold
                  leading-none
                "
              >
                ${price}
              </span>
  
              <span
                className="
                  text-base
                  md:text-lg
                  font-semibold
                  mb-1
                "
              >
                {currency}
              </span>
            </div>
  
            <p
              className="
                text-sm
                text-muted-foreground
                mt-1
              "
            >
              per person
            </p>
          </div>
  
          <div className="border-t mb-5" />
  
          {/* DETAILS */}
  
          <div className="space-y-5 mb-6">
            {duration && (
              <div className="flex gap-3">
                <Clock3
                  className="
                    w-5
                    h-5
                    text-primary
                    shrink-0
                    mt-0.5
                  "
                />
  
                <div>
                  <p
                    className="
                      text-xs
                      text-primary
                      font-medium
                    "
                  >
                    Duration
                  </p>
  
                  <p
                    className="
                      text-sm
                      font-semibold
                    "
                  >
                    {duration}
                  </p>
                </div>
              </div>
            )}
  
            <div className="flex gap-3">
              <Calendar
                className="
                  w-5
                  h-5
                  text-primary
                  shrink-0
                  mt-0.5
                "
              />
  
              <div>
                <p
                  className="
                    text-xs
                    text-primary
                    font-medium
                  "
                >
                  Start Date
                </p>
  
                <p
                  className="
                    text-sm
                    font-semibold
                  "
                >
                  {formattedDate}
                </p>
              </div>
            </div>
  
            {typeof spotsLeft === "number" &&
              spotsLeft > 0 && (
                <div className="flex gap-3">
                  <Users
                    className="
                      w-5
                      h-5
                      text-primary
                      shrink-0
                      mt-0.5
                    "
                  />
  
                  <div>
                    <p
                      className="
                        text-xs
                        text-primary
                        font-medium
                      "
                    >
                      Spots Left
                    </p>
  
                    <p
                      className={`
                        text-sm
                        font-semibold
                        ${
                          spotsLeft <= 5
                            ? "text-red-500"
                            : ""
                        }
                      `}
                    >
                      {spotsLeft} spots
                    </p>
  
                    {spotsLeft <= 5 && (
                      <p
                        className="
                          text-xs
                          text-muted-foreground
                        "
                      >
                        Hurry, limited spots!
                      </p>
                    )}
                  </div>
                </div>
              )}
          </div>
  
          {/* CTA */}
  
          <TravelBookingButton
            text={ctaText}
            url={ctaUrl}
          />
  
          <p
            className="
              text-xs
              text-muted-foreground
              text-center
              mt-4
              leading-relaxed
            "
          >
            You will be redirected to the official booking page.
          </p>
        </div>
      </div>
    );
  }