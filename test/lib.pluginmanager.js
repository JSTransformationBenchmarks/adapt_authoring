const fs_closePromise = require('util').promisify(require('fs').close);

const fs_writePromise = require('util').promisify(require('fs').write);

const fs_openPromise = require('util').promisify(require('fs').open);

const fs_mkdirPromise = require('util').promisify(require('fs').mkdir);

const fs_existsPromise = require('util').promisify(require('fs').exists);

var fs = require('fs');

var path = require('path');

var should = require('should');

var configuration = require('../lib/configuration');

var database = require('../lib/database');

var pluginmanager = require('../lib/pluginmanager');

var testData = require('./testData.json').pluginmanager;

var pm;
before(function () {
  pm = pluginmanager.getManager();
});
after(function () {
  removePlugin();
});
it('should inherit from event emitter', function (done) {
  pm.on('foo', done);
  pm.emit('foo');
});
it('should detect when a new plugin needs to be installed', function (done) {
  addPlugin().then(() => {
    pm.isUpgradeRequired(function (required) {
      required.should.be.true;
      done();
    });
  });
});
it('should verify if a plugin is of a particular type and validate it', async function () {
  // @TODO need to do fine grained validation, for now, just verify the type is correct
  await addPlugin();
  pm.getPlugin(testData.type, testData.name, function (error, pluginInfo) {
    should.not.exist(error);
    var pluginTypes = pm.getPluginTypes();
    pluginTypes.should.containEql(pluginInfo.type);
  });
});
it('should be able to install new plugins', function (done) {
  addPlugin().then(() => {
    pm.getPlugin(testData.type, testData.name, function (error, pluginInfo) {
      should.not.exist(error);
      pm.installPlugin(pluginInfo, function (error) {
        should.not.exist(error); // confirm that the plugin was installed
  
        pm.isInstalled(pluginInfo, function (installed) {
          installed.should.equal(true, 'Failed to verify that plugin was installed!');
          done();
        });
      });
    });
  });
});
it('should provide a list of all installed plugins', function (done) {
  var plugin = {
    name: testData.name,
    type: testData.type
  };
  pm.getInstalledPlugins(function (error, pluginList) {
    should.not.exist(error);

    if (!pluginList[plugin.type] || !pluginList[plugin.type][plugin.name]) {
      throw new Error('failed to find expected plugin in installed plugins: ' + plugin.name);
    }

    done();
  });
});
it('should detect when an installed plugin has been removed from disk', function (done) {
  pm.getPlugin(testData.type, testData.name, function (error, pluginInfo) {
    should.not.exist(error);
    removePlugin();
    pm.testPluginState(pluginInfo, pluginmanager.states.MISSING_FROM_DISK, function (state) {
      state.should.equal(pluginmanager.states.MISSING_FROM_DISK);
      done();
    });
  });
});
it('should be able to uninstall plugins', function (done) {
  // first, make sure it's installed
  addPlugin().then(() => {
    pm.getPlugin(testData.type, testData.name, function (error, pluginInfo) {
      should.not.exist(error);
      pm.uninstallPlugin(pluginInfo, function (error) {
        if (error) {
          done(error);
        } else {
          // confirm that the plugin was uninstalled
          pm.isInstalled(pluginInfo, function (installed) {
            if (installed) {
              done(new Error('Failed to verify that plugin was uninstalled!'));
            } else {
              done();
            }
          });
        }
      });
    });
  });
  
});

async function addPlugin() {
  // adds a temporary plugin on disk
  var pluginDir = path.join(configuration.serverRoot, pm.pluginDir, testData.type);

  if (!(await fs_existsPromise(pluginDir))) {
    await fs_mkdirPromise(pluginDir);
  }

  pluginDir = path.join(pluginDir, testData.name);

  if (!(await fs_existsPromise(pluginDir))) {
    await fs_mkdirPromise(pluginDir);
    var filePath = path.join(pluginDir, 'package.json');
    var fd = await fs_openPromise(filePath, 'w');
    await fs_writePromise(fd, JSON.stringify(testData.data));
    await fs_closePromise(fd);
  }
}

function removePlugin() {
  // remove the temporary plugin
  var pluginDir = path.join(configuration.serverRoot, pm.pluginDir, testData.type, testData.name);

  if (fs.existsSync(pluginDir)) {
    var filePath = path.join(pluginDir, 'package.json');
    fs.unlinkSync(filePath);
    fs.rmdirSync(pluginDir);
  }
}