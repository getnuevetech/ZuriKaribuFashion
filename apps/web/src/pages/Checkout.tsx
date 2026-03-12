import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CardElement, 
  useStripe, 
  useElements 
} from '@stripe/react-stripe-js';
import { 
  ChevronLeft, 
  MapPin, 
  CreditCard, 
  Truck, 
  Check,
  Lock,
  AlertCircle
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useCurrencyStore } from '../store/currencyStore';
import {
  getCityOptionsByCountryAndState,
  getCountryOptions,
  getStateOptionsByCountryCode,
  resolveCountryCode,
} from '../data/locationOptions';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface PaymentProviderOption {
  providerKey: string;
  displayName: string;
  checkoutType: 'INLINE' | 'REDIRECT';
  mode: 'TEST' | 'LIVE';
  publicConfig?: Record<string, any>;
}

interface ShippingQuoteOption {
  id: string;
  source: 'GLOBAL' | 'LOCAL';
  providerKey: string;
  providerName: string;
  serviceName: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceUsd: number;
  countryCode?: string;
  city?: string | null;
}

interface PromoPreviewResult {
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  discountUsd: number;
  subtotalUsd: number;
  eligibleSubtotalUsd: number;
}

interface SuggestedCheckoutProduct {
  id: string;
  name: string;
  image: string;
  subtitle: string;
  href: string;
}

interface SavedCustomerAddress {
  id: string;
  label?: string;
  fullName?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  isDefault?: boolean;
}

const parseAddressLines = (address: unknown) => {
  const tokens = String(address || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (tokens.length === 0) {
    return { addressLine1: '', addressLine2: '', state: '' };
  }
  if (tokens.length === 1) {
    return { addressLine1: tokens[0], addressLine2: '', state: '' };
  }
  if (tokens.length === 2) {
    return { addressLine1: tokens[0], addressLine2: '', state: tokens[1] };
  }
  return {
    addressLine1: tokens[0],
    addressLine2: tokens.slice(1, -1).join(', '),
    state: tokens[tokens.length - 1],
  };
};

const mapSavedAddressToShipping = (address: SavedCustomerAddress): ShippingAddress => {
  const parsed = parseAddressLines(address.address);
  const countryCode = resolveCountryCode(address.country);
  return {
    fullName: String(address.fullName || ''),
    addressLine1: parsed.addressLine1,
    addressLine2: parsed.addressLine2,
    city: String(address.city || ''),
    state: parsed.state,
    postalCode: String(address.postalCode || ''),
    country: countryCode || String(address.country || ''),
    phone: String(address.phone || ''),
  };
};

export default function Checkout() {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuthStore();
  const { items, totalPrice, clearCart } = useCartStore();
  const { formatFromUsd, selectedCurrency } = useCurrencyStore();
  
  const [step, setStep] = useState<'shipping' | 'payment' | 'review'>('shipping');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<SuggestedCheckoutProduct[]>([]);
  const [paymentProviders, setPaymentProviders] = useState<PaymentProviderOption[]>([]);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<string>('STRIPE');
  const [savedAddresses, setSavedAddresses] = useState<SavedCustomerAddress[]>([]);
  const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState('');
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuoteOption[]>([]);
  const [selectedShippingQuoteId, setSelectedShippingQuoteId] = useState<string>('');
  const [shippingQuotesLoading, setShippingQuotesLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoPreview, setPromoPreview] = useState<PromoPreviewResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [cardPromoHint, setCardPromoHint] = useState('');
  
  const fullName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || user?.lastName || '';
  
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: fullName,
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
  });
  const countryOptions = getCountryOptions();
  const shippingCountryCode = resolveCountryCode(shippingAddress.country);
  const stateOptions = getStateOptionsByCountryCode(shippingCountryCode);
  const cityOptions = getCityOptionsByCountryAndState(shippingCountryCode, shippingAddress.state);
  const selectableStateOptions = Array.from(
    new Set([shippingAddress.state, ...stateOptions].map((value) => String(value || '').trim()).filter(Boolean))
  );
  const selectableCityOptions = Array.from(
    new Set([shippingAddress.city, ...cityOptions].map((value) => String(value || '').trim()).filter(Boolean))
  );

  const fallbackShipping = totalPrice > 200 ? 0 : 25;
  const selectedShippingQuote =
    shippingQuotes.find((entry) => entry.id === selectedShippingQuoteId) || null;
  const shipping = selectedShippingQuote ? Number(selectedShippingQuote.priceUsd || 0) : fallbackShipping;
  const promoDiscount = Number(promoPreview?.discountUsd || 0);
  const finalTotal = Math.max(0, totalPrice - promoDiscount + shipping);
  const selectedProvider = paymentProviders.find((entry) => entry.providerKey === selectedPaymentProvider) || null;
  const currentStepSummary =
    step === 'shipping'
      ? 'Step 1 of 3: Shipping details'
      : step === 'payment'
        ? 'Step 2 of 3: Secure payment'
        : 'Step 3 of 3: Confirmation';

  useEffect(() => {
    api.payments
      .getOptions()
      .then((response) => {
        if (response.success && Array.isArray(response.data?.providers) && response.data.providers.length > 0) {
          const providers = response.data.providers.map((entry) => ({
            providerKey: String(entry.providerKey || 'STRIPE').toUpperCase(),
            displayName: String(entry.displayName || entry.providerKey || 'Payment Provider'),
            checkoutType: entry.checkoutType === 'REDIRECT' ? 'REDIRECT' : 'INLINE',
            mode: entry.mode === 'LIVE' ? 'LIVE' : 'TEST',
            publicConfig: entry.publicConfig || {},
          }));
          setPaymentProviders(providers);
          setSelectedPaymentProvider((current) => {
            const preferred = providers.find((entry) => entry.providerKey === current);
            return preferred ? preferred.providerKey : providers[0].providerKey;
          });
          return;
        }
        setPaymentProviders([
          { providerKey: 'STRIPE', displayName: 'Stripe', checkoutType: 'INLINE', mode: 'TEST', publicConfig: {} },
        ]);
      })
      .catch(() => {
        setPaymentProviders([
          { providerKey: 'STRIPE', displayName: 'Stripe', checkoutType: 'INLINE', mode: 'TEST', publicConfig: {} },
        ]);
      });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setSavedAddressesLoading(true);
    api.customer
      .getAddresses()
      .then((response) => {
        if (cancelled || !response.success) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        const normalized = rows.map((entry: any) => ({
          id: String(entry?.id || ''),
          label: String(entry?.label || ''),
          fullName: String(entry?.fullName || ''),
          address: String(entry?.address || ''),
          city: String(entry?.city || ''),
          postalCode: entry?.postalCode ? String(entry.postalCode) : '',
          country: String(entry?.country || ''),
          phone: String(entry?.phone || ''),
          isDefault: Boolean(entry?.isDefault),
        })) as SavedCustomerAddress[];
        setSavedAddresses(normalized);

        setShippingAddress((prev) => {
          const hasManualAddress = Boolean(
            String(prev.addressLine1 || '').trim() ||
              String(prev.city || '').trim() ||
              String(prev.country || '').trim()
          );
          if (hasManualAddress) return prev;
          const preferred = normalized.find((entry) => entry.isDefault) || normalized[0];
          if (!preferred?.id) return prev;
          setSelectedSavedAddressId(preferred.id);
          return { ...prev, ...mapSavedAddressToShipping(preferred) };
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSavedAddresses([]);
      })
      .finally(() => {
        if (!cancelled) setSavedAddressesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const countryCode = shippingCountryCode || shippingAddress.country;
    const city = String(shippingAddress.city || '').trim();
    if (!countryCode || !city) {
      setShippingQuotes([]);
      setSelectedShippingQuoteId('');
      return;
    }
    let cancelled = false;
    setShippingQuotesLoading(true);
    api.shipping
      .getOptions({
        countryCode,
        city,
        subtotalUsd: Number(totalPrice || 0),
      })
      .then((response) => {
        if (cancelled) return;
        const quotes = Array.isArray(response.data?.quotes) ? response.data.quotes : [];
        const normalizedQuotes: ShippingQuoteOption[] = quotes.map((entry: any) => ({
          id: String(entry.id || ''),
          source: entry.source === 'LOCAL' ? 'LOCAL' : 'GLOBAL',
          providerKey: String(entry.providerKey || '').toUpperCase(),
          providerName: String(entry.providerName || entry.providerKey || 'Shipping Provider'),
          serviceName: String(entry.serviceName || 'Standard'),
          etaMinDays: Number(entry.etaMinDays || 0),
          etaMaxDays: Number(entry.etaMaxDays || 0),
          priceUsd: Number(entry.priceUsd || 0),
          countryCode: entry.countryCode ? String(entry.countryCode) : undefined,
          city: entry.city ? String(entry.city) : null,
        }));
        setShippingQuotes(normalizedQuotes);
        const recommended = String(response.data?.recommendedQuoteId || '');
        setSelectedShippingQuoteId((current) => {
          if (normalizedQuotes.find((entry) => entry.id === current)) return current;
          if (recommended && normalizedQuotes.find((entry) => entry.id === recommended)) return recommended;
          return normalizedQuotes[0]?.id || '';
        });
      })
      .catch(() => {
        if (cancelled) return;
        setShippingQuotes([]);
        setSelectedShippingQuoteId('');
      })
      .finally(() => {
        if (!cancelled) setShippingQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shippingAddress.country, shippingAddress.city, shippingCountryCode, totalPrice]);

  useEffect(() => {
    const kindCount = items.reduce(
      (acc, item) => {
        acc[item.kind] = (acc[item.kind] || 0) + 1;
        return acc;
      },
      { CUSTOM_DESIGN: 0, READY_TO_WEAR: 0, FABRIC_ONLY: 0 } as Record<string, number>
    );
    const dominantKind =
      kindCount.FABRIC_ONLY >= kindCount.CUSTOM_DESIGN && kindCount.FABRIC_ONLY >= kindCount.READY_TO_WEAR
        ? 'FABRIC_ONLY'
        : kindCount.CUSTOM_DESIGN >= kindCount.READY_TO_WEAR
          ? 'CUSTOM_DESIGN'
          : 'READY_TO_WEAR';

    const mapRows = (rows: any[], kind: 'FABRIC_ONLY' | 'CUSTOM_DESIGN' | 'READY_TO_WEAR'): SuggestedCheckoutProduct[] =>
      rows.slice(0, 4).map((row: any) => {
        if (kind === 'FABRIC_ONLY') {
          return {
            id: String(row.id || ''),
            name: String(row.name || 'Fabric'),
            image: String(row.images?.[0]?.url || '/images/placeholder.jpg'),
            subtitle: String(row.materialType?.name || 'Fabric'),
            href: `/fabrics/${row.id}`,
          };
        }
        if (kind === 'CUSTOM_DESIGN') {
          return {
            id: String(row.id || ''),
            name: String(row.name || 'Design'),
            image: String(row.images?.[0]?.url || '/images/placeholder.jpg'),
            subtitle: String(row.category?.name || 'Design'),
            href: `/designs/${row.id}`,
          };
        }
        return {
          id: String(row.id || ''),
          name: String(row.name || 'Ready To Wear'),
          image: String(row.images?.[0]?.url || '/images/placeholder.jpg'),
          subtitle: String(row.category?.name || 'Ready To Wear'),
          href: `/ready-to-wear/${row.id}`,
        };
      });

    if (dominantKind === 'FABRIC_ONLY') {
      api.products
        .getFabrics({ limit: 4 })
        .then((response) => {
          if (response.success) {
            setSuggestedProducts(mapRows(Array.isArray(response.data?.fabrics) ? response.data.fabrics : [], 'FABRIC_ONLY'));
          } else {
            setSuggestedProducts([]);
          }
        })
        .catch(() => setSuggestedProducts([]));
      return;
    }
    if (dominantKind === 'CUSTOM_DESIGN') {
      api.products
        .getDesigns({ limit: 4 })
        .then((response) => {
          if (response.success) {
            setSuggestedProducts(mapRows(Array.isArray(response.data?.designs) ? response.data.designs : [], 'CUSTOM_DESIGN'));
          } else {
            setSuggestedProducts([]);
          }
        })
        .catch(() => setSuggestedProducts([]));
      return;
    }
    api.products
      .getReadyToWear({ limit: 4 })
      .then((response) => {
        if (response.success) {
          setSuggestedProducts(mapRows(Array.isArray(response.data?.products) ? response.data.products : [], 'READY_TO_WEAR'));
        } else {
          setSuggestedProducts([]);
        }
      })
      .catch(() => setSuggestedProducts([]));
  }, [items]);

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (shippingQuotes.length > 0 && !selectedShippingQuote) {
        throw new Error('Please select a shipping option to continue.');
      }
      const normalizedTotalUsd = Number(Number(finalTotal || 0).toFixed(2));
      if (!Number.isFinite(normalizedTotalUsd) || normalizedTotalUsd <= 0) {
        throw new Error('Checkout total must be greater than 0 to initialize payment.');
      }
      const providerKey = selectedProvider?.providerKey || 'STRIPE';
      const response = await api.payments.createPaymentSession({
        providerKey,
        amount: Math.round(normalizedTotalUsd * 100), // Convert to cents
        amountUsd: normalizedTotalUsd,
        currency: 'USD',
        returnUrl: `${window.location.origin}/checkout?payment_provider=${providerKey}`,
        cancelUrl: `${window.location.origin}/checkout?payment_provider=${providerKey}&payment_cancelled=true`,
        customer: {
          email: user?.email || undefined,
          name: shippingAddress.fullName || undefined,
          phone: shippingAddress.phone || undefined,
        },
      });

      if (response.success && response.data?.flow === 'INLINE') {
        setClientSecret(response.data.clientSecret);
        setStep('payment');
        return;
      }
      if (response.success && response.data?.flow === 'REDIRECT' && response.data.checkoutUrl) {
        sessionStorage.setItem(
          'checkout_pending_payment',
          JSON.stringify({
            providerKey,
            reference: response.data.reference,
            shippingAddress,
            selectedSavedAddressId,
            shippingQuote: selectedShippingQuote,
            promoPreview,
            promoCode,
            createdAt: Date.now(),
          })
        );
        window.location.href = response.data.checkoutUrl;
        return;
      }
      throw new Error('Payment provider could not initialize checkout.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret!,
      {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: shippingAddress.fullName,
            address: {
              line1: shippingAddress.addressLine1,
              line2: shippingAddress.addressLine2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postalCode,
              country: shippingAddress.country,
            },
            phone: shippingAddress.phone,
          },
        },
      }
    );

    if (stripeError) {
      setError(stripeError.message || 'Payment failed');
      setLoading(false);
      return;
    }

    if (paymentIntent.status === 'succeeded') {
      setStep('review');
      // Create orders
      await createOrders(paymentIntent.id, selectedPaymentProvider);
    }

    setLoading(false);
  };

  const createOrders = async (
    paymentIntentId: string,
    paymentMethod: string,
    shippingQuote: ShippingQuoteOption | null = selectedShippingQuote,
    shippingAddressIdOverride?: string | null
  ) => {
    try {
      const candidateAddressId = String(shippingAddressIdOverride || selectedSavedAddressId || '').trim();
      let shippingAddressId = '';
      if (candidateAddressId && savedAddresses.some((entry) => entry.id === candidateAddressId)) {
        shippingAddressId = candidateAddressId;
      } else {
        const addressResponse = await api.customer.addAddress({
          label: 'Checkout Address',
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          country: shippingAddress.country,
          city: shippingAddress.city,
          address: [shippingAddress.addressLine1, shippingAddress.addressLine2, shippingAddress.state].filter(Boolean).join(', '),
          postalCode: shippingAddress.postalCode,
          isDefault: false,
        });

        if (!addressResponse.success || !addressResponse.data?.id) {
          throw new Error('Failed to save shipping address');
        }
        shippingAddressId = String(addressResponse.data.id);
      }

      const createdOrderNumbers: string[] = [];
      const shippingPayload = {
        shippingCostUsd: Number(shippingQuote?.priceUsd ?? shipping),
        shippingQuoteId: shippingQuote?.id || undefined,
        shippingProviderKey: shippingQuote?.providerKey || undefined,
        shippingProviderName: shippingQuote?.providerName || undefined,
        shippingServiceName: shippingQuote?.serviceName || undefined,
        shippingEtaMinDays: Number(shippingQuote?.etaMinDays ?? 0),
        shippingEtaMaxDays: Number(shippingQuote?.etaMaxDays ?? 0),
      };

      const customItems = items.filter((item) => item.kind === 'CUSTOM_DESIGN');
      const readyToWearItems = items.filter((item) => item.kind === 'READY_TO_WEAR');
      const fabricOnlyItems = items.filter((item) => item.kind === 'FABRIC_ONLY');
      const discountBudget = Math.max(0, Number(promoPreview?.discountUsd || 0));
      const customSegments = customItems.map((item, index) => ({
        key: `custom-${index}`,
        subtotal: Number(item.totalPrice || 0),
      }));
      const readySegment = {
        key: 'ready',
        subtotal: readyToWearItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 1), 0),
      };
      const fabricSegments = fabricOnlyItems.map((item, index) => ({
        key: `fabric-${index}`,
        subtotal: Number(item.pricePerYard || 0) * Number(item.yards || 1),
      }));
      const allSegments = [...customSegments, ...(readySegment.subtotal > 0 ? [readySegment] : []), ...fabricSegments];
      const totalSegmentSubtotal = allSegments.reduce((sum, entry) => sum + Number(entry.subtotal || 0), 0);
      const allocatedDiscount = new Map<string, number>();
      let remaining = discountBudget;
      allSegments.forEach((segment, index) => {
        if (remaining <= 0 || totalSegmentSubtotal <= 0) {
          allocatedDiscount.set(segment.key, 0);
          return;
        }
        if (index === allSegments.length - 1) {
          const finalAmount = Math.max(0, Math.min(segment.subtotal, remaining));
          allocatedDiscount.set(segment.key, Number(finalAmount.toFixed(2)));
          remaining = Number((remaining - finalAmount).toFixed(2));
          return;
        }
        const share = (discountBudget * segment.subtotal) / totalSegmentSubtotal;
        const amount = Math.max(0, Math.min(segment.subtotal, Number(share.toFixed(2)), remaining));
        allocatedDiscount.set(segment.key, Number(amount.toFixed(2)));
        remaining = Number((remaining - amount).toFixed(2));
      });

      for (let index = 0; index < customItems.length; index += 1) {
        const item = customItems[index];
        if (!item.designId) {
          continue;
        }
        const isDesignerDecidesFabric = item.fabricSelectionMode === 'DESIGNER_DECIDES' || !item.fabricId;

        const orderResponse = await api.orders.createCustomDesignOrder({
          designId: item.designId,
          fabricId: isDesignerDecidesFabric ? undefined : item.fabricId,
          yards: isDesignerDecidesFabric ? undefined : Number(item.fabricMeters || 1),
          fabricSelectionMode: isDesignerDecidesFabric ? 'DESIGNER_DECIDES' : 'CUSTOMER_SELECTED',
          fabricPreferenceNotes: isDesignerDecidesFabric ? item.fabricPreferenceNotes || undefined : undefined,
          measurements: item.measurements || {},
          shippingAddressId,
          paymentMethod,
          paymentIntentId,
          promoCode: promoPreview?.code || undefined,
          discountUsd: allocatedDiscount.get(`custom-${index}`) || 0,
          ...shippingPayload,
        });
        if (orderResponse.success && orderResponse.data?.orderNumber) {
          createdOrderNumbers.push(orderResponse.data.orderNumber);
        }
      }

      if (readyToWearItems.length > 0) {
        const readyOrderResponse = await api.orders.createReadyToWearOrder({
          items: readyToWearItems.map((item) => ({
            readyToWearId: item.readyToWearId,
            size: item.selectedSize,
            color: item.selectedColor || undefined,
            quantity: item.quantity,
          })),
          shippingAddressId,
          paymentMethod,
          paymentIntentId,
          promoCode: promoPreview?.code || undefined,
          discountUsd: allocatedDiscount.get('ready') || 0,
          ...shippingPayload,
        });
        if (readyOrderResponse.success && readyOrderResponse.data?.orderNumber) {
          createdOrderNumbers.push(readyOrderResponse.data.orderNumber);
        }
      }

      for (let index = 0; index < fabricOnlyItems.length; index += 1) {
        const item = fabricOnlyItems[index];
        if (!item.fabricId || Number(item.yards || 0) < 1) continue;
        const fabricOrderResponse = await api.orders.createFabricOnlyOrder({
          fabricId: item.fabricId,
          yards: Number(item.yards || 1),
          shippingAddressId,
          paymentMethod,
          paymentIntentId,
          promoCode: promoPreview?.code || undefined,
          discountUsd: allocatedDiscount.get(`fabric-${index}`) || 0,
          ...shippingPayload,
        });
        if (fabricOrderResponse.success && fabricOrderResponse.data?.orderNumber) {
          createdOrderNumbers.push(fabricOrderResponse.data.orderNumber);
        }
      }

      setOrderNumbers(createdOrderNumbers);
      clearCart();
      const orderParams = new URLSearchParams({ success: 'true' });
      if (createdOrderNumbers.length > 0) {
        orderParams.set('orders', createdOrderNumbers.join(','));
      }
      navigate(`/orders?${orderParams.toString()}`);
    } catch (err) {
      console.error('Failed to create orders:', err);
      setError('Payment succeeded but order creation failed. Please contact support.');
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const providerKey = String(searchParams.get('payment_provider') || '').toUpperCase();
    if (!providerKey) return;
    const wasCancelled = searchParams.get('payment_cancelled') === 'true';
    if (wasCancelled) {
      setError('Payment was cancelled before completion. You can try again.');
      sessionStorage.removeItem('checkout_pending_payment');
      return;
    }
    const pendingRaw = sessionStorage.getItem('checkout_pending_payment');
    if (!pendingRaw) return;
    let pending: any = null;
    try {
      pending = JSON.parse(pendingRaw);
    } catch {
      sessionStorage.removeItem('checkout_pending_payment');
      return;
    }
    if (!pending || String(pending.providerKey || '').toUpperCase() !== providerKey) return;
    const reference =
      providerKey === 'FLUTTERWAVE'
        ? searchParams.get('tx_ref') || searchParams.get('transaction_id') || pending.reference
        : searchParams.get('token') || pending.reference;
    if (!reference) {
      setError('Unable to verify payment reference from the provider callback.');
      return;
    }
    if (pending.shippingAddress && typeof pending.shippingAddress === 'object') {
      setShippingAddress((prev) => ({ ...prev, ...pending.shippingAddress }));
    }
    if (pending.selectedSavedAddressId) {
      setSelectedSavedAddressId(String(pending.selectedSavedAddressId || ''));
    }
    if (pending.promoPreview && typeof pending.promoPreview === 'object') {
      setPromoPreview(pending.promoPreview as PromoPreviewResult);
    }
    if (pending.promoCode) {
      setPromoCode(String(pending.promoCode || ''));
    }
    const pendingShippingQuote =
      pending.shippingQuote && typeof pending.shippingQuote === 'object'
        ? ({
            id: String(pending.shippingQuote.id || ''),
            source: pending.shippingQuote.source === 'LOCAL' ? 'LOCAL' : 'GLOBAL',
            providerKey: String(pending.shippingQuote.providerKey || '').toUpperCase(),
            providerName: String(pending.shippingQuote.providerName || pending.shippingQuote.providerKey || 'Shipping Provider'),
            serviceName: String(pending.shippingQuote.serviceName || 'Standard'),
            etaMinDays: Number(pending.shippingQuote.etaMinDays || 0),
            etaMaxDays: Number(pending.shippingQuote.etaMaxDays || 0),
            priceUsd: Number(pending.shippingQuote.priceUsd || 0),
          } as ShippingQuoteOption)
        : null;
    if (pendingShippingQuote?.id) {
      setShippingQuotes((prev) => {
        if (prev.find((entry) => entry.id === pendingShippingQuote.id)) return prev;
        return [...prev, pendingShippingQuote];
      });
      setSelectedShippingQuoteId(pendingShippingQuote.id);
    }
    setSelectedPaymentProvider(providerKey);
    setLoading(true);
    setError(null);
    api.payments
      .verifyPayment({
        providerKey,
        reference,
        payerId: searchParams.get('PayerID') || undefined,
      })
      .then(async (verifyResponse) => {
        if (!verifyResponse.success || !verifyResponse.data?.isPaid) {
          throw new Error('Payment could not be verified as completed.');
        }
        setStep('review');
        await createOrders(
          String(verifyResponse.data.paymentReference || reference),
          providerKey,
          pendingShippingQuote,
          pending?.selectedSavedAddressId ? String(pending.selectedSavedAddressId) : undefined
        );
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || err.message || 'Unable to verify redirected payment.');
      })
      .finally(() => {
        setLoading(false);
        sessionStorage.removeItem('checkout_pending_payment');
      });
  }, []);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setError('Enter a promo code to apply.');
      return;
    }
    try {
      setPromoLoading(true);
      setError(null);
      const payloadItems = items.map((item) => {
        if (item.kind === 'READY_TO_WEAR') {
          return {
            productType: 'READY_TO_WEAR' as const,
            productId: item.readyToWearId,
            unitPrice: Number(item.unitPrice || 0),
            quantity: Number(item.quantity || 1),
          };
        }
        if (item.kind === 'FABRIC_ONLY') {
          return {
            productType: 'FABRIC' as const,
            productId: item.fabricId,
            unitPrice: Number(item.pricePerYard || 0),
            quantity: Number(item.yards || 1),
          };
        }
        return {
          productType: 'DESIGN' as const,
          productId: item.designId,
          unitPrice: Number(item.totalPrice || 0),
          quantity: 1,
        };
      });
      const preview = await api.promotions.preview({
        code: promoCode.trim().toUpperCase(),
        items: payloadItems,
        paymentProvider: selectedPaymentProvider || undefined,
        shippingProvider: selectedShippingQuote?.providerKey || undefined,
        shippingQuoteId: selectedShippingQuote?.id || undefined,
        cardFingerprint: cardPromoHint || undefined,
        country: shippingAddress.country || undefined,
        city: shippingAddress.city || undefined,
      });
      if (!preview.success || !preview.data) {
        throw new Error(preview.message || 'Promo code could not be applied.');
      }
      setPromoPreview(preview.data as PromoPreviewResult);
      setPromoCode(String((preview.data as PromoPreviewResult).code || promoCode).toUpperCase());
    } catch (promoError: any) {
      setPromoPreview(null);
      setError(promoError?.response?.data?.message || promoError?.message || 'Failed to apply promo code.');
    } finally {
      setPromoLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate('/cart')}
            className="flex items-center text-gray-600 hover:text-amber-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Cart
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        <p className="mt-2 mb-6 text-sm text-gray-500">{currentStepSummary}</p>

        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto">
          <div className="mx-auto flex min-w-[520px] items-center justify-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step === 'shipping' ? 'bg-amber-600 text-white' : 'bg-green-500 text-white'
            }`}>
              {step === 'shipping' ? '1' : <Check className="w-5 h-5" />}
            </div>
            <span className={`ml-2 text-sm font-medium ${step === 'shipping' ? 'text-amber-600' : 'text-green-600'}`}>
              Shipping
            </span>
            <div className="w-16 h-0.5 bg-gray-200 mx-4" />
            <div className={`flex items-center ${step === 'payment' ? 'text-amber-600' : step === 'review' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step === 'payment' ? 'bg-amber-600 text-white' : step === 'review' ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}>
              {step === 'review' ? <Check className="w-5 h-5" /> : '2'}
            </div>
              <span className="ml-2 text-sm font-medium">Payment</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-200 mx-4" />
            <div className={`flex items-center ${step === 'review' ? 'text-amber-600' : 'text-gray-400'}`}>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step === 'review' ? 'bg-amber-600 text-white' : 'bg-gray-200'
            }`}>
              3
            </div>
              <span className="ml-2 text-sm font-medium">Review</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {step === 'shipping' && (
              <form onSubmit={handleShippingSubmit} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-semibold">Shipping Address</h2>
                </div>
                <p className="mb-5 text-sm text-gray-500">
                  Enter delivery details exactly as they appear on your local courier records.
                </p>

                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Saved Address</label>
                  <select
                    value={selectedSavedAddressId}
                    onChange={(event) => {
                      const nextId = String(event.target.value || '');
                      setSelectedSavedAddressId(nextId);
                      if (!nextId) return;
                      const selected = savedAddresses.find((entry) => entry.id === nextId);
                      if (!selected) return;
                      setShippingAddress((prev) => ({ ...prev, ...mapSavedAddressToShipping(selected) }));
                    }}
                    className="w-full rounded-lg border px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                    disabled={savedAddressesLoading || savedAddresses.length === 0}
                  >
                    <option value="">
                      {savedAddressesLoading
                        ? 'Loading saved addresses...'
                        : savedAddresses.length > 0
                          ? 'Select saved address or continue manually'
                          : 'No saved addresses found'}
                    </option>
                    {savedAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {[address.label || 'Address', address.city, address.country].filter(Boolean).join(' • ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.fullName}
                      onChange={(e) => {
                        setSelectedSavedAddressId('');
                        setShippingAddress(prev => ({ ...prev, fullName: e.target.value }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 1 *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.addressLine1}
                      onChange={(e) => {
                        setSelectedSavedAddressId('');
                        setShippingAddress(prev => ({ ...prev, addressLine1: e.target.value }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.addressLine2}
                      onChange={(e) => {
                        setSelectedSavedAddressId('');
                        setShippingAddress(prev => ({ ...prev, addressLine2: e.target.value }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country *
                    </label>
                    <select
                      required
                      value={shippingAddress.country}
                      onChange={(e) =>
                        {
                          setSelectedSavedAddressId('');
                          setShippingAddress((prev) => ({
                            ...prev,
                            country: e.target.value,
                            state: '',
                            city: '',
                          }));
                        }
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Select country</option>
                      {countryOptions.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province *
                    </label>
                    <select
                      required
                      value={shippingAddress.state}
                      onChange={(e) =>
                        {
                          setSelectedSavedAddressId('');
                          setShippingAddress((prev) => ({
                            ...prev,
                            state: e.target.value,
                            city: '',
                          }));
                        }
                      }
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      disabled={!shippingAddress.country}
                    >
                      <option value="">{shippingAddress.country ? 'Select state/province' : 'Select country first'}</option>
                      {selectableStateOptions.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping Method {shippingQuotes.length > 0 ? '*' : ''}
                    </label>
                    {shippingQuotesLoading ? (
                      <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Loading shipping options...
                      </div>
                    ) : shippingQuotes.length > 0 ? (
                      <select
                        required
                        value={selectedShippingQuoteId}
                        onChange={(e) => setSelectedShippingQuoteId(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      >
                        {shippingQuotes.map((quote) => (
                          <option key={quote.id} value={quote.id}>
                            {quote.providerName} - {quote.serviceName} ({quote.etaMinDays}-{quote.etaMaxDays} days) - {formatFromUsd(quote.priceUsd)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        Default shipping will be applied ({fallbackShipping === 0 ? 'FREE' : formatFromUsd(fallbackShipping)}).
                      </div>
                    )}
                    {selectedShippingQuote ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Selected: {selectedShippingQuote.providerName} / {selectedShippingQuote.serviceName}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <select
                      required
                      value={shippingAddress.city}
                      onChange={(e) => {
                        setSelectedSavedAddressId('');
                        setShippingAddress(prev => ({ ...prev, city: e.target.value }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      disabled={!shippingAddress.country || !shippingAddress.state}
                    >
                      <option value="">
                        {!shippingAddress.country
                          ? 'Select country first'
                          : !shippingAddress.state
                            ? 'Select state first'
                            : 'Select city'}
                      </option>
                      {selectableCityOptions.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.postalCode}
                      onChange={(e) => {
                        setSelectedSavedAddressId('');
                        setShippingAddress(prev => ({ ...prev, postalCode: e.target.value }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Provider *
                    </label>
                    <select
                      required
                      value={selectedPaymentProvider}
                      onChange={(e) => setSelectedPaymentProvider(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      {paymentProviders.map((provider) => (
                        <option key={provider.providerKey} value={provider.providerKey}>
                          {provider.displayName} ({provider.mode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={shippingAddress.phone}
                      onChange={(e) => {
                        setSelectedSavedAddressId('');
                        setShippingAddress(prev => ({ ...prev, phone: e.target.value }));
                      }}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full mt-6"
                  disabled={loading}
                >
                  {loading
                    ? 'Processing...'
                    : selectedProvider?.checkoutType === 'REDIRECT'
                      ? `Pay with ${selectedProvider?.displayName || 'Provider'}`
                      : 'Step 2: Continue to Payment'}
                </Button>
              </form>
            )}

            {step === 'payment' && (
              <form onSubmit={handlePaymentSubmit} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-semibold">Payment Details</h2>
                </div>
                <p className="mb-4 text-sm text-gray-500">Payment method: Card ({selectedProvider?.displayName || 'Stripe'})</p>

                <div className="p-4 bg-gray-50 rounded-lg mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Secure Payment</span>
                  </div>
                  <CardElement options={cardElementOptions} className="p-3 bg-white rounded-lg border" />
                </div>

                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setStep('shipping')}
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={!stripe || loading}
                  >
                    {loading ? 'Processing...' : `Step 3: Pay ${formatFromUsd(finalTotal)}`}
                  </Button>
                </div>
              </form>
            )}

            {step === 'review' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Confirmed!</h2>
                <p className="text-gray-600 mb-4">
                  Your payment was successful. We are processing your order now.
                </p>
                {orderNumbers.length > 0 ? (
                  <p className="text-sm text-gray-700 mb-3">
                    Order No: <span className="font-semibold">{orderNumbers.join(', ')}</span>
                  </p>
                ) : null}
                <p className="text-xs text-gray-500 mb-3">
                  A confirmation email is sent when email delivery is enabled on the server.
                </p>
                <div className="animate-pulse">
                  <p className="text-sm text-gray-500">Redirecting to your orders...</p>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-4">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <img
                      src={
                        item.kind === 'READY_TO_WEAR'
                          ? item.productImage
                          : item.kind === 'FABRIC_ONLY'
                            ? item.fabricImage
                            : item.designImage
                      }
                      alt={
                        item.kind === 'READY_TO_WEAR'
                          ? item.productName
                          : item.kind === 'FABRIC_ONLY'
                            ? item.fabricName
                            : item.designName
                      }
                      className="w-16 h-20 object-cover"
                    />
                    <div className="flex-1">
                      {item.kind === 'READY_TO_WEAR' ? (
                        <>
                          <p className="font-medium text-sm text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">Size {item.selectedSize}</p>
                          <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                        </>
                      ) : item.kind === 'FABRIC_ONLY' ? (
                        <>
                          <p className="font-medium text-sm text-gray-900">{item.fabricName}</p>
                          <p className="text-xs text-gray-500">{item.sellerName}</p>
                          <p className="text-xs text-gray-500">{item.yards} yards</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-sm text-gray-900">{item.designName}</p>
                          {item.fabricSelectionMode === 'DESIGNER_DECIDES' || !item.fabricId ? (
                            <>
                              <p className="text-xs text-gray-500">Designer will select fabric</p>
                              {item.fabricPreferenceNotes ? (
                                <p className="text-xs text-gray-500 line-clamp-2">{item.fabricPreferenceNotes}</p>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-gray-500">{item.fabricName}</p>
                              <p className="text-xs text-gray-500">{item.fabricMeters} yards fabric</p>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <p className="font-medium text-sm">
                      {formatFromUsd(
                        item.kind === 'READY_TO_WEAR'
                          ? item.unitPrice * item.quantity
                          : item.kind === 'FABRIC_ONLY'
                            ? item.pricePerYard * item.yards
                          : item.totalPrice
                      )}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 py-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatFromUsd(totalPrice)}</span>
                </div>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-700">Promo Code</p>
                  <div className="flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                      placeholder="Enter promo code"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <Button type="button" variant="outline" onClick={handleApplyPromo} disabled={promoLoading}>
                      {promoLoading ? 'Applying...' : 'Apply'}
                    </Button>
                  </div>
                  <input
                    value={cardPromoHint}
                    onChange={(event) => setCardPromoHint(event.target.value)}
                    placeholder="Optional card hint (BIN/last digits)"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-xs"
                  />
                  {promoPreview ? (
                    <p className="mt-2 text-xs text-emerald-700">
                      Applied {promoPreview.code}: -{formatFromUsd(Number(promoPreview.discountUsd || 0))}
                    </p>
                  ) : null}
                </div>
                {promoDiscount > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Promo Discount</span>
                    <span className="font-medium text-emerald-700">-{formatFromUsd(promoDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Shipping
                    {selectedShippingQuote ? ` (${selectedShippingQuote.providerName})` : ''}
                  </span>
                  <span className={shipping === 0 ? 'text-green-600' : ''}>
                    {shipping === 0 ? 'FREE' : formatFromUsd(shipping)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-amber-700">
                  {formatFromUsd(finalTotal)}
                </span>
              </div>
              {selectedCurrency !== 'USD' ? (
                <p className="mt-2 text-xs text-gray-500">Payments are currently settled in USD at checkout.</p>
              ) : null}
            </div>

            {/* Delivery Info */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center gap-3 mb-4">
                <Truck className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold">Delivery Information</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">1</Badge>
                  <div>
                    <p className="font-medium">Design Phase</p>
                    <p className="text-gray-500">3-5 business days</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">2</Badge>
                  <div>
                    <p className="font-medium">Fabric Preparation</p>
                    <p className="text-gray-500">1-2 business days</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">3</Badge>
                  <div>
                    <p className="font-medium">Production & QA</p>
                    <p className="text-gray-500">7-14 business days</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-0.5">4</Badge>
                  <div>
                    <p className="font-medium">Shipping</p>
                    <p className="text-gray-500">
                      {selectedShippingQuote
                        ? `${selectedShippingQuote.etaMinDays}-${selectedShippingQuote.etaMaxDays} business days`
                        : '5-10 business days'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Estimated delivery: {new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString()} -{' '}
                {new Date(
                  Date.now() +
                    ((selectedShippingQuote?.etaMaxDays || 10) + 21) * 24 * 60 * 60 * 1000
                ).toLocaleDateString()}
              </p>
            </div>

            {suggestedProducts.length > 0 ? (
              <div className="bg-white rounded-xl p-6 shadow-sm border">
                <h3 className="font-semibold mb-3">You may also like</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Suggestions are optional and will not interrupt your current checkout.
                </p>
                <div className="space-y-3">
                  {suggestedProducts.map((product) => (
                    <Link
                      key={product.id}
                      to={product.href}
                      className="flex items-center gap-3 rounded-lg border p-2 hover:bg-gray-50"
                    >
                      <img
                        src={product.image || '/images/placeholder.jpg'}
                        alt={product.name}
                        className="h-14 w-12 object-cover rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 truncate">{product.subtitle}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
