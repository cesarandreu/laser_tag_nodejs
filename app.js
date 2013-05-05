

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
      name = 'Guest ' + nextUserId;
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

/*
var roomList = (function () {
  var rooms = {};

  var create = function(name, player) {
      if (!name || roomList[name].status){
        return false;
      } else {
        roomList[name] = {status: true, creator: player, playerList: [player]};
        return true;
      }
  };

  var join = function(name, player) {
    if (!name || !roomList[name].status) {
      return {};
    } else {
      roomList[name].playerList.push(player);
      return roomList[name];
    }
  };

  var leave = function (name, player) {

  };


}());
*/

/*
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
*/


var roomList = (function() {
  var rooms = {};


}());

io.sockets.on('connection', function (socket) {

  var name = userNames.getGuestName();

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
  });




});







