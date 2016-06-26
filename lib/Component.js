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
      this.activateOnInput = (_ref2 = options.activateOnInput) != null ? _ref2 : true;
      this.forwardBracketsFrom = ['in'];
      this.forwardBracketsTo = ['out', 'error'];
      this.bracketCounter = {};
      this.bracketBuffer = {};
      this.fwdBracketCounter = {};
      if ('forwardBracketsFrom' in options) {
        this.forwardBracketsFrom = options.forwardBracketsFrom;
      }
      if ('forwardBracketsTo' in options) {
        this.forwardBracketsTo = options.forwardBracketsTo;
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
      var inPort, p, _i, _len, _ref;
      this.forwardBracketsFrom = (function() {
        var _i, _len, _ref, _results;
        _ref = this.forwardBracketsFrom;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          p = _ref[_i];
          if (p in this.inPorts.ports) {
            _results.push(p);
          }
        }
        return _results;
      }).call(this);
      _ref = this.forwardBracketsFrom;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        inPort = _ref[_i];
        this.bracketCounter[inPort] = 0;
      }
      return this.forwardBracketsTo = (function() {
        var _j, _len1, _ref1, _results;
        _ref1 = this.forwardBracketsTo;
        _results = [];
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          p = _ref1[_j];
          if (p in this.outPorts.ports) {
            _results.push(p);
          }
        }
        return _results;
      }).call(this);
    };

    Component.prototype.incFwdCounter = function(scope, port) {
      if (!(scope in this.fwdBracketCounter)) {
        this.fwdBracketCounter[scope] = {};
      }
      if (!(port in this.fwdBracketCounter[scope])) {
        this.fwdBracketCounter[scope][port] = 0;
      }
      return this.fwdBracketCounter[scope][port]++;
    };

    Component.prototype.decFwdCounter = function(scope, port) {
      var _ref;
      if (!((_ref = this.fwdBracketCounter[scope]) != null ? _ref[port] : void 0)) {
        return;
      }
      this.fwdBracketCounter[scope][port]--;
      if (this.fwdBracketCounter[scope][port] === 0) {
        delete this.fwdBracketCounter[scope][port];
      }
      if (Object.keys(this.fwdBracketCounter[scope]).length === 0) {
        return delete this.fwdBracketCounter[scope];
      }
    };

    Component.prototype.getFwdCounter = function(scope, port) {
      var _ref;
      if (!((_ref = this.fwdBracketCounter[scope]) != null ? _ref[port] : void 0)) {
        return 0;
      }
      return this.fwdBracketCounter[scope][port];
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
      var count, input, outPort, output, outputEntry, result, _ref;
      if (ip.type === 'openBracket') {
        if (this.autoOrdering === null) {
          this.autoOrdering = true;
        }
        this.bracketCounter[port.name]++;
      }
      if (this.forwardBracketsFrom.indexOf(port.name) !== -1 && (ip.type === 'openBracket' || ip.type === 'closeBracket')) {
        if (!(ip.scope in this.bracketBuffer)) {
          this.bracketBuffer[ip.scope] = [];
        }
        if (ip.type === 'closeBracket' && this.bracketBuffer[ip.scope].length === 0) {
          outputEntry = {
            __resolved: true
          };
          _ref = this.fwdBracketCounter[ip.scope];
          for (outPort in _ref) {
            count = _ref[outPort];
            if (count > 0) {
              if (!(outPort in outputEntry)) {
                outputEntry[outPort] = [];
              }
              outputEntry[outPort].push(ip);
              this.decFwdCounter(ip.scope, outPort);
            }
          }
          if (Object.keys(outputEntry).length > 1) {
            this.outputQ.push(outputEntry);
            this.processOutputQueue();
          }
        } else {
          this.bracketBuffer[ip.scope].push(ip);
        }
        if (ip.scope != null) {
          port.scopedBuffer[ip.scope].pop();
        } else {
          port.buffer.pop();
        }
        return;
      }
      if (!port.options.triggering) {
        return;
      }
      result = {};
      input = new ProcessInput(this.inPorts, ip, this, port, result);
      output = new ProcessOutput(this.outPorts, ip, this, result);
      this.load++;
      return this.handle(input, output, function() {
        return output.done();
      });
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
      this.bracketsToForward = null;
      this.forwardedBracketsTo = [];
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
          this.send({
            error: new IP('openBracket')
          });
        }
        for (_i = 0, _len = err.length; _i < _len; _i++) {
          e = err[_i];
          this.send({
            error: e
          });
        }
        if (multiple) {
          return this.send({
            error: new IP('closeBracket')
          });
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

    ProcessOutput.prototype.prepareOpenBrackets = function() {
      var hasOpening, ip, _ref, _results;
      this.bracketsToForward = [];
      hasOpening = false;
      _results = [];
      while (((_ref = this.nodeInstance.bracketBuffer[this.scope]) != null ? _ref.length : void 0) > 0) {
        ip = this.nodeInstance.bracketBuffer[this.scope][0];
        if (ip.type === 'openBracket') {
          this.bracketsToForward.push(this.nodeInstance.bracketBuffer[this.scope].shift());
          _results.push(hasOpening = true);
        } else {
          if (hasOpening) {
            break;
          }
          _results.push(this.bracketsToForward.push(this.nodeInstance.bracketBuffer[this.scope].shift()));
        }
      }
      return _results;
    };

    ProcessOutput.prototype.prepareCloseBrackets = function() {
      var ip, _ref, _results;
      this.bracketsToForward = [];
      _results = [];
      while (((_ref = this.nodeInstance.bracketBuffer[this.scope]) != null ? _ref.length : void 0) > 0) {
        ip = this.nodeInstance.bracketBuffer[this.scope][0];
        if (ip.type === 'closeBracket') {
          _results.push(this.bracketsToForward.push(this.nodeInstance.bracketBuffer[this.scope].shift()));
        } else {
          break;
        }
      }
      return _results;
    };

    ProcessOutput.prototype.send = function(outputMap) {
      var componentPorts, ip, mapIsInPorts, packet, port, _i, _j, _len, _len1, _ref, _ref1, _results;
      if (!this.bracketsToForward) {
        this.prepareOpenBrackets();
      }
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
        ip = outputMap;
        outputMap = {};
        outputMap[componentPorts[0]] = ip;
      }
      _results = [];
      for (port in outputMap) {
        packet = outputMap[port];
        if (this.nodeInstance.forwardBracketsTo.indexOf(port) !== -1 && this.forwardedBracketsTo.indexOf(port) === -1) {
          _ref1 = this.bracketsToForward;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            ip = _ref1[_j];
            this.sendIP(port, ip);
            if (ip.type === 'openBracket') {
              this.nodeInstance.incFwdCounter(ip.scope, port);
            } else {
              this.nodeInstance.decFwdCounter(ip.scope, port);
            }
          }
          this.forwardedBracketsTo.push(port);
        }
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
      return this.sendDone({
        out: this.ip
      });
    };

    ProcessOutput.prototype.done = function(error) {
      var ip, port, _i, _j, _len, _len1, _ref, _ref1;
      if (error) {
        this.error(error);
      }
      this.prepareCloseBrackets();
      if (this.bracketsToForward.length > 0) {
        _ref = this.forwardedBracketsTo;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          port = _ref[_i];
          _ref1 = this.bracketsToForward;
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            ip = _ref1[_j];
            this.sendIP(port, ip);
            if (ip.type === 'openBracket') {
              this.nodeInstance.incFwdCounter(ip.scope, port);
            } else {
              this.nodeInstance.decFwdCounter(ip.scope, port);
            }
          }
        }
        this.forwardedBracketsTo = [];
      }
      this.bracketsToForward = null;
      if (this.nodeInstance.ordered || this.nodeInstance.autoOrdering) {
        this.result.__resolved = true;
        this.nodeInstance.processOutputQueue();
      }
      return this.nodeInstance.load--;
    };

    return ProcessOutput;

  })();

}).call(this);
