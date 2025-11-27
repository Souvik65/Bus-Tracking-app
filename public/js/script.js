const socket = io();
let map;
let markers = {};
let userType = '';
let busNumber = '';
let isLocating = false;
let locationUpdateInterval = null;
let trackedBus = null;
let userLocation = null;

if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

window.onload = function () {
    initMap();
    socket.on("initial-locations", updateMarkers);
    socket.on("receive-location", updateMarkers);
    socket.on("user-disconnected", removeMarker);
    socket.on("location-shared", notifyUsers);
    socket.on("bus-stopped", removeBusFromDropdown);
};

function initMap() {
    const defaultLocation = [23.829195, 91.278194];
    map = L.map('myMap').setView(defaultLocation, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const locateMeBtn = L.control({ position: 'topright' });
    locateMeBtn.onAdd = function () {
        const button = L.DomUtil.create('button', 'locate-me-btn');
        button.innerHTML = 'Locate Me';
        button.onclick = debounce(locateUser, 300);
        return button;
    };
    locateMeBtn.addTo(map);
}

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

function locateUser() {
    if (isLocating) return;
    isLocating = true;
    if (navigator.geolocation) {
        showLoadingIndicator(true);
        navigator.geolocation.getCurrentPosition(function (position) {
            userLocation = [position.coords.latitude, position.coords.longitude];
            map.setView(userLocation, 16);
            L.marker(userLocation).addTo(map).bindPopup('You are here!').openPopup();
            let nearestDistance = Infinity;
            for (const id in markers) {
                const markerLocation = markers[id].getLatLng();
                const distance = map.distance(userLocation, markerLocation) / 1000;
                if (distance < nearestDistance) nearestDistance = distance;
            }
            showNotification(`Nearest bus: ${nearestDistance.toFixed(2)} km away.`);
            isLocating = false;
            showLoadingIndicator(false);
        }, function (error) {
            console.error("Geolocation error:", error);
            showNotification("Unable to retrieve location.");
            isLocating = false;
            showLoadingIndicator(false);
        });
    } else {
        showNotification("Geolocation not supported.");
        isLocating = false;
    }
}

function showLoadingIndicator(isLoading) {
    document.getElementById('loadingIndicator').style.display = isLoading ? 'block' : 'none';
}

const busIcon = L.icon({
    iconUrl: '/images/bus.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
});

function addMarker(id, lat, lng, busNumber) {
    if (markers[id]) {
        const currentPos = markers[id].getLatLng();
        markers[id].moveTo([lat, lng], 2000);  // Smooth animation
        markers[id].getPopup().setContent(busNumber).update();
    } else {
        markers[id] = new MovingMarker([lat, lng], { icon: busIcon }).addTo(map).bindPopup(busNumber).openPopup();
    }
}

function updateMarkers(locations) {
    const busSelect = document.getElementById('busSelect');
    busSelect.innerHTML = '<option value="">Select a Bus</option>';
    for (const id in locations) {
        const { latitude, longitude, busNumber } = locations[id];
        addMarker(id, latitude, longitude, busNumber);
        if (!Array.from(busSelect.options).some(option => option.value === busNumber)) {
            const option = document.createElement('option');
            option.value = busNumber;
            option.textContent = busNumber;
            busSelect.appendChild(option);
        }
    }
}

function removeMarker(userId) {
    if (markers[userId]) {
        map.removeLayer(markers[userId]);
        delete markers[userId];
    }
}

function removeBusFromDropdown(busNumber) {
    const busSelect = document.getElementById('busSelect');
    const options = busSelect.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === busNumber) {
            busSelect.remove(i);
            break;
        }
    }
}

function notifyUsers(busNumber) {
    showNotification(`Bus ${busNumber} is now sharing location!`);
    showSystemNotification(`Bus ${busNumber} shared!`);
}

function showNotification(message) {
    const notificationArea = document.getElementById('notificationArea');
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    const dismissButton = document.createElement('button');
    dismissButton.textContent = 'Dismiss';
    dismissButton.onclick = () => notificationArea.removeChild(notification);
    notification.appendChild(dismissButton);
    notificationArea.appendChild(notification);
}

function showSystemNotification(message) {
    if (Notification.permission === "granted") new Notification(message);
}

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

document.getElementById('shareLocationBtn').onclick = function () {
    busNumber = document.getElementById('busNumber').value.trim();
    if (!busNumber) {
        showNotification("Enter bus number.");
        return;
    }
    if (navigator.geolocation) {
        isLocating = true;
        showLoadingIndicator(true);
        navigator.geolocation.getCurrentPosition(function (position) {
            const data = { latitude: position.coords.latitude, longitude: position.coords.longitude, busNumber };
            socket.emit("send-location", data);
            socket.emit("location-shared", busNumber);
            isLocating = false;
            showLoadingIndicator(false);
            locationUpdateInterval = setInterval(() => {
                navigator.geolocation.getCurrentPosition((newPos) => {
                    const updatedData = { latitude: newPos.coords.latitude, longitude: newPos.coords.longitude, busNumber };
                    socket.emit("send-location", updatedData);
                });
            }, 2000);
            document.getElementById('stopSharingBtn').onclick = function () {
                clearInterval(locationUpdateInterval);
                socket.emit("stop-location-sharing", busNumber);
                showNotification(`Stopped sharing for bus ${busNumber}.`);
            };
        }, function (error) {
            console.error("Error:", error);
            showNotification("Location error.");
            isLocating = false;
            showLoadingIndicator(false);
        });
    }
};

document.getElementById('trackBusBtn').onclick = function () {
    const selectedBus = document.getElementById('busSelect').value;
    if (selectedBus) {
        trackedBus = selectedBus;
        showNotification(`Tracking bus ${selectedBus}.`);
        setInterval(() => {
            if (trackedBus && userLocation) {
                for (const id in markers) {
                    if (markers[id].getPopup().getContent() === trackedBus) {
                        const busLoc = markers[id].getLatLng();
                        const distance = map.distance(userLocation, busLoc) / 1000;
                        showNotification(`${trackedBus}: ${distance.toFixed(2)} km away.`);
                        if (distance < 1) showNotification(`${trackedBus} is arriving!`);
                    }
                }
            }
        }, 5000);
    } else {
        showNotification("Select a bus.");
    }
};

window.addEventListener('resize', () => map.invalidateSize());