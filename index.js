var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const { createCanvas, loadImage } = require('canvas')
const canvas = createCanvas(850, 1100);
const ctx = canvas.getContext('2d');

const fs = require('fs')

loadImage('image.png').then((image) => {
    ctx.drawImage(image, 0, 0);
})

function save(canvas){
    const out = fs.createWriteStream(__dirname + '/image.png')
    const stream = canvas.createPNGStream()
    stream.pipe(out)
    out.on('finish', () =>  console.log('save complete.'))
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

io.on('connection', (socket) => {
    console.log('a user connected');
    // Send image.
    setTimeout(()=>{
    canvas.toBuffer(function(err, buf){
        if (err) throw err;
        io.emit('image', buf);
    });
    }, 1000);

    socket.on('disconnect', () => {
        console.log('user disconnected.');
    });
    socket.on('stroke', (lX, lY, x, y) => {
        stroke(ctx, lX ,lY, x, y);
        io.emit('stroke', lX, lY, x, y);
    })
});

setInterval(()=>{save(canvas);}, 60000)
http.listen(80, () => {
    console.log('listening on *:80');
});
