import { Router } from 'express';
import { z } from 'zod';
import { prisma, UserRole, OrderType, OrderStatus, PaymentStatus, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import nodemailer from 'nodemailer';

const router = Router();

router.use(authenticate);

let cachedTransporter: nodemailer.Transporter | null | undefined;

function getOrderMailer(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) {
    return cachedTransporter;
  }
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransporter = null;
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
  return cachedTransporter;
}

async function sendOrderConfirmationEmail(params: {
  to: string;
  orderNumber: string;
  orderType: string;
  total: number;
  itemCount: number;
}) {
  const transporter = getOrderMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !params.to) {
    return;
  }
  const totalText = Number(params.total || 0).toFixed(2);
  await transporter.sendMail({
    from,
    to: params.to,
    subject: `Order Confirmation: ${params.orderNumber}`,
    text: `Thank you for your order!\n\nOrder Number: ${params.orderNumber}\nOrder Type: ${params.orderType}\nItems: ${params.itemCount}\nTotal: $${totalText}\n\nYour order has been received and is now being processed.`,
    html: `
      <p>Thank you for your order.</p>
      <p><strong>Order Number:</strong> ${params.orderNumber}</p>
      <p><strong>Order Type:</strong> ${params.orderType}</p>
      <p><strong>Items:</strong> ${params.itemCount}</p>
      <p><strong>Total:</strong> $${totalText}</p>
      <p>Your order has been received and is now being processed.</p>
    `,
  });
}

// Get order by ID (with role-based access)
router.get('/:id', authorizePermissions(Permissions.ORDERS_READ_SELF, Permissions.ORDERS_READ_ASSIGNED, Permissions.ORDERS_READ_ALL), async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
        designOrder: {
          include: {
            design: {
              include: {
                designer: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                images: true,
              },
            },
          },
        },
        fabricOrder: {
          include: {
            fabric: {
              include: {
                seller: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                images: true,
              },
            },
          },
        },
        readyToWearItems: {
          include: {
            readyToWear: {
              include: {
                designer: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                images: true,
              },
            },
          },
        },
        timeline: {
          orderBy: { createdAt: 'asc' },
        },
        qa: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Check access permissions
    let hasAccess = false;
    if (user.role === UserRole.ADMINISTRATOR) {
      hasAccess = true;
    } else if (user.role === UserRole.CUSTOMER && order.customerId === user.id) {
      hasAccess = true;
    } else if (user.role === UserRole.FABRIC_SELLER && order.fabricOrder) {
      const sellerProfile = await prisma.fabricSellerProfile.findFirst({
        where: { userId: user.id },
      });
      if (sellerProfile && order.fabricOrder.sellerId === sellerProfile.id) {
        hasAccess = true;
      }
    } else if (user.role === UserRole.FASHION_DESIGNER && order.designOrder) {
      const designerProfile = await prisma.designerProfile.findFirst({
        where: { userId: user.id },
      });
      if (designerProfile && order.designOrder.designerId === designerProfile.id) {
        hasAccess = true;
      }
    } else if (user.role === UserRole.QA_TEAM && order.qaId) {
      const qaProfile = await prisma.qAProfile.findFirst({
        where: { userId: user.id },
      });
      if (qaProfile && order.qaId === qaProfile.id) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this order.',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// Create custom design order
router.post('/custom-design', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    const schema = z.object({
      designId: z.string().uuid(),
      fabricId: z.string().uuid(),
      yards: z.number().min(1),
      measurements: z.record(z.number()),
      shippingAddressId: z.string().uuid(),
      paymentMethod: z.string(),
      paymentIntentId: z.string().min(1).optional(),
      shippingCostUsd: z.number().min(0).optional(),
      shippingQuoteId: z.string().min(1).optional(),
      shippingProviderKey: z.string().min(1).optional(),
      shippingProviderName: z.string().min(1).optional(),
      shippingServiceName: z.string().min(1).optional(),
      shippingEtaMinDays: z.number().min(0).optional(),
      shippingEtaMaxDays: z.number().min(0).optional(),
    });

    const data = schema.parse(req.body);
    const customerId = req.user!.id;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId: customerId },
      select: { id: true },
    });

    if (!customerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    // Get design and fabric details
    const [design, fabric, address] = await Promise.all([
      prisma.design.findFirst({
        where: {
          id: data.designId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: {
          designer: true,
          suitableFabrics: { where: { fabricId: data.fabricId } },
        },
      }),
      prisma.fabric.findFirst({
        where: {
          id: data.fabricId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: { seller: true },
      }),
      prisma.address.findFirst({
        where: { id: data.shippingAddressId, customerProfileId: customerProfile.id },
      }),
    ]);

    if (!design) {
      return res.status(404).json({ success: false, message: 'Design not found.' });
    }
    if (!fabric) {
      return res.status(404).json({ success: false, message: 'Fabric not found.' });
    }
    if (!address) {
      return res.status(404).json({ success: false, message: 'Shipping address not found.' });
    }

    // Check if fabric is suitable for design
    if (design.suitableFabrics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected fabric is not suitable for this design.',
      });
    }

    // Check if fabric and designer are in same country
    if (fabric.seller.country !== design.designer.country) {
      return res.status(400).json({
        success: false,
        message: 'Fabric seller and designer must be in the same country for standard processing.',
      });
    }

    // Check fabric stock
    if (fabric.stockYards < data.yards) {
      return res.status(400).json({
        success: false,
        message: `Not enough fabric in stock. Available: ${fabric.stockYards} yards`,
      });
    }

    // Calculate prices
    const fabricPrice = Number(fabric.finalPrice) * data.yards;
    const designPrice = Number(design.finalPrice);
    const subtotal = fabricPrice + designPrice;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 25;
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const initialStatus = isPaymentConfirmed ? OrderStatus.PAYMENT_CONFIRMED : OrderStatus.PENDING_PAYMENT;

    // Generate order number
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = {
      ...address,
      shippingQuoteId: data.shippingQuoteId || null,
      shippingProviderKey: data.shippingProviderKey || null,
      shippingProviderName: data.shippingProviderName || null,
      shippingServiceName: data.shippingServiceName || null,
      shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
      shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
    };

    // Create order with all components
    const order = await prisma.$transaction(async (tx) => {
      // Create main order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.CUSTOM_DESIGN,
          customerId,
          shippingAddress: shippingSnapshot,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: data.paymentMethod,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isPaymentConfirmed ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          paidAt: isPaymentConfirmed ? new Date() : null,
          status: initialStatus,
          // Create design order item
          designOrder: {
            create: {
              designId: data.designId,
              designerId: design.designerId,
              measurements: data.measurements,
              price: designPrice,
              status: 'PENDING',
            },
          },
          // Create fabric order item
          fabricOrder: {
            create: {
              fabricId: data.fabricId,
              sellerId: fabric.sellerId,
              yards: data.yards,
              pricePerYard: fabric.finalPrice,
              totalPrice: fabricPrice,
              status: 'PENDING',
            },
          },
          // Create timeline entry
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? 'Order created and payment confirmed'
                : 'Order created, awaiting payment',
              updatedById: customerId,
              updatedByRole: UserRole.CUSTOMER,
            },
          },
        },
        include: {
          designOrder: true,
          fabricOrder: true,
        },
      });

      // Only decrement inventory for paid orders.
      if (isPaymentConfirmed) {
        await tx.fabric.update({
          where: { id: data.fabricId },
          data: { stockYards: { decrement: data.yards } },
        });
      }

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Please complete payment.',
      data: order,
    });
    void sendOrderConfirmationEmail({
      to: req.user!.email,
      orderNumber: order.orderNumber,
      orderType: 'Custom Design',
      total,
      itemCount: 1,
    }).catch((error) => {
      console.error('Failed to send custom-design order confirmation email:', error);
    });
  } catch (error) {
    next(error);
  }
});

// Create ready-to-wear order
router.post('/ready-to-wear', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    type ValidatedReadyToWearItem = {
      readyToWearId: string;
      size: string;
      quantity: number;
      price: number;
      sizeVariationId: string;
    };

    const schema = z.object({
      items: z.array(z.object({
        readyToWearId: z.string().uuid(),
        size: z.string(),
        quantity: z.number().min(1),
      })),
      shippingAddressId: z.string().uuid(),
      paymentMethod: z.string(),
      paymentIntentId: z.string().min(1).optional(),
      shippingCostUsd: z.number().min(0).optional(),
      shippingQuoteId: z.string().min(1).optional(),
      shippingProviderKey: z.string().min(1).optional(),
      shippingProviderName: z.string().min(1).optional(),
      shippingServiceName: z.string().min(1).optional(),
      shippingEtaMinDays: z.number().min(0).optional(),
      shippingEtaMaxDays: z.number().min(0).optional(),
    });

    const data = schema.parse(req.body);
    const customerId = req.user!.id;

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId: customerId },
      select: { id: true },
    });

    if (!customerProfile) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.',
      });
    }

    // Validate items and calculate total
    let subtotal = 0;
    const validatedItems: ValidatedReadyToWearItem[] = [];

    for (const item of data.items) {
      const product = await prisma.readyToWear.findFirst({
        where: {
          id: item.readyToWearId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: {
          sizeVariations: {
            where: { size: item.size },
          },
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.readyToWearId}`,
        });
      }

      if (product.sizeVariations.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Size ${item.size} not available for ${product.name}`,
        });
      }

      const sizeVar = product.sizeVariations[0];
      if (sizeVar.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${product.name} in size ${item.size}. Available: ${sizeVar.stock}`,
        });
      }

      const itemTotal = Number(sizeVar.price) * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        ...item,
        price: Number(sizeVar.price),
        sizeVariationId: sizeVar.id,
      });
    }

    // Get shipping address
    const address = await prisma.address.findFirst({
      where: { id: data.shippingAddressId, customerProfileId: customerProfile.id },
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Shipping address not found.',
      });
    }

    // Calculate totals
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 15;
    const tax = subtotal * 0.08;
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const initialStatus = isPaymentConfirmed ? OrderStatus.PAYMENT_CONFIRMED : OrderStatus.PENDING_PAYMENT;

    // Generate order number
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = {
      ...address,
      shippingQuoteId: data.shippingQuoteId || null,
      shippingProviderKey: data.shippingProviderKey || null,
      shippingProviderName: data.shippingProviderName || null,
      shippingServiceName: data.shippingServiceName || null,
      shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
      shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
    };

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.READY_TO_WEAR,
          customerId,
          shippingAddress: shippingSnapshot,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: data.paymentMethod,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isPaymentConfirmed ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          paidAt: isPaymentConfirmed ? new Date() : null,
          status: initialStatus,
          readyToWearItems: {
            create: validatedItems.map((item) => ({
              readyToWearId: item.readyToWearId,
              size: item.size,
              price: item.price,
              quantity: item.quantity,
            })),
          },
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? 'Ready-to-wear order created and payment confirmed'
                : 'Ready-to-wear order created, awaiting payment',
              updatedById: customerId,
              updatedByRole: UserRole.CUSTOMER,
            },
          },
        },
        include: {
          readyToWearItems: true,
        },
      });

      // Only decrement inventory for paid orders.
      if (isPaymentConfirmed) {
        for (const item of validatedItems) {
          await tx.readyToWearSize.update({
            where: { id: item.sizeVariationId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Please complete payment.',
      data: order,
    });
    void sendOrderConfirmationEmail({
      to: req.user!.email,
      orderNumber: order.orderNumber,
      orderType: 'Ready To Wear',
      total,
      itemCount: validatedItems.reduce((count, item) => count + Number(item.quantity || 0), 0),
    }).catch((error) => {
      console.error('Failed to send ready-to-wear order confirmation email:', error);
    });
  } catch (error) {
    next(error);
  }
});

// Update order status (for all parties)
router.patch('/:id/status', authorizePermissions(Permissions.ORDERS_UPDATE_SELF, Permissions.ORDERS_UPDATE_ASSIGNED, Permissions.ORDERS_UPDATE_ALL), async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      status: z.string().min(1),
      notes: z.string().optional(),
    });
    const { status, notes } = schema.parse(req.body);
    const user = req.user!;

    // Get current order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        designOrder: true,
        fabricOrder: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    // Validate status transition based on user role
    let canUpdate = false;
    let updateData: any = {};
    let timelineStatus: OrderStatus = order.status;

    if (user.role === UserRole.ADMINISTRATOR) {
      const orderStatus = z.nativeEnum(OrderStatus).safeParse(status);
      if (orderStatus.success) {
        canUpdate = true;
        timelineStatus = orderStatus.data;
        updateData.status = orderStatus.data;
      }
    } else if (user.role === UserRole.FABRIC_SELLER && order.fabricOrder) {
      const sellerProfile = await prisma.fabricSellerProfile.findFirst({
        where: { userId: user.id },
      });
      if (sellerProfile && order.fabricOrder.sellerId === sellerProfile.id) {
        // Fabric seller can only update fabric portion
        const fabricStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED_TO_DESIGNER', 'DELIVERED'] as const;
        const fabricToOrderStatus: Record<(typeof fabricStatuses)[number], OrderStatus> = {
          PENDING: OrderStatus.FABRIC_PENDING,
          CONFIRMED: OrderStatus.FABRIC_CONFIRMED,
          SHIPPED_TO_DESIGNER: OrderStatus.FABRIC_SHIPPED,
          DELIVERED: OrderStatus.FABRIC_RECEIVED,
        };
        if ((fabricStatuses as readonly string[]).includes(status)) {
          canUpdate = true;
          timelineStatus = fabricToOrderStatus[status as (typeof fabricStatuses)[number]];
          updateData.status = timelineStatus;
          updateData.fabricOrder = {
            update: {
              status,
              ...(status === 'SHIPPED_TO_DESIGNER' && {
                shippedToDesignerAt: new Date(),
              }),
            },
          };
        }
      }
    } else if (user.role === UserRole.FASHION_DESIGNER && order.designOrder) {
      const designerProfile = await prisma.designerProfile.findFirst({
        where: { userId: user.id },
      });
      if (designerProfile && order.designOrder.designerId === designerProfile.id) {
        // Designer can only update design portion
        const designStatuses = ['PENDING', 'CONFIRMED', 'FABRIC_RECEIVED', 'IN_PRODUCTION', 'COMPLETED'] as const;
        const designToOrderStatus: Record<(typeof designStatuses)[number], OrderStatus> = {
          PENDING: OrderStatus.PAYMENT_CONFIRMED,
          CONFIRMED: OrderStatus.PAYMENT_CONFIRMED,
          FABRIC_RECEIVED: OrderStatus.FABRIC_RECEIVED,
          IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
          COMPLETED: OrderStatus.PRODUCTION_COMPLETE,
        };
        if ((designStatuses as readonly string[]).includes(status)) {
          canUpdate = true;
          timelineStatus = designToOrderStatus[status as (typeof designStatuses)[number]];
          updateData.status = timelineStatus;
          updateData.designOrder = {
            update: { status },
          };
        }
      }
    } else if (user.role === UserRole.QA_TEAM) {
      const qaProfile = await prisma.qAProfile.findFirst({
        where: { userId: user.id },
      });
      if (qaProfile && order.qaId === qaProfile.id) {
        const qaStatuses: OrderStatus[] = [
          OrderStatus.QA_PENDING,
          OrderStatus.QA_INSPECTING,
          OrderStatus.QA_APPROVED,
          OrderStatus.QA_REJECTED,
          OrderStatus.SHIPPED,
        ];
        const parsedStatus = z.nativeEnum(OrderStatus).safeParse(status);
        if (parsedStatus.success && qaStatuses.includes(parsedStatus.data)) {
          canUpdate = true;
          updateData.status = parsedStatus.data;
          timelineStatus = parsedStatus.data;
          if (parsedStatus.data === OrderStatus.SHIPPED) {
            updateData.shippedAt = new Date();
          }
        }
      }
    }

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this order status.',
      });
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: updateData,
      }),
      prisma.orderTimeline.create({
        data: {
          orderId: id,
          status: timelineStatus,
          notes: notes || `Status updated to ${status}`,
          updatedById: user.id,
          updatedByRole: user.role,
        },
      }),
    ]);

    res.json({
      success: true,
      message: 'Order status updated successfully.',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

// Add tracking number (QA only)
router.patch('/:id/tracking', authorizePermissions(Permissions.ORDERS_UPDATE_ASSIGNED), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { trackingNumber } = req.body;
    const user = req.user!;

    // Verify QA access
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    const qaProfile = await prisma.qAProfile.findFirst({
      where: { userId: user.id },
    });

    if (!qaProfile || order.qaId !== qaProfile.id) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned QA can add tracking information.',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { trackingNumber },
    });

    res.json({
      success: true,
      message: 'Tracking number added successfully.',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
