const express = require("express");
const app = express();
let port = process.env.PORT || 3000;

const jwt_decode = require('jwt-decode');
const jwt_encode = require('jwt-encode')

require('dotenv').config()

const bodyParser = require('body-parser')
var jsonParser = bodyParser.json()

// For parsing application/json
app.use(express.json());

// For parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));


const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
    rejectUnauthorized: false
    }
});


var Airtable = require('airtable');
const e = require("express");
var base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);


const rateLimit = require("express-rate-limit");

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

//  apply to all requests
app.use(limiter);


app.get("/authenticate/:token", async (req, res) => {
    
    token = req.params.token

    if (!(await authorize(
        {
            "eleos-platform-key": req.headers["eleos-platform-key"],
            "authorization": "Token token=" + token
        }
    )))
    res.status(401).send("Unauthorized.")

    else {

        try {
            

            decoded = jwt_decode(token)

            fullName = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
            username = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']

            secret = 'hsd15f9tad2j1wd21j4a9'

            encoded = jwt_encode(
                {
                    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': fullName, 
                    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' : username
                }, secret)

            userObj = await getUserObj(username)

            userObj = cleanObj(userObj)

            user = {
                api_token: token,
                full_name: userObj.full_name
            }

            if (userObj.web_token) user['web_token'] = userObj.full_name
            if (userObj.billing_code) user['billing_code'] = userObj.billing_code
            if (userObj.billing_description) user['billing_description'] = userObj.billing_description
            if (userObj.billing_type) user['billing_type'] = userObj.billing_type
            if (userObj.menu_code) user['menu_code'] = userObj.menu_code
            if (userObj.dashboard_code) user['dashboard_code'] = userObj.dashboard_code
            if (userObj.custom_settings_form_code) user['custom_settings_form_code'] = userObj.custom_settings_form_code
            if (userObj.custom) user['custom'] = userObj.custom
            if (userObj.username) user['username'] = userObj.username
            if (userObj.division_code) user['division_code'] = userObj.division_code
            
            res.status(200).json(user)
            
        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }

})

app.get('/loads', async (req, res) => {

    if (!(await authorize(req.headers))) {
        res.status(401).send("Unauthorized.")
    }
    
    else {
        
        try {

            loads = await executeQuery('SELECT * FROM loads')
            
            for (const i in loads) {

                if (loads[i].route_options) {
                    routeOptions = await executeQuery(`SELECT * FROM route_options WHERE route_options.options_id = ${loads[i].route_options}`)
                    delete routeOptions[0]["options_id"]
                    routeOptions[0] = cleanObj(routeOptions[0])
                    loads[i].route_options = routeOptions[0]
                }

                if (loads[i].truck) {
                    truck = await executeQuery(`SELECT * FROM trucks WHERE trucks.truck_id = ${loads[i].truck}`)
                    delete truck[0]["truck_id"]
                    truck[0] = cleanObj(truck[0])
                    loads[i].truck = truck[0]
                }

                loads[i]['actions'] = []
                // actions = await executeQuery(`SELECT * FROM load_action, actions WHERE load_action.action_id = actions.action_id AND load_action.load_id = '${loads[i].id}'`)
                // for (const j in actions) {
                //     delete actions[j]["load_id"]
                //     delete actions[j]["action_id"]

                //     properties = await executeQuery(`SELECT * FROM properties WHERE properties.properties_id = ${actions[j].properties}`)
                //     delete properties[0]['properties_id']
                //     actions[j].properties = properties[0]

                //     loads[i].actions.push(actions[j])
                // }

                loads[i]['stops'] = []
                stops = await executeQuery(`SELECT * FROM load_stop, stops WHERE load_stop.stop_id = stops.stop_id AND load_stop.load_id = '${loads[i].id}'`)
                for (const j in stops) {
                    delete stops[j]["load_id"]

                    stops[j]['identifiers'] = []
                    identifiers = await executeQuery(`SELECT * FROM stop_identifier, identifiers WHERE stop_identifier.identifier_id = identifiers.identifier_id AND stop_identifier.stop_id = ${stops[j].stop_id}`)
                    for (const k in identifiers) {
                        delete identifiers[k]['identifier_id']
                        delete identifiers[k]['stop_id']
                        
                        identifiers[k] = cleanObj(identifiers[k])
                        stops[j].identifiers.push(identifiers[k])
                    }

                    delete stops[j]["stop_id"]

                    stops[j] = cleanObj(stops[j])
                    loads[i].stops.push(stops[j])
                }

                loads[i] = cleanObj(loads[i])

            }

            

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


})

app.get('/truck', async (req, res) => {

    if (!(await authorize(req.headers))) {
        res.status(401).send("Unauthorized.")
    }
    else {

        try {

            myTruck = await executeQuery('SELECT summary, name, location FROM mytruck')

            myTruck = myTruck[0]
            
            if (myTruck.location) {
                location = await executeQuery(`SELECT latitude, longitude FROM locations WHERE locations.id = ${myTruck.location}`)
                myTruck.location = location[0]
            }

            myTruck = cleanObj(myTruck)

            res.status(200).json(myTruck);

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }
})

app.get('/payroll', async (req, res) => {

    if (!(await authorize(req.headers))) {
        res.status(401).send("Unauthorized.")
    }
    else {

        try {

            payroll = await executeQuery('SELECT * FROM paychecks')

            for (const i in payroll) {
                

                payroll[i]['details'] = []
                details = await executeQuery(`SELECT * FROM paycheckdetails, details WHERE paycheckdetails.details_id = details.id AND paycheckdetails.paycheck_id = '${payroll[i].id}'`)
                delete payroll[i].id
                for (const j in details) {

                    delete details[j].details_id
                    delete details[j].paycheck_id
                    delete details[j].id

                    details[j] = cleanObj(details[j])
                    payroll[i].details.push(details[j])
                }

                payroll[i] = cleanObj(payroll[i])

            }


            res.status(200).json({paychecks: payroll});

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }
})

app.get('/driver_status', async (req, res) => {

    if (!(await authorize(req.headers))) {
        res.status(401).send("Unauthorized.")
    }
    else {

        try {

            driverStatus = await executeQuery('SELECT * FROM driver_status')

            driverStatus = driverStatus[0]

            driverStatus['hours_of_service'] = []

            hours_of_service = await executeQuery(`SELECT * FROM hos WHERE driver_status = ${driverStatus.id}`)


            for (const i in hours_of_service) {
                delete hours_of_service[i].id
                delete hours_of_service[i].driver_status

                hours_of_service[i] = cleanObj(hours_of_service[i])
                driverStatus.hours_of_service.push(hours_of_service[i])
            }
            delete driverStatus.id

            driverStatus = cleanObj(driverStatus)

            res.status(200).json(driverStatus);

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }
})

app.get('/todos', async (req, res) => {

    if (!(await authorize(req.headers))) {
        res.status(401).send("Unauthorized.")
    }
    else {

        try {

            todos = await executeQuery('SELECT * FROM TODOs')

            for (const i in todos) {
            
                if (todos[i].properties) {
                    properties = await executeQuery(`SELECT * FROM TODOProperties WHERE TODOProperties.id = ${todos[i].properties}`)
                    properties = properties[0]

                    delete properties.id
                    properties = cleanObj(properties)
                    todos[i].properties = properties
                }

                todos[i] = cleanObj(todos[i])

        }

            res.status(200).json(todos);

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
        
    }
})

app.put("/messages/:handle", jsonParser, async (req, res) => {

    

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY)
    res.status(401).send("Unauthorized.")

    else {

        try {

            const handle = req.params.handle
            const body = req.body

            if (!validateMsg(body)) throw err;

            query = "INSERT INTO messages (handle, direction, username, message_type, composed_at, platform_received_at, body, form_code, form_date, contact, read_at, deleted_at, in_reply_to_handle, workflow_action) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)"

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
                body.workflow_action
            ]
            
            await executeQuery(query, values)


            res.status(200).json( {handle: handle} )


        } catch(err) {
            res.status(400).json( [{ description: "Invalid message data.", code: 400}])
        }
    }  
})

app.put("/tripchanges/:handle", jsonParser, async (req, res) => {

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY)
    res.status(401).send("Unauthorized.")

    else {

        try {

            const handle = req.params.handle
            const body = req.body

            const tripChange = {
                handle: handle,
                username: body.username || '',
                load_id: body.load_id || '',
                timestamp: body.timestamp || '1000-01-01T00:00:00+00:00',
                location: body.location || null,
                type: body.type || '',
                new_location: body.new_location || null,
                stop_number: body.stop_number || null,
                name: body.name || '',
                address: body.address || '',
                postal_code: body.postal_code || '',
                state: body.state || '',
                city: body.city || '',
                crowd_sourced: body.crowd_sourced || null,
                accuracy: body.accuracy || '',
                error_code: body.error_code || '',
                from_poi: body.from_poi || ''
                
            }
            
            query = "INSERT INTO tripchanges (handle, username, load_id, timestamp, location, type, new_location, stop_number, name, address, postal_code, state, city, crowd_sourced, accuracy, error_code, from_poi) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)"

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
                body.from_poi
                
            ]

            await executeQuery(query, values)


            res.status(200).json( {handle: handle} )


        } catch(err) {
            res.status(400).json( [{ description: "Invalid tripchange data.", code: 400}])
        }
    }  
})


app.listen(port, () => {
    console.log(
        `carsondemoservice is listening on port http://localhost:${port}`);
})

validateMsg = (msg) => {
    let valid = true;
    
    if (!(msg.hasOwnProperty("direction") && 
        msg.hasOwnProperty("username") &&
        msg.hasOwnProperty("composed_at") &&
        msg.hasOwnProperty("platform_received_at") &&
        msg.hasOwnProperty("message_type"))) {
            valid = false;
        }
    
        if (msg.direction != "inbound" && msg.direction != "outbound") {
            valid = false;
        }

        if (msg.message_type != "text" && msg.message_type != "form") {
            valid = false;
        }

        if (msg.hasOwnProperty("body") && msg.message_type === "form") {
            valid = false
        }



    return valid;

}

authorize = async (header) => {


    if (header["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY)
    return false

    try {

        token = header["authorization"].split("=")[1]

        decoded = jwt_decode(token)

        username = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']

        // base('Users').find(username, async function(err, record) {
        //         if (err) { console.error(err); return; }
        //         loadIDArr = await record._rawJson.fields.Loads

        //     });


        return new Promise((resolve) => {
            base('Users').select({
                filterByFormula: `{username} = "${username}"`,
                }).eachPage(function page(records) {

                    resolve(records.length != 0)
                    
                })
            })
                

    } catch(err) {
        console.log("Invalid Token")
        return false
    }

}

getUserObj = async(username) => {

    return new Promise((resolve) => {
        base('Users').select({
            filterByFormula: `{username} = "${username}"`,
            }).eachPage(function page(records) {
                
                resolve(records[0]._rawJson.fields)
                
            })
        })

}

executeQuery = async (query, values) => {

    try {

        const client = await pool.connect();
        const result = await client.query(query, values);

        client.release();

        return await result.rows
        
        
    } catch (err) {
        console.error(err);
        return
    }

}

cleanObj = (obj) => {
    for (var propName in obj) {
        if (obj[propName] === null) {
            delete obj[propName]
        }
    }
    return obj
}