#!/usr/bin/env node

const { Command } = require('commander');
const { MarriottRegistration } = require('./marriott-registration');
const dotenv = require('dotenv');

dotenv.config();

const program = new Command();

program
  .name('marriott-register')
  .description('Automate Marriott Bonvoy member registration using ocbot')
  .version('0.1.0');

program
  .command('register')
  .description('Register a new Marriott member')
  .requiredOption('-f, --first-name <name>', 'First name')
  .requiredOption('-l, --last-name <name>', 'Last name')
  .option('-c, --country <code>', 'Country code (default: US)', 'US')
  .option('-z, --zip-code <code>', 'ZIP/Postal code (default: random CA/WA)')
  .option('--headed', 'Run browser in headed mode (visible)', false)
  .action(async (options) => {
    try {
      const reg = new MarriottRegistration({
        ocbotPath: 'ocbot',
        headless: !options.headed,
        ryyAsiaConfig: {
          baseUrl: process.env.RYY_API_BASE_URL || 'https://ryy.asia',
          adminMailbox: process.env.RYY_ADMIN_MAILBOX,
          adminPassword: process.env.RYY_ADMIN_PASSWORD,
          domain: process.env.RYY_DOMAIN || 'ryy.asia'
        }
      });

      console.log('🚀 Starting Marriott registration...\n');
      console.log(`📝 Name: ${options.firstName} ${options.lastName}`);
      console.log(`🌍 Country: ${options.country}`);
      if (options.zipCode) {
        console.log(`📮 ZIP: ${options.zipCode}`);
      } else {
        console.log('📮 ZIP: (random CA/WA)');
      }
      console.log('');
      
      const result = await reg.register({
        firstName: options.firstName,
        lastName: options.lastName,
        country: options.country,
        zipCode: options.zipCode
      });

      console.log('\n✅ Registration successful!');
      console.log('📧 Email:', result.email);
      console.log('🔑 Password:', result.password);
      console.log('🌍 Country:', result.country);
      console.log('📮 ZIP Code:', result.zipCode);
      console.log('⏱️ Duration:', `${result.duration}ms`);
      console.log('\n📋 Steps completed:');
      result.steps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step.step}: ${step.status}`);
      });

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Registration failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('test-email')
  .description('Test ryy.asia email service')
  .action(async () => {
    try {
      const { RyyAsiaService } = require('../../email/ryyasia');
      
      const service = new RyyAsiaService({
        baseUrl: process.env.RYY_API_BASE_URL || 'https://ryy.asia',
        adminMailbox: process.env.RYY_ADMIN_MAILBOX,
        adminPassword: process.env.RYY_ADMIN_PASSWORD,
        domain: process.env.RYY_DOMAIN || 'ryy.asia'
      });

      console.log('Testing email service...');
      const mailbox = await service.createMailbox('test', 'TestPass123!');
      console.log('✅ Email created:', mailbox.email);
    } catch (error) {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
