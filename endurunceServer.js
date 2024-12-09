const rateLimit = require('express-rate-limit');


const path = require('path');
const ejs = require('ejs');
const fs = require("fs");
const express = require("express"); 
const app = express();

const mongoose = require("mongoose");
const bodyParser = require('body-parser');
require("dotenv").config();


app.use(express.static('public')); //to get the style.css to show up
//const { MongoClient } = require("mongodb");
//const client = new MongoClient(uri);


require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') })
let portNumber; 

//more api stuff
const session = require('express-session');
const flash = require('connect-flash');
// Session middleware
app.use(session({
  secret: 'your_secret_key', // Replace with a strong secret in production
  resave: false,
  saveUninitialized: false
}));
// Flash middleware
app.use(flash());


// Make flash messages available in all templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

const basicAuth = require('express-basic-auth');

app.use('/adminRemove', basicAuth({
  users: { [process.env.ADMIN_USERNAME]: process.env.ADMIN_PASSWORD },
  challenge: true,
  unauthorizedResponse: (req) => 'Unauthorized'
}));
//end of api section



// MongoDB connection string
const mongodb_user = process.env.MONGO_DB_USERNAME;
const mongodb_password = process.env.MONGO_DB_PASSWORD;
const mongodb_name = process.env.MONGO_DB_NAME;
const mongodb_collection = process.env.MONGO_COLLECTION;


const databaseAndCollection = {
    db: mongodb_name,
    collection: mongodb_collection
  };

//code snipped from mongodb website 
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${mongodb_user}:${mongodb_password}@cluster0.ao6qg.mongodb.net/${mongodb_name}?retryWrites=true&w=majority&appName=cluster0`;
//works below
//const uri = "mongodb+srv://admin:admin12345678@cluster0.ao6qg.mongodb.net/?retryWrites=true&w=majority&appName=cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    //console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);




/* initializes with post information */ 
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "pages"));


mongoose.connect(uri)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Could not connect to MongoDB:", err));

//   //before api was added
//   const applicantSchema = new mongoose.Schema({
//     name: String,
//     age: Number,
//     distance: Number,
//     time: Number,
//     goal: String,
//     date: { type: Date, default: Date.now }
//   });

const applicantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, min: 0 },
    distance: { type: Number, default: 0, min: 0 },
    time: { type: Number, min: 0 },
    goal: String,
    date: { type: Date, default: Date.now },
    weather: {
      description: String,
      temperature: Number,
      humidity: Number,
      windSpeed: Number
    }
  });
  
  
  const Applicant = mongoose.model(mongodb_collection, applicantSchema);

// command-line arguments
if (process.argv.length !== 3) {
    console.log("Usage: endurunceServer.js <portNumber>");
    process.exit(0);
}
else {
    portNumber = process.argv[2];
    console.log(`Web server started and running at http://localhost:${portNumber}`);
    console.log(`Stop to shutdown the server:`);

    // listen for console input
    process.stdin.setEncoding("utf8"); 
    process.stdin.on('readable', () => {
        let dataInput = process.stdin.read();
        if (dataInput !== null) {
            const command = dataInput.trim();
            if (command === "stop") {
                console.log("Shutting down the server");
                process.exit(0);
            } else {
                console.log(`Invalid command: ${command}`);
                console.log(`Stop to shutdown the server: `);
                dataInput = process.stdin.read();
            }
        }

    });
}

app.get("/", (request, response) => {
    response.render('homePage'); 
});

app.get("/logRun", (request, response) => {
    response.render('logRunPage'); 
});


//if a person inputs the same name multiple times their miles gets added together and a new
// person is created so the name will only show up on the leader board if that name has 
//the highest amount of miles 

app.get("/submitInfo", (req, res) => {
    res.render("/submitInfo");
  });
//api stuff 
const axios = require('axios');
const { body, validationResult } = require('express-validator');

//more stuff for api limits so it cant go over the free version
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });
  // Apply to all API routes
app.use('/api/', apiLimiter);
//end of that 


app.post("/submitInfo", async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Render the form again with error messages
        return res.status(400).render('logRunPage', { errors: errors.array() });
      }
  
      const { name, age, distance, time, goal, city } = req.body;
  
      try {
          // Fetch weather data from OpenWeatherMap
          const apiKey = process.env.OPENWEATHER_API_KEY; // Store your API key in .env
          const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=imperial&appid=${apiKey}`;
          
          const weatherResponse = await axios.get(weatherUrl);
          const weatherData = weatherResponse.data;
  
          const newRun = new Applicant({
              name,
              age,
              distance: parseFloat(distance),
              time,
              goal,
              weather: {
                  description: weatherData.weather[0].description,
                  temperature: weatherData.main.temp,
                  humidity: weatherData.main.humidity,
                  windSpeed: weatherData.wind.speed
              }
          });

          await newRun.save();
          console.log('New run logged with weather:', newRun);
          req.flash('success_msg', 'Run logged successfully with current weather data!');
          res.redirect('/leaderboard');
      } catch (error) {
          console.error("Error saving run information or fetching weather data:", error);
          req.flash('error_msg', 'Error saving run information or fetching weather data.');
          res.redirect('/logRun');
      }
  });


app.get("/viewData", async (req, res) => {
    try {
        const data = await Applicant.find().sort({ date: -1 });
        res.render('runningData', { data });
    } catch (error) {
        console.error("Error retrieving data: ", error);
        res.status(500).send("Error retrieving data.");
    }
});

// Leaderboard Page
app.get("/leaderboard", async (req, res) => {
    try {
        const runners = await Applicant.aggregate([
            { 
                $group: { 
                    _id: "$name", // Group by name
                    totalMiles: { $sum: "$distance" } // Sum the total miles
                } 
            },
            { $sort: { totalMiles: -1 } } // Sort by total miles in descending order
        ]);

        console.log("Runners Data:", runners); // Debugging line

        // Render the leaderboard page and pass the aggregated data
        res.render('leaderboard', { runners });
    } catch (error) {
        console.error("Error retrieving leaderboard data:", error);
        res.status(500).send("Error retrieving leaderboard data.");
    }
});

// app.get("/adminRemove", (req, res) => { //render
//     res.render("adminRemove");
//   });

app.post("/adminRemove", async (req, res) => {
    try {
      const result = await Applicant.deleteMany({});
      console.log(`All applicants removed. Count: ${result.deletedCount}`);
      res.redirect("/leaderboard"); // Redirect to leaderboard or any other page
    } catch (error) {
      console.error("Error removing all applicants:", error);
      res.status(500).send("Error removing all applications.");
    }
  });

  app.post('/processRemoveApplicants', async (req, res) => {
    const result = await Applicant.deleteMany({});
    const count = result.deletedCount;
    res.render('processRemoveApplicants', {
        count: count || 0, //0 if count isnt a number
    });
});


app.get("/myJourney", (req, res) => {
    res.render('myJourney'); 
});

// MyJourney Results Route
app.post("/myJourney", async (req, res) => {
    const { name, age } = req.body;
    try {
        // Find all runs matching the given name and age
        const runs = await Applicant.find({ name, age }).sort({ date: -1 });
        res.render('myJourneyResults', { user: { name, age }, runs });
    } catch (error) {
        console.error("Error retrieving user's runs:", error);
        res.status(500).send("Error retrieving your runs.");
    }
});


app.listen(portNumber);