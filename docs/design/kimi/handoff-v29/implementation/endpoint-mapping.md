# Endpoint Mapping Table

## Field-Level Source Definitions (Endpoint-Agnostic)

Our contracts use field-level source definitions that are backend-agnostic. Map these to your existing endpoints.

## Category Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `name` | `name` or `title` | `/api/categories` or `/api/taxonomies/categories` | Category display name |
| `slug` | `slug` or `url_key` | Same as above | URL-safe identifier |
| `productCount` | `product_count` or `count` | Same as above | Number of products |
| `href` | Generated from slug | N/A | Frontend constructs: `/ready-to-wear/{slug}` |

## Country Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `name` | Static data | N/A | Hardcoded in frontend (54 countries) |
| `code` | Static data | N/A | ISO 2-letter code |
| `flag` | Static data | N/A | Emoji flag |
| `region` | Static data | N/A | Geographic region |
| `productCount` | `count` or `product_count` | `/api/countries/{code}/products/count` | Dynamic per country |
| `href` | Generated from name | N/A | Frontend constructs: `/country/{slug}` |

**Note:** Country data (name, code, flag, region) is STATIC and hardcoded. Only `productCount` requires backend.

## Occasion Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `name` | `name` or `title` | `/api/tags?type=occasion` or `/api/taxonomies/occasions` | Occasion display name |
| `slug` | `slug` or `url_key` | Same as above | URL-safe identifier |
| `productCount` | `product_count` or `count` | Same as above | Number of products |
| `href` | Generated from slug | N/A | Frontend constructs: `/occasion/{slug}` |

## Price Range Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `rangeLabel` | Generated | N/A | Frontend generates: "Under $50", "$50 - $100", etc. |
| `minPrice` | `min` | `/api/products/price-ranges` | Minimum price in range |
| `maxPrice` | `max` | Same as above | Maximum price in range (null for open-ended) |
| `productCount` | `count` | Same as above | Products in this range |
| `href` | Generated | N/A | Frontend constructs: `/price/{range}` |

## Product Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `id` | `id` or `sku` | `/api/products` or `/api/products/{id}` | Unique identifier |
| `name` | `name` or `title` | Same as above | Product name |
| `price` | `price` or `sale_price` | Same as above | Current price |
| `originalPrice` | `original_price` or `msrp` | Same as above | Original price (if on sale) |
| `image` | `image_url` or `thumbnail` | Same as above | Primary product image |
| `country` | `country.name` or `origin_country` | Same as above | Country of origin |
| `badge` | `badge` or `label` | Same as above | "New", "Sale", "Bestseller" |
| `href` | Generated from slug | N/A | Frontend constructs: `/product/{slug}` |

## Designer Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `id` | `id` | `/api/designers` or `/api/vendors` | Unique identifier |
| `name` | `name` or `business_name` | Same as above | Designer/brand name |
| `country` | `country.name` | Same as above | Based in country |
| `image` | `logo_url` or `profile_image` | Same as above | Designer photo/logo |
| `specialty` | `specialty` or `category` | Same as above | Primary specialty |
| `bio` | `bio` or `description` | Same as above | Short biography |
| `products` | `product_count` | Same as above | Number of products |
| `href` | Generated from slug | N/A | Frontend constructs: `/designer/{slug}` |

## Fabric Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `id` | `id` | `/api/products?type=fabric` | Unique identifier |
| `name` | `name` | Same as above | Fabric name |
| `price` | `price` | Same as above | Price per unit |
| `unit` | `unit` or `pricing_unit` | Same as above | "yard", "meter", etc. |
| `image` | `image_url` | Same as above | Fabric image |
| `country` | `country.name` | Same as above | Origin country |
| `type` | `fabric_type` or `category` | Same as above | "Ankara", "Kente", etc. |
| `description` | `description` | Same as above | Short description |
| `minOrder` | `min_order_quantity` | Same as above | Minimum order amount |
| `href` | Generated from slug | N/A | Frontend constructs: `/fabric/{slug}` |

## Search Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `query` | `q` or `query` | `/api/search` or `/api/products/search` | Search query |
| `results` | `results` or `products` | Same as above | Array of products |
| `suggestions` | `suggestions` | Same as above | Array of suggested queries |
| `total` | `total_count` | Same as above | Total results count |

## Newsletter Data Mapping

| Contract Field | Your Backend Field | Your Endpoint | Notes |
|----------------|-------------------|---------------|-------|
| `email` | `email` | `/api/newsletter/subscribe` | Subscriber email |
| `status` | `status` | Response | "subscribed", "already_subscribed", "error" |

## Recommended Backend Contract

If creating new endpoints, use this structure:

```yaml
# Categories
GET /api/v1/taxonomies/categories
Response: [
  { id: string, name: string, slug: string, product_count: number }
]

# Countries (product counts only)
GET /api/v1/countries
Response: [
  { code: string, name: string, product_count: number }
]

# Occasions
GET /api/v1/taxonomies/occasions
Response: [
  { id: string, name: string, slug: string, product_count: number }
]

# Price ranges
GET /api/v1/products/price-ranges
Response: [
  { min: number|null, max: number|null, label: string, count: number }
]

# Products
GET /api/v1/products
Query: { category, country, occasion, price_min, price_max, sort, page }
Response: {
  data: [...],
  meta: { total, page, per_page }
}

# Search
GET /api/v1/search?q={query}
Response: {
  results: [...],
  suggestions: [...],
  total: number
}

# Newsletter
POST /api/v1/newsletter/subscribe
Body: { email: string }
Response: { status: string }
```
