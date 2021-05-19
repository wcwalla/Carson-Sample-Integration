const express = require("express");
const app = express();
let port = process.env.PORT || 3000;
const userData = require("./users.json");

app.get("/authenticate/:token", (req, res) => {
    var token = req.params.token
    res.send(userData)
})

app.listen(port, () => {
    console.log(`carsondemoservice is listening on port http://localhost:${port}`);
})