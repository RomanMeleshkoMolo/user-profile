const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const userProfileRoutes = require('../routes/userProfileRoutes');
const s3Routes = require('../routes/s3Routes');

const app = express();
const PORT = process.env.PORT || 4000;



app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Use routes
// app.use(userProfileRoutes);
app.use( userProfileRoutes );
app.use( "/",s3Routes );

app.listen(PORT, '0.0.0.0',() => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
