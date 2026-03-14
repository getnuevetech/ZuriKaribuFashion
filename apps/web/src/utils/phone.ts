import { resolveCountryCode } from '../data/locationOptions';

const COUNTRY_DIAL_CODE: Record<string, string> = {
  DZ: '+213',
  AO: '+244',
  BJ: '+229',
  BW: '+267',
  BF: '+226',
  BI: '+257',
  CM: '+237',
  CV: '+238',
  CF: '+236',
  TD: '+235',
  KM: '+269',
  CG: '+242',
  CD: '+243',
  CI: '+225',
  DJ: '+253',
  EG: '+20',
  GQ: '+240',
  ER: '+291',
  SZ: '+268',
  ET: '+251',
  GA: '+241',
  GM: '+220',
  GH: '+233',
  GN: '+224',
  GW: '+245',
  KE: '+254',
  LS: '+266',
  LR: '+231',
  LY: '+218',
  MG: '+261',
  MW: '+265',
  ML: '+223',
  MR: '+222',
  MU: '+230',
  MA: '+212',
  MZ: '+258',
  NA: '+264',
  NE: '+227',
  NG: '+234',
  RW: '+250',
  ST: '+239',
  SN: '+221',
  SC: '+248',
  SL: '+232',
  SO: '+252',
  ZA: '+27',
  SS: '+211',
  SD: '+249',
  TZ: '+255',
  TG: '+228',
  TN: '+216',
  UG: '+256',
  ZM: '+260',
  ZW: '+263',
  US: '+1',
  CA: '+1',
  GB: '+44',
  FR: '+33',
  DE: '+49',
  IT: '+39',
  ES: '+34',
  AE: '+971',
  IN: '+91',
  CN: '+86',
  BR: '+55',
};

const toDigits = (value: string) => String(value || '').replace(/[^\d+]/g, '');

export function resolveDialCode(countryInput: string | null | undefined): string {
  const code = String(countryInput || '').trim().toUpperCase();
  if (!code) return '';
  if (COUNTRY_DIAL_CODE[code]) return COUNTRY_DIAL_CODE[code];
  const resolvedCode = resolveCountryCode(code);
  if (resolvedCode && COUNTRY_DIAL_CODE[resolvedCode]) return COUNTRY_DIAL_CODE[resolvedCode];
  const normalizedCode = resolveCountryCode(String(countryInput || ''));
  return normalizedCode && COUNTRY_DIAL_CODE[normalizedCode] ? COUNTRY_DIAL_CODE[normalizedCode] : '';
}

export function normalizePhoneWithCountryPrefix(phoneInput: string, countryInput: string | null | undefined): string {
  const raw = String(phoneInput || '').trim();
  if (!raw) return '';
  const cleaned = toDigits(raw);
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }
  const dialCode = resolveDialCode(countryInput);
  if (!dialCode) return cleaned.replace(/\D/g, '');
  const digitsOnly = cleaned.replace(/\D/g, '').replace(/^0+/, '');
  const dialDigits = dialCode.replace(/\D/g, '');
  if (!digitsOnly) return dialCode;
  if (digitsOnly.startsWith(dialDigits)) return `+${digitsOnly}`;
  return `${dialCode}${digitsOnly}`;
}

