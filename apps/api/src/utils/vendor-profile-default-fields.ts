export type VendorProfileFieldTemplate = {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  options?: string[];
  sortOrder: number;
  isActive: boolean;
};

const sellerDefaults: VendorProfileFieldTemplate[] = [
  {
    key: 'brand_name',
    label: 'Brand Name',
    fieldType: 'TEXT',
    required: true,
    placeholder: 'Enter your brand or business name',
    helpText: 'This name is shown to customers on your storefront.',
    options: [],
    sortOrder: 1,
    isActive: true,
  },
  {
    key: 'business_email',
    label: 'Business Email',
    fieldType: 'EMAIL',
    required: true,
    placeholder: 'name@business.com',
    helpText: 'Used for order and compliance communication.',
    options: [],
    sortOrder: 2,
    isActive: true,
  },
  {
    key: 'business_phone',
    label: 'Business Phone',
    fieldType: 'PHONE',
    required: true,
    placeholder: 'Enter business phone number',
    helpText: 'Include country code.',
    options: [],
    sortOrder: 3,
    isActive: true,
  },
  {
    key: 'country',
    label: 'Country',
    fieldType: 'SELECT',
    required: true,
    placeholder: null,
    helpText: 'Primary operating country.',
    options: [],
    sortOrder: 4,
    isActive: true,
  },
  {
    key: 'city',
    label: 'City',
    fieldType: 'SELECT',
    required: true,
    placeholder: null,
    helpText: 'City where your operations are based.',
    options: [],
    sortOrder: 5,
    isActive: true,
  },
  {
    key: 'address',
    label: 'Business Address',
    fieldType: 'TEXTAREA',
    required: true,
    placeholder: 'Enter your full business address',
    helpText: null,
    options: [],
    sortOrder: 6,
    isActive: true,
  },
  {
    key: 'website',
    label: 'Website / Social Link',
    fieldType: 'URL',
    required: false,
    placeholder: 'https://',
    helpText: 'Optional public link for your brand.',
    options: [],
    sortOrder: 7,
    isActive: true,
  },
];

const designerDefaults: VendorProfileFieldTemplate[] = [
  ...sellerDefaults.map((field) =>
    field.key === 'website'
      ? { ...field, sortOrder: 8 }
      : field
  ),
  {
    key: 'bio',
    label: 'Designer Bio',
    fieldType: 'TEXTAREA',
    required: false,
    placeholder: 'Tell customers about your design style and experience',
    helpText: null,
    options: [],
    sortOrder: 7,
    isActive: true,
  },
];

export const getDefaultVendorProfileFields = (role: 'FABRIC_SELLER' | 'FASHION_DESIGNER') =>
  (role === 'FABRIC_SELLER' ? sellerDefaults : designerDefaults).map((field) => ({
    ...field,
    options: Array.isArray(field.options) ? [...field.options] : [],
  }));

