// routes/LiveLocation.js
// ⚠️ This file is DEPRECATED - All functionality moved to location.js
// Keep this only if you need backward compatibility

import express from 'express';
const router = express.Router();

// Redirect old endpoints to new ones
router.all('*', (req, res) => {
  console.warn('⚠️ DEPRECATED: LiveLocation.js routes are deprecated. Use /api/location instead');
  res.status(301).json({
    success: false,
    message: 'This endpoint has moved. Please use /api/location endpoints instead.',
    newEndpoints: {
      startTracking: '/api/location/start-tracking',
      updateLocation: '/api/location/update',
      getLocation: '/api/location/get-location/:sessionId',
      stopTracking: '/api/location/stop-tracking',
      trackingPage: '/api/location/track/:sessionId'
    }
  });
});

export default router;