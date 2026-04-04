const { z } = require('zod');

const runtimeEnvSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  headless: z.boolean().default(true),
  slowMoMs: z.number().int().nonnegative().default(0),
  timeoutMs: z.number().int().positive().default(30000),
  mfaWaitMs: z.number().int().nonnegative().default(60000),
  resultDir: z.string().min(1).default('output'),
  sessionStatePath: z.string().min(1).default('output/session/marriott-session.json'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  notifyWebhookUrl: z.string().url().optional()
});

module.exports = {
  runtimeEnvSchema
};
