(function() {
  var BasePort, IP, OutPort,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  BasePort = require('./BasePort');

  IP = require('./IP');

  OutPort = (function(_super) {
    __extends(OutPort, _super);

    function OutPort(options) {
      this.cache = {};
      OutPort.__super__.constructor.call(this, options);
    }

    OutPort.prototype.attach = function(socket, index) {
      if (index == null) {
        index = null;
      }
      OutPort.__super__.attach.call(this, socket, index);
      if (this.isCaching() && (this.cache[index] != null)) {
        return this.send(this.cache[index], index);
      }
    };

    OutPort.prototype.connect = function(socketId) {
      var socket, sockets, _i, _len, _results;
      if (socketId == null) {
        socketId = null;
      }
      sockets = this.getSockets(socketId);
      this.checkRequired(sockets);
      _results = [];
      for (_i = 0, _len = sockets.length; _i < _len; _i++) {
        socket = sockets[_i];
        if (!socket) {
          continue;
        }
        _results.push(socket.connect());
      }
      return _results;
    };

    OutPort.prototype.beginGroup = function(group, socketId) {
      var sockets;
      if (socketId == null) {
        socketId = null;
      }
      sockets = this.getSockets(socketId);
      this.checkRequired(sockets);
      return sockets.forEach(function(socket) {
        if (!socket) {
          return;
        }
        return socket.beginGroup(group);
      });
    };

    OutPort.prototype.send = function(data, socketId) {
      var sockets;
      if (socketId == null) {
        socketId = null;
      }
      sockets = this.getSockets(socketId);
      this.checkRequired(sockets);
      if (this.isCaching() && data !== this.cache[socketId]) {
        this.cache[socketId] = data;
      }
      return sockets.forEach(function(socket) {
        if (!socket) {
          return;
        }
        return socket.send(data);
      });
    };

    OutPort.prototype.endGroup = function(socketId) {
      var socket, sockets, _i, _len, _results;
      if (socketId == null) {
        socketId = null;
      }
      sockets = this.getSockets(socketId);
      this.checkRequired(sockets);
      _results = [];
      for (_i = 0, _len = sockets.length; _i < _len; _i++) {
        socket = sockets[_i];
        if (!socket) {
          continue;
        }
        _results.push(socket.endGroup());
      }
      return _results;
    };

    OutPort.prototype.disconnect = function(socketId) {
      var socket, sockets, _i, _len, _results;
      if (socketId == null) {
        socketId = null;
      }
      sockets = this.getSockets(socketId);
      this.checkRequired(sockets);
      _results = [];
      for (_i = 0, _len = sockets.length; _i < _len; _i++) {
        socket = sockets[_i];
        if (!socket) {
          continue;
        }
        _results.push(socket.disconnect());
      }
      return _results;
    };

    OutPort.prototype.sendIP = function(type, data, options, socketId, autoConnect) {
      var ip, pristine, socket, sockets, _i, _len, _ref;
      if (autoConnect == null) {
        autoConnect = true;
      }
      if (IP.isIP(type)) {
        ip = type;
        socketId = ip.index;
      } else {
        ip = new IP(type, data, options);
      }
      sockets = this.getSockets(socketId);
      this.checkRequired(sockets);
      if (this.isCaching() && data !== ((_ref = this.cache[socketId]) != null ? _ref.data : void 0)) {
        this.cache[socketId] = ip;
      }
      pristine = true;
      for (_i = 0, _len = sockets.length; _i < _len; _i++) {
        socket = sockets[_i];
        if (!socket) {
          continue;
        }
        if (pristine) {
          socket.post(ip, autoConnect);
          pristine = false;
        } else {
          if (ip.clonable) {
            ip = ip.clone();
          }
          socket.post(ip, autoConnect);
        }
      }
      return this;
    };

    OutPort.prototype.openBracket = function(data, options, socketId) {
      if (data == null) {
        data = null;
      }
      if (options == null) {
        options = {};
      }
      if (socketId == null) {
        socketId = null;
      }
      return this.sendIP('openBracket', data, options, socketId);
    };

    OutPort.prototype.data = function(data, options, socketId) {
      if (options == null) {
        options = {};
      }
      if (socketId == null) {
        socketId = null;
      }
      return this.sendIP('data', data, options, socketId);
    };

    OutPort.prototype.closeBracket = function(data, options, socketId) {
      if (data == null) {
        data = null;
      }
      if (options == null) {
        options = {};
      }
      if (socketId == null) {
        socketId = null;
      }
      return this.sendIP('closeBracket', data, options, socketId);
    };

    OutPort.prototype.checkRequired = function(sockets) {
      if (sockets.length === 0 && this.isRequired()) {
        throw new Error("" + (this.getId()) + ": No connections available");
      }
    };

    OutPort.prototype.getSockets = function(socketId) {
      if (this.isAddressable()) {
        if (socketId === null) {
          throw new Error("" + (this.getId()) + " Socket ID required");
        }
        if (!this.sockets[socketId]) {
          return [];
        }
        return [this.sockets[socketId]];
      }
      return this.sockets;
    };

    OutPort.prototype.isCaching = function() {
      if (this.options.caching) {
        return true;
      }
      return false;
    };

    return OutPort;

  })(BasePort);

  module.exports = OutPort;

}).call(this);
