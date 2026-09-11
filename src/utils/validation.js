export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { key: 'lowercase', label: 'At least 1 lowercase letter', test: (value) => /[a-z]/.test(value) },
  { key: 'uppercase', label: 'At least 1 uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { key: 'number', label: 'At least 1 number', test: (value) => /\d/.test(value) },
  { key: 'symbol', label: 'At least 1 special character', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
  { key: 'spaces', label: 'No spaces', test: (value) => !/\s/.test(value) },
];

export function passwordRuleResults(password = '') {
  return PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(String(password)) }));
}

export function passwordErrors(password = '', email = '') {
  const value = String(password);
  const errors = passwordRuleResults(value)
    .filter((rule) => !rule.passed)
    .map((rule) => rule.label);

  const emailName = String(email).trim().toLowerCase().split('@')[0];
  if (emailName && emailName.length >= 4 && value.toLowerCase().includes(emailName)) {
    errors.push('Password must not contain your email name');
  }

  const common = ['password', 'qwerty', '123456', 'letmein', 'admin'];
  if (common.some((word) => value.toLowerCase().includes(word))) {
    errors.push('Avoid common words such as “password”, “qwerty”, or “123456”');
  }

  return errors;
}


export function validateEmail(value) {
  const email = String(value || '').trim();
  if (!email) return 'Email address is required.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function digitsOnly(value, maxLength = 50) {
  return String(value || '').replace(/\D/g, '').slice(0, maxLength);
}

export function cleanNameInput(value, maxLength = 60) {
  return String(value || '')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿÑñ' .-]/g, '')
    .slice(0, maxLength);
}

export function validatePersonName(value, label, { required = true } = {}) {
  const clean = String(value || '').trim();
  if (!clean) return required ? `${label} is required.` : null;
  if (clean.length < 2) return `${label} must be at least 2 characters.`;
  if (clean.length > 60) return `${label} must be 60 characters or fewer.`;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿÑñ][A-Za-zÀ-ÖØ-öø-ÿÑñ' .-]*$/.test(clean)) {
    return `${label} may only contain letters, spaces, apostrophes, periods, and hyphens.`;
  }
  return null;
}

export function validatePhilippineMobile(value) {
  const mobile = String(value || '').trim();
  if (!mobile) return 'Mobile number is required.';
  if (!/^09\d{9}$/.test(mobile)) {
    return 'Mobile number must be 11 digits and start with 09 (example: 09171234567).';
  }
  return null;
}

export function validateAffiliateCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) return 'Preferred athlete code is required.';
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    return 'Athlete code must be 3–20 letters/numbers only, with no spaces or symbols.';
  }
  return null;
}

export function validateAddress(value) {
  const address = String(value || '').trim();
  if (!address) return 'Complete address is required.';
  if (address.length < 12) return 'Please enter a more complete address (house/street, barangay, city/municipality, province).';
  if (address.length > 220) return 'Address must be 220 characters or fewer.';
  if (!/[A-Za-zÀ-ÖØ-öø-ÿÑñ]/.test(address)) return 'Address must contain readable letters.';
  return null;
}

export function validateAccountName(value) {
  return validatePersonName(value, 'Account name', { required: true });
}

export function isEwallet(method) {
  return method === 'GCash' || method === 'Maya';
}

export function validateAccountNumber(value, method) {
  const number = String(value || '').trim();
  if (!number) return `${isEwallet(method) ? method : 'Bank'} account number is required.`;
  if (!/^\d+$/.test(number)) return 'Account number must contain numbers only.';

  if (isEwallet(method)) {
    if (!/^09\d{9}$/.test(number)) {
      return `${method} number must be 11 digits and start with 09.`;
    }
  } else if (number.length < 8 || number.length > 20) {
    return 'Bank account number must be between 8 and 20 digits.';
  }
  return null;
}

export function validateBankName(value, method) {
  const bankName = String(value || '').trim();
  if (isEwallet(method)) return null;
  if (!bankName) return 'Bank name is required for bank payout methods.';
  if (bankName.length < 2) return 'Please enter a valid bank name.';
  if (bankName.length > 80) return 'Bank name must be 80 characters or fewer.';
  return null;
}

export function validateProfileForm(form, { includeAffiliateCode = false } = {}) {
  const errors = [
    validatePersonName(form.firstName, 'First name'),
    validatePersonName(form.middleName, 'Middle name', { required: false }),
    validatePersonName(form.lastName, 'Surname'),
    validatePhilippineMobile(form.mobile),
    validateAddress(form.address),
    includeAffiliateCode ? validateAffiliateCode(form.affiliateCode) : null,
    validateAccountName(form.accountName),
    validateAccountNumber(form.accountNumber, form.payoutMethod),
    validateBankName(form.bankName, form.payoutMethod),
  ].filter(Boolean);

  return errors;
}

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected file could not be opened as an image.'));
    };
    image.src = url;
  });
}

export async function validateImageFile(file, { required = true } = {}) {
  if (!file) return required ? 'Please upload your GCash / bank QR image.' : null;

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'QR upload must be a PNG, JPG/JPEG, or WEBP image.';
  }
  if (file.size <= 0) return 'The selected image is empty.';
  if (file.size > 5 * 1024 * 1024) return 'QR image must be 5 MB or smaller.';

  try {
    const { width, height } = await decodeImage(file);
    if (!width || !height) return 'The selected file is not a valid image.';
    if (width < 100 || height < 100) {
      return 'QR image is too small. Please upload a clearer image at least 100 × 100 pixels.';
    }
  } catch (error) {
    return error?.message || 'The selected file is not a valid image.';
  }

  return null;
}
