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
var base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);


app.get("/authenticate/:token", async (req, res) => {
    
    token = req.params.token

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY) {
        res.status(401).send("Unauthorized.")
    }
    else {

        try {

            // results = await executeQuery(
            //     `INSERT INTO api_tokens VALUES ('${token}')`)

            // results.length != 0 ? res.status(200).json(results[0]) : res.status(401).send("Unauthorized.")

            decoded = jwt_decode(token)

            fullName = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
            username = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']

            await executeQuery(
                `INSERT INTO api_tokens (api_token) VALUES ('${token}')`)

            secret = 'hsd15f9tad2j1wd21j4a9'

            encoded = jwt_encode(
                {
                    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': fullName, 
                    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' : username
                }, secret)

            res.status(200).json(
                {
                    api_token: encoded, 
                    full_name: fullName, 
                    username: username
                }
            )
            
        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }

})

app.get('/loads', async (req, res) => {

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY) {
        res.status(401).send("Unauthorized.")
    }
    
    else {
        
        try {

            loads = await executeQuery('SELECT * FROM loads')
            
            for (const i in loads) {

                if (loads[i].route_options) {
                    routeOptions = await executeQuery(`SELECT * FROM route_options WHERE route_options.options_id = ${loads[i].route_options}`)
                    delete routeOptions[0]["options_id"]
                    loads[i].route_options = routeOptions[0]
                }

                if (loads[i].truck) {
                    truck = await executeQuery(`SELECT * FROM trucks WHERE trucks.truck_id = ${loads[i].truck}`)
                    delete truck[0]["truck_id"]
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

                        stops[j].identifiers.push(identifiers[k])
                    }

                    delete stops[j]["stop_id"]
                    loads[i].stops.push(stops[j])
                }
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

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY) {
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

            res.status(200).json(myTruck);

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }
})

app.get('/payroll', async (req, res) => {

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY) {
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
                    payroll[i].details.push(details[j])
                }

            
            }
            res.status(200).json({paychecks: payroll});

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }
})

app.put("/messages/:handle", jsonParser, async (req, res) => {

    const handle = req.params.handle
    const body = req.body

    if (req.headers["eleos-platform-key"] != process.env.ELEOS_PLATFORM_KEY) {
        res.status(401).send("Unauthorized.")
    }

    else {

        try {

            if (!validateMsg(body)) throw err;

            const msg = {
                handle: handle,
                direction: body.direction,
                username: body.username, 
                message_type: body.message_type,
                composed_at: body.composed_at,
                platform_received_at: body.platform_received_at,
                body: body.body || '',
                form_code: body.form_code || '',
                form_date: body.form_date || '1000-01-01T00:00:00+00:00',
                contact: body.contact || '',
                read_at: body.read_at || '1000-01-01T00:00:00+00:00',
                deleted_at: body.deleted_at || '1000-01-01T00:00:00+00:00',
                in_reply_to_handle: body.in_reply_to_handle || '',
                workflow_action: body.workflow_action || null
                
            }
            
            await executeQuery(`INSERT INTO messages (handle, direction, username, message_type, composed_at, platform_received_at, body, form_code, form_date, contact, read_at, deleted_at, in_reply_to_handle, workflow_action) VALUES ('${msg.handle}', '${msg.direction}', '${msg.username}', '${msg.message_type}', '${msg.composed_at}', '${msg.platform_received_at}', '${msg.body}', '${msg.form_code}', '${msg.form_date}', '${msg.contact}', '${msg.read_at}', '${msg.deleted_at}', '${msg.in_reply_to_handle}', ${msg.workflow_action})`)


            res.status(200).json( {handle: msg.handle} )


        } catch(err) {
            res.status(400).json( [{ description: "Invalid message data.", code: 400}])
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

invalidToken = async (token) => { 

    results = await executeQuery(
        `SELECT * FROM api_tokens WHERE api_token = '${token}'`)

    return results.length == 0

}

executeQuery = async (query) => {

    try {

        const client = await pool.connect();
        const result = await client.query(query);

        client.release();

        return await result.rows
        
        
    } catch (err) {
        console.error(err);
        return
    }

}