/**
 * Verifies invite login URLs and segment → onboarding path mapping.
 *
 * Run: npx tsx scripts/test-invite-links.ts
 */
import { buildInviteLoginUrl } from "../src/lib/supabase/pending-invites";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function run(): void {
  const origin = "https://app.onpro.test";

  const clientUrl = buildInviteLoginUrl(origin, "tok-client", "client");
  assert(clientUrl.includes("kind=client"), "client invite uses kind=client");
  assert(clientUrl.includes("token=tok-client"), "client invite includes token");
  assert(clientUrl.includes("next=%2F"), "client default next is OnPro AI (/)");

  const teamUrl = buildInviteLoginUrl(origin, "tok-team", "team");
  assert(teamUrl.includes("kind=member"), "team invite uses kind=member");
  assert(teamUrl.includes("next=%2F"), "team default next is OnPro AI (/)");

  const vendorUrl = buildInviteLoginUrl(origin, "tok-vendor", "vendor", "/projects/42");
  assert(vendorUrl.includes("kind=member"), "vendor invite uses kind=member");
  assert(vendorUrl.includes("next=%2Fprojects%2F42"), "vendor respects redirect_after");

  const clientCustom = buildInviteLoginUrl(origin, "tok-c2", "client", "/messages?thread=1");
  assert(clientCustom.includes("next="), "client custom redirect encoded");

  console.log("test-invite-links: PASS");
  console.log("");
  console.log("Manual Live checklist (run 008 + 013 in Supabase SQL first):");
  console.log("1. Operator onboarding step 3 → copy team invite links on step 4");
  console.log("2. People → Add teammate/vendor/client with invite → copy link toast");
  console.log("3. Client link → signup → client onboarding → Join → OnPro AI (/)");
  console.log("4. Team/vendor link → signup → member onboarding → Join → OnPro AI (/)");
}

run();
