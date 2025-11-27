# Bus-Tracking-app

A real-time bus tracking application for university students. Students can track buses by entering a bus number, view them on an interactive map, receive distance updates, and get notifications when drivers start sharing locations. Drivers confirm their bus number and share live location updates.

## Features
- **Student Tracking**: Enter bus number, track on map, real-time distance, proximity alerts.
- **Driver Sharing**: Confirm bus number, share location, notify students.
- **Smooth Bus Movement**: Animated markers for realistic tracking.
- **Notifications**: Alerts for sharing start, distance updates.
- **Real-Time**: Powered by Socket.IO for instant updates.

## Installation
1. Clone: `git clone https://github.com/Souvik65/Bus-Tracking-app.git`
2. Install: `npm install`
3. Add bus icon to `public/images/bus.png`.
4. Run: `npm start`
5. Open: `http://localhost:3000`

## Usage
- Select "Student" to track buses or "Driver" to share location.
- Enable geolocation in your browser.
- Test with multiple tabs (one driver, one student).

## Tech Stack
- Backend: Node.js, Express, Socket.IO
- Frontend: EJS, Leaflet, JavaScript
- Animation: MovingMarker

## License
ISC