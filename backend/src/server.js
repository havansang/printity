const app = require('./app');
const { env } = require('./config/env');
const { connectDB } = require('./config/db');

async function startServer() {
  try {
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(`Backend server listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend server', error);
    process.exit(1);
  }
}

startServer();
