export interface CountryOption {
  code: string;
  name: string;
}

type CountryRow = {
  code: string;
  name: string;
  cities: string[];
};

const COUNTRY_ROWS: CountryRow[] = [
  { code: 'DZ', name: 'Algeria', cities: ['Algiers', 'Oran', 'Constantine'] },
  { code: 'AO', name: 'Angola', cities: ['Luanda', 'Huambo', 'Lobito'] },
  { code: 'BJ', name: 'Benin', cities: ['Porto-Novo', 'Cotonou'] },
  { code: 'BW', name: 'Botswana', cities: ['Gaborone', 'Francistown'] },
  { code: 'BF', name: 'Burkina Faso', cities: ['Ouagadougou', 'Bobo-Dioulasso'] },
  { code: 'BI', name: 'Burundi', cities: ['Gitega', 'Bujumbura'] },
  { code: 'CM', name: 'Cameroon', cities: ['Yaounde', 'Douala'] },
  { code: 'CV', name: 'Cape Verde', cities: ['Praia', 'Mindelo'] },
  { code: 'CF', name: 'Central African Republic', cities: ['Bangui'] },
  { code: 'TD', name: 'Chad', cities: ["N'Djamena"] },
  { code: 'KM', name: 'Comoros', cities: ['Moroni'] },
  { code: 'CG', name: 'Republic of the Congo', cities: ['Brazzaville', 'Pointe-Noire'] },
  { code: 'CD', name: 'Democratic Republic of the Congo', cities: ['Kinshasa', 'Lubumbashi'] },
  { code: 'CI', name: "Cote d'Ivoire", cities: ['Yamoussoukro', 'Abidjan'] },
  { code: 'DJ', name: 'Djibouti', cities: ['Djibouti'] },
  { code: 'EG', name: 'Egypt', cities: ['Cairo', 'Alexandria', 'Giza'] },
  { code: 'GQ', name: 'Equatorial Guinea', cities: ['Malabo', 'Bata'] },
  { code: 'ER', name: 'Eritrea', cities: ['Asmara'] },
  { code: 'SZ', name: 'Eswatini', cities: ['Mbabane', 'Manzini'] },
  { code: 'ET', name: 'Ethiopia', cities: ['Addis Ababa', 'Dire Dawa'] },
  { code: 'GA', name: 'Gabon', cities: ['Libreville', 'Port-Gentil'] },
  { code: 'GM', name: 'Gambia', cities: ['Banjul', 'Serekunda'] },
  { code: 'GH', name: 'Ghana', cities: ['Accra', 'Kumasi', 'Tamale'] },
  { code: 'GN', name: 'Guinea', cities: ['Conakry'] },
  { code: 'GW', name: 'Guinea-Bissau', cities: ['Bissau'] },
  { code: 'KE', name: 'Kenya', cities: ['Nairobi', 'Mombasa', 'Kisumu'] },
  { code: 'LS', name: 'Lesotho', cities: ['Maseru'] },
  { code: 'LR', name: 'Liberia', cities: ['Monrovia'] },
  { code: 'LY', name: 'Libya', cities: ['Tripoli', 'Benghazi'] },
  { code: 'MG', name: 'Madagascar', cities: ['Antananarivo', 'Toamasina'] },
  { code: 'MW', name: 'Malawi', cities: ['Lilongwe', 'Blantyre'] },
  { code: 'ML', name: 'Mali', cities: ['Bamako'] },
  { code: 'MR', name: 'Mauritania', cities: ['Nouakchott'] },
  { code: 'MU', name: 'Mauritius', cities: ['Port Louis'] },
  { code: 'MA', name: 'Morocco', cities: ['Rabat', 'Casablanca', 'Marrakesh'] },
  { code: 'MZ', name: 'Mozambique', cities: ['Maputo', 'Beira'] },
  { code: 'NA', name: 'Namibia', cities: ['Windhoek', 'Walvis Bay'] },
  { code: 'NE', name: 'Niger', cities: ['Niamey'] },
  { code: 'NG', name: 'Nigeria', cities: ['Abuja', 'Lagos', 'Kano', 'Port Harcourt'] },
  { code: 'RW', name: 'Rwanda', cities: ['Kigali'] },
  { code: 'ST', name: 'Sao Tome and Principe', cities: ['Sao Tome'] },
  { code: 'SN', name: 'Senegal', cities: ['Dakar', 'Thiès'] },
  { code: 'SC', name: 'Seychelles', cities: ['Victoria'] },
  { code: 'SL', name: 'Sierra Leone', cities: ['Freetown'] },
  { code: 'SO', name: 'Somalia', cities: ['Mogadishu'] },
  { code: 'ZA', name: 'South Africa', cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria'] },
  { code: 'SS', name: 'South Sudan', cities: ['Juba'] },
  { code: 'SD', name: 'Sudan', cities: ['Khartoum'] },
  { code: 'TZ', name: 'Tanzania', cities: ['Dodoma', 'Dar es Salaam', 'Arusha'] },
  { code: 'TG', name: 'Togo', cities: ['Lome'] },
  { code: 'TN', name: 'Tunisia', cities: ['Tunis', 'Sfax'] },
  { code: 'UG', name: 'Uganda', cities: ['Kampala', 'Gulu'] },
  { code: 'ZM', name: 'Zambia', cities: ['Lusaka', 'Ndola'] },
  { code: 'ZW', name: 'Zimbabwe', cities: ['Harare', 'Bulawayo'] },

  { code: 'US', name: 'United States', cities: ['New York', 'Los Angeles', 'Chicago'] },
  { code: 'GB', name: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham'] },
  { code: 'CA', name: 'Canada', cities: ['Toronto', 'Vancouver', 'Montreal'] },
  { code: 'AU', name: 'Australia', cities: ['Sydney', 'Melbourne', 'Brisbane'] },
  { code: 'NZ', name: 'New Zealand', cities: ['Auckland', 'Wellington'] },
  { code: 'DE', name: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg'] },
  { code: 'FR', name: 'France', cities: ['Paris', 'Lyon', 'Marseille'] },
  { code: 'ES', name: 'Spain', cities: ['Madrid', 'Barcelona', 'Valencia'] },
  { code: 'IT', name: 'Italy', cities: ['Rome', 'Milan', 'Naples'] },
  { code: 'NL', name: 'Netherlands', cities: ['Amsterdam', 'Rotterdam'] },
  { code: 'CH', name: 'Switzerland', cities: ['Zurich', 'Geneva'] },
  { code: 'SE', name: 'Sweden', cities: ['Stockholm', 'Gothenburg'] },
  { code: 'NO', name: 'Norway', cities: ['Oslo', 'Bergen'] },
  { code: 'DK', name: 'Denmark', cities: ['Copenhagen', 'Aarhus'] },
  { code: 'JP', name: 'Japan', cities: ['Tokyo', 'Osaka', 'Nagoya'] },
  { code: 'CN', name: 'China', cities: ['Beijing', 'Shanghai', 'Guangzhou'] },
  { code: 'IN', name: 'India', cities: ['Mumbai', 'Delhi', 'Bengaluru'] },
  { code: 'SG', name: 'Singapore', cities: ['Singapore'] },
  { code: 'AE', name: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi'] },
  { code: 'SA', name: 'Saudi Arabia', cities: ['Riyadh', 'Jeddah'] },
  { code: 'QA', name: 'Qatar', cities: ['Doha'] },
  { code: 'BR', name: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro'] },
  { code: 'MX', name: 'Mexico', cities: ['Mexico City', 'Guadalajara'] },
];

const ALL_COUNTRIES: CountryOption[] = COUNTRY_ROWS.map((row) => ({ code: row.code, name: row.name })).sort((a, b) =>
  a.name.localeCompare(b.name)
);

const COUNTRY_BY_CODE = new Map(ALL_COUNTRIES.map((country) => [country.code, country]));
const COUNTRY_BY_NAME = new Map(ALL_COUNTRIES.map((country) => [country.name.toLowerCase(), country]));
const COUNTRY_CITIES_BY_CODE = new Map(COUNTRY_ROWS.map((row) => [row.code, row.cities]));
const CITY_CACHE = new Map<string, string[]>();

export function getCountryOptions() {
  return ALL_COUNTRIES;
}

export function resolveCountryCode(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const upper = normalized.toUpperCase();
  if (COUNTRY_BY_CODE.has(upper)) return upper;
  return COUNTRY_BY_NAME.get(normalized.toLowerCase())?.code || '';
}

export function resolveCountryName(value: string | null | undefined) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const upper = normalized.toUpperCase();
  if (COUNTRY_BY_CODE.has(upper)) {
    return COUNTRY_BY_CODE.get(upper)!.name;
  }
  return COUNTRY_BY_NAME.get(normalized.toLowerCase())?.name || normalized;
}

export function getCityOptionsByCountryCode(countryCode: string | null | undefined) {
  const normalizedCode = resolveCountryCode(countryCode);
  if (!normalizedCode) return [];
  const cached = CITY_CACHE.get(normalizedCode);
  if (cached) return cached;
  const cities = (COUNTRY_CITIES_BY_CODE.get(normalizedCode) || []).map((row) => String(row || '').trim()).filter(Boolean);
  const uniqueSorted = Array.from(new Set(cities)).sort((a, b) => a.localeCompare(b));
  CITY_CACHE.set(normalizedCode, uniqueSorted);
  return uniqueSorted;
}
