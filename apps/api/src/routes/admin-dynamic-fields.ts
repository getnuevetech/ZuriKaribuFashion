import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import {
  createDynamicFieldDefinition,
  deleteDynamicFieldDefinition,
  DYNAMIC_FIELD_DATA_TYPES,
  ensureDynamicFieldDefinitionSchema,
  listDynamicFieldDefinitions,
  updateDynamicFieldDefinition,
} from '../utils/dynamic-fields';

const router = Router();
router.use(authenticate);
router.use(
  authorizePermissions(
    Permissions.DYNAMIC_FIELDS_MANAGE,
    Permissions.PRODUCTS_MANAGE,
    Permissions.USERS_MANAGE
  )
);
router.use(async (_req, _res, next) => {
  try {
    await ensureDynamicFieldDefinitionSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const listQuerySchema = z.object({
  module: z.string().trim().optional(),
  scope: z.string().trim().optional(),
  isActive: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const token = value.toLowerCase();
      if (token === 'true' || token === '1' || token === 'yes') return true;
      if (token === 'false' || token === '0' || token === 'no') return false;
      return undefined;
    }),
});

const createSchema = z.object({
  key: z.string().min(2),
  label: z.string().min(2),
  module: z.string().min(2),
  scope: z.string().min(2),
  dataType: z.enum(DYNAMIC_FIELD_DATA_TYPES).optional(),
  placeholder: z.string().max(300).optional(),
  helpText: z.string().max(1200).optional(),
  defaultValue: z.string().max(5000).optional(),
  options: z.array(z.string()).optional(),
  validation: z.record(z.any()).optional(),
  functionKeys: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

router.get('/', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query || {});
    const data = await listDynamicFieldDefinitions(query);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = createSchema.parse(req.body || {});
    const created = await createDynamicFieldDefinition({
      ...payload,
      createdById: req.user?.actorUserId || req.user?.id || '',
    });
    res.json({
      success: true,
      message: 'Dynamic field created.',
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const payload = updateSchema.parse(req.body || {});
    const updated = await updateDynamicFieldDefinition(String(req.params.id || ''), payload);
    res.json({
      success: true,
      message: 'Dynamic field updated.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteDynamicFieldDefinition(String(req.params.id || ''));
    res.json({
      success: true,
      message: 'Dynamic field deleted.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

