//Initialize back-end framework as express
const express = require("express");
const app = express();
let port = process.env.PORT || 3000;

//jwt token encoding/decoding functons
const jwt_decode = require("jwt-decode");
const jwt_encode = require("jwt-encode");

//Allows for use of .env file while testing
require("dotenv").config();

//Get parser functions
const bodyParser = require("body-parser");
var jsonParser = bodyParser.json();

// For parsing application/json
app.use(express.json());

// For parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

//Initialize postgres database
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

//Initialize Airtable database
var Airtable = require("airtable");
const e = require("express");
var base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

//Limits the rate at which requests are processed.
const rateLimit = require("express-rate-limit");

app.set("trust proxy", 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

//  apply to all requests
app.use(limiter);

//Sends a basic html homepage
app.get("/", async(req, res) => {
  res.sendFile('homepage.html', { root: __dirname })
});

/* Verifies a token. This request will not be retried unless the user chooses to retry. If a 401 is returned, the user is forcibly logged out of the app and required to login again to continue usage. If a different api_token is returned in this response, the token used to authenticate this response is exchanged with the new token for future requests. */

app.get("/authenticate/:token", async (req, res) => {
  //Get token from request params
  token = req.params.token;

  //Check for valid platform key and user token
  if (
    !(await authorize({
      "eleos-platform-key": req.headers["eleos-platform-key"],
      authorization: "Token token=" + token,
    }))
  )
    res.status(401).send("Unauthorized.");
  else {
    try {
      //Decode the user-provided token
      decoded = jwt_decode(token);

      fullName =
        decoded[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
        ];
      username =
        decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];

      //Generate a new random secret string
      secret = getSecret();

      //Generate a new token with the decoded username, full name, and new secret
      encoded = jwt_encode(
        {
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier":
            fullName,
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name":
            username,
        },
        secret
      );

      //Get the user data associated with the decoded token data
      userObj = await getUserObj(username);

      //Remove null properties of the user object
      userObj = cleanObj(userObj);

      //Build the user object to respond with
      user = {
        api_token: encoded,
        full_name: userObj.full_name,
      };

      if (userObj.web_token) user["web_token"] = userObj.full_name;
      if (userObj.billing_code) user["billing_code"] = userObj.billing_code;
      if (userObj.billing_description)
        user["billing_description"] = userObj.billing_description;
      if (userObj.billing_type) user["billing_type"] = userObj.billing_type;
      if (userObj.menu_code) user["menu_code"] = userObj.menu_code;
      if (userObj.dashboard_code)
        user["dashboard_code"] = userObj.dashboard_code;
      if (userObj.custom_settings_form_code)
        user["custom_settings_form_code"] = userObj.custom_settings_form_code;
      if (userObj.custom) user["custom"] = userObj.custom;
      if (userObj.username) user["username"] = userObj.username;
      if (userObj.division_code) user["division_code"] = userObj.division_code;

      //Send the parsed user object and new token
      res.status(200).json(user);
    } catch (err) {
      console.error(err);
      res.status(400).send("Error: Trouble getting user from airtable.");
    }
  }
});

/* This service will enumerate loads for the Eleos Mobile Platform. It is invoked by the platform every time a user updates their load list, which occurs when they open it or refresh the screen manually. This request will not be retried unless the user manually retries it. */

app.get("/loads", async (req, res) => {
  //Check for a valid platform key and user token
  if (!(await authorize(req.headers))) {
    res.status(401).send("Unauthorized.");
  } else {
    try {
      //Get all loads from database
      loads = await executeQuery("SELECT * FROM loads");

      //build the object for each load
      for (const i in loads) {
        //If load has route options, associate the corresponding object
        if (loads[i].route_options) {
          //Get the corresponding object from the database
          routeOptions = await executeQuery(
            `SELECT * FROM route_options WHERE route_options.options_id = ${loads[i].route_options}`
          );

          //Remove unnecessary properties
          delete routeOptions[0]["options_id"];
          routeOptions[0] = cleanObj(routeOptions[0]);

          //Add resulting object to the load object
          loads[i].route_options = routeOptions[0];
        }

        //If load has a truck, associate the corresponding object
        if (loads[i].truck) {
          //Get the corresponding object from the database
          truck = await executeQuery(
            `SELECT * FROM trucks WHERE trucks.truck_id = ${loads[i].truck}`
          );

          //Remove unnecessary properties
          delete truck[0]["truck_id"];
          truck[0] = cleanObj(truck[0]);

          //Add resulting object to the load object
          loads[i].truck = truck[0];
        }

        //If load has actions, associate the corresponding objects
        loads[i]["actions"] = [];
        // actions = await executeQuery(`SELECT * FROM load_action, actions WHERE load_action.action_id = actions.action_id AND load_action.load_id = '${loads[i].id}'`)
        // for (const j in actions) {
        //     delete actions[j]["load_id"]
        //     delete actions[j]["action_id"]

        //     properties = await executeQuery(`SELECT * FROM properties WHERE properties.properties_id = ${actions[j].properties}`)
        //     delete properties[0]['properties_id']
        //     actions[j].properties = properties[0]

        //     loads[i].actions.push(actions[j])
        // }

        //If load has stops, associate the corresponding objects
        loads[i]["stops"] = [];

        //Get all stops associated with this load from db
        stops = await executeQuery(
          `SELECT * FROM load_stop, stops WHERE load_stop.stop_id = stops.stop_id AND load_stop.load_id = '${loads[i].id}'`
        );

        //For each stop, associate it with corresponding objects
        for (const j in stops) {
          delete stops[j]["load_id"];
          stops[j]["identifiers"] = [];

          //Get all identifiers associated with this stop
          identifiers = await executeQuery(
            `SELECT * FROM stop_identifier, identifiers WHERE stop_identifier.identifier_id = identifiers.identifier_id AND stop_identifier.stop_id = ${stops[j].stop_id}`
          );

          //Clean each identifier object and push it
          for (const k in identifiers) {
            //Remove unnecessary properties
            delete identifiers[k]["identifier_id"];
            delete identifiers[k]["stop_id"];
            identifiers[k] = cleanObj(identifiers[k]);

            //Add the identifier to the stop object
            stops[j].identifiers.push(identifiers[k]);
          }

          //Remove unnecessary properties from stop object
          delete stops[j]["stop_id"];
          stops[j] = cleanObj(stops[j]);

          //Add stop to load object
          loads[i].stops.push(stops[j]);
        }

        //Remove unnecessary properties from load object
        loads[i] = cleanObj(loads[i]);
      }

      //Send the loads
      res.status(200).json(loads);
    } catch (err) {
      console.error(err);
      res.status(400).send("Error " + err);
    }
  }

  // base('Users').find('recC4akuoI8ge9rvH', async function(err, record) {
  //     if (err) { console.error(err); return; }
  //     loadIDArr = await record._rawJson.fields.Loads

  //     loads = []
  //     for (const loadID in loadIDArr) {
  //         base('Loads').find(loadIDArr[loadID], async function(err, record) {
  //             if (err) { console.error(err); return; }
  //             loads.push(await record._rawJson.fields)
  //             if (loads.length == loadIDArr.length) res.status(200).json(loads)
  //         });
  //     }
  // });
});

//Return status related to truck repairs and optionally location.

app.get("/truck", async (req, res) => {
  //Check for a valid platform key and user token
  if (!(await authorize(req.headers))) {
    res.status(401).send("Unauthorized.");
  } else {
    try {
      //Get the truck from the database
      myTruck = await executeQuery(
        "SELECT summary, name, location FROM mytruck"
      );

      myTruck = myTruck[0];

      //If truck has an associated location, add it to truck object
      if (myTruck.location) {
        location = await executeQuery(
          `SELECT latitude, longitude FROM locations WHERE locations.id = ${myTruck.location}`
        );
        myTruck.location = location[0];
      }

      //Remove unnecessary properties
      myTruck = cleanObj(myTruck);

      //Send the truck status
      res.status(200).json(myTruck);
    } catch (err) {
      console.error(err);
      res.status(400).send("Error " + err);
    }
  }
});

//This service returns a list of payroll information for the driver

app.get("/payroll", async (req, res) => {
  //Check for valid platform key and user token
  if (!(await authorize(req.headers))) {
    res.status(401).send("Unauthorized.");
  } else {
    try {
      //Get payroll from database
      payroll = await executeQuery("SELECT * FROM paychecks");

      //For each paycheck in payroll
      for (const i in payroll) {
        payroll[i]["details"] = [];

        //Get details for this paycheck from database
        details = await executeQuery(
          `SELECT * FROM paycheckdetails, details WHERE paycheckdetails.details_id = details.id AND paycheckdetails.paycheck_id = '${payroll[i].id}'`
        );

        delete payroll[i].id;

        //For each detail object for this paycheck..
        for (const j in details) {
          //Remove unnecessary object properties
          delete details[j].details_id;
          delete details[j].paycheck_id;
          delete details[j].id;
          details[j] = cleanObj(details[j]);

          //Add this detail to the paycheck object
          payroll[i].details.push(details[j]);
        }

        //Remove unnecessary properties from paycheck object
        payroll[i] = cleanObj(payroll[i]);
      }

      //Send the payroll
      res.status(200).json({ paychecks: payroll });
    } catch (err) {
      console.error(err);
      res.status(400).send("Error " + err);
    }
  }
});

/* This service will return a boolean driving status value, which will determine in concert with the GPS activity if the app should lock and prevent use. In addition, the service can return hours of service clocks, which will be shown on the hos dashboard card if one is defined. */

app.get("/driver_status", async (req, res) => {
  //Check for valid platform key and user token
  if (!(await authorize(req.headers))) {
    res.status(401).send("Unauthorized.");
  } else {
    try {
      //Get driver status from database
      driverStatus = await executeQuery("SELECT * FROM driver_status");

      driverStatus = driverStatus[0];

      driverStatus["hours_of_service"] = [];

      //Get hos entries for this driver from database
      hours_of_service = await executeQuery(
        `SELECT * FROM hos WHERE driver_status = ${driverStatus.id}`
      );

      //For each hos entry from this driver..
      for (const i in hours_of_service) {
        //Remove unnecessary properties from hos object
        delete hours_of_service[i].id;
        delete hours_of_service[i].driver_status;
        hours_of_service[i] = cleanObj(hours_of_service[i]);

        //Add this hos entry to the driver status object
        driverStatus.hours_of_service.push(hours_of_service[i]);
      }

      //Remove unnecessary properties from driver status object
      delete driverStatus.id;
      driverStatus = cleanObj(driverStatus);

      //Send the driver status
      res.status(200).json(driverStatus);
    } catch (err) {
      console.error(err);
      res.status(400).send("Error " + err);
    }
  }
});

//This service returns a list of upcoming tasks a driver must complete

app.get("/todos", async (req, res) => {
  //Check for valid platform key and user token
  if (!(await authorize(req.headers))) {
    res.status(401).send("Unauthorized.");
  } else {
    try {
      //Get all todos from the database
      todos = await executeQuery("SELECT * FROM TODOs");

      //For each todo...
      for (const i in todos) {
        //If the todo has properties, get them from the database
        if (todos[i].properties) {
          properties = await executeQuery(
            `SELECT * FROM TODOProperties WHERE TODOProperties.id = ${todos[i].properties}`
          );
          properties = properties[0];

          //Remove unnecessary properties from properties object
          delete properties.id;
          properties = cleanObj(properties);

          //Add properties to the todo object
          todos[i].properties = properties;
        }

        //Remove unnecessary properties from todo object
        todos[i] = cleanObj(todos[i]);
      }

      //Send the todos
      res.status(200).json(todos);
    } catch (err) {
      console.error(err);
      res.status(400).send("Error " + err);
    }
  }
});

//This service allows the Eleos Mobile Platform to transmit messages from drivers to this backend system.

app.put("/messages/:handle", jsonParser, async (req, res) => {
  //Check for valid platform key
  if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY)
    res.status(401).send("Unauthorized.");
  else {
    try {
      //Get param and body from request
      const handle = req.params.handle;
      const body = req.body;

      //Check that the message object received contains required properties
      if (!validateMsg(body)) throw err;

      //Fields to insert values into
      query =
        "INSERT INTO messages (handle, direction, username, message_type, composed_at, platform_received_at, body, form_code, form_date, contact, read_at, deleted_at, in_reply_to_handle, workflow_action) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)";

      //Values to insert into the database
      values = [
        handle,
        body.direction,
        body.username,
        body.message_type,
        body.composed_at,
        body.platform_received_at,
        body.body,
        body.form_code,
        body.form_date,
        body.contact,
        body.read_at,
        body.deleted_at,
        body.in_reply_to_handle,
        body.workflow_action,
      ];

      //Insert the message into the database
      await executeQuery(query, values);

      //Echo the handle back to the sender
      res.status(200).json({ handle: handle });
    } catch (err) {
      res
        .status(400)
        .json([{ description: "Invalid message data.", code: 400 }]);
    }
  }
});

/* This service allows the Eleos Mobile Platform to transmit a change made to a trip to this backend system. */

app.put("/tripchanges/:handle", jsonParser, async (req, res) => {
  //Check for valid platform key
  if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY)
    res.status(401).send("Unauthorized.");
  else {
    try {
      //Get param and body from request
      const handle = req.params.handle;
      const body = req.body;

      //Fields to insert values into
      query =
        "INSERT INTO tripchanges (handle, username, load_id, timestamp, location, type, new_location, stop_number, name, address, postal_code, state, city, crowd_sourced, accuracy, error_code, from_poi) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)";

      //Values to insert into the database
      values = [
        handle,
        body.username,
        body.load_id,
        body.timestamp,
        body.location,
        body.type,
        body.new_location,
        body.stop_number,
        body.name,
        body.address,
        body.postal_code,
        body.state,
        body.city,
        body.crowd_sourced,
        body.accuracy,
        body.error_code,
        body.from_poi,
      ];

      //Insert the trip changes into the database
      await executeQuery(query, values);

      //Echo the handle back to the sender
      res.status(200).json({ handle: handle });
    } catch (err) {
      res
        .status(400)
        .json([{ description: "Invalid tripchange data.", code: 400 }]);
    }
  }
});

//Listens on specified port

app.listen(port, () => {
  console.log(
    `carsondemoservice is listening on port http://localhost:${port}`
  );
});

//Checks if a message object is valid
validateMsg = (msg) => {
  let valid = true;

  //Checks if the message contains required properties
  if (
    !(
      msg.hasOwnProperty("direction") &&
      msg.hasOwnProperty("username") &&
      msg.hasOwnProperty("composed_at") &&
      msg.hasOwnProperty("platform_received_at") &&
      msg.hasOwnProperty("message_type")
    )
  ) {
    valid = false;
  }

  //Message direction must be inbound or outbound
  if (msg.direction != "inbound" && msg.direction != "outbound") {
    valid = false;
  }

  //Message type must be text or form
  if (msg.message_type != "text" && msg.message_type != "form") {
    valid = false;
  }

  //If a message's type is a form, it cannot have a body.
  if (msg.hasOwnProperty("body") && msg.message_type === "form") {
    valid = false;
  }

  return valid;
};

//Authorizes a request by validating its platform key and user token

authorize = async (header) => {
  //If the request's platform key does not match the expected, it is invalid.
  if (header["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY)
    return false;

  try {
    //Get the token from the header
    token = header["authorization"].split("=")[1];

    //Decode the user-provided token and get the user from it
    decoded = jwt_decode(token);
    username =
      decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];

    //Check if a user with this username exists in Airtable
    return new Promise((resolve) => {
      base("Users")
        .select({
          filterByFormula: `{username} = "${username}"`,
        })
        .eachPage(function page(records) {
          //If there are no records returned, the user is not valid.
          resolve(records.length != 0);
        });
    });
  } catch (err) {
    console.log("Invalid Token");
    return false;
  }
};

//Gets the user data associated with a username from Airtable
getUserObj = async (username) => {
  return new Promise((resolve) => {
    base("Users")
      .select({
        filterByFormula: `{username} = "${username}"`,
      })
      .eachPage(function page(records) {
        //Return the user data from the resulting user object
        resolve(records[0]._rawJson.fields);
      });
  });
};

//Executes a specified query with optional parameters
executeQuery = async (query, values) => {
  try {
    //Access postgres database
    const client = await pool.connect();

    //Get results from the specified query
    const result = await client.query(query, values);

    //Done with this access
    client.release();

    //Return query results
    return await result.rows;
  } catch (err) {
    console.error(err);
    return;
  }
};

//Removes all null properties from an object
cleanObj = (obj) => {
  //For every property in this object, if it is null, delete it.
  for (var propName in obj) {
    if (obj[propName] === null) {
      delete obj[propName];
    }
  }
  return obj;
};

//Generates a random base36 string
getSecret = () => {
  return Math.random().toString(36).substr(2);
};
