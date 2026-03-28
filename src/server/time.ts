const DEFAULT_BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE?.trim() || 'Asia/Jakarta';

function formatDateByTimezone(timestamp: number, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(timestamp));
}

export function toBusinessDate(timestamp: number, timezone: string = DEFAULT_BUSINESS_TIMEZONE) {
  return formatDateByTimezone(timestamp, timezone);
}

export function currentBusinessDate(timezone: string = DEFAULT_BUSINESS_TIMEZONE) {
  return formatDateByTimezone(Date.now(), timezone);
}
