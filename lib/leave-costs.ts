// Source: files_General_cleaning-simulator.xlsx, נתוני עזר D4:F54,
// H3:I53, M4/L4 and L6. Tenure is completed years, including half years.
// Recovery day value: uploaded H.8.2.1 edition 40, section 2.1 (2026).
export const RECOVERY_DAY_VALUE = 512.12;
export const FULL_MONTH_HOURS = 182;
export const vacDays = (years:number, week:1|2|3|4|5|6) => {
  const band = years<4?0:years<5?1:years<6?2:years<8?3:4;
  return (week<=5?[12,13,18,19,23]:[14,15,20,21,26])[band];
};
export const recDays = (years:number) => years<3?7:years<10?9:years<15?10:years<19?11:years<24?12:13;
export function leaveCosts(years:number, week:1|2|3|4|5|6, wageWithTenure:number, monthlyHours:number, basis:"workbook"|"actual"="workbook") {
  const hours = Math.max(0,monthlyHours);
  const dayHours = week<=5?8.4:7;
  const vacationDays = vacDays(years,week), recoveryDays = recDays(years);
  const annualHours = 12*FULL_MONTH_HOURS;
  // Match the workbook: no subtraction of vacation hours in vacation's divisor.
  const vacationDivisor=basis==="actual"?annualHours-vacationDays*dayHours:annualHours;
  const vacationRate = wageWithTenure*vacationDays*dayHours/vacationDivisor;
  // L6 includes holiday/vacation coverage regardless of the commercial B/B flag.
  const recoveryDivisor = basis==="actual"?annualHours-vacationDays*dayHours:annualHours-dayHours*(9+vacationDays);
  const recoveryRate = RECOVERY_DAY_VALUE*recoveryDays/recoveryDivisor;
  const vacationMonthly = vacationRate*hours, recoveryMonthly = recoveryRate*hours;
  return {vacationDays,recoveryDays,dayHours,vacationDivisor,recoveryDivisor,vacationMonthly,recoveryMonthly,
    vacation:hours>0?vacationMonthly/hours:0,recovery:hours>0?recoveryMonthly/hours:0};
}
