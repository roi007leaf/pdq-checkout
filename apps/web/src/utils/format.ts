/**
 * Format cents to currency string
 */
export function formatCurrency(
  cents: number,
  currency: string = "USD"
): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}
