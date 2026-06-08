export type AccountKind = "operator" | "client" | "member";

export type OperatorOnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type BusinessType =
  | "apparel"
  | "promotional"
  | "manufacturing"
  | "fulfillment"
  | "other";

export const BUSINESS_TYPE_OPTIONS: { id: BusinessType; label: string; description: string }[] = [
  { id: "apparel", label: "Apparel & Textiles", description: "Clothing, uniforms, and textile products" },
  { id: "promotional", label: "Promotional Products", description: "Branded merchandise and swag" },
  { id: "manufacturing", label: "Custom Manufacturing", description: "Made-to-order or custom products" },
  { id: "fulfillment", label: "Fulfillment & Logistics", description: "Warehousing, kitting, and shipping" },
  { id: "other", label: "Other", description: "Another type of business" },
];

export const OPERATOR_ROLE_OPTIONS = [
  "Owner / Founder",
  "Operations",
  "Production",
  "Sales",
  "Project manager",
  "Other",
] as const;

export type TeamInviteDraft = {
  name: string;
  email: string;
  role: string;
};

export type OnboardingStatus = {
  completed: boolean;
  accountKind: AccountKind;
  step: number;
  redirectAfter: string | null;
  profile: {
    displayName: string | null;
    fullName: string | null;
    email: string | null;
    companyName: string | null;
    workspaceName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    operatorRole: string | null;
    businessType: string | null;
  };
};
