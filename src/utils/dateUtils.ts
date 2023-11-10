import moment from "moment-timezone";

export const generateFutureDateTime = (additionalMinutes: number) => {
  const currentDate = new Date();
  currentDate.setMinutes(currentDate.getMinutes() + additionalMinutes);
  return currentDate;
};

export const dateWithoutTimestamp = (date: Date) => {
  return date.toISOString().split("T")[0]; // Get the date string without the timestamp
};

export const numberOfWeeksBetweenDates = (
  date1: string,
  date2: string,
  timezone: string
): number => {
  const startDate = moment.tz(date1, "YYYY-MM-DD", timezone); // Specify the start date
  const endDate = moment.tz(date2, "YYYY-MM-DD", timezone); // Specify the end date
  const weekNumber1 = startDate.week();
  const weekNumber2 = endDate.week();
  const yearDifference = startDate.year() - endDate.year();
  const weekDifference =
    weekNumber2 - weekNumber1 + yearDifference * startDate.weeksInYear();

  return weekDifference;
};

export const numberOfDaysBetweenDates = (
  date1: string,
  date2: string,
  timeZone: string
): number => {
  // Specify the dates
  const startDate = moment.tz(date1, timeZone);
  const endDate = moment.tz(date2, timeZone);

  // Calculate the number of days between the dates
  const daysDiff = endDate.diff(startDate, "days");

  return daysDiff;
};

export const getNumberOfDaysInCurrentYear = (
  dates: string[],
  timezone: string
): number => {
  const currentYear = moment().tz(timezone).year();

  // Filter dates within the current year
  const filteredDates = dates.filter((date) => {
    const momentDate = moment.tz(date, timezone);
    return momentDate.year() === currentYear;
  });

  return filteredDates.length;
};

export const getConsecutiveDaysCount = (dates: string[]) => {
  let count = 1;

  dates.sort(); // Sort the dates in ascending order

  for (let i = 0; i < dates.length; i++) {
    if (
      i > 0 &&
      dates[i] ===
        moment(dates[i - 1])
          .add(1, "days")
          .format("YYYY-MM-DD")
    ) {
      // If the current date is consecutive with the previous date, increase the current count
      count++;
    } else {
      // Reset the current count and start counting from the current date
      count = 1;
    }
  }

  return count;
};
