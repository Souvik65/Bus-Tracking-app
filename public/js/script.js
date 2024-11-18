const socket = io();
let map;
let markers = {};
let userType = '';
let busNumber = '';
let isLocating = false; // To prevent multiple geolocation requests
let locationUpdateInterval = null; // For throttling location updates

// Request notification permission
if (Notification.permission !== "granted") {
    Notification.requestPermission();
} 

// Initialize the map when the page loads
window.onload = function () {
    initMap(); 
    socket.on("initial-locations", updateMarkers);
    socket.on("receive-location", updateMarkers);
    socket.on("user-disconnected", removeMarker);
    socket.on("location-shared", notifyUsers);
};

// Initialize Leaflet Map
function initMap() {
    const defaultLocation = [23.829195, 91.278194]; // Default location
    map = L.map('myMap').setView(defaultLocation, 16);

    // Add OpenStreet Map tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Locate Me button
    const locateMeBtn = L.control({ position: 'topright' });
    locateMeBtn.onAdd = function () {
        const button = L.DomUtil.create('button', 'locate-me-btn');
        button.innerHTML = 'Locate Me';
        button.onclick = debounce(locateUser  , 300); // Debounced function call
        return button;
    };
    locateMeBtn.addTo(map);
}

// Debounce function to limit the rate of geolocation requests
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Locate user and center map
function locateUser  () {
    if (isLocating) return; // Prevent multiple requests
    isLocating = true; // Set flag 
    if (navigator.geolocation) {
        showLoadingIndicator(true); // Show loading indicator
        navigator.geolocation.getCurrentPosition(function (position) {
            const userLocation = [position.coords.latitude, position.coords.longitude];
            map.setView(userLocation, 16); // Center the map on user's location
            L.marker(userLocation).addTo(map) // Add marker for user location
                .bindPopup('You are here!')
                .openPopup();
            
            // Calculate distance to nearest bus in kilometers
            let nearestDistance = Infinity;
            for (const id in markers) {
                const markerLocation = markers[id].getLatLng();
                const distance = map.distance(userLocation, markerLocation) / 1000; // Convert to kilometers
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                }
            }
            showNotification(`Nearest bus is ${nearestDistance.toFixed(2)} kilometers away.`);
            isLocating = false; // Reset flag
            showLoadingIndicator(false); // Hide loading indicator
        }, function (error) {
            console.error("Geolocation error:", error);
            showNotification("Unable to retrieve your location. Please check your device settings.");
            isLocating = false; // Reset flag
            showLoadingIndicator(false); // Hide loading indicator
        });
    } else {
        showNotification("Geolocation is not supported by this browser.");
        isLocating = false; // Reset flag
    }
}

// Show loading indicator
function showLoadingIndicator(isLoading) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.style.display = isLoading ? 'block' : 'none';
}

// Custom bus icon
const busIcon = L.icon({
    iconUrl: '/images/bus.png', // Replace with the path to your bus PNG
    iconSize: [38, 38], // Size of the icon
    iconAnchor: [19, 38], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -38] // Point from which the popup should open relative to the iconAnchor
});

// Add or update marker on the map
function addMarker(id, lat, lng, busNumber) {
    if (markers[id]) {
        markers[id].setLatLng([lat, lng]); // Update position
        markers[id].getPopup().setContent(busNumber).update(); // Update popup with bus number
    } else {
        markers [id] = L.marker([lat, lng], { icon: busIcon }) // Use custom bus icon
            .addTo(map)
            .bindPopup(busNumber) // Add popup with bus number
            .openPopup();
    }
}

// Update markers based on received locations
function updateMarkers(locations) {
 // Clear the bus selection dropdown
    // const busSelect = document.getElementById('busSelect');
    // busSelect.innerHTML = '<option value="">Select a Bus</option>'; // Reset options

    for (const id in locations) {
        const { latitude, longitude, busNumber } = locations[id];
        addMarker(id, latitude, longitude, busNumber);
        // Add bus number to the dropdown
        if (!Array.from(busSelect.options).some(option => option.value === busNumber)) {
            const option = document.createElement('option');
            option.value = busNumber;
            option.textContent = busNumber;
            busSelect.appendChild(option);
        }
    }
}

// Remove marker when user disconnects
function removeMarker(userId) {
    if (markers[userId]) {
        map.removeLayer(markers[userId]);
        delete markers[userId];
    }
}

// Notify users when a bus driver shares their location
function notifyUsers(busNumber) {
    showNotification(`Bus ${busNumber} has shared its location!`);
    showSystemNotification(`Bus ${busNumber} has shared its location!`); // Show system notification
}

// Show notification in the notification area
function showNotification(message) {
    const notificationArea = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    // Add dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.textContent = 'Dismiss';
    dismissButton.onclick = function() {
        notificationArea.removeChild(notification);
    };
    notification.appendChild(dismissButton);
    
    notificationArea.appendChild(notification);
}

// Request notification permission
if (Notification.permission !== "granted") {
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            console.log("Notification permission granted.");
        } else {
            console.log("Notification permission denied.");
        }
    });
}

// Show system notification
function showSystemNotification(message) {
    if (Notification.permission === "granted") {
        new Notification(message);
    }
}

// Handle user type selection
document.getElementById('driverBtn').onclick = function () {
    userType = 'driver';
    document.getElementById('driverInput').style.display = 'block';
    document.getElementById('passengerInput').style.display = 'none';
};

document.getElementById('passengerBtn').onclick = function () {
    userType = 'passenger';
    document.getElementById('passengerInput').style.display = 'block';
    document.getElementById('driverInput').style.display = 'none';
};

// Share location as a driver
document.getElementById('shareLocationBtn').onclick = function () {
    busNumber = document.getElementById('busNumber').value.trim();
    if (!busNumber) {
        showNotification("Please enter a valid bus number.");
        return;
    }
    if (navigator.geolocation) {
        if (isLocating) return; // Prevent multiple requests
        isLocating = true; // Set flag
        showLoadingIndicator(true); // Show loading indicator
        navigator.geolocation.getCurrentPosition(function (position) {
            const data = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                busNumber: busNumber
            };
            socket.emit("send-location", data);
            socket.emit("location-shared", busNumber); // Notify all users
            isLocating = false; // Reset flag
            showLoadingIndicator(false); // Hide loading indicator

            // Start location update interval
            locationUpdateInterval = setInterval(() => {
                const updatedData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    busNumber: busNumber
                };
                socket.emit("send-location", updatedData);
            }, 2000); // Update every 2 seconds

            // Stop sharing location when button is pressed
            document.getElementById('stopSharingBtn').onclick = function () {
                clearInterval(locationUpdateInterval); // Stop the interval
                socket.emit("stop-location-sharing", busNumber); // Notify server to stop sharing
                isLocating = false; // Reset flag
                showNotification(`Stopped sharing location for bus ${busNumber}.`);
            };
        }, function (error) {
            console.error("Geolocation error:", error);
            showNotification("Unable to retrieve your location. Please check your device settings.");
            isLocating = false; // Reset flag
            showLoadingIndicator(false); // Hide loading indicator
        });
    } else {
        showNotification("Geolocation is not supported by this browser.");
        isLocating = false; // Reset flag
    }
};

// Track bus as a passenger
document.getElementById('trackBusBtn').onclick = function () {
    const selectedBus = document.getElementById('busSelect').value;
    if (selectedBus) {
        for (const id in markers) {
            if (markers[id].getPopup().getContent() === selectedBus) {
                map.setView(markers[id].getLatLng(), 16); // Center the map on the selected bus
                break;
            }
        }
    } else {
        showNotification("Please select a bus to track.");
    }
};

// Responsive design adjustments
window.addEventListener('resize', function() {
    map.invalidateSize(); // Adjust the map size on window resize
});

// Error handling for socket events
socket.on("connect_error", function () {
    showNotification("Connection to the server failed. Please try again later.");
});

socket.on("disconnect", function () {
    showNotification("Disconnected from the server. Attempting to reconnect...");
    setTimeout(() => {
        socket.connect();
    }, 5000); // Retry connection after 5 seconds
});
