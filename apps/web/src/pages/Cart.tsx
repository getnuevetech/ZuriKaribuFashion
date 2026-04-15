import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  ChevronLeft, 
  Minus, 
  Plus, 
  ShoppingBag,
  MapPin,
  Truck,
  Shield
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { api } from '../services/api';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

type CartPromoPreview = {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  discountUsd: number;
};

const toMoney = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const normalizePromoPreview = (raw: any, requestedCode: string, subtotalUsd: number): CartPromoPreview => {
  const code = String(raw?.code || raw?.promoCode || requestedCode || '')
    .trim()
    .toUpperCase();
  const discountTypeRaw = String(raw?.discountType || raw?.type || 'PERCENTAGE')
    .trim()
    .toUpperCase();
  const discountType = discountTypeRaw === 'FIXED' || discountTypeRaw === 'AMOUNT' ? 'FIXED' : 'PERCENTAGE';
  const discountValue = Math.max(
    0,
    toMoney(
      discountType === 'FIXED'
        ? raw?.discountValue ?? raw?.fixedAmount ?? raw?.amountOff ?? raw?.value
        : raw?.discountValue ?? raw?.discountPercent ?? raw?.percentage ?? raw?.percentOff ?? raw?.value
    )
  );
  const directDiscount = toMoney(raw?.discountUsd ?? raw?.discount ?? raw?.discountAmountUsd ?? raw?.amountOffUsd);
  const eligibleSubtotal = Math.max(
    0,
    toMoney(raw?.eligibleSubtotalUsd ?? raw?.eligibleSubtotal ?? raw?.subtotalUsd ?? raw?.subtotal ?? subtotalUsd)
  );
  const computedDiscount = discountType === 'FIXED' ? discountValue : (eligibleSubtotal * discountValue) / 100;
  const discountUsd = Math.max(0, Math.min(eligibleSubtotal, toMoney(directDiscount > 0 ? directDiscount : computedDiscount)));
  return { code, discountType, discountValue, discountUsd };
};

export default function Cart() {
  const navigate = useNavigate();
  const { items, removeItem, updateItem, clearCart, totalPrice, itemCount } = useCartStore();
  const { formatFromUsd } = useCurrencyStore();
  const [promoCode, setPromoCode] = useState('');
  const [promoPreview, setPromoPreview] = useState<CartPromoPreview | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');

  const resolveCartItemPath = (item: any) => {
    if (item.kind === 'READY_TO_WEAR' && item.readyToWearId) return `/ready-to-wear/${item.readyToWearId}`;
    if (item.kind === 'FABRIC_ONLY' && item.fabricId) return `/fabrics/${item.fabricId}`;
    if (item.kind === 'CUSTOM_DESIGN' && item.designId) return `/custom/${item.designId}`;
    return '';
  };

  const handleApplyPromo = async () => {
    const requestedCode = String(promoCode || '').trim().toUpperCase();
    if (!requestedCode) return;
    try {
      setPromoLoading(true);
      setPromoMessage('');
      const payloadItems = items
        .map((item) => {
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
        })
        .filter((entry) => String(entry.productId || '').trim().length > 0);

      const response = await api.promotions.preview({
        code: requestedCode,
        items: payloadItems,
      });
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Promo code could not be validated.');
      }
      const normalized = normalizePromoPreview(response.data, requestedCode, Number(totalPrice || 0));
      if (
        String(normalized.code || '').toUpperCase() !== requestedCode ||
        Number(normalized.discountUsd || 0) <= 0 ||
        Number(normalized.discountValue || 0) <= 0
      ) {
        throw new Error('Promo response is invalid for this code. Please verify backend promo routes and code setup.');
      }
      setPromoPreview(normalized);
      setPromoCode(normalized.code);
      setPromoMessage(
        normalized.discountType === 'PERCENTAGE'
          ? `${normalized.discountValue}% discount applied.`
          : `${formatFromUsd(normalized.discountValue)} fixed discount applied.`
      );
    } catch (error: any) {
      setPromoPreview(null);
      setPromoMessage(String(error?.response?.data?.message || error?.message || 'Failed to apply promo code.'));
    } finally {
      setPromoLoading(false);
    }
  };

  const discount = Math.max(0, Math.min(Number(totalPrice || 0), Number(promoPreview?.discountUsd || 0)));
  const shipping = totalPrice > 200 ? 0 : 25;
  const finalTotal = totalPrice - discount + shipping;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Cart is Empty</h2>
          <p className="text-gray-600 mb-6">Your shopping bag is empty. Start with Ready-to-Wear, Fabrics, or Custom-to-Wear.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => navigate('/ready-to-wear')}>Shop Ready To Wear</Button>
            <Button variant="outline" onClick={() => navigate('/fabrics')}>
              Shop Fabrics
            </Button>
            <Button variant="outline" onClick={() => navigate('/custom')}>
              Shop Custom To Wear
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate('/ready-to-wear')}
            className="flex items-center text-gray-600 hover:text-[#e85a3d] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Continue Shopping
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
        <p className="text-sm text-gray-500 mb-6">Step 1 of 3: Review your items and continue to checkout.</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, index) => {
              const productPath = resolveCartItemPath(item);
              return (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex gap-4">
                  {/* Images */}
                  <button
                    type="button"
                    onClick={() => productPath && navigate(productPath)}
                    disabled={!productPath}
                    className="flex-shrink-0 relative text-left disabled:cursor-default"
                    title={productPath ? 'View product details' : undefined}
                  >
                    {item.kind === 'READY_TO_WEAR' ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-24 h-32 object-cover rounded-lg"
                      />
                    ) : item.kind === 'FABRIC_ONLY' ? (
                      <img
                        src={item.fabricImage}
                        alt={item.fabricName}
                        className="w-24 h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <>
                        <img
                          src={item.designImage}
                          alt={item.designName}
                          className="w-24 h-32 object-cover rounded-lg"
                        />
                        {item.fabricSelectionMode !== 'DESIGNER_DECIDES' && item.fabricImage ? (
                          <img
                            src={item.fabricImage}
                            alt={item.fabricName || 'Selected fabric'}
                            className="w-12 h-16 object-cover absolute -bottom-2 -right-2 border-2 border-white shadow-md"
                          />
                        ) : null}
                      </>
                    )}
                  </button>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        {productPath ? (
                          <button
                            type="button"
                            onClick={() => navigate(productPath)}
                            className="text-left font-semibold text-gray-900 hover:underline"
                            title="View product details"
                          >
                            {item.kind === 'READY_TO_WEAR'
                              ? item.productName
                              : item.kind === 'FABRIC_ONLY'
                                ? item.fabricName
                                : item.designName}
                          </button>
                        ) : (
                          <h3 className="font-semibold text-gray-900">
                            {item.kind === 'READY_TO_WEAR'
                              ? item.productName
                              : item.kind === 'FABRIC_ONLY'
                                ? item.fabricName
                                : item.designName}
                          </h3>
                        )}
                        <p className="text-sm text-gray-500">
                          by {item.kind === 'FABRIC_ONLY' ? item.sellerName : item.designerName}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.kind === 'READY_TO_WEAR' ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">Ready To Wear</Badge>
                          <span className="text-gray-600">Size {item.selectedSize}</span>
                          {item.selectedColor ? (
                            <>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-600">Color {item.selectedColor}</span>
                            </>
                          ) : null}
                        </div>
                      ) : item.kind === 'FABRIC_ONLY' ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">Fabric To Buy</Badge>
                          <span className="text-gray-600">{item.yards} yards</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">
                              {item.fabricSelectionMode === 'DESIGNER_DECIDES' ? 'Designer Chooses Fabric' : 'Fabric'}
                            </Badge>
                            {item.fabricSelectionMode === 'DESIGNER_DECIDES' ? (
                              <span className="text-gray-600">
                                {item.fabricPreferenceNotes || 'No preference note added'}
                              </span>
                            ) : (
                              <>
                                <span className="text-gray-600">{item.fabricName}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-600">{item.fabricMeters} meters</span>
                              </>
                            )}
                          </div>

                          {Object.keys(item.measurements).length > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-xs">Measurements</Badge>
                              <span className="text-gray-600">
                                {Object.entries(item.measurements)
                                  .slice(0, 3)
                                  .map(([k, v]) => `${k}: ${v}cm`)
                                  .join(', ')}
                                {Object.keys(item.measurements).length > 3 && '...'}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex justify-between items-end mt-4">
                      <div className="flex items-center gap-3">
                        {item.kind === 'READY_TO_WEAR' ? (
                          <>
                            <button
                              onClick={() =>
                                updateItem(index, {
                                  quantity: Math.max(1, item.quantity - 1),
                                } as any)
                              }
                              className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-medium w-12 text-center">{item.quantity}</span>
                            <button
                              onClick={() =>
                                updateItem(index, {
                                  quantity: item.quantity + 1,
                                } as any)
                              }
                              className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </>
                        ) : item.kind === 'FABRIC_ONLY' ? (
                          <>
                            <button
                              onClick={() =>
                                updateItem(index, {
                                  yards: Math.max(1, item.yards - 1),
                                } as any)
                              }
                              className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-medium w-12 text-center">{item.yards}yd</span>
                            <button
                              onClick={() =>
                                updateItem(index, {
                                  yards: item.yards + 1,
                                } as any)
                              }
                              className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {item.fabricSelectionMode === 'DESIGNER_DECIDES' ? (
                              <span className="text-xs text-gray-500">Fabric will be chosen by designer</span>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    updateItem(index, {
                                      fabricMeters: Math.max(1, Number(item.fabricMeters || 1) - 0.5),
                                    } as any)
                                  }
                                  className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="font-medium w-12 text-center">{item.fabricMeters}m</span>
                                <button
                                  onClick={() =>
                                    updateItem(index, {
                                      fabricMeters: Number(item.fabricMeters || 1) + 0.5,
                                    } as any)
                                  }
                                  className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#e85a3d]">
                          {formatFromUsd(
                            item.kind === 'READY_TO_WEAR'
                              ? item.unitPrice * item.quantity
                              : item.kind === 'FABRIC_ONLY'
                                ? item.pricePerYard * item.yards
                              : item.totalPrice
                          )}
                        </p>
                        {item.kind === 'READY_TO_WEAR' ? (
                          <p className="text-xs text-gray-500">
                            {formatFromUsd(item.unitPrice)} × {item.quantity}
                          </p>
                        ) : item.kind === 'FABRIC_ONLY' ? (
                          <p className="text-xs text-gray-500">
                            {formatFromUsd(item.pricePerYard)} × {item.yards} yards
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            {item.fabricSelectionMode === 'DESIGNER_DECIDES' || !item.fabricId
                              ? `${formatFromUsd(item.basePrice)} (designer will finalize fabric)`
                              : `${formatFromUsd(item.basePrice)} + ${formatFromUsd(Number(item.fabricPrice || 0) * Number(item.fabricMeters || 0))}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )})}

            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Clear Cart
            </button>
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              {/* Promo Code */}
              <div className="mb-4">
                <label className="text-sm text-gray-600 mb-1 block">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => {
                      const nextCode = String(e.target.value || '').toUpperCase();
                      setPromoCode(nextCode);
                      if (promoPreview && String(promoPreview.code || '').toUpperCase() !== nextCode.trim()) {
                        setPromoPreview(null);
                      }
                    }}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || promoLoading}
                  >
                    {promoLoading ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
                {promoMessage ? (
                  <p className={`text-sm mt-1 ${promoPreview ? 'text-green-600' : 'text-red-600'}`}>{promoMessage}</p>
                ) : null}
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2 py-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal ({itemCount} items)</span>
                  <span className="font-medium">{formatFromUsd(totalPrice)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>
                      Discount
                      {promoPreview?.discountType === 'PERCENTAGE'
                        ? ` (${promoPreview.discountValue}%)`
                        : promoPreview?.code
                          ? ` (${promoPreview.code})`
                          : ''}
                    </span>
                    <span>-{formatFromUsd(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className={shipping === 0 ? 'text-green-600' : ''}>
                    {shipping === 0 ? 'FREE' : formatFromUsd(shipping)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-[#e85a3d]">
                  {formatFromUsd(finalTotal)}
                </span>
              </div>

              <Button 
                className="w-full mt-6 bg-[#e85a3d] text-white hover:bg-[#d14a2d]"
                onClick={() => navigate('/checkout')}
              >
                Step 2: Continue to Checkout
              </Button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Shipping & taxes calculated at checkout
              </p>
            </div>

            {/* Trust Badges */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-[#e85a3d]" />
                  <div>
                    <p className="font-medium text-sm">Free Shipping</p>
                    <p className="text-xs text-gray-500">On orders over {formatFromUsd(200)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-[#e85a3d]" />
                  <div>
                    <p className="font-medium text-sm">Secure Payment</p>
                    <p className="text-xs text-gray-500">256-bit SSL encryption</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-[#e85a3d]" />
                  <div>
                    <p className="font-medium text-sm">Local Production</p>
                    <p className="text-xs text-gray-500">Made in your designer's country</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-3 shadow-lg backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-[#e85a3d]">{formatFromUsd(finalTotal)}</p>
          </div>
          <Button className="flex-1 bg-[#e85a3d] text-xs text-white hover:bg-[#d14a2d]" onClick={() => navigate('/checkout')}>
            Continue to Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
