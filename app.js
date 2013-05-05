

var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

server.listen(3000);

var userNames = (function () {
  var names = {};

  var claim = function (name) {
    if (!name || userNames[name]) {
      return false;
    } else {
      userNames[name] = true;
      return true;
    }
  };

  // find the lowest unused "guest" name and claim it
  var getGuestName = function () {
    var name,
      nextUserId = 1;

    do {
      name = 'Guest' + nextUserId;
      nextUserId += 1;
    } while (!claim(name));

    return name;
  };

  // serialize claimed names as an array
  var get = function () {
    var res = [];
    for (var user in userNames) {
      res.push(user);
    }

    return res;
  };

  var free = function (name) {
    if (userNames[name]) {
      delete userNames[name];
    }
  };

  return {
    claim: claim,
    free: free,
    get: get,
    getGuestName: getGuestName
  };
}());



var roomList = (function() {
  var rooms = [];

  //Checks if room name is available.
  var available = function (name) {
    if( !name ){
      return false;
    } else {

      for( var i=0; i<rooms.length; i++ ){
        if(rooms[i].name == name){
          return false;
        }
      }

      return true;
    }
  };

  //Create a room.
  var create = function (gameInfo) {
    rooms.push({
      started: false,
      name: gameInfo.name,
      type: gameInfo.type,
      limit: gameInfo.limit,
      host: gameInfo.host,
      typeText: gameInfo.typeText,
      limitType: gameInfo.limitType,
      players:[],
      currentNumber: 8});
  };

  var information = function(roomName) {
    if (!roomName) {
      return {name: ''};
    } else {
      for (var i=0; i<rooms.length; i++){
        if ( rooms[i].name == roomName ) {
          return rooms[i];
        }
      }

      return {name: ''};
    }
  };

  //playerName joins roomName.
  var join = function(roomName, playerName) {
    if(!roomName || !playerName){
      return false;
    } else {
      for(var i=0; i<rooms.length; i++){
        if (rooms[i].name==roomName) {
          rooms[i].players.push({name:playerName, number: rooms[i].currentNumber});
          rooms[i].currentNumber+=2;
          return true;
        }
      }

      return false;
    }
  };

  //Get room list
  var getList = function () {
    var res = [];
    for(var i=0; i<rooms.length; i++){
      if (rooms[i].players.length!==0 && rooms[i].started!==true) {
        res.push(rooms[i].name);
      }
    }
    return res;
  };

  //Gets players in room
  var getPlayers = function (roomName) {
    if (!roomName) {
      return [];
    } else {
      for (var i=0; i<rooms.length; i++){
        if (rooms[i].name == roomName){
          return rooms[i].players;
        }
      }

      return [];
    }
  };

  var abandon = function (roomName) {
    if (!roomName){
      return false;
    } else {
      for (var i=0; i<rooms.length; i++){
        if (rooms[i].name == roomName) {
          rooms.splice(i, 1);
          return true;
        }
      }

      return false;
    }
  };

  var leave = function (roomName, playerName) {
    if (!roomName || !playerName) {
      return false;
    } else {
      for (var i=0; i<rooms.length; i++){
        if (rooms[i].name == roomName) {
          for (var j=0; j<rooms[i].players.length; j++){
            if (rooms[i].players[j].name == playerName) {
              rooms[i].players.splice(j, 1);
              return true;
            }
          }
        }
      }

      return false;
    }
  };

  return {
    abandon: abandon,
    available: available,
    create: create,
    information: information,
    getList: getList,
    join: join,
    getPlayers: getPlayers,
    leave: leave
  };

}());

io.sockets.on('connection', function (socket) {

  var name = userNames.getGuestName();

  var room = '';

  //Initializes the user, sends them a name and the list of users
  socket.emit('init', {name: name, users:userNames.get()});

  //Tell everyone a new user joined and tell them his name
  socket.broadcast.emit('user:join', {name: name});

  //Validate a user's name change, and broadast it on success
  socket.on('change:name', function (data, fn) {
    if (userNames.claim(data.name)) {
      var oldName = name;
      userNames.free(oldName);

      name = data.name;

      socket.broadcast.emit('change:name', {
        oldName: oldName,
        newName: name
      });

      fn(true);
    } else {
      fn(false);
    }
  });

  socket.on('disconnect', function () {
    socket.broadcast.emit('user:left', {
      name: name
    });
    userNames.free(name);

    socket.leave(room);


  });

  //When a game gets created
  socket.on('lobby:create', function (data, fn) {

    //Checks if room is available
    if (roomList.available(data.name)) {
      roomList.create(data); //Creates the room.
      socket.join(data.name); //Joins the room.
      roomList.join(data.name, data.host); //Joins the array.
      room = data.name; //Sets the local variable.
      fn(true, roomList.getPlayers(room));
    } else {
      fn(false, []);
    }
  });

  socket.on('lobby:hostLeft', function (roomName) {
    roomList.abandon(roomName);
    socket.leave(roomName);
    io.sockets.in(roomName).emit('lobby:abandon');
    room = '';
  });

  //When a player leaves a room
  socket.on('lobby:leave', function () {
    roomList.leave(room, name);
    socket.leave(room);
    io.sockets.in(room).emit('lobby:playerChange', roomList.getPlayers(room));
    room = '';
  });

  //Returns the list of possible games to join
  socket.on('lobby:getList', function (data, fn) {
    fn(roomList.getList());
  });

  //When a person joins a lobby do this
  socket.on('lobby:join', function(roomName, fn) {
    room = roomName;
    socket.join(roomName);
    roomList.join(room, name);
    var gameInfo = roomList.information(room);
    io.sockets.in(room).emit('lobby:playerChange', roomList.getPlayers(room));
    fn(gameInfo);

  });






});







