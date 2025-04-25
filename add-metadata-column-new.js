const { Sequelize } = require('sequelize');
require('dotenv').config();

// Create a connection to the database
const sequelize = new Sequelize(
  process.env.DB_NAME || 'courses_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '123456789',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql'
  }
);

async function addMetadataColumn() {
  try {
    // Test the connection
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // Check if the column already exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'courses_db'}' 
      AND TABLE_NAME = 'lessons' 
      AND COLUMN_NAME = 'metadata'
    `);

    if (results.length > 0) {
      console.log('Metadata column already exists.');
      return;
    }

    // Add the metadata column
    await sequelize.query(`
      ALTER TABLE lessons 
      ADD COLUMN metadata TEXT NULL 
      AFTER is_free;
    `);

    console.log('Metadata column added successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await sequelize.close();
  }
}

// Run the function
addMetadataColumn();
