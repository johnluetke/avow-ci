var async = require('async');
var git = require('../lib/modules.js').components.git;
var Processor = require('../lib/modules.js').components.processor;
var Mailer = require('../lib/modules.js').components.mailer;
var fsx = require('fs-extra');

// Constructor
var Runner = function (data) {
  // Get project data
  this.project_name = data.project.name;
  this.repo = data.project.repo;
  this.branch = data.project.branch;
  this.project_id = data.project._id;
  this.projectData = data.projectDB;
  // Will store temp directory
  this.temp = null;
  // Will store config
  this.config = null;
  // Bet build id from new build
  this.build = data.build._id;
  // Set data-store for build
  this.buildData = data.buildDB;
  // Set sockets
  this.buildSocket = data.buildSocket;
  // Set project status
  this.updateProjectStatus(2);
  // Kickoff build
  this.run();
};

// Runs the processes
Runner.prototype.run = function () {
  var self = this;
  async.series({

    // Clone into temporary
    clone: function (callback) {
      git.clone(self.repo, self.build, self.branch, function (err, data) {
        if (err) {
          callback(err);
        } else {
          // Set temp dir reference
          self.temp = data.dir;
          // Some cleanup
          delete data.commits.repo;
          delete data.commits.author;
          // Update build record with commit data
          self.updateBuildData({ commit: data.commits });
          callback(null);
        }
      });
    },

    // Get avow.json configuration
    config: function (callback) {
      fsx.readFile(self.temp+'/avow.json', 'utf8', function (err, data) {
        if (err) {
          callback(err);
        } else {
          self.updateBuildData({ config: JSON.parse(data) });
          if (self.config === '') {
            callback('No config data in avow.json');
          } else {
            self.config = JSON.parse(data);
            callback(null);
          }
        }
      });
    },

    // Run processes/tasks
    tasks: function (callback) {
      async.eachSeries(self.config.tasks, function (i, callback) {
        var proc = new Processor(i, self.build, self.buildSocket, callback);
      }, function (err) {
        callback(err);
      });
    }

  // Handle errors
  }, function (err) {
    var end = + new Date();
    if (err) {
      self.updateBuildData({ end: end, status: 1, error: { output: err } });
      self.updateProjectStatus(1);
      // Send email (if config'd)
      var mailer = new Mailer({ project: self.project_name, build: self.build });
      // Cleanup
      fsx.remove(self.temp);
    } else {
      // Log end of build
      self.updateBuildData({ end: end, status: 0 });
      self.updateProjectStatus(0);
      // Copy to build folder
      fsx.copy(self.temp, __dirname+'/../builds/'+self.project_name, function (err) {
        if (err) {
          console.log('Error moving completed build of '+self.project_name);
        }
        // Cleanup
        fsx.remove(self.temp);
      });
    }
  });
};

// Updates build data record
Runner.prototype.updateBuildData = function (data) {
  this.buildData.update({ '_id': this.build.toString() }, data, function (err, data) {
    if (err) {
      console.log(err);
    }
  });
};

// Updates project status
Runner.prototype.updateProjectStatus = function (status) {
  var self = this;
  this.projectData.update({ '_id': this.project_id.toString() }, { 'status': status, 'latest_build': this.build.toString() }, function (err, data) {
    // Emit sockets update
    self.emitUpdate(status);
    // Output error
    if (err) {
      console.log(err);
    }
  });
};

// Emit update to /api/builds/ socket namespace
Runner.prototype.emitUpdate = function (status) {
  this.buildSocket.emit('update', {
    id: this.build.toString(),
    project_name: this.project_name,
    project_id: this.project_id.toString(),
    status: status
  });
};

module.exports = Runner;