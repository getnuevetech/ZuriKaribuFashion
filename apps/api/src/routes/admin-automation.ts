import { Router } from 'express';
import { z } from 'zod';
import { ProductStatus, ProductType, prisma, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  ensureAutomationSettingsSchema,
  evaluateAccountAutomationChecks,
  evaluateProductAutomationChecks,
  listCoreAutomationFieldCatalog,
  notifyVendorAboutProductAutomationFailure,
  readAutomationApprovalSettings,
  saveProductAutomationOutcome,
  saveAutomationApprovalSettings,
  testAutomationProviderBinding,
} from '../utils/automation-approval';
import { listDynamicFieldDefinitions } from '../utils/dynamic-fields';

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

const mergeAutomationFieldCatalog = async () => {
  const coreCatalog = listCoreAutomationFieldCatalog();
  const dynamicFields = await listDynamicFieldDefinitions({ isActive: true });
  const scopes: Record<'FABRIC' | 'READY_TO_WEAR' | 'DESIGN' | 'ACCOUNT_APPROVAL', any[]> = {
    FABRIC: [...coreCatalog.FABRIC],
    READY_TO_WEAR: [...coreCatalog.READY_TO_WEAR],
    DESIGN: [...coreCatalog.DESIGN],
    ACCOUNT_APPROVAL: [...coreCatalog.ACCOUNT_APPROVAL],
  };
  const scopeSet = new Set(Object.keys(scopes));
  const normalizeScopeToAutomationScope = (
    rawScope: string
  ): 'FABRIC' | 'READY_TO_WEAR' | 'DESIGN' | 'ACCOUNT_APPROVAL' | null => {
    const token = String(rawScope || '')
      .trim()
      .toUpperCase();
    if (token === 'FABRIC' || token === 'FABRICS' || token === 'FTB') return 'FABRIC';
    if (
      token === 'READY_TO_WEAR' ||
      token === 'READYTOWEAR' ||
      token === 'RTW' ||
      token === 'READY_TO_WEAR_PRODUCTS'
    ) {
      return 'READY_TO_WEAR';
    }
    if (token === 'DESIGN' || token === 'DESIGNS' || token === 'CUSTOM' || token === 'CUSTOM_TO_WEAR' || token === 'CTW') {
      return 'DESIGN';
    }
    if (token === 'ACCOUNT_APPROVAL' || token === 'ACCOUNT' || token === 'USER' || token === 'USERS') {
      return 'ACCOUNT_APPROVAL';
    }
    return null;
  };
  const isProductWideScope = (rawScope: string) => {
    const token = String(rawScope || '')
      .trim()
      .toUpperCase();
    return token === '' || token === 'ALL' || token === 'ALL_PRODUCTS' || token === 'GLOBAL' || token === 'PRODUCT';
  };
  for (const row of dynamicFields) {
    const module = String(row.module || '').toUpperCase();
    const scope = String(row.scope || '').toUpperCase();
    const mappedScope =
      (scopeSet.has(scope) ? scope : normalizeScopeToAutomationScope(scope)) as
        | 'FABRIC'
        | 'READY_TO_WEAR'
        | 'DESIGN'
        | 'ACCOUNT_APPROVAL'
        | null;
    const entry = {
      key: String(row.key || '').trim(),
      label: String(row.label || row.key || '').trim(),
      dataType: String(row.dataType || 'TEXT').trim().toUpperCase(),
      source: 'DYNAMIC' as const,
    };
    if (!entry.key) continue;
    if (module === 'PRODUCT' && !mappedScope && isProductWideScope(scope)) {
      scopes.FABRIC.push(entry);
      scopes.READY_TO_WEAR.push(entry);
      scopes.DESIGN.push(entry);
      continue;
    }
    if (mappedScope) {
      scopes[mappedScope].push(entry);
      continue;
    }
    if (module === 'ACCOUNT') {
      scopes.ACCOUNT_APPROVAL.push(entry);
    }
  }
  const dedupe = (rows: any[]) => {
    const map = new Map<string, any>();
    for (const row of rows) {
      const key = String(row?.key || '').trim();
      if (!key) continue;
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
  };
  return {
    FABRIC: dedupe(scopes.FABRIC),
    READY_TO_WEAR: dedupe(scopes.READY_TO_WEAR),
    DESIGN: dedupe(scopes.DESIGN),
    ACCOUNT_APPROVAL: dedupe(scopes.ACCOUNT_APPROVAL),
  };
};

const autoFunctionForField = (fieldKey: string, dataType: string) => {
  const key = String(fieldKey || '').trim().toLowerCase();
  const type = String(dataType || '').trim().toUpperCase();
  if (key.includes('image') || key.includes('photo') || key.includes('picture') || type === 'URL') {
    return 'image_verification';
  }
  return 'text_grammar_enhancement';
};
const sanitizeCriterionKeyToken = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
const injectDynamicFieldCriteriaRows = (settings: any, fieldCatalog: any) => {
  const output = { ...(settings || {}) };
  output.criteria = { ...(output.criteria || {}) };
  const scopes: Array<'FABRIC' | 'READY_TO_WEAR' | 'DESIGN' | 'ACCOUNT_APPROVAL'> = [
    'FABRIC',
    'READY_TO_WEAR',
    'DESIGN',
    'ACCOUNT_APPROVAL',
  ];
  let added = 0;
  for (const scope of scopes) {
    const rows = Array.isArray(output.criteria?.[scope]) ? [...output.criteria[scope]] : [];
    const rowsByKey = new Set(rows.map((row: any) => String(row?.key || '').trim()).filter(Boolean));
    const rowsByTargetField = new Set(rows.map((row: any) => String(row?.targetField || '').trim()).filter(Boolean));
    const dynamicFields = (Array.isArray(fieldCatalog?.[scope]) ? fieldCatalog[scope] : []).filter(
      (entry: any) => String(entry?.source || '').toUpperCase() === 'DYNAMIC'
    );
    for (const entry of dynamicFields) {
      const fieldKey = String(entry?.key || '').trim();
      if (!fieldKey || rowsByTargetField.has(fieldKey)) continue;
      const generatedKey = `dynamic_field_${scope.toLowerCase()}_${sanitizeCriterionKeyToken(fieldKey)}`;
      if (rowsByKey.has(generatedKey)) continue;
      const verifierFunction = autoFunctionForField(fieldKey, String(entry?.dataType || 'TEXT'));
      rows.push({
        key: generatedKey,
        label: `Dynamic field verification: ${String(entry?.label || fieldKey)}`,
        enabled: false,
        requiresAi: true,
        allowAiEdits: false,
        targetField: fieldKey,
        aiFunctionKey: verifierFunction,
        verifierFunctionKey: verifierFunction,
        fixerFunctionKey: verifierFunction === 'image_verification' ? 'image_regeneration' : 'text_grammar_enhancement',
        aiProviderId: '',
        verifierProviderId: '',
        fixerProviderId: '',
        passResultToFixer: true,
      });
      rowsByKey.add(generatedKey);
      rowsByTargetField.add(fieldKey);
      added += 1;
    }
    output.criteria[scope] = rows;
  }
  return { settings: output, added };
};

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

router.get('/field-catalog', async (_req, res, next) => {
  try {
    const data = await mergeAutomationFieldCatalog();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/field-catalog/sync', async (_req, res, next) => {
  try {
    const data = await mergeAutomationFieldCatalog();
    const settingsPayload = await readAutomationApprovalSettings();
    const patched = injectDynamicFieldCriteriaRows(settingsPayload.settings, data);
    const synced = await saveAutomationApprovalSettings(patched.settings);
    res.json({
      success: true,
      message:
        patched.added > 0
          ? `Automation field catalog synced. Added ${patched.added} new dynamic field criterion row(s) to the field pipeline.`
          : 'Automation field catalog synced. No new dynamic field criterion rows were required.',
      settings: synced,
      data,
      addedCriteriaRows: patched.added,
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
          changeReport: evaluation.changeReport,
          failureSeverity: 'NONE',
          needsCorrection: false,
          summaryMessage: 'All automation checks passed. Product auto-approved.',
        });
        await notifyVendorAboutProductAutomationFailure({
          productType: payload.productType as any,
          productId: payload.productId,
          report: evaluation.report,
          changeReport: evaluation.changeReport,
          outcome: automationOutcome,
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
              failures: evaluation.report.filter((row: any) => row.status === 'FAIL' || row.status === 'NEEDS_AI'),
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
          changeReport: evaluation.changeReport,
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
        changeReport: evaluation.changeReport,
        failureSeverity: evaluation.canAutoApprove ? 'NONE' : undefined,
        needsCorrection: evaluation.canAutoApprove ? false : undefined,
        summaryMessage: evaluation.canAutoApprove ? 'Automation checks passed.' : undefined,
      });
      await notifyVendorAboutProductAutomationFailure({
        productType: payload.productType as any,
        productId: payload.productId,
        report: evaluation.report,
        changeReport: evaluation.changeReport,
        outcome: automationOutcome,
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
