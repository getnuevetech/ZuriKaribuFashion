import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CurrencyConfigPayload = {
  defaultCurrency?: string;
  supportedCurrencies?: string[];
  usdPerUnitByCurrency?: Record<string, number>;
};

interface CurrencyStoreState {
  selectedCurrency: string;
  defaultCurrency: string;
  supportedCurrencies: string[];
  usdPerUnitByCurrency: Record<string, number>;
  hydrateFromConfig: (payload: CurrencyConfigPayload | null | undefined) => void;
  setSelectedCurrency: (currencyCode: string) => void;
  convertFromUsd: (amountUsd: number, currencyCode?: string) => number;
  formatFromUsd: (amountUsd: number, currencyCode?: string) => string;
}

const normalizeCurrencyCode = (value: unknown) => String(value || '').trim().toUpperCase();

export const useCurrencyStore = create<CurrencyStoreState>()(
  persist(
    (set, get) => ({
      selectedCurrency: 'USD',
      defaultCurrency: 'USD',
      supportedCurrencies: ['USD'],
      usdPerUnitByCurrency: { USD: 1 },
      hydrateFromConfig: (payload) => {
        const defaultCurrency = normalizeCurrencyCode(payload?.defaultCurrency || 'USD') || 'USD';
        const supportedCandidates = Array.isArray(payload?.supportedCurrencies)
          ? payload!.supportedCurrencies!.map((entry) => normalizeCurrencyCode(entry)).filter(Boolean)
          : [];
        const supportedSet = new Set<string>(['USD', defaultCurrency, ...supportedCandidates]);
        const supportedCurrencies = Array.from(supportedSet);
        const rates = { USD: 1, ...(payload?.usdPerUnitByCurrency || {}) };
        const previousSelected = normalizeCurrencyCode(get().selectedCurrency || defaultCurrency) || defaultCurrency;
        const selectedCurrency = supportedSet.has(previousSelected) ? previousSelected : defaultCurrency;
        set({
          defaultCurrency,
          supportedCurrencies,
          usdPerUnitByCurrency: rates,
          selectedCurrency,
        });
      },
      setSelectedCurrency: (currencyCode) => {
        const normalized = normalizeCurrencyCode(currencyCode);
        if (!normalized) return;
        const supported = get().supportedCurrencies;
        if (!supported.includes(normalized)) return;
        set({ selectedCurrency: normalized });
      },
      convertFromUsd: (amountUsd, currencyCode) => {
        const safeAmount = Number(amountUsd || 0);
        if (!Number.isFinite(safeAmount)) return 0;
        const code = normalizeCurrencyCode(currencyCode || get().selectedCurrency) || 'USD';
        if (code === 'USD') return safeAmount;
        const usdPerUnit = Number(get().usdPerUnitByCurrency?.[code] || 0);
        if (!Number.isFinite(usdPerUnit) || usdPerUnit <= 0) return safeAmount;
        return Number((safeAmount / usdPerUnit).toFixed(2));
      },
      formatFromUsd: (amountUsd, currencyCode) => {
        const code = normalizeCurrencyCode(currencyCode || get().selectedCurrency) || 'USD';
        const converted = get().convertFromUsd(amountUsd, code);
        try {
          return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: code,
            maximumFractionDigits: 2,
          }).format(converted);
        } catch {
          return `${code} ${converted.toFixed(2)}`;
        }
      },
    }),
    {
      name: 'currency-preference',
      partialize: (state) => ({ selectedCurrency: state.selectedCurrency }),
    }
  )
);
