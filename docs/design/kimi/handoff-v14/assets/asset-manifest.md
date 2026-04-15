# Asset Manifest

## Hero Images

| Asset | Dimensions | Format | Size | Alt Text |
|-------|------------|--------|------|----------|
| hero_model.jpg | 1920x1080 | JPG | ~200KB | "African model in traditional blue and gold attire" |
| rw_hero.jpg | 1920x600 | JPG | ~150KB | "Ready to Wear collection showcase" |
| fabrics_hero.jpg | 1920x600 | JPG | ~150KB | "African fabrics display" |
| custom_hero.jpg | 1920x600 | JPG | ~150KB | "Custom design atelier" |
| designers_hero.jpg | 1920x600 | JPG | ~150KB | "Designer portrait collage" |
| about_hero.jpg | 1920x600 | JPG | ~150KB | "African artisan at work" |

## Product Images

| Asset | Dimensions | Format | Size | Alt Text |
|-------|------------|--------|------|----------|
| product1.jpg | 800x1000 | JPG | ~100KB | "Ankara maxi dress in vibrant pattern" |
| product2.jpg | 800x1000 | JPG | ~100KB | "Kente wrap top traditional design" |
| product3.jpg | 800x1000 | JPG | ~100KB | "Kitenge pencil skirt" |
| product4.jpg | 800x1000 | JPG | ~100KB | "Dashiki shirt with embroidery" |

## Fabric Images

| Asset | Dimensions | Format | Size | Alt Text |
|-------|------------|--------|------|----------|
| fabric1.jpg | 800x800 | JPG | ~80KB | "Premium Ankara fabric roll" |
| fabric2.jpg | 800x800 | JPG | ~80KB | "Royal Kente woven fabric" |
| fabric3.jpg | 800x800 | JPG | ~80KB | "East African Kitenge fabric" |
| fabric4.jpg | 800x800 | JPG | ~80KB | "Yoruba Aso Oke handwoven" |

## Designer Images

| Asset | Dimensions | Format | Size | Alt Text |
|-------|------------|--------|------|----------|
| designer1.jpg | 600x800 | JPG | ~80KB | "Portrait of Adeola, Nigerian designer" |
| designer2.jpg | 600x800 | JPG | ~80KB | "Portrait of Kwame, Ghanaian designer" |
| designer3.jpg | 600x800 | JPG | ~80KB | "Portrait of Amina, Kenyan designer" |

## Icons

| Asset | Format | Size | Usage |
|-------|--------|------|-------|
| shopping-bag.svg | SVG | ~1KB | Category icons |
| globe.svg | SVG | ~1KB | Country icons |
| calendar.svg | SVG | ~1KB | Occasion icons |
| tag.svg | SVG | ~1KB | Price icons |
| shield-check.svg | SVG | ~1KB | Trust badges |
| truck.svg | SVG | ~1KB | Trust badges |
| refresh-cw.svg | SVG | ~1KB | Trust badges |
| headphones.svg | SVG | ~1KB | Trust badges |

## Usage Rights

All images are licensed for commercial use on the ZuriKaribu platform. Images feature:
- Authentic African fashion models
- Real artisans and designers
- Traditional and contemporary African textiles

## Optimization Guidelines

1. **Hero Images**: WebP with JPEG fallback, max 200KB
2. **Product Images**: WebP with JPEG fallback, max 100KB
3. **Thumbnails**: WebP with JPEG fallback, max 30KB
4. **Icons**: SVG for scalability, inline for critical icons
5. **Lazy Loading**: Use `loading="lazy"` for below-fold images
6. **Responsive**: Provide srcset for different screen sizes

## CDN Path Structure

```
/assets/
  /hero/
    hero_model.jpg
    hero_model.webp
  /products/
    product1.jpg
    product1.webp
  /fabrics/
    fabric1.jpg
    fabric1.webp
  /designers/
    designer1.jpg
    designer1.webp
  /icons/
    shopping-bag.svg
```
