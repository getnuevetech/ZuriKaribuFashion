export type PasswordRuleKey = 'min_length' | 'uppercase' | 'lowercase' | 'number' | 'special';

export type PasswordRuleResult = {
  key: PasswordRuleKey;
  label: string;
  met: boolean;
};

export type PasswordSecurityState = {
  score: number;
  maxScore: number;
  isValid: boolean;
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  rules: PasswordRuleResult[];
  missingRules: PasswordRuleResult[];
  message: string;
};

const MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_REGEX = /[^A-Za-z0-9\s]/;

export const evaluatePasswordSecurity = (passwordInput: unknown): PasswordSecurityState => {
  const password = String(passwordInput || '');
  const rules: PasswordRuleResult[] = [
    { key: 'min_length', label: `At least ${MIN_LENGTH} characters`, met: password.length >= MIN_LENGTH },
    { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', met: UPPERCASE_REGEX.test(password) },
    { key: 'lowercase', label: 'At least one lowercase letter (a-z)', met: LOWERCASE_REGEX.test(password) },
    { key: 'number', label: 'At least one number (0-9)', met: NUMBER_REGEX.test(password) },
    { key: 'special', label: 'At least one special character (e.g. !@#$%)', met: SPECIAL_REGEX.test(password) },
  ];
  const score = rules.reduce((sum, rule) => sum + (rule.met ? 1 : 0), 0);
  const maxScore = rules.length;
  const missingRules = rules.filter((rule) => !rule.met);
  const isValid = missingRules.length === 0;

  let level: PasswordSecurityState['level'] = 'very-weak';
  if (score >= 5) level = 'strong';
  else if (score === 4) level = 'good';
  else if (score === 3) level = 'fair';
  else if (score === 2) level = 'weak';

  const message = isValid
    ? 'Password is secure.'
    : `Password is not secure enough. Missing: ${missingRules.map((rule) => rule.label).join('; ')}.`;

  return {
    score,
    maxScore,
    isValid,
    level,
    rules,
    missingRules,
    message,
  };
};
