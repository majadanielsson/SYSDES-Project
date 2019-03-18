/*jslint es5:true, indent: 2 */
/*global Vue, io */
/* exported vm */
'use strict';
var socket = io();

var vm = new Vue({
    el: '#page',
    data: {
        express: null,
        orderId: 1002,
        map: null,
        fromMarker: null,
        destMarker: null,
        baseMarker: null,
        driverMarkers: {},

        totalCost: 0,
        warning: ""
    },
    created: function () {
        socket.on('initialize', function (data) {
            // add marker for home base in the map
            this.baseMarker = L.marker(data.base, {icon: this.baseIcon}).addTo(this.map);
            this.baseMarker.bindPopup("This is the dispatch and routing center");
        }.bind(this));
        socket.on('orderId', function (orderId) {
            this.orderId = orderId;
        }.bind(this));

        // These icons are not reactive
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

        // create the tile layer with correct attribution
        var osmUrl='http://{s}.tile.osm.org/{z}/{x}/{y}.png';
        var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
        L.tileLayer(osmUrl, {
            attribution: osmAttrib,
            maxZoom: 18
        }).addTo(this.map);
        this.map.on('click', this.handleClick);

        var searchDestControl = L.esri.Geocoding.geosearch({allowMultipleResults: false, zoomToResult: false, placeholder: "Destination"}).addTo(this.map);
        var searchFromControl = L.esri.Geocoding.geosearch({allowMultipleResults: false, zoomToResult: false, placeholder: "From"});
        // listen for the results event and add the result to the map
        searchDestControl.on("results", function(data) {
            this.destMarker = L.marker(data.latlng, {draggable: true}).addTo(this.map);
            this.destMarker.on("drag", this.moveMarker);
            searchFromControl.addTo(this.map);
        }.bind(this));

        // listen for the results event and add the result to the map
        searchFromControl.on("results", function(data) {
            this.fromMarker = L.marker(data.latlng, {icon: this.fromIcon, draggable: true}).addTo(this.map);
            this.fromMarker.on("drag", this.moveMarker);
            this.connectMarkers = L.polyline([this.fromMarker.getLatLng(), this.destMarker.getLatLng()], {color: 'blue'}).addTo(this.map);
        }.bind(this));
  },
  methods: {
    placeOrder: function() {
      socket.emit("placeOrder", { fromLatLong: [this.fromMarker.getLatLng().lat, this.fromMarker.getLatLng().lng],
        destLatLong: [this.destMarker.getLatLng().lat, this.destMarker.getLatLng().lng],
        expressOrAlreadyProcessed: this.express ? true : false,
        orderDetails: { pieces: 1, spaceRequired: 3, totalGrams: 5600,  driverInstructions: "Beware of the dog" },
        orderDroppedAtHub: false,
        orderDroppedAtHub2: false,
        orderLeftHub: false,
        orderPickedUp: false,
        orderAssigned: false
      });
    },
    showOrderNumber: function() {
      this.orderId += 1;
      return this.orderId;
    },
    getPolylinePoints: function() {
      if (this.express) {
        return [this.fromMarker.getLatLng(), this.destMarker.getLatLng()];
      } else {
        return [this.fromMarker.getLatLng(), this.baseMarker.getLatLng(), this.destMarker.getLatLng()];
      }
    },
        handleClick: function (event) {
            // first click sets pickup location
            if (this.fromMarker === null) {
                this.fromMarker = L.marker(event.latlng, {icon: this.fromIcon, draggable: true}).addTo(this.map);
                this.fromMarker.on("drag", this.moveMarker);
            }
            // second click sets destination
            else if (this.destMarker === null) {
                this.destMarker = L.marker([event.latlng.lat, event.latlng.lng], {draggable: true}).addTo(this.map);
                this.destMarker.on("drag", this.moveMarker);
                this.connectMarkers = L.polyline(this.getPolylinePoints(), {color: 'blue'}).addTo(this.map);
            }
            // subsequent clicks assume moved markers
            else {
                this.moveMarker();
            }
        },
        moveMarker: function (event) {
            this.connectMarkers.setLatLngs(this.getPolylinePoints(), {color: 'blue'});
            /*socket.emit("moveMarker", { orderId: event.target.orderId,
              latLong: [event.target.getLatLng().lat, event.target.getLatLng().lng]
              });
            */
            //Add cost for express
            if((document.getElementsByName("express")[0]).checked) {
                this.totalCost = 99;
                console.log(this.totalCost);
            }
            else {
                this.totalCost = 0;
                console.log(this.totalCost);
            }
        },
        checkMapInput: function () {
            showPackSize();
        },
        checkPackageInput: function () {
          var packRadio = document.getElementsByName("packSize");
          for (var i = 0; i < packRadio.length; i++) {
            if (packRadio[i].checked) {
              this.totalCost += parseInt(packRadio[i].value);
              console.log(this.totalCost);
            }
          }
          show3Container();
        }

    }
});


function showPackSize() {
    var x = document.getElementById("pack-size");
    x.style.display = "block";
}

function show3Container() {
    var x = document.getElementById("3Container");
    x.style.display = "block";
}

function showPayment() {
    var arrayN = ["firstN","lastN","address","postC","city","number"]
    var arrayT = ["First name must be filled out",
                 "Last name must be filled out",
                 "Address must be filled out",
                 "Postal code must be filled out",
                 "City must be filled out",
                  "Number must be filled out"]

    for (var i=0; i<6; i++) {
        var x = document.forms["personalInfo"][arrayN[i]].value;
        if (x == "") {
            console.log(arrayT[i]);
            return;
        }
    }
    var x = document.getElementById("payment");
    x.style.display = "block";
    return;

}
