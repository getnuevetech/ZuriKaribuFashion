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

export default function Checkout() {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuthStore();
  const { items, totalPrice, clearCart } = useCartStore();
  
  const [step, setStep] = useState<'shipping' | 'payment' | 'review'>('shipping');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<any[]>([]);
  const [paymentMethod] = useState<'STRIPE'>('STRIPE');
  
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

  const shipping = totalPrice > 200 ? 0 : 25;
  const finalTotal = totalPrice + shipping;
  const currentStepSummary =
    step === 'shipping'
      ? 'Step 1 of 3: Shipping details'
      : step === 'payment'
        ? 'Step 2 of 3: Secure payment'
        : 'Step 3 of 3: Confirmation';

  useEffect(() => {
    api.products
      .getReadyToWear({ limit: 4 })
      .then((response) => {
        if (response.success) {
          setSuggestedProducts(Array.isArray(response.data?.products) ? response.data.products : []);
        }
      })
      .catch(() => {
        setSuggestedProducts([]);
      });
  }, []);

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create payment intent
      const response = await api.payments.createPaymentIntent({
        amount: Math.round(finalTotal * 100), // Convert to cents
        currency: 'usd',
      });

      if (response.success) {
        setClientSecret(response.data.clientSecret);
        setStep('payment');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment');
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
      await createOrders(paymentIntent.id);
    }

    setLoading(false);
  };

  const createOrders = async (paymentIntentId: string) => {
    try {
      const addressResponse = await api.customer.addAddress({
        label: 'Checkout Address',
        fullName: shippingAddress.fullName,
        phone: shippingAddress.phone,
        country: shippingAddress.country,
        city: shippingAddress.city,
        address: [shippingAddress.addressLine1, shippingAddress.addressLine2].filter(Boolean).join(', '),
        postalCode: shippingAddress.postalCode,
        isDefault: false,
      });

      if (!addressResponse.success || !addressResponse.data?.id) {
        throw new Error('Failed to save shipping address');
      }

      const shippingAddressId = addressResponse.data.id;
      const createdOrderNumbers: string[] = [];

      const customItems = items.filter((item) => item.kind === 'CUSTOM_DESIGN');
      const readyToWearItems = items.filter((item) => item.kind === 'READY_TO_WEAR');

      for (const item of customItems) {
        if (!item.designId || !item.fabricId) {
          continue;
        }

        const orderResponse = await api.orders.createCustomDesignOrder({
          designId: item.designId,
          fabricId: item.fabricId,
          yards: item.fabricMeters,
          measurements: item.measurements || {},
          shippingAddressId,
          paymentMethod,
          paymentIntentId,
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
            quantity: item.quantity,
          })),
          shippingAddressId,
          paymentMethod,
          paymentIntentId,
        });
        if (readyOrderResponse.success && readyOrderResponse.data?.orderNumber) {
          createdOrderNumbers.push(readyOrderResponse.data.orderNumber);
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.fullName}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, fullName: e.target.value }))}
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
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, addressLine1: e.target.value }))}
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
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, addressLine2: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.state}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={shippingAddress.postalCode}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, postalCode: e.target.value }))}
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
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    >
                      <option value="">Select country</option>
                      <option value="US">United States</option>
                      <option value="NG">Nigeria</option>
                      <option value="GH">Ghana</option>
                      <option value="KE">Kenya</option>
                      <option value="ZA">South Africa</option>
                      <option value="GB">United Kingdom</option>
                      <option value="CA">Canada</option>
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
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full mt-6"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Step 2: Continue to Payment'}
                </Button>
              </form>
            )}

            {step === 'payment' && (
              <form onSubmit={handlePaymentSubmit} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-semibold">Payment Details</h2>
                </div>
                <p className="mb-4 text-sm text-gray-500">Payment method: Card (Stripe)</p>

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
                    {loading ? 'Processing...' : `Step 3: Pay $${finalTotal.toFixed(2)}`}
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
                      src={item.kind === 'READY_TO_WEAR' ? item.productImage : item.designImage}
                      alt={item.kind === 'READY_TO_WEAR' ? item.productName : item.designName}
                      className="w-16 h-20 object-cover"
                    />
                    <div className="flex-1">
                      {item.kind === 'READY_TO_WEAR' ? (
                        <>
                          <p className="font-medium text-sm text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">Size {item.selectedSize}</p>
                          <p className="text-xs text-gray-500">Qty {item.quantity}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-sm text-gray-900">{item.designName}</p>
                          <p className="text-xs text-gray-500">{item.fabricName}</p>
                          <p className="text-xs text-gray-500">{item.fabricMeters}m fabric</p>
                        </>
                      )}
                    </div>
                    <p className="font-medium text-sm">
                      $
                      {(
                        item.kind === 'READY_TO_WEAR'
                          ? item.unitPrice * item.quantity
                          : item.totalPrice
                      ).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 py-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className={shipping === 0 ? 'text-green-600' : ''}>
                    {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-amber-700">
                  ${finalTotal.toFixed(2)}
                </span>
              </div>
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
                    <p className="text-gray-500">5-10 business days</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Estimated delivery: {new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString()} - {new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toLocaleDateString()}
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
                      to={`/ready-to-wear/${product.id}`}
                      className="flex items-center gap-3 rounded-lg border p-2 hover:bg-gray-50"
                    >
                      <img
                        src={product.images?.[0]?.url || '/images/placeholder.jpg'}
                        alt={product.name}
                        className="h-14 w-12 object-cover rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 truncate">{product.category?.name || 'Ready to Wear'}</p>
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
