(function() {
  var CoffeeScript, dynamicLoader, fs, manifest, manifestLoader, nofloGraph, path, registerModules, registerSubgraph, utils, _;

  path = require('path');

  fs = require('fs');

  manifest = require('fbp-manifest');

  _ = require('underscore')._;

  utils = require('../Utils');

  nofloGraph = require('../Graph');

  CoffeeScript = require('coffee-script');

  if (typeof CoffeeScript.register !== 'undefined') {
    CoffeeScript.register();
  }

  registerModules = function(loader, modules, callback) {
    var c, compatible, componentLoaders, done, loaderPath, m, _i, _j, _len, _len1, _ref, _ref1;
    compatible = modules.filter(function(m) {
      var _ref;
      return (_ref = m.runtime) === 'noflo' || _ref === 'noflo-nodejs';
    });
    componentLoaders = [];
    for (_i = 0, _len = compatible.length; _i < _len; _i++) {
      m = compatible[_i];
      if (m.icon) {
        loader.setLibraryIcon(m.name, m.icon);
      }
      if ((_ref = m.noflo) != null ? _ref.loader : void 0) {
        loaderPath = path.resolve(loader.baseDir, m.base, m.noflo.loader);
        componentLoaders.push(loaderPath);
      }
      _ref1 = m.components;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        c = _ref1[_j];
        loader.registerComponent(m.name, c.name, path.resolve(loader.baseDir, c.path));
      }
    }
    if (!componentLoaders.length) {
      return callback(null);
    }
    done = _.after(componentLoaders.length, callback);
    return componentLoaders.forEach((function(_this) {
      return function(loaderPath) {
        var cLoader;
        cLoader = require(loaderPath);
        return loader.registerLoader(cLoader, function(err) {
          if (err) {
            return callback(err);
          }
          return done(null);
        });
      };
    })(this));
  };

  manifestLoader = {
    writeCache: function(loader, options, manifest, callback) {
      var filePath;
      filePath = path.resolve(loader.baseDir, options.manifest);
      return fs.writeFile(filePath, JSON.stringify(manifest, null, 2), {
        encoding: 'utf-8'
      }, callback);
    },
    readCache: function(loader, options, callback) {
      options.discover = false;
      return manifest.load.load(loader.baseDir, options, callback);
    },
    prepareManifestOptions: function(loader) {
      var options;
      if (!loader.options) {
        loader.options = {};
      }
      options = {};
      options.runtimes = loader.options.runtimes || [];
      if (options.runtimes.indexOf('noflo') === -1) {
        options.runtimes.push('noflo');
      }
      options.recursive = typeof loader.options.recursive === 'undefined' ? true : loader.options.recursive;
      if (!options.manifest) {
        options.manifest = 'fbp.json';
      }
      return options;
    },
    listComponents: function(loader, manifestOptions, callback) {
      return this.readCache(loader, manifestOptions, (function(_this) {
        return function(err, manifest) {
          if (err) {
            if (!loader.options.discover) {
              return callback(err);
            }
            dynamicLoader.listComponents(loader, manifestOptions, function(err, modules) {
              if (err) {
                return callback(err);
              }
              return _this.writeCache(loader, manifestOptions, {
                version: 1,
                modules: modules
              }, function(err) {
                if (err) {
                  return callback(err);
                }
                return callback(null, modules);
              });
            });
            return;
          }
          return registerModules(loader, manifest.modules, function(err) {
            if (err) {
              return callback(err);
            }
            return callback(null, manifest.modules);
          });
        };
      })(this));
    }
  };

  dynamicLoader = {
    listComponents: function(loader, manifestOptions, callback) {
      manifestOptions.discover = true;
      return manifest.list.list(loader.baseDir, manifestOptions, (function(_this) {
        return function(err, modules) {
          if (err) {
            return callback(err);
          }
          return registerModules(loader, modules, function(err) {
            if (err) {
              return callback(err);
            }
            return callback(null, modules);
          });
        };
      })(this));
    }
  };

  registerSubgraph = function(loader) {
    var graphPath;
    if (path.extname(__filename) === '.js') {
      graphPath = path.resolve(__dirname, '../../src/components/Graph.coffee');
    } else {
      graphPath = path.resolve(__dirname, '../../components/Graph.coffee');
    }
    return loader.registerComponent(null, 'Graph', graphPath);
  };

  exports.register = function(loader, callback) {
    var manifestOptions, _ref;
    manifestOptions = manifestLoader.prepareManifestOptions(loader);
    if ((_ref = loader.options) != null ? _ref.cache : void 0) {
      manifestLoader.listComponents(loader, manifestOptions, function(err, modules) {
        if (err) {
          return callback(err);
        }
        registerSubgraph(loader);
        return callback(null, modules);
      });
      return;
    }
    return dynamicLoader.listComponents(loader, manifestOptions, function(err, modules) {
      if (err) {
        return callback(err);
      }
      registerSubgraph(loader);
      return callback(null, modules);
    });
  };

  exports.dynamicLoad = function(name, cPath, metadata, callback) {
    var e, implementation, instance;
    try {
      implementation = require(cPath);
    } catch (_error) {
      e = _error;
      callback(e);
      return;
    }
    if (typeof implementation.getComponent === 'function') {
      instance = implementation.getComponent(metadata);
    } else if (typeof implementation === 'function') {
      instance = implementation(metadata);
    } else {
      callback(new Error("Unable to instantiate " + cPath));
      return;
    }
    if (typeof name === 'string') {
      instance.componentName = name;
    }
    return callback(null, instance);
  };

  exports.setSource = function(loader, packageId, name, source, language, callback) {
    var Module, babel, e, implementation, moduleImpl, modulePath;
    Module = require('module');
    if (language === 'coffeescript') {
      try {
        source = CoffeeScript.compile(source, {
          bare: true
        });
      } catch (_error) {
        e = _error;
        return callback(e);
      }
    } else if (language === 'es6' || language === 'es2015') {
      try {
        babel = require('babel-core');
        source = babel.transform(source).code;
      } catch (_error) {
        e = _error;
        return callback(e);
      }
    }
    try {
      modulePath = path.resolve(loader.baseDir, "./components/" + name + ".js");
      moduleImpl = new Module(modulePath, module);
      moduleImpl.paths = Module._nodeModulePaths(path.dirname(modulePath));
      moduleImpl.filename = modulePath;
      moduleImpl._compile(source, modulePath);
      implementation = moduleImpl.exports;
    } catch (_error) {
      e = _error;
      return callback(e);
    }
    if (!(implementation || implementation.getComponent)) {
      return callback(new Error('Provided source failed to create a runnable component'));
    }
    return loader.registerComponent(packageId, name, implementation, callback);
  };

  exports.getSource = function(loader, name, callback) {
    var component, componentName, nameParts;
    component = loader.components[name];
    if (!component) {
      for (componentName in loader.components) {
        if (componentName.split('/')[1] === name) {
          component = loader.components[componentName];
          name = componentName;
          break;
        }
      }
      if (!component) {
        return callback(new Error("Component " + name + " not installed"));
      }
    }
    if (typeof component !== 'string') {
      return callback(new Error("Can't provide source for " + name + ". Not a file"));
    }
    nameParts = name.split('/');
    if (nameParts.length === 1) {
      nameParts[1] = nameParts[0];
      nameParts[0] = '';
    }
    if (loader.isGraph(component)) {
      nofloGraph.loadFile(component, function(err, graph) {
        if (err) {
          return callback(err);
        }
        if (!graph) {
          return callback(new Error('Unable to load graph'));
        }
        return callback(null, {
          name: nameParts[1],
          library: nameParts[0],
          code: JSON.stringify(graph.toJSON()),
          language: 'json'
        });
      });
      return;
    }
    return fs.readFile(component, 'utf-8', function(err, code) {
      if (err) {
        return callback(err);
      }
      return callback(null, {
        name: nameParts[1],
        library: nameParts[0],
        language: utils.guessLanguageFromFilename(component),
        code: code
      });
    });
  };

}).call(this);
