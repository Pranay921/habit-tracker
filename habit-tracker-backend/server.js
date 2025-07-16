require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const habitRoutes = require('./routes/habits');
const userRoutes = require('./routes/users');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    initializeDatabase();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Initialize database with native driver
async function initializeDatabase() {
  const uri = process.env.MONGODB_URI;
  const dbName = 'habit-tracker';
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    console.log('Initializing database...');
    const db = client.db(dbName);

    // Check existing collections
    const existingCollections = (await db.listCollections().toArray()).map(c => c.name);

    // Create 'users' collection if it doesn't exist
    if (!existingCollections.includes('users')) {
      await db.createCollection('users');
      console.log('Created users collection');
    } else {
      console.log('users collection already exists');
    }

    // Create 'habits' collection if it doesn't exist
    if (!existingCollections.includes('habits')) {
      await db.createCollection('habits');
      console.log('Created habits collection');
    } else {
      console.log('habits collection already exists');
    }

    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    console.log('Ensured unique index on users.email');
    await db.collection('habits').createIndex({ userId: 1 });
    console.log('Ensured index on habits.userId');

    // Seed sample data
    const usersColl = db.collection('users');
    const habitsColl = db.collection('habits');

    // Seed a default user
    const defaultEmail = 'default@example.com';
    let defaultUser = await usersColl.findOne({ email: defaultEmail });
    if (!defaultUser) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const insertResult = await usersColl.insertOne({
        name: 'Default User',
        email: defaultEmail,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      defaultUser = { _id: insertResult.insertedId };
      console.log('Inserted default user');
    } else {
      console.log('Default user already exists');
    }

    // Seed a default habit for the default user
    const existingHabit = await habitsColl.findOne({ userId: defaultUser._id, name: 'Drink Water' });
    if (!existingHabit) {
      await habitsColl.insertOne({
        userId: defaultUser._id,
        name: 'Drink Water',
        description: 'Stay hydrated',
        time: 'morning',
        frequency: 'daily',
        reminder: true,
        streak: 0,
        completed: {},
        createdAt: new Date()
      });
      console.log('Inserted sample habit Drink Water');
    } else {
      console.log('Sample habit already exists');
    }

    console.log('Database initialization complete');
  } catch (error) {
    console.error('Error during database initialization:', error);
  } finally {
    await client.close();
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api/users', userRoutes);

// Serve static files from frontend
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle React routing, return all requests to React app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});