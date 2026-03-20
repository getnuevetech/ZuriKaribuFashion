import { useState } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { africanCountries, getFlagById } from '../data/africanCountries';

interface FilterOption {
  id: string;
  label: string;
  icon?: string;
}

interface FilterCategory {
  id: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  categories: FilterCategory[];
  onFilterChange: (filters: Record<string, string[]>) => void;
  showCountryFilter?: boolean;
}

// Material icons (using emojis as icons)
const materialIcons: Record<string, string> = {
  ankara: '🎨',
  kente: '👑',
  adire: '💧',
  'aso-oke': '🧵',
  lace: '🌸',
  shweshwe: '🔷',
  'mud-cloth': '🟤',
  kitenge: '🌺',
  dashiki: '👕',
  cotton: '☁️',
  silk: '🦋',
  bogolan: '🎭',
  chitenge: '🌿',
  kanga: '📜',
  capulana: '🎪',
  raffia: '🌴',
  'bark-cloth': '🌳',
  'country-cloth': '🏞️',
  gara: '🌀',
  toghu: '👘',
};

// Style icons
const styleIcons: Record<string, string> = {
  traditional: '🏛️',
  modern: '✨',
  casual: '👟',
  bridal: '💍',
  formal: '🎩',
  accessories: '👜',
  'ready-to-wear': '👗',
  custom: '🧵',
};

export default function FilterBar({ categories, onFilterChange, showCountryFilter = true }: FilterBarProps) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);

  const toggleFilter = (categoryId: string, optionId: string) => {
    setActiveFilters((prev) => {
      const current = prev[categoryId] || [];
      const updated = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      
      const newFilters = { ...prev, [categoryId]: updated };
      if (updated.length === 0) delete newFilters[categoryId];
      
      onFilterChange(newFilters);
      return newFilters;
    });
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
    onFilterChange({});
  };

  const getIcon = (categoryId: string, optionId: string) => {
    const lowerId = optionId.toLowerCase();
    if (categoryId === 'country') return getFlagById(lowerId);
    if (categoryId === 'material') return materialIcons[lowerId] || '🧵';
    if (categoryId === 'style') return styleIcons[lowerId] || '✨';
    return '';
  };

  const activeFilterCount = Object.values(activeFilters).flat().length;
  
  // Get countries grouped by region
  const countriesByRegion = {
    'North': africanCountries.filter(c => c.region === 'North'),
    'West': africanCountries.filter(c => c.region === 'West'),
    'Central': africanCountries.filter(c => c.region === 'Central'),
    'East': africanCountries.filter(c => c.region === 'East'),
    'Southern': africanCountries.filter(c => c.region === 'Southern'),
  };

  return (
    <div className="sticky top-20 z-40 bg-[#F8F6F1]/95 backdrop-blur-md border-b border-[#1A1A1A]/10">
      {/* Main Filter Bar */}
      <div className="px-8 md:px-[8vw] py-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] placeholder:text-[#9A9A9A] focus:outline-none focus:border-[#E85A3C] transition-colors text-sm"
            />
          </div>

          {/* Filter Toggle (Mobile) */}
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 bg-[#E85A3C] rounded-full text-xs flex items-center justify-center text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Filter Categories - Desktop */}
        <div className="hidden lg:block mt-4 space-y-4">
          {/* Country Filter */}
          {showCountryFilter && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="label-mono text-[#6B6B6B]">COUNTRY ({africanCountries.length})</span>
                <button
                  onClick={() => setShowAllCountries(!showAllCountries)}
                  className="text-sm text-[#E85A3C] hover:underline flex items-center gap-1"
                >
                  {showAllCountries ? 'Show Less' : 'Show All'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAllCountries ? 'rotate-180' : ''}`} />
                </button>
              </div>
              
              {/* Quick Access - Popular Countries */}
              {!showAllCountries && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {['nigeria', 'ghana', 'kenya', 'south-africa', 'morocco', 'senegal', 'ethiopia', 'tanzania', 'uganda', 'mali', 'egypt', 'congo'].map((countryId) => {
                    const country = africanCountries.find(c => c.id === countryId);
                    if (!country) return null;
                    const isActive = activeFilters['country']?.includes(countryId);
                    return (
                      <button
                        key={countryId}
                        onClick={() => toggleFilter('country', countryId)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all ${
                          isActive
                            ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                            : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#E85A3C]/40'
                        }`}
                      >
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* All Countries by Region */}
              {showAllCountries && (
                <div className="space-y-3">
                  {Object.entries(countriesByRegion).map(([region, countries]) => (
                    <div key={region} className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-[#9A9A9A] w-20 shrink-0">{region}:</span>
                      <div className="flex flex-wrap gap-2">
                        {countries.map((country) => {
                          const isActive = activeFilters['country']?.includes(country.id);
                          return (
                            <button
                              key={country.id}
                              onClick={() => toggleFilter('country', country.id)}
                              className={`flex items-center gap-1.5 px-2 py-1 text-xs border transition-all ${
                                isActive
                                  ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                                  : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#E85A3C]/40'
                              }`}
                            >
                              <span>{country.flag}</span>
                              <span>{country.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Other Filter Categories */}
          <div className="flex flex-wrap gap-8">
            {categories.filter(cat => cat.id !== 'country').map((category) => (
              <div key={category.id} className="flex-1 min-w-[200px]">
                <span className="label-mono text-[#6B6B6B] block mb-2">{category.label}</span>
                <div className="flex flex-wrap gap-2">
                  {category.options.map((option) => {
                    const isActive = activeFilters[category.id]?.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleFilter(category.id, option.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all ${
                          isActive
                            ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                            : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A] hover:border-[#E85A3C]/40'
                        }`}
                      >
                        <span>{getIcon(category.id, option.id)}</span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showMobileFilters && (
        <div className="lg:hidden px-8 py-4 border-t border-[#1A1A1A]/10 bg-[#F8F6F1] max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {/* Country Filter Mobile */}
            {showCountryFilter && (
              <div>
                <span className="label-mono text-[#6B6B6B] block mb-2">COUNTRY</span>
                <div className="flex flex-wrap gap-2">
                  {africanCountries.map((country) => {
                    const isActive = activeFilters['country']?.includes(country.id);
                    return (
                      <button
                        key={country.id}
                        onClick={() => toggleFilter('country', country.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all ${
                          isActive
                            ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                            : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A]'
                        }`}
                      >
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other Categories Mobile */}
            {categories.filter(cat => cat.id !== 'country').map((category) => (
              <div key={category.id}>
                <span className="label-mono text-[#6B6B6B] block mb-2">{category.label}</span>
                <div className="flex flex-wrap gap-2">
                  {category.options.map((option) => {
                    const isActive = activeFilters[category.id]?.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleFilter(category.id, option.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all ${
                          isActive
                            ? 'bg-[#E85A3C] border-[#E85A3C] text-white'
                            : 'bg-white border-[#1A1A1A]/10 text-[#1A1A1A]'
                        }`}
                      >
                        <span>{getIcon(category.id, option.id)}</span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="px-8 md:px-[8vw] py-3 border-t border-[#1A1A1A]/10 flex flex-wrap gap-2 bg-white">
          {Object.entries(activeFilters).map(([categoryId, optionIds]) =>
            optionIds.map((optionId) => {
              const category = categories.find((c) => c.id === categoryId);
              const option = category?.options.find((o) => o.id === optionId);
              const country = categoryId === 'country' ? africanCountries.find(c => c.id === optionId) : null;
              const label = country?.name || option?.label || optionId;
              return (
                <button
                  key={`${categoryId}-${optionId}`}
                  onClick={() => toggleFilter(categoryId, optionId)}
                  className="flex items-center gap-2 px-3 py-1 bg-[#E85A3C]/10 border border-[#E85A3C]/30 text-[#1A1A1A] text-sm"
                >
                  <span>{getIcon(categoryId, optionId)}</span>
                  <span>{label}</span>
                  <X className="w-3 h-3" />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
