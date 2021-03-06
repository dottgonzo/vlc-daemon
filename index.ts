import { spawn } from "child_process"
import * as Promise from "bluebird";
import * as _ from "lodash";
const pathExists = require("path-exists");
import * as async from "async";
import * as net from "net";
import * as fs from "fs";
import { uniqueid } from "unicoid";

interface ITrackload {
  title?: string
  label?: string
  uri: string

}


interface ITrack extends ITrackload {
  label: string;
}

interface Ivlcconf {
  socketfile?: string
  socketconf?: string
  verbose?: boolean
  noaudio?: boolean
  fullscreen?: boolean
}



export class vlcdaemon {

  playlist: ITrack[] = [];
  track: number = 0
  uri: string = ""
  daemonized: boolean = false
  playing: boolean = false
  player_process: any = false
  socket: any
  socketport: number = 5252
  verbose: boolean
  noaudio: boolean = false
  fullscreen: boolean = false
  constructor(conf?: Ivlcconf) {
    if (conf) {
      if (conf.verbose) this.verbose = conf.verbose
      if (conf.noaudio) this.noaudio = conf.noaudio
      if (conf.fullscreen) this.fullscreen = conf.fullscreen
    }
  }

  start(options?: string[]) {
    const that = this;
    return new Promise<true>((resolve, reject) => {
      if (!that.daemonized) {
        const default_options = ["-I", "rc", "--rc-fake-tty", "--no-osd", "--no-mouse-events", "--no-keyboard-events", "--rc-host", "localhost:" + that.socketport, "--loop", "--image-duration=-1", "--daemon"]
        if (that.fullscreen) default_options.push('--fullscreen')
        try {
          let cvlc
          if (options) {
            _.map(default_options, (dopt) => {
              let exists = false
              _.map(options, (oopt) => {
                if (dopt === oopt) exists = true
              })
              if (!exists) options.push(dopt)
            })

            console.log('cvlcopts0', options)

            cvlc = spawn("cvlc", options, { detached: true, stdio: "ignore" })

          } else {
            const cvlcopts = ["-I", "rc", "--rc-fake-tty", "--no-osd", "--no-mouse-events", "--no-keyboard-events", "--rc-host", "localhost:" + that.socketport, "--loop", "--image-duration=-1", "--daemon"]
            if (that.fullscreen) cvlcopts.push('--fullscreen')
            console.log('cvlcopts1', cvlcopts)
            cvlc = spawn("cvlc", cvlcopts, { detached: true, stdio: "ignore" })
          }
          if (that.verbose) {
            cvlc.on("error", (data) => {
              console.log("error: " + data)
            })
          }
          setTimeout(() => {

            that.player_process = net.createConnection(that.socketport, "localhost");
            that.player_process.on("connect", function () { // add timeout
              if (!that.daemonized) {
                that.daemonized = true

                resolve(true)

              }

            });
            if (that.verbose) {
              that.player_process.on("data", function (data) { // add timeout
                console.log("vlcdata: " + data)
              });
              that.player_process.on("error", function (data) { // add timeout
                console.log("vlcerror: " + data)
              });
            }


          }, 5000)

        } catch (err) {
          reject(err)
        }




      } else {
        reject({ error: "player is running" })

      }


    })

  }

  switch(target: number) { // relative 
    const that = this;

    return new Promise<true>((resolve, reject) => {

      if (target > 0) {
        that.next().then((a) => {
          resolve(a)
        }).catch((err) => {
          reject(err)
        })
      } else if (target === 0) {
        reject({ error: "nothing to do" })
      } else {
        that.prev().then((a) => {
          resolve(a)
        }).catch((err) => {
          reject(err)
        })
      }

    })
  }

  next() {
    const that = this;

    return new Promise<true>((resolve, reject) => {

      const target = that.track + 1

      if (target < that.playlist.length && that.playlist[target]) {

        that.player_process.write("next\n", () => {
          console.log('SWITCHING To ' + target)
          that.uri = that.playlist[target].uri

          that.track = target
          resolve(true)

        });

      } else {
        resolve(true)

      }


    })
  }
  prev() {
    const that = this;

    return new Promise<true>((resolve, reject) => {
      const target = that.track - 1
      if (target > -1) {
        if (that.playlist[target]) {
          console.log('SWITCHING To ' + target)

          that.player_process.write("prev\n", () => {

            that.uri = that.playlist[target].uri
            that.track = target



            resolve(true)
          });
        } else {
          resolve(true)

        }


      } else {
        resolve(true)

      }
    })
  }
  to(target: number) {
    const that = this;

    return new Promise<true>((resolve, reject) => {
      console.log('track before is ' + that.track)
      console.log('track to change is ' + target)

      if ((target || target === 0) && that.playlist[target]) {
        // if (target !== that.track) {

        let adjtarget = target + 4
        console.log("switch to " + adjtarget)
        that.player_process.write("goto " + adjtarget + "\n", () => {


          that.uri = that.playlist[target].uri

          that.track = target



          resolve(true)
        });
        // } else {
        //     console.log('is just it')
        //     resolve(true)

        // }
      } else {
        reject("specify target")

      }

    })
  }


  stop() {
    const that = this;

    return new Promise<true>((resolve, reject) => {
      try {
        that.player_process.write("stop\n", () => {
          // parse file to load the list on class

          that.track = 0
          that.playlist = []
          that.playing = false
          that.uri = ""
          resolve(true)
        });



      } catch (err) {
        reject({ error: err })
      }


    })
  }


  end() {
    const that = this;

    return new Promise<true>((resolve, reject) => {
      try {
        that.player_process.kill()
        that.daemonized = false
        that.track = 0
        that.playlist = []
        that.playing = false
        that.uri = ""
        resolve(true)
      } catch (err) {
        reject({ error: err })
      }


    })
  }
  loadListfromFile(playlist_path: string, playnow?: true) {
    const that = this;
    return new Promise<true>((resolve, reject) => {
      if (playlist_path && playlist_path.split('.pls').length > 1) {
        pathExists(playlist_path).then((a) => {
          if (a) {
            if (that.daemonized) {
              fs.readFile(playlist_path, (err, data) => {
                if (err) {
                  console.log("errload")

                  reject({ error: err })
                } else {
                  fs.readFile(playlist_path, function (err, data) {
                    if (err) {
                      console.log({ error: err })
                      reject({ error: err })
                    } else {

                      const datatoarray = data.toString().split("\n")
                      const tracks = []
                      _.map(datatoarray, function (data) {
                        if (data.split('=').length > 1 && data.split('NumberOfEntries=').length < 2 && data.split('Version=').length < 2) {

                          const index = parseInt(data.split('=')[0][data.split('=')[0].length - 1])

                          if (tracks.length < index) {
                            tracks.push({})
                          }
                          if (data.split('File').length > 1) {
                            tracks[index - 1].uri = data.split(data.split('=')[0] + "=")[1]
                          } else if (data.split('Title').length > 1) {
                            tracks[index - 1].title = data.split(data.split('=')[0] + "=")[1]
                          }
                        }
                      })

                      that.playlist = []
                      _.map(tracks, function (track) {
                        track.label = uniqueid(4)
                        that.playlist.push(track)
                      });

                      resolve(true)
                      if (playnow) {



                      } else {




                      }
                    }
                  })

                }
              })

            } else {
              reject({ error: "vlc not started" })

            }

          } else {
            console.log("erro")

            reject({ error: "wrong path" })
          }
        }).catch((err) => {
          reject(err)

        })
      } else {
        console.log("erro")
        reject({ error: "file must be a .pls file" })

      }
    });

  }

  addTrack(track: ITrackload, index?: number) {
    const that = this;
    return new Promise<true>((resolve, reject) => {





      if (that.playlist.length > 0) {
        that.player_process.write("enqueue " + track.uri + "\n", () => {
          if (!track.label) track.label = uniqueid(4)
          that.playlist.push(<ITrack>track)
          if (that.verbose) {
            console.log("append track")
          }
          resolve(true)
        });
      } else {
        that.player_process.write("add " + track.uri + "\n", () => {
          if (!track.label) track.label = uniqueid(4)
          that.playlist.push(<ITrack>track)
          if (that.verbose) {
            console.log("start first track of a playlist")
          }
          resolve(true)
        });
      }

    });




  }

  clearList() {
    const that = this;
    return new Promise<true>((resolve, reject) => {
      if (that.playlist.length > 0) {

        let preserve: ITrack
        that.player_process.write("clear\n", () => {
          _.map(that.playlist, (t) => {
            if (t.uri === that.uri) {
              preserve = t
            }
          })
          if (preserve) {
            that.playlist = [preserve]
          } else {
            that.playlist = []
          }

          if (that.verbose) {
            console.log("clear playlist")
          }
          resolve(true)
        })
      } else {
        resolve(true)

      }

    });

  }
  loadList(tracks: ITrackload[]) {
    const that = this;
    return new Promise<true>((resolve, reject) => {
      if (that.playing) {
        that.clearList().then(() => {
          async.eachSeries(tracks, (track, cb) => {
            that.addTrack(track).then((a) => {
              cb()
            }).catch((err) => {
              cb(err)
            })
          }, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve(true)

            }
          })
        }).catch((err) => {
          reject(err)
        })
      } else {

        async.eachSeries(tracks, (track, cb) => {
          that.addTrack(track).then((a) => {
            cb()
          }).catch((err) => {
            cb(err)
          })
        }, (err) => {
          if (err) {
            reject(err)
          } else {

            //    that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", () => {
            if (that.verbose) {
              console.log("playlist loaded")
            }
            that.playing = true
            that.track = 0
            that.uri = that.playlist[0].uri
            resolve(true)
            //         });





          }
        })



      }

    })


  }

  play(play_path?: string) {
    const that = this;

    return new Promise<true>((resolve, reject) => {
      if (play_path) { // not working!!
        if (that.playlist.length > 1) {
          that.clearList().then(() => {
            console.log(play_path)
            that.addTrack({ uri: play_path }).then(() => {
              that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", () => {
                that.playlist = []

                that.playlist.push({ uri: play_path, label: uniqueid(6) })
                that.playing = true
                that.uri = play_path
                that.track = 1
                resolve(true)
              });

            }).catch((err) => {
              reject(err)
            })

          }).catch((err) => {
            that.addTrack({ uri: play_path }).then(() => {
              that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", () => {
                that.playlist = []

                that.playlist.push({ uri: play_path, label: uniqueid(6) })
                that.playing = true
                that.uri = play_path
                that.track = 1
                resolve(true)
              });

            }).catch((err) => {
              reject(err)
            })

          })
        } else if (that.playlist.length === 1) {
          that.addTrack({ uri: play_path }).then(() => {
            that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", () => {
              that.playlist = []

              that.playlist.push({ uri: play_path, label: uniqueid(6) })
              that.playing = true
              that.uri = play_path
              that.track = 1
              resolve(true)
            });

          }).catch((err) => {
            reject(err)
          })
        } else {
          that.player_process.write(JSON.stringify({ "command": ["loadfile", play_path] }) + "\r\n", () => {
            that.playlist.push({ uri: play_path, label: uniqueid(6) })

            that.playing = true
            that.uri = play_path
            that.track = 1
            resolve(true)
          });

        }


      } else if (that.playlist.length > 0 && !that.playing) {

        that.player_process.write(JSON.stringify({ "command": ["play"] }) + "\r\n", () => {
          that.playing = true
          if (!that.track) that.track = 1
          if (!that.uri) that.uri = that.playlist[0].uri

          resolve(true)
        });

      } else {
        reject("nothing to play")

      }


    })
  }
  pause() {
    const that = this;

    return new Promise<true>((resolve, reject) => {

      that.player_process.write(JSON.stringify({ "command": ["play"] }) + "\r\n", () => {
        that.playing = false

        resolve(true)
      });

    })
  }
  playTrack() {
    return new Promise<true>((resolve, reject) => {



    })
  }

  nextTrack() {
    return new Promise<true>((resolve, reject) => {



    })
  }
  previousTrack() {
    return new Promise<true>((resolve, reject) => {



    })
  }



}

