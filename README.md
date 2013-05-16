#Laser Tag Reloaded - Server

---

##What is this

This is a laser tag system which connects to your android smartphone using bluetooth. Your smartphone then connects to a remote server which handles tracking the lobby and game data. 

The program flow is simple: You pair the smartphone with the gun/vest, you join or create a lobby, and then you play! 

Each player is assigned a number, which gets transmitted by the infrared laser. When another player receives a valid enemy number it transmits this to the smartphone, and then the smartphone transmits it to the server.

At the end of each game you can see a map with markers showing the places where you got shot. 

---

###Project Links

The project itself has three components: 

* [__System__ (Gun + Vest)](https://github.com/cesarandreu/laser_tag_reloaded)

* [__Server__ (Node.js) ](https://github.com/cesarandreu/laser_tag_nodejs)

* [ __Smartphone application__ (Android)](https://github.com/cesarandreu/laser_tag_android)

---

###Server

The server is responsible for handling the lobby and game logic. Whenever a player creates/joins/leave a lobby, it informs the other users so they can update their information. 

If a game gets started, it handles processing all the data. Currently the two game modes are: _Timed Deathmatch_, and _Deathmatch_. In Timed Deathmatch, the player with the most points after the time limit is the winner; while in Deathmatch, the first player to reach a certain score is the winner. 

While a game is running the server handles receiving the data from one player, and then passing it on the other players. If the Game End conditions are met, it sends a signal to all the players that their game has ended. 

---

####Running or deploying the server

If you want to run the server you only have to clone the repository, run `npm install`, and then run `node app.js`. There shouldn't be any additional configuration required. 

The server was uploaded to [appfog](https://www.appfog.com/) during testing. However, at the time of development, we found that they did not support websockets. To deal with this we set socket.io to use polling by default. 
