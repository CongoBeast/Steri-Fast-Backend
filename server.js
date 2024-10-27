const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const app = express();
const PORT = 3001;
app.use(express.json());

const JWT_SECRET = 'your_jwt_secret'; // Use a strong, secret key in production

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());



const apiConfig = {
  method: 'post',
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Request-Headers': '*',
    'api-key': '4graSqucDumhuePX7lpf75s6TrTFkwYXU1KN2h6vN3j72edWz6oue9BBFYOHvfUC',
  },
  urlBase: 'https://ap-south-1.aws.data.mongodb-api.com/app/data-nmutxbv/endpoint/data/v1/action/'
};

const generateId = () => {
  return crypto.randomBytes(12).toString('hex'); // Generates a 24-character hexadecimal string
};

const generateToken = (userId) => {
  const secretKey = 'your-secret-key'; // Replace with your own secret key
  const expiresIn = '1h'; // Token expiration time, e.g., 1 hour
  const payload = { sub: userId,  iat: Math.floor(Date.now() / 1000), // Issued at time (current time in seconds)
  };
  return jwt.sign(payload, secretKey, { expiresIn });;
};

const axiosInstance = axios.create({
  baseURL: apiConfig.urlBase,
  headers: apiConfig.headers,
});

const saltRounds = 10;

const registerUser = async (userData) => {
  try {
    // Check if the username exists
    let response = await axiosInstance.post('findOne', {
      dataSource: 'Cluster0', // Replace with your data source name
      database: 'Steri-Fast', // Replace with your database name
      collection: 'users', // Replace with your collection name
      filter: { username: userData.username },
    });

    if (response.data.document) {
      return { status: 400, message: 'Username already exists' };
    }

    // Check if the email exists
    response = await axiosInstance.post('findOne', {
      dataSource: 'Cluster0',
      database: 'Steri-Fast',
      collection: 'users',
      filter: { email: userData.email },
    });

    if (response.data.document) {
      return { status: 400, message: 'Email already registered' };
    }

    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    // Register the new user
    response = await axiosInstance.post('insertOne', {
      dataSource: 'Cluster0',
      database: 'Steri-Fast',
      collection: 'users',
      document: { ...userData, password: hashedPassword, signupTimestamp: new Date() },
    });

    const token = generateToken() // Assume you have a function to generate tokens

    return { status: 200, token };
  } catch (error) {
    console.error('Error registering user:', error);
    return { status: 500, message: 'Internal server error' };
  }
};


// Register User
app.post('/register', async (req, res) => {
  const { username, password, email, userType } = req.body;

  // password = bcrypt.hash(password, saltRounds)

  const response = await registerUser({ username, password, email, userType });

  if (response.status === 200) {
    res.json({ token: response.token });
  } else {
    res.status(response.status).json({ message: response.message });
  }
});

// Login User
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const data = JSON.stringify({
    "collection": "users",
    "database": "Steri-Fast",
    "dataSource": "Cluster0",
    "filter": { username }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}findOne`, data })
    .then(response => {
      const user = response.data.document;
      if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

        // Update user's loggedOn status and loginTimestamp
        const loginTimestamp = new Date().toISOString();
        const updateData = JSON.stringify({
          "collection": "users",
          "database": "Steri-Fast",
          "dataSource": "Cluster0",
          "filter": { "_id": user._id },
          "update": { "$set": { isLoggedOn: true, loginTimestamp } }
        });

        axios({ ...apiConfig, url: `${apiConfig.urlBase}updateOne`, data: updateData })
          .then(() => res.json({ token }))
          .catch(error => res.status(500).send(error));

      } else {
        console.log("wrong password")
        res.status(401).send('Invalid credentials');
      }
    })
    .catch(error => res.status(500).send(error));
});


// Your existing routes go here
app.post('/add-tools', (req, res) => {
  const toolData = req.body;
  if (!toolData._id) {
    toolData._id = generateId();
  }

  const data = JSON.stringify({
    "collection": "tools",
    "database": "Steri-Fast",
    "dataSource": "Cluster0",
    "document": toolData
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}insertOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.get('/tools', (req, res) => {

  // Prepare a simple aggregation pipeline to fetch all documents from "Tools" collection
  const pipeline = [
    { "$match": {} } // Fetch all documents; adjust conditions here if filtering is needed
  ];

  const data = JSON.stringify({
    "collection": "tools",
    "database": "Steri-Fast",
    "dataSource": "Cluster0",
    "pipeline": pipeline
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}aggregate`, data })
    .then(response => {
      res.json(response.data.documents);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});


// delete tools
app.post('/delete-tool', (req, res) => {

  const { _id } = req.body;

  console.log(_id)

  const data = JSON.stringify({
    "collection": "tools",
    "database": "Steri-Fast",
    "dataSource": "Cluster0",
    "filter": { "_id": _id }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}deleteOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});