import * as mocha from "mocha";
import * as chai from "chai";

// import couchauth= require("../index");

import { mpvdaemon } from "../index";


const Player = new mpvdaemon()



const expect = chai.expect;

describe("mpv class playlist from file", function () {
    describe("configuration", function () {

        it("expect return an object", function () {
            expect(Player).to.be.ok;
        });
        it("expect to have property playlist", function () {
            expect(Player).to.have.property('playlist').that.is.an('array');
        });
        it("expect to have property daemonized", function () {
            expect(Player).to.have.property('daemonized').that.is.not.ok
        });

        it("start", function (done) {
            this.timeout(50000);

            Player.start().then(function (a) {
                expect(Player).to.have.property('daemonized').that.is.ok
                done()
            }).catch(function (err) {
                expect(err).to.not.exist
                done()
            })
        });
        it("player is now daemonized", function () {
            expect(Player).to.have.property('daemonized').that.is.ok
        });
        it("player is not playing now", function () {
            expect(Player).to.have.property('playing').that.is.not.ok
        });
    });


    describe("playlist", function () {

        it("load a playlist from file", function (done) {
            this.timeout(50000);

            Player.loadListfromFile(__dirname + "/localplaylist.pls", true).then((a) => {
                expect(Player.playlist.length).to.be.eq(2);
                expect(Player.playlist[0]).to.have.property('title');
                expect(Player.playlist[0]).to.have.property('uri');
                expect(Player.playlist[0]).to.have.property('label');

                expect(Player.playing).to.be.ok;


                setTimeout(function () {
                    done()
                }, 3000)

            }).catch((err) => {
                console.log(err)
                expect(err).to.not.exist
                done()
            })
        });

        it("player is running now", function () {
            expect(Player).to.have.property('playing').that.is.ok
        });
        it("The track is the number 1", function () {
            expect(Player).to.have.property('track').that.eq(1)
        });



        it("switch to next track what", function (done) {
            this.timeout(50000);

            Player.next().then((a) => {
                expect(Player.playlist.length).to.be.eq(2);
                expect(Player).to.have.property('track').that.eq(2)


                setTimeout(function () {
                    done()
                }, 3000)

            }).catch((err) => {
                expect(err).to.not.exist
                done()
            })
        });


        it("switch to prev track best", function (done) {
            this.timeout(50000);

            Player.prev().then((a) => {
                expect(Player.playlist.length).to.be.eq(2);
                expect(Player).to.have.property('track').that.eq(1)


                setTimeout(function () {
                    done()
                }, 3000)

            }).catch((err) => {
                expect(err).to.not.exist
                done()
            })
        });



    });
    describe("start with a video", function () {

        it("expect a video", function (done) {
            this.timeout(50000);

            Player.play(__dirname + "/../videos/hoedown.mp4").then(function () {
                expect(Player).to.be.ok;
                expect(Player.playlist.length).to.be.eq(1);
                expect(Player).to.have.property('track').that.eq(1)


                setTimeout(function () {
                    done()
                }, 3000)
            })
        });

        it("switch to another video", function (done) {
            this.timeout(50000);
            Player.start(__dirname + "/../videos/toccata.mp4").then(function () {
                expect(Player).to.be.ok;
                expect(Player.playlist.length).to.be.eq(1);
                expect(Player).to.have.property('track').that.eq(1)
                setTimeout(function () {
                    done()
                }, 3000)
            })
        });

    });
});