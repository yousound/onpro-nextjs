import type { UserProfile } from "@/lib/types/profile";
import { deriveCompanyCode } from "@/lib/types/contact";

const MOCK_OPERATOR_CODE_KEY = "onpro.mock.v1.operatorCompanyCode";

/** Operator prefix for order numbers (MAT in MAT260602). */
export function resolveOperatorCompanyCode(profile?: UserProfile | null): string {
  const fromProfile = profile?.operator_company_code?.trim();
  if (fromProfile) {
    return fromProfile.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }
  if (profile?.company_name?.trim()) {
    return deriveCompanyCode(profile.company_name);
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(MOCK_OPERATOR_CODE_KEY);
    if (stored?.trim()) {
      return stored.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    }
  }
  return "MAT";
}

export function persistOperatorCompanyCodeMock(code: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_OPERATOR_CODE_KEY, code.trim().toUpperCase());
}
