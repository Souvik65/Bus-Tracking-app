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
let activeBuses = {};  // Track active bus numbers

io.on("connection", function (socket) {
    console.log(`User connected: ${socket.id}`);
    socket.emit("initial-locations", userLocations);

    socket.on("send-location", function (data) {
        if (!data.latitude || !data.longitude || isNaN(data.latitude)) {
            socket.emit("error", "Invalid location data.");
            return;
        }
        if (activeBuses[data.busNumber]) {
            socket.emit("error", "Bus already active.");
            return;
        }
        activeBuses[data.busNumber] = socket.id;
        userLocations[socket.id] = { id: socket.id, ...data };
        io.emit("receive-location", userLocations);
    });

    socket.on("request-locations", function () {
        socket.emit("receive-location", userLocations);
    });

    socket.on("request-all-buses", function () {
        socket.emit("all-buses", Object.values(userLocations));
    });

    socket.on("stop-location-sharing", function (busNumber) {
        delete userLocations[socket.id];
        delete activeBuses[busNumber];
        io.emit("receive-location", userLocations);
        io.emit("bus-stopped", busNumber);  // Notify clients to update dropdown
    });

    socket.on("location-shared", function (busNumber) {
        io.emit("location-shared", busNumber);
    });

    socket.on("disconnect", function () {
        console.log(`User disconnected: ${socket.id}`);
        for (const bus in activeBuses) {
            if (activeBuses[bus] === socket.id) delete activeBuses[bus];
        }
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