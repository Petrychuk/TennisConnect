export interface WizardStep {
  number: 1 | 2 | 3 | 4;
  key: "type" | "date" | "details" | "review";
  title: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { number: 1, key: "type", title: "Session Type", description: "Choose the format" },
  { number: 2, key: "date", title: "Date & Time", description: "When it's happening" },
  { number: 3, key: "details", title: "Details & Rules", description: "Setup size and format" },
  { number: 4, key: "review", title: "Review & Publish", description: "Review and publish" },
];
