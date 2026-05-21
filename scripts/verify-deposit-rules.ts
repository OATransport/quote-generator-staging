import { applyRecommendedDepositIfUnset, calculateQuotePricing, getRecommendedDeposit, isDepositManuallySet } from "@/lib/quote-pricing";

type Case = { price: number; expected: number };

const thresholdCases: Case[] = [
  { price: 999, expected: 0 },
  { price: 1000, expected: 100 },
  { price: 2499, expected: 100 },
  { price: 2499.99, expected: 100 },
  { price: 2500, expected: 200 },
  { price: 3999, expected: 200 },
  { price: 3999.99, expected: 200 },
  { price: 4000, expected: 300 },
  { price: 4999, expected: 300 },
  { price: 4999.99, expected: 300 },
  { price: 5000, expected: 500 },
];

let failed = 0;

for (const { price, expected } of thresholdCases) {
  const actual = getRecommendedDeposit(price);
  if (actual !== expected) {
    console.error(`FAIL getRecommendedDeposit(${price}) = ${actual}, expected ${expected}`);
    failed++;
  }
}

const balanceChecks = [
  { price: 850, deposit: 0, balance: 850 },
  { price: 1200, deposit: 100, balance: 1100 },
  { price: 2500, deposit: 200, balance: 2300 },
  { price: 4000, deposit: 300, balance: 3700 },
  { price: 5000, deposit: 500, balance: 4500 },
];

for (const { price, deposit, balance } of balanceChecks) {
  const pricing = calculateQuotePricing({ customerPrice: price, depositDue: deposit, carrierPay: 0 });
  if (pricing.balanceDue !== balance) {
    console.error(`FAIL balance ${price}-${deposit}: got ${pricing.balanceDue}, expected ${balance}`);
    failed++;
  }
}

if (applyRecommendedDepositIfUnset(1200, 0) !== 100) {
  console.error("FAIL applyRecommendedDepositIfUnset should fill 100 for unset deposit");
  failed++;
}

if (applyRecommendedDepositIfUnset(1200, 75) !== 75) {
  console.error("FAIL applyRecommendedDepositIfUnset should preserve manual nonzero deposit");
  failed++;
}

if (!isDepositManuallySet(75, 1200)) {
  console.error("FAIL isDepositManuallySet should detect manual override");
  failed++;
}

if (isDepositManuallySet(0, 1200)) {
  console.error("FAIL isDepositManuallySet should treat zero as unset when recommended > 0");
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} deposit rule check(s) failed`);
  process.exit(1);
}

console.log(JSON.stringify({ passed: thresholdCases.length + balanceChecks.length + 4, failed: 0 }, null, 2));
