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
const net = __importStar(require("net"));
const mpv_process = net.createConnection(5252, "localhost");
mpv_process.on("connect", function () {
    console.log("connected");
});
mpv_process.on("data", function (data) {
    console.log("mpvdata: " + data + "\n");
});
mpv_process.on("error", function (data) {
    console.log("mpverror: " + data + "\n");
});
// xset -dpms
setTimeout(() => {
    mpv_process.write("add " + __dirname + "/test/videos/toccata.mp4" + "\n\t", () => {
        console.log("added1");
        setTimeout(() => {
            mpv_process.write("add " + __dirname + "/test/videos/hoedown.mp4" + "\n\t", () => {
                setTimeout(() => {
                    mpv_process.write("add " + __dirname + "/test/videos/daddy.mp4" + "\n\t", () => {
                        console.log("added2");
                    });
                }, 10000);
            });
        }, 10000);
    });
}, 2000);
//# sourceMappingURL=testing.js.map