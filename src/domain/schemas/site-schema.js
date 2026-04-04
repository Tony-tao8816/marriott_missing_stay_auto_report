const { z } = require('zod');

const siteConfigSchema = z.object({
  baseUrl: z.string().url(),
  login: z.object({
    url: z.string().min(1),
    selectors: z.object({
      username: z.string().min(1),
      password: z.string().min(1),
      rememberMe: z.string().min(1).optional(),
      submit: z.string().min(1),
      successIndicator: z.string().min(1).optional()
    })
  }),
  registration: z.object({
    url: z.string().min(1),
    selectors: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      country: z.string().min(1),
      zipCode: z.string().min(1),
      email: z.string().min(1),
      password: z.string().min(1),
      confirmPassword: z.string().min(1),
      rememberMe: z.string().min(1).optional(),
      marketingEmailsOptIn: z.string().min(1).optional(),
      marketingEmailsOptOut: z.string().min(1).optional(),
      submit: z.string().min(1),
      successIndicator: z.string().min(1).optional()
    })
  }),
  missingStay: z.object({
    url: z.string().min(1),
    settleDelayMs: z.number().int().nonnegative().default(1500),
    selectors: z.object({
      thirdPartyBookingYes: z.string().min(1).optional(),
      thirdPartyBookingNo: z.string().min(1).optional(),
      phoneNumber: z.string().min(1).optional(),
      hotelName: z.string().min(1),
      checkInDate: z.string().min(1),
      checkOutDate: z.string().min(1),
      billCopyDigital: z.string().min(1).optional(),
      billCopyMail: z.string().min(1).optional(),
      confirmationNumber: z.string().min(1),
      roomNumber: z.string().min(1).optional(),
      memberNumber: z.string().min(1).optional(),
      hotelCode: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
      notes: z.string().min(1).optional(),
      attachmentInput: z.string().min(1).optional(),
      submit: z.string().min(1),
      successMessage: z.string().min(1).optional(),
      errorMessage: z.string().min(1).optional()
    })
  })
});

module.exports = {
  siteConfigSchema
};
