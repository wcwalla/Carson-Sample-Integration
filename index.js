const express = require("express");
const app = express();
let port = process.env.PORT || 3000;
const userData = require("./data/users.json");
const loadData = require("./data/loads.json");
var messageData = require("./data/messages.json");
const fs = require("fs")

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
    rejectUnauthorized: false
    }
});

app.get("/authenticate/:token", (req, res) => {
    var token = req.params.token
    let user = userData.filter(function(item) { return item.api_token === token; })
    res.send(user[0])
})

app.get("/loads", (req, res) => {
    res.send(loadData)
})

app.get('/db', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM loads');
        const results = { 'results': (result) ? result.rows : null};
        //res.render('pages/db', results );
        res.json(results);
        client.release();
    } catch (err) {
        console.error(err);
        res.send("Error " + err);
    }
})

app.put("/messages/:handle", (req, res) => {
    var handle = req.params.handle
    message = {handle: handle}
    res.send(message)

    fs.readFile('./messages.json', 'utf-8', function(err, data) {
        if (err) throw err
    
        var messages = JSON.parse(data)
        messages.push(message)

    
        fs.writeFile('./messages.json', JSON.stringify(messages), 'utf-8', function(err) {
            if (err) throw err
        })
    })
})

app.listen(port, () => {
    console.log(`carsondemoservice is listening on port http://localhost:${port}`);
})

function jsonReader(filePath, cb) {
    fs.readFile(filePath, (err, fileData) => {
        if (err) {
            return cb && cb(err)
        }
        try {
            const object = JSON.parse(fileData)
            return cb && cb(null, object)
        } catch(err) {
            return cb && cb(err)
        }
    })
}