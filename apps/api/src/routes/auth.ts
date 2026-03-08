import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma, UserRole, UserStatus } from '../db';
import { generateToken, authenticate } from '../middleware/auth';
import { getRolePermissions, ROLE_HOME_ROUTE } from '../rbac';
import { bootstrapAdminConfig } from '../bootstrap';

const router = Router();

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
      status: data.role === 'CUSTOMER' ? UserStatus.ACTIVE : UserStatus.PENDING, // Sellers/designers need approval
    };

    // Add role-specific profile
    if (data.role === 'CUSTOMER') {
      userData.customerProfile = {
        create: {},
      };
    } else if (data.role === 'FABRIC_SELLER') {
      if (!data.businessName || !data.country || !data.city) {
        return res.status(400).json({
          success: false,
          message: 'Business name, country, and city are required for fabric sellers.',
        });
      }
      userData.fabricSellerProfile = {
        create: {
          businessName: data.businessName,
          businessEmail: data.businessEmail || data.email,
          businessPhone: data.businessPhone || data.phone,
          country: data.country,
          city: data.city,
          address: data.address || '',
        },
      };
    } else if (data.role === 'FASHION_DESIGNER') {
      if (!data.businessName || !data.country || !data.city) {
        return res.status(400).json({
          success: false,
          message: 'Business name, country, and city are required for designers.',
        });
      }
      userData.designerProfile = {
        create: {
          businessName: data.businessName,
          businessEmail: data.businessEmail || data.email,
          businessPhone: data.businessPhone || data.phone,
          bio: data.bio,
          country: data.country,
          city: data.city,
          address: data.address || '',
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

    // Only ACTIVE users should receive an authentication token immediately.
    const token = user.status === UserStatus.ACTIVE
      ? generateToken({
          id: user.id,
          email: user.email,
          role: user.role as UserRole,
        })
      : null;

    res.status(201).json({
      success: true,
      message: data.role === 'CUSTOMER' 
        ? 'Registration successful! Welcome to African Fashion.'
        : 'Registration submitted! Your account is pending approval.',
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
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: data.email, mode: 'insensitive' },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password (supports legacy plain-text rows and bootstrap reset for default admin)
    let isValidPassword = await bcrypt.compare(data.password, user.password);
    const looksLikeBcrypt = /^\$2[aby]\$\d{2}\$/.test(user.password);
    if (!isValidPassword && !looksLikeBcrypt && data.password === user.password) {
      isValidPassword = true;
      const upgradedPassword = await bcrypt.hash(data.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: upgradedPassword },
      });
    }

    const isBootstrapAdminAttempt =
      data.email === bootstrapAdminConfig.email &&
      data.password === bootstrapAdminConfig.password &&
      user.role === UserRole.ADMINISTRATOR;

    if (!isValidPassword && isBootstrapAdminAttempt) {
      const repairedPassword = await bcrypt.hash(bootstrapAdminConfig.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: repairedPassword,
          status: UserStatus.ACTIVE,
        },
      });
      isValidPassword = true;
      user.status = UserStatus.ACTIVE;
    }

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Check status
    if (user.status === UserStatus.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin verification.',
      });
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

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
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
          permissions: getRolePermissions(user.role),
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
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        customerProfile: {
          include: {
            addresses: true,
          },
        },
        fabricSellerProfile: true,
        designerProfile: true,
        qaProfile: true,
        adminProfile: true,
      },
    });

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
          permissions: getRolePermissions(user.role),
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
  // In a more advanced setup, we could blacklist the token
  res.json({
    success: true,
    message: 'Logout successful.',
  });
});

export default router;
