var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);

const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 1120;
const SAVE_ROOM_INTERVAL = 30000;

const { createCanvas, loadImage } = require("canvas");

const fs = require("fs")

function save(roomID){
    if (rooms[roomID]){
      const out = fs.createWriteStream(__dirname + "/" + roomID + ".png")
      const stream = rooms[roomID][0].createPNGStream()
      stream.pipe(out)
      out.on("finish", () =>  console.log(`Saved ${roomID}.`));
    }
}

// Guidance from https://developer.mozilla.org/en-US/docs/Web/API/Element/mousemove_event
function stroke(ctx, lX, lY, x, y, color) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.moveTo(lX, lY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.closePath();
}

function erase(ctx, x, y){
  ctx.clearRect(x, y, 20, 20);
}

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

let rooms = {"r0": null, "r1": null, "r2": null, "rjsinatra": null};

io.on("connection", (socket) => {
    console.log("+ " + socket.id.substring(0,3));
    socket.on("room", (id)=>{
      if (rooms.hasOwnProperty(id)){
        socket.join(id);
        socket.roomID = id;
        if (!rooms[socket.roomID]){
          // Create a new canvas for this room.
          let newRoomCanvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
          rooms[socket.roomID] = [newRoomCanvas, newRoomCanvas.getContext("2d")];
          loadImage(socket.roomID + ".png").then((image) => {
              rooms[socket.roomID][1].drawImage(image, 0, 0);
          }).catch(()=>{console.log(`Error loading image into room ${socket.roomID}: it probably doesn't exist yet.`)});
        }
        socket.emit("room", {"success": true, "msg": "Joined room " + socket.roomID});
        rooms[socket.roomID][0].toBuffer(function(err, buf){
          if (err) {socket.emit("image", {"success": false, "msg": err});}
          socket.emit("image", {"success": true, "data": buf});
        });
      } else {
        socket.emit("room", {"success": false, "msg": "Room does not exist."});
      }
    })

    socket.on("disconnect", () => {
        console.log("- " + socket.id.substring(0,3));
        if (socket.roomID){
          save(socket.roomID);
        }
    });

    socket.on("stroke", (data) => {
        if (socket.roomID == null){
          socket.emit("stroke", {"success": false, "msg": "You must be connected to a room to draw."});
          return;
        }
        stroke(rooms[socket.roomID][1], data.lX ,data.lY, data.x, data.y, data.color);
        io.sockets.in(socket.roomID).emit("stroke", {"success": true, "data": {"lX": data.lX, "lY": data.lY, "x": data.x, "y": data.y, "color": data.color}});
    });

    socket.on("erase", (data) => {
        if (socket.roomID == null){
          socket.emit("stroke", {"success": false, "msg": "You must be connected to a room to draw."});
          return;
        }
        erase(rooms[socket.roomID][1], data.x, data.y);
        io.sockets.in(socket.roomID).emit("erase", {"success": true, "data": {"x": data.x, "y": data.y}});
    });
});

setInterval(()=>{
  console.log("Performing scheduled saves...");
  Object.keys(io.sockets.adapter.rooms).forEach(e=>{
    if (!Object.keys(io.sockets.adapter.sids).includes(e)){
      save(e);
    }
  });
}, SAVE_ROOM_INTERVAL);

http.listen(8082, () => {
    console.log("listening on *:8082");
});
