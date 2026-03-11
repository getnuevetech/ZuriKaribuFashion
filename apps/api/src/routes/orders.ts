import { Router } from 'express';
import { z } from 'zod';
import { prisma, UserRole, OrderType, OrderStatus, PaymentStatus, ProductStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import nodemailer from 'nodemailer';
import {
  appendWorkflowMetadataToShippingAddress,
  determinePostPaymentStatus,
  readOrderWorkflowSettings,
  redactShippingAddressForVendor,
  shouldNotifyRoleForStatus,
} from '../utils/order-workflow';
import { emitPartnerOrderEvent } from '../utils/partner-api';

const router = Router();

const READY_TO_WEAR_VARIANT_SEPARATOR = '::';
const DEFAULT_READY_TO_WEAR_COLOR = 'DEFAULT';
const normalizeReadyToWearSize = (value: unknown) => String(value || '').trim().toUpperCase();
const normalizeReadyToWearColor = (value: unknown) =>
  String(value || DEFAULT_READY_TO_WEAR_COLOR)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') || DEFAULT_READY_TO_WEAR_COLOR;
const encodeReadyToWearVariantKey = (size: unknown, color?: unknown) =>
  `${normalizeReadyToWearSize(size)}${READY_TO_WEAR_VARIANT_SEPARATOR}${normalizeReadyToWearColor(color)}`;
const decodeReadyToWearVariantKey = (variantKey: unknown) => {
  const raw = String(variantKey || '').trim().toUpperCase();
  if (!raw.includes(READY_TO_WEAR_VARIANT_SEPARATOR)) {
    return {
      size: normalizeReadyToWearSize(raw),
      color: DEFAULT_READY_TO_WEAR_COLOR,
      variantKey: raw,
    };
  }
  const [sizePart, colorPart] = raw.split(READY_TO_WEAR_VARIANT_SEPARATOR);
  return {
    size: normalizeReadyToWearSize(sizePart),
    color: normalizeReadyToWearColor(colorPart),
    variantKey: raw,
  };
};

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

function toStatusLabel(status: OrderStatus) {
  return String(status || '')
    .toLowerCase()
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

async function sendLifecycleEmail(params: {
  to: string;
  subject: string;
  title: string;
  body: string;
}) {
  const transporter = getOrderMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !params.to) return;
  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: `${params.title}\n\n${params.body}`,
    html: `<p><strong>${params.title}</strong></p><p>${params.body}</p>`,
  });
}

async function notifyOrderLifecycle(params: {
  orderId: string;
  status: OrderStatus;
  notes?: string;
  actorRole: UserRole;
}) {
  try {
    const [settings, order, adminUsers] = await Promise.all([
      readOrderWorkflowSettings(),
      prisma.order.findUnique({
        where: { id: params.orderId },
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          fabricOrder: {
            include: {
              seller: {
                include: {
                  user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
              },
            },
          },
          designOrder: {
            include: {
              designer: {
                include: {
                  user: { select: { id: true, email: true, firstName: true, lastName: true } },
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
                      user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
          qa: {
            include: {
              user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          role: UserRole.ADMINISTRATOR,
          status: 'ACTIVE',
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);
    if (!order) return;

    const statusLabel = toStatusLabel(params.status);
    const notificationTitle = `Order ${order.orderNumber} updated`;
    const roleBlurb = (() => {
      if (params.actorRole === UserRole.ADMINISTRATOR) return 'by Admin';
      if (params.actorRole === UserRole.QA_TEAM) return 'by QA';
      if (params.actorRole === UserRole.FABRIC_SELLER) return 'by Seller';
      if (params.actorRole === UserRole.FASHION_DESIGNER) return 'by Designer';
      return 'by Customer';
    })();
    const notificationBody = `Status is now "${statusLabel}" ${roleBlurb}.${params.notes ? ` Notes: ${params.notes}` : ''}`;

    const recipients: Array<{ role: 'CUSTOMER' | 'SELLER' | 'DESIGNER' | 'QA' | 'ADMIN'; userId: string; email: string }> = [];
    if (order.customer?.id && order.customer?.email) {
      recipients.push({ role: 'CUSTOMER', userId: order.customer.id, email: order.customer.email });
    }
    const sellerUser = order.fabricOrder?.seller?.user;
    if (sellerUser?.id && sellerUser?.email) {
      recipients.push({ role: 'SELLER', userId: sellerUser.id, email: sellerUser.email });
    }
    const designerUsers = new Map<string, { id: string; email: string }>();
    const designOwner = order.designOrder?.designer?.user;
    if (designOwner?.id && designOwner?.email) {
      designerUsers.set(designOwner.id, { id: designOwner.id, email: designOwner.email });
    }
    for (const item of order.readyToWearItems || []) {
      const readyDesigner = item.readyToWear?.designer?.user;
      if (readyDesigner?.id && readyDesigner?.email) {
        designerUsers.set(readyDesigner.id, { id: readyDesigner.id, email: readyDesigner.email });
      }
    }
    designerUsers.forEach((value) => {
      recipients.push({ role: 'DESIGNER', userId: value.id, email: value.email });
    });
    const qaUser = order.qa?.user;
    if (qaUser?.id && qaUser?.email) {
      recipients.push({ role: 'QA', userId: qaUser.id, email: qaUser.email });
    }
    for (const admin of adminUsers) {
      if (admin?.id && admin?.email) {
        recipients.push({ role: 'ADMIN', userId: admin.id, email: admin.email });
      }
    }

    const deduped = new Map<string, { role: 'CUSTOMER' | 'SELLER' | 'DESIGNER' | 'QA' | 'ADMIN'; userId: string; email: string }>();
    for (const recipient of recipients) {
      const key = `${recipient.role}:${recipient.userId}`;
      if (!deduped.has(key)) deduped.set(key, recipient);
    }

    const notifyTargets = Array.from(deduped.values()).filter((recipient) =>
      shouldNotifyRoleForStatus(settings, recipient.role, params.status)
    );

    await Promise.all(
      notifyTargets.map(async (recipient) => {
        await prisma.notification
          .create({
            data: {
              userId: recipient.userId,
              type: 'ORDER_UPDATE' as any,
              title: notificationTitle,
              message: notificationBody,
              relatedId: order.id,
              relatedType: 'ORDER',
            },
          })
          .catch(() => undefined);
      })
    );

    await Promise.all(
      notifyTargets.map((recipient) =>
        sendLifecycleEmail({
          to: recipient.email,
          subject: `${notificationTitle} · ${statusLabel}`,
          title: notificationTitle,
          body: notificationBody,
        }).catch(() => undefined)
      )
    );
    await emitPartnerOrderEvent('order.status.changed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: params.status,
      actorRole: params.actorRole,
      notes: params.notes || null,
      updatedAt: new Date().toISOString(),
      source: 'platform',
    }).catch(() => undefined);
  } catch (error) {
    console.error('Failed to send lifecycle notifications:', error);
  }
}

function canAutoProcessOrder(params: {
  processingMode: 'MANUAL' | 'AUTO';
  criteria: {
    requirePaid: boolean;
    requireShippingProvider: boolean;
    requireCustomerAddress: boolean;
    requireItems: boolean;
  };
  isPaymentConfirmed: boolean;
  hasShippingProvider: boolean;
  hasShippingAddress: boolean;
  hasItems: boolean;
}) {
  if (params.processingMode !== 'AUTO') return false;
  if (params.criteria.requirePaid && !params.isPaymentConfirmed) return false;
  if (params.criteria.requireShippingProvider && !params.hasShippingProvider) return false;
  if (params.criteria.requireCustomerAddress && !params.hasShippingAddress) return false;
  if (params.criteria.requireItems && !params.hasItems) return false;
  return true;
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
    } else if (user.role === UserRole.FASHION_DESIGNER) {
      const designerProfile = await prisma.designerProfile.findFirst({
        where: { userId: user.id },
      });
      const ownsDesignOrder = Boolean(designerProfile && order.designOrder && order.designOrder.designerId === designerProfile.id);
      const ownsReadyToWearOrder = Boolean(
        designerProfile &&
          (order.readyToWearItems || []).some(
            (item) => String(item.readyToWear?.designerId || '') === String(designerProfile.id)
          )
      );
      if (ownsDesignOrder || ownsReadyToWearOrder) {
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

    const safeOrder =
      user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER
        ? {
            ...order,
            customer: {
              firstName: 'Customer',
              lastName: '',
              email: '',
            },
            shippingAddress: redactShippingAddressForVendor(order.shippingAddress),
          }
        : order;

    res.json({
      success: true,
      data: safeOrder,
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
      fabricId: z.string().uuid().optional(),
      yards: z.number().min(1).optional(),
      fabricSelectionMode: z.enum(['CUSTOMER_SELECTED', 'DESIGNER_DECIDES']).default('CUSTOMER_SELECTED'),
      fabricPreferenceNotes: z.string().max(2000).optional(),
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
      promoCode: z.string().trim().max(30).optional(),
      discountUsd: z.number().min(0).optional(),
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

    const wantsDesignerToChooseFabric =
      data.fabricSelectionMode === 'DESIGNER_DECIDES' || !data.fabricId;
    const hasCustomerSelectedFabric = !wantsDesignerToChooseFabric;
    const selectedYards = Number(data.yards || 0);
    if (hasCustomerSelectedFabric && (!data.fabricId || selectedYards < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Fabric and yards are required when customer selects fabric.',
      });
    }

    // Get design, optional fabric, and address details
    const [design, address, fabric] = await Promise.all([
      prisma.design.findFirst({
        where: {
          id: data.designId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: {
          designer: true,
          suitableFabrics: true,
        },
      }),
      prisma.address.findFirst({
        where: { id: data.shippingAddressId, customerProfileId: customerProfile.id },
      }),
      hasCustomerSelectedFabric && data.fabricId
        ? prisma.fabric.findFirst({
            where: {
              id: data.fabricId,
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
            include: { seller: true },
          })
        : Promise.resolve(null),
    ]);

    if (!design) {
      return res.status(404).json({ success: false, message: 'Design not found.' });
    }
    if (!address) {
      return res.status(404).json({ success: false, message: 'Shipping address not found.' });
    }
    if (hasCustomerSelectedFabric && !fabric) {
      return res.status(404).json({ success: false, message: 'Fabric not found.' });
    }

    // Check if selected fabric is suitable for design
    if (
      hasCustomerSelectedFabric &&
      !design.suitableFabrics.some((row) => String(row.fabricId || '') === String(data.fabricId || ''))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Selected fabric is not suitable for this design.',
      });
    }

    // Check if selected fabric and designer are in same country
    if (hasCustomerSelectedFabric && fabric && fabric.seller.country !== design.designer.country) {
      return res.status(400).json({
        success: false,
        message: 'Fabric seller and designer must be in the same country for standard processing.',
      });
    }

    // Check selected fabric stock
    if (hasCustomerSelectedFabric && fabric && fabric.stockYards < selectedYards) {
      return res.status(400).json({
        success: false,
        message: `Not enough fabric in stock. Available: ${fabric.stockYards} yards`,
      });
    }

    // Calculate prices
    const fabricPrice = hasCustomerSelectedFabric && fabric ? Number(fabric.finalPrice) * selectedYards : 0;
    const designPrice = Number(design.finalPrice);
    const subtotalBeforeDiscount = fabricPrice + designPrice;
    const discountUsd = Math.max(0, Math.min(Number(data.discountUsd || 0), subtotalBeforeDiscount));
    const subtotal = subtotalBeforeDiscount - discountUsd;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 25;
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const workflowSettings = await readOrderWorkflowSettings();
    const autoProcessingEligible = canAutoProcessOrder({
      processingMode: workflowSettings.processingMode,
      criteria: workflowSettings.autoProcessCriteria,
      isPaymentConfirmed,
      hasShippingProvider: Boolean(data.shippingProviderKey || data.shippingProviderName),
      hasShippingAddress: Boolean(address.id),
      hasItems: true,
    });
    const effectiveWorkflowSettings = {
      ...workflowSettings,
      processingMode: autoProcessingEligible ? workflowSettings.processingMode : 'MANUAL',
    } as typeof workflowSettings;
    const initialStatus = determinePostPaymentStatus({
      isPaymentConfirmed,
      orderType: OrderType.CUSTOM_DESIGN,
      hasFabricOrder: hasCustomerSelectedFabric,
      settings: effectiveWorkflowSettings,
    });

    // Generate order number
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...address,
        shippingQuoteId: data.shippingQuoteId || null,
        shippingProviderKey: data.shippingProviderKey || null,
        shippingProviderName: data.shippingProviderName || null,
        shippingServiceName: data.shippingServiceName || null,
        shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
        shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
      },
      settings: effectiveWorkflowSettings,
      status: initialStatus,
      note: wantsDesignerToChooseFabric
        ? 'Customer requested designer-selected fabric.'
        : 'Customer selected fabric.',
    });

    // Create order with all components
    const order = await prisma.$transaction(async (tx) => {
      // Create main order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.CUSTOM_DESIGN,
          customerId,
          shippingAddress: shippingSnapshot as any,
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
              status: initialStatus === OrderStatus.IN_PRODUCTION ? 'IN_PRODUCTION' : 'PENDING',
              productionNotes: wantsDesignerToChooseFabric
                ? String(data.fabricPreferenceNotes || '').trim() ||
                  'Customer requested designer-selected fabric.'
                : null,
            },
          },
          ...(hasCustomerSelectedFabric && fabric
            ? {
                fabricOrder: {
                  create: {
                    fabricId: data.fabricId!,
                    sellerId: fabric.sellerId,
                    yards: selectedYards,
                    pricePerYard: fabric.finalPrice,
                    totalPrice: fabricPrice,
                    status: 'PENDING',
                  },
                },
              }
            : {}),
          // Create timeline entry
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? `Order created and payment confirmed${
                    wantsDesignerToChooseFabric ? ' (Designer will select fabric)' : ''
                  }${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`
                : `Order created, awaiting payment${
                    wantsDesignerToChooseFabric ? ' (Designer will select fabric)' : ''
                  }${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`,
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
      if (isPaymentConfirmed && hasCustomerSelectedFabric && data.fabricId) {
        await tx.fabric.update({
          where: { id: data.fabricId },
          data: { stockYards: { decrement: selectedYards } },
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
    void notifyOrderLifecycle({
      orderId: order.id,
      status: initialStatus,
      notes: wantsDesignerToChooseFabric
        ? 'Customer selected designer-decides-fabric mode.'
        : 'Customer selected fabric and measurements.',
      actorRole: UserRole.CUSTOMER,
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
      color: string;
      quantity: number;
      price: number;
      sizeVariationId: string;
    };

    const schema = z.object({
      items: z.array(z.object({
        readyToWearId: z.string().uuid(),
        size: z.string(),
        color: z.string().optional(),
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
      promoCode: z.string().trim().max(30).optional(),
      discountUsd: z.number().min(0).optional(),
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
      const requestedSize = normalizeReadyToWearSize(item.size);
      const hasRequestedColor = String(item.color || '').trim().length > 0;
      const requestedColor = normalizeReadyToWearColor(item.color);
      const requestedVariantKey = encodeReadyToWearVariantKey(requestedSize, requestedColor);
      const product = await prisma.readyToWear.findFirst({
        where: {
          id: item.readyToWearId,
          status: ProductStatus.APPROVED,
          isAvailable: true,
        },
        include: {
          sizeVariations: true,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.readyToWearId}`,
        });
      }

      const exactVariant = product.sizeVariations.find(
        (row) => String(row.size || '').toUpperCase() === requestedVariantKey
      );
      const sizeFallbackVariant = product.sizeVariations.find((row) => {
        const decoded = decodeReadyToWearVariantKey(row.size);
        return decoded.size === requestedSize;
      });
      const matchingVariant = hasRequestedColor ? exactVariant || null : exactVariant || sizeFallbackVariant || null;
      if (!matchingVariant) {
        return res.status(400).json({
          success: false,
          message: `Variant ${requestedSize}/${requestedColor} not available for ${product.name}`,
        });
      }

      const sizeVar = matchingVariant;
      const selectedVariant = decodeReadyToWearVariantKey(sizeVar.size);
      if (sizeVar.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${product.name} in ${selectedVariant.size}/${selectedVariant.color}. Available: ${sizeVar.stock}`,
        });
      }

      const itemTotal = Number(sizeVar.price) * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        readyToWearId: item.readyToWearId,
        size: selectedVariant.size,
        color: selectedVariant.color,
        quantity: item.quantity,
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
    const discountUsd = Math.max(0, Math.min(Number(data.discountUsd || 0), subtotal));
    subtotal = subtotal - discountUsd;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 15;
    const tax = subtotal * 0.08;
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const workflowSettings = await readOrderWorkflowSettings();
    const autoProcessingEligible = canAutoProcessOrder({
      processingMode: workflowSettings.processingMode,
      criteria: workflowSettings.autoProcessCriteria,
      isPaymentConfirmed,
      hasShippingProvider: Boolean(data.shippingProviderKey || data.shippingProviderName),
      hasShippingAddress: Boolean(address.id),
      hasItems: validatedItems.length > 0,
    });
    const effectiveWorkflowSettings = {
      ...workflowSettings,
      processingMode: autoProcessingEligible ? workflowSettings.processingMode : 'MANUAL',
    } as typeof workflowSettings;
    const initialStatus = determinePostPaymentStatus({
      isPaymentConfirmed,
      orderType: OrderType.READY_TO_WEAR,
      hasFabricOrder: false,
      settings: effectiveWorkflowSettings,
    });

    // Generate order number
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...address,
        shippingQuoteId: data.shippingQuoteId || null,
        shippingProviderKey: data.shippingProviderKey || null,
        shippingProviderName: data.shippingProviderName || null,
        shippingServiceName: data.shippingServiceName || null,
        shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
        shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
      },
      settings: effectiveWorkflowSettings,
      status: initialStatus,
      note: 'Ready-to-wear order queued for fulfillment.',
    });

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.READY_TO_WEAR,
          customerId,
          shippingAddress: shippingSnapshot as any,
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
              size: item.color === DEFAULT_READY_TO_WEAR_COLOR ? item.size : `${item.size} / ${item.color}`,
              price: item.price,
              quantity: item.quantity,
            })),
          },
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? `Ready-to-wear order created and payment confirmed${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`
                : `Ready-to-wear order created, awaiting payment${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`,
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
    void notifyOrderLifecycle({
      orderId: order.id,
      status: initialStatus,
      notes: 'Ready-to-wear order submitted.',
      actorRole: UserRole.CUSTOMER,
    });
  } catch (error) {
    next(error);
  }
});

// Create fabric-only order
router.post('/fabric-only', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    const schema = z.object({
      fabricId: z.string().uuid(),
      yards: z.number().int().min(1),
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
      promoCode: z.string().trim().max(30).optional(),
      discountUsd: z.number().min(0).optional(),
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

    const [fabric, address] = await Promise.all([
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

    if (!fabric) {
      return res.status(404).json({ success: false, message: 'Fabric not found.' });
    }
    if (!address) {
      return res.status(404).json({ success: false, message: 'Shipping address not found.' });
    }
    if (fabric.stockYards < data.yards) {
      return res.status(400).json({
        success: false,
        message: `Not enough fabric in stock. Available: ${fabric.stockYards} yards`,
      });
    }

    const subtotalBeforeDiscount = Number(fabric.finalPrice) * data.yards;
    const discountUsd = Math.max(0, Math.min(Number(data.discountUsd || 0), subtotalBeforeDiscount));
    const subtotal = subtotalBeforeDiscount - discountUsd;
    const shippingCost = Number.isFinite(Number(data.shippingCostUsd)) ? Number(data.shippingCostUsd) : 15;
    const tax = subtotal * 0.08;
    const total = subtotal + shippingCost + tax;
    const isPaymentConfirmed = Boolean(data.paymentIntentId);
    const workflowSettings = await readOrderWorkflowSettings();
    const autoProcessingEligible = canAutoProcessOrder({
      processingMode: workflowSettings.processingMode,
      criteria: workflowSettings.autoProcessCriteria,
      isPaymentConfirmed,
      hasShippingProvider: Boolean(data.shippingProviderKey || data.shippingProviderName),
      hasShippingAddress: Boolean(address.id),
      hasItems: Number(data.yards || 0) > 0,
    });
    const effectiveWorkflowSettings = {
      ...workflowSettings,
      processingMode: autoProcessingEligible ? workflowSettings.processingMode : 'MANUAL',
    } as typeof workflowSettings;
    const initialStatus = determinePostPaymentStatus({
      isPaymentConfirmed,
      orderType: OrderType.FABRIC_ONLY,
      hasFabricOrder: true,
      settings: effectiveWorkflowSettings,
    });
    const orderNumber = `AF-${Date.now().toString(36).toUpperCase()}`;

    const shippingSnapshot = appendWorkflowMetadataToShippingAddress({
      shippingAddress: {
        ...address,
        shippingQuoteId: data.shippingQuoteId || null,
        shippingProviderKey: data.shippingProviderKey || null,
        shippingProviderName: data.shippingProviderName || null,
        shippingServiceName: data.shippingServiceName || null,
        shippingEtaMinDays: Number.isFinite(Number(data.shippingEtaMinDays)) ? Number(data.shippingEtaMinDays) : null,
        shippingEtaMaxDays: Number.isFinite(Number(data.shippingEtaMaxDays)) ? Number(data.shippingEtaMaxDays) : null,
      },
      settings: effectiveWorkflowSettings,
      status: initialStatus,
      note: 'Fabric order queued for seller fulfillment.',
    });

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: OrderType.FABRIC_ONLY,
          customerId,
          shippingAddress: shippingSnapshot as any,
          subtotal,
          shippingCost,
          tax,
          total,
          paymentMethod: data.paymentMethod,
          paymentIntentId: data.paymentIntentId,
          paymentStatus: isPaymentConfirmed ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
          paidAt: isPaymentConfirmed ? new Date() : null,
          status: initialStatus,
          fabricOrder: {
            create: {
              fabricId: data.fabricId,
              sellerId: fabric.sellerId,
              yards: data.yards,
              pricePerYard: fabric.finalPrice,
              totalPrice: subtotal,
              status: 'PENDING',
            },
          },
          timeline: {
            create: {
              status: initialStatus,
              notes: isPaymentConfirmed
                ? `Fabric-only order created and payment confirmed${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`
                : `Fabric-only order created, awaiting payment${discountUsd > 0 ? ` (Promo ${String(data.promoCode || 'DISCOUNT').toUpperCase()}: -$${discountUsd.toFixed(2)})` : ''}`,
              updatedById: customerId,
              updatedByRole: UserRole.CUSTOMER,
            },
          },
        },
        include: {
          fabricOrder: true,
        },
      });

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
      message: 'Fabric order created successfully. Please complete payment.',
      data: order,
    });
    void sendOrderConfirmationEmail({
      to: req.user!.email,
      orderNumber: order.orderNumber,
      orderType: 'Fabric To Buy',
      total,
      itemCount: data.yards,
    }).catch((error) => {
      console.error('Failed to send fabric-only order confirmation email:', error);
    });
    void notifyOrderLifecycle({
      orderId: order.id,
      status: initialStatus,
      notes: 'Fabric-only order submitted.',
      actorRole: UserRole.CUSTOMER,
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
        readyToWearItems: {
          include: {
            readyToWear: {
              select: { designerId: true },
            },
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
    } else if (user.role === UserRole.FASHION_DESIGNER) {
      const designerProfile = await prisma.designerProfile.findFirst({
        where: { userId: user.id },
      });
      const ownsDesignOrder = Boolean(designerProfile && order.designOrder && order.designOrder.designerId === designerProfile.id);
      const ownsReadyToWearOrder = Boolean(
        designerProfile &&
          (order.readyToWearItems || []).some(
            (item) => String(item.readyToWear?.designerId || '') === String(designerProfile.id)
          )
      );
      if (designerProfile && ownsDesignOrder) {
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
      if (designerProfile && ownsReadyToWearOrder) {
        const readyStatuses = ['CONFIRMED', 'IN_PRODUCTION', 'COMPLETED', 'QA_PENDING'] as const;
        const readyToOrderStatus: Record<(typeof readyStatuses)[number], OrderStatus> = {
          CONFIRMED: OrderStatus.PAYMENT_CONFIRMED,
          IN_PRODUCTION: OrderStatus.IN_PRODUCTION,
          COMPLETED: OrderStatus.PRODUCTION_COMPLETE,
          QA_PENDING: OrderStatus.QA_PENDING,
        };
        if ((readyStatuses as readonly string[]).includes(status)) {
          canUpdate = true;
          timelineStatus = readyToOrderStatus[status as (typeof readyStatuses)[number]];
          updateData.status = timelineStatus;
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

    const workflowSettings = await readOrderWorkflowSettings();
    updateData.shippingAddress = appendWorkflowMetadataToShippingAddress({
      shippingAddress: order.shippingAddress,
      settings: workflowSettings,
      status: timelineStatus,
      note: notes || `Status updated to ${status}`,
    }) as any;
    if (timelineStatus === OrderStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
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
    void notifyOrderLifecycle({
      orderId: id,
      status: timelineStatus,
      notes,
      actorRole: user.role,
    });

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
