import {
  CanadianProvince,
  PrismaClient,
  ProductStatus,
  ProductType,
  TaxType,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Clearing existing development data...');
    await clearDevelopmentData();
  }

  // Seed Canadian tax rates
  await seedTaxRates();

  // Seed system settings
  await seedSystemSettings();

  // Seed product categories
  await seedCategories();

  // Seed sample products (development only)
  if (process.env.NODE_ENV === 'development') {
    await seedSampleProducts();
    await seedSampleUsers();
  }

  console.log('✅ Database seeding completed successfully!');
}

async function clearDevelopmentData() {
  // Clear in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.review.deleteMany();
  await prisma.download.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.bundleItem.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.promoCode.deleteMany();

  console.log('Development data cleared');
}

async function seedTaxRates() {
  console.log('💰 Seeding Canadian tax rates...');

  const taxRates = [
    // GST (Federal - applies to all provinces)
    {
      province: CanadianProvince.AB,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Alberta GST',
    },
    {
      province: CanadianProvince.BC,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'British Columbia GST',
    },
    {
      province: CanadianProvince.MB,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Manitoba GST',
    },
    {
      province: CanadianProvince.SK,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Saskatchewan GST',
    },
    {
      province: CanadianProvince.QC,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Quebec GST',
    },
    {
      province: CanadianProvince.NT,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Northwest Territories GST',
    },
    {
      province: CanadianProvince.NU,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Nunavut GST',
    },
    {
      province: CanadianProvince.YT,
      taxType: TaxType.GST,
      rate: 0.05,
      name: 'Yukon GST',
    },

    // HST (Harmonized Sales Tax - replaces GST+PST)
    {
      province: CanadianProvince.ON,
      taxType: TaxType.HST,
      rate: 0.13,
      name: 'Ontario HST',
    },
    {
      province: CanadianProvince.NB,
      taxType: TaxType.HST,
      rate: 0.15,
      name: 'New Brunswick HST',
    },
    {
      province: CanadianProvince.NL,
      taxType: TaxType.HST,
      rate: 0.15,
      name: 'Newfoundland and Labrador HST',
    },
    {
      province: CanadianProvince.NS,
      taxType: TaxType.HST,
      rate: 0.15,
      name: 'Nova Scotia HST',
    },
    {
      province: CanadianProvince.PE,
      taxType: TaxType.HST,
      rate: 0.15,
      name: 'Prince Edward Island HST',
    },

    // PST (Provincial Sales Tax)
    {
      province: CanadianProvince.BC,
      taxType: TaxType.PST,
      rate: 0.07,
      name: 'British Columbia PST',
    },
    {
      province: CanadianProvince.MB,
      taxType: TaxType.PST,
      rate: 0.07,
      name: 'Manitoba PST',
    },
    {
      province: CanadianProvince.SK,
      taxType: TaxType.PST,
      rate: 0.06,
      name: 'Saskatchewan PST',
    },

    // QST (Quebec Sales Tax)
    {
      province: CanadianProvince.QC,
      taxType: TaxType.QST,
      rate: 0.09975,
      name: 'Quebec Sales Tax',
    },
  ];

  for (const taxRate of taxRates) {
    await prisma.taxRate.upsert({
      where: {
        province_taxType_effectiveFrom: {
          province: taxRate.province,
          taxType: taxRate.taxType,
          effectiveFrom: new Date('2024-01-01'),
        },
      },
      update: {
        rate: taxRate.rate,
        name: taxRate.name,
        isActive: true,
      },
      create: {
        ...taxRate,
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
        description: `Current ${taxRate.name} rate as of 2024`,
      },
    });
  }

  console.log(`✅ Seeded ${taxRates.length} tax rates`);
}

async function seedSystemSettings() {
  console.log('⚙️ Seeding system settings...');

  const settings = [
    // General Settings
    {
      key: 'site_name',
      value: 'Stripe Payment Template',
      category: 'general',
      isPublic: true,
      description: 'Site name displayed in header and emails',
    },
    {
      key: 'site_description',
      value: 'Complete NextJS Stripe payment solution',
      category: 'general',
      isPublic: true,
      description: 'Site description for SEO',
    },
    {
      key: 'default_currency',
      value: 'CAD',
      category: 'general',
      isPublic: true,
      description: 'Default currency for pricing',
    },
    {
      key: 'default_timezone',
      value: 'America/Toronto',
      category: 'general',
      isPublic: false,
      description: 'Default timezone for date calculations',
    },

    // Payment Settings
    {
      key: 'stripe_publishable_key',
      value: process.env.STRIPE_PUBLISHABLE_KEY || '',
      category: 'payment',
      isPublic: true,
      description: 'Stripe publishable key for frontend',
    },
    {
      key: 'payment_success_url',
      value: '/checkout/success',
      category: 'payment',
      isPublic: true,
      description: 'Redirect URL after successful payment',
    },
    {
      key: 'payment_cancel_url',
      value: '/checkout/cancel',
      category: 'payment',
      isPublic: true,
      description: 'Redirect URL after cancelled payment',
    },
    {
      key: 'enable_promo_codes',
      value: 'true',
      category: 'payment',
      isPublic: true,
      description: 'Enable promo code functionality',
    },

    // Email Settings
    {
      key: 'from_email',
      value: 'noreply@yoursite.com',
      category: 'email',
      isPublic: false,
      description: 'Default from email address',
    },
    {
      key: 'from_name',
      value: 'Stripe Payment Template',
      category: 'email',
      isPublic: false,
      description: 'Default from name for emails',
    },
    {
      key: 'support_email',
      value: 'support@yoursite.com',
      category: 'email',
      isPublic: true,
      description: 'Support email address',
    },

    // Business Settings
    {
      key: 'company_name',
      value: 'Your Company Inc.',
      category: 'business',
      isPublic: true,
      description: 'Legal company name',
    },
    {
      key: 'company_address',
      value: '123 Business St, Toronto, ON M5V 1A1',
      category: 'business',
      isPublic: true,
      description: 'Company address for invoices',
    },
    {
      key: 'business_number',
      value: '123456789RT0001',
      category: 'business',
      isPublic: false,
      description: 'CRA business number',
    },

    // Feature Flags
    {
      key: 'enable_reviews',
      value: 'true',
      category: 'features',
      isPublic: true,
      description: 'Enable product reviews',
    },
    {
      key: 'enable_subscriptions',
      value: 'true',
      category: 'features',
      isPublic: true,
      description: 'Enable subscription products',
    },
    {
      key: 'enable_digital_downloads',
      value: 'true',
      category: 'features',
      isPublic: true,
      description: 'Enable digital product downloads',
    },
    {
      key: 'require_email_verification',
      value: 'true',
      category: 'features',
      isPublic: false,
      description: 'Require email verification for new users',
    },

    // Analytics
    {
      key: 'google_analytics_id',
      value: '',
      category: 'analytics',
      isPublic: true,
      description: 'Google Analytics tracking ID',
    },
    {
      key: 'enable_analytics_tracking',
      value: 'true',
      category: 'analytics',
      isPublic: true,
      description: 'Enable internal analytics tracking',
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    });
  }

  console.log(`✅ Seeded ${settings.length} system settings`);
}

async function seedCategories() {
  console.log('📂 Seeding product categories...');

  // Parent categories
  const supplementsCategory = await prisma.category.upsert({
    where: { slug: 'supplements' },
    update: {},
    create: {
      name: 'Supplements',
      slug: 'supplements',
      description: 'Health and fitness supplements',
      sortOrder: 1,
      isActive: true,
    },
  });

  const workoutPlansCategory = await prisma.category.upsert({
    where: { slug: 'workout-plans' },
    update: {},
    create: {
      name: 'Workout Plans',
      slug: 'workout-plans',
      description: 'Digital workout and training programs',
      sortOrder: 2,
      isActive: true,
    },
  });

  // Supplement subcategories
  const supplementSubcategories = [
    {
      name: 'Protein Powder',
      slug: 'protein-powder',
      description: 'Whey, casein, and plant-based proteins',
    },
    {
      name: 'Pre-Workout',
      slug: 'pre-workout',
      description: 'Energy and performance boosters',
    },
    {
      name: 'Post-Workout',
      slug: 'post-workout',
      description: 'Recovery and muscle building supplements',
    },
    {
      name: 'Vitamins & Minerals',
      slug: 'vitamins-minerals',
      description: 'Essential vitamins and mineral supplements',
    },
    {
      name: 'Weight Management',
      slug: 'weight-management',
      description: 'Fat burners and weight loss supplements',
    },
  ];

  for (const [index, subcategory] of supplementSubcategories.entries()) {
    await prisma.category.upsert({
      where: { slug: subcategory.slug },
      update: {},
      create: {
        name: subcategory.name,
        slug: subcategory.slug,
        description: subcategory.description,
        parentId: supplementsCategory.id,
        sortOrder: index + 1,
        isActive: true,
      },
    });
  }

  // Workout plan subcategories
  const workoutSubcategories = [
    {
      name: 'Strength Training',
      slug: 'strength-training',
      description: 'Muscle building and strength programs',
    },
    {
      name: 'Cardio Programs',
      slug: 'cardio-programs',
      description: 'Heart health and endurance training',
    },
    {
      name: 'Yoga & Flexibility',
      slug: 'yoga-flexibility',
      description: 'Flexibility and mindfulness programs',
    },
    {
      name: 'HIIT Training',
      slug: 'hiit-training',
      description: 'High-intensity interval training programs',
    },
    {
      name: 'Beginner Programs',
      slug: 'beginner-programs',
      description: 'Programs designed for fitness beginners',
    },
  ];

  for (const [index, subcategory] of workoutSubcategories.entries()) {
    await prisma.category.upsert({
      where: { slug: subcategory.slug },
      update: {},
      create: {
        name: subcategory.name,
        slug: subcategory.slug,
        description: subcategory.description,
        parentId: workoutPlansCategory.id,
        sortOrder: index + 1,
        isActive: true,
      },
    });
  }

  console.log('✅ Seeded product categories with subcategories');
}

async function seedSampleProducts() {
  console.log('🛍️ Seeding sample products (development only)...');

  // Get categories
  const proteinCategory = await prisma.category.findUnique({
    where: { slug: 'protein-powder' },
  });
  const strengthCategory = await prisma.category.findUnique({
    where: { slug: 'strength-training' },
  });

  if (!proteinCategory || !strengthCategory) {
    console.log('Categories not found, skipping product seeding');
    return;
  }

  // Sample supplement product
  const proteinProduct = await prisma.product.create({
    data: {
      name: 'Premium Whey Protein Isolate',
      slug: 'premium-whey-protein-isolate',
      description:
        'High-quality whey protein isolate with 25g protein per serving. Perfect for muscle building and recovery.',
      shortDescription: 'Premium whey protein with 25g protein per serving',
      type: ProductType.PHYSICAL,
      status: ProductStatus.ACTIVE,
      price: 4999, // $49.99 CAD
      compareAtPrice: 5999,
      categoryId: proteinCategory.id,
      sku: 'PWP-001',
      trackInventory: true,
      inventoryQuantity: 50,
      requiresShipping: true,
      weight: 2000, // 2kg
      metaTitle: 'Premium Whey Protein Isolate - Build Muscle Fast',
      metaDescription:
        'Get the best whey protein isolate in Canada. Fast absorption, great taste, and results you can see.',
      featured: true,
      tags: JSON.stringify(['protein', 'whey', 'muscle-building', 'recovery']),
      images: {
        create: [
          {
            url: '/images/products/protein-powder-1.jpg',
            altText: 'Premium Whey Protein Isolate - Front View',
            sortOrder: 1,
            isPrimary: true,
          },
          {
            url: '/images/products/protein-powder-2.jpg',
            altText: 'Premium Whey Protein Isolate - Nutrition Facts',
            sortOrder: 2,
            isPrimary: false,
          },
        ],
      },
      variants: {
        create: [
          {
            name: 'Vanilla - 2kg',
            option1: 'Vanilla',
            option2: '2kg',
            price: 4999,
            sku: 'PWP-001-VAN-2KG',
            inventoryQuantity: 25,
            weight: 2000,
            isActive: true,
            sortOrder: 1,
          },
          {
            name: 'Chocolate - 2kg',
            option1: 'Chocolate',
            option2: '2kg',
            price: 4999,
            sku: 'PWP-001-CHO-2KG',
            inventoryQuantity: 25,
            weight: 2000,
            isActive: true,
            sortOrder: 2,
          },
        ],
      },
    },
  });

  // Sample digital workout plan
  const workoutPlan = await prisma.product.create({
    data: {
      name: '12-Week Strength Building Program',
      slug: '12-week-strength-building-program',
      description:
        'Complete 12-week strength training program designed by certified trainers. Includes workout videos, nutrition guide, and progress tracking.',
      shortDescription:
        'Complete 12-week strength training program with videos and guides',
      type: ProductType.DIGITAL,
      status: ProductStatus.ACTIVE,
      price: 9999, // $99.99 CAD
      compareAtPrice: 14999,
      categoryId: strengthCategory.id,
      downloadUrl: '/downloads/12-week-strength-program.pdf',
      downloadLimit: 5,
      downloadExpiry: 365, // 1 year access
      fileSize: 15728640, // ~15MB
      fileMimeType: 'application/pdf',
      metaTitle: '12-Week Strength Building Program - Get Strong Fast',
      metaDescription:
        'Transform your body with our proven 12-week strength training program. Includes everything you need to build muscle and strength.',
      featured: true,
      tags: JSON.stringify([
        'strength',
        'training',
        'muscle-building',
        'digital',
        'program',
      ]),
      images: {
        create: [
          {
            url: '/images/products/workout-program-1.jpg',
            altText: '12-Week Strength Building Program Cover',
            sortOrder: 1,
            isPrimary: true,
          },
        ],
      },
    },
  });

  // Create subscription plan for the workout program
  await prisma.subscriptionPlan.create({
    data: {
      productId: workoutPlan.id,
      name: 'Monthly Workout Programs',
      description: 'Get access to new workout programs every month',
      price: 2999, // $29.99/month
      billingInterval: 'month',
      trialDays: 7,
      stripePriceId: 'price_test_monthly_workout_plan', // Placeholder for development
      features: JSON.stringify([
        'Monthly new programs',
        'Video tutorials',
        'Nutrition guides',
        'Community access',
      ]),
      isActive: true,
      sortOrder: 1,
    },
  });

  console.log('✅ Seeded sample products');
}

async function seedSampleUsers() {
  console.log('👥 Seeding sample users (development only)...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123!', 12);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: UserRole.ADMIN,
      address: {
        create: {
          firstName: 'Admin',
          lastName: 'User',
          addressLine1: '123 Admin Street',
          city: 'Toronto',
          province: CanadianProvince.ON,
          postalCode: 'M5V 1A1',
          phone: '+1-416-555-0123',
        },
      },
    },
  });

  // Create sample customer
  const customerPassword = await bcrypt.hash('customer123!', 12);

  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      hashedPassword: customerPassword,
      firstName: 'John',
      lastName: 'Customer',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: UserRole.CUSTOMER,
      address: {
        create: {
          firstName: 'John',
          lastName: 'Customer',
          addressLine1: '456 Customer Ave',
          city: 'Vancouver',
          province: CanadianProvince.BC,
          postalCode: 'V6B 1A1',
          phone: '+1-604-555-0123',
        },
      },
    },
  });

  // Create support user
  const supportPassword = await bcrypt.hash('support123!', 12);

  await prisma.user.create({
    data: {
      email: 'support@example.com',
      hashedPassword: supportPassword,
      firstName: 'Support',
      lastName: 'Agent',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      role: UserRole.SUPPORT,
    },
  });

  console.log('✅ Seeded sample users (admin, customer, support)');
  console.log('🔑 Login credentials:');
  console.log('   Admin: admin@example.com / admin123!');
  console.log('   Customer: customer@example.com / customer123!');
  console.log('   Support: support@example.com / support123!');
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
