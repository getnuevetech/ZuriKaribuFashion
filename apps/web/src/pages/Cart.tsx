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
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function Cart() {
  const navigate = useNavigate();
  const { items, removeItem, updateItem, clearCart, totalPrice, itemCount } = useCartStore();
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  const handleApplyPromo = () => {
    if (promoCode.trim()) {
      setPromoApplied(true);
    }
  };

  const discount = promoApplied ? totalPrice * 0.1 : 0;
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
          <p className="text-gray-600 mb-6">Discover beautiful African designs and add them to your cart.</p>
          <Button onClick={() => navigate('/ready-to-wear')}>
            Browse Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate('/ready-to-wear')}
            className="flex items-center text-gray-600 hover:text-amber-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Continue Shopping
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex gap-4">
                  {/* Images */}
                  <div className="flex-shrink-0 relative">
                    {item.kind === 'READY_TO_WEAR' ? (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-24 h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <>
                        <img
                          src={item.designImage}
                          alt={item.designName}
                          className="w-24 h-32 object-cover rounded-lg"
                        />
                        <img
                          src={item.fabricImage}
                          alt={item.fabricName}
                          className="w-12 h-16 object-cover absolute -bottom-2 -right-2 border-2 border-white shadow-md"
                        />
                      </>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {item.kind === 'READY_TO_WEAR' ? item.productName : item.designName}
                        </h3>
                        <p className="text-sm text-gray-500">by {item.designerName}</p>
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
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs">Fabric</Badge>
                            <span className="text-gray-600">{item.fabricName}</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-600">{item.fabricMeters} meters</span>
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
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                updateItem(index, {
                                  fabricMeters: Math.max(1, item.fabricMeters - 0.5),
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
                                  fabricMeters: item.fabricMeters + 0.5,
                                } as any)
                              }
                              className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-700">
                          $
                          {(
                            item.kind === 'READY_TO_WEAR'
                              ? item.unitPrice * item.quantity
                              : item.totalPrice
                          ).toFixed(2)}
                        </p>
                        {item.kind === 'READY_TO_WEAR' ? (
                          <p className="text-xs text-gray-500">
                            ${item.unitPrice.toFixed(2)} × {item.quantity}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            ${item.basePrice} + ${(item.fabricPrice * item.fabricMeters).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

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
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || promoApplied}
                  >
                    Apply
                  </Button>
                </div>
                {promoApplied && (
                  <p className="text-sm text-green-600 mt-1">10% discount applied!</p>
                )}
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2 py-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal ({itemCount} items)</span>
                  <span className="font-medium">${totalPrice.toFixed(2)}</span>
                </div>
                {promoApplied && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount (10%)</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
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

              <Button 
                className="w-full mt-6"
                onClick={() => navigate('/checkout')}
              >
                Proceed to Checkout
              </Button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Shipping & taxes calculated at checkout
              </p>
            </div>

            {/* Trust Badges */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-sm">Free Shipping</p>
                    <p className="text-xs text-gray-500">On orders over $200</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-sm">Secure Payment</p>
                    <p className="text-xs text-gray-500">256-bit SSL encryption</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-amber-600" />
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
    </div>
  );
}
