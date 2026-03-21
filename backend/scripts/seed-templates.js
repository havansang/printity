const mongoose = require('mongoose');

const { connectDB } = require('../src/config/db');
const { seedDefaultTemplates } = require('../src/modules/templates/template.seed');

async function run() {
  try {
    await connectDB();

    const result = await seedDefaultTemplates();
    console.log(`Seeded ${result.count} template(s): ${result.items.join(', ')}`);
  } catch (error) {
    console.error('Failed to seed templates', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
