const express = require('express');
const path = require("path");
const http = require("http");
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

let userLocations = {};

io.on("connection", function (socket) {
    console.log(`User  connected: ${socket.id}`);
    socket.emit("initial-locations", userLocations); // Send all current locations to new connection

    socket.on("send-location", function (data) {
        if (data.latitude && data.longitude) {
            userLocations[socket.id] = { id: socket.id, ...data };
            io.emit("receive-location", userLocations);
        } else {
            console.error("Invalid location data received:", data);
        }
    });

    socket.on("location-shared", function (busNumber) {
        io.emit("location-shared", busNumber); // Notify all users
    });

    socket.on("disconnect", function () {
        console.log(`User  disconnected: ${socket.id}`);
        delete userLocations[socket.id]; 
        io.emit("user-disconnected", socket.id);
    });
});

app.get("/", function (req, res) {
    res.render("index");
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});