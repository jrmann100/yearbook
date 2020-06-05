var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 1120;

const { createCanvas, loadImage } = require('canvas');

const fs = require('fs')

function save(roomID){
    if (rooms[roomID] !== null){
      const out = fs.createWriteStream(__dirname + '/' + roomID + '.png')
      const stream = rooms[roomID][0].createPNGStream()
      stream.pipe(out)
      out.on('finish', () =>  console.log('save complete.'))
    }
}

let strokeColor = "black";
// Guidance from https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
function stroke(ctx, lX, lY, x, y) {
  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.moveTo(lX, lY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.closePath();
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let rooms = {'r0': null, 'r1': null, 'r2': null};

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('room', (id)=>{
      if (rooms.hasOwnProperty(id)){
        socket.join(id);
        socket.roomID = id;
        if (rooms[socket.roomID] === null){
          // Create a new canvas for this room.
          let newRoomCanvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
          rooms[socket.roomID] = [newRoomCanvas, newRoomCanvas.getContext('2d')];
          loadImage(socket.roomID + '.png').then((image) => {
              rooms[socket.roomID][1].drawImage(image, 0, 0);
          });
        }
        socket.emit('room', "Changed to " + socket.roomID);
        rooms[socket.roomID][0].toBuffer(function(err, buf){
          if (err) throw err;
          socket.emit('image', buf);
        });
      } else {
        socket.emit('room', "Room does not exist.");
      }
    })

    socket.on('disconnect', () => {
        console.log('user disconnected.');
        save(socket.roomID);
    });

    socket.on('stroke', (lX, lY, x, y) => {
        stroke(rooms[socket.roomID][1], lX ,lY, x, y);
        io.sockets.in(socket.roomID).emit('stroke', lX, lY, x, y);
    })
});

// Need to iterate over live rooms.
// setInterval(()=>{save(canvas);}, 60000);

// process.on("SIGINT", async (code)=>{
//   console.log("Goodbye! Give me a moment to save though.");
//   Object.keys(rooms).forEach((roomID)=>{save(roomID)});
//   http.close();
//   process.exit(0);
// })
// This doesn't work anyways.

http.listen(80, () => {
    console.log('listening on *:80');
});
