(function() {
  var Graph, noflo,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  noflo = require("../lib/NoFlo");

  Graph = (function(_super) {
    __extends(Graph, _super);

    function Graph(metadata) {
      this.metadata = metadata;
      this.network = null;
      this.ready = true;
      this.started = false;
      this.baseDir = null;
      this.loader = null;
      this.inPorts = new noflo.InPorts({
        graph: {
          datatype: 'all',
          description: 'NoFlo graph definition to be used with the subgraph component',
          required: true,
          immediate: true
        }
      });
      this.outPorts = new noflo.OutPorts;
      this.inPorts.on('graph', 'data', (function(_this) {
        return function(data) {
          return _this.setGraph(data);
        };
      })(this));
    }

    Graph.prototype.setGraph = function(graph) {
      this.ready = false;
      if (typeof graph === 'object') {
        if (typeof graph.addNode === 'function') {
          return this.createNetwork(graph, (function(_this) {
            return function(err) {
              if (err) {
                return _this.error(err);
              }
            };
          })(this));
        }
        noflo.graph.loadJSON(graph, (function(_this) {
          return function(err, instance) {
            if (err) {
              return _this.error(err);
            }
            instance.baseDir = _this.baseDir;
            return _this.createNetwork(instance, function(err) {
              if (err) {
                return _this.error(err);
              }
            });
          };
        })(this));
        return;
      }
      if (graph.substr(0, 1) !== "/" && graph.substr(1, 1) !== ":" && process && process.cwd) {
        graph = "" + (process.cwd()) + "/" + graph;
      }
      return graph = noflo.graph.loadFile(graph, (function(_this) {
        return function(err, instance) {
          if (err) {
            return _this.error(err);
          }
          instance.baseDir = _this.baseDir;
          return _this.createNetwork(instance, function(err) {
            if (err) {
              return _this.error(err);
            }
          });
        };
      })(this));
    };

    Graph.prototype.createNetwork = function(graph) {
      this.description = graph.properties.description || '';
      this.icon = graph.properties.icon || this.icon;
      graph.componentLoader = this.loader;
      return noflo.createNetwork(graph, (function(_this) {
        return function(err, network) {
          _this.network = network;
          if (err) {
            return _this.error(err);
          }
          _this.emit('network', _this.network);
          return _this.network.connect(function(err) {
            var name, node, notReady, _ref;
            if (err) {
              return _this.error(err);
            }
            notReady = false;
            _ref = _this.network.processes;
            for (name in _ref) {
              node = _ref[name];
              if (!_this.checkComponent(name, node)) {
                notReady = true;
              }
            }
            if (!notReady) {
              return _this.setToReady();
            }
          });
        };
      })(this), true);
    };

    Graph.prototype.start = function(callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this.isReady()) {
        this.on('ready', (function(_this) {
          return function() {
            return _this.start(callback);
          };
        })(this));
        return;
      }
      if (!this.network) {
        return callback(null);
      }
      return this.network.start((function(_this) {
        return function(err) {
          if (err) {
            return callback(err);
          }
          return _this.started = true;
        };
      })(this));
    };

    Graph.prototype.checkComponent = function(name, process) {
      if (!process.component.isReady()) {
        process.component.once("ready", (function(_this) {
          return function() {
            _this.checkComponent(name, process);
            return _this.setToReady();
          };
        })(this));
        return false;
      }
      this.findEdgePorts(name, process);
      return true;
    };

    Graph.prototype.isExportedInport = function(port, nodeName, portName) {
      var exported, priv, pub, _i, _len, _ref, _ref1;
      _ref = this.network.graph.inports;
      for (pub in _ref) {
        priv = _ref[pub];
        if (!(priv.process === nodeName && priv.port === portName)) {
          continue;
        }
        return pub;
      }
      _ref1 = this.network.graph.exports;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        exported = _ref1[_i];
        if (!(exported.process === nodeName && exported.port === portName)) {
          continue;
        }
        this.network.graph.checkTransactionStart();
        this.network.graph.removeExport(exported["public"]);
        this.network.graph.addInport(exported["public"], exported.process, exported.port, exported.metadata);
        this.network.graph.checkTransactionEnd();
        return exported["public"];
      }
      return false;
    };

    Graph.prototype.isExportedOutport = function(port, nodeName, portName) {
      var exported, priv, pub, _i, _len, _ref, _ref1;
      _ref = this.network.graph.outports;
      for (pub in _ref) {
        priv = _ref[pub];
        if (!(priv.process === nodeName && priv.port === portName)) {
          continue;
        }
        return pub;
      }
      _ref1 = this.network.graph.exports;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        exported = _ref1[_i];
        if (!(exported.process === nodeName && exported.port === portName)) {
          continue;
        }
        this.network.graph.checkTransactionStart();
        this.network.graph.removeExport(exported["public"]);
        this.network.graph.addOutport(exported["public"], exported.process, exported.port, exported.metadata);
        this.network.graph.checkTransactionEnd();
        return exported["public"];
      }
      return false;
    };

    Graph.prototype.setToReady = function() {
      if (typeof process !== 'undefined' && process.execPath && process.execPath.indexOf('node') !== -1) {
        return process.nextTick((function(_this) {
          return function() {
            _this.ready = true;
            return _this.emit('ready');
          };
        })(this));
      } else {
        return setTimeout((function(_this) {
          return function() {
            _this.ready = true;
            return _this.emit('ready');
          };
        })(this), 0);
      }
    };

    Graph.prototype.findEdgePorts = function(name, process) {
      var inPorts, outPorts, port, portName, targetPortName;
      inPorts = process.component.inPorts.ports || process.component.inPorts;
      outPorts = process.component.outPorts.ports || process.component.outPorts;
      for (portName in inPorts) {
        port = inPorts[portName];
        targetPortName = this.isExportedInport(port, name, portName);
        if (targetPortName === false) {
          continue;
        }
        this.inPorts.add(targetPortName, port);
        this.inPorts[targetPortName].once('connect', (function(_this) {
          return function() {
            if (_this.isStarted()) {
              return;
            }
            return _this.start();
          };
        })(this));
      }
      for (portName in outPorts) {
        port = outPorts[portName];
        targetPortName = this.isExportedOutport(port, name, portName);
        if (targetPortName === false) {
          continue;
        }
        this.outPorts.add(targetPortName, port);
      }
      return true;
    };

    Graph.prototype.isReady = function() {
      return this.ready;
    };

    Graph.prototype.isSubgraph = function() {
      return true;
    };

    Graph.prototype.shutdown = function(callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this.network) {
        return callback(null);
      }
      return this.network.stop(callback);
    };

    return Graph;

  })(noflo.Component);

  exports.getComponent = function(metadata) {
    return new Graph(metadata);
  };

}).call(this);
