const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const optionalString = z.string().trim().min(1).optional();

const stayRecordSchema = z.object({
  id: optionalString,
  hotelName: z.string().trim().min(1),
  checkInDate: dateString,
  checkOutDate: dateString,
  confirmationNumber: z.string().trim().min(1),
  roomNumber: optionalString,
  memberNumber: optionalString,
  hotelCode: optionalString,
  country: optionalString,
  notes: optionalString,
  attachmentPath: optionalString
});

module.exports = {
  stayRecordSchema
};
