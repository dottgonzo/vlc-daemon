"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai = __importStar(require("chai"));
// import couchauth= require("../index");
const index_1 = require("../index");
const Player = new index_1.vlcdaemon({ verbose: true });
const testsources = [
    { title: "test2", uri: 'https://www.exeterphoenix.org.uk/wp-content/uploads/2013/04/zero-logo.jpg' },
    { title: "test2", uri: "https://ubistatic19-a.akamaihd.net/ubicomstatic/en-US/global/media/uno-ubicom-video-launch_trailer-THUMB-712x712_Desktop_263720.jpg" },
    { title: "test2", uri: 'https://app.due.com/assets/due/images/logo/due_logo_blk.png' },
    { title: "test2", uri: 'http://www.punto-informatico.it/punto/20170410/windtre.jpg' },
    { title: "test2", uri: 'https://sc01.alicdn.com/kf/HTB1kUpSFVXXXXcGXFXXq6xXFXXXk/202653291/HTB1kUpSFVXXXXcGXFXXq6xXFXXXk.jpg' }
];
const expect = chai.expect;
describe("mpv class", function () {
    describe("configuration", function () {
        it("expect return an object", function () {
            expect(Player).to.be.ok;
        });
        it("expect to have property playlist", function () {
            expect(Player).to.have.property('playlist').that.is.an('array');
        });
        it("expect to have property daemonized", function () {
            expect(Player).to.have.property('daemonized').that.is.not.ok;
        });
        it("start", function (done) {
            this.timeout(50000);
            Player.start().then(function (a) {
                expect(Player).to.have.property('daemonized').that.is.ok;
                done();
            }).catch(function (err) {
                expect(err).to.not.exist;
                done();
            });
        });
        it("player is now daemonized", function () {
            expect(Player).to.have.property('daemonized').that.is.ok;
        });
        it("player is not playing now", function () {
            expect(Player).to.have.property('playing').that.is.not.ok;
        });
    });
    describe("playlist", function () {
        it("load a playlist from object", function (done) {
            this.timeout(50000);
            Player.loadList(testsources).then((a) => {
                expect(Player.playlist.length).to.be.eq(5);
                expect(Player.playlist[0]).to.have.property('uri').that.eq(testsources[0].uri);
                expect(Player.playlist[0]).to.have.property('label').that.is.a("string");
                expect(Player.playlist[1]).to.have.property('title').that.eq("test2");
                expect(Player.playlist[1]).to.have.property('uri').that.eq(testsources[1].uri);
                expect(Player.playlist[1]).to.have.property('label').that.is.a("string");
                console.log(Player.playlist);
                console.log(Player.track);
                //    expect(Player.playing).to.be.ok;
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                console.log(err);
                expect(err).to.not.exist;
                done();
            });
        });
        it("player is still running", function () {
            expect(Player).to.have.property('playing').that.is.ok;
        });
        it("switch to 4", function (done) {
            this.timeout(50000);
            Player.to(4).then((a) => {
                expect(Player).to.have.property('track').that.eq(4);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 2", function (done) {
            this.timeout(50000);
            Player.to(2).then((a) => {
                expect(Player).to.have.property('track').that.eq(2);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 0", function (done) {
            this.timeout(50000);
            Player.to(0).then((a) => {
                expect(Player).to.have.property('track').that.eq(0);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 1", function (done) {
            this.timeout(50000);
            Player.next().then((a) => {
                expect(Player).to.have.property('track').that.eq(1);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 0", function (done) {
            this.timeout(50000);
            Player.prev().then((a) => {
                expect(Player).to.have.property('track').that.eq(0);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 1", function (done) {
            this.timeout(50000);
            Player.next().then((a) => {
                expect(Player).to.have.property('track').that.eq(1);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 2", function (done) {
            this.timeout(50000);
            Player.next().then((a) => {
                expect(Player).to.have.property('track').that.eq(2);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 3", function (done) {
            this.timeout(50000);
            Player.next().then((a) => {
                expect(Player).to.have.property('track').that.eq(3);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 2", function (done) {
            this.timeout(50000);
            Player.prev().then((a) => {
                expect(Player).to.have.property('track').that.eq(2);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 3", function (done) {
            this.timeout(50000);
            Player.next().then((a) => {
                expect(Player).to.have.property('track').that.eq(3);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 2", function (done) {
            this.timeout(50000);
            Player.prev().then((a) => {
                expect(Player).to.have.property('track').that.eq(2);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 1", function (done) {
            this.timeout(50000);
            Player.prev().then((a) => {
                expect(Player).to.have.property('track').that.eq(1);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
        it("switch to 3", function (done) {
            this.timeout(50000);
            Player.to(3).then((a) => {
                expect(Player).to.have.property('track').that.eq(3);
                setTimeout(function () {
                    done();
                }, 6000);
            }).catch((err) => {
                done(Error(err));
            });
        });
    });
});
//# sourceMappingURL=checkload.js.map