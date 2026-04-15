import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Globe } from 'lucide-react';
import { africanCountries } from '../data/africanCountries';

interface CountryFilterProps {
  selectedCountries: string[];
  onChange: (countries: string[]) => void;
}

// Quick access countries (most popular)
const quickAccessCountries = ['nigeria', 'ghana', 'kenya', 'south-africa', 'morocco', 'senegal', 'ethiopia', 'tanzania'];

export default function CountryFilter({ selectedCountries, onChange }: CountryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCountry = (countryId: string) => {
    if (selectedCountries.includes(countryId)) {
      onChange(selectedCountries.filter(id => id !== countryId));
    } else {
      onChange([...selectedCountries, countryId]);
    }
  };

  const clearSelection = () => {
    onChange([]);
  };

  const filteredCountries = searchQuery
    ? africanCountries.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.region.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : africanCountries;

  // Group by region
  const countriesByRegion = {
    'West': filteredCountries.filter(c => c.region === 'West'),
    'East': filteredCountries.filter(c => c.region === 'East'),
    'North': filteredCountries.filter(c => c.region === 'North'),
    'Southern': filteredCountries.filter(c => c.region === 'Southern'),
    'Central': filteredCountries.filter(c => c.region === 'Central'),
  };

  return (
    <div className="space-y-3">
      {/* Quick Access Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono text-[var(--text-secondary)] text-xs mr-2">COUNTRY</span>
        
        {quickAccessCountries.map(countryId => {
          const country = africanCountries.find(c => c.id === countryId);
          if (!country) return null;
          const isSelected = selectedCountries.includes(countryId);
          
          return (
            <button
              key={countryId}
              onClick={() => toggleCountry(countryId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border transition-all ${
                isSelected
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]'
              }`}
            >
              <span>{country.flag}</span>
              <span>{country.name}</span>
            </button>
          );
        })}

        {/* Dropdown Toggle */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm border transition-all ${
              selectedCountries.length > quickAccessCountries.length
                ? 'bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-primary)]'
                : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>More</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            {selectedCountries.length > 0 && (
              <span className="ml-1 w-5 h-5 bg-[var(--accent)] rounded-full text-xs flex items-center justify-center text-white">
                {selectedCountries.length}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-[400px] max-w-[90vw] bg-[var(--bg-secondary)] shadow-xl border border-[var(--border)] z-50">
              {/* Search */}
              <div className="p-3 border-b border-[var(--border)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border-0 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 text-[var(--text-primary)]"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Selected Count */}
              {selectedCountries.length > 0 && (
                <div className="px-3 py-2 bg-[var(--accent)]/5 border-b border-[var(--border)] flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">
                    {selectedCountries.length} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Countries List by Region */}
              <div className="max-h-[300px] overflow-y-auto">
                {Object.entries(countriesByRegion).map(([region, countries]) => (
                  countries.length > 0 && (
                    <div key={region} className="border-b border-[var(--border)] last:border-0">
                      <div className="px-3 py-2 bg-[var(--bg-primary)]">
                        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                          {region} Africa
                        </span>
                      </div>
                      <div className="p-2">
                        {countries.map(country => {
                          const isSelected = selectedCountries.includes(country.id);
                          return (
                            <button
                              key={country.id}
                              onClick={() => toggleCountry(country.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                                isSelected
                                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                                  : 'hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'
                              }`}
                            >
                              <span className="text-lg">{country.flag}</span>
                              <span className="flex-1">{country.name}</span>
                              {isSelected && (
                                <span className="w-5 h-5 bg-[var(--accent)] rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Countries Pills */}
      {selectedCountries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCountries.map(countryId => {
            const country = africanCountries.find(c => c.id === countryId);
            if (!country) return null;
            return (
              <button
                key={countryId}
                onClick={() => toggleCountry(countryId)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--text-primary)] text-sm hover:bg-[var(--accent)]/20 transition-colors"
              >
                <span>{country.flag}</span>
                <span>{country.name}</span>
                <X className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
