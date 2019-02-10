/*jslint node: true */
/* eslint-env node */
'use strict';

// Require express, socket.io, and vue
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
 
// Pick arbitrary port for server
var port = 3000;
app.set('port', (process.env.PORT || port));

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public/')));
// Serve vue from node_modules as vue/
app.use('/vue', express.static(path.join(__dirname, '/node_modules/vue/dist/')));
// Serve leaflet from node_modules as leaflet/
app.use('/leaflet', express.static(path.join(__dirname, '/node_modules/leaflet/dist/')));
// Serve esri leaflet geocoder from node_modules as esri-leaflet/
app.use('/esri-leaflet', express.static(path.join(__dirname, '/node_modules/esri-leaflet/dist/')));
// Serve esri leaflet geocoder from node_modules as esri-leaflet-geocoder/
app.use('/esri-leaflet-geocoder', express.static(path.join(__dirname, '/node_modules/esri-leaflet-geocoder/dist/')));
// Serve index.html directly as root page
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'views/customer.html'));
});
// Serve driver.html as /driver
app.get('/driver', function (req, res) {
  res.sendFile(path.join(__dirname, 'views/driver.html'));
});
// Serve dispatcher.html as /dispatcher
app.get('/dispatcher', function (req, res) {
  res.sendFile(path.join(__dirname, 'views/dispatcher.html'));
});

// Store data in an object to keep the global namespace clean and 
// prepare for multiple instances of data if necessary
function Data() {
  this.orders = {};
  this.drivers = {};
  this.baseLatLong = { "lat": 59.84091407485801, "lng": 17.64924108548685 };
  this.currentOrderNumber = 1000;
}


Data.prototype.getOrderNumber = function () {
  this.currentOrderNumber += 1;
  return this.currentOrderNumber;
}

/*
  Adds an order to the queue
*/
Data.prototype.addOrder = function (order) {
  var orderId = this.getOrderNumber();
  //Store the order in an "associative array" with orderId as key
  this.orders[orderId] = order;
  return orderId;
};

/*
  Delete the order when it's considered finished
*/
Data.prototype.orderDropOff = function (orderId) {
    delete this.orders[orderId];
};

/*
  Only needs to know orderId. The rest is up to the client to decide 
*/
Data.prototype.updateOrderDetails = function (order) {
  for (var key in order) {
    this.orders[order.orderId][key] = order[key];
  }
};

Data.prototype.getAllOrders = function () {
  return this.orders;
};

Data.prototype.addDriver = function (driver) {
  //Store info about the drivers in an "associative array" with driverId as key
  this.drivers[driver.driverId] = driver;
};

Data.prototype.updateDriverDetails = function (driver) {
  for (var key in driver) {
    this.drivers[driver.driverId][key] = driver[key];
  }
};

Data.prototype.removeDriver = function (driverId) {
    delete this.drivers[driverId];
};

Data.prototype.getAllDrivers = function () {
  return this.drivers;
};


var data = new Data();

io.on('connection', function (socket) {
  // Send the current lists of orders and drivers when a client connects
  socket.emit('initialize', { orders: data.getAllOrders(),
                              drivers: data.getAllDrivers(), base: data.baseLatLong });
  // Add a listener for when a connected client emits a "placeOrder" message
  socket.on('placeOrder', function (order) {
    var orderId = data.addOrder(order);
    order.orderId = orderId;
    console.log("An order was placed:",order);
    // send updated info to all connected clients, note the use of "io" instead of "socket"
    io.emit('orderPlaced', order);
    // send the orderId back to the customer who ordered
    socket.emit('orderId', orderId);
  });

  socket.on('addDriver', function (driver) {
    data.addDriver(driver);
    console.log("Driver",driver,"is on the job");
    // send updated info to all connected clients, note the use of io instead of socket
    io.emit('driverAdded', driver);
  });
  socket.on('updateDriver', function (driver) {
    console.log("Driver", driver.driverId,"was updated");
    data.updateDriverDetails(driver);
    // send updated info to all connected clients, note the use of io instead of socket
    io.emit('driverUpdated', driver);
  });
socket.on('moveDriver', function (driver) {
    console.log("Driver", driver.driverId,"moved to",driver.latLong);
    data.updateDriverDetails(driver);
    // send updated info to all connected clients, note the use of io instead of socket
    io.emit('driverMoved', driver);
  });
  socket.on('driverQuit', function (driver) {
    data.removeDriver(driver);
    console.log("Driver",driver,"has left the job");
    // send updated info to all connected clients, note the use of io instead of socket
    io.emit('driverQuit', driver);
  });
  
  socket.on('orderPickedUp', function(order) {
    console.log("Order",order.orderId,"was picked up");
    data.updateOrderDetails(order);
    io.emit('orderPickedUp', order );
  });
  socket.on('driverAssigned', function(order) {
    // Track assigned driver by adding driverId to the order
    console.log("Order",order.orderId,"was assigned to driver",order.driverId);
    data.updateOrderDetails(order);
    io.emit('currentQueue', { orders: data.getAllOrders() });
  });
  socket.on('orderDroppedOff', function (orderId) {
    console.log("Order",orderId,"was dropped off");
    data.orderDropOff(orderId);
    // send updated info to all connected clients, note the use of io instead of socket
    io.emit('orderDroppedOff', orderId);
  });
});

var server = http.listen(app.get('port'), function () {
  console.log('Server listening on port ' + app.get('port'));
});
