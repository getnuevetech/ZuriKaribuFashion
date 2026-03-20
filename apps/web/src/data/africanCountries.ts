export type AfricanRegion = 'North' | 'West' | 'Central' | 'East' | 'Southern';

export interface AfricanCountry {
  code: string;
  name: string;
  region: AfricanRegion;
  textiles: string[];
}

export const AFRICAN_REGION_OPTIONS: Array<'ALL' | AfricanRegion> = [
  'ALL',
  'North',
  'West',
  'Central',
  'East',
  'Southern',
];

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  // North (6)
  { code: 'DZ', name: 'Algeria', region: 'North', textiles: ['Cactus silk', 'Wool weaving'] },
  { code: 'EG', name: 'Egypt', region: 'North', textiles: ['Egyptian cotton', 'Pharaonic patterns'] },
  { code: 'LY', name: 'Libya', region: 'North', textiles: ['Wool weaving', 'Embroidery'] },
  { code: 'MA', name: 'Morocco', region: 'North', textiles: ['Moroccan silk', 'Berber rugs'] },
  { code: 'SD', name: 'Sudan', region: 'North', textiles: ['Sudanese silk', 'Cotton weaving'] },
  { code: 'TN', name: 'Tunisia', region: 'North', textiles: ['Tunisian silk', 'Wool weaving'] },

  // West (16)
  { code: 'BJ', name: 'Benin', region: 'West', textiles: ['Wax prints', 'Batik'] },
  { code: 'BF', name: 'Burkina Faso', region: 'West', textiles: ['Faso Dan Fani', 'Cotton weaving'] },
  { code: 'CV', name: 'Cabo Verde', region: 'West', textiles: ['Panu di Terra', 'Cotton'] },
  { code: 'CI', name: "Cote d'Ivoire", region: 'West', textiles: ['Wax prints', 'Kente cloth'] },
  { code: 'GM', name: 'Gambia', region: 'West', textiles: ['Tie-dye', 'Batik'] },
  { code: 'GH', name: 'Ghana', region: 'West', textiles: ['Kente', 'Adinkra', 'Batik'] },
  { code: 'GN', name: 'Guinea', region: 'West', textiles: ['Fouta', 'Cotton weaving'] },
  { code: 'GW', name: 'Guinea-Bissau', region: 'West', textiles: ['Cotton', 'Wax prints'] },
  { code: 'LR', name: 'Liberia', region: 'West', textiles: ['Country cloth', 'Lappa'] },
  { code: 'ML', name: 'Mali', region: 'West', textiles: ['Bogolan', 'Mud cloth'] },
  { code: 'MR', name: 'Mauritania', region: 'West', textiles: ['Cotton', 'Wool'] },
  { code: 'NE', name: 'Niger', region: 'West', textiles: ['Cotton weaving', 'Leather'] },
  { code: 'NG', name: 'Nigeria', region: 'West', textiles: ['Ankara', 'Adire', 'Aso-Oke'] },
  { code: 'SN', name: 'Senegal', region: 'West', textiles: ['Wax prints', 'Bogolan'] },
  { code: 'SL', name: 'Sierra Leone', region: 'West', textiles: ['Gara cloth', 'Country cloth'] },
  { code: 'TG', name: 'Togo', region: 'West', textiles: ['Kente', 'Wax prints'] },

  // Central (9)
  { code: 'AO', name: 'Angola', region: 'Central', textiles: ['Capulana', 'Pano'] },
  { code: 'CM', name: 'Cameroon', region: 'Central', textiles: ['Toghu velvet', 'Batik'] },
  { code: 'CF', name: 'Central African Republic', region: 'Central', textiles: ['Cotton', 'Wax prints'] },
  { code: 'TD', name: 'Chad', region: 'Central', textiles: ['Cotton', 'Wool'] },
  { code: 'CG', name: 'Congo', region: 'Central', textiles: ['Raffia', 'Wax prints'] },
  { code: 'CD', name: 'DR Congo', region: 'Central', textiles: ['Kitenge', 'Kuba cloth'] },
  { code: 'GQ', name: 'Equatorial Guinea', region: 'Central', textiles: ['Cotton', 'Wax prints'] },
  { code: 'GA', name: 'Gabon', region: 'Central', textiles: ['Raffia cloth', 'Wax prints'] },
  { code: 'ST', name: 'Sao Tome and Principe', region: 'Central', textiles: ['Cotton', 'Batik'] },

  // East (18)
  { code: 'BI', name: 'Burundi', region: 'East', textiles: ['Kitenge', 'Imishanana'] },
  { code: 'KM', name: 'Comoros', region: 'East', textiles: ['Silk', 'Cotton'] },
  { code: 'DJ', name: 'Djibouti', region: 'East', textiles: ['Cotton', 'Silk'] },
  { code: 'ER', name: 'Eritrea', region: 'East', textiles: ['Tilfi', 'Cotton weaving'] },
  { code: 'ET', name: 'Ethiopia', region: 'East', textiles: ['Tibeb', 'Netela'] },
  { code: 'KE', name: 'Kenya', region: 'East', textiles: ['Kitenge', 'Kanga', 'Shuka'] },
  { code: 'MG', name: 'Madagascar', region: 'East', textiles: ['Raffia', 'Lamba'] },
  { code: 'MW', name: 'Malawi', region: 'East', textiles: ['Chitenje', 'Cotton'] },
  { code: 'MU', name: 'Mauritius', region: 'East', textiles: ['Cotton', 'Silk'] },
  { code: 'MZ', name: 'Mozambique', region: 'East', textiles: ['Capulana', 'Pano'] },
  { code: 'RW', name: 'Rwanda', region: 'East', textiles: ['Imishanana', 'Kitenge'] },
  { code: 'SC', name: 'Seychelles', region: 'East', textiles: ['Cotton', 'Batik'] },
  { code: 'SO', name: 'Somalia', region: 'East', textiles: ['Alindi', 'Cotton'] },
  { code: 'SS', name: 'South Sudan', region: 'East', textiles: ['Cotton', 'Beadwork'] },
  { code: 'TZ', name: 'Tanzania', region: 'East', textiles: ['Kitenge', 'Kanga'] },
  { code: 'UG', name: 'Uganda', region: 'East', textiles: ['Bark cloth', 'Gomesi'] },
  { code: 'ZM', name: 'Zambia', region: 'East', textiles: ['Chitenge', 'Cotton'] },
  { code: 'ZW', name: 'Zimbabwe', region: 'East', textiles: ['Chitenge', 'Ndebele beadwork'] },

  // Southern (5)
  { code: 'BW', name: 'Botswana', region: 'Southern', textiles: ['Shweshwe', 'Leteisi'] },
  { code: 'SZ', name: 'Eswatini', region: 'Southern', textiles: ['Emahiya', 'Sishweshwe'] },
  { code: 'LS', name: 'Lesotho', region: 'Southern', textiles: ['Seshoeshoe', 'Basotho blanket'] },
  { code: 'NA', name: 'Namibia', region: 'Southern', textiles: ['Oshiwambo', 'Herero'] },
  { code: 'ZA', name: 'South Africa', region: 'Southern', textiles: ['Shweshwe', 'Ndebele beadwork'] },
];

