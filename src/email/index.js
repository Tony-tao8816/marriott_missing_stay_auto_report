const { RyyAsiaApiClient } = require('../infra/email/ryyasia-api-client');
const { RyyAsiaApiEmailService } = require('../infra/email/ryyasia-api-email-service');

module.exports = {
  RyyAsiaClient: RyyAsiaApiClient,
  RyyAsiaService: RyyAsiaApiEmailService,
  RyyAsiaApiClient,
  RyyAsiaApiEmailService
};
