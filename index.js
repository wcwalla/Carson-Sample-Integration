const express = require("express");
const app = express();
let port = process.env.PORT || 3000;

const jwt_decode = require('jwt-decode');

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

    try {

        // results = await executeQuery(
        //     `INSERT INTO api_tokens VALUES ('${token}')`)

        // results.length != 0 ? res.status(200).json(results[0]) : res.status(401).send("Unauthorized.")

        decoded = jwt_decode(token)

        await executeQuery(
            `INSERT INTO api_tokens (api_token) VALUES ('${token}')`)

        res.status(200).json(
            {
                api_token: token, 
                full_name: decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'], 
                username: decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
            }
        )
        
    } catch (err) {
        console.error(err);
        res.status(400).send("Error " + err);
    }

})

app.get('/loads', async (req, res) => {

    // if (await invalidToken(req.headers["authorization"])) res.status(401).send("Unauthorized.")
    
    // else {
        
        try {

            results = await executeQuery('SELECT * FROM loads')

            res.status(200).json(results);

        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
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


    // }   
})

app.put("/messages/:handle", jsonParser, async (req, res) => {

    const handle = req.params.handle
    const body = req.body

    // if (await invalidToken(req.headers["authorization"])) res.status(401).send("Unauthorized.")

    //else {

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

            // fs.readFile('./data/messages.json', 'utf-8', function(err, data) {
            //     if (err) throw err
            
            //     var messages = JSON.parse(data)
            //     messages.push(message)

            
            //     fs.writeFile('./data/messages.json', JSON.stringify(messages), 'utf-8', function(err) {
            //         if (err) throw err
            //     })
            // })


        } catch(err) {
            res.status(400).json( [{ description: "Invalid message data.", code: 400}])
        }
    //}  
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