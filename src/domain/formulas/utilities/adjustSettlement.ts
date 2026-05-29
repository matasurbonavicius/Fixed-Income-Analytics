import { addBusinessDays } from "@domain/formulas";
import { CalendarCode } from "@calendars";
import { ResultHelper, Result } from "@domain/shared";
import { UTCDate } from "@domain/valueObjects";

/**
 * Adjust settlement date for pre-IPO bonds and confirm its a good date.
 * If issue date is in the future (pre-IPO), settlement cannot occur before issue.
 * Returns issue date if it's after the proposed settlement date, otherwise returns settlement date.
 */
/**
 * @category Calendars & Day-Count
 */
export function adjustSettlement(
  proposedSettlementDate: UTCDate,
  issueDate: UTCDate | undefined | null,
  maturityDate: UTCDate,
  settlementDays: number = 0,
  calendar: CalendarCode = "WEEKEND_ONLY"
): Result<UTCDate> {

  // Settlement impossible if bond already matured
  if (proposedSettlementDate.isSameOrAfter(maturityDate)) {
    return ResultHelper.failure("Bond has already matured");
  }

  // If we don't have an issue date, just return the proposed settlement date
  if (!issueDate) {
    return ResultHelper.success(proposedSettlementDate);
  }

  // What's the absolute earliest settlement date? (issue date + settlement days)
  const earliestSettlementResult = addBusinessDays(issueDate, settlementDays, calendar);
  if (!earliestSettlementResult.success) {
    return earliestSettlementResult;
  }
  const earliestSettlement = earliestSettlementResult.value;

  // If earliest settlement is after proposed, return earliest (pre IPO)
  if (earliestSettlement.isAfter(proposedSettlementDate)) {
    return ResultHelper.success(earliestSettlement);
  }

  // Otherwise proposed settlement date is valid
  return ResultHelper.success(proposedSettlementDate);
}