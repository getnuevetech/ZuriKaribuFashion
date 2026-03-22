type PasswordRequirementKey =
  | 'min_length'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'special';

export type PasswordRequirementResult = {
  key: PasswordRequirementKey;
  label: string;
  met: boolean;
};

export type PasswordSecurityResult = {
  isValid: boolean;
  score: number;
  requirements: PasswordRequirementResult[];
  missing: PasswordRequirementResult[];
};

const PASSWORD_MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_REGEX = /[^A-Za-z0-9\s]/;

export const evaluatePasswordSecurity = (passwordInput: unknown): PasswordSecurityResult => {
  const password = String(passwordInput || '');
  const requirements: PasswordRequirementResult[] = [
    { key: 'min_length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', met: UPPERCASE_REGEX.test(password) },
    { key: 'lowercase', label: 'At least one lowercase letter (a-z)', met: LOWERCASE_REGEX.test(password) },
    { key: 'number', label: 'At least one number (0-9)', met: NUMBER_REGEX.test(password) },
    { key: 'special', label: 'At least one special character (e.g. !@#$%)', met: SPECIAL_REGEX.test(password) },
  ];
  const metCount = requirements.reduce((sum, requirement) => sum + (requirement.met ? 1 : 0), 0);
  const missing = requirements.filter((requirement) => !requirement.met);
  return {
    isValid: missing.length === 0,
    score: metCount,
    requirements,
    missing,
  };
};

export const buildPasswordPolicyErrorMessage = (result: PasswordSecurityResult) => {
  if (result.isValid) return '';
  const detail = result.missing.map((item) => item.label).join('; ');
  return `Password is not secure enough. Missing requirements: ${detail}.`;
};
