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
        this.fullscreen = false;
        if (conf) {
            if (conf.verbose)
                this.verbose = conf.verbose;
            if (conf.noaudio)
                this.noaudio = conf.noaudio;
            if (conf.fullscreen)
                this.fullscreen = conf.fullscreen;
        }
    }
    vlcdaemon.prototype.start = function (options) {
        var that = this;
        return new Promise(function (resolve, reject) {
            if (!that.daemonized) {
                var default_options = ["-I", "rc", "--rc-fake-tty", "--no-osd", "--no-mouse-events", "--no-keyboard-events", "--rc-host", "localhost:" + that.socketport, "--loop", "--image-duration=-1", "--daemon"];
                if (that.fullscreen)
                    default_options.push('--fullscreen');
                try {
                    var cvlc = void 0;
                    if (options) {
                        _.map(default_options, function (dopt) {
                            var exists = false;
                            _.map(options, function (oopt) {
                                if (dopt === oopt)
                                    exists = true;
                            });
                            if (!exists)
                                options.push(dopt);
                        });
                        console.log('cvlcopts0', options);
                        cvlc = child_process_1.spawn("cvlc", options, { detached: true, stdio: "ignore" });
                    }
                    else {
                        var cvlcopts = ["-I", "rc", "--rc-fake-tty", "--no-osd", "--no-mouse-events", "--no-keyboard-events", "--rc-host", "localhost:" + that.socketport, "--loop", "--image-duration=-1", "--daemon"];
                        if (that.fullscreen)
                            cvlcopts.push('--fullscreen');
                        console.log('cvlcopts1', cvlcopts);
                        cvlc = child_process_1.spawn("cvlc", cvlcopts, { detached: true, stdio: "ignore" });
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
                that.next().then(function (a) {
                    resolve(a);
                }).catch(function (err) {
                    reject(err);
                });
            }
            else if (target === 0) {
                reject({ error: "nothing to do" });
            }
            else {
                that.prev().then(function (a) {
                    resolve(a);
                }).catch(function (err) {
                    reject(err);
                });
            }
        });
    };
    vlcdaemon.prototype.next = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
            var target = that.track + 1;
            if (target < that.playlist.length && that.playlist[target]) {
                that.player_process.write("next\n", function () {
                    console.log('SWITCHING To ' + target);
                    that.uri = that.playlist[target].uri;
                    that.track = target;
                    resolve(true);
                });
            }
            else {
                resolve(true);
            }
        });
    };
    vlcdaemon.prototype.prev = function () {
        var that = this;
        return new Promise(function (resolve, reject) {
            var target = that.track - 1;
            if (target > -1) {
                if (that.playlist[target]) {
                    console.log('SWITCHING To ' + target);
                    that.player_process.write("prev\n", function () {
                        that.uri = that.playlist[target].uri;
                        that.track = target;
                        resolve(true);
                    });
                }
                else {
                    resolve(true);
                }
            }
            else {
                resolve(true);
            }
        });
    };
    vlcdaemon.prototype.to = function (target) {
        var that = this;
        return new Promise(function (resolve, reject) {
            console.log('track before is ' + that.track);
            console.log('track to change is ' + target);
            if ((target || target === 0) && that.playlist[target]) {
                var adjtarget = target + 4;
                console.log("switch to " + adjtarget);
                that.player_process.write("goto " + adjtarget + "\n", function () {
                    that.uri = that.playlist[target].uri;
                    that.track = target;
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
                                            resolve(true);
                                            if (playnow) {
                                            }
                                            else {
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
                        console.log("append track");
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
                        console.log("start first track of a playlist");
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
                        that.track = 0;
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsQ0FBQyxDQUFBO0lBQ04sQ0FBQztJQUNELGlDQUFhLEdBQWI7UUFDSSxNQUFNLENBQUMsSUFBSSxPQUFPLENBQU8sVUFBQyxPQUFPLEVBQUUsTUFBTTtRQUl6QyxDQUFDLENBQUMsQ0FBQTtJQUNOLENBQUM7SUFJTCxnQkFBQztBQUFELENBOWtCQSxBQThrQkMsSUFBQTtBQTlrQlksOEJBQVMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBzcGF3biB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCJcbmltcG9ydCAqIGFzIFByb21pc2UgZnJvbSBcImJsdWViaXJkXCI7XG5pbXBvcnQgKiBhcyBfIGZyb20gXCJsb2Rhc2hcIjtcbmNvbnN0IHBhdGhFeGlzdHMgPSByZXF1aXJlKFwicGF0aC1leGlzdHNcIik7XG5pbXBvcnQgKiBhcyBhc3luYyBmcm9tIFwiYXN5bmNcIjtcbmltcG9ydCAqIGFzIG5ldCBmcm9tIFwibmV0XCI7XG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCB7IHVuaXF1ZWlkIH0gZnJvbSBcInVuaWNvaWRcIjtcblxuaW50ZXJmYWNlIElUcmFja2xvYWQge1xuICAgIHRpdGxlPzogc3RyaW5nXG4gICAgbGFiZWw/OiBzdHJpbmdcbiAgICB1cmk6IHN0cmluZ1xuXG59XG5cblxuaW50ZXJmYWNlIElUcmFjayBleHRlbmRzIElUcmFja2xvYWQge1xuICAgIGxhYmVsOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJdmxjY29uZiB7XG4gICAgc29ja2V0ZmlsZT86IHN0cmluZ1xuICAgIHNvY2tldGNvbmY/OiBzdHJpbmdcbiAgICB2ZXJib3NlPzogYm9vbGVhblxuICAgIG5vYXVkaW8/OiBib29sZWFuXG4gICAgZnVsbHNjcmVlbj86IGJvb2xlYW5cbn1cblxuXG5cbmV4cG9ydCBjbGFzcyB2bGNkYWVtb24ge1xuXG4gICAgcGxheWxpc3Q6IElUcmFja1tdID0gW107XG4gICAgdHJhY2s6IG51bWJlciA9IDBcbiAgICB1cmk6IHN0cmluZyA9IFwiXCJcbiAgICBkYWVtb25pemVkOiBib29sZWFuID0gZmFsc2VcbiAgICBwbGF5aW5nOiBib29sZWFuID0gZmFsc2VcbiAgICBwbGF5ZXJfcHJvY2VzczogYW55ID0gZmFsc2VcbiAgICBzb2NrZXQ6IGFueVxuICAgIHNvY2tldHBvcnQ6IG51bWJlciA9IDUyNTJcbiAgICB2ZXJib3NlOiBib29sZWFuXG4gICAgbm9hdWRpbzogYm9vbGVhbiA9IGZhbHNlXG4gICAgZnVsbHNjcmVlbjogYm9vbGVhbiA9IGZhbHNlXG4gICAgY29uc3RydWN0b3IoY29uZj86IEl2bGNjb25mKSB7XG4gICAgICAgIGlmIChjb25mKSB7XG4gICAgICAgICAgICBpZiAoY29uZi52ZXJib3NlKSB0aGlzLnZlcmJvc2UgPSBjb25mLnZlcmJvc2VcbiAgICAgICAgICAgIGlmIChjb25mLm5vYXVkaW8pIHRoaXMubm9hdWRpbyA9IGNvbmYubm9hdWRpb1xuICAgICAgICAgICAgaWYgKGNvbmYuZnVsbHNjcmVlbikgdGhpcy5mdWxsc2NyZWVuID0gY29uZi5mdWxsc2NyZWVuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGFydChvcHRpb25zPzogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoYXQuZGFlbW9uaXplZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRfb3B0aW9ucyA9IFtcIi1JXCIsIFwicmNcIiwgXCItLXJjLWZha2UtdHR5XCIsIFwiLS1uby1vc2RcIiwgXCItLW5vLW1vdXNlLWV2ZW50c1wiLCBcIi0tbm8ta2V5Ym9hcmQtZXZlbnRzXCIsIFwiLS1yYy1ob3N0XCIsIFwibG9jYWxob3N0OlwiICsgdGhhdC5zb2NrZXRwb3J0LCBcIi0tbG9vcFwiLCBcIi0taW1hZ2UtZHVyYXRpb249LTFcIiwgXCItLWRhZW1vblwiXVxuICAgICAgICAgICAgICAgIGlmICh0aGF0LmZ1bGxzY3JlZW4pIGRlZmF1bHRfb3B0aW9ucy5wdXNoKCctLWZ1bGxzY3JlZW4nKVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjdmxjXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLm1hcChkZWZhdWx0X29wdGlvbnMsIChkb3B0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGV4aXN0cyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5tYXAob3B0aW9ucywgKG9vcHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvcHQgPT09IG9vcHQpIGV4aXN0cyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXhpc3RzKSBvcHRpb25zLnB1c2goZG9wdClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjdmxjb3B0czAnLCBvcHRpb25zKSAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY3ZsYyA9IHNwYXduKFwiY3ZsY1wiLCBvcHRpb25zLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogXCJpZ25vcmVcIiB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdmxjb3B0cyA9IFtcIi1JXCIsIFwicmNcIiwgXCItLXJjLWZha2UtdHR5XCIsIFwiLS1uby1vc2RcIiwgXCItLW5vLW1vdXNlLWV2ZW50c1wiLCBcIi0tbm8ta2V5Ym9hcmQtZXZlbnRzXCIsIFwiLS1yYy1ob3N0XCIsIFwibG9jYWxob3N0OlwiICsgdGhhdC5zb2NrZXRwb3J0LCBcIi0tbG9vcFwiLCBcIi0taW1hZ2UtZHVyYXRpb249LTFcIiwgXCItLWRhZW1vblwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQuZnVsbHNjcmVlbikgY3ZsY29wdHMucHVzaCgnLS1mdWxsc2NyZWVuJylcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjdmxjb3B0czEnLCBjdmxjb3B0cykgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjdmxjID0gc3Bhd24oXCJjdmxjXCIsIGN2bGNvcHRzLCB7IGRldGFjaGVkOiB0cnVlLCBzdGRpbzogXCJpZ25vcmVcIiB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN2bGMub24oXCJlcnJvclwiLCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXJyb3I6IFwiICsgZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3MgPSBuZXQuY3JlYXRlQ29ubmVjdGlvbih0aGF0LnNvY2tldHBvcnQsIFwibG9jYWxob3N0XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy5vbihcImNvbm5lY3RcIiwgZnVuY3Rpb24gKCkgeyAvLyBhZGQgdGltZW91dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhhdC5kYWVtb25pemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuZGFlbW9uaXplZCA9IHRydWVcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQudmVyYm9zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mub24oXCJkYXRhXCIsIGZ1bmN0aW9uIChkYXRhKSB7IC8vIGFkZCB0aW1lb3V0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidmxjZGF0YTogXCIgKyBkYXRhKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mub24oXCJlcnJvclwiLCBmdW5jdGlvbiAoZGF0YSkgeyAvLyBhZGQgdGltZW91dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInZsY2Vycm9yOiBcIiArIGRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgICAgICAgICB9LCA1MDAwKVxuXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgfVxuXG5cblxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcInBsYXllciBpcyBydW5uaW5nXCIgfSlcblxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgfSlcblxuICAgIH1cblxuICAgIHN3aXRjaCh0YXJnZXQ6IG51bWJlcikgeyAvLyByZWxhdGl2ZSBcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgaWYgKHRhcmdldCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGF0Lm5leHQoKS50aGVuKChhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoYSlcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGFyZ2V0ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwibm90aGluZyB0byBkb1wiIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoYXQucHJldigpLnRoZW4oKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShhKVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgbmV4dCgpIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhhdC50cmFjaysxXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmICh0YXJnZXQgPCB0aGF0LnBsYXlsaXN0Lmxlbmd0aCAmJiB0aGF0LnBsYXlsaXN0W3RhcmdldF0pIHtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKFwibmV4dFxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnU1dJVENISU5HIFRvICcrIHRhcmdldClcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gdGhhdC5wbGF5bGlzdFt0YXJnZXRdLnVyaVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gdGFyZ2V0XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH0gIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHByZXYoKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGF0LnRyYWNrLTFcbiAgICAgICAgICAgIGlmICh0YXJnZXQgPiAtMSkge1xuICAgICAgICAgICAgICAgIGlmKHRoYXQucGxheWxpc3RbdGFyZ2V0XSl7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTV0lUQ0hJTkcgVG8gJysgdGFyZ2V0KVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShcInByZXZcXG5cIiwgKCkgPT4ge1xuICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSB0aGF0LnBsYXlsaXN0W3RhcmdldF0udXJpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50cmFjayA9IHRhcmdldFxuICAgIFxuICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KVxuICAgIH1cbiAgICB0byh0YXJnZXQ6IG51bWJlcikge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3RyYWNrIGJlZm9yZSBpcyAnICsgdGhhdC50cmFjaylcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCd0cmFjayB0byBjaGFuZ2UgaXMgJyArIHRhcmdldClcblxuICAgICAgICAgICAgaWYgKCh0YXJnZXQgfHwgdGFyZ2V0ID09PSAwKSAmJiB0aGF0LnBsYXlsaXN0W3RhcmdldF0pIHtcbiAgICAgICAgICAgICAgICAvLyBpZiAodGFyZ2V0ICE9PSB0aGF0LnRyYWNrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGFkanRhcmdldCA9IHRhcmdldCArIDRcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJzd2l0Y2ggdG8gXCIgKyBhZGp0YXJnZXQpXG4gICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoXCJnb3RvIFwiICsgYWRqdGFyZ2V0ICsgXCJcXG5cIiwgKCkgPT4ge1xuXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gdGhhdC5wbGF5bGlzdFt0YXJnZXRdLnVyaVxuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gdGFyZ2V0XG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIGNvbnNvbGUubG9nKCdpcyBqdXN0IGl0JylcbiAgICAgICAgICAgICAgICAvLyAgICAgcmVzb2x2ZSh0cnVlKVxuXG4gICAgICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZWplY3QoXCJzcGVjaWZ5IHRhcmdldFwiKVxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSlcbiAgICB9XG5cblxuICAgIHN0b3AoKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoXCJzdG9wXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgZmlsZSB0byBsb2FkIHRoZSBsaXN0IG9uIGNsYXNzXG5cbiAgICAgICAgICAgICAgICAgICAgdGhhdC50cmFjayA9IDBcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdCA9IFtdXG4gICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gXCJcIlxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSk7XG5cblxuXG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZWplY3QoeyBlcnJvcjogZXJyIH0pXG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9KVxuICAgIH1cblxuXG4gICAgZW5kKCkge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLmtpbGwoKVxuICAgICAgICAgICAgICAgIHRoYXQuZGFlbW9uaXplZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhhdC50cmFjayA9IDBcbiAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0ID0gW11cbiAgICAgICAgICAgICAgICB0aGF0LnBsYXlpbmcgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoYXQudXJpID0gXCJcIlxuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSlcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH0pXG4gICAgfVxuICAgIGxvYWRMaXN0ZnJvbUZpbGUocGxheWxpc3RfcGF0aDogc3RyaW5nLCBwbGF5bm93PzogdHJ1ZSkge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGlmIChwbGF5bGlzdF9wYXRoICYmIHBsYXlsaXN0X3BhdGguc3BsaXQoJy5wbHMnKS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgcGF0aEV4aXN0cyhwbGF5bGlzdF9wYXRoKS50aGVuKChhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC5kYWVtb25pemVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVhZEZpbGUocGxheWxpc3RfcGF0aCwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImVycmxvYWRcIilcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IGVyciB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnMucmVhZEZpbGUocGxheWxpc3RfcGF0aCwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coeyBlcnJvcjogZXJyIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBlcnIgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGF0b2FycmF5ID0gZGF0YS50b1N0cmluZygpLnNwbGl0KFwiXFxuXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyYWNrcyA9IFtdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8ubWFwKGRhdGF0b2FycmF5LCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEuc3BsaXQoJz0nKS5sZW5ndGggPiAxICYmIGRhdGEuc3BsaXQoJ051bWJlck9mRW50cmllcz0nKS5sZW5ndGggPCAyICYmIGRhdGEuc3BsaXQoJ1ZlcnNpb249JykubGVuZ3RoIDwgMikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSBwYXJzZUludChkYXRhLnNwbGl0KCc9JylbMF1bZGF0YS5zcGxpdCgnPScpWzBdLmxlbmd0aCAtIDFdKVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRyYWNrcy5sZW5ndGggPCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFja3MucHVzaCh7fSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEuc3BsaXQoJ0ZpbGUnKS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYWNrc1tpbmRleCAtIDFdLnVyaSA9IGRhdGEuc3BsaXQoZGF0YS5zcGxpdCgnPScpWzBdICsgXCI9XCIpWzFdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLnNwbGl0KCdUaXRsZScpLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tzW2luZGV4IC0gMV0udGl0bGUgPSBkYXRhLnNwbGl0KGRhdGEuc3BsaXQoJz0nKVswXSArIFwiPVwiKVsxXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0ID0gW11cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5tYXAodHJhY2tzLCBmdW5jdGlvbiAodHJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYWNrLmxhYmVsID0gdW5pcXVlaWQoNClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QucHVzaCh0cmFjaylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGxheW5vdykge1xuXG5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG5cblxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcInZsYyBub3Qgc3RhcnRlZFwiIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvXCIpXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdCh7IGVycm9yOiBcIndyb25nIHBhdGhcIiB9KVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJlcnJvXCIpXG4gICAgICAgICAgICAgICAgcmVqZWN0KHsgZXJyb3I6IFwiZmlsZSBtdXN0IGJlIGEgLnBscyBmaWxlXCIgfSlcblxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIGFkZFRyYWNrKHRyYWNrOiBJVHJhY2tsb2FkLCBpbmRleD86IG51bWJlcikge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuXG5cblxuXG4gICAgICAgICAgICBpZiAodGhhdC5wbGF5bGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShcImVucXVldWUgXCIgKyB0cmFjay51cmkgKyBcIlxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdHJhY2subGFiZWwpIHRyYWNrLmxhYmVsID0gdW5pcXVlaWQoNClcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdC5wdXNoKDxJVHJhY2s+dHJhY2spXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYXBwZW5kIHRyYWNrXCIpXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKFwiYWRkIFwiICsgdHJhY2sudXJpICsgXCJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRyYWNrLmxhYmVsKSB0cmFjay5sYWJlbCA9IHVuaXF1ZWlkKDQpXG4gICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QucHVzaCg8SVRyYWNrPnRyYWNrKVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhhdC52ZXJib3NlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInN0YXJ0IGZpcnN0IHRyYWNrIG9mIGEgcGxheWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cblxuXG5cbiAgICB9XG5cbiAgICBjbGVhckxpc3QoKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoYXQucGxheWxpc3QubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAgICAgbGV0IHByZXNlcnZlOiBJVHJhY2tcbiAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKFwiY2xlYXJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBfLm1hcCh0aGF0LnBsYXlsaXN0LCAodCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHQudXJpID09PSB0aGF0LnVyaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXNlcnZlID0gdFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICBpZiAocHJlc2VydmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QgPSBbcHJlc2VydmVdXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0ID0gW11cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGF0LnZlcmJvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY2xlYXIgcGxheWxpc3RcIilcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICB9XG4gICAgbG9hZExpc3QodHJhY2tzOiBJVHJhY2tsb2FkW10pIHtcbiAgICAgICAgY29uc3QgdGhhdCA9IHRoaXM7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBpZiAodGhhdC5wbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgdGhhdC5jbGVhckxpc3QoKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYXN5bmMuZWFjaFNlcmllcyh0cmFja3MsICh0cmFjaywgY2IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuYWRkVHJhY2sodHJhY2spLnRoZW4oKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYigpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgfSwgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIGFzeW5jLmVhY2hTZXJpZXModHJhY2tzLCAodHJhY2ssIGNiKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQuYWRkVHJhY2sodHJhY2spLnRoZW4oKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNiKClcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2IoZXJyKVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0sIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShKU09OLnN0cmluZ2lmeSh7IFwiY29tbWFuZFwiOiBbXCJwbGF5bGlzdC1yZW1vdmVcIiwgXCJjdXJyZW50XCJdIH0pICsgXCJcXHJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoYXQudmVyYm9zZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicGxheWxpc3QgbG9hZGVkXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlpbmcgPSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnRyYWNrID0gMFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSB0aGF0LnBsYXlsaXN0WzBdLnVyaVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICB9KTtcblxuXG5cblxuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KVxuXG5cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pXG5cblxuICAgIH1cblxuICAgIHBsYXkocGxheV9wYXRoPzogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHRoYXQgPSB0aGlzO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBpZiAocGxheV9wYXRoKSB7IC8vIG5vdCB3b3JraW5nISFcbiAgICAgICAgICAgICAgICBpZiAodGhhdC5wbGF5bGlzdC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQuY2xlYXJMaXN0KCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhwbGF5X3BhdGgpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LmFkZFRyYWNrKHsgdXJpOiBwbGF5X3BhdGggfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5ZXJfcHJvY2Vzcy53cml0ZShKU09OLnN0cmluZ2lmeSh7IFwiY29tbWFuZFwiOiBbXCJwbGF5bGlzdC1yZW1vdmVcIiwgXCJjdXJyZW50XCJdIH0pICsgXCJcXHJcXG5cIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0ID0gW11cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0LnB1c2goeyB1cmk6IHBsYXlfcGF0aCwgbGFiZWw6IHVuaXF1ZWlkKDYpIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWluZyA9IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSBwbGF5X3BhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50cmFjayA9IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh0cnVlKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5hZGRUcmFjayh7IHVyaTogcGxheV9wYXRoIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoSlNPTi5zdHJpbmdpZnkoeyBcImNvbW1hbmRcIjogW1wicGxheWxpc3QtcmVtb3ZlXCIsIFwiY3VycmVudFwiXSB9KSArIFwiXFxyXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdCA9IFtdXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdC5wdXNoKHsgdXJpOiBwbGF5X3BhdGgsIGxhYmVsOiB1bmlxdWVpZCg2KSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlpbmcgPSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gcGxheV9wYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudHJhY2sgPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGF0LnBsYXlsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICB0aGF0LmFkZFRyYWNrKHsgdXJpOiBwbGF5X3BhdGggfSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKEpTT04uc3RyaW5naWZ5KHsgXCJjb21tYW5kXCI6IFtcInBsYXlsaXN0LXJlbW92ZVwiLCBcImN1cnJlbnRcIl0gfSkgKyBcIlxcclxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5bGlzdCA9IFtdXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBsYXlsaXN0LnB1c2goeyB1cmk6IHBsYXlfcGF0aCwgbGFiZWw6IHVuaXF1ZWlkKDYpIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudXJpID0gcGxheV9wYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC50cmFjayA9IDFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoSlNPTi5zdHJpbmdpZnkoeyBcImNvbW1hbmRcIjogW1wibG9hZGZpbGVcIiwgcGxheV9wYXRoXSB9KSArIFwiXFxyXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGxheWxpc3QucHVzaCh7IHVyaTogcGxheV9wYXRoLCBsYWJlbDogdW5pcXVlaWQoNikgfSlcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC51cmkgPSBwbGF5X3BhdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQudHJhY2sgPSAxXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhhdC5wbGF5bGlzdC5sZW5ndGggPiAwICYmICF0aGF0LnBsYXlpbmcpIHtcblxuICAgICAgICAgICAgICAgIHRoYXQucGxheWVyX3Byb2Nlc3Mud3JpdGUoSlNPTi5zdHJpbmdpZnkoeyBcImNvbW1hbmRcIjogW1wicGxheVwiXSB9KSArIFwiXFxyXFxuXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoYXQudHJhY2spIHRoYXQudHJhY2sgPSAxXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhhdC51cmkpIHRoYXQudXJpID0gdGhhdC5wbGF5bGlzdFswXS51cmlcblxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KFwibm90aGluZyB0byBwbGF5XCIpXG5cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHBhdXNlKCkge1xuICAgICAgICBjb25zdCB0aGF0ID0gdGhpcztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dHJ1ZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG4gICAgICAgICAgICB0aGF0LnBsYXllcl9wcm9jZXNzLndyaXRlKEpTT04uc3RyaW5naWZ5KHsgXCJjb21tYW5kXCI6IFtcInBsYXlcIl0gfSkgKyBcIlxcclxcblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhhdC5wbGF5aW5nID0gZmFsc2VcblxuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSlcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHBsYXlUcmFjaygpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHRydWU+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuXG5cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBuZXh0VHJhY2soKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblxuXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHByZXZpb3VzVHJhY2soKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx0cnVlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cblxuXG4gICAgICAgIH0pXG4gICAgfVxuXG5cblxufVxuXG4iXX0=
