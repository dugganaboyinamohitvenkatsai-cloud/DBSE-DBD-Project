import { app } from './app.js';
import { checkDatabaseConnection } from './config/database.js';
import { env, validateEnvironment } from './config/env.js';

validateEnvironment();

app.listen(env.port, async () => {
  console.log(`API listening on port ${env.port}`);
  try {
    await checkDatabaseConnection();
    console.log('MySQL connection established.');
  } catch (error) {
    console.warn(`MySQL connection unavailable: ${error.message}`);
  }
});
