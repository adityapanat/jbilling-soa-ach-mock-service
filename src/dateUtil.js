function formatSnapPayDate(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  const paddedHours = String(hours).padStart(2, '0');

  return `${month}/${day}/${year} ${paddedHours}:${minutes}:${seconds} ${ampm}`;
}

function parseTransactionDate(input) {
  if (input === undefined || input === null || input === '') {
    return formatSnapPayDate(new Date());
  }

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return formatSnapPayDate(input);
  }

  const value = String(input).trim();
  const snapPayMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/i
  );

  if (snapPayMatch) {
    const [, month, day, year, hour, minute, second, ampm] = snapPayMatch;
    const paddedHour = String(hour).padStart(2, '0');
    return `${month}/${day}/${year} ${paddedHour}:${minute}:${second} ${ampm.toUpperCase()}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatSnapPayDate(parsed);
  }

  throw new Error(
    'date must be in format M/d/yyyy hh:mm:ss a (e.g. 7/30/2026 01:26:35 AM) or a parseable ISO date'
  );
}

module.exports = {
  formatSnapPayDate,
  parseTransactionDate
};
