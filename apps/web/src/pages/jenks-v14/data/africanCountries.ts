// All 54 African countries with flags and traditional textile styles
export interface AfricanCountry {
  id: string;
  name: string;
  flag: string;
  code: string;
  region: 'North' | 'West' | 'Central' | 'East' | 'Southern';
  traditionalStyles: string[];
  famousTextiles: string[];
}

export const africanCountries: AfricanCountry[] = [
  // North Africa
  { id: 'algeria', name: 'Algeria', flag: '🇩🇿', code: 'DZ', region: 'North', traditionalStyles: ['Kaftan', 'Burnous', 'Djellaba'], famousTextiles: ['Cactus Silk', 'Wool Weaving'] },
  { id: 'egypt', name: 'Egypt', flag: '🇪🇬', code: 'EG', region: 'North', traditionalStyles: ['Galabeya', 'Takchita', 'Hijab Fashion'], famousTextiles: ['Egyptian Cotton', 'Pharaonic Patterns'] },
  { id: 'libya', name: 'Libya', flag: '🇱🇾', code: 'LY', region: 'North', traditionalStyles: ['Jard', 'Huluw', 'Berber Dresses'], famousTextiles: ['Wool Weaving', 'Embroidery'] },
  { id: 'morocco', name: 'Morocco', flag: '🇲🇦', code: 'MA', region: 'North', traditionalStyles: ['Caftan', 'Takchita', 'Djellaba', 'Burnous'], famousTextiles: ['Moroccan Silk', 'Berber Rugs', 'Cactus Silk'] },
  { id: 'sudan', name: 'Sudan', flag: '🇸🇩', code: 'SD', region: 'North', traditionalStyles: ['Tobe', 'Thawb', 'Jalabiya'], famousTextiles: ['Sudese Silk', 'Cotton Weaving'] },
  { id: 'tunisia', name: 'Tunisia', flag: '🇹🇳', code: 'TN', region: 'North', traditionalStyles: ['Jebba', 'Safsari', 'Balgha'], famousTextiles: ['Tunisian Silk', 'Wool Weaving'] },
  
  // West Africa
  { id: 'benin', name: 'Benin', flag: '🇧🇯', code: 'BJ', region: 'West', traditionalStyles: ['Boubou', 'Pagne', 'Agbada'], famousTextiles: ['Wax Prints', 'Batik'] },
  { id: 'burkina-faso', name: 'Burkina Faso', flag: '🇧🇫', code: 'BF', region: 'West', traditionalStyles: ['Faso Dan Fani', 'Boubou', 'Pagne'], famousTextiles: ['Faso Dan Fani', 'Cotton Weaving'] },
  { id: 'cape-verde', name: 'Cape Verde', flag: '🇨🇻', code: 'CV', region: 'West', traditionalStyles: ['Panu', 'Batik Dresses'], famousTextiles: ['Panu di Terra', 'Cotton'] },
  { id: 'cote-divoire', name: "Côte d'Ivoire", flag: '🇨🇮', code: 'CI', region: 'West', traditionalStyles: ['Pagne', 'Boubou', 'Kente'], famousTextiles: ['Wax Prints', 'Kente Cloth'] },
  { id: 'gambia', name: 'Gambia', flag: '🇬🇲', code: 'GM', region: 'West', traditionalStyles: ['Bubu', 'Kaftan', 'Grand Boubou'], famousTextiles: ['Tie-Dye', 'Batik'] },
  { id: 'ghana', name: 'Ghana', flag: '🇬🇭', code: 'GH', region: 'West', traditionalStyles: ['Kente', 'Smocks', 'Batakari', 'Kaba'], famousTextiles: ['Kente Cloth', 'Adinkra', 'Batik'] },
  { id: 'guinea', name: 'Guinea', flag: '🇬🇳', code: 'GN', region: 'West', traditionalStyles: ['Grand Boubou', 'Pagne', 'Moussor'], famousTextiles: ['Fouta', 'Cotton Weaving'] },
  { id: 'guinea-bissau', name: 'Guinea-Bissau', flag: '🇬🇼', code: 'GW', region: 'West', traditionalStyles: ['Boubou', 'Pagne'], famousTextiles: ['Cotton', 'Wax Prints'] },
  { id: 'liberia', name: 'Liberia', flag: '🇱🇷', code: 'LR', region: 'West', traditionalStyles: ['Lappa', 'Country Cloth'], famousTextiles: ['Country Cloth', 'Lappa'] },
  { id: 'mali', name: 'Mali', flag: '🇲🇱', code: 'ML', region: 'West', traditionalStyles: ['Bogolan', 'Grand Boubou', 'Pagne'], famousTextiles: ['Bogolanfini', 'Mud Cloth', 'Wax Prints'] },
  { id: 'mauritania', name: 'Mauritania', flag: '🇲🇷', code: 'MR', region: 'West', traditionalStyles: ['Melahfa', 'Daraa', 'Boubou'], famousTextiles: ['Cotton', 'Wool'] },
  { id: 'niger', name: 'Niger', flag: '🇳🇪', code: 'NE', region: 'West', traditionalStyles: ['Boubou', 'Pagne', 'Tagelmust'], famousTextiles: ['Cotton Weaving', 'Leather'] },
  { id: 'nigeria', name: 'Nigeria', flag: '🇳🇬', code: 'NG', region: 'West', traditionalStyles: ['Ankara', 'Adire', 'Aso-Oke', 'Agbada', 'Buba', 'Iro'], famousTextiles: ['Ankara', 'Adire', 'Aso-Oke', 'Lace', 'George'] },
  { id: 'senegal', name: 'Senegal', flag: '🇸🇳', code: 'SN', region: 'West', traditionalStyles: ['Boubou', 'Grand Boubou', 'Pagne'], famousTextiles: ['Wax Prints', 'Bogolan', 'Cotton'] },
  { id: 'sierra-leone', name: 'Sierra Leone', flag: '🇸🇱', code: 'SL', region: 'West', traditionalStyles: ['Gara', 'Country Cloth', 'Buba'], famousTextiles: ['Gara Cloth', 'Country Cloth'] },
  { id: 'togo', name: 'Togo', flag: '🇹🇬', code: 'TG', region: 'West', traditionalStyles: ['Pagne', 'Boubou', 'Kente'], famousTextiles: ['Kente', 'Wax Prints'] },
  
  // Central Africa
  { id: 'cameroon', name: 'Cameroon', flag: '🇨🇲', code: 'CM', region: 'Central', traditionalStyles: ['Toghu', 'Kaba', 'Boubou'], famousTextiles: ['Toghu Velvet', 'Batik', 'Wax Prints'] },
  { id: 'central-african-republic', name: 'Central African Republic', flag: '🇨🇫', code: 'CF', region: 'Central', traditionalStyles: ['Pagne', 'Boubou'], famousTextiles: ['Cotton', 'Wax Prints'] },
  { id: 'chad', name: 'Chad', flag: '🇹🇩', code: 'TD', region: 'Central', traditionalStyles: ['Jalabiya', 'Pagne', 'Boubou'], famousTextiles: ['Cotton', 'Wool'] },
  { id: 'congo', name: 'Congo', flag: '🇨🇬', code: 'CG', region: 'Central', traditionalStyles: ['Pagne', 'Boubou', 'Mabaka'], famousTextiles: ['Wax Prints', 'Raffia', 'Kente'] },
  { id: 'dr-congo', name: 'DR Congo', flag: '🇨🇩', code: 'CD', region: 'Central', traditionalStyles: ['Pagne', 'Boubou', 'Kitenge'], famousTextiles: ['Kitenge', 'Wax Prints', 'Kuba Cloth'] },
  { id: 'equatorial-guinea', name: 'Equatorial Guinea', flag: '🇬🇶', code: 'GQ', region: 'Central', traditionalStyles: ['Pagne', 'Boubou'], famousTextiles: ['Cotton', 'Wax Prints'] },
  { id: 'gabon', name: 'Gabon', flag: '🇬🇦', code: 'GA', region: 'Central', traditionalStyles: ['Pagne', 'Boubou', 'Raffia'], famousTextiles: ['Raffia Cloth', 'Wax Prints'] },
  { id: 'sao-tome', name: 'São Tomé and Príncipe', flag: '🇸🇹', code: 'ST', region: 'Central', traditionalStyles: ['Pagne', 'Traditional Dresses'], famousTextiles: ['Cotton', 'Batik'] },
  
  // East Africa
  { id: 'burundi', name: 'Burundi', flag: '🇧🇮', code: 'BI', region: 'East', traditionalStyles: ['Imishanana', 'Kitenge', 'Pagne'], famousTextiles: ['Kitenge', 'Imishanana'] },
  { id: 'comoros', name: 'Comoros', flag: '🇰🇲', code: 'KM', region: 'East', traditionalStyles: ['Shirwana', 'Kandu', 'Kofia'], famousTextiles: ['Silk', 'Cotton'] },
  { id: 'djibouti', name: 'Djibouti', flag: '🇩🇯', code: 'DJ', region: 'East', traditionalStyles: ['Macawiis', 'Guntiino', 'Dirac'], famousTextiles: ['Cotton', 'Silk'] },
  { id: 'eritrea', name: 'Eritrea', flag: '🇪🇷', code: 'ER', region: 'East', traditionalStyles: ['Zuria', 'Gabi', 'Kunama'], famousTextiles: ['Tilfi', 'Cotton Weaving'] },
  { id: 'ethiopia', name: 'Ethiopia', flag: '🇪🇹', code: 'ET', region: 'East', traditionalStyles: ['Habesha Kemis', 'Netela', 'Gabi'], famousTextiles: ['Tibeb', 'Cotton Weaving', 'Netela'] },
  { id: 'kenya', name: 'Kenya', flag: '🇰🇪', code: 'KE', region: 'East', traditionalStyles: ['Kitenge', 'Kanga', 'Maasai Shuka', 'Kikoi'], famousTextiles: ['Kitenge', 'Kanga', 'Shuka', 'Kikoi'] },
  { id: 'madagascar', name: 'Madagascar', flag: '🇲🇬', code: 'MG', region: 'East', traditionalStyles: ['Lamba', 'Saloany', 'Shawl'], famousTextiles: ['Raffia', 'Lamba', 'Silk'] },
  { id: 'malawi', name: 'Malawi', flag: '🇲🇼', code: 'MW', region: 'East', traditionalStyles: ['Chitenje', 'Kitenge', 'Traditional Wear'], famousTextiles: ['Chitenje', 'Cotton'] },
  { id: 'mauritius', name: 'Mauritius', flag: '🇲🇺', code: 'MU', region: 'East', traditionalStyles: ['Sari', 'Salwar Kameez', 'Creole Dresses'], famousTextiles: ['Cotton', 'Silk'] },
  { id: 'rwanda', name: 'Rwanda', flag: '🇷🇼', code: 'RW', region: 'East', traditionalStyles: ['Mushanana', 'Kitenge', 'Imishanana'], famousTextiles: ['Kitenge', 'Imishanana', 'Peace Basket'] },
  { id: 'seychelles', name: 'Seychelles', flag: '🇸🇨', code: 'SC', region: 'East', traditionalStyles: ['Kreol Dresses', 'Pagne'], famousTextiles: ['Cotton', 'Batik'] },
  { id: 'somalia', name: 'Somalia', flag: '🇸🇴', code: 'SO', region: 'East', traditionalStyles: ['Guntiino', 'Dirac', 'Garbasar', 'Macawiis'], famousTextiles: ['Silk', 'Cotton', 'Alindi'] },
  { id: 'south-sudan', name: 'South Sudan', flag: '🇸🇸', code: 'SS', region: 'East', traditionalStyles: ['Tobe', 'Wrapper', 'Traditional Beads'], famousTextiles: ['Cotton', 'Beadwork'] },
  { id: 'tanzania', name: 'Tanzania', flag: '🇹🇿', code: 'TZ', region: 'East', traditionalStyles: ['Kitenge', 'Kanga', 'Maasai Shuka'], famousTextiles: ['Kitenge', 'Kanga', 'Tingatinga'] },
  { id: 'uganda', name: 'Uganda', flag: '🇺🇬', code: 'UG', region: 'East', traditionalStyles: ['Gomesi', 'Kanzu', 'Kitenge', 'Busuti'], famousTextiles: ['Kitenge', 'Bark Cloth', 'Gomesi'] },
  
  // Southern Africa
  { id: 'angola', name: 'Angola', flag: '🇦🇴', code: 'AO', region: 'Southern', traditionalStyles: ['Pano', 'Capulana', 'Traditional Dresses'], famousTextiles: ['Capulana', 'Pano'] },
  { id: 'botswana', name: 'Botswana', flag: '🇧🇼', code: 'BW', region: 'Southern', traditionalStyles: ['Leteisi', 'Shweshwe', 'Traditional Wear'], famousTextiles: ['Shweshwe', 'Leteisi'] },
  { id: 'eswatini', name: 'Eswatini', flag: '🇸🇿', code: 'SZ', region: 'Southern', traditionalStyles: ['Emahiya', 'Lihiya', 'Sishweshwe'], famousTextiles: ['Shweshwe', 'Emahiya'] },
  { id: 'lesotho', name: 'Lesotho', flag: '🇱🇸', code: 'LS', region: 'Southern', traditionalStyles: ['Seshoeshoe', 'Blanket', 'Mokorotlo'], famousTextiles: ['Seshoeshoe', 'Basotho Blanket'] },
  { id: 'mozambique', name: 'Mozambique', flag: '🇲🇿', code: 'MZ', region: 'Southern', traditionalStyles: ['Capulana', 'Pano', 'X capulana'], famousTextiles: ['Capulana', 'Pano'] },
  { id: 'namibia', name: 'Namibia', flag: '🇳🇦', code: 'NA', region: 'Southern', traditionalStyles: ['Oshiwambo Dress', 'Herero Dress', 'Damara Dress'], famousTextiles: ['Oshiwambo', 'Herero', 'Cotton'] },
  { id: 'south-africa', name: 'South Africa', flag: '🇿🇦', code: 'ZA', region: 'Southern', traditionalStyles: ['Shweshwe', 'Isishweshwe', 'Ndebele', 'Zulu', 'Xhosa'], famousTextiles: ['Shweshwe', 'Ndebele Beadwork', 'Zulu Attire'] },
  { id: 'zambia', name: 'Zambia', flag: '🇿🇲', code: 'ZM', region: 'Southern', traditionalStyles: ['Chitenge', 'Kitenge', 'Traditional Wear'], famousTextiles: ['Chitenge', 'Cotton'] },
  { id: 'zimbabwe', name: 'Zimbabwe', flag: '🇿🇼', code: 'ZW', region: 'Southern', traditionalStyles: ['Chitenge', 'Ndebele', 'Shona'], famousTextiles: ['Chitenge', 'Ndebele Beadwork', 'Shona'] },
];

// Helper function to get countries by region
export const getCountriesByRegion = (region: AfricanCountry['region']) => {
  return africanCountries.filter(country => country.region === region);
};

// Helper function to get country by ID
export const getCountryById = (id: string) => {
  return africanCountries.find(country => country.id === id);
};

// Helper function to get flag by country ID
export const getFlagById = (id: string) => {
  const country = africanCountries.find(c => c.id === id);
  return country?.flag || '🌍';
};

// Export regions for filtering
export const regions = ['North', 'West', 'Central', 'East', 'Southern'] as const;
