

var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

server.listen(process.env.PORT || 3000);

//Since I'm using appfog and they don't support websockets,
//And since Android Web View doesn't support websockets,
//And since I don't wanna change my stuff to use a plugin.
//This sets it to use polling by default.
io.set('transports', ['xhr-polling']);


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
          rooms[i].players.push({name:playerName, number: rooms[i].currentNumber, ready: ''});
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
      if(rooms[i].players.length===0){
        //Abandons the room because it has no players.
        roomList.abandon(rooms[i].name);
      } else if (rooms[i].players.length!==0 && rooms[i].started!==true) {
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
              if (rooms[i].players.length === 0) {
                roomList.abandon(roomName);
              }
              return true;
            }
          }
        }
      }

      return false;
    }
  };

  var ready = function (roomName, playerName) {
    if (!roomName || !playerName) {
      return false;
    } else {
      for (var i = 0; i < rooms.length; i++) {
          if (rooms[i].name == roomName) {
              for (var j = 0; j < rooms[i].players.length; j++) {
                  if (rooms[i].players[j].name == playerName) {
                    rooms[i].players[j].ready = 'READY';
                    return true;
                  }
              }
          }
      }

      return false;
    }
  };

  var start = function (roomName) {
    if (!roomName) {
        return false;
    } else {
      for (var i = 0; i <rooms.length; i++) {
          if (rooms[i].name == roomName) {
              rooms[i].started = true;
              return true;
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
    start: start,
    ready: ready,
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

    console.log('Name:' + name + ', in room: ' + room + ' has left.');

    //Makes the player leave whatever room he was in.
    roomList.leave(room, name);

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
    io.sockets['in'](roomName).emit('lobby:abandon');
    room = '';
  });

  //When a player leaves a room
  socket.on('lobby:leave', function () {
    roomList.leave(room, name);
    socket.leave(room);
    io.sockets['in'](room).emit('lobby:playerChange', roomList.getPlayers(room));
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
    io.sockets['in'](room).emit('lobby:playerChange', roomList.getPlayers(room));
    fn(gameInfo);

  });

  socket.on('lobby:informationReady', function () {
    roomList.start(room);
    io.sockets['in'](room).emit('lobby:sendInformation');
  });

  socket.on('lobby:setReady', function () {
    roomList.ready(room, name);
    io.sockets['in'](room).emit('lobby:playerChange', roomList.getPlayers(room));
  });


  //Game logic here:
  socket.on('game:sendStart', function (data) {
    io.sockets['in'](room).emit('game:start');

    if (data.game.type == 'A') {
      deathmatch.start(room);
    } else {
      timed_deathmatch.start(room);

      setTimeout(function(room) {
        var result = timed_deathmatch.getScores(room);
        var topPlayer = getTop(result);
        io.sockets['in'](room).emit('game:over', topPlayer);
        timed_deathmatch.end(room);
      }, data.game.limit * 60 * 1000, room);

    }

  });


  socket.on('game:hit', function (data) {

      var result;

      console.log('HIT RECEIVED, ROOM IS: ' + room);

      if (data.type == 'A') {
        deathmatch.hit(room, data.hitData);

        result = deathmatch.getScores(room);

        io.sockets['in'](room).emit('game:score', result);

        var scoreResult = checkScore(result, data.limit);
        if (scoreResult.score >= data.limit) {
            io.sockets['in'](room).emit('game:over', scoreResult);
            deathmatch.end(room);
        }
      } else {

        timed_deathmatch.hit(room, data.hitData);

        result = timed_deathmatch.getScores(room);

        io.sockets['in'](room).emit('game:score', result);

      }

  });

 function checkScore(players, limit) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].score >= limit) {
            return players[i];
        }
    }
    return {name: '', score: 0, number: 0};
  }

  function getTop (players) {
    var top = 0;
    var player = {};
    for (var i = 0; i < players.length; i++) {
        if (players[i].score >= top) {
          top = players[i].score;
          player = players[i];
        }
    }
    return player;
  }



  /*
  function gameTypeB (limit, room) {
    gameType = 'B';
    setTimeout(function(room) {
      io.sockets.in(room).emit('game:over');
    }, limit*60*1000, room);
  }
  */

});

var timed_deathmatch = (function() {
  var matches = [];

  var start = function (roomName) {
    var gameInfo = roomList.information(roomName);

    for (var i = 0; i < gameInfo.players.length; i++) {
        gameInfo.players[i].score = 0;
    }

    matches.push({
      name: gameInfo.name,
      limit: gameInfo.limit,
      players: gameInfo.players,
      hit: []
    });

  };

  var hit = function(roomName, hitInfo) {
    for (var i = 0; i < matches.length; i++) {
        if (matches[i].name == roomName) {
            matches[i].hit.push(hitInfo);

            for (var j=0; j < matches[i].players.length; j++) {
              if (hitInfo.id == matches[i].players[j].number) {
                matches[i].players[j].score++;
                break;
              }
            }
            break;
        }
    }
  };

  var getScores = function(roomName) {
    var res = [];
    for (var i = 0; i < matches.length; i++) {
        if (matches[i].name == roomName) {
            for (var j = 0; j < matches[i].players.length; j++) {
                res.push(matches[i].players[j]);
            }
            break;
        }
    }
    return res;
  };

  var end = function(roomName) {
    for (var i = 0; i < matches.length; i++) {
        if (matches[i].name == roomName) {
            matches.splice(i, 1);
            break;
        }
    }
  };

  return {
    start: start,
    hit: hit,
    getScores: getScores,
    end: end
  };

}());

var deathmatch = (function() {
  var deathmatches = [];

  var start = function(roomName) {
    var gameInfo = roomList.information(roomName);

    for (var i = 0; i < gameInfo.players.length; i++) {
        gameInfo.players[i].score = 0;
    }

    deathmatches.push({
      name: gameInfo.name,
      limit: gameInfo.limit,
      players: gameInfo.players,
      hit: []
    });

  };

  var hit = function(roomName, hitInfo) {
    for (var i = 0; i < deathmatches.length; i++) {
        if (deathmatches[i].name == roomName) {
            deathmatches[i].hit.push(hitInfo);

            for (var j=0; j < deathmatches[i].players.length; j++) {
              if (hitInfo.id == deathmatches[i].players[j].number) {
                deathmatches[i].players[j].score = (deathmatches[i].players[j].score + 1);
                break;
              }
            }
            break;
        }
    }
  };

  var getScores = function(roomName) {
    var res = [];
    for (var i = 0; i < deathmatches.length; i++) {
        if (deathmatches[i].name == roomName) {
            for (var j = 0; j < deathmatches[i].players.length; j++) {
                res.push(deathmatches[i].players[j]);
            }
            break;
        }
    }
    return res;
  };

  var end = function(roomName) {
    for (var i = 0; i < deathmatches.length; i++) {
        if (deathmatches[i].name == roomName) {
            deathmatches.splice(i, 1);
            break;
        }
    }
  };

  return {
    start: start,
    hit: hit,
    getScores: getScores,
    end: end
  };

}());


/*
var gameList = (function() {
  var games = [];

  var start = function(game, lobby) {
    if ( game.type == 'A' ) {
    } else {
    }
  };


}());
*/