"use server";

export async function verifyLedgerPassword(password: string): Promise<boolean> {
  const expected = process.env.LEDGER_PASSWORD ?? "jerryonpro";
  return password === expected;
}
