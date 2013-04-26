
/**
 * Module dependencies.
 */

/*
var express = require('express');
var http = require('http');
var path = require('path');
var io = require('socket.io');

var app = express();
*/

/*

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res) {
    
});


http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

*/

var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

server.listen(3000);


/*
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
*/
 var gameList = [];
 var userChannel = [];
io.sockets.on('connection', function (socket) {

  socket.on('set_name', function (response) {
    socket.set('name', response, function() {
        socket.emit('set_name_response');
    });
  });

  socket.on('create_game', function (response) {
    gameList.push(response);
    socket.join(response.name);
    socket.emit('create_game_response', response);
  });

  socket.on('game_list', function () {
    var list = [];
    for(var i=0; i<gameList.length; i++){
      list[i] = gameList[i].name;
    }
    socket.emit('game_list_response', list);


  });

  socket.on('join_game', function (response) {
    socket.join(response.room);
    socket.emit('creator_user_joined', {room: response.roomName, player: response.playerName});
    socket.emit('join_game_response', {room: response.roomName, player: response.playerName});
  });

  socket.on('get_updated_information', function() {
    socket.emit('asking_for_information');
  });

  socket.on('send_room_information', function (response) {
    io.sockets.in(response.room).emit('updated_room_information', response);
  });

});







