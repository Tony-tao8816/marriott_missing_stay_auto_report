const { loginMarriottAccount } = require('./login-marriott-account');
const { createMarriottAccount } = require('./create-marriott-account');
const { requestMarriottMissingStay } = require('./request-marriott-missing-stay');

async function runMarriottIntegratedFlow(input) {
  let accountStep;

  if (input.accountMode === 'login') {
    accountStep = await loginMarriottAccount({
      emailOrMemberNumber: input.emailOrMemberNumber,
      password: input.password,
      rememberMe: input.rememberMe,
      runtimeConfig: input.runtimeConfig
    });
  } else if (input.accountMode === 'create') {
    accountStep = await createMarriottAccount({
      firstName: input.firstName,
      lastName: input.lastName,
      country: input.country,
      zipCode: input.zipCode,
      email: input.email,
      password: input.password,
      rememberMe: input.rememberMe,
      marketingEmails: input.marketingEmails,
      runtimeConfig: input.runtimeConfig
    });
  } else if (input.accountMode === 'session') {
    accountStep = {
      status: 'ok',
      action: 'reuseSession',
      message: 'Using previously saved session.'
    };
  } else {
    throw new Error(`Unsupported account mode: ${input.accountMode}`);
  }

  const requestStep = await requestMarriottMissingStay({
    thirdPartyBooking: input.thirdPartyBooking,
    phoneNumber: input.phoneNumber,
    hotelName: input.hotelName,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    billCopy: input.billCopy,
    confirmationNumber: input.confirmationNumber,
    comments: input.comments,
    attachment: input.attachment,
    runtimeConfig: input.runtimeConfig
  });

  return {
    status: 'ok',
    action: 'MarriottIntegratedFlow',
    account: accountStep,
    request: requestStep
  };
}

module.exports = {
  runMarriottIntegratedFlow
};
