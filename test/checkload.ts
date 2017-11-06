import * as mocha from "mocha";
import * as chai from "chai";

// import couchauth= require("../index");

import { vlcdaemon } from "../index";


const Player = new vlcdaemon({verbose:true, fullscreen: true})


const testsources=[
    { uri: "v4l2:///dev/video0" },
    { title: "test2", uri: '/home/dario/Video/streamcc-1505976677.flv.ok.flv' }
]


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


        it("load a playlist from object", function (done) {
            this.timeout(50000);

            Player.loadList(testsources).then((a) => {
                expect(Player.playlist.length).to.be.eq(2);
                expect(Player.playlist[0]).to.have.property('uri').that.eq(testsources[0].uri);
                expect(Player.playlist[0]).to.have.property('label').that.is.a("string");
                expect(Player.playlist[1]).to.have.property('title').that.eq("test2");
                expect(Player.playlist[1]).to.have.property('uri').that.eq(testsources[1].uri);
                expect(Player.playlist[1]).to.have.property('label').that.is.a("string");


            //    expect(Player.playing).to.be.ok;


                setTimeout(function () {
                    done()
                }, 23000)

            }).catch((err) => {
                console.log(err)
                expect(err).to.not.exist
                done()
            })
        });

        it("player is still running", function () {
            expect(Player).to.have.property('playing').that.is.ok
        });

        it("switch to next track what", function (done) {
            this.timeout(50000);

            Player.to(1).then((a) => {
                expect(Player.playlist.length).to.be.eq(2);
                expect(Player).to.have.property('track').that.eq(2)


                setTimeout(function () {
                    done()
                }, 23000)

            }).catch((err) => {
                done(Error(err))
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

                done(Error(err))
            })
        });



    

    });
});