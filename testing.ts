import * as net from "net";

const mpv_process = net.createConnection(5252, "localhost")




mpv_process.on("connect", function () { // add timeout
    console.log("connected")

});


mpv_process.on("data", function (data) { // add timeout
    console.log("mpvdata: " + data + "\n")
});
mpv_process.on("error", function (data) { // add timeout
    console.log("mpverror: " + data + "\n")
});
// xset -dpms
setTimeout(() => {
    mpv_process.write("add " + __dirname + "/test/videos/toccata.mp4" + "\n\t", () => {
        console.log("added1")

        setTimeout(() => {
            mpv_process.write("add " + __dirname + "/test/videos/hoedown.mp4" + "\n\t", () => {

                setTimeout(() => {
                    mpv_process.write("add " + __dirname + "/test/videos/daddy.mp4" + "\n\t", () => {

                        console.log("added2")

                    })
                }, 10000)
            })
        }, 10000)
    })
}, 2000)