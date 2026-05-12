const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();

/* MONGODB CONNECTION */

mongoose.connect(
  'mongodb://ChatAdmin:Haikyuu%4010@ac-6xq8ycf-shard-00-00.xvbsxt9.mongodb.net:27017,ac-6xq8ycf-shard-00-01.xvbsxt9.mongodb.net:27017,ac-6xq8ycf-shard-00-02.xvbsxt9.mongodb.net:27017/chatapp?ssl=true&replicaSet=atlas-rl9wfi-shard-0&authSource=admin&appName=Cluster0'
)
.then(() => console.log('MongoDB Connected'))
.catch((err) => console.log(err));

/* MIDDLEWARE */

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

const server = http.createServer(app);

/* SOCKET.IO */

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

/* USERS */

let users = [];

/* FILE UPLOAD */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + path.extname(file.originalname)
    );
  }
});

const upload = multer({ storage });

/* FILE API */

app.post(
  '/upload',
  upload.single('file'),
  (req, res) => {

    res.json({
      fileUrl:
        `http://localhost:5000/uploads/${req.file.filename}`
    });
  }
);

/* SIGNUP API */

app.post('/signup', async (req, res) => {

  const { username, password } = req.body;

  const existingUser =
    await User.findOne({ username });

  if (existingUser) {

    return res.json({
      message: 'User already exists'
    });
  }

  const hashedPassword =
    await bcrypt.hash(password, 10);

  const user = new User({
    username,
    password: hashedPassword
  });

  await user.save();

  res.json({
    message: 'Signup Successful'
  });
});

/* LOGIN API */

app.post('/login', async (req, res) => {

  const { username, password } = req.body;

  const user =
    await User.findOne({ username });

  if (!user) {

    return res.json({
      message: 'User not found'
    });
  }

  const validPassword =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!validPassword) {

    return res.json({
      message: 'Wrong password'
    });
  }

  const token = jwt.sign(
    { id: user._id },
    'SECRET_KEY'
  );

  res.json({
    token,
    username
  });
});

/* GET CHAT HISTORY */

app.get('/messages', async (req, res) => {

  const messages =
    await Message.find();

  res.json(messages);
});

/* SOCKET CONNECTION */

io.on('connection', (socket) => {

  console.log(
    'User Connected:',
    socket.id
  );

  /* USER JOIN */

  socket.on('join', (username) => {

    const existingUser = users.find(
      (u) => u.username === username
    );

    if (!existingUser) {

      users.push({
        id: socket.id,
        username
      });
    }

    io.emit('onlineUsers', users);
  });

  /* NORMAL MESSAGE */

  socket.on(
    'sendMessage',
    async (data) => {

      const newMessage =
        new Message(data);

      await newMessage.save();

      io.emit(
        'receiveMessage',
        data
      );
    }
  );

  /* PRIVATE MESSAGE */

  socket.on(
    'privateMessage',
    ({ receiverId, data }) => {

      io.to(receiverId).emit(
        'receivePrivateMessage',
        data
      );
    }
  );

  /* TYPING */

  socket.on(
    'typing',
    (username) => {

      socket.broadcast.emit(
        'typing',
        username
      );
    }
  );

  /* CREATE GROUP */

  socket.on(
    'createGroup',
    ({ room, username }) => {

      socket.join(room);

      io.to(room).emit(
        'receiveMessage',
        {
          user: 'System',
          message:
            `${username} joined ${room}`,
          time:
            new Date().toLocaleTimeString()
        }
      );
    }
  );

  /* GROUP MESSAGE */

  socket.on(
    'groupMessage',
    ({ room, data }) => {

      io.to(room).emit(
        'receiveMessage',
        data
      );
    }
  );

  /* DISCONNECT */

  socket.on('disconnect', () => {

    users =
      users.filter(
        (u) => u.id !== socket.id
      );

    io.emit(
      'onlineUsers',
      users
    );

    console.log(
      'User Disconnected'
    );
  });
});

/* START SERVER */

server.listen(5000, () => {

  console.log(
    'Server running on port 5000'
  );
});