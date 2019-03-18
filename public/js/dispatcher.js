/*jslint es5:true, indent: 2 */
/*global Vue, io */
/* exported vm */
'use strict';
var socket = io();

var vm = new Vue({
    el: '#page',
    data: {
        orders: {},
        drivers: {},
        customerMarkers: {},
        driverMarkers: {},
        baseMarker: null,

        checkedForPickUp: false,
        checkedForDropOff: false,
        driver: 0,
        driverPicked: false,
        summaryDisplayedPu: false,
        summaryDisplayedDo: false
    },

    created: function () {
        //dummy orders
        socket.emit("placeOrder", { fromLatLong: [59.849, 17.7],
          destLatLong: [59.845, 17.66],
          expressOrAlreadyProcessed: false,
          orderDetails: { pieces: 1, spaceRequired: 4, totalGrams: 3476,  driverInstructions: "Gula huset till höger" },
          orderDroppedAtHub: false,
          orderDroppedAtHub2: false,
          orderLeftHub: false,
          orderPickedUp: false,
          orderAssigned: false
        });
        socket.emit("placeOrder", { fromLatLong: [59.857, 17.64],
          destLatLong: [59.854, 17.62],
          expressOrAlreadyProcessed: false,
          orderDetails: { pieces: 1, spaceRequired: 3, totalGrams: 5643,  driverInstructions: "Banka inte på dörren, hunden blir tokig" },
          orderDroppedAtHub: false,
          orderDroppedAtHub2: false,
          orderLeftHub: false,
          orderPickedUp: false,
          orderAssigned: false
        });
        socket.emit("placeOrder", { fromLatLong: [59.846, 17.630],
          destLatLong: [59.830, 17.615],
          expressOrAlreadyProcessed: false,
          orderDetails: { pieces: 1, spaceRequired: 2, totalGrams: 4622,  driverInstructions: "Välkommen:)" },
          orderDroppedAtHub: false,
          orderDroppedAtHub2: false,
          orderLeftHub: false,
          orderPickedUp: false,
          orderAssigned: false
        });
        //end of dummy orders

        socket.on('initialize', function (data) {
            this.orders = data.orders;
            this.drivers = data.drivers;
            // add marker for home base in the map
            this.baseMarker = L.marker(data.base, {icon: this.baseIcon}).addTo(this.map);
            this.baseMarker.bindPopup("This is the dispatch and routing center");
            // add markers in the map for all orders
            for (var orderId in data.orders) {
                this.customerMarkers[orderId] = this.putCustomerMarkers(data.orders[orderId]);
            }
            // add driver markers in the map for all drivers
            for (var driverId in data.drivers) {
                this.driverMarkers[driverId] = this.putDriverMarker(data.drivers[driverId]);
            }
        }.bind(this));

        socket.on('driverAdded', function (driver) {
            this.$set(this.drivers, driver.driverId, driver);
            this.driverMarkers[driver.driverId] = this.putDriverMarker(driver);
        }.bind(this));
        socket.on('driverUpdated', function (driver) {
            this.drivers[driver.driverId] = driver;
        }.bind(this));
        socket.on('driverMoved', function (driver) {
            this.drivers[driver.driverId].latLong = driver.latLong;
            this.driverMarkers[driver.driverId].setLatLng(driver.latLong);
        }.bind(this));
        socket.on('driverQuit', function (driverId) {
            Vue.delete(this.drivers, driverId);
            this.map.removeLayer(this.driverMarkers[driverId]);
            Vue.delete(this.driverMarkers, driverId);
        }.bind(this));

        socket.on('orderPlaced', function (order) {
            this.$set(this.orders, order.orderId, order);
            this.customerMarkers[order.orderId] = this.putCustomerMarkers(order);
        }.bind(this));
        socket.on('driverAssigned', function (order) {
            this.$set(this.orders, order.orderId, order);
        }.bind(this));
        socket.on('orderPickedUp', function (order) {
            this.$set(this.orders, order.orderId, order);
        }.bind(this));
        //MAJAS ADDITION
        socket.on('orderDroppedOffAtHub', function (order) {
            this.$set(this.orders, order.orderId, order);
        }.bind(this));

        socket.on('orderDroppedOff', function (orderId) {
            Vue.delete(this.orders, orderId);
            this.map.removeLayer(this.customerMarkers[orderId].from);
            this.map.removeLayer(this.customerMarkers[orderId].dest);
            this.map.removeLayer(this.customerMarkers[orderId].line);
            Vue.delete(this.customerMarkers, orderId);
        }.bind(this));

        // These icons are not reactive
        this.driverIcon = L.icon({
            iconUrl: "img/driver.png",
            iconSize: [36,20],
            iconAnchor: [18,22],
            popupAnchor: [0,-20]
        });

        this.fromIcon = L.icon({
            iconUrl: "img/box.png",
            iconSize: [42,30],
            iconAnchor: [21,34]
        });
        this.baseIcon = L.icon({
            iconUrl: "img/base.png",
            iconSize: [40,40],
            iconAnchor: [20,20]
        });
    },
    mounted: function () {
        // set up the map
        this.map = L.map('my-map').setView([59.8415,17.648], 13);

        this.baseIcon = L.icon({
            iconUrl: "img/base.png",
            iconSize: [40,40],
            iconAnchor: [20,20]
        });

    },
    mounted: function () {
        // set up the map
        this.map = L.map('my-map').setView([59.8415,17.648], 13);

        // create the tile layer with correct attribution
        var osmUrl='http://{s}.tile.osm.org/{z}/{x}/{y}.png';
        var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
        L.tileLayer(osmUrl, {
            attribution: osmAttrib,
            maxZoom: 18
        }).addTo(this.map);
    },
    methods: {
        createPopup: function (orderId, items) {
            var popup = document.createElement('div');
            popup.appendChild(document.createTextNode('Order ' + orderId));
            var list = document.createElement('ul');
            list.classList.add('popup-list');
            for (var i in items) {
                var listItem = document.createElement('li');
                var listItemText = document.createTextNode(i + ": " + items[i]);
                listItem.appendChild(listItemText);
                list.appendChild(listItem);
            }
            popup.appendChild(list);
            return popup;
        },
        getPolylinePoints: function(order) {
            if (order.expressOrAlreadyProcessed) {
                return [order.fromLatLong, order.destLatLong];
            } else {
                return [order.fromLatLong, this.baseMarker.getLatLng(), order.destLatLong];
            }
        },
        putDriverMarker: function (driver) {
            var marker = L.marker(driver.latLong, {icon: this.driverIcon}).addTo(this.map);
            marker.bindPopup("Driver " + driver.driverId);
            marker.driverId = driver.driverId;
            return marker;
        },
        putCustomerMarkers: function (order) {
            var fromMarker = L.marker(order.fromLatLong, {icon: this.fromIcon}).addTo(this.map);
            fromMarker.bindPopup(this.createPopup(order.orderId, order.orderDetails));
            fromMarker.orderId = order.orderId;
            var destMarker = L.marker(order.destLatLong).addTo(this.map);
            destMarker.bindPopup(this.createPopup(order.orderId, order.orderDetails));
            destMarker.orderId = order.orderId;
            var connectMarkers = L.polyline(this.getPolylinePoints(order), {color: 'blue'}).addTo(this.map);
            return {from: fromMarker, dest: destMarker, line: connectMarkers};
        },
        assignDriver: function (order) {
            socket.emit("driverAssigned", order);
            console.log(order);
        },
        ordersToPickUp: function (orders, driver){
            console.log("ordersToPickUp");
            this.toPickUp = pickUp();
        },
        assignBulkPu: function (orders) {
            this.summaryDisplayedPu = false;
            var array = chOrdersPu(orders);
            for (var i=0; i<array.length; i++) {
                console.log("assign driver in bulk " + i);
                console.log("driver id: " + this.driver);
                console.log("add the following order to the driver");
                console.log(array[i]);
                array[i].driverId = this.driver;
                this.assignDriver(array[i]);
                array[i].orderAssigned = true;
            }
        },
        assignBulkDo: function (orders) {
            this.summaryDisplayedDo = false;
            var array = chOrdersDo(orders);
            for (var i=0; i<array.length; i++) {
                array[i].orderLeftHub = true;
                array[i].orderDroppedAtHub = false;
                console.log("assign driver in bulk " + i);
                console.log("driver id: " + this.driver);
                console.log("add the following order to the driver");
                console.log(array[i]);
                array[i].driverId = this.driver;
                this.assignDriver(array[i]);
                array[i].orderAssigned = true;
                console.log(array[i].orderAssigned);
            }
        },
        changeDriverPu: function (newDriver) {
            this.summaryDisplayedPu = true;
            this.driverPicked = true;
            this.driver = newDriver;
        },
        changeDriverDo: function (newDriver) {
            this.summaryDisplayedDo = true;
            this.driverPicked = true;
            this.driver = newDriver;
        },
        checkedOrdersFunqPu: function (orders) {
            this.checkedForPickUp = chOrdersPu(orders);
        },
        checkedOrdersFunqDo: function (orders) {
            this.checkedForDropOff = chOrdersDo(orders);
        }

    }
});


function chOrdersPu(orders) {
    var array = document.getElementsByName("checkboxPick");
    var isChecked = [];
    for (var i=0; i<array.length; i++) {
        if (array[i].checked) {
            console.log(array[i].id);
            isChecked.push(array[i].id);
        }
    }

    var result = [];
    for (var order in orders) {
        console.log(order);
        console.log(orders[order]);
        for (var j=0; j<isChecked.length; j++) {
            if (order == isChecked[j]) {
                console.log(order+ " == " +isChecked[j]);

                console.log(orders[order]);
                result.push(orders[order]);
            }
        }
    }
    return result;
}

function chOrdersDo(orders) {
    var array = document.getElementsByName("toSend");
    var isChecked = [];
    for (var i=0; i<array.length; i++) {
        if (array[i].checked) {
            console.log(array[i].id);
            isChecked.push(array[i].id);
        }
    }

    console.log(orders[1001].orderId);
    console.log(orders[1001]);
    var result = [];
    for (var order in orders) {
        console.log(order);
        console.log(orders[order]);
        for (var j=0; j<isChecked.length; j++) {
            if (order == isChecked[j]) {
                console.log(order+ " == " +isChecked[j]);

                console.log(orders[order]);
                result.push(orders[order]);
            }
        }
    }
    return result;
}
