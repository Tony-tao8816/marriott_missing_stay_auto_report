const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const stayRecordSchema = z.object({
  id: z.string().min(1).optional(),
  hotelName: z.string().min(1),
  checkInDate: dateString,
  checkOutDate: dateString,
  confirmationNumber: z.string().min(1),
  hotelCode: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  notes: z.string().optional()
});

const siteConfigSchema = z.object({
  baseUrl: z.string().url(),
  login: z.object({
    url: z.string().min(1),
    selectors: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      submit: z.string().min(1),
      successIndicator: z.string().min(1).optional()
    })
  }),
  missingStay: z.object({
    url: z.string().min(1),
    settleDelayMs: z.number().int().nonnegative().default(1500),
    selectors: z.object({
      hotelName: z.string().min(1),
      checkInDate: z.string().min(1),
      checkOutDate: z.string().min(1),
      confirmationNumber: z.string().min(1),
      hotelCode: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
      notes: z.string().min(1).optional(),
      submit: z.string().min(1),
      successMessage: z.string().min(1).optional(),
      errorMessage: z.string().min(1).optional()
    })
  })
});

const runtimeEnvSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  headless: z.boolean().default(true),
  slowMoMs: z.number().int().nonnegative().default(0),
  timeoutMs: z.number().int().positive().default(30000),
  mfaWaitMs: z.number().int().nonnegative().default(60000),
  resultDir: z.string().min(1).default('output'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  notifyWebhookUrl: z.string().url().optional()
});

module.exports = {
  runtimeEnvSchema,
  siteConfigSchema,
  stayRecordSchema
};
