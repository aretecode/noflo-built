(function() {
  var Component, EventEmitter, IP, PortBuffer, ProcessInput, ProcessOutput, ports,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  EventEmitter = require('events').EventEmitter;

  ports = require('./Ports');

  IP = require('./IP');

  Component = (function(_super) {
    __extends(Component, _super);

    Component.prototype.description = '';

    Component.prototype.icon = null;

    function Component(options) {
      this.error = __bind(this.error, this);
      var _ref, _ref1, _ref2;
      if (!options) {
        options = {};
      }
      if (!options.inPorts) {
        options.inPorts = {};
      }
      if (options.inPorts instanceof ports.InPorts) {
        this.inPorts = options.inPorts;
      } else {
        this.inPorts = new ports.InPorts(options.inPorts);
      }
      if (!options.outPorts) {
        options.outPorts = {};
      }
      if (options.outPorts instanceof ports.OutPorts) {
        this.outPorts = options.outPorts;
      } else {
        this.outPorts = new ports.OutPorts(options.outPorts);
      }
      if (options.icon) {
        this.icon = options.icon;
      }
      if (options.description) {
        this.description = options.description;
      }
      this.started = false;
      this.load = 0;
      this.ordered = (_ref = options.ordered) != null ? _ref : false;
      this.autoOrdering = (_ref1 = options.autoOrdering) != null ? _ref1 : null;
      this.outputQ = [];
      this.fullOutputQ = [];
      this.activateOnInput = (_ref2 = options.activateOnInput) != null ? _ref2 : true;
      this.forwardBrackets = {
        "in": ['out', 'error']
      };
      this.bracketCounter = {};
      if ('forwardBrackets' in options) {
        this.forwardBrackets = options.forwardBrackets;
      }
      if (typeof options.process === 'function') {
        this.process(options.process);
      }
    }

    Component.prototype.getDescription = function() {
      return this.description;
    };

    Component.prototype.isReady = function() {
      return true;
    };

    Component.prototype.isSubgraph = function() {
      return false;
    };

    Component.prototype.setIcon = function(icon) {
      this.icon = icon;
      return this.emit('icon', this.icon);
    };

    Component.prototype.getIcon = function() {
      return this.icon;
    };

    Component.prototype.error = function(e, groups, errorPort, scope) {
      var group, _i, _j, _len, _len1;
      if (groups == null) {
        groups = [];
      }
      if (errorPort == null) {
        errorPort = 'error';
      }
      if (scope == null) {
        scope = null;
      }
      if (this.outPorts[errorPort] && (this.outPorts[errorPort].isAttached() || !this.outPorts[errorPort].isRequired())) {
        for (_i = 0, _len = groups.length; _i < _len; _i++) {
          group = groups[_i];
          this.outPorts[errorPort].openBracket(group, {
            scope: scope
          });
        }
        this.outPorts[errorPort].data(e, {
          scope: scope
        });
        for (_j = 0, _len1 = groups.length; _j < _len1; _j++) {
          group = groups[_j];
          this.outPorts[errorPort].closeBracket(group, {
            scope: scope
          });
        }
        return;
      }
      throw e;
    };

    Component.prototype.shutdown = function() {
      return this.started = false;
    };

    Component.prototype.start = function() {
      this.started = true;
      return this.started;
    };

    Component.prototype.isStarted = function() {
      return this.started;
    };

    Component.prototype.prepareForwarding = function() {
      var inPort, outPort, outPorts, tmp, _i, _len, _ref, _results;
      _ref = this.forwardBrackets;
      _results = [];
      for (inPort in _ref) {
        outPorts = _ref[inPort];
        if (!(inPort in this.inPorts.ports)) {
          delete this.forwardBrackets[inPort];
          continue;
        }
        tmp = [];
        for (_i = 0, _len = outPorts.length; _i < _len; _i++) {
          outPort = outPorts[_i];
          if (outPort in this.outPorts.ports) {
            tmp.push(outPort);
          }
        }
        if (tmp.length === 0) {
          _results.push(delete this.forwardBrackets[inPort]);
        } else {
          this.forwardBrackets[inPort] = tmp;
          _results.push(this.bracketCounter[inPort] = 0);
        }
      }
      return _results;
    };

    Component.prototype.process = function(handle) {
      var name, port, _fn, _ref;
      if (typeof handle !== 'function') {
        throw new Error("Process handler must be a function");
      }
      if (!this.inPorts) {
        throw new Error("Component ports must be defined before process function");
      }
      this.prepareForwarding();
      this.handle = handle;
      _ref = this.inPorts.ports;
      _fn = (function(_this) {
        return function(name, port) {
          if (!port.name) {
            port.name = name;
          }
          return port.on('ip', function(ip) {
            return _this.handleIP(ip, port);
          });
        };
      })(this);
      for (name in _ref) {
        port = _ref[name];
        _fn(name, port);
      }
      return this;
    };

    Component.prototype.handleIP = function(ip, port) {
      var input, outPort, output, outputEntry, result, _i, _len, _ref;
      this.fullOutputQ.push(ip);
      if (port.options.data) {
        result = {};
        input = new ProcessInput(this.inPorts, ip, this, port, result);
        output = new ProcessOutput(this.outPorts, ip, this, result);
        this.load++;
        this.handle(input, output, function() {
          return output.done();
        });
      }
      if (ip.type === 'openBracket') {
        if (this.autoOrdering === null) {
          this.autoOrdering = true;
        }
        this.bracketCounter[port.name]++;
      }
      if (port.name in this.forwardBrackets && (ip.type === 'openBracket' || ip.type === 'closeBracket')) {
        outputEntry = {
          __resolved: true,
          __forwarded: true,
          __type: ip.type,
          __scope: ip.scope
        };
        _ref = this.forwardBrackets[port.name];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          outPort = _ref[_i];
          if (!(outPort in outputEntry)) {
            outputEntry[outPort] = [];
          }
          outputEntry[outPort].push(ip);
        }
        if (ip.scope != null) {
          port.scopedBuffer[ip.scope].pop();
        } else {
          port.buffer.pop();
        }
        this.outputQ.push(outputEntry);
        this.processOutputQueue();
        return;
      }
      if (port.options.triggering) {
        result = {};
        input = new ProcessInput(this.inPorts, ip, this, port, result);
        output = new ProcessOutput(this.outPorts, ip, this, result);
        this.load++;
        return this.handle(input, output, function() {
          return output.done();
        });
      }
    };

    Component.prototype.processOutputQueue = function() {
      var bracketsClosed, ip, ips, name, port, result, _i, _len, _ref;
      while (this.outputQ.length > 0) {
        result = this.outputQ[0];
        if (!result.__resolved) {
          break;
        }
        for (port in result) {
          ips = result[port];
          if (port.indexOf('__') === 0) {
            continue;
          }
          if (!this.outPorts.ports[port].isAttached()) {
            continue;
          }
          for (_i = 0, _len = ips.length; _i < _len; _i++) {
            ip = ips[_i];
            if (ip.type === 'closeBracket') {
              this.bracketCounter[port]--;
            }
            this.outPorts[port].sendIP(ip);
          }
        }
        this.outputQ.shift();
      }
      bracketsClosed = true;
      _ref = this.outPorts.ports;
      for (name in _ref) {
        port = _ref[name];
        if (this.bracketCounter[port] !== 0) {
          bracketsClosed = false;
          break;
        }
      }
      if (bracketsClosed && this.autoOrdering === true) {
        return this.autoOrdering = null;
      }
    };

    return Component;

  })(EventEmitter);

  exports.Component = Component;

  ProcessInput = (function() {
    function ProcessInput(ports, ip, nodeInstance, port, result) {
      this.ports = ports;
      this.ip = ip;
      this.nodeInstance = nodeInstance;
      this.port = port;
      this.result = result;
      this.scope = this.ip.scope;
      this.buffer = new PortBuffer(this);
    }

    ProcessInput.prototype.activate = function() {
      this.result.__resolved = false;
      if (this.nodeInstance.ordered || this.nodeInstance.autoOrdering) {
        return this.nodeInstance.outputQ.push(this.result);
      }
    };

    ProcessInput.prototype.has = function() {
      var args, port, res, validate, _i, _j, _len, _len1;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (!args.length) {
        args = ['in'];
      }
      if (typeof args[args.length - 1] === 'function') {
        validate = args.pop();
        for (_i = 0, _len = args.length; _i < _len; _i++) {
          port = args[_i];
          if (!this.ports[port].has(this.scope, validate)) {
            return false;
          }
        }
        return true;
      }
      res = true;
      for (_j = 0, _len1 = args.length; _j < _len1; _j++) {
        port = args[_j];
        res && (res = this.ports[port].ready(this.scope));
      }
      return res;
    };

    ProcessInput.prototype.get = function() {
      var args, port, res;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (!args.length) {
        args = ['in'];
      }
      if ((this.nodeInstance.ordered || this.nodeInstance.autoOrdering) && this.nodeInstance.activateOnInput && !('__resolved' in this.result)) {
        this.activate();
      }
      res = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = args.length; _i < _len; _i++) {
          port = args[_i];
          _results.push(this.ports[port].get(this.scope));
        }
        return _results;
      }).call(this);
      if (args.length === 1) {
        return res[0];
      } else {
        return res;
      }
    };

    ProcessInput.prototype.getData = function() {
      var args, ip, ips, _i, _len, _ref, _ref1, _results;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (!args.length) {
        args = ['in'];
      }
      ips = this.get.apply(this, args);
      if (args.length === 1) {
        return (_ref = ips != null ? ips.data : void 0) != null ? _ref : void 0;
      }
      _results = [];
      for (_i = 0, _len = ips.length; _i < _len; _i++) {
        ip = ips[_i];
        _results.push((_ref1 = ip != null ? ip.data : void 0) != null ? _ref1 : void 0);
      }
      return _results;
    };

    ProcessInput.prototype.hasDataStream = function(port) {
      var packet, received, _i, _len, _ref;
      if (this.nodeInstance.fullOutputQ.length === 0) {
        return false;
      }
      received = 0;
      _ref = this.nodeInstance.fullOutputQ;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        packet = _ref[_i];
        if (packet.type === 'openBracket') {
          ++received;
        } else if (packet.type === 'closeBracket') {
          --received;
        }
      }
      if (received === 0) {
        this.nodeInstance.fullOutputQ = [];
        return true;
      }
      return false;
    };

    ProcessInput.prototype.getDataStream = function(port) {
      return this.buffer.get(port).map(function(ip) {
        return ip.data;
      });
    };

    ProcessInput.prototype.hasStream = function(port) {
      var buffer, packet, received, _i, _len;
      buffer = this.buffer.get(port);
      if (buffer.length === 0) {
        return false;
      }
      received = 0;
      for (_i = 0, _len = buffer.length; _i < _len; _i++) {
        packet = buffer[_i];
        if (packet.type === 'openBracket') {
          ++received;
        } else if (packet.type === 'closeBracket') {
          --received;
        }
      }
      return received === 0;
    };

    ProcessInput.prototype.getStream = function(port, withoutConnectAndDisconnect) {
      var buf;
      if (withoutConnectAndDisconnect == null) {
        withoutConnectAndDisconnect = false;
      }
      buf = this.buffer.get(port);
      this.buffer.filter(port, function(ip) {
        return false;
      });
      if (withoutConnectAndDisconnect) {
        buf = buf.slice(1);
        buf.pop();
      }
      return buf;
    };

    return ProcessInput;

  })();

  PortBuffer = (function() {
    function PortBuffer(context) {
      this.context = context;
    }

    PortBuffer.prototype.set = function(name, buffer) {
      if ((name != null) && typeof name !== 'string') {
        buffer = name;
        name = null;
      }
      if (this.context.scope != null) {
        if (name != null) {
          this.context.ports[name].scopedBuffer[this.context.scope] = buffer;
          return this.context.ports[name].scopedBuffer[this.context.scope];
        }
        this.context.port.scopedBuffer[this.context.scope] = buffer;
        return this.context.port.scopedBuffer[this.context.scope];
      }
      if (name != null) {
        this.context.ports[name].buffer = buffer;
        return this.context.ports[name].buffer;
      }
      this.context.port.buffer = buffer;
      return this.context.port.buffer;
    };

    PortBuffer.prototype.get = function(name) {
      if (name == null) {
        name = null;
      }
      if (this.context.scope != null) {
        if (name != null) {
          return this.context.ports[name].scopedBuffer[this.context.scope];
        }
        return this.context.port.scopedBuffer[this.context.scope];
      }
      if (name != null) {
        return this.context.ports[name].buffer;
      }
      return this.context.port.buffer;
    };

    PortBuffer.prototype.find = function(name, cb) {
      var b;
      b = this.get(name);
      return b.filter(cb);
    };

    PortBuffer.prototype.filter = function(name, cb) {
      var b;
      if ((name != null) && typeof name !== 'string') {
        cb = name;
        name = null;
      }
      b = this.get(name);
      b = b.filter(cb);
      return this.set(name, b);
    };

    return PortBuffer;

  })();

  ProcessOutput = (function() {
    function ProcessOutput(ports, ip, nodeInstance, result) {
      this.ports = ports;
      this.ip = ip;
      this.nodeInstance = nodeInstance;
      this.result = result;
      this.scope = this.ip.scope;
    }

    ProcessOutput.prototype.activate = function() {
      this.result.__resolved = false;
      if (this.nodeInstance.ordered || this.nodeInstance.autoOrdering) {
        return this.nodeInstance.outputQ.push(this.result);
      }
    };

    ProcessOutput.prototype.isError = function(err) {
      return err instanceof Error || Array.isArray(err) && err.length > 0 && err[0] instanceof Error;
    };

    ProcessOutput.prototype.error = function(err) {
      var e, multiple, _i, _j, _len, _len1, _results;
      multiple = Array.isArray(err);
      if (!multiple) {
        err = [err];
      }
      if ('error' in this.ports && (this.ports.error.isAttached() || !this.ports.error.isRequired())) {
        if (multiple) {
          this.sendIP('error', new IP('openBracket'));
        }
        for (_i = 0, _len = err.length; _i < _len; _i++) {
          e = err[_i];
          this.sendIP('error', e);
        }
        if (multiple) {
          return this.sendIP('error', new IP('closeBracket'));
        }
      } else {
        _results = [];
        for (_j = 0, _len1 = err.length; _j < _len1; _j++) {
          e = err[_j];
          throw e;
        }
        return _results;
      }
    };

    ProcessOutput.prototype.sendIP = function(port, packet) {
      var ip;
      if (typeof packet !== 'object' || IP.types.indexOf(packet.type) === -1) {
        ip = new IP('data', packet);
      } else {
        ip = packet;
      }
      if (this.scope !== null && ip.scope === null) {
        ip.scope = this.scope;
      }
      if (this.nodeInstance.ordered || this.nodeInstance.autoOrdering) {
        if (!(port in this.result)) {
          this.result[port] = [];
        }
        return this.result[port].push(ip);
      } else {
        return this.nodeInstance.outPorts[port].sendIP(ip);
      }
    };

    ProcessOutput.prototype.send = function(outputMap) {
      var componentPorts, mapIsInPorts, packet, port, _i, _len, _ref, _results;
      if ((this.nodeInstance.ordered || this.nodeInstance.autoOrdering) && !('__resolved' in this.result)) {
        this.activate();
      }
      if (this.isError(outputMap)) {
        return this.error(outputMap);
      }
      componentPorts = [];
      mapIsInPorts = false;
      _ref = Object.keys(this.ports.ports);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        port = _ref[_i];
        if (port !== 'error' && port !== 'ports' && port !== '_callbacks') {
          componentPorts.push(port);
        }
        if (!mapIsInPorts && typeof outputMap === 'object' && Object.keys(outputMap).indexOf(port) !== -1) {
          mapIsInPorts = true;
        }
      }
      if (componentPorts.length === 1 && !mapIsInPorts) {
        this.sendIP(componentPorts[0], outputMap);
        return;
      }
      _results = [];
      for (port in outputMap) {
        packet = outputMap[port];
        _results.push(this.sendIP(port, packet));
      }
      return _results;
    };

    ProcessOutput.prototype.sendDone = function(outputMap) {
      this.send(outputMap);
      return this.done();
    };

    ProcessOutput.prototype.pass = function(data, options) {
      var key, val;
      if (options == null) {
        options = {};
      }
      if (!('out' in this.ports)) {
        throw new Error('output.pass() requires port "out" to be present');
      }
      for (key in options) {
        val = options[key];
        this.ip[key] = val;
      }
      this.ip.data = data;
      this.sendIP('out', this.ip);
      return this.done();
    };

    ProcessOutput.prototype.done = function(error) {
      if (error) {
        this.error(error);
      }
      if (this.nodeInstance.ordered || this.nodeInstance.autoOrdering) {
        this.result.__resolved = true;
        this.nodeInstance.processOutputQueue();
      }
      return this.nodeInstance.load--;
    };

    return ProcessOutput;

  })();

}).call(this);
