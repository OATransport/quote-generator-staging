import { currency } from "@/lib/utils";

export type MoneyLike = number | string | { toString(): string };

export function hasDepositDue(depositDue: MoneyLike) {
  return Number(depositDue) > 0;
}

export function publicDepositLabel(depositDue: MoneyLike) {
  return hasDepositDue(depositDue) ? "Deposit Due Today" : "No Deposit Due Today";
}

export function publicDepositHelperText(depositDue: MoneyLike) {
  return hasDepositDue(depositDue)
    ? "Deposit is due when accepting. Remaining balance is due on delivery unless otherwise noted."
    : "No deposit is due today. Balance is due on delivery unless otherwise noted.";
}

export function editDepositHelperText(depositDue: MoneyLike) {
  return hasDepositDue(depositDue)
    ? "Amount collected when the customer accepts the quote."
    : "Leave at $0 when no deposit is required. Public quote will show “No Deposit Due Today.”";
}

export function formatPublicDepositValue(depositDue: MoneyLike) {
  return hasDepositDue(depositDue) ? currency(depositDue.toString()) : "None required";
}
