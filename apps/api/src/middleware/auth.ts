import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { prisma, UserRole, UserStatus } from '../db';
import {
  Permission,
  Permissions,
  getRolePermissions,
  hasAnyPermission,
  hasAnyPermissionFromGrants,
  sanitizePermissionGrants,
} from '../rbac';
import { isEnterpriseSubscriptionActive, readEnterpriseActorContext } from '../utils/enterprise';
import { readPasswordPolicyForUser } from '../utils/password-policy';

// JWT Secret - must be set in production
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  console.warn('WARNING: JWT_SECRET not set. Using ephemeral development secret.');
}

const SECRET = JWT_SECRET || randomBytes(32).toString('hex');
const SINGLE_SESSION_ROLES = new Set<UserRole>([
  UserRole.ADMINISTRATOR,
  UserRole.FABRIC_SELLER,
  UserRole.FASHION_DESIGNER,
  UserRole.RESELLER_INFLUENCER,
]);

const normalizeVendorRejectionType = (value: unknown): 'TEMPORARY' | 'PERMANENT' | null => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'TEMPORARY' || normalized === 'PERMANENT') return normalized;
  return null;
};

async function readVendorRejectionSnapshot(userId: string, role: UserRole) {
  if (role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "profileStatus","rejectionType","permanentDisableAt"
       FROM "VendorProfileSubmission"
       WHERE "role"::text = $1 AND "userId" = $2
       ORDER BY COALESCE("updatedAt","profileReviewedAt","profileSubmittedAt") DESC NULLS LAST
       LIMIT 1`,
      role,
      userId
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    return {
      profileStatus: String(row?.profileStatus || '').toUpperCase(),
      rejectionType: normalizeVendorRejectionType(row?.rejectionType),
      permanentDisableAt: row?.permanentDisableAt ? new Date(row.permanentDisableAt) : null,
    };
  } catch {
    return null;
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        firstName: string;
        lastName: string;
        permissions?: string[];
        actorUserId?: string;
        enterpriseOwnerUserId?: string;
        enterpriseSubAccountId?: string;
        enterprisePermissions?: string[];
        requirePasswordChange?: boolean;
      };
    }
  }
}

// Generate JWT token
export function generateToken(user: { id: string; email: string; role: UserRole; sessionIssuedAt?: number }) {
  const sessionIssuedAt = Number(user.sessionIssuedAt) > 0 ? Number(user.sessionIssuedAt) : Date.now();
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, sessionIssuedAt },
    SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
export function verifyToken(token: string): {
  id: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  sessionIssuedAt?: number;
} {
  return jwt.verify(token, SECRET) as {
    id: string;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
    sessionIssuedAt?: number;
  };
}

const getTokenIssuedAtMs = (decoded: { iat?: number; sessionIssuedAt?: number }) => {
  const issuedAt = Number(decoded.sessionIssuedAt);
  if (Number.isFinite(issuedAt) && issuedAt > 0) return issuedAt;
  const iatMs = Number(decoded.iat) * 1000;
  if (Number.isFinite(iatMs) && iatMs > 0) return iatMs;
  return 0;
};

const hasEnterpriseCapability = (permissions: string[] | undefined, capability: string) => {
  if (!Array.isArray(permissions) || permissions.length === 0) return false;
  return (
    permissions.includes('*') ||
    permissions.includes('ALL') ||
    permissions.includes('all') ||
    permissions.includes(capability)
  );
};

const resolveRequiredEnterpriseCapability = (req: Request, role: UserRole): string | null => {
  const path = String(req.originalUrl || req.url || '')
    .split('?')[0]
    .toLowerCase();
  const method = String(req.method || 'GET').toUpperCase();
  if (path.startsWith('/api/enterprise') || path.startsWith('/api/admin/enterprise') || path.startsWith('/api/auth')) {
    return null;
  }
  if (path.startsWith('/api/upload')) return 'products:manage';
  if (path.startsWith('/api/payments/vendor')) {
    return method === 'GET' ? 'payments:view' : 'payments:manage';
  }
  if (path.startsWith('/api/orders')) {
    if (path.includes('/status') && method !== 'GET') return 'orders:update';
    return method === 'GET' ? 'orders:view' : null;
  }
  const isSellerOrDesignerRoute =
    path.startsWith('/api/fabric-seller') || path.startsWith('/api/seller') || path.startsWith('/api/designer');
  if (!isSellerOrDesignerRoute) return null;

  if (path.includes('/try-on')) return 'tryon:view';
  if (path.includes('/dashboard') || path.includes('/profile-completion')) {
    if (path.includes('/profile-completion') && method !== 'GET') return 'governance:submit';
    return 'dashboard:view';
  }
  if (path.includes('/featured')) return 'featured:manage';
  if (path.includes('/orders')) {
    if (method === 'GET') return 'orders:view';
    return 'orders:update';
  }
  if (
    path.includes('/fabrics') ||
    path.includes('/designs') ||
    path.includes('/ready-to-wear') ||
    path.includes('/products')
  ) {
    if (method === 'GET') return 'products:view';
    return 'products:manage';
  }
  if (role === UserRole.FABRIC_SELLER || role === UserRole.FASHION_DESIGNER) {
    if (method === 'GET') return 'dashboard:view';
  }
  return null;
};

// Authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    // Fetch full user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLogin: true,
        adminProfile: {
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER) {
      const rejection = await readVendorRejectionSnapshot(user.id, user.role);
      if (
        rejection?.profileStatus === 'REJECTED' &&
        rejection.rejectionType === 'PERMANENT' &&
        rejection.permanentDisableAt &&
        rejection.permanentDisableAt.getTime() <= Date.now()
      ) {
        if (user.status !== UserStatus.SUSPENDED) {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: UserStatus.SUSPENDED },
          });
        }
        return res.status(403).json({
          success: false,
          message:
            'Your vendor account has been permanently disabled after rejection. Please contact support.',
        });
      }
      if (user.status === UserStatus.REJECTED) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: UserStatus.ACTIVE },
        });
        (user as any).status = UserStatus.ACTIVE;
      }
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.',
      });
    }
    if (SINGLE_SESSION_ROLES.has(user.role)) {
      const tokenIssuedAtMs = getTokenIssuedAtMs(decoded);
      const latestSessionMs = user.lastLogin ? new Date(user.lastLogin).getTime() : 0;
      if (
        tokenIssuedAtMs > 0 &&
        latestSessionMs > 0 &&
        tokenIssuedAtMs + 1000 < latestSessionMs
      ) {
        return res.status(401).json({
          success: false,
          message:
            'You were signed out because your account logged in on another device.',
        });
      }
    }

    const rolePermissions = getRolePermissions(user.role) as string[];
    const adminUserPermissions =
      user.role === 'ADMINISTRATOR'
        ? sanitizePermissionGrants((user as any)?.adminProfile?.permissions)
        : [];
    const effectivePermissions = adminUserPermissions.length > 0 ? adminUserPermissions : rolePermissions;
    const passwordPolicy = await readPasswordPolicyForUser(user.id);
    const requirePasswordChange = passwordPolicy.requiresPasswordChange;
    const requestPath = String(req.originalUrl || req.url || '').split('?')[0].toLowerCase();
    const allowPasswordResetBypass =
      requestPath.startsWith('/api/auth/change-password') ||
      requestPath.startsWith('/api/auth/me') ||
      requestPath.startsWith('/api/auth/logout');
    if (requirePasswordChange && !allowPasswordResetBypass) {
      return res.status(428).json({
        success: false,
        message: 'Password change required before accessing this resource.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    let actorUserId = user.id;
    let effectiveUserId = user.id;
    let enterpriseOwnerUserId: string | undefined;
    let enterpriseSubAccountId: string | undefined;
    let enterprisePermissions: string[] | undefined;

    if (user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER) {
      const enterpriseContext = await readEnterpriseActorContext(user.id, user.role);
      if (enterpriseContext?.enterpriseAccount && enterpriseContext.enterpriseAccount.isEnterprise) {
        const lowerUrl = String(req.originalUrl || req.url || '').toLowerCase();
        const isEnterpriseManagementPath =
          lowerUrl.startsWith('/api/enterprise') || lowerUrl.startsWith('/api/admin/enterprise');
        const subscriptionActive = isEnterpriseSubscriptionActive(enterpriseContext.enterpriseAccount);
        if (!subscriptionActive && !isEnterpriseManagementPath) {
          return res.status(403).json({
            success: false,
            message:
              'Your enterprise subscription is inactive or expired. Renew your enterprise plan to continue.',
          });
        }
        if (enterpriseContext.isSubAccount) {
          enterprisePermissions = Array.isArray(enterpriseContext.permissions)
            ? enterpriseContext.permissions
            : [];
          enterpriseOwnerUserId = enterpriseContext.ownerUserId || undefined;
          enterpriseSubAccountId = enterpriseContext.subAccountId || undefined;
          const requiredCapability = resolveRequiredEnterpriseCapability(req, user.role);
          if (requiredCapability && !hasEnterpriseCapability(enterprisePermissions, requiredCapability)) {
            return res.status(403).json({
              success: false,
              message:
                'Your enterprise sub-account role does not have permission for this action.',
            });
          }
          const shouldScopeToOwner =
            !lowerUrl.startsWith('/api/auth') &&
            !lowerUrl.startsWith('/api/enterprise') &&
            !lowerUrl.startsWith('/api/admin/enterprise');
          if (shouldScopeToOwner && enterpriseContext.ownerUserId) {
            effectiveUserId = enterpriseContext.ownerUserId;
          }
        } else {
          enterprisePermissions = ['*'];
        }
      }
    }

    req.user = {
      id: effectiveUserId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions: effectivePermissions,
      actorUserId,
      enterpriseOwnerUserId,
      enterpriseSubAccountId,
      enterprisePermissions,
      requirePasswordChange,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
}

// Role-based authorization middleware
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }

    next();
  };
}

// Permission-based authorization middleware (RBAC)
export function authorizePermissions(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const permissionGrants =
      Array.isArray(req.user.permissions) && req.user.permissions.length > 0 ? req.user.permissions : null;
    const canAccess = permissionGrants
      ? hasAnyPermissionFromGrants(permissionGrants, requiredPermissions)
      : hasAnyPermission(req.user.role, requiredPermissions);

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.',
      });
    }

    next();
  };
}

export function isSuperAdminPermissions(grants: string[] | undefined | null): boolean {
  const normalized = sanitizePermissionGrants(Array.isArray(grants) ? grants : []);
  const exact = new Set(normalized.map((entry) => String(entry || '').trim()));
  const lower = new Set(normalized.map((entry) => String(entry || '').trim().toLowerCase()));
  if (exact.has('*') || exact.has('ALL') || lower.has('all')) {
    return true;
  }
  const allPermissionKeys = Object.values(Permissions);
  const hasAllPermissions = allPermissionKeys.every((permission) => exact.has(permission));
  if (hasAllPermissions) {
    return true;
  }
  const controlPlanePermissions = [
    Permissions.ADMIN_ROLE_MANAGE,
    Permissions.USERS_MANAGE,
    Permissions.HOMEPAGE_MANAGE,
    Permissions.MODULES_MANAGE,
  ];
  return controlPlanePermissions.every((permission) => exact.has(permission));
}

export function authorizeSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }
  if (!isSuperAdminPermissions(req.user.permissions)) {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access is required for this resource.',
    });
  }
  next();
}

// Optional authentication (for public routes that can be enhanced for logged-in users)
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        status: true,
        lastLogin: true,
        adminProfile: {
          select: {
            permissions: true,
          },
        },
      },
    });

    if (user && user.status === 'ACTIVE') {
      if (SINGLE_SESSION_ROLES.has(user.role)) {
        const tokenIssuedAtMs = getTokenIssuedAtMs(decoded);
        const latestSessionMs = user.lastLogin ? new Date(user.lastLogin).getTime() : 0;
        if (tokenIssuedAtMs > 0 && latestSessionMs > 0 && tokenIssuedAtMs + 1000 < latestSessionMs) {
          return next();
        }
      }
      const rolePermissions = getRolePermissions(user.role) as string[];
      const adminUserPermissions =
        user.role === 'ADMINISTRATOR'
          ? sanitizePermissionGrants((user as any)?.adminProfile?.permissions)
          : [];
      const effectivePermissions = adminUserPermissions.length > 0 ? adminUserPermissions : rolePermissions;

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        permissions: effectivePermissions,
      };
    }

    next();
  } catch (error) {
    // Continue without user
    next();
  }
}
