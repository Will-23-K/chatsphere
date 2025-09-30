const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://your-production-domain.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatSphere';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: String,
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  isDefault: { type: Boolean, default: false },
  createdBy: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  text: { type: String },
  username: { type: String, required: true },
  room: { type: String, required: true },
  messageType: { 
    type: String, 
    enum: ['message', 'system', 'join', 'leave', 'file', 'image'], 
    default: 'message' 
  },
  file: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    thumbnailUrl: String
  },
  emojis: [{
    emoji: String,
    users: [String],
    count: Number
  }],
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

const userRoomJoinSchema = new mongoose.Schema({
  username: { type: String, required: true },
  room: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now }
});

// MongoDB Models
const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Message = mongoose.model('Message', messageSchema);
const UserRoomJoin = mongoose.model('UserRoomJoin', userRoomJoinSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'chatsphere-secret-key-change-in-production';
const userSockets = new Map();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and common file types
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and text files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  }
});

// Initialize default rooms
const initializeDefaultRooms = async () => {
  const defaultRooms = [
    { name: 'general', description: 'General discussions' },
    { name: 'random', description: 'Random talks and fun' },
    { name: 'coding', description: 'Programming and tech talk' },
    { name: 'gaming', description: 'Video games and entertainment' }
  ];
  
  for (const roomData of defaultRooms) {
    const existingRoom = await Room.findOne({ name: roomData.name });
    if (!existingRoom) {
      await Room.create({
        name: roomData.name,
        description: roomData.description,
        isDefault: true,
        createdBy: 'system'
      });
      console.log(`✅ Created default room: ${roomData.name}`);
    }
  }
};

// Socket.io Authentication Middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    console.log('✅ Socket authenticated for user:', decoded.username);
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
};

io.use(authenticateSocket);

// Room Management Functions
const joinRoom = async (socket, roomName) => {
  let room = await Room.findOne({ name: roomName });
  if (!room) {
    room = await Room.create({
      name: roomName,
      isDefault: false,
      createdBy: socket.user.username
    });
    
    io.emit('room_created', {
      name: room.name,
      createdBy: room.createdBy,
      userCount: 1,
      isDefault: room.isDefault,
      description: room.description
    });
  }

  // Record user join time for WhatsApp-style history
  await UserRoomJoin.findOneAndUpdate(
    { username: socket.user.username, room: roomName },
    { joinedAt: new Date() },
    { upsert: true, new: true }
  );

  // Leave all other rooms
  Array.from(socket.rooms).forEach(room => {
    if (room !== socket.id && room !== roomName) {
      socket.leave(room);
    }
  });

  // Join the room
  socket.join(roomName);
  userSockets.set(socket.user.username, socket.id);

  console.log(`✅ ${socket.user.username} joined room: ${roomName}`);
  
  // Get messages only from AFTER user joined (WhatsApp-style)
  const userJoinRecord = await UserRoomJoin.findOne({ 
    username: socket.user.username, 
    room: roomName 
  });
  
  const messages = await Message.find({
    room: roomName,
    createdAt: { $gte: userJoinRecord.joinedAt },
    isDeleted: false
  }).sort({ createdAt: 1 }).limit(100);

  // Get online users
  const onlineUsers = Array.from(userSockets.keys()).filter(username => {
    const userSocket = io.sockets.sockets.get(userSockets.get(username));
    return userSocket && userSocket.rooms.has(roomName);
  });

  // Notify room that user joined
  const joinMessage = {
    id: new mongoose.Types.ObjectId().toString(),
    text: `${socket.user.username} joined the room`,
    username: 'system',
    room: roomName,
    messageType: 'join',
    timestamp: new Date().toISOString()
  };

  // Save join message
  await Message.create(joinMessage);

  // Broadcast to room
  socket.to(roomName).emit('receive_message', joinMessage);
  socket.to(roomName).emit('user_joined_room', {
    username: socket.user.username,
    roomName: roomName,
    onlineUsers: onlineUsers,
    timestamp: new Date().toISOString()
  });

  return { room, messages, onlineUsers };
};

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({ success: false, error: 'File upload failed' });
  }
});

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.user.username);
  
  // Update user's last seen
  User.findOneAndUpdate(
    { username: socket.user.username },
    { lastSeen: new Date() }
  ).exec();
  
  joinRoom(socket, 'general').then(({ room, messages, onlineUsers }) => {
    Room.find().then(rooms => {
      socket.emit('initial_data', {
        user: { username: socket.user.username },
        rooms: rooms.map(room => ({
          name: room.name,
          userCount: onlineUsers.length,
          isDefault: room.isDefault,
          createdBy: room.createdBy,
          description: room.description
        })),
        currentRoom: 'general',
        messages: messages,
        onlineUsers: onlineUsers
      });
    });
  });

  // Handle room creation
  socket.on('create_room', async (roomData, callback) => {
    try {
      const { name, description } = roomData;
      
      if (!name || name.trim().length < 2) {
        return callback({ success: false, error: 'Room name must be at least 2 characters long' });
      }
      
      const normalizedRoomName = name.trim().toLowerCase();
      const existingRoom = await Room.findOne({ name: normalizedRoomName });
      if (existingRoom) {
        return callback({ success: false, error: 'Room already exists' });
      }
      
      const { room, messages, onlineUsers } = await joinRoom(socket, normalizedRoomName);
      
      // Update room description if provided
      if (description) {
        room.description = description;
        await room.save();
      }
      
      callback({ 
        success: true, 
        room: {
          name: room.name,
          userCount: onlineUsers.length,
          isDefault: room.isDefault,
          createdBy: room.createdBy,
          description: room.description
        },
        message: `Room "${normalizedRoomName}" created successfully!`
      });
      
    } catch (error) {
      console.error('❌ Room creation error:', error);
      callback({ success: false, error: 'Failed to create room' });
    }
  });

  // Handle room joining
  socket.on('join_room', async (roomName, callback) => {
    try {
      const room = await Room.findOne({ name: roomName });
      if (!room) {
        return callback({ success: false, error: 'Room does not exist' });
      }
      
      const { messages, onlineUsers } = await joinRoom(socket, roomName);
      
      socket.emit('room_joined', {
        roomName: room.name,
        messages: messages,
        onlineUsers: onlineUsers
      });
      
      callback({ 
        success: true,
        room: {
          name: room.name,
          userCount: onlineUsers.length,
          isDefault: room.isDefault,
          description: room.description
        },
        message: `Joined room "${roomName}"!`
      });
      
    } catch (error) {
      console.error('❌ Room join error:', error);
      callback({ success: false, error: 'Failed to join room' });
    }
  });

  // Handle messages
  socket.on('send_message', async (data, callback) => {
    try {
      const { text, roomName, file } = data;
      
      if (!text && !file) {
        return callback({ success: false, error: 'Message cannot be empty' });
      }
      
      const room = await Room.findOne({ name: roomName });
      if (!room) {
        return callback({ success: false, error: 'Room does not exist' });
      }
      
      // Determine message type
      let messageType = 'message';
      if (file) {
        messageType = file.mimetype.startsWith('image/') ? 'image' : 'file';
      }

      // Create and save message to database
      const messageData = {
        text: text?.trim(),
        username: socket.user.username,
        room: roomName,
        messageType: messageType,
        createdAt: new Date()
      };

      if (file) {
        messageData.file = file;
      }

      const message = await Message.create(messageData);

      const populatedMessage = {
        id: message._id.toString(),
        text: message.text,
        username: message.username,
        room: message.room,
        messageType: message.messageType,
        file: message.file,
        timestamp: message.createdAt.toISOString(),
        isDeleted: message.isDeleted,
        emojis: message.emojis
      };

      // Broadcast to room
      io.to(roomName).emit('receive_message', populatedMessage);
      
      // Send browser notifications to other users in the room
      socket.to(roomName).emit('new_message_notification', {
        username: socket.user.username,
        roomName: roomName,
        message: text || (file ? `Sent a ${messageType}` : 'Sent a message'),
        timestamp: new Date().toISOString()
      });
      
      console.log(`💬 Message in ${roomName} from ${socket.user.username}: ${text || `[${messageType}]`}`);
      
      callback({ 
        success: true,
        messageId: message._id.toString(),
        message: 'Message sent successfully'
      });
      
    } catch (error) {
      console.error('❌ Message send error:', error);
      callback({ success: false, error: 'Failed to send message' });
    }
  });

  // Handle message deletion
  socket.on('delete_message', async (data, callback) => {
    try {
      const { messageId, roomName } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return callback({ success: false, error: 'Message not found' });
      }
      
      if (message.username !== socket.user.username) {
        return callback({ success: false, error: 'You can only delete your own messages' });
      }
      
      // Soft delete
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();
      
      io.to(roomName).emit('message_deleted', {
        messageId: messageId,
        deletedBy: socket.user.username,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🗑️ Message deleted by ${socket.user.username}: ${messageId}`);
      
      callback({ success: true, message: 'Message deleted successfully' });
      
    } catch (error) {
      console.error('❌ Message deletion error:', error);
      callback({ success: false, error: 'Failed to delete message' });
    }
  });

  // Handle emoji reactions
  socket.on('add_emoji_reaction', async (data, callback) => {
    try {
      const { messageId, emoji, roomName } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return callback({ success: false, error: 'Message not found' });
      }
      
      if (!message.emojis) message.emojis = [];
      
      let emojiReaction = message.emojis.find(e => e.emoji === emoji);
      
      if (emojiReaction) {
        if (!emojiReaction.users.includes(socket.user.username)) {
          emojiReaction.users.push(socket.user.username);
          emojiReaction.count += 1;
        }
      } else {
        emojiReaction = {
          emoji: emoji,
          users: [socket.user.username],
          count: 1
        };
        message.emojis.push(emojiReaction);
      }
      
      await message.save();
      
      io.to(roomName).emit('message_updated', {
        messageId: messageId,
        emojis: message.emojis
      });
      
      callback({ success: true, message: 'Emoji reaction added' });
      
    } catch (error) {
      console.error('❌ Emoji reaction error:', error);
      callback({ success: false, error: 'Failed to add emoji reaction' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (roomName) => {
    socket.to(roomName).emit('user_typing', {
      username: socket.user.username,
      isTyping: true,
      roomName: roomName
    });
  });

  socket.on('typing_stop', (roomName) => {
    socket.to(roomName).emit('user_typing', {
      username: socket.user.username,
      isTyping: false,
      roomName: roomName
    });
  });

  // Handle room list request
  socket.on('get_rooms', async (callback) => {
    try {
      const rooms = await Room.find();
      const roomList = await Promise.all(rooms.map(async (room) => {
        const onlineUsers = Array.from(userSockets.keys()).filter(username => {
          const userSocket = io.sockets.sockets.get(userSockets.get(username));
          return userSocket && userSocket.rooms.has(room.name);
        });
        
        return {
          name: room.name,
          userCount: onlineUsers.length,
          isDefault: room.isDefault,
          createdBy: room.createdBy,
          description: room.description
        };
      }));
      
      callback(roomList);
    } catch (error) {
      console.error('❌ Get rooms error:', error);
      callback([]);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async (reason) => {
    console.log('❌ User disconnected:', socket.user.username, 'Reason:', reason);
    
    // Update user's last seen
    await User.findOneAndUpdate(
      { username: socket.user.username },
      { lastSeen: new Date() }
    );
    
    const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
    
    for (const roomName of rooms) {
      const onlineUsers = Array.from(userSockets.keys()).filter(username => {
        const userSocket = io.sockets.sockets.get(userSockets.get(username));
        return userSocket && userSocket.rooms.has(roomName) && username !== socket.user.username;
      });
      
      const leaveMessage = {
        id: new mongoose.Types.ObjectId().toString(),
        text: `${socket.user.username} left the room`,
        username: 'system',
        room: roomName,
        messageType: 'leave',
        timestamp: new Date().toISOString()
      };
      
      await Message.create(leaveMessage);
      
      socket.to(roomName).emit('receive_message', leaveMessage);
      socket.to(roomName).emit('user_left_room', {
        username: socket.user.username,
        roomName: roomName,
        onlineUsers: onlineUsers,
        timestamp: new Date().toISOString(),
        reason: 'disconnected'
      });
    }
    
    userSockets.delete(socket.user.username);
  });
});

// Authentication Routes
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ username, password: hashedPassword });
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, token, username, message: 'Registration successful!' });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ success: false, error: 'Invalid username or password' });
    }
    
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, token, username, message: 'Login successful!' });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/health', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const roomCount = await Room.countDocuments();
    const messageCount = await Message.countDocuments();
    
    res.json({ 
      status: 'Server is running!', 
      users: userCount,
      rooms: roomCount,
      messages: messageCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ 
      status: 'Server is running!', 
      error: 'Database connection issue',
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize and start server
const startServer = async () => {
  try {
    await initializeDefaultRooms();
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Production Chat Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📁 File uploads: http://localhost:${PORT}/uploads/`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
