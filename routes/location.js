import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import TrackingSession from '../models/TrackingSession.js';

const router = express.Router();

// ✅ Start Live Tracking
router.post('/start-tracking', async (req, res) => {
  try {
    const { userId, userName, userPhone, userEmail, duration } = req.body;

    console.log('📥 Received tracking request:', { userId, userName, userPhone, userEmail, duration });

    if (!userId || !userName || !userPhone || !userEmail) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: userId, userName, userPhone, userEmail' 
      });
    }

    // Generate unique session ID
    const sessionId = uuidv4();

    // Create tracking session
    const trackingSession = new TrackingSession({
      sessionId,
      userId,
      userName,
      userPhone,
      userEmail,
      currentLocation: { lat: 0, lng: 0 }, // Will be updated immediately by frontend
      duration: duration || -1, // -1 means unlimited
      isActive: true
    });

    await trackingSession.save();

    // Generate tracking URL - IMPORTANT: Use your actual IP or domain
    const trackingUrl = `http://192.168.43.216:5000/api/location/track/${sessionId}`;

    console.log('✅ Live tracking session created:', sessionId);
    console.log('📍 Tracking URL:', trackingUrl);

    res.json({
      success: true,
      sessionId,
      trackingUrl,
      message: 'Live tracking started successfully'
    });

  } catch (error) {
    console.error('❌ Start tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start tracking: ' + error.message 
    });
  }
});

// ✅ Update Location
router.post('/update', async (req, res) => {
  try {
    const { sessionId, lat, lng, address } = req.body;

    if (!sessionId || lat === undefined || lng === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: sessionId, lat, lng' 
      });
    }

    const trackingSession = await TrackingSession.findOne({ sessionId });

    if (!trackingSession) {
      console.warn('⚠️ Tracking session not found:', sessionId);
      return res.status(404).json({ 
        success: false, 
        message: 'Tracking session not found' 
      });
    }

    // Check if session expired
    if (trackingSession.checkExpiry()) {
      await trackingSession.save();
      return res.status(410).json({ 
        success: false, 
        message: 'Tracking session expired' 
      });
    }

    // Update location
    trackingSession.currentLocation = { lat, lng };
    trackingSession.currentAddress = address || trackingSession.currentAddress;
    trackingSession.lastUpdate = new Date();

    await trackingSession.save();

    console.log('📍 Location updated:', sessionId, `(${lat}, ${lng})`);

    res.json({
      success: true,
      message: 'Location updated successfully'
    });

  } catch (error) {
    console.error('❌ Update location error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update location: ' + error.message 
    });
  }
});

// ✅ Stop Tracking
router.post('/stop-tracking', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session ID required' 
      });
    }

    const trackingSession = await TrackingSession.findOne({ sessionId });

    if (!trackingSession) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tracking session not found' 
      });
    }

    trackingSession.isActive = false;
    trackingSession.endTime = new Date();

    await trackingSession.save();

    console.log('🛑 Tracking stopped:', sessionId);

    res.json({
      success: true,
      message: 'Tracking stopped successfully'
    });

  } catch (error) {
    console.error('❌ Stop tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to stop tracking: ' + error.message 
    });
  }
});

// ✅ Get Current Location (API for live tracking page)
router.get('/get-location/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const trackingSession = await TrackingSession.findOne({ sessionId });

    if (!trackingSession) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }

    // Check if session expired
    if (trackingSession.checkExpiry()) {
      await trackingSession.save();
      return res.status(410).json({ 
        success: false, 
        message: 'Session expired' 
      });
    }

    if (!trackingSession.isActive) {
      return res.status(410).json({ 
        success: false, 
        message: 'Session ended' 
      });
    }

    res.json({
      success: true,
      location: {
        lat: trackingSession.currentLocation.lat,
        lng: trackingSession.currentLocation.lng,
        address: trackingSession.currentAddress
      },
      userName: trackingSession.userName,
      userPhone: trackingSession.userPhone,
      userEmail: trackingSession.userEmail,
      lastUpdate: trackingSession.lastUpdate
    });

  } catch (error) {
    console.error('❌ Get location error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching location: ' + error.message 
    });
  }
});

// ✅ Live Tracking Page (HTML)
// ✅ Live Tracking Page (HTML) - UPDATED
router.get('/track/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log('🌐 Tracking page requested for session:', sessionId);
    
    const trackingSession = await TrackingSession.findOne({ sessionId });
    
    if (!trackingSession) {
      console.warn('⚠️ Session not found:', sessionId);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Session Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .error-box {
              background: white;
              padding: 40px;
              border-radius: 20px;
              text-align: center;
              box-shadow: 0 10px 40px rgba(0,0,0,0.3);
              max-width: 400px;
            }
            h1 { color: #EA4335; font-size: 48px; margin: 0; }
            h2 { color: #202124; margin-top: 20px; }
            p { color: #5f6368; font-size: 16px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="error-box">
            <h1>❌</h1>
            <h2>Tracking Session Not Found</h2>
            <p>This link may have expired or is invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    console.log('✅ Serving tracking page for:', trackingSession.userName);

    // Serve live tracking HTML page
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>🛡️ Live Location - ${trackingSession.userName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    #header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    #header h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .live-indicator {
      display: inline-flex;
      align-items: center;
      background: rgba(52, 168, 83, 0.9);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      margin-top: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .live-dot {
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.8); }
    }
    #info {
      padding: 15px;
      background: #f8f9fa;
      border-bottom: 2px solid #e0e0e0;
    }
    #info p {
      margin: 8px 0;
      font-size: 14px;
      color: #202124;
    }
    #info strong {
      color: #5f6368;
      font-weight: 600;
    }
    #map { 
      height: calc(100vh - 265px);
      width: 100%;
      background: #f5f5f5;
    }
    .status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #202124;
      color: white;
      padding: 12px;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.3s;
    }
    .status-online {
      background: #34A853;
    }
    .status-offline {
      background: #EA4335;
    }
    .leaflet-container {
      background: #f5f5f5;
    }
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 1000;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="header">
    <h1>🛡️ SheSafe Live Tracking</h1>
    <p style="font-size: 18px; font-weight: 600;">${trackingSession.userName}</p>
    <div class="live-indicator">
      <span class="live-dot"></span>
      LIVE TRACKING ACTIVE
    </div>
  </div>
  
  <div id="info">
    <p><strong>📞 Phone:</strong> ${trackingSession.userPhone}</p>
    <p><strong>📧 Email:</strong> ${trackingSession.userEmail}</p>
    <p><strong>⏰ Last Updated:</strong> <span id="lastUpdate">Loading...</span></p>
    <p><strong>📍 Address:</strong> <span id="address">Fetching location...</span></p>
  </div>
  
  <div id="map">
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p style="color: #667eea; font-weight: 600;">Loading map...</p>
    </div>
  </div>
  
  <div id="status" class="status-bar status-online">
    🟢 Connected - Auto-updating every 5 seconds
  </div>

  <script>
    const sessionId = '${sessionId}';
    let map, marker;
    let isOnline = true;
    let updateCount = 0;
    let mapInitialized = false;

    // Initialize map
    function initMap(lat, lng) {
      console.log('🗺️ Initializing map at:', lat, lng);
      
      // Remove loading spinner
      const loading = document.getElementById('loading');
      if (loading) {
        loading.remove();
      }
      
      map = L.map('map').setView([lat, lng], 16);
      
      L.tileLayer('https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(map);

      const pulsingIcon = L.divIcon({
        className: 'pulsing-marker',
        html: \`
          <div style="position: relative; width: 40px; height: 40px;">
            <div style="
              position: absolute;
              width: 40px;
              height: 40px;
              background: rgba(234, 67, 53, 0.3);
              border-radius: 50%;
              animation: pulse-marker 2s ease-out infinite;
            "></div>
            <div style="
              position: absolute;
              width: 16px;
              height: 16px;
              background: #EA4335;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              top: 12px;
              left: 12px;
            "></div>
          </div>
          <style>
            @keyframes pulse-marker {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(2.5); opacity: 0; }
            }
          </style>
        \`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      marker = L.marker([lat, lng], { icon: pulsingIcon }).addTo(map);
      marker.bindPopup('<b>${trackingSession.userName}</b><br>📍 Live Location').openPopup();
      
      mapInitialized = true;
      
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }

    // Update location from server
    async function updateLocation() {
      try {
        console.log('📡 Fetching location update #' + (++updateCount));
        
        const response = await fetch('/api/location/get-location/' + sessionId);
        const data = await response.json();

        console.log('📥 Response:', data);

        if (data.success && data.location) {
          const { lat, lng, address } = data.location;
          
          // Check if we have valid coordinates
          if (lat === 0 && lng === 0) {
            console.warn('⚠️ Waiting for first location update from device...');
            document.getElementById('address').textContent = 'Waiting for location from device...';
            document.getElementById('lastUpdate').textContent = 'Connecting...';
            return;
          }
          
          // Initialize map if not done yet
          if (!mapInitialized) {
            initMap(lat, lng);
          } else {
            // Update existing marker
            marker.setLatLng([lat, lng]);
            map.panTo([lat, lng]);
          }

          // Update UI
          const now = new Date();
          document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          
          document.getElementById('address').textContent = address || 'Fetching address...';
          
          if (!isOnline) {
            isOnline = true;
            updateStatus(true);
          }
        } else {
          console.warn('⚠️ Location data not available:', data.message);
          document.getElementById('address').textContent = 'Location not available';
        }
      } catch (error) {
        console.error('❌ Error updating location:', error);
        document.getElementById('address').textContent = 'Connection error';
        if (isOnline) {
          isOnline = false;
          updateStatus(false);
        }
      }
    }

    function updateStatus(online) {
      const statusBar = document.getElementById('status');
      if (online) {
        statusBar.className = 'status-bar status-online';
        statusBar.textContent = '🟢 Connected - Auto-updating every 5 seconds';
      } else {
        statusBar.className = 'status-bar status-offline';
        statusBar.textContent = '🔴 Connection Lost - Retrying...';
      }
    }

    // Initial load
    console.log('🚀 Starting live tracking for session:', sessionId);
    updateLocation();
    
    // Auto-refresh every 5 seconds
    setInterval(updateLocation, 5000);
  </script>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error('❌ Tracking page error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>❌ Error Loading Tracking Page</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
});

export default router;
