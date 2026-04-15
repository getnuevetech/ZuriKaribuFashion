import { NextFunction, Request, Response } from 'express';
import { ModuleKey, resolveModuleAccessDecision } from '../utils/module-runtime';

const resolveFailureMessage = (code: string, moduleKey: string) => {
  if (code === 'MODULE_MAINTENANCE') {
    return `Module "${moduleKey}" is currently in maintenance mode.`;
  }
  if (code === 'MODULE_SCOPE_BLOCKED') {
    return `Module "${moduleKey}" is currently not available for your access scope.`;
  }
  return `Module "${moduleKey}" is currently disabled.`;
};

export const requireModuleAccess = (moduleKey: ModuleKey) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const decision = await resolveModuleAccessDecision({
        moduleKey,
        actorRole: req.user?.role || null,
        actorUserId: req.user?.id || null,
      });
      if (decision.allowed) {
        return next();
      }
      const code = decision.reason || 'MODULE_DISABLED';
      const status = code === 'MODULE_SCOPE_BLOCKED' ? 403 : 503;
      return res.status(status).json({
        success: false,
        code,
        moduleKey: decision.moduleKey,
        mode: decision.mode,
        provider: decision.provider,
        message: resolveFailureMessage(code, decision.moduleKey),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: 'MODULE_GUARD_ERROR',
        moduleKey,
        message: error?.message || 'Failed to validate module access.',
      });
    }
  };
};

