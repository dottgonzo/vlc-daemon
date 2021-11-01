import { spawn } from "child_process";
import net from "net";
import fs from "fs/promises";
import { uniqueid } from "unicoid";
import { setTimeout } from "timers/promises";
interface ITrackload {
  title?: string;
  label?: string;
  uri: string;
}

interface ITrack extends ITrackload {
  label: string;
}

interface Ivlcconf {
  socketfile?: string;
  socketconf?: string;
  verbose?: boolean;
  noaudio?: boolean;
  fullscreen?: boolean;
}

function writeToVlc(proc: any, str: string) {
  return new Promise((resolve, reject) => {
    proc.write(str, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

export class vlcdaemon {
  playlist: ITrack[] = [];
  track: number = 0;
  uri: string = "";
  daemonized: boolean = false;
  playing: boolean = false;
  player_process: any = false;
  socket: any;
  socketport: number = 5252;
  verbose: boolean;
  noaudio: boolean = false;
  fullscreen: boolean = false;
  constructor(conf?: Ivlcconf) {
    if (conf) {
      if (conf.verbose) this.verbose = conf.verbose;
      if (conf.noaudio) this.noaudio = conf.noaudio;
      if (conf.fullscreen) this.fullscreen = conf.fullscreen;
    }
  }

  async start(options?: string[]) {
    if (!this.daemonized) {
      const default_options = [
        "-I",
        "rc",
        "--rc-fake-tty",
        "--no-osd",
        "--no-mouse-events",
        "--no-keyboard-events",
        "--rc-host",
        "localhost:" + this.socketport,
        "--loop",
        "--image-duration=-1",
        "--daemon",
      ];
      if (this.fullscreen) default_options.push("--fullscreen");

      let cvlc;
      if (options) {
        for (const dopt of default_options) {
          if (!options.find((f) => f === dopt)) options.push(dopt);
        }

        console.log("cvlcopts0", options);

        cvlc = spawn("cvlc", options, { detached: true, stdio: "ignore" });
      } else {
        const cvlcopts = [
          "-I",
          "rc",
          "--rc-fake-tty",
          "--no-osd",
          "--no-mouse-events",
          "--no-keyboard-events",
          "--rc-host",
          "localhost:" + this.socketport,
          "--loop",
          "--image-duration=-1",
          "--daemon",
        ];
        if (this.fullscreen) cvlcopts.push("--fullscreen");
        console.log("cvlcopts1", cvlcopts);
        cvlc = spawn("cvlc", cvlcopts, { detached: true, stdio: "ignore" });
      }
      if (this.verbose) {
        cvlc.on("error", (data) => {
          console.log("error: " + data);
        });
      }
      await setTimeout(5000);
      this.player_process = net.createConnection(this.socketport, "localhost");
      const that = this;

      this.player_process.on("connect", function () {
        // add timeout
        if (!that.daemonized) {
          that.daemonized = true;
        }
      });
      if (this.verbose) {
        this.player_process.on("data", function (data) {
          // add timeout
          console.log("vlcdata: " + data);
        });
        this.player_process.on("error", function (data) {
          // add timeout
          console.log("vlcerror: " + data);
        });
      }
    } else {
      console.error("player is just running");
    }
  }

  async switch(target: number) {
    // relative

    if (target > 0) {
      await this.next();
    } else if (target === 0) {
      console.error("nothing to do");
    } else {
      await this.prev();
    }
  }

  async next() {
    const target = this.track + 1;

    if (target < this.playlist.length && this.playlist[target]) {
      await writeToVlc(this.player_process, "next\n");

      console.log("SWITCHING To " + target);
      this.uri = this.playlist[target].uri;

      this.track = target;
    } else {
      console.warn("not to do");
    }
  }
  async prev() {
    const target = this.track - 1;
    if (target > -1 && this.playlist[target]) {
      console.log("SWITCHING To " + target);

      await writeToVlc(this.player_process, "prev\n");
      this.uri = this.playlist[target].uri;
      this.track = target;
    } else {
      console.warn("not this now");
    }
  }
  async to(target: number) {
    console.log("track before is " + this.track);
    console.log("track to change is " + target);

    if ((target || target === 0) && this.playlist[target]) {
      // if (target !== that.track) {

      let adjtarget = target + 4;
      console.log("switch to " + adjtarget);

      await writeToVlc(this.player_process, "goto " + adjtarget + "\n");

      this.uri = this.playlist[target].uri;

      this.track = target;

      // } else {
      //     console.log('is just it')
      //     resolve(true)

      // }
    } else {
      console.error("specify target");
    }
  }

  async stop() {
    await writeToVlc(this.player_process, "stop\n");

    // parse file to load the list on class

    this.track = 0;
    this.playlist = [];
    this.playing = false;
    this.uri = "";
  }

  end() {
    const that = this;

    return new Promise<true>((resolve, reject) => {
      that.player_process.kill((err) => {
        if (err) return reject(err);
        that.daemonized = false;
        that.track = 0;
        that.playlist = [];
        that.playing = false;
        that.uri = "";
        resolve(true);
      });
    });
  }
  async loadListfromFile(playlist_path: string, playnow?: true) {
    if (playlist_path && playlist_path.split(".pls").length > 1) {
      if (this.daemonized) {
        const data = await fs.readFile(playlist_path, "utf-8");

        const datatoarray = data.toString().split("\n");
        const tracks = [];
        for (const data of datatoarray) {
          if (
            data.split("=").length > 1 &&
            data.split("NumberOfEntries=").length < 2 &&
            data.split("Version=").length < 2
          ) {
            const index = parseInt(
              data.split("=")[0][data.split("=")[0].length - 1]
            );

            if (tracks.length < index) {
              tracks.push({});
            }
            if (data.split("File").length > 1) {
              tracks[index - 1].uri = data.split(data.split("=")[0] + "=")[1];
            } else if (data.split("Title").length > 1) {
              tracks[index - 1].title = data.split(data.split("=")[0] + "=")[1];
            }
          }
        }

        this.playlist = tracks.map((t) =>
          Object.assign(t, { label: uniqueid(4) })
        );
      } else {
        throw new Error("vlc not started");
      }
    } else {
      throw new Error("wrong pls file");
    }
  }

  async addTrack(track: ITrackload, index?: number) {
    if (this.playlist.length > 0) {
      await writeToVlc(this.player_process, "enqueue " + track.uri + "\n");

      if (!track.label) track.label = uniqueid(4);
      this.playlist.push(<ITrack>track);
      if (this.verbose) {
        console.log("append track");
      }
    } else {
      await writeToVlc(this.player_process, "add " + track.uri + "\n");

      if (!track.label) track.label = uniqueid(4);
      this.playlist.push(<ITrack>track);
      if (this.verbose) {
        console.log("start first track of a playlist");
      }
    }
  }

  async clearList() {
    if (this.playlist.length > 0) {
      await writeToVlc(this.player_process, "clear\n");

      if (this.playlist.find((f) => f.uri === this.uri))
        this.playlist = [this.playlist.find((f) => f.uri === this.uri)];
      else this.playlist = [];

      if (this.verbose) {
        console.log("clear playlist");
      }
    }
  }
  async loadList(tracks: ITrackload[]) {
    if (this.playing) {
      await this.clearList();
      for (const track of tracks) {
        await this.addTrack(track);
      }
    } else {
      for (const track of tracks) {
        await this.addTrack(track);
      }
      //    that.player_process.write(JSON.stringify({ "command": ["playlist-remove", "current"] }) + "\r\n", () => {
      if (this.verbose) {
        console.log("playlist loaded");
      }
      this.playing = true;
      this.track = 0;
      this.uri = this.playlist[0].uri;
    }
  }

  async play(play_path?: string) {
    if (play_path) {  
      // not working!!
      if (this.playlist.length > 1) {
        try {
          await this.clearList();
          console.log(play_path);
          await this.addTrack({ uri: play_path });

          await writeToVlc(
            this.player_process,
            JSON.stringify({
              command: ["playlist-remove", "current"],
            }) + "\r\n"
          );

          this.playlist = [];

          this.playlist.push({
            uri: play_path,
            label: uniqueid(6),
          });
          this.playing = true;
          this.uri = play_path;
          this.track = 1;
        } catch (err) {
          await this.addTrack({ uri: play_path });
          await writeToVlc(
            this.player_process,
            JSON.stringify({
              command: ["playlist-remove", "current"],
            }) + "\r\n"
          );

          this.playlist = [];

          this.playlist.push({
            uri: play_path,
            label: uniqueid(6),
          });
          this.playing = true;
          this.uri = play_path;
          this.track = 1;
        }
      } else if (this.playlist.length === 1) {
        await this.addTrack({ uri: play_path });

        await writeToVlc(
          this.player_process,
          JSON.stringify({
            command: ["playlist-remove", "current"],
          }) + "\r\n"
        );

        this.playlist = [];

        this.playlist.push({ uri: play_path, label: uniqueid(6) });
        this.playing = true;
        this.uri = play_path;
        this.track = 1;
      } else {
        await writeToVlc(
          this.player_process,
          JSON.stringify({ command: ["loadfile", play_path] }) + "\r\n"
        );

        this.playlist.push({ uri: play_path, label: uniqueid(6) });

        this.playing = true;
        this.uri = play_path;
        this.track = 1;
      }
    } else if (this.playlist.length > 0 && !this.playing) {
      await writeToVlc(
        this.player_process,
        JSON.stringify({ command: ["play"] }) + "\r\n"
      );

      this.playing = true;
      if (!this.track) this.track = 1;
      if (!this.uri) this.uri = this.playlist[0].uri;
    } else {
      throw new Error("nothing to play");
    }
  }
  async pause() {
    await writeToVlc(
      this.player_process,
      JSON.stringify({ command: ["play"] }) + "\r\n"
    );
    this.playing = false;
  }
  playTrack() {
    return new Promise<true>((resolve, reject) => {});
  }

  nextTrack() {
    return new Promise<true>((resolve, reject) => {});
  }
  previousTrack() {
    return new Promise<true>((resolve, reject) => {});
  }
}
