import { Router } from 'express';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

// ==================== PUBLIC ENDPOINTS (for frontend) ====================

// Get active hero slides
router.get('/hero-slides', async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: slides,
    });
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero slides',
    });
  }
});

// Get featured products by section
router.get('/featured/:section', async (req, res) => {
  try {
    const { section } = req.params;

    const featuredProducts = await prisma.featuredProduct.findMany({
      where: {
        section: section as any,
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      take: 12,
    });

    // Fetch full product details based on productType
    const productsWithDetails = await Promise.all(
      featuredProducts.map(async (fp) => {
        if (fp.productType === 'DESIGN') {
          const product = await prisma.design.findUnique({
            where: { id: fp.productId },
            include: {
              designer: {
                select: {
                  businessName: true,
                  country: true,
                },
              },
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
              },
            },
          });

          if (!product) return null;
          return {
            id: product.id,
            name: fp.customTitle || product.name,
            description: fp.customDescription || product.description,
            price: Number(product.finalPrice),
            image: product.images[0]?.url || '/images/placeholder.jpg',
            designer: product.designer.businessName,
            country: product.designer.country,
            productType: fp.productType,
          };
        }

        if (fp.productType === 'FABRIC') {
          const product = await prisma.fabric.findUnique({
            where: { id: fp.productId },
            include: {
              seller: {
                select: {
                  businessName: true,
                  country: true,
                },
              },
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
              },
            },
          });

          if (!product) return null;
          return {
            id: product.id,
            name: fp.customTitle || product.name,
            description: fp.customDescription || product.description,
            price: Number(product.finalPrice),
            image: product.images[0]?.url || '/images/placeholder.jpg',
            designer: product.seller.businessName,
            country: product.seller.country,
            productType: fp.productType,
          };
        }

        if (fp.productType === 'READY_TO_WEAR') {
          const product = await prisma.readyToWear.findUnique({
            where: { id: fp.productId },
            include: {
              designer: {
                select: {
                  businessName: true,
                  country: true,
                },
              },
              images: {
                take: 1,
                orderBy: { sortOrder: 'asc' },
              },
            },
          });

          if (!product) return null;
          return {
            id: product.id,
            name: fp.customTitle || product.name,
            description: fp.customDescription || product.description,
            price: Number(product.basePrice),
            image: product.images[0]?.url || '/images/placeholder.jpg',
            designer: product.designer.businessName,
            country: product.designer.country,
            productType: fp.productType,
          };
        }

        return null;
      })
    );

    // Filter out nulls (products that no longer exist)
    const validProducts = productsWithDetails.filter((p) => p !== null);

    res.json({
      success: true,
      data: validProducts,
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured products',
    });
  }
});

// Get all featured sections (for homepage)
router.get('/featured', async (req, res) => {
  try {
    const sections = ['FEATURED_DESIGNS', 'FEATURED_FABRICS', 'FEATURED_READY_TO_WEAR', 'TRENDING_NOW'];
    const result: Record<string, any[]> = {};

    for (const section of sections) {
      const featuredProducts = await prisma.featuredProduct.findMany({
        where: {
          section: section as any,
          isActive: true,
        },
        orderBy: { displayOrder: 'asc' },
        take: 6,
      });

      const productsWithDetails = await Promise.all(
        featuredProducts.map(async (fp) => {
          if (fp.productType === 'DESIGN') {
            const product = await prisma.design.findUnique({
              where: { id: fp.productId },
              include: {
                designer: {
                  select: {
                    businessName: true,
                    country: true,
                  },
                },
                images: {
                  take: 1,
                  orderBy: { sortOrder: 'asc' },
                },
              },
            });

            if (!product) return null;
            return {
              id: product.id,
              name: fp.customTitle || product.name,
              description: fp.customDescription || product.description,
              price: Number(product.finalPrice),
              image: product.images[0]?.url || '/images/placeholder.jpg',
              designer: product.designer.businessName,
              country: product.designer.country,
              productType: fp.productType,
            };
          }

          if (fp.productType === 'FABRIC') {
            const product = await prisma.fabric.findUnique({
              where: { id: fp.productId },
              include: {
                seller: {
                  select: {
                    businessName: true,
                    country: true,
                  },
                },
                images: {
                  take: 1,
                  orderBy: { sortOrder: 'asc' },
                },
              },
            });

            if (!product) return null;
            return {
              id: product.id,
              name: fp.customTitle || product.name,
              description: fp.customDescription || product.description,
              price: Number(product.finalPrice),
              image: product.images[0]?.url || '/images/placeholder.jpg',
              designer: product.seller.businessName,
              country: product.seller.country,
              productType: fp.productType,
            };
          }

          if (fp.productType === 'READY_TO_WEAR') {
            const product = await prisma.readyToWear.findUnique({
              where: { id: fp.productId },
              include: {
                designer: {
                  select: {
                    businessName: true,
                    country: true,
                  },
                },
                images: {
                  take: 1,
                  orderBy: { sortOrder: 'asc' },
                },
              },
            });

            if (!product) return null;
            return {
              id: product.id,
              name: fp.customTitle || product.name,
              description: fp.customDescription || product.description,
              price: Number(product.basePrice),
              image: product.images[0]?.url || '/images/placeholder.jpg',
              designer: product.designer.businessName,
              country: product.designer.country,
              productType: fp.productType,
            };
          }

          return null;
        })
      );

      result[section] = productsWithDetails.filter((p) => p !== null);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching all featured sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured sections',
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all hero slides (admin)
router.get('/admin/hero-slides', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: slides,
    });
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero slides',
    });
  }
});

// Create hero slide (admin)
router.post('/admin/hero-slides', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { title, subtitle, image, ctaText, ctaLink, displayOrder } = req.body;

    if (!title || !subtitle || !image) {
      return res.status(400).json({
        success: false,
        message: 'Title, subtitle, and image are required',
      });
    }

    const slide = await prisma.heroSlide.create({
      data: {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
        displayOrder: displayOrder || 0,
      },
    });

    res.status(201).json({
      success: true,
      data: slide,
      message: 'Hero slide created successfully',
    });
  } catch (error) {
    console.error('Error creating hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create hero slide',
    });
  }
});

// Update hero slide (admin)
router.put('/admin/hero-slides/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, image, ctaText, ctaLink, displayOrder, isActive } = req.body;

    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
        displayOrder,
        isActive,
      },
    });

    res.json({
      success: true,
      data: slide,
      message: 'Hero slide updated successfully',
    });
  } catch (error) {
    console.error('Error updating hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hero slide',
    });
  }
});

// Update hero slide (admin) - PATCH alias for backward compatibility
router.patch('/admin/hero-slides/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, image, ctaText, ctaLink, displayOrder, isActive } = req.body;

    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
        displayOrder,
        isActive,
      },
    });

    res.json({
      success: true,
      data: slide,
      message: 'Hero slide updated successfully',
    });
  } catch (error) {
    console.error('Error updating hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hero slide',
    });
  }
});

// Delete hero slide (admin)
router.delete('/admin/hero-slides/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.heroSlide.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Hero slide deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete hero slide',
    });
  }
});

// Get all featured products (admin)
router.get('/admin/featured', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const featured = await prisma.featuredProduct.findMany({
      orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }],
    });

    res.json({
      success: true,
      data: featured,
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured products',
    });
  }
});

// Add product to featured section (admin)
router.post('/admin/featured', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { productId, productType, section, displayOrder, customTitle, customDescription } = req.body;

    if (!productId || !productType || !section) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, product type, and section are required',
      });
    }

    // Verify product exists
    let product = null;
    if (productType === 'DESIGN') {
      product = await prisma.design.findUnique({ where: { id: productId } });
    } else if (productType === 'FABRIC') {
      product = await prisma.fabric.findUnique({ where: { id: productId } });
    } else if (productType === 'READY_TO_WEAR') {
      product = await prisma.readyToWear.findUnique({ where: { id: productId } });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const featured = await prisma.featuredProduct.create({
      data: {
        productId,
        productType,
        section,
        displayOrder: displayOrder || 0,
        customTitle,
        customDescription,
      },
    });

    res.status(201).json({
      success: true,
      data: featured,
      message: 'Product added to featured section',
    });
  } catch (error) {
    console.error('Error adding featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add featured product',
    });
  }
});

// Update featured product (admin)
router.put('/admin/featured/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder, customTitle, customDescription, isActive } = req.body;

    const featured = await prisma.featuredProduct.update({
      where: { id },
      data: {
        displayOrder,
        customTitle,
        customDescription,
        isActive,
      },
    });

    res.json({
      success: true,
      data: featured,
      message: 'Featured product updated successfully',
    });
  } catch (error) {
    console.error('Error updating featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured product',
    });
  }
});

// Update featured product (admin) - PATCH alias for backward compatibility
router.patch('/admin/featured/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder, customTitle, customDescription, isActive } = req.body;

    const featured = await prisma.featuredProduct.update({
      where: { id },
      data: {
        displayOrder,
        customTitle,
        customDescription,
        isActive,
      },
    });

    res.json({
      success: true,
      data: featured,
      message: 'Featured product updated successfully',
    });
  } catch (error) {
    console.error('Error updating featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured product',
    });
  }
});

// Remove product from featured section (admin)
router.delete('/admin/featured/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.featuredProduct.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Product removed from featured section',
    });
  } catch (error) {
    console.error('Error removing featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove featured product',
    });
  }
});

// Get available products for featuring (admin)
router.get('/admin/products-for-featured', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { type } = req.query;

    let products: any[] = [];

    if (type === 'DESIGN' || !type) {
      const designs = await prisma.design.findMany({
        where: { status: 'APPROVED', isAvailable: true },
        select: {
          id: true,
          name: true,
          designer: {
            select: {
              businessName: true,
            },
          },
        },
        take: 50,
      });
      products = [...products, ...designs.map((d) => ({ ...d, type: 'DESIGN' }))];
    }

    if (type === 'FABRIC' || !type) {
      const fabrics = await prisma.fabric.findMany({
        where: { status: 'APPROVED', isAvailable: true },
        select: {
          id: true,
          name: true,
          seller: {
            select: {
              businessName: true,
            },
          },
        },
        take: 50,
      });
      products = [...products, ...fabrics.map((f) => ({ ...f, type: 'FABRIC' }))];
    }

    if (type === 'READY_TO_WEAR' || !type) {
      const rtw = await prisma.readyToWear.findMany({
        where: { status: 'APPROVED', isAvailable: true },
        select: {
          id: true,
          name: true,
          designer: {
            select: {
              businessName: true,
            },
          },
        },
        take: 50,
      });
      products = [...products, ...rtw.map((r) => ({ ...r, type: 'READY_TO_WEAR' }))];
    }

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching products for featuring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
});

export default router;
