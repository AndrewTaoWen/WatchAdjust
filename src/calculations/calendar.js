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

export function getAnnualCalendarNotes(date) {
  const notes = [];
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  if (month === 1 && day === 28 && !isLeapYear(year + 1)) {
    notes.push({
      type: 'warning',
      text: 'Annual calendars cannot auto-handle February. After setting today, you must manually advance the date on March 1.',
    });
  }

  if (month === 1 && day === 29) {
    notes.push({
      type: 'warning',
      text: 'Most annual calendars have no Feb 29 position. Set to Feb 28, then advance to March 1 on the correct day.',
    });
  }

  const nextMonthDays = daysInMonth(year, month + 1);
  if (day === 30 && nextMonthDays === 31) {
    notes.push({
      type: 'info',
      text: 'Annual calendars typically skip from the 30th directly to the 1st on 31-day months. Verify your watch behaves this way.',
    });
  }

  notes.push({
    type: 'info',
    text: 'Annual calendars require manual date correction at the end of February and on months shorter than 31 days.',
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
