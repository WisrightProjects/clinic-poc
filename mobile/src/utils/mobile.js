// Purpose: a patient's mobile number in the app — the same rules as the server's
// backend/src/utils/mobile.js (10 digits, starting 6–9).

// The digits of a mobile number as typed or pasted: "+91 98765 43210" and "09876543210"
// keep their 10 digits.
export const mobileDigits = (text) => {
  let d = text.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};

export const isValidMobile = (digits) => /^[6-9]\d{9}$/.test(digits);
