// routes/liveLocation.js
import express from 'express';
import LiveLocationRequest from '../models/LiveLocationRequest.js';
import LiveLocationSession from '../models/LiveLocationSession.js';
import { auth } from '../Middleware/authMiddleware.js';

const router = express.Router();

// 1. Send Location Request
router.post('/request', auth, async (req, res) => {
  try {
    console.log('📍 Live Location Request Received');
    console.log('User:', req.user.email);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    const { recipientEmail, recipientId, recipientName, recipientPhone, myLocation, myAddress } = req.body;
    
    if (!recipientEmail || !myLocation) {
      console.error('❌ Validation failed: Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: recipientEmail and myLocation are required' 
      });
    }
    
    console.log('Creating new location request...');
    
    const newRequest = new LiveLocationRequest({
      senderId: req.user._id,
      senderName: req.user.fullName || req.user.name,
      senderEmail: req.user.email,
      recipientId,
      recipientEmail,
      recipientName,
      recipientPhone,
      senderLocation: myLocation,
      senderAddress: myAddress,
      status: 'pending',
    });
    
    console.log('Saving to database...');
    await newRequest.save();
    console.log('✅ Request saved successfully with ID:', newRequest._id);
    
    res.status(200).json({ 
      success: true, 
      message: 'Request sent successfully',
      requestId: newRequest._id 
    });
    
  } catch (error) {
    console.error('❌ ERROR in /request endpoint:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send request',
      error: error.message,
      details: error.name 
    });
  }
});

// 2. Get Pending Requests
router.get('/requests/pending', auth, async (req, res) => {
  try {
    console.log('📬 Fetching pending requests for:', req.user.email);
    
    const requests = await LiveLocationRequest.find({
      recipientEmail: req.user.email,
      status: 'pending'
    }).sort({ createdAt: -1 });
    
    console.log(`✅ Found ${requests.length} pending requests`);
    
    res.status(200).json({ 
      success: true,
      requests 
    });
  } catch (error) {
    console.error('❌ Error fetching requests:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch requests',
      error: error.message 
    });
  }
});

// 3. Accept Request
router.post('/request/:id/accept', auth, async (req, res) => {
  try {
    console.log('✅ Accepting request:', req.params.id);
    
    const { myLocation, myAddress } = req.body;
    
    const request = await LiveLocationRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ 
        success: false,
        message: 'Request not found' 
      });
    }
    
    request.status = 'accepted';
    await request.save();
    
    // Create session
    const session = new LiveLocationSession({
      user1Id: request.senderId,
      user1Email: request.senderEmail,
      user1Name: request.senderName,
      user2Id: req.user._id,
      user2Email: req.user.email,
      user2Name: req.user.fullName || req.user.name,
      status: 'active',
      user1Location: request.senderLocation,
      user1Address: request.senderAddress,
      user2Location: myLocation,
      user2Address: myAddress,
      lastUpdate: new Date()
    });
    
    await session.save();
    console.log('✅ Session created:', session._id);
    
    res.status(200).json({ 
      success: true, 
      sessionId: session._id 
    });
  } catch (error) {
    console.error('❌ Error accepting request:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to accept request',
      error: error.message 
    });
  }
});

// 4. Decline Request
router.post('/request/:id/decline', auth, async (req, res) => {
  try {
    await LiveLocationRequest.findByIdAndUpdate(req.params.id, {
      status: 'declined'
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error declining request:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to decline request' 
    });
  }
});

// 5. Update My Location (YE MISSING THA - BAHUT IMPORTANT!)
router.post('/update-location', auth, async (req, res) => {
  try {
    console.log('📍 Updating location for:', req.user.email);
    const { latitude, longitude, accuracy } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false,
        message: 'Latitude and longitude are required' 
      });
    }
    
    // Find all active sessions where this user is involved
    const sessions = await LiveLocationSession.find({
      $or: [
        { user1Email: req.user.email },
        { user2Email: req.user.email }
      ],
      status: 'active'
    });
    
    console.log(`Found ${sessions.length} active sessions to update`);
    
    // Update location in all sessions
    for (const session of sessions) {
      const isUser1 = session.user1Email === req.user.email;
      
      if (isUser1) {
        session.user1Location = {
          latitude,
          longitude,
          accuracy
          
          : accuracy || 0
        };
        console.log(`Updated user1 location in session ${session._id}`);
      } else {
        session.user2Location = {
          latitude,
          longitude,
          accuracy: accuracy || 0
        };
        console.log(`Updated user2 location in session ${session._id}`);
      }
      
      session.lastUpdate = new Date();
      await session.save();
    }
    
    res.status(200).json({ 
      success: true,
      message: 'Location updated successfully',
      sessionsUpdated: sessions.length
    });
  } catch (error) {
    console.error('❌ Error updating location:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update location',
      error: error.message 
    });
  }
});

// 6. Get Active Sessions
router.get('/sessions/active', auth, async (req, res) => {
  try {
    console.log('🔄 Fetching active sessions for:', req.user.email);
    
    const sessions = await LiveLocationSession.find({
      $or: [
        { user1Email: req.user.email },
        { user2Email: req.user.email }
      ],
      status: 'active'
    });
    
    console.log(`✅ Found ${sessions.length} active sessions`);
    
    const formattedSessions = sessions.map(session => {
      const isUser1 = session.user1Email === req.user.email;
      
      console.log('Formatting session:', {
        sessionId: session._id,
        currentUser: req.user.email,
        isUser1: isUser1,
        user1Loc: session.user1Location ? 'Present' : 'Missing',
        user2Loc: session.user2Location ? 'Present' : 'Missing'
      });
      
      return {
        _id: session._id,
        otherUserName: isUser1 ? session.user2Name : session.user1Name,
        otherUserEmail: isUser1 ? session.user2Email : session.user1Email,
        myLocation: isUser1 ? session.user1Location : session.user2Location,
        myAddress: isUser1 ? session.user1Address : session.user2Address,
        theirLocation: isUser1 ? session.user2Location : session.user1Location,
        theirAddress: isUser1 ? session.user2Address : session.user1Address,
        createdAt: session.createdAt,
        startTime: session.createdAt,
        lastUpdate: session.lastUpdate
      };
    });
    
    console.log('📤 Sending formatted sessions');
    
    res.status(200).json({ 
      success: true,
      sessions: formattedSessions 
    });
  } catch (error) {
    console.error('❌ Error fetching sessions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch sessions' 
    });
  }
});

// 7. Get Session Location
router.get('/session/:id/location', auth, async (req, res) => {
  try {
    console.log('📍 Fetching location for session:', req.params.id);
    console.log('Requested by:', req.user.email);
    
    const session = await LiveLocationSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }
    
    const isUser1 = session.user1Email === req.user.email;
    
    const response = {
      success: true,
      theirLocation: isUser1 ? session.user2Location : session.user1Location,
      theirAddress: isUser1 ? session.user2Address : session.user1Address,
      lastUpdate: session.lastUpdate
    };
    
    console.log('📤 Returning their location');
    
    res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error fetching location:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch location' 
    });
  }
});

// 8. End Session (YE BHI FIX KIYA)
router.post('/session/:id/end', auth, async (req, res) => {
  try {
    console.log('⏹️ Ending session:', req.params.id);
    
    const session = await LiveLocationSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }
    
    // Verify user is part of this session
    if (session.user1Email !== req.user.email && session.user2Email !== req.user.email) {
      return res.status(403).json({ 
        success: false,
        message: 'You are not authorized to end this session' 
      });
    }
    
    // Update session status
    session.status = 'ended';
    session.endTime = new Date();
    await session.save();
    
    console.log('✅ Session ended successfully');
    
    res.status(200).json({ 
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to end session',
      error: error.message 
    });
  }
});

export default router;


