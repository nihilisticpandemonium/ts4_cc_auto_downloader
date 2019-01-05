import util from "util";

export const sleep = util.promisify(setTimeout);

export function formatBytes(a: number, b?: number) {
    if (0 == a) return "0 Bytes";
    var c = 1024,
        d = b || 2,
        e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(a) / Math.log(c));
    return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f];
}

export function titleCase(str: string) {
    let strAry = str.toLowerCase().split("/");
    for (var i = 0; i < strAry.length; i++) {
        strAry[i] = strAry[i].charAt(0).toUpperCase() + strAry[i].slice(1);
    }
    return strAry.join("/");
}
