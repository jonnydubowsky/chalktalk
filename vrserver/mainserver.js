

const WebSocket = require('ws');
const holojam = require('holojam-node')(['emitter','sink'],'192.168.1.122');
const ws = new WebSocket('ws://localhost:22346');

ws.on('open', function open() {
  ws.send(JSON.stringify({global: "displayListener", value: true }));
});

// reroute data to ChalkTalk Server
holojam.on('onmousemove',(flake) => {
  var m = {
   eventType: "onmousemove",
   event: {
      button : flake.ints[0],     // EITHER 0,1,2 or 3
      clientX: flake.floats[0],     // X SCREEN COORD -1.0 … +1.0
      clientY: flake.floats[1]      // Y SCREEN COORD -1.0 … +1.0
   }};
   m = JSON.stringify(m);
   ws.send(m);
});

holojam.on('onmousedown',(flake) => {
    var m = {
   eventType: "onmousedown",
   event: {
      button : flake.ints[0],     // EITHER 0,1,2 or 3
      clientX: flake.floats[0],     // X SCREEN COORD -1.0 … +1.0
      clientY: flake.floats[1]      // Y SCREEN COORD -1.0 … +1.0
   }};
   m = JSON.stringify(m);
   ws.send(m);
});

holojam.on('onmouseup',(flake) => {
    var m = {
   eventType: "onmouseup",
   event: {
      button : flake.ints[0],     // EITHER 0,1,2 or 3
      clientX: flake.floats[0],     // X SCREEN COORD -1.0 … +1.0
      clientY: flake.floats[1]      // Y SCREEN COORD -1.0 … +1.0
   }};
   m = JSON.stringify(m);
   ws.send(m);
});


function readHeader(data){
   var ctdata01 = data.toString('ascii',1,2);
  ctdata01 += data.toString('ascii',0,1);
  ctdata01 += data.toString('ascii',3,4);
  ctdata01 += data.toString('ascii',2,3);
  ctdata01 += data.toString('ascii',5,6);
  ctdata01 += data.toString('ascii',4,5);
  ctdata01 += data.toString('ascii',7,8);
  ctdata01 += data.toString('ascii',6,7);
  console.log("start with", ctdata01);
  return ctdata01;
}


function readCurves(data){
  var curveObjs = {label: 'Display',vector4s:[{
            x: 0,
            y: 0,
            z: 0,
            w: 0,
         }],ints:[0]};
   // start at index:8 
   var index = 8;
   var index4buf = 0;
   var curveIntsIdx = 0;
   var vectorIdx = 0;

   var curveCnt = data.readInt16LE(index);
   index += 2;
   console.log("curveCnt", curveCnt);

   if(curveCnt < 0){
    return curveObjs;
   }

   // for each curbe
   while(index4buf < curveCnt){
      var curveSize = data.readInt16LE(index);
      curveObjs.ints[curveIntsIdx++] = (curveSize -2)/4;
      //var curveObj = {};
      index += 2;
      console.log("cur curve size:", curveSize, curveObjs.ints[curveIntsIdx-1]);

      // color rgba
      var rg = data.readInt16LE(index);
      index += 2;
      var ba = data.readInt16LE(index);
      index += 2;
      index4buf += 2;
      var color = {
         r: rg >> 8,
         g: rg & 0x00ff,
         b: ba >> 8,
         a: ba & 0x00ff,
      }
      console.log("color:", color);
      
      curveObjs.vector4s[vectorIdx++] = {
        x:color.r,
        y:color.g,
        z:color.b,
        w:color.a,
      };

      for( var i = 0; i < curveSize -2; i += 4){
         // position
         var info = {
            x: data.readInt16LE(index,true) < 0 ? data.readInt16LE(index,true) + 0x10000: data.readInt16LE(index,true),
            y: data.readInt16LE(index + 2,true)< 0 ? data.readInt16LE(index + 2,true) + 0x10000: data.readInt16LE(index + 2,true),
            z: data.readInt16LE(index + 4,true)< 0 ? data.readInt16LE(index + 4,true) + 0x10000: data.readInt16LE(index + 4,true),
            w: data.readInt16LE(index + 6,true)< 0 ? data.readInt16LE(index + 6,true) + 0x10000: data.readInt16LE(index + 6,true), // width
         }
         var pos = {
            x: info.x / 0xffff * 2 - 1,
            y: info.y / 0xffff * 2 - 1,
            z: info.z / 0xffff * 2 - 1,
            w: info.w / 0xffff * 2 - 1, // width
         }
         //console.log("pos:", pos);
         curveObjs.vector4s[vectorIdx++] = pos;
         index += 8;
         index4buf += 4;
      }
   }
   //console.log("curveObjs",curveObjs);
   var sum = 0;
   for (var idx = 0; idx < curveObjs.ints.length; idx++){
      sum += curveObjs.ints[idx]+1;
   }
   if (curveObjs.vector4s.length != sum){
      console.log("wrong size", sum, curveObjs.vector4s.length);
   }
   if (curveObjs.vector4s.length < sum){
      console.log("out of index", sum, curveObjs.vector4s.length);
      for (var idx = 0; idx < curveObjs.ints.length; idx++){
        var realidx = 0;
        console.log("\t", idx, curveObjs.ints[idx], curveObjs.vector4s[realidx]);
        realidx += curveObjs.ints[idx] + 1;
     }
   }
   //holojam.Send(holojam.BuildUpdate('example', [curveObjs]));
   return curveObjs;
}

function getTime(){
  var d = new Date();
  var myDate = {
    min: d.getMinutes(),
    sec: d.getSeconds(),
    ms: d.getMilliseconds(),
  }
  return myDate;
}

function testMTU(){
  var curveObjs = {label: 'Display',vector4s:[{
            x: 0,
            y: 0,
            z: 0,
            w: 0,
         }],ints:[0],bytes:[0]};
  for(var i = 0; i < 50; i++){
    curveObjs.vector4s[i] = {x:1,y:1,z:1,w:1};
    curveObjs.ints[i] = 1;
    curveObjs.bytes[i] = 1;
  }
  return curveObjs;
}

ws.on('message', function incoming(data, flags) {
  // flags.binary will be set if a binary data is received.
  // flags.masked will be set if the data was masked.
  console.log("data",data);
  // time I received displayList
  console.log("Receive displayList", getTime());
  var header = readHeader(data);
  if (header === "CTdata01"){
      //var curveFlakes = readCurves(data);
      //var curveFlakes = {label: 'Display',bytes:[]}
      // test []
      //curveFlakes.bytes = new Uint8Array(data.length);
      var curveFlakes = {label: 'Display',bytes:data}
      console.log("curveFlakes",curveFlakes, curveFlakes.bytes.length);
      // time I parsed displayList and send
      console.log("Parsed displayList and send", getTime());
      // test maximum size of package
      curveFlakes = testMTU();
      holojam.Send(holojam.BuildUpdate('ChalkTalk', [curveFlakes]));
  }
});



