const express = require("express");
const app = express();
let port = process.env.PORT || 3000;

const userData = require("./data/users.json");
var messageData = require("./data/messages.json");

const fs = require("fs")

// For parsing application/json
app.use(express.json());

// For parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));


const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgres://hbahjhiabhbemk:59e20c1b6c555c5d5bdd01230abad56be708453f70c1942963d8b0d65bdf3e1f@ec2-54-87-112-29.compute-1.amazonaws.com:5432/d1bmt92emnfsss",
    ssl: {
    rejectUnauthorized: false
    }
});

app.get("/authenticate/:token", (req, res) => {
    
    token = req.params.token

    let user = userData.filter(function(item) { return item.api_token === token; })

    user.length != 0 ? res.status(200).json(user[0]) : res.status(401).send("Unauthorized.")
})

app.get('/loads', async (req, res) => {

    if (!authenticateToken(req.headers["Authorization"])) res.status(401).send("Unauthorized.")
    
    else {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT * FROM loads');
            const results = { 'results': (result) ? result.rows : null};
            //res.render('pages/db', results );
            res.json(results.results);
            client.release();
        } catch (err) {
            console.error(err);
            res.status(400).send("Error " + err);
        }
    }   
})

app.put("/messages/:handle", (req, res) => {
    const handle = req.params.handle
    const body = req.body

    if (!authenticateToken(req.headers["Authorization"])) res.status(401).send("Unauthorized.")

    else {
        try {

            if (!validateMsg(body)) throw err;

            message = {
                handle: handle,
                direction: body.direction,
                username: body.username, 
                composed_at: body.composed_at,
                read_at: body.read_at,
                platform_received_at: body.platform_received_at,
                message_type: body.message_type,
                body: body ? body.body: null
            }


            res.status(200).json( {handle: message.handle} )

            fs.readFile('./data/messages.json', 'utf-8', function(err, data) {
                if (err) throw err
            
                var messages = JSON.parse(data)
                messages.push(message)

            
                fs.writeFile('./data/messages.json', JSON.stringify(messages), 'utf-8', function(err) {
                    if (err) throw err
                })
            })

        } catch(err) {
            res.status(400).json( [{ description: "Invalid message data.", code: 400}])
        }
    }  
})


app.listen(port, () => {
    console.log(`carsondemoservice is listening on port http://localhost:${port}`);
})

validateMsg = (msg) => {
    let valid = true;
    
    if (!(msg.hasOwnProperty("direction") && 
        msg.hasOwnProperty("username") &&
        msg.hasOwnProperty("composed_at") &&
        msg.hasOwnProperty("read_at") &&
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

authenticateToken = (token) => { 

    let user = userData.filter(function(item) { return item.api_token === token; })
    
    return user.length != 0
}