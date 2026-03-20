# Route Alias Guidance

## Frontend vs Backend Path Mapping

Our contracts define frontend routes. Map these to your existing backend paths.

## Primary Route Aliases

| Frontend Route (Contract) | Your Backend Route | Status | Implementation |
|---------------------------|-------------------|--------|----------------|
| `/custom` | `/designs` | **ALIAS REQUIRED** | Frontend shows `/custom`, calls `/designs` API |
| `/ready-to-wear` | `/ready-to-wear` | No change | Direct match |
| `/fabrics` | `/fabrics` | No change | Direct match |
| `/designers` | `/designers` | No change | Direct match |
| `/about` | `/about` | No change | Direct match |
| `/shop` | `/shop` or `/products` | Optional alias | Frontend shows `/shop`, calls `/products` API |

## Sub-Route Aliases

### Category Routes

| Frontend Route | Backend Route Pattern | Example |
|----------------|----------------------|---------|
| `/ready-to-wear/{category}` | `/products?category={slug}` | `/ready-to-wear/dresses` → `/products?category=dresses` |
| `/ready-to-wear/dresses` | `/products?category=dresses` | Direct mapping |
| `/ready-to-wear/tops` | `/products?category=tops` | Direct mapping |

### Country Routes

| Frontend Route | Backend Route Pattern | Example |
|----------------|----------------------|---------|
| `/country/{name}` | `/products?country={code}` | `/country/nigeria` → `/products?country=NG` |
| `/country/nigeria` | `/products?country=NG` | Country name slug → ISO code |
| `/country/south-africa` | `/products?country=ZA` | Hyphenated name → ISO code |

### Occasion Routes

| Frontend Route | Backend Route Pattern | Example |
|----------------|----------------------|---------|
| `/occasion/{name}` | `/products?occasion={slug}` | `/occasion/wedding` → `/products?occasion=wedding` |

### Price Routes

| Frontend Route | Backend Route Pattern | Example |
|----------------|----------------------|---------|
| `/price/under-50` | `/products?price_max=50` | Parsed from URL |
| `/price/50-100` | `/products?price_min=50&price_max=100` | Parsed from URL |
| `/price/500-plus` | `/products?price_min=500` | Parsed from URL |
| `/sale` | `/products?on_sale=true` | Sale flag |

## URL Slug Conversion

### Country Name to Slug
```javascript
// Frontend: Convert country name to URL slug
const countrySlug = countryName
  .toLowerCase()
  .replace(/\s+/g, '-');      // "South Africa" → "south-africa"

// Backend: Convert slug to ISO code
const countryCode = countrySlugMap[slug];  // "south-africa" → "ZA"
```

### Slug to Country Name (Display)
```javascript
// Frontend: Convert slug back to display name
const displayName = slug
  .split('-')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');  // "south-africa" → "South Africa"
```

## Implementation Patterns

### Pattern 1: Frontend Router Aliases
```javascript
// React Router example
<Route path="/custom" element={<CustomPage />} />
<Route path="/designs" element={<Navigate to="/custom" />} />

// API calls still use backend paths
fetch('/api/designs');  // Backend endpoint
```

### Pattern 2: API Proxy/Rewrite
```javascript
// Next.js rewrites example
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/custom',
        destination: '/api/designs',  // Your backend path
      },
    ];
  },
};
```

### Pattern 3: Nginx Reverse Proxy
```nginx
# nginx.conf
location /api/custom {
    proxy_pass http://backend/api/designs;
}
```

## Critical Alias: `/custom` → `/designs`

This is the only REQUIRED alias. Your backend uses `/designs`, our contract uses `/custom`.

### Frontend Implementation
```javascript
// Show URL: /custom
// Call API: /api/designs

function CustomPage() {
  const { data } = useQuery('/api/designs');  // Your backend path
  
  return (
    <div>
      <h1>Custom Design</h1>  {/* Display text */}
      {/* Content from /api/designs */}
    </div>
  );
}
```

### Backend Contract
```yaml
GET /api/designs
Response: {
  title: string,
  description: string,
  processSteps: [...],
  packages: [...]
}
```

## Navigation Links

Update navigation to use frontend paths:

```javascript
const navLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Ready to Wear", href: "/ready-to-wear" },
  { label: "Fabrics", href: "/fabrics" },
  { label: "Custom", href: "/custom" },        // Shows /custom, calls /designs
  { label: "Designers", href: "/designers" },
  { label: "About", href: "/about" },
];
```

## Summary

| Action | Path |
|--------|------|
| **User sees** | `/custom` |
| **Frontend routes to** | `/custom` |
| **Frontend calls** | `/api/designs` |
| **Your backend serves** | `/api/designs` |

All other routes have direct 1:1 mapping between contract and backend.
