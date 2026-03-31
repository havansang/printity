const mongoose = require('mongoose');

const { connectDB } = require('../src/config/db');
const { seedDefaultShapes } = require('../src/modules/shapes/shape.seed');

async function run() {
  try {
    await connectDB();

    const result = await seedDefaultShapes();
    console.log(`Seeded ${result.count} shape(s): ${result.items.join(', ')}`);
  } catch (error) {
    console.error('Failed to seed shapes', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
