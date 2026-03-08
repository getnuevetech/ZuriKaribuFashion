import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Percent,
  DollarSign,
  Calendar,
  Tag,
  Globe
} from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface PricingRule {
  id: string;
  name: string;
  type: 'MARKUP' | 'MARKDOWN';
  targetType: 'PRODUCT_TYPE' | 'COUNTRY' | 'DATE_RANGE';
  targetValue: string;
  percentage: number;
  fixedAmount?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export default function AdminPricingRules() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'MARKUP' as 'MARKUP' | 'MARKDOWN',
    targetType: 'PRODUCT_TYPE' as 'PRODUCT_TYPE' | 'COUNTRY' | 'DATE_RANGE',
    targetValue: '',
    percentage: 0,
    fixedAmount: 0,
    startDate: '',
    endDate: '',
    isActive: true,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getPricingRules();
      if (response.success) {
        const mapped = (response.data || []).map((item: any): PricingRule => {
          const targetType: PricingRule['targetType'] =
            item.ruleType === 'COUNTRY_MARKUP'
              ? 'COUNTRY'
              : item.ruleType === 'DATE_BASED'
                ? 'DATE_RANGE'
                : 'PRODUCT_TYPE';
          const type: PricingRule['type'] =
            item.adjustmentType === 'PERCENTAGE_DISCOUNT' || item.adjustmentType === 'FIXED_DISCOUNT'
              ? 'MARKDOWN'
              : 'MARKUP';
          return {
            id: item.id,
            name: item.name,
            type,
            targetType,
            targetValue:
              targetType === 'PRODUCT_TYPE'
                ? item.productType || ''
                : targetType === 'COUNTRY'
                  ? item.country || ''
                  : item.description || '',
            percentage:
              item.adjustmentType === 'PERCENTAGE_MARKUP' || item.adjustmentType === 'PERCENTAGE_DISCOUNT'
                ? Number(item.value || 0)
                : 0,
            fixedAmount:
              item.adjustmentType === 'FIXED_MARKUP' || item.adjustmentType === 'FIXED_DISCOUNT'
                ? Number(item.value || 0)
                : 0,
            startDate: item.startDate || undefined,
            endDate: item.endDate || undefined,
            isActive: Boolean(item.isActive),
          };
        });
        setRules(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch pricing rules:', error);
      setError('Failed to fetch pricing rules.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const numericPercentage = Number(formData.percentage) || 0;
      const numericFixedAmount = Number(formData.fixedAmount) || 0;
      const chosenValue = numericFixedAmount > 0 ? numericFixedAmount : numericPercentage;
      if (chosenValue <= 0) {
        setError('Enter a positive percentage or fixed amount.');
        return;
      }
      if (
        formData.targetType === 'DATE_RANGE' &&
        formData.startDate &&
        formData.endDate &&
        new Date(formData.startDate).getTime() > new Date(formData.endDate).getTime()
      ) {
        setError('End date must be on or after start date.');
        return;
      }
      const adjustmentType =
        numericFixedAmount > 0
          ? formData.type === 'MARKDOWN'
            ? 'FIXED_DISCOUNT'
            : 'FIXED_MARKUP'
          : formData.type === 'MARKDOWN'
            ? 'PERCENTAGE_DISCOUNT'
            : 'PERCENTAGE_MARKUP';
      const payload = {
        name: formData.name,
        description: formData.targetType === 'DATE_RANGE' ? formData.targetValue || formData.name : undefined,
        ruleType:
          formData.targetType === 'COUNTRY'
            ? 'COUNTRY_MARKUP'
            : formData.targetType === 'DATE_RANGE'
              ? 'DATE_BASED'
              : 'CATEGORY_MARKUP',
        productType: formData.targetType === 'PRODUCT_TYPE' ? formData.targetValue || undefined : undefined,
        country: formData.targetType === 'COUNTRY' ? formData.targetValue || undefined : undefined,
        startDate:
          formData.targetType === 'DATE_RANGE' && formData.startDate
            ? new Date(`${formData.startDate}T00:00:00.000Z`).toISOString()
            : undefined,
        endDate:
          formData.targetType === 'DATE_RANGE' && formData.endDate
            ? new Date(`${formData.endDate}T23:59:59.000Z`).toISOString()
            : undefined,
        isSale: formData.type === 'MARKDOWN',
        adjustmentType,
        value: chosenValue,
        priority: 0,
        isActive: formData.isActive,
      };
      if (editingRule) {
        await api.admin.updatePricingRule(editingRule.id, payload);
      } else {
        await api.admin.createPricingRule(payload);
      }
      setShowForm(false);
      setEditingRule(null);
      resetForm();
      setSuccess(editingRule ? 'Pricing rule updated successfully.' : 'Pricing rule created successfully.');
      fetchRules();
    } catch (error) {
      console.error('Failed to save pricing rule:', error);
      setError('Failed to save pricing rule.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    try {
      await api.admin.deletePricingRule(id);
      setSuccess('Pricing rule deleted successfully.');
      fetchRules();
    } catch (error) {
      console.error('Failed to delete pricing rule:', error);
      setError('Failed to delete pricing rule.');
    }
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      targetType: rule.targetType,
      targetValue: rule.targetValue,
      percentage: rule.percentage,
      fixedAmount: rule.fixedAmount || 0,
      startDate: rule.startDate ? String(rule.startDate).slice(0, 10) : '',
      endDate: rule.endDate ? String(rule.endDate).slice(0, 10) : '',
      isActive: rule.isActive,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'MARKUP',
      targetType: 'PRODUCT_TYPE',
      targetValue: '',
      percentage: 0,
      fixedAmount: 0,
      startDate: '',
      endDate: '',
      isActive: true,
    });
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'PRODUCT_TYPE': return <Tag className="w-4 h-4" />;
      case 'COUNTRY': return <Globe className="w-4 h-4" />;
      case 'DATE_RANGE': return <Calendar className="w-4 h-4" />;
      default: return <Tag className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Rules</h1>
          <p className="text-gray-500 mt-1">Manage dynamic pricing for products and regions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>
      {(error || success) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingRule ? 'Edit Pricing Rule' : 'Add New Pricing Rule'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Summer Sale 2024"
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'MARKUP' | 'MARKDOWN' })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="MARKUP">Markup (+)</option>
                  <option value="MARKDOWN">Markdown (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Type *
                </label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value as any })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="PRODUCT_TYPE">Product Type</option>
                  <option value="COUNTRY">Country</option>
                  <option value="DATE_RANGE">Date Range</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Value *
                </label>
                {formData.targetType === 'PRODUCT_TYPE' ? (
                  <select
                    value={formData.targetValue}
                    onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select product type</option>
                    <option value="FABRIC">Fabric</option>
                    <option value="DESIGN">Design</option>
                    <option value="READY_TO_WEAR">Ready to Wear</option>
                  </select>
                ) : formData.targetType === 'COUNTRY' ? (
                  <select
                    value={formData.targetValue}
                    onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select country</option>
                    <option value="NG">Nigeria</option>
                    <option value="GH">Ghana</option>
                    <option value="KE">Kenya</option>
                    <option value="ZA">South Africa</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.targetValue}
                    onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                    placeholder="Enter description"
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Percentage (%)
                </label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: Number(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fixed Amount ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fixedAmount}
                    onChange={(e) => setFormData({ ...formData, fixedAmount: Number(e.target.value) || 0 })}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              {formData.targetType === 'DATE_RANGE' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit">
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => { setShowForm(false); setEditingRule(null); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Rule</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Target</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Adjustment</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{rule.name}</p>
                    {rule.startDate && (
                      <p className="text-xs text-gray-500">
                        {new Date(rule.startDate).toLocaleDateString()} - {rule.endDate ? new Date(rule.endDate).toLocaleDateString() : 'Ongoing'}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={rule.type === 'MARKUP' ? 'green' : 'red'}>
                      {rule.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {getTargetIcon(rule.targetType)}
                      <span className="text-sm">{rule.targetValue}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {rule.percentage > 0 && (
                      <span className="font-medium">{rule.percentage}%</span>
                    )}
                    {rule.fixedAmount && rule.fixedAmount > 0 && (
                      <span className="font-medium ml-2">${rule.fixedAmount}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={rule.isActive ? 'green' : 'gray'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rules.length === 0 && (
          <div className="text-center py-16">
            <Percent className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pricing rules</h3>
            <p className="text-gray-500 mb-4">Create your first pricing rule to get started.</p>
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
