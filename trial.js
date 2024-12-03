// Import necessary modules
const express = require('express');
const bcrypt = require('bcrypt');
const mongodb = require('mongodb');
const session = require('express-session');
const axios = require('axios');
const cors = require('cors');

const app = express();
const MongoClient = mongodb.MongoClient;

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: true
}));
app.use(cors());

// Connect to MongoDB
const url = 'mongodb://localhost:27017';
const dbName = 'medicalPortal';
let db;

MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) {
    console.error('Failed to connect to the database');
    process.exit(1);
  }
  db = client.db(dbName);
  console.log('Connected to MongoDB');
});

// Root endpoint to check if server is running
app.get('/', (req, res) => {
  res.send('Welcome to the Medical Portal Backend!');
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  const { username, password, role, organisation, aadhaarNumber } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { username, password: hashedPassword, role };
    if (role === 'user') {
      newUser.aadhaarNumber = aadhaarNumber;
    }
    if (role === 'admin') {
      newUser.organisation = organisation;
    }

    if (role === 'admin') {
      await db.collection('admins').insertOne(newUser);
    } else {
      await db.collection('users').insertOne(newUser);
    }

    res.status(201).send({ message: 'Account created successfully', redirectUrl: '/login' });
  } catch (error) {
    res.status(500).send('Error creating account');
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    let user = await db.collection('users').findOne({ username });
    if (!user) {
      user = await db.collection('admins').findOne({ username });
    }

    if (!user) {
      return res.status(400).send('Invalid username or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).send('Invalid username or password');
    }

    // Store user session
    req.session.userId = user._id;
    req.session.role = user.role;

    // Redirect based on role
    if (user.role === 'admin') {
      res.status(200).send({ redirectUrl: '/hospital-dashboard' });
    } else {
      res.status(200).send({ redirectUrl: '/document-upload' });
    }
  } catch (error) {
    res.status(500).send('Error logging in');
  }
});

// Endpoint to get uploaded documents by Aadhaar number
app.get('/api/documents/:aadhaarNumber', async (req, res) => {
  const { aadhaarNumber } = req.params;
  try {
    const user = await db.collection('users').findOne({ aadhaarNumber });
    if (!user) {
      return res.status(404).send('No user found with the provided Aadhaar number');
    }
    res.status(200).send({ documents: user.documents || [] });
  } catch (error) {
    res.status(500).send('Error retrieving documents');
  }
});

// Endpoint to upload documents
app.post('/api/upload', async (req, res) => {
  const { userId, documents } = req.body;
  try {
    await db.collection('users').updateOne(
      { _id: new mongodb.ObjectID(userId) },
      { $set: { documents } }
    );
    res.status(200).send('Documents uploaded successfully');
  } catch (error) {
    res.status(500).send('Error uploading documents');
  }
});

// Endpoint to get nearest hospitals
app.get('/api/nearest-hospitals', async (req, res) => {
  const { latitude, longitude } = req.query;
  try {
    // Example using an external API to get nearby hospitals (this is just a placeholder)
    const response = await axios.get(`https://api.example.com/nearby-hospitals?lat=${latitude}&lon=${longitude}`);
    res.status(200).send({ hospitals: response.data.hospitals });
  } catch (error) {
    console.error('Error fetching nearby hospitals:', error);
    res.status(500).send('Error fetching nearby hospitals');
  }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
