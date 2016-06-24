(function() {
  var InternalSocket, OutPortWrapper, StreamReceiver, StreamSender, isArray, platform, _,
    __hasProp = {}.hasOwnProperty;

  _ = require('underscore');

  StreamSender = require('./Streams').StreamSender;

  StreamReceiver = require('./Streams').StreamReceiver;

  InternalSocket = require('./InternalSocket');

  platform = require('./Platform');

  isArray = function(obj) {
    if (Array.isArray) {
      return Array.isArray(obj);
    }
    return Object.prototype.toString.call(arg) === '[object Array]';
  };

  exports.MapComponent = function(component, func, config) {
    var groups, inPort, outPort;
    platform.deprecated('noflo.helpers.MapComponent is deprecated. Please port Process API');
    if (!config) {
      config = {};
    }
    if (!config.inPort) {
      config.inPort = 'in';
    }
    if (!config.outPort) {
      config.outPort = 'out';
    }
    inPort = component.inPorts[config.inPort];
    outPort = component.outPorts[config.outPort];
    groups = [];
    return inPort.process = function(event, payload) {
      switch (event) {
        case 'connect':
          return outPort.connect();
        case 'begingroup':
          groups.push(payload);
          return outPort.beginGroup(payload);
        case 'data':
          return func(payload, groups, outPort);
        case 'endgroup':
          groups.pop();
          return outPort.endGroup();
        case 'disconnect':
          groups = [];
          return outPort.disconnect();
      }
    };
  };

  OutPortWrapper = (function() {
    function OutPortWrapper(port, scope) {
      this.port = port;
      this.scope = scope;
    }

    OutPortWrapper.prototype.connect = function(socketId) {
      if (socketId == null) {
        socketId = null;
      }
      return this.port.openBracket(null, {
        scope: this.scope
      }, socketId);
    };

    OutPortWrapper.prototype.beginGroup = function(group, socketId) {
      if (socketId == null) {
        socketId = null;
      }
      return this.port.openBracket(group, {
        scope: this.scope
      }, socketId);
    };

    OutPortWrapper.prototype.send = function(data, socketId) {
      if (socketId == null) {
        socketId = null;
      }
      return this.port.sendIP('data', data, {
        scope: this.scope
      }, socketId, false);
    };

    OutPortWrapper.prototype.endGroup = function(socketId) {
      if (socketId == null) {
        socketId = null;
      }
      return this.port.closeBracket(null, {
        scope: this.scope
      }, socketId);
    };

    OutPortWrapper.prototype.disconnect = function(socketId) {
      if (socketId == null) {
        socketId = null;
      }
      return this.endGroup(socketId);
    };

    OutPortWrapper.prototype.isConnected = function() {
      return this.port.isConnected();
    };

    OutPortWrapper.prototype.isAttached = function() {
      return this.port.isAttached();
    };

    return OutPortWrapper;

  })();

  exports.WirePattern = function(component, config, proc) {
    var baseShutdown, closeGroupOnOuts, collectGroups, disconnectOuts, gc, inPorts, name, outPorts, port, processQueue, resumeTaskQ, sendGroupToOuts, setParamsScope, _fn, _fn1, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _ref, _ref1, _wp;
    inPorts = 'in' in config ? config["in"] : 'in';
    if (!isArray(inPorts)) {
      inPorts = [inPorts];
    }
    outPorts = 'out' in config ? config.out : 'out';
    if (!isArray(outPorts)) {
      outPorts = [outPorts];
    }
    if (!('error' in config)) {
      config.error = 'error';
    }
    if (!('async' in config)) {
      config.async = false;
    }
    if (!('ordered' in config)) {
      config.ordered = true;
    }
    if (!('group' in config)) {
      config.group = false;
    }
    if (!('field' in config)) {
      config.field = null;
    }
    if (!('forwardGroups' in config)) {
      config.forwardGroups = false;
    }
    if (!('receiveStreams' in config)) {
      config.receiveStreams = false;
    }
    if (config.receiveStreams) {
      throw new Error('WirePattern receiveStreams is deprecated');
    }
    if (!('sendStreams' in config)) {
      config.sendStreams = false;
    }
    if (config.sendStreams) {
      throw new Error('WirePattern sendStreams is deprecated');
    }
    if (config.async) {
      config.sendStreams = outPorts;
    }
    if (!('params' in config)) {
      config.params = [];
    }
    if (typeof config.params === 'string') {
      config.params = [config.params];
    }
    if (!('name' in config)) {
      config.name = '';
    }
    if (!('dropInput' in config)) {
      config.dropInput = false;
    }
    if (!('arrayPolicy' in config)) {
      config.arrayPolicy = {
        "in": 'any',
        params: 'all'
      };
    }
    if (!('gcFrequency' in config)) {
      config.gcFrequency = 100;
    }
    if (!('gcTimeout' in config)) {
      config.gcTimeout = 300;
    }
    collectGroups = config.forwardGroups;
    if (typeof collectGroups === 'boolean' && !config.group) {
      collectGroups = inPorts;
    }
    if (typeof collectGroups === 'string' && !config.group) {
      collectGroups = [collectGroups];
    }
    if (collectGroups !== false && config.group) {
      collectGroups = true;
    }
    for (_i = 0, _len = inPorts.length; _i < _len; _i++) {
      name = inPorts[_i];
      if (!component.inPorts[name]) {
        throw new Error("no inPort named '" + name + "'");
      }
    }
    for (_j = 0, _len1 = outPorts.length; _j < _len1; _j++) {
      name = outPorts[_j];
      if (!component.outPorts[name]) {
        throw new Error("no outPort named '" + name + "'");
      }
    }
    disconnectOuts = function() {
      var p, _k, _len2, _results;
      _results = [];
      for (_k = 0, _len2 = outPorts.length; _k < _len2; _k++) {
        p = outPorts[_k];
        if (component.outPorts[p].isConnected()) {
          _results.push(component.outPorts[p].disconnect());
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };
    sendGroupToOuts = function(grp) {
      var p, _k, _len2, _results;
      _results = [];
      for (_k = 0, _len2 = outPorts.length; _k < _len2; _k++) {
        p = outPorts[_k];
        _results.push(component.outPorts[p].beginGroup(grp));
      }
      return _results;
    };
    closeGroupOnOuts = function(grp) {
      var p, _k, _len2, _results;
      _results = [];
      for (_k = 0, _len2 = outPorts.length; _k < _len2; _k++) {
        p = outPorts[_k];
        _results.push(component.outPorts[p].endGroup(grp));
      }
      return _results;
    };
    component.requiredParams = [];
    component.defaultedParams = [];
    component.gcCounter = 0;
    component._wpData = {};
    _wp = function(scope) {
      if (!(scope in component._wpData)) {
        component._wpData[scope] = {};
        component._wpData[scope].groupedData = {};
        component._wpData[scope].groupedGroups = {};
        component._wpData[scope].groupedDisconnects = {};
        component._wpData[scope].outputQ = [];
        component._wpData[scope].taskQ = [];
        component._wpData[scope].params = {};
        component._wpData[scope].completeParams = [];
        component._wpData[scope].receivedParams = [];
        component._wpData[scope].defaultsSent = false;
        component._wpData[scope].disconnectData = {};
        component._wpData[scope].disconnectQ = [];
        component._wpData[scope].groupBuffers = {};
        component._wpData[scope].keyBuffers = {};
        component._wpData[scope].gcTimestamps = {};
      }
      return component._wpData[scope];
    };
    component.params = {};
    setParamsScope = function(scope) {
      return component.params = _wp(scope).params;
    };
    processQueue = function(scope) {
      var flushed, key, stream, streams, tmp;
      while (_wp(scope).outputQ.length > 0) {
        streams = _wp(scope).outputQ[0];
        flushed = false;
        if (streams === null) {
          disconnectOuts();
          flushed = true;
        } else {
          if (outPorts.length === 1) {
            tmp = {};
            tmp[outPorts[0]] = streams;
            streams = tmp;
          }
          for (key in streams) {
            stream = streams[key];
            if (stream.resolved) {
              stream.flush();
              flushed = true;
            }
          }
        }
        if (flushed) {
          _wp(scope).outputQ.shift();
        }
        if (!flushed) {
          return;
        }
      }
    };
    if (config.async) {
      if ('load' in component.outPorts) {
        component.load = 0;
      }
      component.beforeProcess = function(scope, outs) {
        if (config.ordered) {
          _wp(scope).outputQ.push(outs);
        }
        component.load++;
        if ('load' in component.outPorts && component.outPorts.load.isAttached()) {
          component.outPorts.load.send(component.load);
          return component.outPorts.load.disconnect();
        }
      };
      component.afterProcess = function(scope, err, outs) {
        processQueue(scope);
        component.load--;
        if ('load' in component.outPorts && component.outPorts.load.isAttached()) {
          component.outPorts.load.send(component.load);
          return component.outPorts.load.disconnect();
        }
      };
    }
    component.sendDefaults = function(scope) {
      var param, tempSocket, _k, _len2, _ref;
      if (component.defaultedParams.length > 0) {
        _ref = component.defaultedParams;
        for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
          param = _ref[_k];
          if (_wp(scope).receivedParams.indexOf(param) === -1) {
            tempSocket = InternalSocket.createSocket();
            component.inPorts[param].attach(tempSocket);
            tempSocket.send();
            tempSocket.disconnect();
            component.inPorts[param].detach(tempSocket);
          }
        }
      }
      return _wp(scope).defaultsSent = true;
    };
    resumeTaskQ = function(scope) {
      var task, temp, _results;
      if (_wp(scope).completeParams.length === component.requiredParams.length && _wp(scope).taskQ.length > 0) {
        temp = _wp(scope).taskQ.slice(0);
        _wp(scope).taskQ = [];
        _results = [];
        while (temp.length > 0) {
          task = temp.shift();
          _results.push(task());
        }
        return _results;
      }
    };
    _ref = config.params;
    for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
      port = _ref[_k];
      if (!component.inPorts[port]) {
        throw new Error("no inPort named '" + port + "'");
      }
      if (component.inPorts[port].isRequired()) {
        component.requiredParams.push(port);
      }
      if (component.inPorts[port].hasDefault()) {
        component.defaultedParams.push(port);
      }
    }
    _ref1 = config.params;
    _fn = function(port) {
      var inPort;
      inPort = component.inPorts[port];
      return inPort.handle = function(ip) {
        var event, index, payload, scope;
        event = ip.type;
        payload = ip.data;
        scope = ip.scope;
        index = ip.index;
        if (event !== 'data') {
          return;
        }
        if (inPort.isAddressable()) {
          if (!(port in _wp(scope).params)) {
            _wp(scope).params[port] = {};
          }
          _wp(scope).params[port][index] = payload;
          if (config.arrayPolicy.params === 'all' && Object.keys(_wp(scope).params[port]).length < inPort.listAttached().length) {
            return;
          }
        } else {
          _wp(scope).params[port] = payload;
        }
        if (_wp(scope).completeParams.indexOf(port) === -1 && component.requiredParams.indexOf(port) > -1) {
          _wp(scope).completeParams.push(port);
        }
        _wp(scope).receivedParams.push(port);
        return resumeTaskQ(scope);
      };
    };
    for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
      port = _ref1[_l];
      _fn(port);
    }
    component.dropRequest = function(scope, key) {
      if (key in _wp(scope).disconnectData) {
        delete _wp(scope).disconnectData[key];
      }
      if (key in _wp(scope).groupedData) {
        delete _wp(scope).groupedData[key];
      }
      if (key in _wp(scope).groupedGroups) {
        return delete _wp(scope).groupedGroups[key];
      }
    };
    gc = function() {
      var current, key, scope, val, _len4, _m, _ref2, _results;
      component.gcCounter++;
      if (component.gcCounter % config.gcFrequency === 0) {
        _ref2 = Object.keys(component._wpData);
        _results = [];
        for (_m = 0, _len4 = _ref2.length; _m < _len4; _m++) {
          scope = _ref2[_m];
          current = new Date().getTime();
          _results.push((function() {
            var _ref3, _results1;
            _ref3 = _wp(scope).gcTimestamps;
            _results1 = [];
            for (key in _ref3) {
              val = _ref3[key];
              if ((current - val) > (config.gcTimeout * 1000)) {
                component.dropRequest(scope, key);
                _results1.push(delete _wp(scope).gcTimestamps[key]);
              } else {
                _results1.push(void 0);
              }
            }
            return _results1;
          })());
        }
        return _results;
      }
    };
    _fn1 = function(port) {
      var inPort, needPortGroups;
      inPort = component.inPorts[port];
      needPortGroups = collectGroups instanceof Array && collectGroups.indexOf(port) !== -1;
      return inPort.handle = function(ip) {
        var data, foundGroup, g, groupLength, groups, grp, i, index, key, obj, out, outs, payload, postpone, postponedToQ, reqId, requiredLength, resume, scope, task, tmp, whenDone, whenDoneGroups, wrp, _len5, _len6, _len7, _len8, _n, _o, _p, _q, _r, _ref2, _ref3, _ref4, _s;
        index = ip.index;
        payload = ip.data;
        scope = ip.scope;
        if (!(port in _wp(scope).groupBuffers)) {
          _wp(scope).groupBuffers[port] = [];
        }
        if (!(port in _wp(scope).keyBuffers)) {
          _wp(scope).keyBuffers[port] = null;
        }
        switch (ip.type) {
          case 'openBracket':
            if (payload === null) {
              return;
            }
            _wp(scope).groupBuffers[port].push(payload);
            if (config.forwardGroups && (collectGroups === true || needPortGroups) && !config.async) {
              return sendGroupToOuts(payload);
            }
            break;
          case 'closeBracket':
            _wp(scope).groupBuffers[port] = _wp(scope).groupBuffers[port].slice(0, _wp(scope).groupBuffers[port].length - 1);
            if (config.forwardGroups && (collectGroups === true || needPortGroups) && !config.async) {
              closeGroupOnOuts(payload);
            }
            if (_wp(scope).groupBuffers[port].length === 0 && payload === null) {
              if (inPorts.length === 1) {
                if (config.async || config.StreamSender) {
                  if (config.ordered) {
                    _wp(scope).outputQ.push(null);
                    return processQueue(scope);
                  } else {
                    return _wp(scope).disconnectQ.push(true);
                  }
                } else {
                  return disconnectOuts();
                }
              } else {
                foundGroup = false;
                key = _wp(scope).keyBuffers[port];
                if (!(key in _wp(scope).disconnectData)) {
                  _wp(scope).disconnectData[key] = [];
                }
                for (i = _n = 0, _ref2 = _wp(scope).disconnectData[key].length; 0 <= _ref2 ? _n < _ref2 : _n > _ref2; i = 0 <= _ref2 ? ++_n : --_n) {
                  if (!(port in _wp(scope).disconnectData[key][i])) {
                    foundGroup = true;
                    _wp(scope).disconnectData[key][i][port] = true;
                    if (Object.keys(_wp(scope).disconnectData[key][i]).length === inPorts.length) {
                      _wp(scope).disconnectData[key].shift();
                      if (config.async || config.StreamSender) {
                        if (config.ordered) {
                          _wp(scope).outputQ.push(null);
                          processQueue(scope);
                        } else {
                          _wp(scope).disconnectQ.push(true);
                        }
                      } else {
                        disconnectOuts();
                      }
                      if (_wp(scope).disconnectData[key].length === 0) {
                        delete _wp(scope).disconnectData[key];
                      }
                    }
                    break;
                  }
                }
                if (!foundGroup) {
                  obj = {};
                  obj[port] = true;
                  return _wp(scope).disconnectData[key].push(obj);
                }
              }
            }
            break;
          case 'data':
            if (inPorts.length === 1 && !inPort.isAddressable()) {
              data = payload;
              groups = _wp(scope).groupBuffers[port];
            } else {
              key = '';
              if (config.group && _wp(scope).groupBuffers[port].length > 0) {
                key = _wp(scope).groupBuffers[port].toString();
                if (config.group instanceof RegExp) {
                  reqId = null;
                  _ref3 = _wp(scope).groupBuffers[port];
                  for (_o = 0, _len5 = _ref3.length; _o < _len5; _o++) {
                    grp = _ref3[_o];
                    if (config.group.test(grp)) {
                      reqId = grp;
                      break;
                    }
                  }
                  key = reqId ? reqId : '';
                }
              } else if (config.field && typeof payload === 'object' && config.field in payload) {
                key = payload[config.field];
              }
              _wp(scope).keyBuffers[port] = key;
              if (!(key in _wp(scope).groupedData)) {
                _wp(scope).groupedData[key] = [];
              }
              if (!(key in _wp(scope).groupedGroups)) {
                _wp(scope).groupedGroups[key] = [];
              }
              foundGroup = false;
              requiredLength = inPorts.length;
              if (config.field) {
                ++requiredLength;
              }
              for (i = _p = 0, _ref4 = _wp(scope).groupedData[key].length; 0 <= _ref4 ? _p < _ref4 : _p > _ref4; i = 0 <= _ref4 ? ++_p : --_p) {
                if (!(port in _wp(scope).groupedData[key][i]) || (component.inPorts[port].isAddressable() && config.arrayPolicy["in"] === 'all' && !(index in _wp(scope).groupedData[key][i][port]))) {
                  foundGroup = true;
                  if (component.inPorts[port].isAddressable()) {
                    if (!(port in _wp(scope).groupedData[key][i])) {
                      _wp(scope).groupedData[key][i][port] = {};
                    }
                    _wp(scope).groupedData[key][i][port][index] = payload;
                  } else {
                    _wp(scope).groupedData[key][i][port] = payload;
                  }
                  if (needPortGroups) {
                    _wp(scope).groupedGroups[key][i] = _.union(_wp(scope).groupedGroups[key][i], _wp(scope).groupBuffers[port]);
                  } else if (collectGroups === true) {
                    _wp(scope).groupedGroups[key][i][port] = _wp(scope).groupBuffers[port];
                  }
                  if (component.inPorts[port].isAddressable() && config.arrayPolicy["in"] === 'all' && Object.keys(_wp(scope).groupedData[key][i][port]).length < component.inPorts[port].listAttached().length) {
                    return;
                  }
                  groupLength = Object.keys(_wp(scope).groupedData[key][i]).length;
                  if (groupLength === requiredLength) {
                    data = (_wp(scope).groupedData[key].splice(i, 1))[0];
                    if (inPorts.length === 1 && inPort.isAddressable()) {
                      data = data[port];
                    }
                    groups = (_wp(scope).groupedGroups[key].splice(i, 1))[0];
                    if (collectGroups === true) {
                      groups = _.intersection.apply(null, _.values(groups));
                    }
                    if (_wp(scope).groupedData[key].length === 0) {
                      delete _wp(scope).groupedData[key];
                    }
                    if (_wp(scope).groupedGroups[key].length === 0) {
                      delete _wp(scope).groupedGroups[key];
                    }
                    if (config.group && key) {
                      delete _wp(scope).gcTimestamps[key];
                    }
                    break;
                  } else {
                    return;
                  }
                }
              }
              if (!foundGroup) {
                obj = {};
                if (config.field) {
                  obj[config.field] = key;
                }
                if (component.inPorts[port].isAddressable()) {
                  obj[port] = {};
                  obj[port][index] = payload;
                } else {
                  obj[port] = payload;
                }
                if (inPorts.length === 1 && component.inPorts[port].isAddressable() && (config.arrayPolicy["in"] === 'any' || component.inPorts[port].listAttached().length === 1)) {
                  data = obj[port];
                  groups = _wp(scope).groupBuffers[port];
                } else {
                  _wp(scope).groupedData[key].push(obj);
                  if (needPortGroups) {
                    _wp(scope).groupedGroups[key].push(_wp(scope).groupBuffers[port]);
                  } else if (collectGroups === true) {
                    tmp = {};
                    tmp[port] = _wp(scope).groupBuffers[port];
                    _wp(scope).groupedGroups[key].push(tmp);
                  } else {
                    _wp(scope).groupedGroups[key].push([]);
                  }
                  if (config.group && key) {
                    _wp(scope).gcTimestamps[key] = new Date().getTime();
                  }
                  return;
                }
              }
            }
            if (config.dropInput && _wp(scope).completeParams.length !== component.requiredParams.length) {
              return;
            }
            outs = {};
            for (_q = 0, _len6 = outPorts.length; _q < _len6; _q++) {
              name = outPorts[_q];
              wrp = new OutPortWrapper(component.outPorts[name], scope);
              if (config.async || config.sendStreams && config.sendStreams.indexOf(name) !== -1) {
                wrp;
                outs[name] = new StreamSender(wrp, config.ordered);
              } else {
                outs[name] = wrp;
              }
            }
            if (outPorts.length === 1) {
              outs = outs[outPorts[0]];
            }
            if (!groups) {
              groups = [];
            }
            groups = (function() {
              var _len7, _r, _results;
              _results = [];
              for (_r = 0, _len7 = groups.length; _r < _len7; _r++) {
                g = groups[_r];
                if (g !== null) {
                  _results.push(g);
                }
              }
              return _results;
            })();
            whenDoneGroups = groups.slice(0);
            whenDone = function(err) {
              var disconnect, out, outputs, _len7, _r;
              if (err) {
                component.error(err, whenDoneGroups, 'error', scope);
              }
              if (typeof component.fail === 'function' && component.hasErrors) {
                component.fail(null, [], scope);
              }
              outputs = outs;
              if (outPorts.length === 1) {
                outputs = {};
                outputs[port] = outs;
              }
              disconnect = false;
              if (_wp(scope).disconnectQ.length > 0) {
                _wp(scope).disconnectQ.shift();
                disconnect = true;
              }
              for (name in outputs) {
                out = outputs[name];
                if (config.forwardGroups && config.async) {
                  for (_r = 0, _len7 = whenDoneGroups.length; _r < _len7; _r++) {
                    i = whenDoneGroups[_r];
                    out.endGroup();
                  }
                }
                if (disconnect) {
                  out.disconnect();
                }
                if (config.async || config.StreamSender) {
                  out.done();
                }
              }
              if (typeof component.afterProcess === 'function') {
                return component.afterProcess(scope, err || component.hasErrors, outs);
              }
            };
            if (typeof component.beforeProcess === 'function') {
              component.beforeProcess(scope, outs);
            }
            if (config.forwardGroups && config.async) {
              if (outPorts.length === 1) {
                for (_r = 0, _len7 = groups.length; _r < _len7; _r++) {
                  g = groups[_r];
                  outs.beginGroup(g);
                }
              } else {
                for (name in outs) {
                  out = outs[name];
                  for (_s = 0, _len8 = groups.length; _s < _len8; _s++) {
                    g = groups[_s];
                    out.beginGroup(g);
                  }
                }
              }
            }
            exports.MultiError(component, config.name, config.error, groups, scope);
            if (config.async) {
              postpone = function() {};
              resume = function() {};
              postponedToQ = false;
              task = function() {
                setParamsScope(scope);
                return proc.call(component, data, groups, outs, whenDone, postpone, resume, scope);
              };
              postpone = function(backToQueue) {
                if (backToQueue == null) {
                  backToQueue = true;
                }
                postponedToQ = backToQueue;
                if (backToQueue) {
                  return _wp(scope).taskQ.push(task);
                }
              };
              resume = function() {
                if (postponedToQ) {
                  return resumeTaskQ();
                } else {
                  return task();
                }
              };
            } else {
              task = function() {
                setParamsScope(scope);
                proc.call(component, data, groups, outs, null, null, null, scope);
                return whenDone();
              };
            }
            _wp(scope).taskQ.push(task);
            resumeTaskQ(scope);
            return gc();
        }
      };
    };
    for (_m = 0, _len4 = inPorts.length; _m < _len4; _m++) {
      port = inPorts[_m];
      _fn1(port);
    }
    baseShutdown = component.shutdown;
    component.shutdown = function() {
      baseShutdown.call(component);
      component.requiredParams = [];
      component.defaultedParams = [];
      component.gcCounter = 0;
      component._wpData = {};
      return component.params = {};
    };
    return component;
  };

  exports.GroupedInput = exports.WirePattern;

  exports.CustomError = function(message, options) {
    var err;
    err = new Error(message);
    return exports.CustomizeError(err, options);
  };

  exports.CustomizeError = function(err, options) {
    var key, val;
    for (key in options) {
      if (!__hasProp.call(options, key)) continue;
      val = options[key];
      err[key] = val;
    }
    return err;
  };

  exports.MultiError = function(component, group, errorPort, forwardedGroups, scope) {
    var baseShutdown;
    if (group == null) {
      group = '';
    }
    if (errorPort == null) {
      errorPort = 'error';
    }
    if (forwardedGroups == null) {
      forwardedGroups = [];
    }
    if (scope == null) {
      scope = null;
    }
    component.hasErrors = false;
    component.errors = [];
    if (component.name && !group) {
      group = component.name;
    }
    if (!group) {
      group = 'Component';
    }
    component.error = function(e, groups) {
      if (groups == null) {
        groups = [];
      }
      component.errors.push({
        err: e,
        groups: forwardedGroups.concat(groups)
      });
      return component.hasErrors = true;
    };
    component.fail = function(e, groups) {
      var error, grp, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
      if (e == null) {
        e = null;
      }
      if (groups == null) {
        groups = [];
      }
      if (e) {
        component.error(e, groups);
      }
      if (!component.hasErrors) {
        return;
      }
      if (!(errorPort in component.outPorts)) {
        return;
      }
      if (!component.outPorts[errorPort].isAttached()) {
        return;
      }
      if (group) {
        component.outPorts[errorPort].openBracket(group, {
          scope: scope
        });
      }
      _ref = component.errors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        error = _ref[_i];
        _ref1 = error.groups;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          grp = _ref1[_j];
          component.outPorts[errorPort].openBracket(grp, {
            scope: scope
          });
        }
        component.outPorts[errorPort].data(error.err, {
          scope: scope
        });
        _ref2 = error.groups;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          grp = _ref2[_k];
          component.outPorts[errorPort].closeBracket(grp, {
            scope: scope
          });
        }
      }
      if (group) {
        component.outPorts[errorPort].closeBracket(group, {
          scope: scope
        });
      }
      component.hasErrors = false;
      return component.errors = [];
    };
    baseShutdown = component.shutdown;
    component.shutdown = function() {
      baseShutdown.call(component);
      component.hasErrors = false;
      return component.errors = [];
    };
    return component;
  };

}).call(this);
