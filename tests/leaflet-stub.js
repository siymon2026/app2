/* Minimal stand-in for Leaflet 1.9.4, used ONLY by tests/browser-admin-zones.py because the sandbox cannot reach cdnjs.
   It implements just the calls public/admin/zones/zones.js makes and records them so the test can click "on the map".
   It does NOT render a map: map drawing itself is not verified by this test. */
(function () {
  var reg = { map: null, groups: [], layers: [] };
  function Evt() { this._h = {}; }
  Evt.prototype.on = function (n, f) { (this._h[n] = this._h[n] || []).push(f); return this; };
  Evt.prototype.fire = function (n, e) { (this._h[n] || []).forEach(function (f) { f(e || {}); }); };
  function Layer() { Evt.call(this); }
  Layer.prototype = Object.create(Evt.prototype);
  Layer.prototype.addTo = function (g) { this._g = g; g._items = g._items || []; g._items.push(this); reg.layers.push(this); return this; };
  function Group() { Layer.call(this); this._items = []; reg.groups.push(this); }
  Group.prototype = Object.create(Layer.prototype);
  Group.prototype.clearLayers = function () { var s = this; this._items.forEach(function (i) { var k = reg.layers.indexOf(i); if (k >= 0) reg.layers.splice(k, 1); }); this._items = []; return this; };
  Group.prototype.eachLayer = function (f) { this._items.slice().forEach(f); };
  function Polyline(p, o) { Layer.call(this); this.latlngs = p; this.options = o || {}; }
  Polyline.prototype = Object.create(Layer.prototype);
  Polyline.prototype.setLatLngs = function (p) { this.latlngs = p; return this; };
  function Polygon(p, o) { Polyline.call(this, p, o); }
  Polygon.prototype = Object.create(Polyline.prototype);
  function Marker(p, o) { Layer.call(this); this.ll = { lat: p[0], lng: p[1] }; this.options = o || {}; }
  Marker.prototype = Object.create(Layer.prototype);
  Marker.prototype.getLatLng = function () { return this.ll; };
  Marker.prototype.setLatLng = function (l) { this.ll = l; return this; };
  function Circle(ll, o) { Layer.call(this); this.ll = ll; this.options = o || {}; }
  Circle.prototype = Object.create(Layer.prototype);
  Circle.prototype.addTo = function (m) { Layer.prototype.addTo.call(this, m); m._items = m._items || []; return this; };
  function MapObj(id) { Evt.call(this); this.el = document.getElementById(id); this._c = { lat: 33.2655, lng: -7.5875 }; this._items = []; this.fits = []; reg.map = this; }
  MapObj.prototype = Object.create(Evt.prototype);
  MapObj.prototype.setView = function (c) { this._c = Array.isArray(c) ? { lat: c[0], lng: c[1] } : c; return this; };
  MapObj.prototype.getCenter = function () { return this._c; };
  MapObj.prototype.fitBounds = function (b) { this.fits.push(b); return this; };
  MapObj.prototype.removeLayer = function (l) { var k = reg.layers.indexOf(l); if (k >= 0) reg.layers.splice(k, 1); };
  window.L = {
    map: function (id) { return new MapObj(id); },
    tileLayer: function (u, o) { var l = new Layer(); l.url = u; l.addTo = function (m) { m.tileUrl = u; return l; }; return l; },
    layerGroup: function () { return new Group(); },
    polygon: function (p, o) { return new Polygon(p, o); },
    polyline: function (p, o) { return new Polyline(p, o); },
    marker: function (p, o) { return new Marker(p, o); },
    circleMarker: function (ll, o) { return new Circle(ll, o); },
    divIcon: function (o) { return o; },
    latLngBounds: function (pts) { return { pts: pts }; },
    Polygon: Polygon, Polyline: Polyline, Marker: Marker,
    DomEvent: { stopPropagation: function () {} },
  };
  window.__stub = {
    click: function (lat, lng) { reg.map.fire("click", { latlng: { lat: lat, lng: lng } }); },
    polygons: function () { return reg.layers.filter(function (l) { return l instanceof Polygon; }).map(function (l) { return { pts: l.latlngs, opts: l.options }; }); },
    markers: function () { return reg.layers.filter(function (l) { return l instanceof Marker; }); },
    clickMarker: function (i) { reg.layers.filter(function (l) { return l instanceof Marker; })[i].fire("click", {}); },
    dragMarker: function (i, lat, lng) { var m = reg.layers.filter(function (l) { return l instanceof Marker; })[i]; m.ll = { lat: lat, lng: lng }; m.fire("drag"); m.fire("dragend"); },
    clickPolygon: function (i) { reg.layers.filter(function (l) { return l instanceof Polygon; })[i].fire("click", {}); },
    tileUrl: function () { return reg.map && reg.map.tileUrl; },
  };
})();
