const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');

// Create a connection to the database
const sequelize = new Sequelize('courses_db', 'root', '123456789', {
  host: 'localhost',
  dialect: 'mysql'
});

// Configure Umzug to use Sequelize for migrations
const umzug = new Umzug({
  migrations: {
    path: path.join(__dirname, './src/migrations'),
    params: [
      sequelize.getQueryInterface(),
      Sequelize
    ]
  },
  storage: new SequelizeStorage({ sequelize }),
  logger: console
});

async function runMigrations() {
  try {
    // Test the connection
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // Run the migrations
    const migrations = await umzug.up();
    console.log('Migrations executed:', migrations.map(m => m.name));
    
    console.log('All migrations have been executed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    // Close the connection
    await sequelize.close();
  }
}

// Run the function
runMigrations();
