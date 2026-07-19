export type Bucket = "registered" | "waiting" | "invited" | "cancelled" | "no-response";

export const BUCKET_LABEL: Record<Bucket, string> = {
  registered: "Registered",
  waiting: "Waiting List",
  invited: "Invited",
  cancelled: "Cancelled",
  "no-response": "No Response",
};
