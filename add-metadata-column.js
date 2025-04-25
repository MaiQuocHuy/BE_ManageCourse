const { sequelize } = require('./src/config/database');

async function addMetadataColumn() {
  try {
    console.log('Adding metadata column to lessons table...');
    
    // Execute the ALTER TABLE statement
    await sequelize.query(`
      ALTER TABLE lessons 
      ADD COLUMN metadata TEXT NULL 
      AFTER is_free;
    `);
    
    console.log('Metadata column added successfully!');
  } catch (error) {
    console.error('Error adding metadata column:', error);
  } finally {
    // Close the connection
    await sequelize.close();
  }
}

// Run the function
addMetadataColumn();
