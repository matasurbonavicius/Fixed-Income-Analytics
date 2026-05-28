import { adjustForBusinessDay } from "./businessDayAdjustment";
import { BusinessDayConvention } from "@domain/entities";
import { CalendarCode } from "@calendars";
import { UTCDate } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

export interface CouponPayment {
  paymentDate: UTCDate;
  periodStartDate: UTCDate;
  periodEndDate: UTCDate;
  isRegular: boolean;
}

export interface GenerateCouponScheduleInput {
  issueDate: UTCDate;
  maturityDate: UTCDate;
  firstCouponDate?: UTCDate;
  frequency: number;
  businessDayConvention: BusinessDayConvention;
  calendar: CalendarCode;
}

export function generateCouponSchedule(
  input: GenerateCouponScheduleInput
): Result<CouponPayment[]> {
  const {
    issueDate,
    maturityDate,
    firstCouponDate,
    frequency,
    businessDayConvention,
    calendar,
  } = input;

  if (frequency === 0) {
    return ResultHelper.success([]);
  }

  const monthsPerPeriod = 12 / frequency;
  const schedule: CouponPayment[] = [];

  let currentDate = maturityDate.clone();
  let previousDate = maturityDate.clone();

  while (currentDate.isAfter(issueDate)) {
    previousDate = currentDate.clone();

    const newCurrentResult = currentDate.addMonths(-monthsPerPeriod);
    if (!newCurrentResult.success) {
      return ResultHelper.failure(`Failed to subtract months: ${newCurrentResult.error}`);
    }
    currentDate = newCurrentResult.value;

    if (currentDate.isSameOrBefore(issueDate)) {
      // First period handling
      const firstPeriodStart = issueDate.clone();
      const firstPeriodEnd = previousDate.clone();
      const firstPayment = firstCouponDate ? firstCouponDate.clone() : previousDate.clone();

      const adjustedFirstPaymentResult = adjustForBusinessDay(
        firstPayment,
        businessDayConvention,
        calendar
      );
      if (!adjustedFirstPaymentResult.success) {
        return ResultHelper.failure(`Failed to adjust first payment: ${adjustedFirstPaymentResult.error}`);
      }

      const isRegular = !firstCouponDate && currentDate.equals(issueDate);

      schedule.unshift({
        paymentDate: adjustedFirstPaymentResult.value,
        periodStartDate: firstPeriodStart,
        periodEndDate: firstPeriodEnd,
        isRegular,
      });

      break;
    }

    // Regular period
    const adjustedPaymentDateResult = adjustForBusinessDay(
      previousDate,
      businessDayConvention,
      calendar
    );
    if (!adjustedPaymentDateResult.success) {
      return ResultHelper.failure(`Failed to adjust payment date: ${adjustedPaymentDateResult.error}`);
    }

    schedule.unshift({
      paymentDate: adjustedPaymentDateResult.value,
      periodStartDate: currentDate.clone(),
      periodEndDate: previousDate.clone(),
      isRegular: true,
    });
  }

  return ResultHelper.success(schedule);
}

export function getFutureCoupons(
  schedule: CouponPayment[],
  settlementDate: UTCDate
): CouponPayment[] {
  return schedule.filter((coupon) => coupon.paymentDate.isAfter(settlementDate));
}

export function getLastCouponDate(
  schedule: CouponPayment[],
  settlementDate: UTCDate
): UTCDate | null {
  const pastCoupons = schedule.filter((coupon) =>
    coupon.paymentDate.isSameOrBefore(settlementDate)
  );
  return pastCoupons.length === 0
    ? null
    : pastCoupons[pastCoupons.length - 1].paymentDate;
}

export function getNextCouponDate(
  schedule: CouponPayment[],
  settlementDate: UTCDate
): UTCDate | null {
  const futureCoupons = schedule.filter((coupon) =>
    coupon.paymentDate.isAfter(settlementDate)
  );
  return futureCoupons.length === 0 ? null : futureCoupons[0].paymentDate;
}

export function getCurrentCouponPeriod(
  schedule: CouponPayment[],
  settlementDate: UTCDate
): CouponPayment | null {
  for (const coupon of schedule) {
    if (
      settlementDate.isSameOrAfter(coupon.periodStartDate) &&
      settlementDate.isBefore(coupon.periodEndDate)
    ) {
      return coupon;
    }
  }
  return null;
}
