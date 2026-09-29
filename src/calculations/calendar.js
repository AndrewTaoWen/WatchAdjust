const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getDayName(date) {
  return DAYS[date.getDay()];
}

export function getMonthName(date) {
  return MONTHS[date.getMonth()];
}

/**
 * An annual calendar knows 30- and 31-day months but treats February as a
 * 30-day month, so it needs exactly one correction a year: on March 1st.
 */
export function getAnnualCalendarNotes(date) {
  const notes = [];
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  if (month === 2 && day === 1) {
    notes.push({
      type: 'warning',
      text: 'Today is the one day a year an annual calendar needs help: it will be showing February 29th or 30th. Advance the date to the 1st with the date corrector.',
    });
  } else if (month === 1) {
    const lastDay = isLeapYear(year) ? 29 : 28;
    notes.push({
      type: 'warning',
      text: `After February ${lastDay} your watch will show February ${lastDay + 1}${lastDay === 28 ? ' and then 30' : ''}, because it can't tell February is short. On March 1st, advance the date to the 1st.`,
    });
  }

  notes.push({
    type: 'info',
    text: 'Annual calendars move from the 30th to the 1st in 30-day months by themselves. The only manual correction is at the end of February.',
  });

  return notes;
}

export function getPerpetualCalendarNotes(date) {
  const notes = [];
  const year = date.getFullYear();

  if (isLeapYear(year)) {
    notes.push({
      type: 'success',
      text: `${year} is a leap year — your perpetual calendar will correctly display Feb 29.`,
    });
  }

  notes.push({
    type: 'info',
    text: 'Perpetual calendars automatically account for varying month lengths and leap years once correctly set.',
  });

  if (year % 100 === 0 && !isLeapYear(year)) {
    notes.push({
      type: 'info',
      text: `${year} is a century non-leap year. Ensure your perpetual calendar mechanism handles the 100/400 year rule.`,
    });
  }

  return notes;
}

export function formatTime12h(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minStr = minutes.toString().padStart(2, '0');
  return `${hours}:${minStr} ${ampm}`;
}

export function formatTime24h(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
