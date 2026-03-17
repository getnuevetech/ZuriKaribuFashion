import { Router } from 'express';
import { z } from 'zod';
import { ProductStatus, ProductType, prisma, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  ensureAutomationSettingsSchema,
  evaluateAccountAutomationChecks,
  evaluateProductAutomationChecks,
  notifyVendorAboutProductAutomationFailure,
  readAutomationApprovalSettings,
  saveProductAutomationOutcome,
  saveAutomationApprovalSettings,
  testAutomationProviderBinding,
} from '../utils/automation-approval';

const router = Router();
router.use(authenticate);
router.use(authorizePermissions(Permissions.PRODUCTS_MANAGE));
router.use(async (_req, _res, next) => {
  try {
    await ensureAutomationSettingsSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const evaluationRequestSchema = z.object({
  productType: z.nativeEnum(ProductType),
  productId: z.string().uuid(),
  applyDecision: z.boolean().default(false),
});
const providerTestSchema = z.object({
  providerId: z.string().min(1),
  functionKey: z.string().min(2).optional(),
  prompt: z.string().max(2000).optional(),
});
const accountEvaluationRequestSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(UserRole).optional(),
});

router.get('/settings', async (_req, res, next) => {
  try {
    const payload = await readAutomationApprovalSettings();
    res.json({
      success: true,
      data: payload.settings,
      source: payload.source,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const saved = await saveAutomationApprovalSettings(req.body || {});
    res.json({
      success: true,
      message: 'Automation settings saved.',
      data: saved,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/evaluate-product', async (req, res, next) => {
  try {
    const payload = evaluationRequestSchema.parse(req.body || {});
    const [settingsPayload, evaluation] = await Promise.all([
      readAutomationApprovalSettings(),
      evaluateProductAutomationChecks({
        productType: payload.productType,
        productId: payload.productId,
      }),
    ]);
    let action: 'NONE' | 'AUTO_APPROVED' | 'AUTO_REJECTED' = 'NONE';
    let automationOutcome: any = null;
    if (payload.applyDecision) {
      if (evaluation.canAutoApprove && settingsPayload.settings.autoApproveOnPass) {
        if (payload.productType === ProductType.FABRIC) {
          await prisma.fabric.update({
            where: { id: payload.productId },
            data: {
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
          });
        } else if (payload.productType === ProductType.READY_TO_WEAR) {
          await prisma.readyToWear.update({
            where: { id: payload.productId },
            data: {
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
          });
        } else {
          await prisma.design.update({
            where: { id: payload.productId },
            data: {
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
          });
        }
        await prisma.activityLog.create({
          data: {
            userId: req.user?.actorUserId || req.user?.id || 'system',
            action: 'AUTOMATION_PRODUCT_AUTO_APPROVED',
            details: {
              productType: payload.productType,
              productId: payload.productId,
              status: evaluation.status,
            },
          },
        });
        action = 'AUTO_APPROVED';
        automationOutcome = await saveProductAutomationOutcome({
          productType: payload.productType as any,
          productId: payload.productId,
          evaluationStatus: evaluation.status,
          action,
          report: evaluation.report,
          failureSeverity: 'NONE',
          needsCorrection: false,
          summaryMessage: 'All automation checks passed. Product auto-approved.',
        });
      } else {
        if (payload.productType === ProductType.FABRIC) {
          await prisma.fabric.update({
            where: { id: payload.productId },
            data: {
              status: ProductStatus.REJECTED,
              isAvailable: false,
            },
          });
        } else if (payload.productType === ProductType.READY_TO_WEAR) {
          await prisma.readyToWear.update({
            where: { id: payload.productId },
            data: {
              status: ProductStatus.REJECTED,
              isAvailable: false,
            },
          });
        } else {
          await prisma.design.update({
            where: { id: payload.productId },
            data: {
              status: ProductStatus.REJECTED,
              isAvailable: false,
            },
          });
        }
        await prisma.activityLog.create({
          data: {
            userId: req.user?.actorUserId || req.user?.id || 'system',
            action: 'AUTOMATION_PRODUCT_AUTO_REJECTED',
            details: {
              productType: payload.productType,
              productId: payload.productId,
              status: evaluation.status,
              failures: evaluation.report.filter((row) => row.status === 'FAIL' || row.status === 'NEEDS_AI'),
            },
          },
        });
        action = 'AUTO_REJECTED';
        automationOutcome = await saveProductAutomationOutcome({
          productType: payload.productType as any,
          productId: payload.productId,
          evaluationStatus: evaluation.status,
          action,
          report: evaluation.report,
        });
        await notifyVendorAboutProductAutomationFailure({
          productType: payload.productType as any,
          productId: payload.productId,
          report: evaluation.report,
          changeReport: evaluation.changeReport,
          outcome: automationOutcome,
        });
      }
    } else {
      automationOutcome = await saveProductAutomationOutcome({
        productType: payload.productType as any,
        productId: payload.productId,
        evaluationStatus: evaluation.status,
        action: 'NONE',
        report: evaluation.report,
        failureSeverity: evaluation.canAutoApprove ? 'NONE' : undefined,
        needsCorrection: evaluation.canAutoApprove ? false : undefined,
        summaryMessage: evaluation.canAutoApprove ? 'Automation checks passed.' : undefined,
      });
    }
    res.json({
      success: true,
      data: {
        ...evaluation,
        action,
        automationOutcome,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/evaluate-account', async (req, res, next) => {
  try {
    const payload = accountEvaluationRequestSchema.parse(req.body || {});
    const evaluation = await evaluateAccountAutomationChecks({
      userId: payload.userId,
      role: payload.role,
    });
    res.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/providers/suggestions', async (_req, res) => {
  res.json({
    success: true,
    data: [
      {
        providerKey: 'OPENAI',
        label: 'ChatGPT / OpenAI',
        recommendedFunctions: ['text_grammar_enhancement', 'document_ocr_analysis'],
      },
      {
        providerKey: 'GEMINI',
        label: 'Google Gemini',
        recommendedFunctions: ['text_grammar_enhancement', 'image_verification'],
      },
      {
        providerKey: 'STABILITY_AI',
        label: 'Stability AI',
        recommendedFunctions: ['image_regeneration'],
      },
      {
        providerKey: 'AZURE_DOCUMENT_INTELLIGENCE',
        label: 'Azure Document Intelligence',
        recommendedFunctions: ['document_ocr_analysis'],
      },
    ],
  });
});

router.post('/providers/test', async (req, res, next) => {
  try {
    const payload = providerTestSchema.parse(req.body || {});
    const result = await testAutomationProviderBinding(payload);
    res.json({
      success: result.ok,
      data: result,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
