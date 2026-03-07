import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, UserRole, UserStatus } from '../db';
import { generateToken, authenticate } from '../middleware/auth';
import { getRolePermissions, ROLE_HOME_ROUTE, sanitizePermissionGrants } from '../rbac';
import { isBrandNameTaken } from '../utils/vendor-profile';

const router = Router();

const VENDOR_TRACKED_ROLES: UserRole[] = [UserRole.FABRIC_SELLER, UserRole.FASHION_DESIGNER];

function extractRequestIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] || '').trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.ip || '';
}

function extractUserAgent(req: Request) {
  const value = req.headers['user-agent'];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return String(value[0] || '');
  return '';
}

function inferDeviceType(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (!ua) return 'unknown';
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) return 'bot';
  return 'desktop';
}

async function logVendorSessionEvent(
  req: Request,
  options: {
    userId: string;
    action: 'VENDOR_SESSION_STARTED' | 'VENDOR_SESSION_REPLACED' | 'VENDOR_SESSION_LOGOUT';
    role: UserRole;
    sessionIssuedAt?: number;
    previousSessionAt?: string | null;
  }
) {
  const ipAddress = extractRequestIp(req);
  const userAgent = extractUserAgent(req);
  try {
    await prisma.activityLog.create({
      data: {
        userId: options.userId,
        action: options.action,
        details: {
          role: options.role,
          deviceType: inferDeviceType(userAgent),
          sessionIssuedAt: options.sessionIssuedAt || null,
          previousSessionAt: options.previousSessionAt || null,
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error('Failed to write vendor session audit event:', error);
  }
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(['CUSTOMER', 'FABRIC_SELLER', 'FASHION_DESIGNER']),
  // Role-specific fields
  businessName: z.string().optional(),
  businessEmail: z.string().email().optional(),
  businessPhone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

const isSchemaDriftError = (error: any) => {
  const code = String(error?.code || '');
  return code === 'P2021' || code === 'P2022';
};

const loginUserSelectWithAdminRbac = {
  adminProfile: {
    select: {
      permissions: true,
      adminRoleId: true,
      adminRole: {
        select: {
          permissions: true,
        },
      },
    },
  },
};

const loginUserSelectLegacy = {
  adminProfile: {
    select: {
      permissions: true,
    },
  },
};

const loadUserForLogin = async (email: string) => {
  try {
    return await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
      },
      include: loginUserSelectWithAdminRbac as any,
    });
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    return prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
      },
      include: loginUserSelectLegacy as any,
    });
  }
};

const meUserIncludeWithAdminRbac = {
  customerProfile: {
    include: {
      addresses: true,
    },
  },
  fabricSellerProfile: true,
  designerProfile: true,
  qaProfile: true,
  adminProfile: {
    include: {
      adminRole: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
    },
  },
};

const meUserIncludeLegacy = {
  customerProfile: {
    include: {
      addresses: true,
    },
  },
  fabricSellerProfile: true,
  designerProfile: true,
  qaProfile: true,
  adminProfile: true,
};

const loadUserForMe = async (userId: string) => {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: meUserIncludeWithAdminRbac as any,
    });
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    return prisma.user.findUnique({
      where: { id: userId },
      include: meUserIncludeLegacy as any,
    });
  }
};

const resolveAccessPermissions = (user: any) => {
  const rolePermissions = getRolePermissions(user.role as UserRole) as string[];
  if (user.role !== UserRole.ADMINISTRATOR) {
    return rolePermissions;
  }
  const adminRolePermissions = sanitizePermissionGrants(user?.adminProfile?.adminRole?.permissions);
  const adminUserPermissions = sanitizePermissionGrants(user?.adminProfile?.permissions);
  if (adminUserPermissions.length > 0) return adminUserPermissions;
  if (adminRolePermissions.length > 0) return adminRolePermissions;
  return rolePermissions;
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const namesFromFullName = data.fullName ? data.fullName.trim().split(/\s+/) : [];
    const firstName = (data.firstName || namesFromFullName[0] || '').trim();
    const lastName = (data.lastName || namesFromFullName.slice(1).join(' ') || firstName).trim();

    if (firstName.length < 2 || lastName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required.',
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: data.email, mode: 'insensitive' },
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login or use a different email.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user with role-specific profile
    const userData: any = {
      email: data.email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: data.phone,
      role: data.role as UserRole,
      // Vendors can log in immediately to complete profile details.
      status: UserStatus.ACTIVE,
    };

    // Add role-specific profile
    if (data.role === 'CUSTOMER') {
      userData.customerProfile = {
        create: {},
      };
    } else if (data.role === 'FABRIC_SELLER') {
      const requestedBrandName = data.businessName?.trim();
      let businessName = requestedBrandName || `${firstName} ${lastName}`.trim() || `seller-${Date.now()}`;
      let brandTaken = await isBrandNameTaken(businessName);
      if (!requestedBrandName) {
        let suffix = 2;
        while (brandTaken && suffix < 50) {
          businessName = `${businessName}-${suffix}`;
          brandTaken = await isBrandNameTaken(businessName);
          suffix += 1;
        }
      }
      if (brandTaken) {
        return res.status(409).json({
          success: false,
          message: 'Business name is already in use. Please choose a different brand name.',
        });
      }
      userData.fabricSellerProfile = {
        create: {
          businessName,
          businessEmail: data.businessEmail || data.email,
          businessPhone: data.businessPhone || data.phone,
          country: data.country || 'TBD',
          city: data.city || 'TBD',
          address: data.address || '',
          profileStatus: 'INCOMPLETE',
        },
      };
    } else if (data.role === 'FASHION_DESIGNER') {
      const requestedBrandName = data.businessName?.trim();
      let businessName = requestedBrandName || `${firstName} ${lastName}`.trim() || `designer-${Date.now()}`;
      let brandTaken = await isBrandNameTaken(businessName);
      if (!requestedBrandName) {
        let suffix = 2;
        while (brandTaken && suffix < 50) {
          businessName = `${businessName}-${suffix}`;
          brandTaken = await isBrandNameTaken(businessName);
          suffix += 1;
        }
      }
      if (brandTaken) {
        return res.status(409).json({
          success: false,
          message: 'Business name is already in use. Please choose a different brand name.',
        });
      }
      userData.designerProfile = {
        create: {
          businessName,
          businessEmail: data.businessEmail || data.email,
          businessPhone: data.businessPhone || data.phone,
          bio: data.bio,
          country: data.country || 'TBD',
          city: data.city || 'TBD',
          address: data.address || '',
          profileStatus: 'INCOMPLETE',
        },
      };
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    const sessionIssuedAt = Date.now();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(sessionIssuedAt) },
    });
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      sessionIssuedAt,
    });

    res.status(201).json({
      success: true,
      message:
        data.role === 'CUSTOMER'
          ? 'Registration successful! Welcome to ZuriKaribu.'
          : 'Registration successful. Please complete your vendor profile for admin approval.',
      data: {
        user,
        token,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role as UserRole],
          permissions: getRolePermissions(user.role as UserRole),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const user = await loadUserForLogin(data.email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check status
    if (user.status === UserStatus.PENDING && user.role === UserRole.CUSTOMER) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin verification.',
      });
    }

    if (
      user.status === UserStatus.PENDING &&
      (user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER)
    ) {
      // Allowed: pending vendors can log in to complete profile data.
    }

    if (user.status === UserStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    if (user.status === UserStatus.REJECTED) {
      return res.status(403).json({
        success: false,
        message: 'Your registration was not approved. Please contact support for more information.',
      });
    }

    // Update last login. This acts as session versioning for one-device login.
    const sessionIssuedAt = Date.now();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(sessionIssuedAt) },
    });

    if (VENDOR_TRACKED_ROLES.includes(user.role)) {
      await logVendorSessionEvent(req, {
        userId: user.id,
        role: user.role,
        action: user.lastLogin ? 'VENDOR_SESSION_REPLACED' : 'VENDOR_SESSION_STARTED',
        sessionIssuedAt,
        previousSessionAt: user.lastLogin ? user.lastLogin.toISOString() : null,
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionIssuedAt,
    });

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
        },
        token,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role],
          permissions: resolveAccessPermissions(user),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await loadUserForMe(req.user!.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        profile: user.customerProfile || user.fabricSellerProfile || user.designerProfile || user.qaProfile || user.adminProfile,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role],
          permissions: resolveAccessPermissions(user),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update profile
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        firstName,
        lastName,
        phone,
        avatar,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// Logout (client-side token removal, but we can track it if needed)
router.post('/logout', authenticate, async (req, res) => {
  if (req.user?.role === UserRole.FABRIC_SELLER || req.user?.role === UserRole.FASHION_DESIGNER) {
    const sessionTerminatedAt = Date.now();
    // Rotate seller/designer session marker so current JWT cannot be reused.
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastLogin: new Date(sessionTerminatedAt) },
    });
    await logVendorSessionEvent(req, {
      userId: req.user.id,
      role: req.user.role,
      action: 'VENDOR_SESSION_LOGOUT',
      sessionIssuedAt: sessionTerminatedAt,
    });
  }

  res.json({
    success: true,
    message: 'Logout successful.',
  });
});

export default router;
