"use strict";
var child_process_1 = require("child_process");
var Promise = require("bluebird");
var _ = require("lodash");
var pathExists = require("path-exists");
var async = require("async");
var net = require("net");
var fs = require("fs");
var unicoid_1 = require("unicoid");
var vlcdaemon = (function () {
    function vlcdaemon(conf) {
        this.playlist = [];
        this.track = 0;
        this.uri = "";
        this.daemonized = false;
        this.playing = false;
        this.player_process = false;
        this.socketport = 5252;
        this.noaudio = false;
        if (conf) {
            if (conf.verbose)
                this.verbose = conf.verbose;
            if (conf.noaudio)
                this.noaudio = conf.noaudio;
        }
    }
    vlcdaemon.prototype.start = function (options) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (!that.daemonized) {
                try {
                    var cvlc = void 0;
                    if (that.noaudio) {
                        cvlc = child_process_1.spawn("cvlc", ["-I", "rc", "--rc-fake-tty", "--no-mouse-events", "--no-keyboard-events", "--rc-host", "localhost:" + that.socketport, "--avcodec-hw", "none", "--no-audio", "--loop", "--daemon"], { detached: true, stdio: "ignore" });
                    }
                    else if (options) {
                        cvlc = child_process_1.spawn("cvlc", options, { detached: true, stdio: "ignore" });
                    }
                    else {
                        cvlc = child_process_1.spawn("cvlc", ["-I", "rc", "--rc-fake-tty", "--no-mouse-events", "--no-keyboard-events", "--rc-host", "localhost:" + that.socketport, "--avcodec-hw", "none", "--no-audio", "--loop", "--daemon"], { detached: true, stdio: "ignore" });
                    }
                    if (that.verbose) {
                        cvlc.on("error", function (data) {
                            console.log("error: " + data);
                        });
                    }
                    setTimeout(function () {
                        that.player_process = net.createConnection(that.socketport, "localhost");
                        that.player_process.on("connect", function () {
                            if (!that.daemonized) {
                                that.daemonized = true;
                                resolve(true);
                            }
                        });
                        if (that.verbose) {
                            that.player_process.on("data", function (data) {
                                console.log("vlcdata: " + data);
                            });
                            that.player_process.on("error", function (data) {
                                console.log("vlcerror: " + data);
                            });
                        }
                    }, 5000);
                }
                catch (err) {
                    reject(err);
                }
            }
            else {
                reject({ error: "player is running" });
            }
        });
    };
    vlcdaemon.prototype.switch = function (target) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (target > 0) {
                that.next(target).then(function (a) {
                    resolve(a);
                }).catch(function (err) {
                    reject(err);
                });
            }
            else if (target === 0) {
                reject({ error: "nothing to do" });
            }
            else {
                that.prev(target).then(function (a) {
                    resolve(a);
                }).catch(function (err) {
                    reject(err);
                });
            }
        });
    };
    vlcdaemon.prototype.next = function (target) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (!target || target === 1) {
                that.player_process.write("next\n", function () {
                    if (that.track < that.playlist.length) {
                        _.map(that.playlist, function (p, i) {
                            if (i !== (that.track + 1)) {
                                that.uri = p.uri;
                            }
                        });
                        that.track += 1;
                    }
                    resolve(true);
                });
            }
            else {
                that.to(that.track + target).then(function (a) {
                    resolve(a);
                }).catch(function (err) {
                    reject(err);
                });
            }
        });
    };
    vlcdaemon.prototype.prev = function (target) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (!target || target === 1) {
                that.player_process.write("prev\n", function () {
                    if (that.track > 1) {
                        _.map(that.playlist, function (p, i) {
                            if (i !== (that.track - 1)) {
                                that.uri = p.uri;
                            }
                        });
                        that.track += -1;
                    }
                    resolve(true);
                });
            }
            else {
                that.to(that.track + Math.abs(target)).then(function (a) {
                    resolve(a);
                }).catch(function (err) {
                    reject(err);
                });
            }
        });
    };
    vlcdaemon.prototype.to = function (target) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (target) {
                that.player_process.write("goto " + target + "\n", function () {
                    if (that.track > 1) {
                        _.map(that.playlist, function (p, i) {
                            if (i !== (that.track - 1)) {
                                that.uri = p.uri;
                            }
                        });
                        that.track += -1;
                    }
                    resolve(true);
                });
            }
            else {
                reject("specify target");
            }
        });
    };
    vlcdaemon.prototype.stop = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
            try {
                that.player_process.write("stop\n", function () {
                    that.track = 0;
                    that.playlist = [];
                    that.playing = false;
                    that.uri = "";
                    resolve(true);
                });
            }
            catch (err) {
                reject({ error: err });
            }
        });
    };
    vlcdaemon.prototype.end = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
            try {
                that.player_process.kill();
                that.daemonized = false;
                that.track = 0;
                that.playlist = [];
                that.playing = false;
                that.uri = "";
                resolve(true);
            }
            catch (err) {
                reject({ error: err });
            }
        });
    };
    vlcdaemon.prototype.loadListfromFile = function (playlist_path, playnow) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (playlist_path && playlist_path.split('.pls').length > 1) {
                pathExists(playlist_path).then(function (a) {
                    if (a) {
                        if (that.daemonized) {
                            fs.readFile(playlist_path, function (err, data) {
                                if (err) {
                                    console.log("errload");
                                    reject({ error: err });
                                }
                                else {
                                    fs.readFile(playlist_path, function (err, data) {
                                        if (err) {
                                            console.log({ error: err });
                                            reject({ error: err });
                                        }
                                        else {
                                            var datatoarray = data.toString().split("\n");
                                            var tracks_1 = [];
                                            _.map(datatoarray, function (data) {
                                                if (data.split('=').length > 1 && data.split('NumberOfEntries=').length < 2 && data.split('Version=').length < 2) {
                                                    var index = parseInt(data.split('=')[0][data.split('=')[0].length - 1]);
                                                    if (tracks_1.length < index) {
                                                        tracks_1.push({});
                                                    }
                                                    if (data.split('File').length > 1) {
                                                        tracks_1[index - 1].uri = data.split(data.split('=')[0] + "=")[1];
                                                    }
                                                    else if (data.split('Title').length > 1) {
                                                        tracks_1[index - 1].title = data.split(data.split('=')[0] + "=")[1];
                                                    }
                                                }
                                            });
                                            that.playlist = [];
                                            _.map(tracks_1, function (track) {
                                                track.label = unicoid_1.uniqueid(4);
                                                that.playlist.push(track);
                                            });
                                            if (playnow) {
                                                that.player_process.write(JSON.stringify({ "command": ["loadlist", playlist_path, "replace"] }) + "\r\n", function () {
                                                    that.play().then(function (a) {
                                                        resolve(a);
                                                    }).catch(function (err) {
                                                        reject(err);
                                                    });
                                                });
                                            }
                                            else {
                                                that.player_process.write(JSON.stringify({ "command": ["loadlist", playlist_path, "replace"] }) + "\r\n", function () {
                                                    resolve(true);
                                                });
                                            }
                                        }
                                    });
                                }
                            });
                        }
                        else {
                            reject({ error: "vlc not started" });
                        }
                    }
                    else {
                        console.log("erro");
                        reject({ error: "wrong path" });
                    }
                }).catch(function (err) {
                    reject(err);
                });
            }
            else {
                console.log("erro");
                reject({ error: "file must be a .pls file" });
            }
        });
    };
    vlcdaemon.prototype.addTrack = function (track, index) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (that.playlist.length > 0) {
                that.player_process.write("enqueue " + track.uri + "\n", function () {
                    if (!track.label)
                        track.label = unicoid_1.uniqueid(4);
                    that.playlist.push(track);
                    if (that.verbose) {
                        console.log("start first track of a playlist");
                    }
                    resolve(true);
                });
            }
            else {
                that.player_process.write("add " + track.uri + "\n", function () {
                    if (!track.label)
                        track.label = unicoid_1.uniqueid(4);
                    that.playlist.push(track);
                    if (that.verbose) {
                        console.log("append track");
                    }
                    resolve(true);
                });
            }
        });
    };
    vlcdaemon.prototype.clearList = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (that.playlist.length > 0) {
                var preserve_1;
                that.player_process.write("clear\n", function () {
                    _.map(that.playlist, function (t) {
                        if (t.uri === that.uri) {
                            preserve_1 = t;
                        }
                    });
                    if (preserve_1) {
                        that.playlist = [preserve_1];
                    }
                    else {
                        that.playlist = [];
                    }
                    if (that.verbose) {
                        console.log("clear playlist");
                    }
                    resolve(true);
                });
            }
            else {
                resolve(true);
            }
        });
    };
    vlcdaemon.prototype.loadList = function (tracks) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (that.playing) {
                that.clearList().then(function () {
                    async.eachSeries(tracks, function (track, cb) {
                        that.addTrack(track).then(function (a) {
                            cb();
                        }).catch(function (err) {
                            cb(err);
                        });
                    }, function (err) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve(true);
                        }
                    });
                }).catch(function (err) {
                    reject(err);
                });
            }
            else {
                async.eachSeries(tracks, function (track, cb) {
                    that.addTrack(track).then(function (a) {
                        cb();
                    }).catch(function (err) {
                        cb(err);
                    });
                }, function (err) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        if (that.verbose) {
                            console.log("playlist loaded");
                        }
                        that.playing = true;
                        that.track = 1;
                        that.uri = that.playlist[0].uri;
                        resolve(true);
                    }
                });
            }
        });
    };
    vlcdaemon.prototype.play = function (play_path) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (play_path) {
                if (that.playlist.length > 1) {
                    that.clearList().then(function () {
                        console.log(play_path);
                        that.addTrack({ uri: play_path }).then(function () {
                            that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", function () {
                                that.playlist = [];
                                that.playlist.push({ uri: play_path, label: unicoid_1.uniqueid(6) });
                                that.playing = true;
                                that.uri = play_path;
                                that.track = 1;
                                resolve(true);
                            });
                        }).catch(function (err) {
                            reject(err);
                        });
                    }).catch(function (err) {
                        that.addTrack({ uri: play_path }).then(function () {
                            that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", function () {
                                that.playlist = [];
                                that.playlist.push({ uri: play_path, label: unicoid_1.uniqueid(6) });
                                that.playing = true;
                                that.uri = play_path;
                                that.track = 1;
                                resolve(true);
                            });
                        }).catch(function (err) {
                            reject(err);
                        });
                    });
                }
                else if (that.playlist.length === 1) {
                    that.addTrack({ uri: play_path }).then(function () {
                        that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", function () {
                            that.playlist = [];
                            that.playlist.push({ uri: play_path, label: unicoid_1.uniqueid(6) });
                            that.playing = true;
                            that.uri = play_path;
                            that.track = 1;
                            resolve(true);
                        });
                    }).catch(function (err) {
                        reject(err);
                    });
                }
                else {
                    that.player_process.write(JSON.stringify({ "command": ["loadfile", play_path] }) + "\r\n", function () {
                        that.playlist.push({ uri: play_path, label: unicoid_1.uniqueid(6) });
                        that.playing = true;
                        that.uri = play_path;
                        that.track = 1;
                        resolve(true);
                    });
                }
            }
            else if (that.playlist.length > 0 && !that.playing) {
                that.player_process.write(JSON.stringify({ "command": ["play"] }) + "\r\n", function () {
                    that.playing = true;
                    if (!that.track)
                        that.track = 1;
                    if (!that.uri)
                        that.uri = that.playlist[0].uri;
                    resolve(true);
                });
            }
            else {
                reject("nothing to play");
            }
        });
    };
    vlcdaemon.prototype.pause = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
            that.player_process.write(JSON.stringify({ "command": ["play"] }) + "\r\n", function () {
                that.playing = false;
                resolve(true);
            });
        });
    };
    vlcdaemon.prototype.playTrack = function () {
        return new Promise(function (resolve, reject) {
        });
    };
    vlcdaemon.prototype.nextTrack = function () {
        return new Promise(function (resolve, reject) {
        });
    };
    vlcdaemon.prototype.previousTrack = function () {
        return new Promise(function (resolve, reject) {
        });
    };
    return vlcdaemon;
}());
exports.vlcdaemon = vlcdaemon;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFO2dCQUN4RSxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQTtnQkFFcEIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO1lBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRVAsQ0FBQyxDQUFDLENBQUE7SUFDTixDQUFDO0lBQ0QsNkJBQVMsR0FBVDtRQUNJLE1BQU0sQ0FBQyxJQUFJLE9BQU8sQ0FBTyxVQUFDLE9BQU8sRUFBRSxNQUFNO1FBSXpDLENBQUMsQ0FBQyxDQUFBO0lBQ04sQ0FBQztJQUVELDZCQUFTLEdBQVQ7UUFDSSxNQUFNLENBQUMsSUFBSSxPQUFPLENBQU8sVUFBQyxPQUFPLEVBQUUsTUFBTTtRQUl6QyxDQUFDLENBQUMsQ0FBQTtJQUNOLENBQUM7SUFDRCxpQ0FBYSxHQUFiO1FBQ0ksTUFBTSxDQUFDLElBQUksT0FBTyxDQUFPLFVBQUMsT0FBTyxFQUFFLE1BQU07UUFJekMsQ0FBQyxDQUFDLENBQUE7SUFDTixDQUFDO0lBSUwsZ0JBQUM7QUFBRCxDQXJrQkEsQUFxa0JDLElBQUE7QUFya0JZLDhCQUFTIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc3Bhd24gfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiXG5pbXBvcnQgKiBhcyBQcm9taXNlIGZyb20gXCJibHVlYmlyZFwiO1xuaW1wb3J0ICogYXMgXyBmcm9tIFwibG9kYXNoXCI7XG5jb25zdCBwYXRoRXhpc3RzID0gcmVxdWlyZShcInBhdGgtZXhpc3RzXCIpO1xuaW1wb3J0ICogYXMgYXN5bmMgZnJvbSBcImFzeW5jXCI7XG5pbXBvcnQgKiBhcyBuZXQgZnJvbSBcIm5ldFwiO1xuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XG5pbXBvcnQgeyB1bmlxdWVpZCB9IGZyb20gXCJ1bmljb2lkXCI7XG5cbmludGVyZmFjZSBJVHJhY2tsb2FkIHtcbiAgICB0aXRsZT86IHN0cmluZ1xuICAgIGxhYmVsPzogc3RyaW5nXG4gICAgdXJpOiBzdHJpbmdcblxufVxuXG5cbmludGVyZmFjZSBJVHJhY2sgZXh0ZW5kcyBJVHJhY2tsb2FkIHtcbiAgICBsYWJlbDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSXZsY2NvbmYge1xuICAgIHNvY2tldGZpbGU/OiBzdHJpbmdcbiAgICBzb2NrZXRjb25mPzogc3RyaW5nXG4gICAgdmVyYm9zZT86IGJvb2xlYW5cbiAgICBub2F1ZGlvPzogYm9vbGVhblxufVxuXG5cblxuZXhwb3J0IGNsYXNzIHZsY2RhZW1vbiB7XG5cbiAgICBwbGF5bGlzdDogSVRyYWNrW10gPSBbXTtcbiAgICB0cmFjazogbnVtYmVyID0gMFxuICAgIHVyaTogc3RyaW5nID0gXCJcIlxuICAgIGRhZW1vbml6ZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICAgIHBsYXlpbmc6IGJvb2xlYW4gPSBmYWxzZVxuICAgIHBsYXllcl9wcm9jZXNzOiBhbnkgPSBmYWxzZVxuICAgIHNvY2tldDogYW55XG4gICAgc29ja2V0cG9ydDogbnVtYmVyID0gNTI1MlxuICAgIHZlcmJvc2U6IGJvb2xlYW5cbiAgICBub2F1ZGlvOiBib29sZWFuID0gZmFsc2VcbiAgICBjb25zdHJ1Y3Rvcihjb25mPzogSXZsY2NvbmYpIHtcbiAgICAgICAgaWYgKGNvbmYpIHtcbiAgICAgICAgICAgIGlmIChjb25mLnZlcmJvc2UpIHRoaXMudmVyYm9zZSA9IGNvbmYudmVyYm9zZVxuICAgICAgICAgICAgaWYgKGNvbmYubm9hdWRpbykgdGhpcy5ub2F1ZGlvID0gY29uZi5ub2F1ZGlvXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGFydChvcHRpb25zPzogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoYXQuZGFlbW9uaXplZCkge1xuXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGN2bGNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQubm9hdWRpbykgeyAvLyB0b2RvIGRlbXV4ZXItcmVhZGFoZWFkLXBhY2tldHM9MzAwIHNlcGFyYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICBjdmxjID0gc3Bhd24oXCJjdmxjXCIsIFtcIi1JXCIsIFwicmNcIiwgXCItLXJjLWZha2UtdHR5XCIsIFwiLS1uby1tb3VzZS1ldmVudHNcIiwgXCItLW5vLWtleWJvYXJkLWV2ZW50c1wiLCBcIi0tcmMtaG9zdFwiLCBcImxvY2FsaG9zdDpcIiArIHRoYXQuc29ja2V0cG9ydCwgXCItLWF2Y29kZWMtaHdcIiwgXCJub25lXCIsIFwiLS1uby1hdWRpb1wiLFwiLS1sb29wXCIsIFwiLS1kYWVtb25cIl0sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiBcImlnbm9yZVwiIH0pXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3ZsYyA9IHNwYXduKFwiY3ZsY1wiLCBvcHRpb25zLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogXCJpZ25vcmVcIiB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdmxjID0gc3Bhd24oXCJjdmxjXCIsIFtcIi1JXCIsIFwicmNcIiwgXCItLXJjLWZha2UtdHR5XCIsIFwiLS1uby1tb3VzZS1ldmVudHNcIiwgXCItLW5vLWtleWJvYXJkLWV2ZW50c1wiLCBcIi0tcmMtaG9zdFwiLCBcImxvY2FsaG9zdDpcIiArIHRoYXQuc29ja2V0cG9ydCwgXCItLWF2Y29kZWMtaHdcIiwgXCJub25lXCIsIFwiLS1uby1hdWRpb1wiLFwiLS1sb29wXCIsIFwiLS1kYWVtb25cIl0sIHsgZGV0YWNoZWQ6IHRydWUsIHN0ZGlvOiBcImlnbm9yZVwiIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQudmVyYm9zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY3ZsYy5vbihcImVycm9yXCIsIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvcjogXCIgKyBkYXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2VzcyA9IG5ldC5jcmVhdGVDb25uZWN0aW9uKHRoYXQuc29ja2V0cG9ydCwgXCJsb2NhbGhvc3RcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLm9uKFwiY29ubmVjdFwiLCBmdW5jdGlvbiAoKSB7IC8vIGFkZCB0aW1lb3V0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGF0LmRhZW1vbml6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5kYWVtb25pemVkID0gdHJ1ZVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC52ZXJib3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy5vbihcImRhdGFcIiwgZnVuY3Rpb24gKGRhdGEpIHsgLy8gYWRkIHRpbWVvdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJ2bGNkYXRhOiBcIiArIGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy5vbihcImVycm9yXCIsIGZ1bmN0aW9uIChkYXRhKSB7IC8vIGFkZCB0aW1lb3V0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidmxjZXJyb3I6IFwiICsgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAgICAgICAgIH0sIDUwMDApXG5cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICB9XG5cblxuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwicGxheWVyIGlzIHJ1bm5pbmdcIiB9KVxuXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9KVxuXG4gICAgfVxuXG4gICAgc3dpdGNoKHRhcmdldDogbnVtYmVyKSB7IC8vIHJlbGF0aXZlIFxuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG4gICAgICAgICAgICBpZiAodGFyZ2V0ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoYXQubmV4dCh0YXJnZXQpLnRoZW4oKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShhKVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIGlmICh0YXJnZXQgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJub3RoaW5nIHRvIGRvXCIgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhhdC5wcmV2KHRhcmdldCkudGhlbigoYSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGEpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBuZXh0KHRhcmdldD86IG51bWJlcikge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQgfHwgdGFyZ2V0ID09PSAxKSB7XG4gICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShcIm5leHRcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC50cmFjayA8IHRoYXQucGxheWxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLm1hcCh0aGF0LnBsYXlsaXN0LCAocCwgaSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgIT09ICh0aGF0LnRyYWNrICsgMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSBwLnVyaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrICs9IDFcbiAgICAgICAgICAgICAgICAgICAgfSByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoYXQudG8odGhhdC50cmFjayArIHRhcmdldCkudGhlbigoYSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGEpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG5cblxuXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHByZXYodGFyZ2V0PzogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRhcmdldCB8fCB0YXJnZXQgPT09IDEpIHtcbiAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKFwicHJldlxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LnRyYWNrID4gMSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBfLm1hcCh0aGF0LnBsYXlsaXN0LCAocCwgaSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGkgIT09ICh0aGF0LnRyYWNrIC0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSBwLnVyaVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrICs9IC0xXG5cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhhdC50byh0aGF0LnRyYWNrICsgTWF0aC5hYnModGFyZ2V0KSkudGhlbigoYSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGEpXG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSlcbiAgICB9XG4gICAgdG8odGFyZ2V0OiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoXCJnb3RvIFwiICsgdGFyZ2V0ICsgXCJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC50cmFjayA+IDEpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgXy5tYXAodGhhdC5wbGF5bGlzdCwgKHAsIGkpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpICE9PSAodGhhdC50cmFjayAtIDEpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gcC51cmlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50cmFjayArPSAtMVxuXG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdChcInNwZWNpZnkgdGFyZ2V0XCIpXG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KVxuICAgIH1cblxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShcInN0b3BcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBwYXJzZSBmaWxlIHRvIGxvYWQgdGhlIGxpc3Qgb24gY2xhc3NcblxuICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gMFxuICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0ID0gW11cbiAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSBcIlwiXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICB9KTtcblxuXG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSlcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH0pXG4gICAgfVxuXG5cbiAgICBlbmQoKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mua2lsbCgpXG4gICAgICAgICAgICAgICAgdGhhdC5kYWVtb25pemVkID0gZmFsc2VcbiAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gMFxuICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QgPSBbXVxuICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhhdC51cmkgPSBcIlwiXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgfSlcbiAgICB9XG4gICAgbG9hZExpc3Rmcm9tRmlsZShwbGF5bGlzdF9wYXRoOiBzdHJpbmcsIHBsYXlub3c/OiB0cnVlKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXlsaXN0X3BhdGggJiYgcGxheWxpc3RfcGF0aC5zcGxpdCgnLnBscycpLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBwYXRoRXhpc3RzKHBsYXlsaXN0X3BhdGgpLnRoZW4oKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LmRhZW1vbml6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5yZWFkRmlsZShwbGF5bGlzdF9wYXRoLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJybG9hZFwiKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcy5yZWFkRmlsZShwbGF5bGlzdF9wYXRoLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh7IGVycm9yOiBlcnIgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YXRvYXJyYXkgPSBkYXRhLnRvU3RyaW5nKCkuc3BsaXQoXCJcXG5cIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHJhY2tzID0gW11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5tYXAoZGF0YXRvYXJyYXksIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5zcGxpdCgnPScpLmxlbmd0aCA+IDEgJiYgZGF0YS5zcGxpdCgnTnVtYmVyT2ZFbnRyaWVzPScpLmxlbmd0aCA8IDIgJiYgZGF0YS5zcGxpdCgnVmVyc2lvbj0nKS5sZW5ndGggPCAyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHBhcnNlSW50KGRhdGEuc3BsaXQoJz0nKVswXVtkYXRhLnNwbGl0KCc9JylbMF0ubGVuZ3RoIC0gMV0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJhY2tzLmxlbmd0aCA8IGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYWNrcy5wdXNoKHt9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5zcGxpdCgnRmlsZScpLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tzW2luZGV4IC0gMV0udXJpID0gZGF0YS5zcGxpdChkYXRhLnNwbGl0KCc9JylbMF0gKyBcIj1cIilbMV1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEuc3BsaXQoJ1RpdGxlJykubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFja3NbaW5kZXggLSAxXS50aXRsZSA9IGRhdGEuc3BsaXQoZGF0YS5zcGxpdCgnPScpWzBdICsgXCI9XCIpWzFdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QgPSBbXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLm1hcCh0cmFja3MsIGZ1bmN0aW9uICh0cmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2subGFiZWwgPSB1bmlxdWVpZCg0KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdC5wdXNoKHRyYWNrKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBsYXlub3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoSlNPTi5zdHJpbmdpZnkoeyBcImNvbW1hbmRcIjogW1wibG9hZGxpc3RcIiwgcGxheWxpc3RfcGF0aCwgXCJyZXBsYWNlXCJdIH0pICsgXCJcXHJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGZpbGUgdG8gbG9hZCB0aGUgbGlzdCBvbiBjbGFzc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheSgpLnRoZW4oKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShhKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShKU09OLnN0cmluZ2lmeSh7IFwiY29tbWFuZFwiOiBbXCJsb2FkbGlzdFwiLCBwbGF5bGlzdF9wYXRoLCBcInJlcGxhY2VcIl0gfSkgKyBcIlxcclxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgZmlsZSB0byBsb2FkIHRoZSBsaXN0IG9uIGNsYXNzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJ2bGMgbm90IHN0YXJ0ZWRcIiB9KVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb1wiKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogXCJ3cm9uZyBwYXRoXCIgfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcblxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb1wiKVxuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcImZpbGUgbXVzdCBiZSBhIC5wbHMgZmlsZVwiIH0pXG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICBhZGRUcmFjayh0cmFjazogSVRyYWNrbG9hZCwgaW5kZXg/OiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblxuXG5cblxuICAgICAgICAgICAgaWYgKHRoYXQucGxheWxpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoXCJlbnF1ZXVlIFwiICsgdHJhY2sudXJpICsgXCJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRyYWNrLmxhYmVsKSB0cmFjay5sYWJlbCA9IHVuaXF1ZWlkKDQpXG4gICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QucHVzaCg8SVRyYWNrPnRyYWNrKVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC52ZXJib3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInN0YXJ0IGZpcnN0IHRyYWNrIG9mIGEgcGxheWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoXCJhZGQgXCIgKyB0cmFjay51cmkgKyBcIlxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdHJhY2subGFiZWwpIHRyYWNrLmxhYmVsID0gdW5pcXVlaWQoNClcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdC5wdXNoKDxJVHJhY2s+dHJhY2spXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYXBwZW5kIHRyYWNrXCIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG5cblxuXG4gICAgfVxuXG4gICAgY2xlYXJMaXN0KCkge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGF0LnBsYXlsaXN0Lmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgICAgICAgIGxldCBwcmVzZXJ2ZTogSVRyYWNrXG4gICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShcImNsZWFyXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgXy5tYXAodGhhdC5wbGF5bGlzdCwgKHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0LnVyaSA9PT0gdGhhdC51cmkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVzZXJ2ZSA9IHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXNlcnZlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0ID0gW3ByZXNlcnZlXVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdCA9IFtdXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC52ZXJib3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNsZWFyIHBsYXlsaXN0XCIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuICAgIGxvYWRMaXN0KHRyYWNrczogSVRyYWNrbG9hZFtdKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoYXQucGxheWluZykge1xuICAgICAgICAgICAgICAgIHRoYXQuY2xlYXJMaXN0KCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGFzeW5jLmVhY2hTZXJpZXModHJhY2tzLCAodHJhY2ssIGNiKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LmFkZFRyYWNrKHRyYWNrKS50aGVuKChhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH0sIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBhc3luYy5lYWNoU2VyaWVzKHRyYWNrcywgKHRyYWNrLCBjYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGF0LmFkZFRyYWNrKHRyYWNrKS50aGVuKChhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYigpXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKGVycilcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9LCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoSlNPTi5zdHJpbmdpZnkoeyBcImNvbW1hbmRcIjogW1wicGxheWxpc3QtcmVtb3ZlXCIsIFwiY3VycmVudFwiXSB9KSArIFwiXFxyXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInBsYXlsaXN0IGxvYWRlZFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50cmFjayA9IDFcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gdGhhdC5wbGF5bGlzdFswXS51cmlcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgfSk7XG5cblxuXG5cblxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcblxuXG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KVxuXG5cbiAgICB9XG5cbiAgICBwbGF5KHBsYXlfcGF0aD86IHN0cmluZykge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKHBsYXlfcGF0aCkgeyAvLyBub3Qgd29ya2luZyEhXG4gICAgICAgICAgICAgICAgaWYgKHRoYXQucGxheWxpc3QubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICB0aGF0LmNsZWFyTGlzdCgpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cocGxheV9wYXRoKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5hZGRUcmFjayh7IHVyaTogcGxheV9wYXRoIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoSlNPTi5zdHJpbmdpZnkoeyBcImNvbW1hbmRcIjogW1wicGxheWxpc3QtcmVtb3ZlXCIsIFwiY3VycmVudFwiXSB9KSArIFwiXFxyXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdCA9IFtdXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdC5wdXNoKHsgdXJpOiBwbGF5X3BhdGgsIGxhYmVsOiB1bmlxdWVpZCg2KSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlpbmcgPSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gcGxheV9wYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudHJhY2sgPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYWRkVHJhY2soeyB1cmk6IHBsYXlfcGF0aCB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKEpTT04uc3RyaW5naWZ5KHsgXCJjb21tYW5kXCI6IFtcInBsYXlsaXN0LXJlbW92ZVwiLCBcImN1cnJlbnRcIl0gfSkgKyBcIlxcclxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QgPSBbXVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QucHVzaCh7IHVyaTogcGxheV9wYXRoLCBsYWJlbDogdW5pcXVlaWQoNikgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnVyaSA9IHBsYXlfcGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhhdC5wbGF5bGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5hZGRUcmFjayh7IHVyaTogcGxheV9wYXRoIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShKU09OLnN0cmluZ2lmeSh7IFwiY29tbWFuZFwiOiBbXCJwbGF5bGlzdC1yZW1vdmVcIiwgXCJjdXJyZW50XCJdIH0pICsgXCJcXHJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QgPSBbXVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdC5wdXNoKHsgdXJpOiBwbGF5X3BhdGgsIGxhYmVsOiB1bmlxdWVpZCg2KSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnVyaSA9IHBsYXlfcGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudHJhY2sgPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKEpTT04uc3RyaW5naWZ5KHsgXCJjb21tYW5kXCI6IFtcImxvYWRmaWxlXCIsIHBsYXlfcGF0aF0gfSkgKyBcIlxcclxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0LnB1c2goeyB1cmk6IHBsYXlfcGF0aCwgbGFiZWw6IHVuaXF1ZWlkKDYpIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gcGxheV9wYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gMVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoYXQucGxheWxpc3QubGVuZ3RoID4gMCAmJiAhdGhhdC5wbGF5aW5nKSB7XG5cbiAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKEpTT04uc3RyaW5naWZ5KHsgXCJjb21tYW5kXCI6IFtcInBsYXlcIl0gfSkgKyBcIlxcclxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGF0LnRyYWNrKSB0aGF0LnRyYWNrID0gMVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoYXQudXJpKSB0aGF0LnVyaSA9IHRoYXQucGxheWxpc3RbMF0udXJpXG5cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdChcIm5vdGhpbmcgdG8gcGxheVwiKVxuXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9KVxuICAgIH1cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShKU09OLnN0cmluZ2lmeSh7IFwiY29tbWFuZFwiOiBbXCJwbGF5XCJdIH0pICsgXCJcXHJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IGZhbHNlXG5cbiAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9KVxuICAgIH1cbiAgICBwbGF5VHJhY2soKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblxuXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgbmV4dFRyYWNrKCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cblxuICAgICAgICB9KVxuICAgIH1cbiAgICBwcmV2aW91c1RyYWNrKCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG5cblxuICAgICAgICB9KVxuICAgIH1cblxuXG5cbn1cblxuIl19
